import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  canonicalizeSystemRole,
  getAssignableSystemRoles,
  SENSITIVE_SYSTEM_ROLES,
  type StaffType,
} from "@/constants/staff";
import { revalidatePath } from "next/cache";
import { invalidateCrmWorkspace, invalidateManagerWorkspace } from "@/lib/cache/cache-tags";
import type { Database } from "@/types/supabase";

export type StaffMutationActor = {
  staffId: string;
  authUserId: string;
  systemRole: string;
  branchId: string | null;
};

export type StaffMutationServiceResult<T = unknown> =
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

const STAFF_OPERATIONAL_ROLES = [
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  "crm",
] as const;

export type UpdateStaffProfileInput = {
  fullName?: string;
  nickname?: string | null;
  phone?: string;
  tier?: "senior" | "mid" | "junior" | "head" | "n/a";
  staffType?: StaffType;
  isHead?: boolean;
};

export async function updateStaffProfileService(params: {
  actor: StaffMutationActor;
  staffId: string;
  input: UpdateStaffProfileInput;
}): Promise<StaffMutationServiceResult<{ staff: Record<string, unknown> }>> {
  const { actor, staffId, input } = params;
  const actorRole = canonicalizeSystemRole(actor.systemRole);

  if (!STAFF_OPERATIONAL_ROLES.includes(actorRole as (typeof STAFF_OPERATIONAL_ROLES)[number])) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "Access requires owner, manager, or CRM role.",
    };
  }

  const admin = createAdminClient();

  const { data: target, error: fetchError } = await admin
    .from("staff")
    .select("id, branch_id, system_role, is_active")
    .eq("id", staffId)
    .maybeSingle();

  if (fetchError || !target) {
    return { ok: false, code: "NOT_FOUND", error: "Staff record not found." };
  }

  const isBranchScoped = actorRole !== "owner";
  if (isBranchScoped) {
    if (target.branch_id !== actor.branchId) {
      return {
        ok: false,
        code: "BRANCH_MISMATCH",
        error: "You can only manage staff in your branch.",
      };
    }

    if (
      SENSITIVE_SYSTEM_ROLES.includes(target.system_role as (typeof SENSITIVE_SYSTEM_ROLES)[number])
    ) {
      return {
        ok: false,
        code: "FORBIDDEN",
        error: "This action requires owner approval.",
      };
    }
  }

  const updatePayload: Database["public"]["Tables"]["staff"]["Update"] = {
    ...(input.fullName !== undefined && { full_name: input.fullName.trim() }),
    ...(input.nickname !== undefined && { nickname: input.nickname?.trim() || null }),
    ...(input.phone !== undefined && { phone: input.phone.trim() }),
    ...(input.tier !== undefined && { tier: input.tier }),
    ...(input.staffType !== undefined && { staff_type: input.staffType }),
    ...(input.isHead !== undefined && { is_head: input.isHead }),
  };

  if (Object.keys(updatePayload).length === 0) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      error: "No profile changes provided.",
    };
  }

  const { data: updatedStaff, error: updateError } = await admin
    .from("staff")
    .update(updatePayload)
    .eq("id", staffId)
    .select(
      "id, full_name, nickname, phone, tier, system_role, staff_type, is_head, branch_id, is_active, updated_at"
    )
    .maybeSingle();

  if (updateError) {
    return { ok: false, code: "SAVE_FAILED", error: updateError.message };
  }

  if (!updatedStaff) {
    return {
      ok: false,
      code: "SAVE_FAILED",
      error: "No rows were updated. The staff record may be inaccessible or does not exist.",
    };
  }

  revalidatePath("/owner/staff");
  revalidatePath(`/owner/staff/${staffId}`);
  revalidatePath("/manager/staff");
  revalidatePath(`/manager/staff/${staffId}`);
  revalidatePath("/crm/staff");
  if (updatedStaff.branch_id) {
    invalidateCrmWorkspace(updatedStaff.branch_id);
    invalidateManagerWorkspace(updatedStaff.branch_id);
  }

  return { ok: true, data: { staff: updatedStaff } };
}

export async function assignStaffRoleService(params: {
  actor: StaffMutationActor;
  staffId: string;
  input: { systemRole: string };
}): Promise<StaffMutationServiceResult<{ staff: Record<string, unknown> }>> {
  const { actor, staffId, input } = params;
  const actorRole = canonicalizeSystemRole(actor.systemRole);

  if (!STAFF_OPERATIONAL_ROLES.includes(actorRole as (typeof STAFF_OPERATIONAL_ROLES)[number])) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "Access requires owner, manager, or CRM role.",
    };
  }

  const nextSystemRole = canonicalizeSystemRole(input.systemRole);
  const assignableRoles = getAssignableSystemRoles(actorRole);

  if (!assignableRoles.some((r) => r === nextSystemRole)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "This role cannot be assigned with your permission level.",
    };
  }

  const admin = createAdminClient();

  const { data: target, error: fetchError } = await admin
    .from("staff")
    .select("id, branch_id, system_role, is_active")
    .eq("id", staffId)
    .maybeSingle();

  if (fetchError || !target) {
    return { ok: false, code: "NOT_FOUND", error: "Staff record not found." };
  }

  // Self-escalation / self-role change protection
  if (target.id === actor.staffId && nextSystemRole !== canonicalizeSystemRole(actor.systemRole)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "You cannot change your own system role.",
    };
  }

  const isBranchScoped = actorRole !== "owner";
  if (isBranchScoped) {
    if (target.branch_id !== actor.branchId) {
      return {
        ok: false,
        code: "BRANCH_MISMATCH",
        error: "You can only manage staff in your branch.",
      };
    }

    if (
      SENSITIVE_SYSTEM_ROLES.includes(target.system_role as (typeof SENSITIVE_SYSTEM_ROLES)[number])
    ) {
      return {
        ok: false,
        code: "FORBIDDEN",
        error: "This action requires owner approval.",
      };
    }
  }

  const nextStaffType = nextSystemRole === "digital_marketer" ? "managerial" : undefined;

  const updatePayload: Database["public"]["Tables"]["staff"]["Update"] = {
    system_role: nextSystemRole,
    ...(nextStaffType ? { staff_type: nextStaffType } : {}),
  };

  const { data: updatedStaff, error: updateError } = await admin
    .from("staff")
    .update(updatePayload)
    .eq("id", staffId)
    .select(
      "id, full_name, nickname, phone, tier, system_role, staff_type, is_head, branch_id, is_active, updated_at"
    )
    .maybeSingle();

  if (updateError) {
    return { ok: false, code: "SAVE_FAILED", error: updateError.message };
  }

  if (!updatedStaff) {
    return {
      ok: false,
      code: "SAVE_FAILED",
      error: "No rows were updated. The staff record may be inaccessible or does not exist.",
    };
  }

  revalidatePath("/owner/staff");
  revalidatePath(`/owner/staff/${staffId}`);
  revalidatePath("/manager/staff");
  revalidatePath(`/manager/staff/${staffId}`);
  revalidatePath("/crm/staff");
  if (updatedStaff.branch_id) {
    invalidateCrmWorkspace(updatedStaff.branch_id);
    invalidateManagerWorkspace(updatedStaff.branch_id);
  }

  return { ok: true, data: { staff: updatedStaff } };
}

export async function deactivateStaffService(params: {
  actor: StaffMutationActor;
  staffId: string;
}): Promise<StaffMutationServiceResult<{ staff: Record<string, unknown> }>> {
  const { actor, staffId } = params;
  const actorRole = canonicalizeSystemRole(actor.systemRole);

  if (!STAFF_OPERATIONAL_ROLES.includes(actorRole as (typeof STAFF_OPERATIONAL_ROLES)[number])) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "Access requires owner, manager, or CRM role.",
    };
  }

  const admin = createAdminClient();

  const { data: target, error: fetchError } = await admin
    .from("staff")
    .select("id, branch_id, system_role, is_active")
    .eq("id", staffId)
    .maybeSingle();

  if (fetchError || !target) {
    return { ok: false, code: "NOT_FOUND", error: "Staff record not found." };
  }

  // Self-deactivation protection
  if (target.id === actor.staffId) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "You cannot deactivate your own account.",
    };
  }

  const isBranchScoped = actorRole !== "owner";
  if (isBranchScoped) {
    if (target.branch_id !== actor.branchId) {
      return {
        ok: false,
        code: "BRANCH_MISMATCH",
        error: "You can only manage staff in your branch.",
      };
    }

    if (
      SENSITIVE_SYSTEM_ROLES.includes(target.system_role as (typeof SENSITIVE_SYSTEM_ROLES)[number])
    ) {
      return {
        ok: false,
        code: "FORBIDDEN",
        error: "This action requires owner approval.",
      };
    }
  }

  const { data: updatedStaff, error: updateError } = await admin
    .from("staff")
    .update({ is_active: false })
    .eq("id", staffId)
    .select("id, is_active, updated_at, branch_id")
    .maybeSingle();

  if (updateError) {
    return { ok: false, code: "SAVE_FAILED", error: updateError.message };
  }

  if (!updatedStaff) {
    return {
      ok: false,
      code: "SAVE_FAILED",
      error: "No rows were updated. The staff record may be inaccessible or does not exist.",
    };
  }

  revalidatePath("/owner/staff");
  revalidatePath("/manager/staff");
  revalidatePath("/crm/staff");
  revalidatePath("/crm/schedule");
  if (updatedStaff.branch_id) {
    invalidateCrmWorkspace(updatedStaff.branch_id);
    invalidateManagerWorkspace(updatedStaff.branch_id);
  }

  return { ok: true, data: { staff: updatedStaff } };
}
