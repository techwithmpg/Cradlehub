"use server";

import { getAttendanceActionContext } from "@/lib/attendance/queries";
import { getManagerDashboardStats } from "@/lib/queries/bookings";
import { getDailySchedule } from "@/lib/queries/schedule";
import { createClient } from "@/lib/supabase/server";

export async function refreshScheduleWorkspaceAction(input: {
  branchId: string;
  date: string;
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { success: false as const, error: "Schedule date is invalid." };
  }

  const context = await getAttendanceActionContext({ branchId: input.branchId });
  if (!context) return { success: false as const, error: "Schedule access is no longer available." };

  try {
    const supabase = await createClient();
    const [staffRows, stats, resourcesResult] = await Promise.all([
      getDailySchedule({ branchId: context.branchId, date: input.date }),
      getManagerDashboardStats(context.branchId, input.date),
      supabase
        .from("branch_resources")
        .select("*")
        .eq("branch_id", context.branchId)
        .eq("is_active", true)
        .order("sort_order"),
    ]);

    if (resourcesResult.error) throw new Error(resourcesResult.error.message);
    const workspaceStats = {
      total: stats.total,
      confirmed: stats.confirmed,
      in_progress: stats.in_progress,
      completed: stats.completed,
      cancelled: stats.cancelled,
      no_show: stats.no_show,
    };
    return {
      success: true as const,
      data: { staffRows, stats: workspaceStats, branchResources: resourcesResult.data ?? [] },
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Schedule data could not be refreshed.",
    };
  }
}
