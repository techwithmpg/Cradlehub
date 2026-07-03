import { ScheduleWorkspaceShell } from "@/components/features/schedule/workspace/schedule-workspace-shell";
import { getDailySchedule } from "@/lib/queries/schedule";
import { getManagerDashboardStats } from "@/lib/queries/bookings";
import { getCrmReadinessCached } from "@/lib/queries/crm-readiness";
import { getStaffWithAvailability } from "@/lib/queries/staff";
import { createClient } from "@/lib/supabase/server";
import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  try {
    const serialized = JSON.stringify(error);
    return serialized && serialized !== "{}"
      ? serialized
      : "Unknown schedule loading error";
  } catch {
    return "Unknown schedule loading error";
  }
}

export default async function CrmSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; tab?: string }>;
}) {
  const { branchId, branchName } = await getFrontDeskContext();
  const params = await searchParams;
  const today = getBranchBusinessDate();
  const selectedDate = params.date ?? today;
  const supabase = await createClient();

  const [dailyScheduleResult, availabilityItems, stats, resourcesResult, readiness] = await Promise.all([
    getDailySchedule({ branchId, date: selectedDate })
      .then((data) => ({ data, error: null }))
      .catch((error: unknown) => {
        const message = getErrorMessage(error);
        console.error(
          `[crm/schedule] daily timeline load failed branch=${branchId} date=${selectedDate}: ${message}`,
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.stack
            : undefined
        );
        return {
          data: [],
          error: "Daily schedule is temporarily unavailable. Refresh the timeline or open Schedule Setup.",
        };
      }),
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
  const staffRows = dailyScheduleResult.data;

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
      dailyTimelineError={dailyScheduleResult.error}
      dailyTimelineNow={new Date().toISOString()}
    />
  );
}
