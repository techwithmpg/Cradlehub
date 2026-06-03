import { getMyTodayAction, getMyTodayScheduleAction, getMyDriverJobsAction } from "./actions";
import { getStaffCheckinForDate } from "@/lib/actions/staff-checkins";
import { StaffTodayDashboard } from "@/components/features/staff-portal/staff-today-dashboard";
import { StaffMobileHome } from "@/components/features/staff-portal/mobile/staff-mobile-home";
import { StaffCheckinWidget } from "@/components/features/staff-portal/staff-checkin-widget";
import { ActionRequiredList } from "@/components/features/notifications/action-required-list";
import { BasicStaffMobileHome } from "@/components/features/staff-portal/basic/basic-staff-mobile-home";
import { TherapistMobileHome } from "@/components/features/staff-portal/therapist/therapist-mobile-home";
import { DriverMobileHome } from "@/components/features/staff-portal/driver/driver-mobile-home";
import { getStaffPortalMode, isBasicStaffMode } from "@/lib/staff/get-staff-portal-mode";
import type { StaffPortalBooking, StaffPortalStaff } from "@/components/features/staff-portal/types";
import type { RealDispatchItem, DispatchStats } from "@/lib/queries/dispatch-queries";

type TodayActionResult =
  | { error: string }
  | { bookings: StaffPortalBooking[]; staff: StaffPortalStaff };

type DriverJobsResult =
  | { error: string }
  | { items: RealDispatchItem[]; stats: DispatchStats; staff: StaffPortalStaff };

const EMPTY_DISPATCH_STATS: DispatchStats = {
  totalToday: 0, awaitingDispatch: 0, activeTrips: 0, completedToday: 0, cancelledToday: 0,
};

export default async function StaffTodayPage() {
  const today = new Date().toISOString().split("T")[0]!;
  const result = (await getMyTodayAction(today)) as TodayActionResult;

  if ("error" in result) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--cs-text-muted)", fontSize: "0.875rem" }}>
        {result.error}
      </div>
    );
  }

  const mode = getStaffPortalMode(result.staff);
  const isBasic = isBasicStaffMode(mode);
  const isTherapist = mode === "therapist";
  const isDriver = mode === "driver";

  // Fetch schedule data for basic and therapist modes
  const scheduleResult = !isDriver
    ? await getMyTodayScheduleAction(today)
    : null;

  const todaySchedule =
    scheduleResult && !("error" in scheduleResult) ? scheduleResult.todaySchedule : null;
  const todayOverride =
    scheduleResult && !("error" in scheduleResult) ? scheduleResult.todayOverride : null;

  // Driver: fetch dispatch jobs
  const driverResult = isDriver
    ? ((await getMyDriverJobsAction(today)) as DriverJobsResult)
    : null;
  const driverItems = driverResult && !("error" in driverResult) ? driverResult.items : [];
  const driverStats = driverResult && !("error" in driverResult) ? driverResult.stats : EMPTY_DISPATCH_STATS;

  // Check-in widget for non-basic (therapist/driver) on desktop only
  const checkin =
    !isBasic && result.staff.branch_id
      ? await getStaffCheckinForDate(result.staff.id, result.staff.branch_id, today).catch(() => null)
      : null;

  return (
    <>
      {/* ── Desktop layout ── */}
      <div className="hidden md:block">
        <ActionRequiredList limit={3} />
        {result.staff.branch_id && !isBasic && (
          <div style={{ marginBottom: "1rem" }}>
            <StaffCheckinWidget staffId={result.staff.id} shiftDate={today} checkin={checkin} />
          </div>
        )}
        <StaffTodayDashboard staff={result.staff} bookings={result.bookings} date={today} />
      </div>

      {/* ── Mobile layout ── */}
      <div className="block md:hidden">
        {isBasic ? (
          <BasicStaffMobileHome
            staff={result.staff}
            bookings={result.bookings}
            todaySchedule={todaySchedule}
            todayOverride={todayOverride}
          />
        ) : isTherapist ? (
          <TherapistMobileHome
            staff={result.staff}
            bookings={result.bookings}
            todaySchedule={todaySchedule}
            todayOverride={todayOverride}
          />
        ) : isDriver ? (
          <DriverMobileHome
            staff={result.staff}
            items={driverItems}
            stats={driverStats}
          />
        ) : (
          <>
            {result.staff.branch_id && (
              <div style={{ marginBottom: "0.75rem" }}>
                <StaffCheckinWidget staffId={result.staff.id} shiftDate={today} checkin={checkin} />
              </div>
            )}
            <StaffMobileHome staff={result.staff} bookings={result.bookings} date={today} />
          </>
        )}
      </div>
    </>
  );
}
