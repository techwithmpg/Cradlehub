"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStaffSchema, updateStaffSchema } from "@/lib/validations/staff";
import { revalidatePath } from "next/cache";

// ── Auth helper: owner or manager ──────────────────────────────────────────
async function requireOwner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase
    .from("staff").select("system_role").eq("auth_user_id", user.id).single();
  if (me?.system_role !== "owner") return null;
  return { supabase, admin: createAdminClient() };
}

async function requireOwnerOrManager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase
    .from("staff").select("id, branch_id, system_role").eq("auth_user_id", user.id).single();
  if (!me || !["owner", "manager"].includes(me.system_role)) return null;
  return { supabase, admin: createAdminClient(), me };
}

type OwnerContext = NonNullable<Awaited<ReturnType<typeof requireOwner>>>;
type ManagerContext = NonNullable<Awaited<ReturnType<typeof requireOwnerOrManager>>>;

async function syncStaffServices(
  supabase: OwnerContext["supabase"] | ManagerContext["supabase"],
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
  if (!ctx) return { success: false, error: "Unauthorized" };

  const { data: d } = parsed;

  const { data: authUser, error: authErr } = await ctx.admin.auth.admin.inviteUserByEmail(
    d.email!,
    { data: { full_name: d.fullName } }
  );
  if (authErr) return { success: false, error: `Auth invite failed: ${authErr.message}` };

  const { data: staffRow, error } = await ctx.supabase
    .from("staff")
    .insert({
      branch_id:    d.branchId,
      auth_user_id: authUser.user.id,
      full_name:    d.fullName,
      phone:        d.phone       ?? null,
      tier:         d.tier,
      system_role:  d.systemRole,
      staff_type:   d.staffType,
      is_head:      d.isHead,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  if (staffRow && d.serviceIds && d.serviceIds.length > 0) {
    try {
      await syncStaffServices(ctx.supabase, staffRow.id, d.serviceIds);
    } catch (e) {
      return { success: false, error: `Staff created but failed to set services: ${(e as Error).message}` };
    }
  }

  revalidatePath("/owner/staff");
  return { success: true };
}

// ── Generate invite link (owner or manager) ───────────────────────────────
export async function generateInviteAction(rawInput: unknown) {
  const ctx = await requireOwnerOrManager();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const { branchId, email } = rawInput as { branchId?: string; email?: string };

  // Manager can only invite to their own branch
  if (ctx.me.system_role === "manager" && branchId && branchId !== ctx.me.branch_id) {
    return { success: false, error: "You can only invite staff to your own branch" };
  }

  const targetBranch = branchId || ctx.me.branch_id;
  if (!targetBranch) return { success: false, error: "Branch is required" };

  const { data, error } = await ctx.supabase
    .from("staff")
    .insert({
      branch_id:    targetBranch,
      full_name:    "Pending Invitation",
      phone:        "0000000000",
      tier:         "junior",
      system_role:  "staff",
      staff_type:   "therapist",
      is_head:      false,
      is_active:    false,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/owner/staff");
  return { success: true, staffId: data.id };
}

// ── Onboard: claim invite by creating auth account ────────────────────────
export async function onboardStaffAction(rawInput: unknown) {
  const supabase = await createClient();

  const parsed = (() => {
    if (!rawInput || typeof rawInput !== "object") return null;
    const r = rawInput as Record<string, unknown>;
    const staffId = String(r.staffId ?? "");
    const fullName = String(r.fullName ?? "");
    const email = String(r.email ?? "");
    const phone = String(r.phone ?? "");
    const password = String(r.password ?? "");
    if (!staffId || !fullName || !email || !phone || !password) return null;
    return { staffId, fullName, email, phone, password };
  })();

  if (!parsed) return { success: false, error: "All fields are required" };
  const { staffId, fullName, email, phone, password } = parsed;

  // Verify staff record exists and is claimable
  const { data: staffRecord } = await supabase
    .from("staff")
    .select("id, auth_user_id, is_active, created_at")
    .eq("id", staffId)
    .single();

  if (!staffRecord) return { success: false, error: "Invalid invite link" };
  if (staffRecord.auth_user_id) return { success: false, error: "This invite has already been claimed" };
  if (staffRecord.is_active) return { success: false, error: "This invite is no longer valid" };

  // Check expiry (7 days)
  const createdAt = new Date(staffRecord.created_at);
  const expiry = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (new Date() > expiry) return { success: false, error: "This invite has expired" };

  // Create auth user
  const admin = createAdminClient();
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authErr) return { success: false, error: authErr.message };

  // Update staff row
  const { error: updateErr } = await supabase
    .from("staff")
    .update({
      auth_user_id: authUser.user.id,
      full_name: fullName,
      phone,
    })
    .eq("id", staffId);

  if (updateErr) return { success: false, error: updateErr.message };

  return { success: true };
}

// ── Update staff profile (owner or manager) ───────────────────────────────
export async function updateStaffAction(rawInput: unknown) {
  const parsed = updateStaffSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const ctx = await requireOwnerOrManager();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const { staffId, serviceIds, ...updates } = parsed.data;

  // Manager can only update staff in their branch
  if (ctx.me.system_role === "manager") {
    const { data: target } = await ctx.supabase
      .from("staff").select("branch_id").eq("id", staffId).single();
    if (!target || target.branch_id !== ctx.me.branch_id) {
      return { success: false, error: "You can only manage staff in your branch" };
    }
  }

  const { error } = await ctx.supabase
    .from("staff")
    .update({
      ...(updates.fullName   !== undefined && { full_name:    updates.fullName }),
      ...(updates.phone      !== undefined && { phone:        updates.phone }),
      ...(updates.tier       !== undefined && { tier:         updates.tier }),
      ...(updates.systemRole !== undefined && { system_role:  updates.systemRole }),
      ...(updates.staffType  !== undefined && { staff_type:   updates.staffType }),
      ...(updates.isHead     !== undefined && { is_head:      updates.isHead }),
      ...(updates.branchId   !== undefined && { branch_id:    updates.branchId }),
      ...(updates.isActive   !== undefined && { is_active:    updates.isActive }),
    })
    .eq("id", staffId);

  if (error) return { success: false, error: error.message };

  if (serviceIds !== undefined) {
    try {
      await syncStaffServices(ctx.supabase, staffId, serviceIds);
    } catch (e) {
      return { success: false, error: `Profile updated but failed to sync services: ${(e as Error).message}` };
    }
  }

  revalidatePath("/owner/staff");
  return { success: true };
}
