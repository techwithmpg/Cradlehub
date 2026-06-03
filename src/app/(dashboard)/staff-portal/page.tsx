import { getMyTodayAction, getMyTodayScheduleAction } from "./actions";
import { getStaffCheckinForDate } from "@/lib/actions/staff-checkins";
import { StaffTodayDashboard } from "@/components/features/staff-portal/staff-today-dashboard";
import { StaffMobileHome } from "@/components/features/staff-portal/mobile/staff-mobile-home";
import { StaffCheckinWidget } from "@/components/features/staff-portal/staff-checkin-widget";
import { ActionRequiredList } from "@/components/features/notifications/action-required-list";
import { BasicStaffMobileHome } from "@/components/features/staff-portal/basic/basic-staff-mobile-home";
import { getStaffPortalMode, isBasicStaffMode } from "@/lib/staff/get-staff-portal-mode";
import type { StaffPortalBooking, StaffPortalStaff } from "@/components/features/staff-portal/types";

type TodayActionResult =
  | { error: string }
  | { bookings: StaffPortalBooking[]; staff: StaffPortalStaff };

export default async function StaffTodayPage() {
  const today = new Date().toISOString().split("T")[0]!;
  const result = (await getMyTodayAction(today)) as TodayActionResult;

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

  // For basic staff: fetch today's schedule so we can show shift info on home
  const scheduleResult = isBasic
    ? await getMyTodayScheduleAction(today)
    : null;

  const todaySchedule =
    scheduleResult && !("error" in scheduleResult)
      ? scheduleResult.todaySchedule
      : null;
  const todayOverride =
    scheduleResult && !("error" in scheduleResult)
      ? scheduleResult.todayOverride
      : null;

  // Fetch today's check-in status (for non-basic / therapist mobile check-in widget)
  const checkin =
    !isBasic && result.staff.branch_id
      ? await getStaffCheckinForDate(
          result.staff.id,
          result.staff.branch_id,
          today
        ).catch(() => null)
      : null;

  return (
    <>
      {/* ── Desktop layout (md and above) ── */}
      <div className="hidden md:block">
        <ActionRequiredList limit={3} />
        {result.staff.branch_id && !isBasic && (
          <div style={{ marginBottom: "1rem" }}>
            <StaffCheckinWidget
              staffId={result.staff.id}
              shiftDate={today}
              checkin={checkin}
            />
          </div>
        )}
        <StaffTodayDashboard
          staff={result.staff}
          bookings={result.bookings}
          date={today}
        />
      </div>

      {/* ── Mobile layout (below md) ── */}
      <div className="block md:hidden">
        {isBasic ? (
          /* Basic staff: clean mobile home (no service progress controls) */
          <BasicStaffMobileHome
            staff={result.staff}
            bookings={result.bookings}
            todaySchedule={todaySchedule}
            todayOverride={todayOverride}
          />
        ) : (
          /* Therapist / driver: existing mobile home */
          <>
            {result.staff.branch_id && (
              <div style={{ marginBottom: "0.75rem" }}>
                <StaffCheckinWidget
                  staffId={result.staff.id}
                  shiftDate={today}
                  checkin={checkin}
                />
              </div>
            )}
            <StaffMobileHome
              staff={result.staff}
              bookings={result.bookings}
              date={today}
            />
          </>
        )}
      </div>
    </>
  );
}
