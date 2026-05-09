"use client";

import { useState } from "react";
import { CalendarDays, Info } from "lucide-react";
import { ScheduleWeekDayCard } from "./schedule-week-day-card";
import { ScheduleWeekDayPreview } from "./schedule-week-day-preview";
import { getWeekRange, formatWeekRange, isToday } from "./schedule-week-utils";
import type { DailyScheduleStaffRow, DailyScheduleBooking } from "@/lib/queries/schedule";
import type { ScheduleViewMode } from "./schedule-mode-switcher";
import type { Database } from "@/types/supabase";

type ResourceRow = Database["public"]["Tables"]["branch_resources"]["Row"];

type ScheduleWeekModeProps = {
  staffRows: DailyScheduleStaffRow[];
  branchResources: ResourceRow[];
  date: string;
  selectedBookingId: string | null;
  onBookingClick: (bookingId: string) => void;
  onViewModeChange: (mode: ScheduleViewMode) => void;
};

function computeDayMetrics(staffRows: DailyScheduleStaffRow[]) {
  let bookingCount = 0;
  let staffCount = 0;
  let alertCount = 0;
  const previewBookings: DailyScheduleBooking[] = [];

  for (const staff of staffRows) {
    if (staff.work_start && staff.work_end) {
      staffCount++;
    }

    for (const booking of staff.bookings) {
      if (booking.status !== "cancelled" && booking.status !== "no_show") {
        bookingCount++;
        if (previewBookings.length < 3) {
          previewBookings.push(booking);
        }
      }
    }

    // Simple alert detection (same logic as workspace)
    for (const booking of staff.bookings) {
      if (booking.status === "cancelled" || booking.status === "no_show") continue;
      if (booking.type === "home_service") alertCount++;
      if (booking.type !== "home_service" && !booking.resource_id) alertCount++;
    }
  }

  // Room conflicts
  const resourceBookings = new Map<string, DailyScheduleBooking[]>();
  for (const staff of staffRows) {
    for (const booking of staff.bookings) {
      if (booking.resource_id && booking.status !== "cancelled" && booking.status !== "no_show") {
        const list = resourceBookings.get(booking.resource_id) ?? [];
        list.push(booking);
        resourceBookings.set(booking.resource_id, list);
      }
    }
  }
  for (const list of resourceBookings.values()) {
    if (list.length > 1) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i]!;
          const b = list[j]!;
          if (a.start_time < b.end_time && b.start_time < a.end_time) {
            alertCount++;
          }
        }
      }
    }
  }

  return { bookingCount, staffCount, alertCount, previewBookings };
}

export function ScheduleWeekMode({
  staffRows,
  date,
  selectedBookingId,
  onBookingClick,
  onViewModeChange,
}: ScheduleWeekModeProps) {
  const [selectedDayDate, setSelectedDayDate] = useState(date);

  const week = getWeekRange(date);
  const rangeLabel = formatWeekRange(week.monday, week.sunday);

  // Metrics for the currently loaded date only
  const loadedMetrics = computeDayMetrics(staffRows);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", minWidth: 0 }}>
      {/* Week header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CalendarDays size={16} style={{ color: "var(--cs-sand)", flexShrink: 0 }} />
          <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--cs-text)" }}>
            Week Schedule
          </span>
          <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", fontWeight: 500 }}>
            {rangeLabel}
          </span>
          {isToday(date) && (
            <span
              style={{
                fontSize: "0.625rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                padding: "2px 8px",
                borderRadius: 100,
                background: "var(--cs-success-bg)",
                color: "var(--cs-success)",
              }}
            >
              Current week
            </span>
          )}
        </div>
      </div>

      {/* 7 day cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: "0.625rem",
        }}
      >
        {week.days.map((dayDate) => {
          const isLoaded = dayDate === date;
          const isSelected = selectedDayDate === dayDate;

          const metrics = isLoaded
            ? loadedMetrics
            : { bookingCount: 0, staffCount: 0, alertCount: 0, previewBookings: [] as DailyScheduleBooking[] };

          return (
            <ScheduleWeekDayCard
              key={dayDate}
              date={dayDate}
              isSelected={isSelected}
              isLoaded={isLoaded}
              bookingCount={metrics.bookingCount}
              staffCount={metrics.staffCount}
              alertCount={metrics.alertCount}
              previewBookings={metrics.previewBookings}
              onClick={() => setSelectedDayDate(dayDate)}
            />
          );
        })}
      </div>

      {/* Selected day preview */}
      {selectedDayDate === date ? (
        <ScheduleWeekDayPreview
          date={selectedDayDate}
          staffRows={staffRows}
          selectedBookingId={selectedBookingId}
          onBookingClick={onBookingClick}
          onViewModeChange={onViewModeChange}
        />
      ) : (
        <div
          style={{
            backgroundColor: "var(--cs-surface)",
            border: "1px solid var(--cs-border)",
            borderRadius: 10,
            padding: "1.5rem 1rem",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Info size={18} style={{ color: "var(--cs-text-muted)" }} />
          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--cs-text)" }}>
            Day data is not loaded yet
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", maxWidth: 400 }}>
            Use the date navigator (previous / next arrows) to load this day.
            Only the currently selected date has full schedule data.
          </div>
        </div>
      )}
    </div>
  );
}
