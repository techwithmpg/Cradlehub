import { BasicStaffHeader } from "./basic-staff-header";
import { BasicStaffGreetingCard } from "./basic-staff-greeting-card";
import { BasicStaffShiftCard } from "./basic-staff-shift-card";
import { BasicStaffAssignmentCard } from "./basic-staff-assignment-card";
import { BasicStaffQuickActions } from "./basic-staff-quick-actions";
import type { StaffPortalStaff, StaffPortalBooking } from "@/components/features/staff-portal/types";
import type { TodayScheduleInfo, TodayOverrideInfo } from "@/app/(dashboard)/staff-portal/actions";

type BasicStaffMobileHomeProps = {
  staff: StaffPortalStaff;
  bookings: StaffPortalBooking[];
  todaySchedule: TodayScheduleInfo | null;
  todayOverride: TodayOverrideInfo | null;
};

export function BasicStaffMobileHome({
  staff,
  bookings,
  todaySchedule,
  todayOverride,
}: BasicStaffMobileHomeProps) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "var(--cs-bg)",
      }}
    >
      {/* Sticky header */}
      <BasicStaffHeader staff={staff} />

      {/* Scrollable content */}
      <div
        style={{
          padding: "0.875rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          maxWidth: 480,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {/* Greeting with status badge */}
        <BasicStaffGreetingCard
          staff={staff}
          todaySchedule={todaySchedule}
          todayOverride={todayOverride}
        />

        {/* My Shift Today card */}
        <BasicStaffShiftCard
          todaySchedule={todaySchedule}
          todayOverride={todayOverride}
        />

        {/* Next Assignment card — no service progress controls */}
        <BasicStaffAssignmentCard bookings={bookings} />

        {/* Quick Actions grid */}
        <BasicStaffQuickActions />
      </div>

    </div>
  );
}
