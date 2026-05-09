"use client";

import { CalendarDays, Clock, Gauge, Coffee, Car } from "lucide-react";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function formatMinutes(mins: number): string {
  if (mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

type ScheduleStaffSummaryCardsProps = {
  staff: DailyScheduleStaffRow;
};

export function ScheduleStaffSummaryCards({ staff }: ScheduleStaffSummaryCardsProps) {
  const isOff = !staff.work_start || !staff.work_end;

  // Today's bookings count
  const bookingCount = staff.bookings.length;

  // Scheduled time
  const scheduledMinutes =
    !isOff && staff.work_start && staff.work_end
      ? timeToMinutes(staff.work_end) - timeToMinutes(staff.work_start)
      : 0;

  // Booking minutes (only active statuses)
  const activeBookings = staff.bookings.filter(
    (b) => b.status !== "cancelled" && b.status !== "no_show"
  );
  const bookingMinutes = activeBookings.reduce((sum, b) => {
    return sum + timeToMinutes(b.end_time) - timeToMinutes(b.start_time);
  }, 0);

  // Utilization
  const utilization =
    scheduledMinutes > 0 ? Math.round((bookingMinutes / scheduledMinutes) * 100) : 0;

  // Break time from blocks
  const breakMinutes = staff.blocks.reduce((sum, block) => {
    const reason = (block.reason ?? "").toLowerCase();
    if (reason.includes("break") || reason.includes("lunch")) {
      return sum + timeToMinutes(block.end_time) - timeToMinutes(block.start_time);
    }
    return sum;
  }, 0);

  // Travel time from home_service bookings
  const travelMinutes = activeBookings.reduce((sum, b) => {
    if (b.type === "home_service") {
      // Use a default 30m travel buffer if not tracked elsewhere
      return sum + 30;
    }
    return sum;
  }, 0);

  const cards = [
    {
      label: "Today’s Bookings",
      value: String(bookingCount),
      icon: CalendarDays,
      sub: bookingCount === 1 ? "appointment" : "appointments",
    },
    {
      label: "Scheduled Time",
      value: formatMinutes(scheduledMinutes),
      icon: Clock,
      sub: isOff ? "off today" : `${staff.work_start} – ${staff.work_end}`,
    },
    {
      label: "Utilization",
      value: isOff ? "—" : `${utilization}%`,
      icon: Gauge,
      sub: isOff ? "off today" : `${formatMinutes(bookingMinutes)} booked`,
    },
    {
      label: "Break Time",
      value: formatMinutes(breakMinutes),
      icon: Coffee,
      sub: breakMinutes > 0 ? "scheduled" : "none",
    },
    {
      label: "Travel Time",
      value: formatMinutes(travelMinutes),
      icon: Car,
      sub: travelMinutes > 0 ? "home service" : "none",
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "0.75rem" }}>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            style={{
              backgroundColor: "var(--cs-surface)",
              border: "1px solid var(--cs-border)",
              borderRadius: 10,
              padding: "0.75rem 0.875rem",
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: "0.375rem" }}>
              <Icon size={12} style={{ color: "var(--cs-text-muted)", flexShrink: 0 }} />
              <span
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--cs-text-muted)",
                }}
              >
                {card.label}
              </span>
            </div>
            <div
              style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                color: "var(--cs-text)",
                fontFamily: "var(--font-playfair, serif)",
                lineHeight: 1.1,
              }}
            >
              {card.value}
            </div>
            <div style={{ fontSize: "0.625rem", color: "var(--cs-text-muted)", marginTop: 2 }}>
              {card.sub}
            </div>
          </div>
        );
      })}
    </div>
  );
}
