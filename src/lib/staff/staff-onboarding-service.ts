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
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/supabase";

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
  error?: string;
};

function isPlainObject(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === "object" && obj !== null && !Array.isArray(obj);
}

function areMetadataEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    const aVal = a[key];
    const bVal = b[key];
    if (isPlainObject(aVal) || isPlainObject(bVal)) {
      if (!areMetadataEqual(aVal, bVal)) return false;
    } else if (Array.isArray(aVal) || Array.isArray(bVal)) {
      if (!Array.isArray(aVal) || !Array.isArray(bVal)) return false;
      if (aVal.length !== bVal.length) return false;
      if (JSON.stringify(aVal) !== JSON.stringify(bVal)) return false;
    } else if (aVal !== bVal) {
      return false;
    }
  }
  return true;
}

async function compensateApprovalMutation(params: {
  admin: ReturnType<typeof createAdminClient>;
  requestId: string;
  priorRequest: {
    requested_branch_id: string | null;
    metadata: Json;
  };
  appliedClaimState: {
    status: "approved";
    reviewed_by_staff_id: string;
    reviewed_at: string;
    requested_branch_id: string;
    operationMarker: string;
    metadata: Record<string, unknown>;
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
    changedNickname: boolean;
    appliedNickname: string | null;
  };
  revertStaff: boolean;
}): Promise<CompensationResult> {
  const {
    admin,
    requestId,
    priorRequest,
    appliedClaimState,
    revertRequest,
    staffId,
    priorStaff,
    appliedStaffState,
    revertStaff,
  } = params;

  let requestRestored = !revertRequest;
  let staffRestored = !revertStaff;
  let requestSkippedDueToMismatch = false;
  let staffSkippedDueToMismatch = false;
  const errorMsgs: string[] = [];

  // 1. Conditional rollback of staff record (Guards all fields + conditional nickname)
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
      const baseMatches =
        currentStaff.is_active === appliedStaffState.is_active &&
        currentStaff.branch_id === appliedStaffState.branch_id &&
        currentStaff.system_role === appliedStaffState.system_role &&
        currentStaff.staff_type === appliedStaffState.staff_type &&
        currentStaff.tier === appliedStaffState.tier;

      const nicknameMatches =
        !appliedStaffState.changedNickname ||
        currentStaff.nickname === appliedStaffState.appliedNickname;

      if (!baseMatches || !nicknameMatches) {
        staffSkippedDueToMismatch = true;
        logError("staff.onboarding.compensation_staff_skipped_state_mismatch", {
          staffId,
          currentStaff,
          expectedApplied: appliedStaffState,
        });
      } else {
        const rollbackPayload: Database["public"]["Tables"]["staff"]["Update"] = {
          is_active: priorStaff.is_active,
          branch_id: priorStaff.branch_id,
          system_role: priorStaff.system_role,
          staff_type: priorStaff.staff_type,
          tier: priorStaff.tier,
          ...(appliedStaffState.changedNickname ? { nickname: priorStaff.nickname } : {}),
        };

        let query = admin
          .from("staff")
          .update(rollbackPayload)
          .eq("id", staffId)
          .eq("is_active", appliedStaffState.is_active)
          .eq("branch_id", appliedStaffState.branch_id)
          .eq("system_role", appliedStaffState.system_role)
          .eq("staff_type", appliedStaffState.staff_type)
          .eq("tier", appliedStaffState.tier);

        if (appliedStaffState.changedNickname) {
          if (appliedStaffState.appliedNickname === null) {
            query = query.is("nickname", null);
          } else {
            query = query.eq("nickname", appliedStaffState.appliedNickname);
          }
        }

        const { data: restoredStaff, error: staffErr } = await query.select("id").maybeSingle();

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

  // 2. Conditional rollback of onboarding request back to submitted
  if (revertRequest) {
    const { data: currentReq, error: reqFetchErr } = await admin
      .from("staff_onboarding_requests")
      .select("id, status, reviewed_by_staff_id, reviewed_at, requested_branch_id, metadata")
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
    } else {
      const matchesClaim =
        currentReq.status === appliedClaimState.status &&
        currentReq.reviewed_by_staff_id === appliedClaimState.reviewed_by_staff_id &&
        currentReq.reviewed_at === appliedClaimState.reviewed_at &&
        currentReq.requested_branch_id === appliedClaimState.requested_branch_id &&
        areMetadataEqual(currentReq.metadata, appliedClaimState.metadata);

      if (!matchesClaim) {
        requestSkippedDueToMismatch = true;
        logError("staff.onboarding.compensation_request_skipped_state_mismatch", {
          requestId,
          currentReq,
          expectedClaim: appliedClaimState,
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
          .eq("reviewed_by_staff_id", appliedClaimState.reviewed_by_staff_id)
          .eq("reviewed_at", appliedClaimState.reviewed_at)
          .eq("requested_branch_id", appliedClaimState.requested_branch_id)
          .eq("metadata", JSON.stringify(appliedClaimState.metadata))
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
  }

  const overallSuccess =
    (revertStaff ? staffRestored : true) && (revertRequest ? requestRestored : true);

  if (!overallSuccess) {
    logError("staff.onboarding.compensation_incomplete_critical", {
      requestId,
      staffId,
      staffRestored,
      requestRestored,
      staffSkippedDueToMismatch,
      requestSkippedDueToMismatch,
      errors: errorMsgs,
    });
  }

  return {
    success: overallSuccess,
    requestRestored,
    staffRestored,
    capabilitiesRestored: true,
    requestSkippedDueToMismatch,
    staffSkippedDueToMismatch,
    error: errorMsgs.join("; ") || undefined,
  };
}

export async function approveStaffOnboardingRequest(params: {
  actor: StaffReviewActor;
  authenticatedClient: SupabaseClient<Database>;
  requestId: string;
  input: ApproveStaffOnboardingInput;
}): Promise<
  StaffOnboardingServiceResult<{ staffId: string; branchId: string; systemRole: string }>
> {
  const { actor, authenticatedClient, requestId, input } = params;
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

  // Evaluate nickname ownership:
  // Only if rawNickname is non-null and differs from priorStaff.nickname does this approval change nickname!
  const requestMetadata = request.metadata as { nickname?: string | null } | null;
  const rawNickname =
    typeof requestMetadata?.nickname === "string" && requestMetadata.nickname.trim().length > 0
      ? requestMetadata.nickname.trim()
      : null;
  const approvalChangedNickname = rawNickname !== null && rawNickname !== priorStaff.nickname;
  const appliedNickname = approvalChangedNickname ? rawNickname : undefined;

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

  const appliedClaimState = {
    status: "approved" as const,
    reviewed_by_staff_id: actor.staffId,
    reviewed_at: now,
    requested_branch_id: input.branchId,
    operationMarker: now,
    metadata: updatedMetadata,
  };

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
    changedNickname: approvalChangedNickname,
    appliedNickname: appliedNickname ?? null,
  };

  const staffUpdatePayload: Database["public"]["Tables"]["staff"]["Update"] = {
    is_active: true,
    branch_id: input.branchId,
    system_role: input.systemRole,
    staff_type: appliedStaffType,
    tier: input.tier,
    ...(approvalChangedNickname ? { nickname: appliedNickname } : {}),
  };

  const { data: updatedStaff, error: staffErr } = await admin
    .from("staff")
    .update(staffUpdatePayload)
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
      priorRequest: {
        requested_branch_id: request.requested_branch_id,
        metadata: existingMetadata as unknown as Json,
      },
      appliedClaimState,
      revertRequest: true,
      revertStaff: false,
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
  // BLOCKER 1: Invoked through authenticatedClient (actor Supabase client), NOT admin,
  // because replace_staff_service_capabilities checks auth.uid()!
  if (confirmedServiceIds !== undefined) {
    const { error: capabilityErr } = await authenticatedClient.rpc(
      "replace_staff_service_capabilities",
      {
        p_target_staff_id: staffId,
        p_service_ids: confirmedServiceIds,
      }
    );
    if (capabilityErr) {
      logError("staff.onboarding.capability_sync_failed_compensating", {
        staffId,
        requestId,
        error: capabilityErr,
      });

      // BLOCKER 4: replace_staff_service_capabilities is a PostgreSQL function that runs
      // in its own single statement transaction. When it returns failure, its delete/insert
      // operations abort completely inside PostgreSQL and leave zero modifications in staff_services.
      // Therefore, application-level capability rollback is not required. We conditionally
      // compensate the preceding staff update and request claim.
      const compensation = await compensateApprovalMutation({
        admin,
        requestId,
        priorRequest: {
          requested_branch_id: request.requested_branch_id,
          metadata: existingMetadata as unknown as Json,
        },
        appliedClaimState,
        revertRequest: true,
        staffId,
        priorStaff,
        appliedStaffState,
        revertStaff: true,
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
