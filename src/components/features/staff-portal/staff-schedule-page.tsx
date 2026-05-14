"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  LayoutDashboard,
  TrendingUp,
  User,
} from "lucide-react";
import type { StaffWeekDay, StaffWeekSummary, StaffWeekNavigation } from "@/lib/staff-portal/week";
import { formatWeekRange, formatHours } from "@/lib/staff-portal/week";
import type { StaffScheduleEvent } from "@/lib/staff-portal/schedule";
import type { Database } from "@/types/supabase";
import styles from "./staff-schedule-page.module.css";

type BlockedTimeRow = Database["public"]["Tables"]["blocked_times"]["Row"];

type FilterKey = "all" | "booked" | "blocked" | "day_off" | "on_duty";

const FILTER_LABELS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "on_duty", label: "On Duty" },
  { key: "day_off", label: "Day Off" },
  { key: "booked", label: "Booked" },
  { key: "blocked", label: "Blocked" },
];

// ── Grid constants ────────────────────────────────────────────────────────────
const GRID_START = 7;  // 7 AM
const GRID_END = 22;   // 10 PM
const HOUR_HEIGHT = 60; // px per hour
const GRID_HOURS = Array.from({ length: GRID_END - GRID_START }, (_, i) => GRID_START + i);
const TOTAL_HEIGHT = GRID_HOURS.length * HOUR_HEIGHT;

function timeToMinutes(time: string): number {
  const [h = "0", m = "0"] = time.split(":");
  return Number(h) * 60 + Number(m);
}

function formatTimeShort(time: string): string {
  const [h = "0", m = "0"] = time.split(":");
  const hour = Number(h);
  const min = m.padStart(2, "0");
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return min === "00" ? `${displayHour}${suffix}` : `${displayHour}:${min}${suffix}`;
}

function formatHourLabel(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}${suffix}`;
}

// ── Grid event block ──────────────────────────────────────────────────────────
function GridEvent({ event }: { event: StaffScheduleEvent }) {
  const startMin = timeToMinutes(event.startTime) - GRID_START * 60;
  const top = (startMin / 60) * HOUR_HEIGHT;
  const height = Math.max((event.durationMinutes / 60) * HOUR_HEIGHT, 18);
  const isShort = height < 36;

  let className = `${styles.gridEvent} `;
  if (event.type === "blocked") {
    className += styles.gridEventBlocked;
  } else if (event.isHomeService) {
    className += styles.gridEventBookingHome;
  } else {
    className += styles.gridEventBooking;
  }

  return (
    <div
      className={className}
      style={{ top, height }}
      title={`${event.title}${event.subtitle ? ` · ${event.subtitle}` : ""} (${formatTimeShort(event.startTime)})`}
    >
      <div className={styles.gridEventTitle}>{event.title}</div>
      {!isShort && event.subtitle && (
        <div className={styles.gridEventSub}>{event.subtitle}</div>
      )}
    </div>
  );
}

// ── Day column in the week grid ───────────────────────────────────────────────
function GridDayCol({
  day,
  events,
  filter,
}: {
  day: StaffWeekDay;
  events: StaffScheduleEvent[];
  filter: FilterKey;
}) {
  const visibleEvents = events.filter((e) => {
    if (filter === "all") return true;
    if (filter === "booked") return e.type === "booking";
    if (filter === "blocked") return e.type === "blocked";
    return true;
  });

  const isOff = day.isDayOff || (filter === "day_off" && !day.isDayOff && visibleEvents.length === 0);
  const showOff = day.isDayOff || (filter === "on_duty" && day.isDayOff);

  return (
    <div
      className={`${styles.gridDayCol}${showOff ? ` ${styles.gridDayColOff}` : ""}`}
      style={{ height: TOTAL_HEIGHT }}
    >
      {GRID_HOURS.map((h, i) => (
        <div
          key={h}
          className={styles.gridHourLine}
          style={{ top: i * HOUR_HEIGHT }}
        />
      ))}
      {!isOff &&
        visibleEvents.map((evt) => <GridEvent key={evt.id} event={evt} />)}
    </div>
  );
}

// ── Week grid ─────────────────────────────────────────────────────────────────
function WeekGrid({
  days,
  eventsByDate,
  filter,
}: {
  days: StaffWeekDay[];
  eventsByDate: Record<string, StaffScheduleEvent[]>;
  filter: FilterKey;
}) {
  return (
    <div className={styles.gridCard}>
      <div className={styles.gridScrollOuter}>
        <div className={styles.gridScrollInner}>
          {/* Day headers */}
          <div className={styles.gridDayHeaders}>
            <div className={styles.gridAxisHeader} />
            {days.map((day) => (
              <div key={day.date} className={styles.gridDayHeader}>
                <p className={styles.gridDayName}>{day.dayNameShort}</p>
                <p className={`${styles.gridDayNum}${day.isToday ? ` ${styles.gridDayNumToday}` : ""}`}>
                  {day.dayNumber}
                </p>
                {day.isToday && <div className={styles.gridTodayDot} />}
              </div>
            ))}
          </div>

          {/* Time axis + day columns */}
          <div className={styles.gridBody}>
            {/* Time axis */}
            <div className={styles.gridAxisCol} style={{ height: TOTAL_HEIGHT }}>
              {GRID_HOURS.map((h) => (
                <div key={h} className={styles.gridHourLabel}>
                  {formatHourLabel(h)}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day) => (
              <GridDayCol
                key={day.date}
                day={day}
                events={eventsByDate[day.date] ?? []}
                filter={filter}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Right rail ────────────────────────────────────────────────────────────────
function RightRail({ days, summary }: { days: StaffWeekDay[]; summary: StaffWeekSummary }) {
  const daysOff = days.filter((d) => d.isDayOff).length;
  const workingDays = days.filter((d) => !d.isDayOff).length;

  return (
    <div className={styles.rightRail}>
      {/* Week summary */}
      <div className={styles.railCard}>
        <p className={styles.railCardTitle}>This Week</p>
        <div className={styles.railRow}>
          <span className={styles.railRowLabel}>Appointments</span>
          <span className={styles.railRowValue}>{summary.totalAppointments}</span>
        </div>
        <div className={styles.railRow}>
          <span className={styles.railRowLabel}>Booked hours</span>
          <span className={styles.railRowValue}>{formatHours(summary.hoursBooked)}</span>
        </div>
        <div className={styles.railRow}>
          <span className={styles.railRowLabel}>Upcoming</span>
          <span className={styles.railRowValue}>{summary.upcoming}</span>
        </div>
      </div>

      {/* Schedule */}
      <div className={styles.railCard}>
        <p className={styles.railCardTitle}>Schedule</p>
        <div className={styles.railRow}>
          <span className={styles.railRowLabel}>Working days</span>
          <span className={styles.railRowValue}>{workingDays}</span>
        </div>
        <div className={styles.railRow}>
          <span className={styles.railRowLabel}>Days off</span>
          <span className={styles.railRowValue}>{daysOff}</span>
        </div>
      </div>

      {/* Types */}
      <div className={styles.railCard}>
        <p className={styles.railCardTitle}>Booking types</p>
        <div className={styles.railRow}>
          <span className={styles.railRowLabel}>In-spa</span>
          <span className={styles.railRowValue}>{summary.inSpa}</span>
        </div>
        <div className={styles.railRow}>
          <span className={styles.railRowLabel}>Home service</span>
          <span className={styles.railRowValue}>{summary.homeService}</span>
        </div>
        <div className={styles.railRow}>
          <span className={styles.railRowLabel}>Walk-in</span>
          <span className={styles.railRowValue}>{summary.walkIn}</span>
        </div>
        <div className={styles.railRow}>
          <span className={styles.railRowLabel}>Online</span>
          <span className={styles.railRowValue}>{summary.online}</span>
        </div>
      </div>
    </div>
  );
}

// ── KPI row ───────────────────────────────────────────────────────────────────
function KpiRow({ days, summary }: { days: StaffWeekDay[]; summary: StaffWeekSummary }) {
  const daysOff = days.filter((d) => d.isDayOff).length;
  const workingDays = days.filter((d) => !d.isDayOff).length;

  const kpis = [
    { label: "Total Appts", value: String(summary.totalAppointments) },
    { label: "Booked Hours", value: formatHours(summary.hoursBooked) },
    { label: "Working Days", value: String(workingDays) },
    { label: "Days Off", value: String(daysOff) },
    { label: "Upcoming", value: String(summary.upcoming) },
  ];

  return (
    <div className={styles.kpiRow}>
      {kpis.map((kpi) => (
        <div key={kpi.label} className={styles.kpiCard}>
          <p className={styles.kpiLabel}>{kpi.label}</p>
          <p className={styles.kpiValue}>{kpi.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Mobile agenda ─────────────────────────────────────────────────────────────
function AgendaEvent({ event }: { event: StaffScheduleEvent }) {
  let cardClass = `${styles.agendaEventCard} `;
  if (event.type === "blocked") {
    cardClass += styles.agendaEventCardBlocked;
  } else if (event.isHomeService) {
    cardClass += styles.agendaEventCardBookingHome;
  } else {
    cardClass += styles.agendaEventCardBooking;
  }

  return (
    <div className={cardClass}>
      <span className={styles.agendaEventTime}>{formatTimeShort(event.startTime)}</span>
      <div className={styles.agendaEventBody}>
        <p className={styles.agendaEventTitle}>{event.title}</p>
        {event.subtitle && <p className={styles.agendaEventSub}>{event.subtitle}</p>}
        <p className={styles.agendaEventDuration}>{event.durationMinutes} min</p>
      </div>
    </div>
  );
}

function MobileAgenda({
  days,
  eventsByDate,
  filter,
}: {
  days: StaffWeekDay[];
  eventsByDate: Record<string, StaffScheduleEvent[]>;
  filter: FilterKey;
}) {
  const activeDays = days.filter((day) => {
    if (filter === "day_off") return day.isDayOff;
    if (filter === "on_duty") return !day.isDayOff;
    return true;
  });

  return (
    <div className={styles.mobileAgenda}>
      {activeDays.map((day) => {
        const allEvents = eventsByDate[day.date] ?? [];
        const events = allEvents.filter((e) => {
          if (filter === "booked") return e.type === "booking";
          if (filter === "blocked") return e.type === "blocked";
          return true;
        });

        if (filter === "day_off" && !day.isDayOff) return null;
        if (filter === "booked" && events.length === 0) return null;
        if (filter === "blocked" && events.length === 0) return null;

        return (
          <div key={day.date} className={styles.agendaSection}>
            <div className={styles.agendaDateHeader}>
              <span className={styles.agendaDateLabel}>
                {day.dayNameFull}, {day.dayNameShort} {day.dayNumber}
              </span>
              {day.isToday && <span className={styles.agendaTodayBadge}>Today</span>}
            </div>

            {day.isDayOff ? (
              <div className={styles.agendaEmpty}>Day off</div>
            ) : events.length === 0 ? (
              <div className={styles.agendaEmpty}>No events</div>
            ) : (
              events.map((evt) => <AgendaEvent key={evt.id} event={evt} />)
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Mobile bottom nav ─────────────────────────────────────────────────────────
function MobileBottomNav() {
  return (
    <nav className={styles.mobileBottomNav}>
      <Link href="/staff-portal" className={styles.mobileNavItem}>
        <LayoutDashboard size={20} />
        Today
      </Link>
      <Link href="/staff-portal/schedule" className={`${styles.mobileNavItem} ${styles.mobileNavItemActive}`}>
        <CalendarDays size={20} />
        Schedule
      </Link>
      <Link href="/staff-portal/stats" className={styles.mobileNavItem}>
        <TrendingUp size={20} />
        Stats
      </Link>
      <Link href="/staff-portal/profile" className={styles.mobileNavItem}>
        <User size={20} />
        Profile
      </Link>
    </nav>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
type StaffSchedulePageProps = {
  nav: StaffWeekNavigation;
  days: StaffWeekDay[];
  summary: StaffWeekSummary;
  eventsByDate: Record<string, StaffScheduleEvent[]>;
  rawBlocks: BlockedTimeRow[];
};

export function StaffSchedulePage({
  nav,
  days,
  summary,
  eventsByDate,
}: StaffSchedulePageProps) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const rangeLabel = formatWeekRange(nav.fromDate, nav.toDate);
  const prevHref = `/staff-portal/schedule?weekStart=${nav.previousWeekStart}`;
  const nextHref = `/staff-portal/schedule?weekStart=${nav.nextWeekStart}`;
  const todayHref = `/staff-portal/schedule?weekStart=${nav.currentWeekStart}`;

  return (
    <div className={styles.wrapper}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleGroup}>
            <div className={styles.titleIcon}>
              <CalendarDays size={14} />
            </div>
            <div>
              <h1 className={styles.title}>My Schedule</h1>
              <p className={styles.weekRange}>{rangeLabel}</p>
            </div>
          </div>

          <div className={styles.headerNav}>
            <Link href={prevHref} className={styles.navBtn} aria-label="Previous week">
              <ChevronLeft size={16} />
            </Link>
            {!nav.isCurrentWeek && (
              <Link href={todayHref} className={`${styles.navBtn} ${styles.todayBtn}`}>
                Today
              </Link>
            )}
            <Link href={nextHref} className={styles.navBtn} aria-label="Next week">
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>

        {/* Filter pills */}
        <div className={styles.filterRow}>
          {FILTER_LABELS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`${styles.filterPill}${filter === key ? ` ${styles.filterPillActive}` : ""}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <KpiRow days={days} summary={summary} />

      {/* Desktop: week grid + right rail */}
      <div className={styles.desktopBody}>
        <div className={styles.desktopGrid}>
          <WeekGrid days={days} eventsByDate={eventsByDate} filter={filter} />
        </div>
        <RightRail days={days} summary={summary} />
      </div>

      {/* Mobile: agenda list */}
      <MobileAgenda days={days} eventsByDate={eventsByDate} filter={filter} />

      {/* Mobile bottom nav */}
      <MobileBottomNav />
    </div>
  );
}
