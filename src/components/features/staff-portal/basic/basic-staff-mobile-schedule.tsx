"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { formatWeekRange } from "@/lib/staff-portal/week";
import type { StaffWeekDay, StaffWeekNavigation } from "@/lib/staff-portal/week";

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterKey = "all" | "on_duty" | "day_off" | "booked" | "blocked";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "on_duty", label: "On Duty" },
  { key: "day_off", label: "Day Off" },
  { key: "booked", label: "Booked" },
  { key: "blocked", label: "Blocked" },
];

// ── Shift status helpers ───────────────────────────────────────────────────────

type DayStatus = "on_duty" | "day_off" | "no_shift";

function getDayStatus(day: StaffWeekDay): DayStatus {
  if (day.isDayOff) return "day_off";
  if (day.workHoursLabel !== null) return "on_duty";
  return "no_shift";
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

function parseWorkHoursLabel(
  label: string | null
): { start: string; end: string } | null {
  if (!label || label === "Day off") return null;
  const parts = label.split(" — ");
  if (parts.length !== 2) return null;
  return { start: parts[0] ?? "", end: parts[1] ?? "" };
}

// ── Day card ──────────────────────────────────────────────────────────────────

function DayCard({ day }: { day: StaffWeekDay }) {
  const status = getDayStatus(day);
  const { label, bg, color, border } = STATUS_DISPLAY[status];
  const times = parseWorkHoursLabel(day.workHoursLabel);

  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 14,
        border: "1px solid var(--cs-border-soft)",
        padding: "0.875rem 1rem",
        boxShadow: "var(--cs-shadow-xs)",
        display: "flex",
        alignItems: "flex-start",
        gap: "0.75rem",
      }}
    >
      {/* Left: day label */}
      <div
        style={{
          textAlign: "center",
          minWidth: 38,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--cs-text-muted)",
          }}
        >
          {day.dayNameShort}
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: day.isToday ? "var(--cs-staff-accent)" : "var(--cs-text)",
            lineHeight: 1.1,
            marginTop: 1,
          }}
        >
          {day.dayOfMonth}
        </div>
        {day.isToday && (
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              backgroundColor: "var(--cs-staff-accent)",
              margin: "3px auto 0",
            }}
          />
        )}
      </div>

      {/* Divider */}
      <div
        style={{
          width: 1,
          alignSelf: "stretch",
          backgroundColor: "var(--cs-border-soft)",
        }}
      />

      {/* Right: status + time */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              backgroundColor: bg,
              color,
              border: `1px solid ${border}`,
              borderRadius: 100,
              padding: "2px 8px",
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {label}
          </span>
        </div>

        {status === "on_duty" && times ? (
          <div style={{ marginTop: 5 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--cs-text)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatTime(times.start)} – {formatTime(times.end)}
            </div>
            {day.appointmentCount > 0 && (
              <div style={{ fontSize: 11, color: "var(--cs-text-muted)", marginTop: 3 }}>
                {day.appointmentCount} assignment{day.appointmentCount !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        ) : status === "on_duty" ? (
          <div style={{ fontSize: 13, color: "var(--cs-text-secondary)", marginTop: 4 }}>
            Schedule available
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "var(--cs-text-muted)", marginTop: 4 }}>
            {status === "day_off" ? "No scheduled shift" : "No shift scheduled"}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Filter helpers ─────────────────────────────────────────────────────────────

function matchesFilter(day: StaffWeekDay, filter: FilterKey): boolean {
  const status = getDayStatus(day);
  switch (filter) {
    case "on_duty": return status === "on_duty";
    case "day_off": return status === "day_off";
    case "booked": return day.appointmentCount > 0;
    case "blocked": return false; // blocked times not exposed per-day in StaffWeekDay yet
    default: return true;
  }
}

// ── Nav button style ──────────────────────────────────────────────────────────

const NAV_BTN: React.CSSProperties = {
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
  flexShrink: 0,
};

// ── Main component ─────────────────────────────────────────────────────────────

type BasicStaffMobileScheduleProps = {
  nav: StaffWeekNavigation;
  days: StaffWeekDay[];
};

export function BasicStaffMobileSchedule({
  nav,
  days,
}: BasicStaffMobileScheduleProps) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const rangeLabel = formatWeekRange(nav.fromDate, nav.toDate);
  const prevHref = `/staff-portal/schedule?weekStart=${nav.previousWeekStart}`;
  const nextHref = `/staff-portal/schedule?weekStart=${nav.nextWeekStart}`;

  const filteredDays = days.filter((day) => matchesFilter(day, filter));

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
          padding: "0.875rem 1rem 0.625rem",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        {/* Title + week nav */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.625rem",
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
              My Schedule
            </h1>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: 12,
                color: "var(--cs-text-muted)",
              }}
            >
              {rangeLabel}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Link href={prevHref} style={NAV_BTN} aria-label="Previous week">
              <ChevronLeft size={16} />
            </Link>
            <Link href={nextHref} style={NAV_BTN} aria-label="Next week">
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>

        {/* Filter chips */}
        <div
          style={{
            display: "flex",
            gap: 5,
            overflowX: "auto",
            paddingBottom: 2,
            scrollbarWidth: "none",
          }}
          aria-label="Schedule filter"
        >
          {FILTERS.map(({ key, label }) => {
            const isActive = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                style={{
                  padding: "0.3rem 0.75rem",
                  borderRadius: 100,
                  border: `1px solid ${isActive ? "var(--cs-staff-accent)" : "var(--cs-border)"}`,
                  backgroundColor: isActive ? "var(--cs-staff-accent)" : "var(--cs-surface-warm)",
                  color: isActive ? "#fff" : "var(--cs-text-muted)",
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day card list */}
      <div
        style={{
          padding: "0.875rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          maxWidth: 480,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {filteredDays.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "2rem 1rem",
              color: "var(--cs-text-muted)",
              fontSize: 13,
            }}
          >
            No days match the selected filter.
          </div>
        ) : (
          filteredDays.map((day) => <DayCard key={day.date} day={day} />)
        )}
      </div>

    </div>
  );
}
