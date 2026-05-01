"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StaffSummaryCard } from "./staff-summary-card";
import { StaffStatsRow } from "./staff-stats-row";
import { NextAppointmentCard } from "./next-appointment-card";
import { StaffAppointmentCard } from "./staff-appointment-card";
import { StaffAppointmentsEmptyState } from "./staff-appointments-empty-state";
import type { StaffPortalBooking, StaffPortalStaff } from "./types";

type StaffTodayDashboardProps = {
  staff: StaffPortalStaff;
  bookings: StaffPortalBooking[];
  date: string;
};

function useStaffRealtime(staffId: string, date: string) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`staff-today-${staffId}-${date}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `staff_id=eq.${staffId}`,
        },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [staffId, date, router]);
}

export function StaffTodayDashboard({ staff, bookings, date }: StaffTodayDashboardProps) {
  useStaffRealtime(staff.id, date);

  const total = bookings.length;
  const completed = bookings.filter((b) => b.status === "completed").length;
  const remaining = bookings.filter((b) => b.status !== "completed").length;
  const homeService = bookings.filter((b) => b.type === "home_service").length;

  // Next appointment = first non-comirmed/non-completed booking by start_time
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const sortedBookings = [...bookings].sort((a, b) => a.start_time.localeCompare(b.start_time));

  const nextBooking = sortedBookings.find((b) => {
    if (b.status === "completed") return false;
    const [h, m] = b.start_time.split(":").map(Number);
    const startMinutes = (h ?? 0) * 60 + (m ?? 0);
    return startMinutes >= nowMinutes;
  }) ?? sortedBookings.find((b) => b.status !== "completed") ?? null;

  const nextAppointmentTime = nextBooking ? nextBooking.start_time.slice(0, 5) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Summary Card */}
      <StaffSummaryCard
        staff={staff}
        totalAppointments={total}
        nextAppointmentTime={nextAppointmentTime}
      />

      {/* Stats Row */}
      {total > 0 && (
        <StaffStatsRow
          total={total}
          completed={completed}
          remaining={remaining}
          homeService={homeService}
        />
      )}

      {/* Next Appointment Highlight */}
      {nextBooking && (
        <NextAppointmentCard booking={nextBooking} />
      )}

      {/* Today's Schedule */}
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--cs-text)",
            marginBottom: "0.625rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>Today&apos;s Schedule</span>
          {total > 0 && (
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--cs-text-muted)" }}>
              {total} appointment{total !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {bookings.length === 0 ? (
          <StaffAppointmentsEmptyState />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {sortedBookings.map((booking) => (
              <StaffAppointmentCard
                key={booking.id}
                booking={booking}
                isNext={nextBooking?.id === booking.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
