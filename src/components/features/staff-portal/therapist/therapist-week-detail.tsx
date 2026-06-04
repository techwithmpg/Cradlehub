"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { formatWeekRange } from "@/lib/staff-portal/week";
import type { StaffWeekDay } from "@/lib/staff-portal/week";

type ScheduleEntry = { day_of_week: number; shift_type: string | null };

type TherapistWeekDetailProps = {
  days: StaffWeekDay[];
  schedule: ScheduleEntry[];
  fromDate: string;
  toDate: string;
  previousWeekStart: string;
  nextWeekStart: string;
};

type DayStatus = "on_duty" | "day_off" | "no_shift";

function getDayStatus(day: StaffWeekDay): DayStatus {
  if (day.isDayOff) return "day_off";
  if (day.workHoursLabel !== null) return "on_duty";
  return "no_shift";
}

function getShiftTypeLabel(t: string | null | undefined): string {
  if (t === "opening") return "Opening Shift";
  if (t === "closing") return "Closing Shift";
  return "Regular Shift";
}

function parseWorkHours(label: string | null): { start: string; end: string } | null {
  if (!label || label === "Day off") return null;
  const parts = label.split(" — ");
  return parts.length === 2 ? { start: parts[0] ?? "", end: parts[1] ?? "" } : null;
}

const STATUS_CONFIG: Record<DayStatus, { label: string; bg: string; color: string; border: string }> = {
  on_duty: { label: "On Duty", bg: "var(--cs-success-bg)", color: "var(--cs-success)", border: "rgba(90,138,106,0.2)" },
  day_off: { label: "Day Off", bg: "rgba(251,191,36,0.12)", color: "#92700A", border: "rgba(146,112,10,0.2)" },
  no_shift: { label: "No Shift", bg: "var(--cs-surface-warm)", color: "var(--cs-text-muted)", border: "var(--cs-border-soft)" },
};

function DayPicker({ days, selectedDate, onSelect }: { days: StaffWeekDay[]; selectedDate: string; onSelect: (d: string) => void }) {
  return (
    <div style={{ display: "flex", overflowX: "auto", gap: 6, padding: "0.75rem 1rem", backgroundColor: "#fff", borderBottom: "1px solid var(--cs-border-soft)", scrollbarWidth: "none" }}>
      {days.map((day) => {
        const isSelected = day.date === selectedDate;
        const status = getDayStatus(day);
        return (
          <button key={day.date} type="button" onClick={() => onSelect(day.date)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              padding: "0.4rem 0.625rem", borderRadius: 12, border: "none", cursor: "pointer",
              backgroundColor: isSelected ? "var(--cs-staff-accent)" : "transparent",
              color: isSelected ? "#fff" : "var(--cs-text-muted)",
              flexShrink: 0, minWidth: 44, minHeight: 56,
            }}
            aria-pressed={isSelected}
          >
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", opacity: isSelected ? 0.85 : 1 }}>
              {day.dayNameShort}
            </span>
            <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1 }}>{day.dayOfMonth}</span>
            <div style={{ width: 5, height: 5, borderRadius: "50%",
              backgroundColor: isSelected ? "rgba(255,255,255,0.7)" : status === "on_duty" ? "var(--cs-success)" : status === "day_off" ? "#92700A" : "transparent" }} />
          </button>
        );
      })}
    </div>
  );
}

function TimelineRow({ time, label, accent = false, badge }: { time: string; label: string; accent?: boolean; badge?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cs-text-muted)", width: 70, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{time}</div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 14, flexShrink: 0 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: accent ? "var(--cs-staff-accent)" : "rgba(139,92,246,0.5)", border: "2px solid #fff", boxShadow: `0 0 0 1.5px ${accent ? "var(--cs-staff-accent)" : "rgba(139,92,246,0.5)"}` }} />
      </div>
      <div style={{ fontSize: 13, color: "var(--cs-text)", fontWeight: accent ? 600 : 500, flex: 1, minWidth: 0 }}>
        {label}
        {badge && (
          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 100, backgroundColor: "rgba(139,92,246,0.1)", color: "#7C3AED" }}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

export function TherapistWeekDetail({ days, schedule, fromDate, toDate, previousWeekStart, nextWeekStart }: TherapistWeekDetailProps) {
  const defaultDay = days.find((d) => d.isToday)?.date ?? days[0]?.date ?? "";
  const [selectedDate, setSelectedDate] = useState(defaultDay);
  const selectedDay = days.find((d) => d.date === selectedDate) ?? days[0];
  const rangeLabel = formatWeekRange(fromDate, toDate);
  const prevHref = `/staff-portal/week?weekStart=${previousWeekStart}`;
  const nextHref = `/staff-portal/week?weekStart=${nextWeekStart}`;

  const schedByDow: Record<number, string | null> = {};
  for (const row of schedule) schedByDow[row.day_of_week] = row.shift_type ?? null;

  const status = selectedDay ? getDayStatus(selectedDay) : "no_shift";
  const { label: statusLabel, bg, color, border } = STATUS_CONFIG[status];
  const times = selectedDay ? parseWorkHours(selectedDay.workHoursLabel) : null;
  const shiftType = selectedDay ? (schedByDow[selectedDay.dayOfWeek] ?? null) : null;

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "var(--cs-bg)" }}>
      {/* Header */}
      <div style={{ backgroundColor: "#fff", borderBottom: "1px solid var(--cs-border-soft)", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.875rem 1rem 0.5rem" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "var(--cs-text)" }}>My Week</h1>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--cs-text-muted)" }}>{rangeLabel}</p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Link href={prevHref} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid var(--cs-border)", backgroundColor: "var(--cs-surface-warm)", color: "var(--cs-text-muted)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }} aria-label="Previous week"><ChevronLeft size={16} /></Link>
            <Link href={nextHref} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid var(--cs-border)", backgroundColor: "var(--cs-surface-warm)", color: "var(--cs-text-muted)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }} aria-label="Next week"><ChevronRight size={16} /></Link>
          </div>
        </div>
        {days.length > 0 && <DayPicker days={days} selectedDate={selectedDate} onSelect={setSelectedDate} />}
      </div>

      {/* Selected day detail */}
      <div style={{ padding: "0.875rem 1rem", display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
        {selectedDay && (
          <>
            {/* Day detail card */}
            <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1px solid var(--cs-border-soft)", padding: "1rem 1.125rem", boxShadow: "var(--cs-shadow-xs)", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--cs-text)" }}>
                  {selectedDay.dayNameFull}, {selectedDay.dayNameShort} {selectedDay.dayOfMonth}
                  {selectedDay.isToday && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "var(--cs-staff-accent)" }}>Today</span>}
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", backgroundColor: bg, color, border: `1px solid ${border}`, borderRadius: 100, padding: "2px 9px", fontSize: 10, fontWeight: 700 }}>
                  {statusLabel}
                </span>
              </div>
              {status === "on_duty" && times && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Clock size={14} color="var(--cs-staff-accent)" />
                    <span style={{ fontSize: 16, fontWeight: 700, color: "var(--cs-text)", fontVariantNumeric: "tabular-nums" }}>
                      {formatTime(times.start)} – {formatTime(times.end)}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--cs-text-secondary)", paddingLeft: 20 }}>
                    {getShiftTypeLabel(shiftType)}
                  </div>
                </>
              )}
              {status !== "on_duty" && (
                <div style={{ fontSize: 13, color: "var(--cs-text-muted)" }}>
                  {status === "day_off" ? "No scheduled shift — day off." : "No shift scheduled for this day."}
                </div>
              )}
            </div>

            {/* Timeline */}
            {status === "on_duty" && times && (
              <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1px solid var(--cs-border-soft)", padding: "1rem 1.125rem", boxShadow: "var(--cs-shadow-xs)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--cs-text-muted)", marginBottom: "0.875rem" }}>
                  {"Today's Timeline"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <TimelineRow time={formatTime(times.start)} label="Shift Start" accent />
                  {selectedDay.appointments.map((appt) => (
                    <TimelineRow
                      key={appt.id}
                      time={appt.timeLabel}
                      label={appt.serviceName}
                      badge={appt.status === "in_progress" ? "In Progress" : appt.status === "completed" ? "Done" : undefined}
                    />
                  ))}
                  <TimelineRow time={formatTime(times.end)} label="Shift End" accent />
                </div>
              </div>
            )}

            {/* Notes */}
            <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1px solid var(--cs-border-soft)", padding: "1rem 1.125rem", boxShadow: "var(--cs-shadow-xs)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--cs-text-muted)", marginBottom: "0.5rem" }}>Notes</div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--cs-text-muted)", lineHeight: 1.5 }}>No notes for today.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
