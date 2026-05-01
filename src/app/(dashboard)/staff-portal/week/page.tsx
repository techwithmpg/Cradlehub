import { MyWeekPage } from "@/components/features/staff-portal/my-week-page";
import {
  buildStaffWeekPlanner,
  getWeekNavigation,
  type WeekResult,
} from "@/lib/staff-portal/week";
import { getMyWeekAction } from "../actions";

export default async function StaffWeekPage({
  searchParams,
}: {
  searchParams: Promise<{ weekStart?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const navigation = getWeekNavigation(resolvedSearchParams.weekStart);
  const result = (await getMyWeekAction(navigation.fromDate, navigation.toDate)) as WeekResult;

  if ("error" in result) {
    return (
      <div
        style={{
          padding: "2rem",
          textAlign: "center",
          color: "var(--cs-text-muted)",
          fontSize: "0.875rem",
        }}
      >
        {result.error}
      </div>
    );
  }

  const planner = buildStaffWeekPlanner({
    days: navigation.days,
    bookings: result.bookings,
    schedule: result.schedule,
    overrides: result.overrides,
  });

  return (
    <MyWeekPage
      fromDate={navigation.fromDate}
      toDate={navigation.toDate}
      previousWeekStart={navigation.previousWeekStart}
      nextWeekStart={navigation.nextWeekStart}
      currentWeekStart={navigation.currentWeekStart}
      isCurrentWeek={navigation.isCurrentWeek}
      days={planner.days}
      summary={planner.summary}
    />
  );
}
