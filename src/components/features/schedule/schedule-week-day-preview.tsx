"use client";

import { CalendarDays, ChevronRight, Eye } from "lucide-react";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { formatPreviewTitle } from "./schedule-week-utils";
import type { DailyScheduleStaffRow, DailyScheduleBooking } from "@/lib/queries/schedule";
import type { ScheduleViewMode } from "./schedule-mode-switcher";

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = (h ?? 0) >= 12 ? "PM" : "AM";
  const displayHour = (h ?? 0) > 12 ? (h ?? 0) - 12 : (h ?? 0) === 0 ? 12 : (h ?? 0);
  return `${displayHour}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

type ScheduleWeekDayPreviewProps = {
  date: string;
  staffRows: DailyScheduleStaffRow[];
  selectedBookingId: string | null;
  onBookingClick: (bookingId: string) => void;
  onViewModeChange: (mode: ScheduleViewMode) => void;
};

export function ScheduleWeekDayPreview({
  date,
  staffRows,
  selectedBookingId,
  onBookingClick,
  onViewModeChange,
}: ScheduleWeekDayPreviewProps) {
  const title = formatPreviewTitle(date);

  // Flatten all bookings from all staff for this day, sorted by time
  const allBookings: Array<{
    booking: DailyScheduleBooking;
    staffName: string;
  }> = [];

  for (const staff of staffRows) {
    for (const booking of staff.bookings) {
      allBookings.push({ booking, staffName: staff.staff_name });
    }
  }

  allBookings.sort((a, b) => a.booking.start_time.localeCompare(b.booking.start_time));

  const activeBookings = allBookings.filter(
    ({ booking }) => booking.status !== "cancelled" && booking.status !== "no_show"
  );

  const bookingCount = activeBookings.length;

  return (
    <div
      style={{
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: 10,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Preview header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem 1rem",
          borderBottom: "1px solid var(--cs-border)",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CalendarDays size={14} style={{ color: "var(--cs-sand)", flexShrink: 0 }} />
          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--cs-text)" }}>
            {title}
          </span>
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              color: "var(--cs-text-muted)",
              backgroundColor: "var(--cs-bg)",
              padding: "2px 8px",
              borderRadius: 100,
            }}
          >
            {bookingCount} booking{bookingCount === 1 ? "" : "s"}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onViewModeChange("day")}
          className="cs-btn cs-btn-ghost cs-btn-sm"
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          <Eye size={13} />
          View full day
        </button>
      </div>

      {/* Booking rows */}
      {activeBookings.length === 0 ? (
        <div
          style={{
            padding: "2rem 1.5rem",
            textAlign: "center",
            color: "var(--cs-text-muted)",
            fontSize: "0.875rem",
          }}
        >
          <div style={{ fontSize: 22, marginBottom: 8 }}>🌿</div>
          <div style={{ fontWeight: 600, color: "var(--cs-text)", marginBottom: 4 }}>
            No active bookings
          </div>
          <div>There are no bookings scheduled for this day.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {activeBookings.map(({ booking, staffName }, index) => {
            const isLast = index === activeBookings.length - 1;
            const isSelected = selectedBookingId === booking.id;

            return (
              <button
                key={booking.id}
                type="button"
                onClick={() => onBookingClick(booking.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.625rem 1rem",
                  borderBottom: isLast ? "none" : "1px solid var(--cs-border)",
                  backgroundColor: isSelected ? "var(--cs-bg)" : "transparent",
                  borderLeft: isSelected ? "3px solid var(--cs-sand)" : "3px solid transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  transition: "background-color 120ms ease",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = "var(--cs-bg)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                }}
                aria-pressed={isSelected}
              >
                {/* Time */}
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "var(--cs-text-muted)",
                    width: 80,
                    flexShrink: 0,
                    fontFamily: "var(--font-mono, monospace)",
                  }}
                >
                  {formatTime(booking.start_time)}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "var(--cs-text)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {booking.service}
                  </div>
                  <div
                    style={{
                      fontSize: "0.6875rem",
                      color: "var(--cs-text-muted)",
                      marginTop: 2,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <span>{staffName}</span>
                    {booking.resource_name && (
                      <span style={{ color: "var(--cs-text-muted)", fontWeight: 500 }}>
                        · {booking.resource_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status + chevron */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <BookingStatusBadge status={booking.status} />
                  <ChevronRight size={14} style={{ color: "var(--cs-text-muted)" }} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
