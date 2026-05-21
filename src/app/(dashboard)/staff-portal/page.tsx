import { getMyTodayAction } from "./actions";
import { getStaffCheckinForDate } from "@/lib/actions/staff-checkins";
import { StaffTodayDashboard } from "@/components/features/staff-portal/staff-today-dashboard";
import { StaffMobileHome } from "@/components/features/staff-portal/mobile/staff-mobile-home";
import { StaffCheckinWidget } from "@/components/features/staff-portal/staff-checkin-widget";
import { ActionRequiredList } from "@/components/features/notifications/action-required-list";
import type { StaffPortalBooking, StaffPortalStaff } from "@/components/features/staff-portal/types";

type TodayActionResult =
  | { error: string }
  | { bookings: StaffPortalBooking[]; staff: StaffPortalStaff };

export default async function StaffTodayPage() {
  const today  = new Date().toISOString().split("T")[0]!;
  const result = (await getMyTodayAction(today)) as TodayActionResult;

  if ("error" in result) {
    return (
      <div
        style={{
          padding:   "2rem",
          textAlign: "center",
          color:     "var(--cs-text-muted)",
          fontSize:  "0.875rem",
        }}
      >
        {result.error}
      </div>
    );
  }

  // Fetch today's check-in status for the staff member (non-blocking fallback to null)
  const checkin = result.staff.branch_id
    ? await getStaffCheckinForDate(result.staff.id, result.staff.branch_id, today).catch(() => null)
    : null;

  return (
    <>
      {/* ── Desktop layout (md and above) ── */}
      <div className="hidden md:block">
        <ActionRequiredList limit={3} />
        {/* Check-in widget — only shown when staff has a branch */}
        {result.staff.branch_id && (
          <div style={{ marginBottom: "1rem" }}>
            <StaffCheckinWidget
              staffId={result.staff.id}
              branchId={result.staff.branch_id}
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
        {result.staff.branch_id && (
          <div style={{ marginBottom: "0.75rem" }}>
            <StaffCheckinWidget
              staffId={result.staff.id}
              branchId={result.staff.branch_id}
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
      </div>
    </>
  );
}
