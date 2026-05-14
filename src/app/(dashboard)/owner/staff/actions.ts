"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { createStaffSchema, updateStaffSchema } from "@/lib/validations/staff";
import type { Database } from "@/types/supabase";
import { revalidatePath } from "next/cache";

// ── Auth helper: owner or manager ──────────────────────────────────────────
async function requireOwner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" } as const;

  if (isDevAuthBypassEnabled()) {
    return { supabase, admin: createAdminClient() };
  }

  const { data: me } = await supabase
    .from("staff").select("system_role").eq("auth_user_id", user.id).eq("is_active", true).maybeSingle();
  if (!me) return { error: "No active staff record linked to this account." } as const;
  if (me.system_role !== "owner") return { error: "Owner access required" } as const;
  return { supabase, admin: createAdminClient() };
}

async function requireOwnerOrManager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" } as const;

  if (isDevAuthBypassEnabled()) {
    return { supabase, admin: createAdminClient(), me: { id: "dev", branch_id: "dev", system_role: "owner" } };
  }

  const { data: me } = await supabase
    .from("staff").select("id, branch_id, system_role").eq("auth_user_id", user.id).eq("is_active", true).maybeSingle();
  if (!me) return { error: "No active staff record linked to this account" } as const;
  if (!["owner", "manager", "assistant_manager", "store_manager"].includes(me.system_role)) {
    return { error: "Owner or manager access required" } as const;
  }
  return { supabase, admin: createAdminClient(), me };
}

type OwnerContext = Extract<Awaited<ReturnType<typeof requireOwner>>, { supabase: unknown }>;
type ManagerContext = Extract<Awaited<ReturnType<typeof requireOwnerOrManager>>, { supabase: unknown }>;

function isMissingStaffOrgColumnsError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('column staff.staff_type does not exist') ||
    m.includes('column "staff_type" does not exist') ||
    m.includes('column staff.is_head does not exist') ||
    m.includes('column "is_head" does not exist') ||
    m.includes('in the schema cache') // Supabase schema-cache variant
  );
}

async function syncStaffServices(
  supabase:
    | OwnerContext["supabase"]
    | OwnerContext["admin"]
    | ManagerContext["supabase"]
    | ManagerContext["admin"],
  staffId: string,
  serviceIds: string[] | undefined
) {
  if (!serviceIds) return;
  const { error: delErr } = await supabase
    .from("staff_services")
    .delete()
    .eq("staff_id", staffId);
  if (delErr) throw new Error(delErr.message);
  const unique = Array.from(new Set(serviceIds));
  if (unique.length > 0) {
    const rows = unique.map((serviceId) => ({ staff_id: staffId, service_id: serviceId }));
    const { error: insErr } = await supabase.from("staff_services").insert(rows);
    if (insErr) throw new Error(insErr.message);
  }
}

// ── Direct staff creation (owner only, existing flow) ─────────────────────
export async function createStaffAction(rawInput: unknown) {
  const parsed = createStaffSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const ctx = await requireOwner();
  if ("error" in ctx) return { success: false, error: ctx.error };

  const { data: d } = parsed;

  const { data: authUser, error: authErr } = await ctx.admin.auth.admin.inviteUserByEmail(
    d.email!,
    { data: { full_name: d.fullName } }
  );
  if (authErr) return { success: false, error: `Auth invite failed: ${authErr.message}` };

  const payload = {
    branch_id:    d.branchId,
    auth_user_id: authUser.user.id,
    full_name:    d.fullName,
    phone:        d.phone       ?? null,
    tier:         d.tier,
    system_role:  d.systemRole,
    staff_type:   d.staffType,
    is_head:      d.isHead,
  };

  let result = await ctx.supabase
    .from("staff")
    .insert(payload)
    .select("id")
    .single();

  // Backward compatibility: if staff_type/is_head columns don't exist yet
  if (result.error && isMissingStaffOrgColumnsError(result.error.message)) {
    const legacyPayload = {
      branch_id: payload.branch_id,
      full_name: payload.full_name,
      phone: payload.phone,
      tier: payload.tier,
      system_role: payload.system_role,
    };
    result = await ctx.supabase
      .from("staff")
      .insert(legacyPayload)
      .select("id")
      .single();
  }

  if (result.error) return { success: false, error: result.error.message };
  const staffRow = result.data;

  if (staffRow && d.serviceIds && d.serviceIds.length > 0) {
    try {
      await syncStaffServices(ctx.admin, staffRow.id, d.serviceIds);
    } catch (e) {
      return { success: false, error: `Staff created but failed to set services: ${(e as Error).message}` };
    }
  }

  revalidatePath("/owner/staff");
  return { success: true };
}

const SENSITIVE_SYSTEM_ROLES = new Set([
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  "super_admin",
  "platform_admin",
]);

const MANAGER_SAFE_ROLES = new Set([
  "staff",
  "csr_staff",
  "csr_head",
  "crm",
  "csr",
]);

// ── Update staff profile (owner or manager) ───────────────────────────────
export async function updateStaffAction(rawInput: unknown) {
  if (process.env.NODE_ENV === "development") {
    const raw = rawInput as Record<string, unknown>;
    console.debug("[staff.update] request", {
      hasStaffId: Boolean(raw?.staffId),
      hasSystemRole: Boolean(raw?.systemRole),
      hasBranchId: Boolean(raw?.branchId),
    });
  }
  const parsed = updateStaffSchema.safeParse(rawInput);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.join(".") ?? "unknown";
    if (process.env.NODE_ENV === "development") {
      console.debug("[staff.update] validation failed", { field, message: issue?.message });
    }
    return { success: false, error: `Validation failed on field "${field}": ${issue?.message}` };
  }

  const ctx = await requireOwnerOrManager();
  if ("error" in ctx) return { success: false, error: ctx.error };

  const { staffId, serviceIds, ...updates } = parsed.data;
  const isManager = ["manager", "assistant_manager", "store_manager"].includes(ctx.me.system_role);

  // Non-owner managers: branch scope + protected account + role safety checks
  if (isManager) {
    const { data: target } = await ctx.supabase
      .from("staff")
      .select("branch_id, system_role")
      .eq("id", staffId)
      .single();

    if (!target || target.branch_id !== ctx.me.branch_id) {
      return { success: false, error: "You can only manage staff in your branch" };
    }

    if (SENSITIVE_SYSTEM_ROLES.has(target.system_role)) {
      return { success: false, error: "This action requires owner approval." };
    }

    if (updates.branchId !== undefined && updates.branchId !== ctx.me.branch_id) {
      return { success: false, error: "You can only assign staff to your own branch." };
    }

    if (updates.systemRole !== undefined && !MANAGER_SAFE_ROLES.has(updates.systemRole)) {
      return { success: false, error: "This role requires owner approval." };
    }
  }

  const updatePayload = {
    ...(updates.fullName   !== undefined && { full_name:    updates.fullName }),
    ...(updates.phone      !== undefined && { phone:        updates.phone }),
    ...(updates.tier       !== undefined && { tier:         updates.tier }),
    ...(updates.systemRole !== undefined && { system_role:  updates.systemRole }),
    ...(updates.staffType  !== undefined && { staff_type:   updates.staffType }),
    ...(updates.isHead     !== undefined && { is_head:      updates.isHead }),
    ...(updates.branchId   !== undefined && { branch_id:    updates.branchId }),
    ...(updates.isActive   !== undefined && { is_active:    updates.isActive }),
  };

  let updateResult = await ctx.supabase
    .from("staff")
    .update(updatePayload)
    .eq("id", staffId);

  // Backward compatibility: if staff_type/is_head columns don't exist yet
  if (updateResult.error && isMissingStaffOrgColumnsError(updateResult.error.message)) {
    const legacyPayload: Database["public"]["Tables"]["staff"]["Update"] = {
      ...updatePayload,
    };
    delete legacyPayload.staff_type;
    delete legacyPayload.is_head;
    updateResult = await ctx.supabase
      .from("staff")
      .update(legacyPayload)
      .eq("id", staffId);
  }

  if (updateResult.error) return { success: false, error: updateResult.error.message };

  if (serviceIds !== undefined) {
    try {
      await syncStaffServices(ctx.admin, staffId, serviceIds);
    } catch (e) {
      return { success: false, error: `Profile updated but failed to sync services: ${(e as Error).message}` };
    }
  }

  revalidatePath("/owner/staff");
  revalidatePath(`/owner/staff/${staffId}`);
  revalidatePath("/manager/staff");
  revalidatePath(`/manager/staff/${staffId}`);
  return { success: true };
}
