import "server-only";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllBranches } from "@/lib/queries/branches";
import { invalidateCrmWorkspace, invalidateManagerWorkspace } from "@/lib/cache/cache-tags";
import { emitWorkflowEvent } from "@/lib/notifications/workflow-signals";
import { mapPreferredRoleToStaffType } from "@/lib/staff/onboarding-roles";
import { canApproveStaffOnboarding } from "@/lib/staff/approval-permissions";
import { logError, logBusinessEvent } from "@/lib/logger";
import { canonicalizeSystemRole } from "@/constants/staff";
import { canReviewStaffOnboarding, isOwner } from "@/lib/permissions";
import { validateBranchServiceEligibility } from "@/lib/services/service-catalog";
import type { Json } from "@/types/supabase";

export type StaffReviewActor = {
  staffId: string;
  authUserId: string;
  systemRole: string;
  branchId: string | null;
};

export type ApproveStaffOnboardingInput = {
  branchId: string;
  systemRole: string;
  tier: string;
  serviceIds?: string[];
};

export type RejectStaffOnboardingInput = {
  rejectionReason?: string;
};

export type StaffOnboardingServiceResult<T = unknown> =
  | { ok: true; data: T }
  | {
      ok: false;
      code:
        | "UNAUTHENTICATED"
        | "FORBIDDEN"
        | "BRANCH_MISMATCH"
        | "INVALID_INPUT"
        | "INVALID_STATE"
        | "NOT_FOUND"
        | "SAVE_FAILED";
      error: string;
    };

export function invalidateOnboardingApprovalSurfaces(branchId: string) {
  invalidateCrmWorkspace(branchId);
  invalidateManagerWorkspace(branchId);
  revalidatePath("/owner/staff");
  revalidatePath("/manager/staff");
  revalidatePath("/crm/staff");
  revalidatePath("/crm/setup");
  revalidatePath("/staff-onboarding");
}

type CompensationResult = {
  success: boolean;
  requestRestored: boolean;
  staffRestored: boolean;
  capabilitiesRestored: boolean;
  requestSkippedDueToMismatch?: boolean;
  staffSkippedDueToMismatch?: boolean;
  capabilitiesSkippedDueToMismatch?: boolean;
  error?: string;
};

async function compensateApprovalMutation(params: {
  admin: ReturnType<typeof createAdminClient>;
  requestId: string;
  actorStaffId: string;
  priorRequest: {
    requested_branch_id: string | null;
    metadata: Json;
  };
  revertRequest: boolean;
  staffId?: string;
  priorStaff?: {
    is_active: boolean;
    branch_id: string;
    system_role: string;
    staff_type: string;
    tier: string;
    nickname: string | null;
  };
  appliedStaffState?: {
    is_active: boolean;
    branch_id: string;
    system_role: string;
    staff_type: string;
    tier: string;
    nickname?: string | null;
  };
  revertStaff: boolean;
  priorCapabilityIds?: string[] | null;
  appliedServiceIds?: string[] | null;
  revertCapabilities: boolean;
}): Promise<CompensationResult> {
  const {
    admin,
    requestId,
    actorStaffId,
    priorRequest,
    revertRequest,
    staffId,
    priorStaff,
    appliedStaffState,
    revertStaff,
    priorCapabilityIds,
    appliedServiceIds,
    revertCapabilities,
  } = params;

  let requestRestored = !revertRequest;
  let staffRestored = !revertStaff;
  let capabilitiesRestored = !revertCapabilities;
  let requestSkippedDueToMismatch = false;
  let staffSkippedDueToMismatch = false;
  let capabilitiesSkippedDueToMismatch = false;
  const errorMsgs: string[] = [];

  // 1. Conditional rollback of capabilities if requested
  if (
    revertCapabilities &&
    staffId &&
    priorCapabilityIds !== null &&
    priorCapabilityIds !== undefined &&
    appliedServiceIds
  ) {
    const { data: currentCaps, error: capFetchErr } = await admin
      .from("staff_services")
      .select("service_id")
      .eq("staff_id", staffId);

    if (capFetchErr) {
      errorMsgs.push(`Capabilities rollback fetch failed: ${capFetchErr.message}`);
      logError("staff.onboarding.compensation_capabilities_fetch_failed", {
        staffId,
        error: capFetchErr,
      });
    } else {
      const currentCapIds = (currentCaps ?? [])
        .map((r: { service_id: string }) => r.service_id)
        .sort();
      const expectedCapIds = appliedServiceIds.slice().sort();
      const matchesAppliedCaps =
        currentCapIds.length === expectedCapIds.length &&
        currentCapIds.every((id: string, idx: number) => id === expectedCapIds[idx]);

      if (!matchesAppliedCaps) {
        capabilitiesSkippedDueToMismatch = true;
        logError("staff.onboarding.compensation_capabilities_skipped_state_mismatch", {
          staffId,
          currentCapIds,
          expectedCapIds,
        });
      } else {
        const { error: capErr } = await admin.rpc("replace_staff_service_capabilities", {
          p_target_staff_id: staffId,
          p_service_ids: priorCapabilityIds,
        });
        if (capErr) {
          const capMsg = `Capabilities rollback failed: ${capErr.message}`;
          errorMsgs.push(capMsg);
          logError("staff.onboarding.compensation_capabilities_failed", {
            staffId,
            error: capErr,
          });
        } else {
          capabilitiesRestored = true;
        }
      }
    }
  }

  // 2. Conditional rollback of staff record
  if (revertStaff && staffId && priorStaff && appliedStaffState) {
    const { data: currentStaff, error: fetchStaffErr } = await admin
      .from("staff")
      .select("id, is_active, branch_id, system_role, staff_type, tier, nickname")
      .eq("id", staffId)
      .maybeSingle();

    if (fetchStaffErr) {
      errorMsgs.push(`Staff rollback verification failed: ${fetchStaffErr.message}`);
      logError("staff.onboarding.compensation_staff_fetch_failed", {
        staffId,
        error: fetchStaffErr,
      });
    } else if (!currentStaff) {
      errorMsgs.push("Staff rollback failed: target staff row not found.");
      logError("staff.onboarding.compensation_staff_not_found", { staffId });
    } else {
      const matchesApplied =
        currentStaff.is_active === appliedStaffState.is_active &&
        currentStaff.branch_id === appliedStaffState.branch_id &&
        currentStaff.system_role === appliedStaffState.system_role &&
        currentStaff.staff_type === appliedStaffState.staff_type &&
        currentStaff.tier === appliedStaffState.tier &&
        (appliedStaffState.nickname === undefined ||
          currentStaff.nickname === appliedStaffState.nickname);

      if (!matchesApplied) {
        staffSkippedDueToMismatch = true;
        logError("staff.onboarding.compensation_staff_skipped_state_mismatch", {
          staffId,
          currentStaff,
          expectedApplied: appliedStaffState,
        });
      } else {
        const { data: restoredStaff, error: staffErr } = await admin
          .from("staff")
          .update({
            is_active: priorStaff.is_active,
            branch_id: priorStaff.branch_id,
            system_role: priorStaff.system_role,
            staff_type: priorStaff.staff_type,
            tier: priorStaff.tier,
            nickname: priorStaff.nickname,
          })
          .eq("id", staffId)
          .eq("is_active", appliedStaffState.is_active)
          .eq("branch_id", appliedStaffState.branch_id)
          .eq("system_role", appliedStaffState.system_role)
          .eq("tier", appliedStaffState.tier)
          .select("id")
          .maybeSingle();

        if (staffErr) {
          errorMsgs.push(`Staff rollback failed: ${staffErr.message}`);
          logError("staff.onboarding.compensation_staff_failed", { staffId, error: staffErr });
        } else if (!restoredStaff) {
          staffSkippedDueToMismatch = true;
          errorMsgs.push("Staff rollback skipped: state changed concurrently.");
          logError("staff.onboarding.compensation_staff_concurrent_conflict", { staffId });
        } else {
          staffRestored = true;
        }
      }
    }
  }

  // 3. Conditional rollback of onboarding request back to submitted
  if (revertRequest) {
    const { data: currentReq, error: reqFetchErr } = await admin
      .from("staff_onboarding_requests")
      .select("id, status, reviewed_by_staff_id")
      .eq("id", requestId)
      .maybeSingle();

    if (reqFetchErr) {
      errorMsgs.push(`Request rollback fetch failed: ${reqFetchErr.message}`);
      logError("staff.onboarding.compensation_request_fetch_failed", {
        requestId,
        error: reqFetchErr,
      });
    } else if (!currentReq) {
      errorMsgs.push("Request rollback failed: request row not found.");
      logError("staff.onboarding.compensation_request_not_found", { requestId });
    } else if (
      currentReq.status !== "approved" ||
      currentReq.reviewed_by_staff_id !== actorStaffId
    ) {
      requestSkippedDueToMismatch = true;
      logError("staff.onboarding.compensation_request_skipped_state_mismatch", {
        requestId,
        currentReq,
        expectedActor: actorStaffId,
      });
    } else {
      const { data: revertedReq, error: reqErr } = await admin
        .from("staff_onboarding_requests")
        .update({
          status: "submitted",
          reviewed_by_staff_id: null,
          reviewed_at: null,
          requested_branch_id: priorRequest.requested_branch_id,
          metadata: priorRequest.metadata as unknown as Json,
        })
        .eq("id", requestId)
        .eq("status", "approved")
        .eq("reviewed_by_staff_id", actorStaffId)
        .select("id")
        .maybeSingle();

      if (reqErr) {
        errorMsgs.push(`Request rollback failed: ${reqErr.message}`);
        logError("staff.onboarding.compensation_request_failed", {
          requestId,
          error: reqErr,
        });
      } else if (!revertedReq) {
        requestSkippedDueToMismatch = true;
        errorMsgs.push("Request rollback skipped: state changed concurrently.");
        logError("staff.onboarding.compensation_request_concurrent_conflict", { requestId });
      } else {
        requestRestored = true;
      }
    }
  }

  const overallSuccess =
    (revertStaff ? staffRestored : true) &&
    (revertCapabilities ? capabilitiesRestored : true) &&
    (revertRequest ? requestRestored : true);

  if (!overallSuccess) {
    logError("staff.onboarding.compensation_incomplete_critical", {
      requestId,
      staffId,
      staffRestored,
      capabilitiesRestored,
      requestRestored,
      staffSkippedDueToMismatch,
      capabilitiesSkippedDueToMismatch,
      requestSkippedDueToMismatch,
      errors: errorMsgs,
    });
  }

  return {
    success: overallSuccess,
    requestRestored,
    staffRestored,
    capabilitiesRestored,
    requestSkippedDueToMismatch,
    staffSkippedDueToMismatch,
    capabilitiesSkippedDueToMismatch,
    error: errorMsgs.join("; ") || undefined,
  };
}

export async function approveStaffOnboardingRequest(params: {
  actor: StaffReviewActor;
  requestId: string;
  input: ApproveStaffOnboardingInput;
}): Promise<
  StaffOnboardingServiceResult<{ staffId: string; branchId: string; systemRole: string }>
> {
  const { actor, requestId, input } = params;
  const actorRole = canonicalizeSystemRole(actor.systemRole);
  const admin = createAdminClient();

  const { data: request, error: requestFetchError } = await admin
    .from("staff_onboarding_requests")
    .select("id, requested_branch_id, staff_id, status, preferred_role, full_name, metadata")
    .eq("id", requestId)
    .maybeSingle();

  if (requestFetchError || !request) {
    return { ok: false, code: "NOT_FOUND", error: "Onboarding request not found" };
  }

  if (request.status !== "submitted") {
    return {
      ok: false,
      code: "INVALID_STATE",
      error: "This onboarding request has already been reviewed.",
    };
  }

  const staffId = request.staff_id;
  if (!staffId) {
    return {
      ok: false,
      code: "NOT_FOUND",
      error: "Staff record does not match this request.",
    };
  }

  const approvalCheck = canApproveStaffOnboarding({
    approverRole: actor.systemRole,
    approverBranchId: actor.branchId,
    targetBranchId: request.requested_branch_id,
    requestedSystemRole: input.systemRole,
  });

  if (!approvalCheck.allowed) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: approvalCheck.reason ?? "You do not have permission to approve this request.",
    };
  }

  if (!approvalCheck.assignableRoles.includes(input.systemRole)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "That role cannot be assigned with your permission level.",
    };
  }

  let activeBranches: { id: string; name: string }[] = [];
  try {
    activeBranches = await getAllBranches();
  } catch (err) {
    logError("staff.onboarding.approval_branch_lookup_failed", { error: err });
    return {
      ok: false,
      code: "SAVE_FAILED",
      error: "Unable to verify branches. Please try again later.",
    };
  }

  if (!activeBranches.some((b) => b.id === input.branchId)) {
    return { ok: false, code: "INVALID_INPUT", error: "Selected branch is not active." };
  }

  // Branch Authority:
  // OWNER: may approve an applicant into another active branch where canonical owner authority permits it.
  // NON-OWNER: final approved branch MUST equal actor.branchId.
  if (!isOwner(actorRole) && input.branchId !== actor.branchId) {
    return {
      ok: false,
      code: "BRANCH_MISMATCH",
      error: "You can only approve staff into your own branch.",
    };
  }

  const confirmedServiceIds =
    input.serviceIds === undefined ? undefined : Array.from(new Set(input.serviceIds));
  if (confirmedServiceIds && confirmedServiceIds.length > 0) {
    const eligibility = await validateBranchServiceEligibility({
      branchId: input.branchId,
      serviceIds: confirmedServiceIds,
      audience: "staff_assignment",
      deliveryMode: "any",
      useAdminClient: true,
    });
    if (!eligibility.ok) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        error: "One or more selected services are not assignable for this branch.",
      };
    }
  }

  // Load prior staff record for compensating rollback BEFORE ANY MUTATION
  const { data: priorStaff, error: priorStaffError } = await admin
    .from("staff")
    .select("id, is_active, branch_id, system_role, staff_type, tier, nickname")
    .eq("id", staffId)
    .maybeSingle();

  if (priorStaffError || !priorStaff) {
    return { ok: false, code: "NOT_FOUND", error: "Staff record not found." };
  }

  // Load prior capabilities BEFORE ANY MUTATION if capability replacement will occur
  let priorCapabilityIds: string[] | null = null;
  if (confirmedServiceIds !== undefined) {
    const { data: capRows, error: capError } = await admin
      .from("staff_services")
      .select("service_id")
      .eq("staff_id", staffId);

    if (capError) {
      logError("staff.onboarding.prior_capabilities_fetch_failed", { staffId, error: capError });
      return {
        ok: false,
        code: "SAVE_FAILED",
        error: "Unable to read existing staff capabilities for compensation.",
      };
    }
    priorCapabilityIds = (capRows ?? []).map((r: { service_id: string }) => r.service_id);
  }

  const requestMetadata = request.metadata as { nickname?: string | null } | null;
  const nickname =
    typeof requestMetadata?.nickname === "string" && requestMetadata.nickname.trim().length > 0
      ? requestMetadata.nickname.trim()
      : null;

  // Step: CONDITIONALLY CLAIM the onboarding request while status = 'submitted'
  const now = new Date().toISOString();
  const existingMetadata =
    request.metadata && typeof request.metadata === "object" && !Array.isArray(request.metadata)
      ? (request.metadata as Record<string, unknown>)
      : {};
  const branchChanged = request.requested_branch_id !== input.branchId;
  const updatedMetadata: Record<string, unknown> = {
    ...existingMetadata,
    approved_at: now,
    approved_by_staff_id: actor.staffId,
    assigned_branch_id: input.branchId,
    assigned_system_role: input.systemRole,
    assigned_tier: input.tier,
    assigned_service_ids: confirmedServiceIds ?? [],
  };
  if (branchChanged) {
    updatedMetadata.approved_branch_differs_from_requested = true;
    updatedMetadata.original_requested_branch_id = request.requested_branch_id;
    updatedMetadata.approved_branch_id = input.branchId;
    updatedMetadata.approved_branch_changed_at = now;
    updatedMetadata.approved_branch_changed_by_staff_id = actor.staffId;
  }

  const { data: claimedRequest, error: claimErr } = await admin
    .from("staff_onboarding_requests")
    .update({
      status: "approved",
      reviewed_by_staff_id: actor.staffId,
      reviewed_at: now,
      requested_branch_id: input.branchId,
      metadata: updatedMetadata as unknown as Json,
    })
    .eq("id", requestId)
    .eq("status", "submitted")
    .select("id")
    .maybeSingle();

  if (claimErr) {
    logError("staff.onboarding.claim_request_failed", {
      requestId,
      error: claimErr,
    });
    return {
      ok: false,
      code: "SAVE_FAILED",
      error: `Failed to claim onboarding request: ${claimErr.message}`,
    };
  }

  if (!claimedRequest) {
    return {
      ok: false,
      code: "INVALID_STATE",
      error: "This onboarding request has already been reviewed by another user.",
    };
  }

  // Step: Mutate staff record (ONLY reviewer who claimed request reaches here)
  const appliedStaffType =
    input.systemRole === "digital_marketer"
      ? "managerial"
      : mapPreferredRoleToStaffType(request.preferred_role ?? "");

  const appliedStaffState = {
    is_active: true,
    branch_id: input.branchId,
    system_role: input.systemRole,
    staff_type: appliedStaffType,
    tier: input.tier,
    ...(nickname ? { nickname } : {}),
  };

  const { data: updatedStaff, error: staffErr } = await admin
    .from("staff")
    .update({
      is_active: true,
      branch_id: input.branchId,
      system_role: input.systemRole,
      staff_type: appliedStaffType,
      tier: input.tier,
      ...(nickname ? { nickname } : {}),
    })
    .eq("id", staffId)
    .select("id")
    .maybeSingle();

  if (staffErr || !updatedStaff) {
    const errorDetail = staffErr?.message ?? "Target staff record could not be updated.";
    logError("staff.onboarding.staff_mutation_failed_compensating", {
      requestId,
      staffId,
      error: errorDetail,
    });

    const compensation = await compensateApprovalMutation({
      admin,
      requestId,
      actorStaffId: actor.staffId,
      priorRequest: {
        requested_branch_id: request.requested_branch_id,
        metadata: existingMetadata as unknown as Json,
      },
      revertRequest: true,
      staffId,
      priorStaff,
      appliedStaffState,
      revertStaff: false,
      priorCapabilityIds,
      appliedServiceIds: confirmedServiceIds ?? null,
      revertCapabilities: false,
    });

    return {
      ok: false,
      code: "SAVE_FAILED",
      error: `Failed to update staff record: ${errorDetail}${
        !compensation.success ? " (Rollback encountered errors. Consistency event logged.)" : ""
      }`,
    };
  }

  // Step: Capability sync with compensating rollback if failed
  if (confirmedServiceIds !== undefined) {
    const { error: capabilityErr } = await admin.rpc("replace_staff_service_capabilities", {
      p_target_staff_id: staffId,
      p_service_ids: confirmedServiceIds,
    });
    if (capabilityErr) {
      logError("staff.onboarding.capability_sync_failed_compensating", {
        staffId,
        requestId,
        error: capabilityErr,
      });
      const compensation = await compensateApprovalMutation({
        admin,
        requestId,
        actorStaffId: actor.staffId,
        priorRequest: {
          requested_branch_id: request.requested_branch_id,
          metadata: existingMetadata as unknown as Json,
        },
        revertRequest: true,
        staffId,
        priorStaff,
        appliedStaffState,
        revertStaff: true,
        priorCapabilityIds,
        appliedServiceIds: confirmedServiceIds,
        revertCapabilities: false,
      });
      return {
        ok: false,
        code: "SAVE_FAILED",
        error: `Activated staff but failed to set services: ${capabilityErr.message}${
          !compensation.success
            ? " (Rollback also encountered errors. Consistency event logged.)"
            : ""
        }`,
      };
    }
  }

  // Step 4: Emit workflow event & business event
  await emitWorkflowEvent({
    eventType: "staff_onboarding.approved",
    requestId,
    branchId: input.branchId,
    applicantStaffId: staffId,
    applicantName: request.full_name,
    actorStaffId: actor.staffId,
  });

  logBusinessEvent("staff.onboarding.approved", {
    requestId,
    staffId,
    branchId: input.branchId,
    role: input.systemRole,
    actorId: actor.staffId,
    workspace: actor.systemRole,
  });

  invalidateOnboardingApprovalSurfaces(input.branchId);

  return {
    ok: true,
    data: {
      staffId,
      branchId: input.branchId,
      systemRole: input.systemRole,
    },
  };
}

export async function rejectStaffOnboardingRequest(params: {
  actor: StaffReviewActor;
  requestId: string;
  input: RejectStaffOnboardingInput;
}): Promise<StaffOnboardingServiceResult<{ requestId: string; staffId: string | null }>> {
  const { actor, requestId, input } = params;
  const actorRole = canonicalizeSystemRole(actor.systemRole);

  if (!canReviewStaffOnboarding(actorRole)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "You do not have permission to reject applications.",
    };
  }

  const admin = createAdminClient();

  const { data: request, error: requestError } = await admin
    .from("staff_onboarding_requests")
    .select("id, requested_branch_id, status, staff_id, full_name, metadata")
    .eq("id", requestId)
    .maybeSingle();

  if (requestError || !request) {
    return { ok: false, code: "NOT_FOUND", error: "Onboarding request not found" };
  }

  if (request.status !== "submitted") {
    return {
      ok: false,
      code: "INVALID_STATE",
      error: "This onboarding request has already been reviewed.",
    };
  }

  if (!isOwner(actorRole)) {
    if (request.requested_branch_id && request.requested_branch_id !== actor.branchId) {
      return {
        ok: false,
        code: "BRANCH_MISMATCH",
        error: "You can only reject requests for your own branch",
      };
    }
  }

  const now = new Date().toISOString();
  const existingMetadata =
    request.metadata && typeof request.metadata === "object" && !Array.isArray(request.metadata)
      ? (request.metadata as Record<string, unknown>)
      : {};
  const updatedMetadata: Record<string, unknown> = {
    ...existingMetadata,
    rejected_at: now,
    rejected_by_staff_id: actor.staffId,
  };

  const { data: updatedRequest, error: updateError } = await admin
    .from("staff_onboarding_requests")
    .update({
      status: "rejected",
      reviewed_by_staff_id: actor.staffId,
      reviewed_at: now,
      rejection_reason: input.rejectionReason ?? null,
      metadata: updatedMetadata as unknown as Json,
    })
    .eq("id", requestId)
    .eq("status", "submitted")
    .select("id")
    .maybeSingle();

  if (updateError) {
    return { ok: false, code: "SAVE_FAILED", error: updateError.message };
  }

  if (!updatedRequest) {
    return {
      ok: false,
      code: "INVALID_STATE",
      error: "This onboarding request has already been reviewed by another user.",
    };
  }

  await emitWorkflowEvent({
    eventType: "staff_onboarding.rejected",
    requestId,
    branchId: request.requested_branch_id,
    applicantStaffId: request.staff_id,
    applicantName: request.full_name,
    actorStaffId: actor.staffId,
    rejectionReason: input.rejectionReason ?? null,
  });

  logBusinessEvent("staff.onboarding.rejected", {
    requestId,
    staffId: request.staff_id,
    branchId: request.requested_branch_id,
    actorId: actor.staffId,
    workspace: actor.systemRole,
    rejectionReason: input.rejectionReason ?? null,
  });

  return {
    ok: true,
    data: {
      requestId,
      staffId: request.staff_id,
    },
  };
}
