import { ScheduleWorkspaceShell } from "@/components/features/schedule/workspace/schedule-workspace-shell";
import { getDailySchedule } from "@/lib/queries/schedule";
import { getManagerDashboardStats } from "@/lib/queries/bookings";
import { getCrmReadinessCached } from "@/lib/queries/crm-readiness";
import { getStaffWithAvailability } from "@/lib/queries/staff";
import { createClient } from "@/lib/supabase/server";
import { getManagerContext } from "@/lib/queries/manager-context";

export default async function CrmSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; tab?: string }>;
}) {
  const { branchId, branchName } = await getManagerContext();
  const params = await searchParams;
  const today = new Date().toISOString().split("T")[0]!;
  const selectedDate = params.date ?? today;
  const supabase = await createClient();

  const [staffRows, availabilityItems, stats, resourcesResult, readiness] = await Promise.all([
    getDailySchedule({ branchId, date: selectedDate }).catch(() => []),
    getStaffWithAvailability(branchId).catch(() => []),
    getManagerDashboardStats(branchId, selectedDate),
    supabase
      .from("branch_resources")
      .select("*")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("sort_order"),
    getCrmReadinessCached(branchId).catch(() => null),
  ]);

  return (
    <ScheduleWorkspaceShell
      branchId={branchId}
      branchName={branchName}
      date={selectedDate}
      staffRows={staffRows}
      availabilityItems={availabilityItems}
      branchResources={resourcesResult.data ?? []}
      stats={stats}
      readiness={readiness}
    />
  );
}
