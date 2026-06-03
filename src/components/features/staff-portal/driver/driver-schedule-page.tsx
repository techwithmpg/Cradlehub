"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Route } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { formatWeekRange, type StaffWeekDay, type StaffWeekNavigation } from "@/lib/staff-portal/week";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

type FilterKey = "all" | "on_duty" | "trips" | "completed" | "day_off";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "on_duty", label: "On Duty" },
  { key: "trips", label: "Trips" },
  { key: "completed", label: "Completed" },
  { key: "day_off", label: "Day Off" },
];

type DriverSchedulePageProps = {
  nav: StaffWeekNavigation;
  days: StaffWeekDay[];
  jobs: RealDispatchItem[];
};

function jobsForDate(jobs: RealDispatchItem[], date: string): RealDispatchItem[] {
  return jobs
    .filter((job) => job.bookingDate === date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

function matchesFilter(day: StaffWeekDay, jobs: RealDispatchItem[], filter: FilterKey): boolean {
  const dayJobs = jobsForDate(jobs, day.date);
  if (filter === "on_duty") return !day.isDayOff && day.workHoursLabel !== null;
  if (filter === "trips") return dayJobs.length > 0;
  if (filter === "completed") return dayJobs.some((job) => job.dispatchStatus === "completed");
  if (filter === "day_off") return day.isDayOff;
  return true;
}

function DayCard({ day, jobs }: { day: StaffWeekDay; jobs: RealDispatchItem[] }) {
  const dayJobs = jobsForDate(jobs, day.date);
  const completed = dayJobs.filter((job) => job.dispatchStatus === "completed").length;
  const nextTrip = dayJobs.find((job) => !["completed", "cancelled"].includes(job.dispatchStatus));
  const dutyLabel = day.isDayOff ? "Day Off" : day.workHoursLabel ? "On Duty" : "No Shift";
  const dutyColor = day.isDayOff ? "#92700A" : day.workHoursLabel ? "var(--cs-success)" : "var(--cs-text-muted)";
  const dutyBg = day.isDayOff ? "rgba(251,191,36,0.12)" : day.workHoursLabel ? "var(--cs-success-bg)" : "var(--cs-surface-warm)";

  return (
    <div style={{ backgroundColor: "#fff", border: "1px solid var(--cs-border-soft)", borderRadius: 16, boxShadow: "var(--cs-shadow-xs)", padding: "0.95rem 1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
        <div>
          <div style={{ color: day.isToday ? "var(--cs-staff-accent)" : "var(--cs-text-muted)", fontSize: 10, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase" }}>
            {day.dayNameShort}, {day.dayNumber}
          </div>
          <div style={{ color: "var(--cs-text)", fontSize: 17, fontWeight: 700, marginTop: 2 }}>
            {day.dayNameFull}
          </div>
        </div>
        <span style={{ alignSelf: "flex-start", backgroundColor: dutyBg, borderRadius: 999, color: dutyColor, fontSize: 10, fontWeight: 700, padding: "3px 9px", whiteSpace: "nowrap" }}>
          {dutyLabel}
        </span>
      </div>

      <div style={{ color: "var(--cs-text-secondary)", fontSize: 13, fontWeight: 600, marginTop: "0.65rem" }}>
        {dayJobs.length} assigned trip{dayJobs.length === 1 ? "" : "s"}
        {day.workHoursLabel ? <span style={{ color: "var(--cs-text-muted)", fontWeight: 500 }}> · {day.workHoursLabel}</span> : null}
      </div>

      {nextTrip ? (
        <Link href={`/staff-portal/jobs/${nextTrip.id}`} style={{ color: "inherit", display: "block", marginTop: "0.55rem", textDecoration: "none" }}>
          <div style={{ backgroundColor: "var(--cs-surface-warm)", border: "1px solid var(--cs-border-soft)", borderRadius: 12, padding: "0.65rem 0.75rem" }}>
            <div style={{ color: "var(--cs-text)", fontSize: 13, fontWeight: 700 }}>
              Next: {formatTime(nextTrip.startTime)} · {nextTrip.customerName}
            </div>
            <div style={{ alignItems: "center", color: "var(--cs-text-muted)", display: "flex", fontSize: 12, gap: 5, marginTop: 4 }}>
              <MapPin size={12} />
              <span>{nextTrip.area ?? nextTrip.formattedAddress ?? "Location pending"}</span>
            </div>
          </div>
        </Link>
      ) : (
        <div style={{ color: "var(--cs-text-muted)", fontSize: 12.5, marginTop: "0.55rem" }}>
          {dayJobs.length === 0 ? "No driver trips assigned" : "All trips completed for this day"}
        </div>
      )}

      {dayJobs.length > 0 ? (
        <div style={{ alignItems: "center", color: "var(--cs-text-muted)", display: "flex", fontSize: 12, gap: 5, marginTop: "0.55rem" }}>
          <Route size={12} />
          <span>{completed} completed · {dayJobs.length - completed} remaining</span>
        </div>
      ) : null}
    </div>
  );
}

export function DriverSchedulePage({ nav, days, jobs }: DriverSchedulePageProps) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const rangeLabel = formatWeekRange(nav.fromDate, nav.toDate);
  const prevHref = `/staff-portal/schedule?weekStart=${nav.previousWeekStart}`;
  const nextHref = `/staff-portal/schedule?weekStart=${nav.nextWeekStart}`;
  const filteredDays = days.filter((day) => matchesFilter(day, jobs, filter));

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "var(--cs-bg)" }}>
      <div style={{ backgroundColor: "#fff", borderBottom: "1px solid var(--cs-border-soft)", padding: "0.875rem 1rem 0.625rem", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", marginBottom: "0.625rem" }}>
          <div>
            <h1 style={{ color: "var(--cs-text)", fontSize: 19, fontWeight: 700, margin: 0 }}>My Driver Schedule</h1>
            <p style={{ color: "var(--cs-text-muted)", fontSize: 12, margin: "2px 0 0" }}>{rangeLabel}</p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Link href={prevHref} style={navButtonStyle} aria-label="Previous week"><ChevronLeft size={16} /></Link>
            <Link href={nextHref} style={navButtonStyle} aria-label="Next week"><ChevronRight size={16} /></Link>
          </div>
        </div>

        <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
          {FILTERS.map(({ key, label }) => {
            const active = filter === key;
            return (
              <button key={key} type="button" onClick={() => setFilter(key)} style={{ backgroundColor: active ? "var(--cs-staff-accent)" : "var(--cs-surface-warm)", border: `1px solid ${active ? "var(--cs-staff-accent)" : "var(--cs-border)"}`, borderRadius: 999, color: active ? "#fff" : "var(--cs-text-muted)", cursor: "pointer", flexShrink: 0, fontSize: 12, fontWeight: active ? 700 : 500, padding: "0.3rem 0.75rem", whiteSpace: "nowrap" }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", margin: "0 auto", maxWidth: 480, padding: "0.875rem 1rem" }}>
        {filteredDays.length > 0 ? (
          filteredDays.map((day) => <DayCard key={day.date} day={day} jobs={jobs} />)
        ) : (
          <div style={{ color: "var(--cs-text-muted)", fontSize: 13, padding: "2rem 1rem", textAlign: "center" }}>
            No driver trips scheduled for this filter.
          </div>
        )}
      </div>
    </div>
  );
}

const navButtonStyle: CSSProperties = {
  alignItems: "center",
  backgroundColor: "var(--cs-surface-warm)",
  border: "1px solid var(--cs-border)",
  borderRadius: 10,
  color: "var(--cs-text-muted)",
  display: "flex",
  flexShrink: 0,
  height: 34,
  justifyContent: "center",
  textDecoration: "none",
  width: 34,
};
