import { MyWeekPage } from "@/components/features/staff-portal/my-week-page";
import { BasicStaffWeekDetail } from "@/components/features/staff-portal/basic/basic-staff-week-detail";
import {
  buildStaffWeekPlanner,
  getWeekNavigation,
  type WeekResult,
} from "@/lib/staff-portal/week";
import { getMyWeekAction } from "../actions";
import { getStaffPortalMode, isBasicStaffMode } from "@/lib/staff/get-staff-portal-mode";

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

  const mode = getStaffPortalMode(result.staff);
  const isBasic = isBasicStaffMode(mode);

  const planner = buildStaffWeekPlanner({
    days: navigation.days,
    bookings: result.bookings,
    schedule: result.schedule,
    overrides: result.overrides,
  });

  // Build lightweight schedule entries for shift_type lookup in week detail
  const scheduleEntries = result.schedule.map((row) => ({
    day_of_week: row.day_of_week,
    shift_type: row.shift_type ?? null,
  }));

  if (isBasic) {
    return (
      <>
        {/* Desktop: existing My Week page */}
        <div className="hidden md:block">
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
        </div>

        {/* Mobile: day-picker week detail for basic staff */}
        <div className="block md:hidden">
          <BasicStaffWeekDetail
            days={planner.days}
            schedule={scheduleEntries}
            fromDate={navigation.fromDate}
            toDate={navigation.toDate}
            previousWeekStart={navigation.previousWeekStart}
            nextWeekStart={navigation.nextWeekStart}
          />
        </div>
      </>
    );
  }

  // Therapist / driver: existing My Week page handles both desktop and mobile
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
