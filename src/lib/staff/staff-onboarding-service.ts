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
  staffRestored: boolean;
  capabilitiesRestored: boolean;
  error?: string;
};

async function compensateApprovalMutation(params: {
  admin: ReturnType<typeof createAdminClient>;
  staffId: string;
  priorStaff: {
    is_active: boolean;
    branch_id: string;
    system_role: string;
    staff_type: string;
    tier: string;
    nickname: string | null;
  };
  priorCapabilityIds: string[] | null;
  restoreCapabilities: boolean;
}): Promise<CompensationResult> {
  const { admin, staffId, priorStaff, priorCapabilityIds, restoreCapabilities } = params;
  let staffRestored = false;
  let capabilitiesRestored = !restoreCapabilities;
  let errorMsg = "";

  // 1. Restore staff row with returned-row verification
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
    .select("id")
    .maybeSingle();

  if (staffErr) {
    errorMsg = `Staff rollback failed: ${staffErr.message}`;
    logError("staff.onboarding.compensation_staff_failed", { staffId, error: staffErr });
  } else if (!restoredStaff) {
    errorMsg = "Staff rollback failed: target staff row not found.";
    logError("staff.onboarding.compensation_staff_failed", {
      staffId,
      error: "Zero rows updated during staff rollback",
    });
  } else {
    staffRestored = true;
  }

  // 2. Restore capabilities if they were altered
  if (restoreCapabilities && priorCapabilityIds !== null) {
    const { error: capErr } = await admin.rpc("replace_staff_service_capabilities", {
      p_target_staff_id: staffId,
      p_service_ids: priorCapabilityIds,
    });
    if (capErr) {
      const capMsg = `Capabilities rollback failed: ${capErr.message}`;
      errorMsg = errorMsg ? `${errorMsg}; ${capMsg}` : capMsg;
      logError("staff.onboarding.compensation_capabilities_failed", { staffId, error: capErr });
    } else {
      capabilitiesRestored = true;
    }
  }

  const overallSuccess = staffRestored && capabilitiesRestored;
  if (!overallSuccess) {
    logError("staff.onboarding.compensation_incomplete_critical", {
      staffId,
      staffRestored,
      capabilitiesRestored,
      errorMsg,
    });
  }

  return {
    success: overallSuccess,
    staffRestored,
    capabilitiesRestored,
    error: errorMsg || undefined,
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
    priorCapabilityIds = (capRows ?? []).map((r) => r.service_id);
  }

  const requestMetadata = request.metadata as { nickname?: string | null } | null;
  const nickname =
    typeof requestMetadata?.nickname === "string" && requestMetadata.nickname.trim().length > 0
      ? requestMetadata.nickname.trim()
      : null;

  // Step 1: Update staff record with returned-row verification
  const { data: updatedStaff, error: staffErr } = await admin
    .from("staff")
    .update({
      is_active: true,
      branch_id: input.branchId,
      system_role: input.systemRole,
      staff_type:
        input.systemRole === "digital_marketer"
          ? "managerial"
          : mapPreferredRoleToStaffType(request.preferred_role ?? ""),
      tier: input.tier,
      ...(nickname ? { nickname } : {}),
    })
    .eq("id", staffId)
    .select("id")
    .maybeSingle();

  if (staffErr) {
    return { ok: false, code: "SAVE_FAILED", error: staffErr.message };
  }
  if (!updatedStaff) {
    return { ok: false, code: "SAVE_FAILED", error: "Target staff record could not be updated." };
  }

  // Step 2: Capability sync with compensating rollback if failed
  let capabilitiesAltered = false;
  if (confirmedServiceIds !== undefined) {
    const { error: capabilityErr } = await admin.rpc("replace_staff_service_capabilities", {
      p_target_staff_id: staffId,
      p_service_ids: confirmedServiceIds,
    });
    if (capabilityErr) {
      logError("staff.onboarding.capability_sync_failed_compensating", {
        staffId,
        error: capabilityErr,
      });
      const compensation = await compensateApprovalMutation({
        admin,
        staffId,
        priorStaff,
        priorCapabilityIds,
        restoreCapabilities: false,
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
    capabilitiesAltered = true;
  }

  // Step 3: Update onboarding request status with concurrency check and compensating rollback
  const now = new Date().toISOString();
  const existingMetadata =
    request.metadata && typeof request.metadata === "object" && !Array.isArray(request.metadata)
      ? (request.metadata as Record<string, unknown>)
      : {};
  const updatedMetadata: Record<string, unknown> = {
    ...existingMetadata,
    approved_at: now,
    approved_by_staff_id: actor.staffId,
    assigned_branch_id: input.branchId,
    assigned_system_role: input.systemRole,
    assigned_tier: input.tier,
    assigned_service_ids: confirmedServiceIds ?? [],
  };

  const { data: updatedRequest, error: requestUpdateErr } = await admin
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

  if (requestUpdateErr) {
    logError("staff.onboarding.request_update_failed_compensating", {
      requestId,
      staffId,
      error: requestUpdateErr,
    });
    const compensation = await compensateApprovalMutation({
      admin,
      staffId,
      priorStaff,
      priorCapabilityIds,
      restoreCapabilities: capabilitiesAltered,
    });

    return {
      ok: false,
      code: "SAVE_FAILED",
      error: `Failed to update onboarding request: ${requestUpdateErr.message}${
        !compensation.success
          ? " (Rollback also encountered errors. Consistency event logged.)"
          : ""
      }`,
    };
  }

  if (!updatedRequest) {
    logError("staff.onboarding.request_update_race_conflict_compensating", {
      requestId,
      staffId,
      actorStaffId: actor.staffId,
    });
    const compensation = await compensateApprovalMutation({
      admin,
      staffId,
      priorStaff,
      priorCapabilityIds,
      restoreCapabilities: capabilitiesAltered,
    });

    if (!compensation.success) {
      return {
        ok: false,
        code: "SAVE_FAILED",
        error:
          "The onboarding request changed concurrently and rollback could not be fully completed.",
      };
    }

    return {
      ok: false,
      code: "INVALID_STATE",
      error: "This onboarding request has already been reviewed by another user.",
    };
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
