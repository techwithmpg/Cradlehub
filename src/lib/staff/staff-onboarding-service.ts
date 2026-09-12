import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllBranches } from "@/lib/queries/branches";
import { invalidateCrmWorkspace, invalidateManagerWorkspace } from "@/lib/cache/cache-tags";
import { emitWorkflowEvent } from "@/lib/notifications/workflow-signals";
import { mapPreferredRoleToStaffType } from "@/lib/staff/onboarding-roles";
import { canApproveStaffOnboarding } from "@/lib/staff/approval-permissions";
import { logError, logBusinessEvent } from "@/lib/logger";
import { canonicalizeSystemRole } from "@/constants/staff";
import { canReviewStaffOnboarding, isOwner, isManager } from "@/lib/permissions";
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

  const branchChanged = input.branchId !== request.requested_branch_id;
  const approverCanChangeBranch = isOwner(actorRole) || isManager(actorRole);
  if (branchChanged && !approverCanChangeBranch) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error:
        "You can only approve staff into the requested branch. Ask an owner or manager to change the branch.",
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

  // Load prior staff record for compensating rollback
  const { data: priorStaff, error: priorStaffError } = await admin
    .from("staff")
    .select("id, is_active, branch_id, system_role, staff_type, tier, nickname")
    .eq("id", staffId)
    .maybeSingle();

  if (priorStaffError || !priorStaff) {
    return { ok: false, code: "NOT_FOUND", error: "Staff record not found." };
  }

  const requestMetadata = request.metadata as { nickname?: string | null } | null;
  const nickname =
    typeof requestMetadata?.nickname === "string" && requestMetadata.nickname.trim().length > 0
      ? requestMetadata.nickname.trim()
      : null;

  // Step 1: Update staff record
  const { error: staffErr } = await admin
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
    .eq("id", staffId);

  if (staffErr) {
    return { ok: false, code: "SAVE_FAILED", error: staffErr.message };
  }

  // Step 2: Capability sync with compensating rollback if failed
  if (confirmedServiceIds) {
    const { error: capabilityErr } = await admin.rpc("replace_staff_service_capabilities", {
      p_target_staff_id: staffId,
      p_service_ids: confirmedServiceIds,
    });
    if (capabilityErr) {
      logError("staff.onboarding.capability_sync_failed_compensating", {
        staffId,
        error: capabilityErr,
      });
      // Compensating rollback: restore prior staff state
      await admin
        .from("staff")
        .update({
          is_active: priorStaff.is_active,
          branch_id: priorStaff.branch_id,
          system_role: priorStaff.system_role,
          staff_type: priorStaff.staff_type,
          tier: priorStaff.tier,
          nickname: priorStaff.nickname,
        })
        .eq("id", staffId);

      return {
        ok: false,
        code: "SAVE_FAILED",
        error: `Activated staff but failed to set services: ${capabilityErr.message}`,
      };
    }
  }

  // Step 3: Update onboarding request status with compensating rollback if failed
  const now = new Date().toISOString();
  const existingMetadata =
    request.metadata && typeof request.metadata === "object" && !Array.isArray(request.metadata)
      ? (request.metadata as Record<string, unknown>)
      : {};
  const updatedMetadata: Record<string, unknown> = {
    ...existingMetadata,
  };
  if (branchChanged) {
    updatedMetadata.approved_branch_differs_from_requested = true;
    updatedMetadata.original_requested_branch_id = request.requested_branch_id;
    updatedMetadata.approved_branch_id = input.branchId;
    updatedMetadata.approved_branch_changed_at = now;
    updatedMetadata.approved_branch_changed_by_staff_id = actor.staffId;
  }

  const { error: requestUpdateErr } = await admin
    .from("staff_onboarding_requests")
    .update({
      status: "approved",
      reviewed_by_staff_id: actor.staffId,
      reviewed_at: now,
      requested_branch_id: input.branchId,
      metadata: updatedMetadata as unknown as Json,
    })
    .eq("id", requestId);

  if (requestUpdateErr) {
    logError("staff.onboarding.request_update_failed_compensating", {
      requestId,
      staffId,
      error: requestUpdateErr,
    });
    // Compensating rollback: revert staff row
    await admin
      .from("staff")
      .update({
        is_active: priorStaff.is_active,
        branch_id: priorStaff.branch_id,
        system_role: priorStaff.system_role,
        staff_type: priorStaff.staff_type,
        tier: priorStaff.tier,
        nickname: priorStaff.nickname,
      })
      .eq("id", staffId);

    return {
      ok: false,
      code: "SAVE_FAILED",
      error: `Failed to update onboarding request: ${requestUpdateErr.message}`,
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
    actorId: actor.staffId,
    workspace: actor.systemRole,
    systemRole: input.systemRole,
    tier: input.tier,
    branchChanged,
  });

  // Step 5: Surface invalidation
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

  const { error: updateError } = await admin
    .from("staff_onboarding_requests")
    .update({
      status: "rejected",
      reviewed_by_staff_id: actor.staffId,
      reviewed_at: now,
      rejection_reason: input.rejectionReason ?? null,
      metadata: updatedMetadata as unknown as Json,
    })
    .eq("id", requestId);

  if (updateError) {
    return { ok: false, code: "SAVE_FAILED", error: updateError.message };
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
