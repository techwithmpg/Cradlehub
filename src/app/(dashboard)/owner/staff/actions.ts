"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { canonicalizeSystemRole } from "@/constants/staff";
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

/** Roles allowed to update operational staff fields. CRM roles are branch-scoped (same as manager). */
const STAFF_OPERATIONAL_ROLES = [
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  "crm",
] as const;

async function requireOwnerOrManager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" } as const;

  if (isDevAuthBypassEnabled()) {
    return {
      supabase,
      admin: createAdminClient(),
      me: {
        id: "00000000-0000-0000-0000-000000000000",
        branch_id: "00000000-0000-0000-0000-000000000000",
        system_role: "owner",
      },
    };
  }

  const { data: me } = await supabase
    .from("staff").select("id, branch_id, system_role").eq("auth_user_id", user.id).eq("is_active", true).maybeSingle();
  if (!me) return { error: "No active staff record linked to this account" } as const;
  if (!(STAFF_OPERATIONAL_ROLES as readonly string[]).includes(canonicalizeSystemRole(me.system_role))) {
    return { error: "Access requires owner, manager, or CRM role" } as const;
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
    nickname:     d.nickname ?? null,
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
      nickname: payload.nickname,
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
  "crm",
  "driver",
  "utility",
  "service_head",
  "service_staff",
]);

// ── Update staff profile (owner or manager) ───────────────────────────────
export async function updateStaffAction(rawInput: unknown) {
  const parsed = updateStaffSchema.safeParse(rawInput);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.join(".") ?? "unknown";
    return { success: false, error: `Validation failed on field "${field}": ${issue?.message}` };
  }

  const ctx = await requireOwnerOrManager();
  if ("error" in ctx) return { success: false, error: ctx.error };

  const { staffId, serviceIds, ...updates } = parsed.data;
  // All non-owner roles are branch-scoped (managers and CRM operational roles alike)
  const actorRole = canonicalizeSystemRole(ctx.me.system_role);
  const isBranchScoped = actorRole !== "owner";

  // Branch-scoped roles: branch scope + protected account + role safety checks
  if (isBranchScoped) {
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

    if (updates.systemRole !== undefined && !MANAGER_SAFE_ROLES.has(canonicalizeSystemRole(updates.systemRole))) {
      return { success: false, error: "This role requires owner approval." };
    }
  }

  const nextSystemRole =
    updates.systemRole !== undefined ? canonicalizeSystemRole(updates.systemRole) : undefined;
  const updatePayload = {
    ...(updates.fullName   !== undefined && { full_name:    updates.fullName }),
    ...(updates.nickname   !== undefined && { nickname:     updates.nickname }),
    ...(updates.phone      !== undefined && { phone:        updates.phone }),
    ...(updates.tier       !== undefined && { tier:         updates.tier }),
    ...(nextSystemRole    !== undefined && { system_role:  nextSystemRole }),
    ...(updates.staffType  !== undefined && { staff_type:   updates.staffType }),
    ...(updates.isHead     !== undefined && { is_head:      updates.isHead }),
    ...(updates.branchId   !== undefined && { branch_id:    updates.branchId }),
    ...(updates.isActive   !== undefined && { is_active:    updates.isActive }),
  };

  let updateResult = await ctx.supabase
    .from("staff")
    .update(updatePayload)
    .eq("id", staffId)
    .select("id, full_name, nickname, phone, tier, system_role, staff_type, is_head, branch_id, is_active, updated_at");

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
      .eq("id", staffId)
      .select("id, full_name, nickname, phone, tier, system_role, branch_id, is_active, updated_at");
  }

  if (updateResult.error) return { success: false, error: updateResult.error.message };

  // Defensive: if no rows were returned, the UPDATE was silently blocked by RLS
  // or the row no longer exists. Without .select() Supabase returns 204/OK even
  // when RLS prevents the update, so we must verify via the returned row set.
  if (!updateResult.data || updateResult.data.length === 0) {
    return { success: false, error: "No rows were updated. The staff record may be inaccessible or does not exist." };
  }

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
  revalidatePath("/crm/staff");
  return { success: true, staff: updateResult.data[0]! };
}

// ── Toggle staff active/inactive (CRM-accessible) ────────────────────────

const toggleActiveSchema = z.object({
  staffId: z.string().uuid("Invalid staff ID"),
  isActive: z.boolean(),
});

export async function toggleStaffActiveAction(rawInput: unknown) {
  const parsed = toggleActiveSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" } as const;
  }
  const { staffId, isActive } = parsed.data;

  const ctx = await requireOwnerOrManager();
  if ("error" in ctx) return { success: false, error: ctx.error } as const;

  const actorRole = canonicalizeSystemRole(ctx.me.system_role);
  const isBranchScoped = actorRole !== "owner";
  if (isBranchScoped) {
    const { data: target } = await ctx.supabase
      .from("staff")
      .select("branch_id, system_role")
      .eq("id", staffId)
      .maybeSingle();
    if (!target || target.branch_id !== ctx.me.branch_id) {
      return { success: false, error: "You can only manage staff in your branch." } as const;
    }
    if (SENSITIVE_SYSTEM_ROLES.has(target.system_role as string)) {
      return { success: false, error: "This action requires owner approval." } as const;
    }
  }

  const updateResult = await ctx.supabase
    .from("staff")
    .update({ is_active: isActive })
    .eq("id", staffId)
    .select("id, is_active, updated_at");

  if (updateResult.error) return { success: false, error: updateResult.error.message } as const;

  if (!updateResult.data || updateResult.data.length === 0) {
    return { success: false, error: "No rows were updated. The staff record may be inaccessible or does not exist." } as const;
  }

  revalidatePath("/owner/staff");
  revalidatePath("/manager/staff");
  revalidatePath("/crm/staff");
  revalidatePath("/crm/schedule");
  return { success: true, staff: updateResult.data[0]! } as const;
}

// ── Invite-link onboarding: staff claims a pre-created record ─────────────
// Called from /onboard/[staffId] — visitor has no auth session yet.
// Creates a Supabase auth user and links it to the existing staff record.
export async function onboardStaffAction(input: {
  staffId: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
}): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  // Verify the staff record is unclaimed and not yet active
  const { data: staff, error: fetchErr } = await admin
    .from("staff")
    .select("id, auth_user_id, is_active")
    .eq("id", input.staffId)
    .maybeSingle();

  if (fetchErr || !staff) {
    return { success: false, error: "Invalid invite link. Please contact your administrator." };
  }
  if (staff.auth_user_id) {
    return { success: false, error: "This invite has already been claimed." };
  }
  if (staff.is_active) {
    return { success: false, error: "This invite link is no longer valid." };
  }

  // Basic validation
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  if (!fullName) return { success: false, error: "Full name is required." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: "A valid email address is required." };
  }
  if (input.password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters." };
  }

  // Create Supabase auth user
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authErr) {
    if (
      authErr.message.toLowerCase().includes("already registered") ||
      authErr.message.toLowerCase().includes("already been registered")
    ) {
      return {
        success: false,
        error: "An account with this email already exists. Please use a different email.",
      };
    }
    return { success: false, error: `Could not create account: ${authErr.message}` };
  }

  // Link auth user to the pre-created staff record
  const { error: updateErr } = await admin
    .from("staff")
    .update({
      auth_user_id: authUser.user.id,
      full_name: fullName,
      phone: phone || null,
    })
    .eq("id", input.staffId);

  if (updateErr) {
    // Rollback: remove the auth user we just created to keep the invite claimable
    await admin.auth.admin.deleteUser(authUser.user.id);
    return { success: false, error: `Failed to link your account: ${updateErr.message}` };
  }

  return { success: true };
}
