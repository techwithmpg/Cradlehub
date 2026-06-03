import { StaffSchedulePage } from "@/components/features/staff-portal/staff-schedule-page";
import { BasicStaffMobileSchedule } from "@/components/features/staff-portal/basic/basic-staff-mobile-schedule";
import { TherapistScheduleList } from "@/components/features/staff-portal/therapist/therapist-schedule-list";
import { getWeekNavigation, buildStaffWeekPlanner, type WeekResult } from "@/lib/staff-portal/week";
import { buildWeekEvents } from "@/lib/staff-portal/schedule";
import { getMyWeekAction } from "../actions";
import { getStaffPortalMode, isBasicStaffMode } from "@/lib/staff/get-staff-portal-mode";

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

  const mode = getStaffPortalMode(result.staff);
  const isBasic = isBasicStaffMode(mode);
  const isTherapist = mode === "therapist";

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

  if (isBasic) {
    return (
      <>
        <div className="hidden md:block">
          <StaffSchedulePage nav={nav} days={planner.days} summary={planner.summary} eventsByDate={eventsByDate} />
        </div>
        <div className="block md:hidden">
          <BasicStaffMobileSchedule nav={nav} days={planner.days} />
        </div>
      </>
    );
  }

  if (isTherapist) {
    return (
      <>
        <div className="hidden md:block">
          <StaffSchedulePage nav={nav} days={planner.days} summary={planner.summary} eventsByDate={eventsByDate} />
        </div>
        <div className="block md:hidden">
          <TherapistScheduleList nav={nav} days={planner.days} />
        </div>
      </>
    );
  }

  // Driver / other: existing schedule page
  return (
    <StaffSchedulePage
      nav={nav}
      days={planner.days}
      summary={planner.summary}
      eventsByDate={eventsByDate}
    />
  );
}
