"use server";

import { createClient } from "@/lib/supabase/server";
import { getManagerDashboardStats, getTodaysSchedule, getWeekSchedule } from "@/lib/queries/bookings";

type ManagerContext = {
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
    me: {
      id: me.id,
      branch_id: me.branch_id,
      system_role: me.system_role,
    },
  };
}

// -- Manager dashboard data (today stats + schedule) ------------------------
export async function getManagerDashboardAction(date: string) {
  const ctx = await getManagerContext();
  if (!ctx) return { error: "Unauthorized" };

  const [stats, schedule] = await Promise.all([
    getManagerDashboardStats(ctx.me.branch_id, date),
    getTodaysSchedule(ctx.me.branch_id, date),
  ]);

  return { stats, schedule };
}

// -- Week view for manager planning -----------------------------------------
export async function getManagerWeekAction(fromDate: string, toDate: string) {
  const ctx = await getManagerContext();
  if (!ctx) return { error: "Unauthorized" };

  return getWeekSchedule(ctx.me.branch_id, fromDate, toDate);
}
