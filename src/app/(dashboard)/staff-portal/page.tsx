import { getMyTodayAction } from "./actions";
import { StaffTodayDashboard } from "@/components/features/staff-portal/staff-today-dashboard";
import { StaffMobileHome } from "@/components/features/staff-portal/mobile/staff-mobile-home";
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

  return (
    <>
      {/* ── Desktop layout (md and above) ── */}
      <div className="hidden md:block">
        <ActionRequiredList limit={3} />
        <StaffTodayDashboard
          staff={result.staff}
          bookings={result.bookings}
          date={today}
        />
      </div>

      {/* ── Mobile layout (below md) ── */}
      <div className="block md:hidden">
        <StaffMobileHome
          staff={result.staff}
          bookings={result.bookings}
          date={today}
        />
      </div>
    </>
  );
}
