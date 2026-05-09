"use client";

import { ChevronRight, Coffee, Car, Ban, Briefcase } from "lucide-react";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import type { DailyScheduleStaffRow, DailyScheduleBooking, DailyScheduleBlock } from "@/lib/queries/schedule";

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

function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = (h ?? 0) >= 12 ? "PM" : "AM";
  const displayHour = (h ?? 0) > 12 ? (h ?? 0) - 12 : (h ?? 0) === 0 ? 12 : (h ?? 0);
  return `${displayHour}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

type DayItem =
  | { kind: "booking"; data: DailyScheduleBooking }
  | { kind: "block"; data: DailyScheduleBlock }
  | { kind: "off_duty"; start: string; end: string };

function buildDayItems(staff: DailyScheduleStaffRow): DayItem[] {
  const items: DayItem[] = [];

  // If fully off, show one off-duty item
  if (!staff.work_start || !staff.work_end) {
    items.push({ kind: "off_duty", start: "08:00", end: "21:00" });
    return items;
  }

  // Collect all time-bounded items
  const timed: Array<{ start: string; end: string; item: DayItem }> = [];

  for (const booking of staff.bookings) {
    timed.push({
      start: booking.start_time,
      end: booking.end_time,
      item: { kind: "booking", data: booking },
    });
  }

  for (const block of staff.blocks) {
    timed.push({
      start: block.start_time,
      end: block.end_time,
      item: { kind: "block", data: block },
    });
  }

  // Sort by start time
  timed.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  let cursor = timeToMinutes(staff.work_start);
  const workEndMin = timeToMinutes(staff.work_end);

  for (const t of timed) {
    const tStart = timeToMinutes(t.start);
    const tEnd = timeToMinutes(t.end);

    // Gap before this item = off-duty (but only if within work hours)
    if (tStart > cursor && cursor >= timeToMinutes(staff.work_start)) {
      items.push({
        kind: "off_duty",
        start: minutesToTime(cursor),
        end: minutesToTime(Math.min(tStart, workEndMin)),
      });
    }

    // The item itself (clip to work hours)
    if (tStart < workEndMin && tEnd > cursor) {
      items.push(t.item);
    }

    cursor = Math.max(cursor, tEnd);
  }

  // Gap after last item
  if (cursor < workEndMin) {
    items.push({
      kind: "off_duty",
      start: minutesToTime(cursor),
      end: minutesToTime(workEndMin),
    });
  }

  return items;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const BOOKING_STATUS_BG: Record<string, string> = {
  confirmed: "#E8F5E9",
  in_progress: "#EDE7F6",
  completed: "#E0F2F1",
  cancelled: "#F5F5F5",
  no_show: "#FFF3E0",
  pending: "#FFF8E1",
};

const BOOKING_STATUS_BORDER: Record<string, string> = {
  confirmed: "#4A7C59",
  in_progress: "#7E57C2",
  completed: "#00897B",
  cancelled: "#BDBDBD",
  no_show: "#FF9800",
  pending: "#F59E0B",
};

const BOOKING_STATUS_DOT: Record<string, string> = {
  confirmed: "#4A7C59",
  in_progress: "#7E57C2",
  completed: "#00897B",
  cancelled: "#BDBDBD",
  no_show: "#FF9800",
  pending: "#F59E0B",
};

type ScheduleStaffDayListProps = {
  staff: DailyScheduleStaffRow;
  selectedBookingId: string | null;
  onBookingClick: (bookingId: string) => void;
};

export function ScheduleStaffDayList({ staff, selectedBookingId, onBookingClick }: ScheduleStaffDayListProps) {
  const items = buildDayItems(staff);

  if (items.length === 0) {
    return (
      <div
        style={{
          backgroundColor: "var(--cs-surface)",
          border: "1px solid var(--cs-border)",
          borderRadius: 10,
          padding: "2rem 1.5rem",
          textAlign: "center",
          color: "var(--cs-text-muted)",
          fontSize: "0.875rem",
        }}
      >
        <div style={{ fontSize: 24, marginBottom: 8 }}>🌿</div>
        <div style={{ fontWeight: 600, color: "var(--cs-text)", marginBottom: 4 }}>No schedule items</div>
        <div>There are no bookings or blocks for this staff today.</div>
      </div>
    );
  }

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
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        if (item.kind === "booking") {
          const booking = item.data;
          const isSelected = selectedBookingId === booking.id;
          const duration = timeToMinutes(booking.end_time) - timeToMinutes(booking.start_time);
          const bg = BOOKING_STATUS_BG[booking.status] ?? "#F5F5F5";
          const border = BOOKING_STATUS_BORDER[booking.status] ?? "#BDBDBD";
          const dotColor = BOOKING_STATUS_DOT[booking.status] ?? "#BDBDBD";

          return (
            <button
              key={`booking-${booking.id}`}
              type="button"
              onClick={() => onBookingClick(booking.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.75rem 1rem",
                borderBottom: isLast ? "none" : "1px solid var(--cs-border)",
                backgroundColor: isSelected ? `${bg}` : "transparent",
                borderLeft: isSelected ? `3px solid ${border}` : "3px solid transparent",
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
                  width: 110,
                  flexShrink: 0,
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                {formatTimeRange(booking.start_time, booking.end_time)}
              </div>

              {/* Dot */}
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: dotColor,
                  flexShrink: 0,
                }}
              />

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
                  }}
                >
                  <span>{booking.customer}</span>
                  <BookingStatusBadge status={booking.status} />
                  <span style={{ color: "var(--cs-text-muted)", fontWeight: 500 }}>
                    {formatMinutes(duration)}
                  </span>
                </div>
              </div>

              <ChevronRight size={14} style={{ color: "var(--cs-text-muted)", flexShrink: 0 }} />
            </button>
          );
        }

        if (item.kind === "block") {
          const block = item.data;
          const duration = timeToMinutes(block.end_time) - timeToMinutes(block.start_time);
          const reason = (block.reason ?? "Blocked").toLowerCase();
          const isBreak = reason.includes("break") || reason.includes("lunch");
          const isTravel = reason.includes("travel");
          const Icon = isBreak ? Coffee : isTravel ? Car : Ban;
          const iconColor = isBreak ? "#8A7A6A" : isTravel ? "#D97706" : "#8A7A6A";
          const bgColor = isBreak ? "#F9F7F4" : isTravel ? "#FFF7ED" : "#F9F7F4";

          return (
            <div
              key={`block-${index}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.75rem 1rem",
                borderBottom: isLast ? "none" : "1px solid var(--cs-border)",
                backgroundColor: bgColor,
                borderLeft: "3px solid transparent",
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--cs-text-muted)",
                  width: 110,
                  flexShrink: 0,
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                {formatTimeRange(block.start_time, block.end_time)}
              </div>
              <Icon size={14} style={{ color: iconColor, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "var(--cs-text)",
                  }}
                >
                  {block.reason || "Blocked"}
                </div>
                <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", marginTop: 2 }}>
                  {formatMinutes(duration)}
                </div>
              </div>
            </div>
          );
        }

        // off_duty
        const duration = timeToMinutes(item.end) - timeToMinutes(item.start);
        return (
          <div
            key={`off-${index}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.75rem 1rem",
              borderBottom: isLast ? "none" : "1px solid var(--cs-border)",
              backgroundColor: "rgba(200,190,180,0.12)",
              borderLeft: "3px solid transparent",
            }}
          >
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--cs-text-muted)",
                width: 110,
                flexShrink: 0,
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              {formatTimeRange(item.start, item.end)}
            </div>
            <Briefcase size={14} style={{ color: "#BDBDBD", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "var(--cs-text-muted)",
                  fontStyle: "italic",
                }}
              >
                Off Duty / Available
              </div>
              <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", marginTop: 2 }}>
                {formatMinutes(duration)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
