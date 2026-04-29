"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStaffSchema, updateStaffSchema } from "@/lib/validations/staff";
import { revalidatePath } from "next/cache";

async function requireOwner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase
    .from("staff").select("system_role").eq("auth_user_id", user.id).single();
  if (me?.system_role !== "owner") return null;
  return { supabase, admin: createAdminClient() };
}

export async function createStaffAction(rawInput: unknown) {
  const parsed = createStaffSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const ctx = await requireOwner();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const { data: d } = parsed;

  // Invite user via Supabase Auth (sends magic link email)
  const { data: authUser, error: authErr } = await ctx.admin.auth.admin.inviteUserByEmail(
    d.email!,
    { data: { full_name: d.fullName } }
  );
  if (authErr) return { success: false, error: `Auth invite failed: ${authErr.message}` };

  const { error } = await ctx.supabase
    .from("staff")
    .insert({
      branch_id:    d.branchId,
      auth_user_id: authUser.user.id,
      full_name:    d.fullName,
      phone:        d.phone       ?? null,
      tier:         d.tier,
      system_role:  d.systemRole,
    });

  if (error) return { success: false, error: error.message };
  revalidatePath("/owner/staff");
  return { success: true };
}

export async function updateStaffAction(rawInput: unknown) {
  const parsed = updateStaffSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const ctx = await requireOwner();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const { staffId, ...updates } = parsed.data;
  const { error } = await ctx.supabase
    .from("staff")
    .update({
      ...(updates.fullName   !== undefined && { full_name:    updates.fullName }),
      ...(updates.phone      !== undefined && { phone:        updates.phone }),
      ...(updates.tier       !== undefined && { tier:         updates.tier }),
      ...(updates.systemRole !== undefined && { system_role:  updates.systemRole }),
      ...(updates.branchId   !== undefined && { branch_id:    updates.branchId }),
      ...(updates.isActive   !== undefined && { is_active:    updates.isActive }),
    })
    .eq("id", staffId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/owner/staff");
  return { success: true };
}
