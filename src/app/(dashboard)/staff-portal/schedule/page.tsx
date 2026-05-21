import { StaffSchedulePage } from "@/components/features/staff-portal/staff-schedule-page";
import { getWeekNavigation, buildStaffWeekPlanner, type WeekResult } from "@/lib/staff-portal/week";
import { buildWeekEvents } from "@/lib/staff-portal/schedule";
import { getMyWeekAction } from "../actions";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ weekStart?: string }>;
}) {
  const resolved = await searchParams;
  const nav = getWeekNavigation(resolved.weekStart);
  const result = (await getMyWeekAction(nav.fromDate, nav.toDate)) as WeekResult;

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
    days: nav.days,
    bookings: result.bookings,
    schedule: result.schedule,
    overrides: result.overrides,
  });

  const eventsByDate = buildWeekEvents({
    days: nav.days,
    bookings: result.bookings,
    blocks: result.blocks,
  });

  return (
    <StaffSchedulePage
      nav={nav}
      days={planner.days}
      summary={planner.summary}
      eventsByDate={eventsByDate}
    />
  );
}
