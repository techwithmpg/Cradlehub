import { TherapistHeader } from "./therapist-header";
import { TherapistGreetingCard } from "./therapist-greeting-card";
import { TherapistShiftCard } from "./therapist-shift-card";
import { TherapistNextServiceCard } from "./therapist-next-service-card";
import { TherapistQuickActions } from "./therapist-quick-actions";
import type { StaffPortalStaff, StaffPortalBooking } from "@/components/features/staff-portal/types";
import type { TodayScheduleInfo, TodayOverrideInfo } from "@/app/(dashboard)/staff-portal/actions";

type TherapistMobileHomeProps = {
  staff: StaffPortalStaff;
  bookings: StaffPortalBooking[];
  todaySchedule: TodayScheduleInfo | null;
  todayOverride: TodayOverrideInfo | null;
};

/** Finds the next active/upcoming service for the therapist. */
function findNextService(
  bookings: StaffPortalBooking[]
): StaffPortalBooking | null {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const active = bookings.filter(
    (b) => b.status !== "completed" && b.status !== "cancelled" && b.status !== "no_show"
  );

  // Prefer session_started (currently running)
  const running = active.find((b) => b.booking_progress_status === "session_started");
  if (running) return running;

  // Prefer the next upcoming (start_time >= now)
  const upcoming = active.find((b) => {
    const [h = 0, m = 0] = b.start_time.split(":").map(Number);
    return h * 60 + m >= nowMinutes;
  });
  if (upcoming) return upcoming;

  // Fall back to first active
  return active[0] ?? null;
}

export function TherapistMobileHome({
  staff,
  bookings,
  todaySchedule,
  todayOverride,
}: TherapistMobileHomeProps) {
  const nextService = findNextService(bookings);

  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "var(--cs-bg)",
      }}
    >
      {/* Sticky header */}
      <TherapistHeader staff={staff} />

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
        {/* Greeting with service-aware status badge */}
        <TherapistGreetingCard
          staff={staff}
          bookings={bookings}
          todaySchedule={todaySchedule}
          todayOverride={todayOverride}
        />

        {/* My Shift Today */}
        <TherapistShiftCard
          todaySchedule={todaySchedule}
          todayOverride={todayOverride}
        />

        {/* Next Service card (therapist-specific, with countdown) */}
        <TherapistNextServiceCard booking={nextService} />

        {/* Quick Actions grid */}
        <TherapistQuickActions />
      </div>
    </div>
  );
}
