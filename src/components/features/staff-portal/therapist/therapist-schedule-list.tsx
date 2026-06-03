"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { formatWeekRange } from "@/lib/staff-portal/week";
import type { StaffWeekDay, StaffWeekNavigation } from "@/lib/staff-portal/week";
import { TherapistMobileBottomNav } from "./therapist-mobile-bottom-nav";

type FilterKey = "all" | "on_duty" | "day_off" | "booked" | "blocked";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "on_duty", label: "On Duty" },
  { key: "day_off", label: "Day Off" },
  { key: "booked", label: "Booked" },
  { key: "blocked", label: "Blocked" },
];

type DayStatus = "on_duty" | "day_off" | "no_shift";

function getDayStatus(day: StaffWeekDay): DayStatus {
  if (day.isDayOff) return "day_off";
  if (day.workHoursLabel !== null) return "on_duty";
  return "no_shift";
}

const STATUS_DISPLAY: Record<DayStatus, { label: string; bg: string; color: string; border: string }> = {
  on_duty: { label: "On Duty", bg: "var(--cs-success-bg)", color: "var(--cs-success)", border: "rgba(90,138,106,0.2)" },
  day_off: { label: "Day Off", bg: "rgba(251,191,36,0.12)", color: "#92700A", border: "rgba(146,112,10,0.2)" },
  no_shift: { label: "No Shift", bg: "var(--cs-surface-warm)", color: "var(--cs-text-muted)", border: "var(--cs-border-soft)" },
};

function parseWorkHours(label: string | null): { start: string; end: string } | null {
  if (!label || label === "Day off") return null;
  const parts = label.split(" — ");
  if (parts.length !== 2) return null;
  return { start: parts[0] ?? "", end: parts[1] ?? "" };
}

function AppointmentChip({ appt }: { appt: StaffWeekDay["appointments"][number] }) {
  const statusColor =
    appt.status === "completed"
      ? "var(--cs-success)"
      : appt.status === "in_progress" || appt.bookingType === "home_service"
      ? "#7C3AED"
      : "var(--cs-text-muted)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 8px",
        borderRadius: 8,
        backgroundColor: "var(--cs-surface-warm)",
        border: "1px solid var(--cs-border-soft)",
        fontSize: 11,
      }}
    >
      <span style={{ fontWeight: 600, color: "var(--cs-text)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {appt.serviceName}
      </span>
      <span style={{ color: "var(--cs-text-muted)", flexShrink: 0 }}>
        <Clock size={10} style={{ display: "inline", verticalAlign: "middle" }} />
        {" "}{appt.timeLabel}
      </span>
      {appt.roomName && (
        <span style={{ color: "var(--cs-text-muted)", flexShrink: 0, display: "flex", alignItems: "center", gap: 2 }}>
          <MapPin size={10} />
          {appt.roomName}
        </span>
      )}
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          padding: "1px 6px",
          borderRadius: 100,
          backgroundColor: `${statusColor}18`,
          color: statusColor,
          flexShrink: 0,
        }}
      >
        {appt.status === "completed" ? "Done" : appt.status === "in_progress" ? "Active" : "Soon"}
      </span>
    </div>
  );
}

function DayCard({ day }: { day: StaffWeekDay }) {
  const status = getDayStatus(day);
  const { label, bg, color, border } = STATUS_DISPLAY[status];
  const times = parseWorkHours(day.workHoursLabel);

  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 14,
        border: "1px solid var(--cs-border-soft)",
        padding: "0.875rem 1rem",
        boxShadow: "var(--cs-shadow-xs)",
      }}
    >
      {/* Day header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: day.isToday ? "var(--cs-staff-accent)" : "var(--cs-text-muted)" }}>
            {day.dayNameShort}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: day.isToday ? "var(--cs-staff-accent)" : "var(--cs-text)", lineHeight: 1.1 }}>
            {day.dayOfMonth}
          </div>
          {day.isToday && (
            <div style={{ fontSize: 9, fontWeight: 700, color: "var(--cs-staff-accent)", letterSpacing: "0.05em" }}>TODAY</div>
          )}
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", backgroundColor: bg, color, border: `1px solid ${border}`, borderRadius: 100, padding: "2px 9px", fontSize: 10, fontWeight: 700 }}>
          {label}
        </span>
      </div>

      {/* Shift time */}
      {status === "on_duty" && times ? (
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)", fontVariantNumeric: "tabular-nums", marginBottom: "0.5rem" }}>
          {formatTime(times.start)} – {formatTime(times.end)}
        </div>
      ) : status !== "on_duty" ? (
        <div style={{ fontSize: 12, color: "var(--cs-text-muted)", marginBottom: "0.5rem" }}>
          No scheduled shift
        </div>
      ) : null}

      {/* Service appointments */}
      {day.appointments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {day.appointments.map((appt) => (
            <AppointmentChip key={appt.id} appt={appt} />
          ))}
        </div>
      )}
    </div>
  );
}

function matchesFilter(day: StaffWeekDay, filter: FilterKey): boolean {
  const status = getDayStatus(day);
  switch (filter) {
    case "on_duty": return status === "on_duty";
    case "day_off": return status === "day_off";
    case "booked": return day.appointmentCount > 0;
    case "blocked": return false;
    default: return true;
  }
}

const NAV_BTN: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 10,
  border: "1px solid var(--cs-border)",
  backgroundColor: "var(--cs-surface-warm)",
  color: "var(--cs-text-muted)",
  display: "flex", alignItems: "center", justifyContent: "center",
  textDecoration: "none", flexShrink: 0,
};

type TherapistScheduleListProps = {
  nav: StaffWeekNavigation;
  days: StaffWeekDay[];
};

export function TherapistScheduleList({ nav, days }: TherapistScheduleListProps) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const rangeLabel = formatWeekRange(nav.fromDate, nav.toDate);
  const prevHref = `/staff-portal/schedule?weekStart=${nav.previousWeekStart}`;
  const nextHref = `/staff-portal/schedule?weekStart=${nav.nextWeekStart}`;
  const filteredDays = days.filter((d) => matchesFilter(d, filter));

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "var(--cs-bg)", paddingBottom: 96 }}>
      {/* Sticky header */}
      <div style={{ backgroundColor: "#fff", borderBottom: "1px solid var(--cs-border-soft)", padding: "0.875rem 1rem 0.625rem", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.625rem" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "var(--cs-text)" }}>My Schedule</h1>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--cs-text-muted)" }}>{rangeLabel}</p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Link href={prevHref} style={NAV_BTN} aria-label="Previous week"><ChevronLeft size={16} /></Link>
            <Link href={nextHref} style={NAV_BTN} aria-label="Next week"><ChevronRight size={16} /></Link>
          </div>
        </div>

        <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
          {FILTERS.map(({ key, label }) => {
            const isActive = filter === key;
            return (
              <button key={key} type="button" onClick={() => setFilter(key)} style={{
                padding: "0.3rem 0.75rem", borderRadius: 100,
                border: `1px solid ${isActive ? "var(--cs-staff-accent)" : "var(--cs-border)"}`,
                backgroundColor: isActive ? "var(--cs-staff-accent)" : "var(--cs-surface-warm)",
                color: isActive ? "#fff" : "var(--cs-text-muted)",
                fontSize: 12, fontWeight: isActive ? 700 : 500,
                cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
              }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "0.875rem 1rem", display: "flex", flexDirection: "column", gap: "0.625rem", maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
        {filteredDays.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--cs-text-muted)", fontSize: 13 }}>
            No days match the selected filter.
          </div>
        ) : (
          filteredDays.map((day) => <DayCard key={day.date} day={day} />)
        )}
      </div>

      <TherapistMobileBottomNav />
    </div>
  );
}
