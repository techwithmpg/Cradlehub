"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { formatWeekRange } from "@/lib/staff-portal/week";
import type { StaffWeekDay } from "@/lib/staff-portal/week";

// ── Types ─────────────────────────────────────────────────────────────────────

type ScheduleEntry = {
  day_of_week: number;
  shift_type: string | null;
};

type BasicStaffWeekDetailProps = {
  days: StaffWeekDay[];
  schedule: ScheduleEntry[];
  fromDate: string;
  toDate: string;
  previousWeekStart: string;
  nextWeekStart: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

type DayStatus = "on_duty" | "day_off" | "no_shift";

function getDayStatus(day: StaffWeekDay): DayStatus {
  if (day.isDayOff) return "day_off";
  if (day.workHoursLabel !== null) return "on_duty";
  return "no_shift";
}

function getShiftTypeLabel(shiftType: string | null | undefined): string {
  if (shiftType === "opening") return "Opening Shift";
  if (shiftType === "closing") return "Closing Shift";
  return "Regular Shift";
}

function parseWorkHoursLabel(label: string | null): { start: string; end: string } | null {
  if (!label || label === "Day off") return null;
  const parts = label.split(" — ");
  if (parts.length !== 2) return null;
  return { start: parts[0] ?? "", end: parts[1] ?? "" };
}

const STATUS_DISPLAY: Record<DayStatus, { label: string; bg: string; color: string; border: string }> = {
  on_duty: {
    label: "On Duty",
    bg: "var(--cs-success-bg)",
    color: "var(--cs-success)",
    border: "rgba(90,138,106,0.2)",
  },
  day_off: {
    label: "Day Off",
    bg: "rgba(251,191,36,0.12)",
    color: "#92700A",
    border: "rgba(146,112,10,0.2)",
  },
  no_shift: {
    label: "No Shift",
    bg: "var(--cs-surface-warm)",
    color: "var(--cs-text-muted)",
    border: "var(--cs-border-soft)",
  },
};

// ── Day picker (horizontal) ────────────────────────────────────────────────────

function DayPicker({
  days,
  selectedDate,
  onSelect,
}: {
  days: StaffWeekDay[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        overflowX: "auto",
        gap: 6,
        padding: "0.75rem 1rem",
        backgroundColor: "#fff",
        borderBottom: "1px solid var(--cs-border-soft)",
        scrollbarWidth: "none",
      }}
    >
      {days.map((day) => {
        const isSelected = day.date === selectedDate;
        const status = getDayStatus(day);
        return (
          <button
            key={day.date}
            type="button"
            onClick={() => onSelect(day.date)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: "0.4rem 0.625rem",
              borderRadius: 12,
              border: "none",
              cursor: "pointer",
              backgroundColor: isSelected ? "var(--cs-staff-accent)" : "transparent",
              color: isSelected ? "#fff" : "var(--cs-text-muted)",
              flexShrink: 0,
              minWidth: 44,
              minHeight: 56,
            }}
            aria-pressed={isSelected}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                opacity: isSelected ? 0.85 : 1,
              }}
            >
              {day.dayNameShort}
            </span>
            <span
              style={{
                fontSize: 17,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {day.dayOfMonth}
            </span>
            {/* Status dot */}
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                backgroundColor:
                  isSelected
                    ? "rgba(255,255,255,0.7)"
                    : status === "on_duty"
                    ? "var(--cs-success)"
                    : status === "day_off"
                    ? "#92700A"
                    : "transparent",
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

// ── Day detail card ────────────────────────────────────────────────────────────

function DayDetailCard({
  day,
  shiftType,
}: {
  day: StaffWeekDay;
  shiftType: string | null;
}) {
  const status = getDayStatus(day);
  const { label, bg, color, border } = STATUS_DISPLAY[status];
  const times = parseWorkHoursLabel(day.workHoursLabel);

  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        border: "1px solid var(--cs-border-soft)",
        padding: "1rem 1.125rem",
        boxShadow: "var(--cs-shadow-xs)",
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
      }}
    >
      {/* Date row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--cs-text)",
          }}
        >
          {day.dayNameFull}, {day.dayNameShort} {day.dayOfMonth}
          {day.isToday && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 10,
                fontWeight: 700,
                color: "var(--cs-staff-accent)",
                verticalAlign: "middle",
              }}
            >
              Today
            </span>
          )}
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            backgroundColor: bg,
            color,
            border: `1px solid ${border}`,
            borderRadius: 100,
            padding: "2px 9px",
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {label}
        </span>
      </div>

      {status === "on_duty" && times ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={14} color="var(--cs-staff-accent)" />
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--cs-text)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatTime(times.start)} – {formatTime(times.end)}
            </span>
          </div>
          <div style={{ fontSize: 13, color: "var(--cs-text-secondary)", paddingLeft: 20 }}>
            {getShiftTypeLabel(shiftType)}
          </div>
        </>
      ) : status === "day_off" ? (
        <div style={{ fontSize: 13, color: "var(--cs-text-muted)" }}>
          No scheduled shift — day off.
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--cs-text-muted)" }}>
          No shift scheduled for this day.
        </div>
      )}
    </div>
  );
}

// ── Timeline card (on duty days only) ─────────────────────────────────────────

function TimelineCard({ times }: { times: { start: string; end: string } }) {
  const rows = [
    { time: formatTime(times.start), label: "Shift Start" },
    { time: formatTime(times.end), label: "Shift End" },
  ];

  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        border: "1px solid var(--cs-border-soft)",
        padding: "1rem 1.125rem",
        boxShadow: "var(--cs-shadow-xs)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--cs-text-muted)",
          marginBottom: "0.75rem",
        }}
      >
        {"Today's Timeline"}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {rows.map(({ time, label }, idx) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
            {/* Time column */}
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--cs-text-muted)",
                width: 70,
                flexShrink: 0,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {time}
            </div>
            {/* Dot + line */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: 14,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor: "var(--cs-staff-accent)",
                  border: "2px solid #fff",
                  boxShadow: "0 0 0 1.5px var(--cs-staff-accent)",
                }}
              />
              {idx < rows.length - 1 && (
                <div
                  style={{
                    width: 1.5,
                    height: 28,
                    backgroundColor: "var(--cs-border-soft)",
                    marginTop: 3,
                  }}
                />
              )}
            </div>
            {/* Label */}
            <div style={{ fontSize: 13, color: "var(--cs-text)", fontWeight: 500 }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Notes card ────────────────────────────────────────────────────────────────

function NotesCard() {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        border: "1px solid var(--cs-border-soft)",
        padding: "1rem 1.125rem",
        boxShadow: "var(--cs-shadow-xs)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--cs-text-muted)",
          marginBottom: "0.5rem",
        }}
      >
        Notes
      </div>
      <p style={{ margin: 0, fontSize: 13, color: "var(--cs-text-muted)", lineHeight: 1.5 }}>
        No notes for today.
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function BasicStaffWeekDetail({
  days,
  schedule,
  fromDate,
  toDate,
  previousWeekStart,
  nextWeekStart,
}: BasicStaffWeekDetailProps) {
  const defaultDay = days.find((d) => d.isToday)?.date ?? days[0]?.date ?? "";
  const [selectedDate, setSelectedDate] = useState(defaultDay);

  const selectedDay = days.find((d) => d.date === selectedDate) ?? days[0];
  const rangeLabel = formatWeekRange(fromDate, toDate);
  const prevHref = `/staff-portal/week?weekStart=${previousWeekStart}`;
  const nextHref = `/staff-portal/week?weekStart=${nextWeekStart}`;

  // Build shift_type lookup by day_of_week
  const schedByDow: Record<number, string | null> = {};
  for (const row of schedule) schedByDow[row.day_of_week] = row.shift_type ?? null;

  const times = selectedDay ? parseWorkHoursLabel(selectedDay.workHoursLabel) : null;
  const shiftType = selectedDay ? (schedByDow[selectedDay.dayOfWeek] ?? null) : null;

  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "var(--cs-bg)",
      }}
    >
      {/* Sticky header */}
      <div
        style={{
          backgroundColor: "#fff",
          borderBottom: "1px solid var(--cs-border-soft)",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        {/* Title + week navigation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.875rem 1rem 0.5rem",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 19,
                fontWeight: 700,
                color: "var(--cs-text)",
                lineHeight: 1.2,
              }}
            >
              My Week
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--cs-text-muted)" }}>
              {rangeLabel}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Link
              href={prevHref}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "1px solid var(--cs-border)",
                backgroundColor: "var(--cs-surface-warm)",
                color: "var(--cs-text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
              }}
              aria-label="Previous week"
            >
              <ChevronLeft size={16} />
            </Link>
            <Link
              href={nextHref}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "1px solid var(--cs-border)",
                backgroundColor: "var(--cs-surface-warm)",
                color: "var(--cs-text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
              }}
              aria-label="Next week"
            >
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>

        {/* Horizontal day picker */}
        {days.length > 0 && (
          <DayPicker
            days={days}
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
          />
        )}
      </div>

      {/* Day detail content */}
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
        {selectedDay && (
          <>
            <DayDetailCard day={selectedDay} shiftType={shiftType} />
            {getDayStatus(selectedDay) === "on_duty" && times && (
              <TimelineCard times={times} />
            )}
            <NotesCard />
          </>
        )}
      </div>

    </div>
  );
}
