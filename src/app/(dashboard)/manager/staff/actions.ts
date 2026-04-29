"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ManagerContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  me: { id: string; branch_id: string; system_role: string };
};

async function getManagerContext(): Promise<ManagerContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .single();

  if (!me || me.system_role !== "manager" || !me.branch_id) return null;
  return {
    supabase,
    me: {
      id: me.id,
      branch_id: me.branch_id,
      system_role: me.system_role,
    },
  };
}

// -- Delete a blocked time ---------------------------------------------------
export async function deleteBlockedTimeAction(blockedTimeId: string) {
  const ctx = await getManagerContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const { data: staffRows, error: staffError } = await ctx.supabase
    .from("staff")
    .select("id")
    .eq("branch_id", ctx.me.branch_id);
  if (staffError) return { success: false, error: staffError.message };

  const staffIds = (staffRows ?? []).map((row) => row.id);
  if (staffIds.length === 0) return { success: false, error: "No branch staff found" };

  const { error } = await ctx.supabase
    .from("blocked_times")
    .delete()
    .eq("id", blockedTimeId)
    .in("staff_id", staffIds);

  if (error) return { success: false, error: error.message };
  revalidatePath("/manager/staff");
  return { success: true };
}

// -- Delete a schedule override ---------------------------------------------
export async function deleteScheduleOverrideAction(overrideId: string) {
  const ctx = await getManagerContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const { data: staffRows, error: staffError } = await ctx.supabase
    .from("staff")
    .select("id")
    .eq("branch_id", ctx.me.branch_id);
  if (staffError) return { success: false, error: staffError.message };

  const staffIds = (staffRows ?? []).map((row) => row.id);
  if (staffIds.length === 0) return { success: false, error: "No branch staff found" };

  const { error } = await ctx.supabase
    .from("schedule_overrides")
    .delete()
    .eq("id", overrideId)
    .in("staff_id", staffIds);

  if (error) return { success: false, error: error.message };
  revalidatePath("/manager/staff");
  return { success: true };
}
