"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { OpenAdministrativeBookingButton } from "@/components/features/bookings/administrative-booking-modal-provider";
import { BRANCH_TIMEZONE, getBranchTime, toLocalYmd } from "@/lib/engine/slot-time";
import { isToday as isScheduleToday } from "@/lib/utils/schedule-timeline";
import { cn } from "@/lib/utils";

export type ScheduleViewMode = "daily_timeline" | "full_schedule";

export function ScheduleWorkspaceHeader({
  branchName,
  date,
  initialNow,
  viewMode,
  onDateChange,
  onViewModeChange,
}: {
  branchName: string;
  date: string;
  initialNow: string;
  viewMode: ScheduleViewMode;
  onDateChange: (date: string) => void;
  onViewModeChange: (mode: ScheduleViewMode) => void;
}) {
  const dateObj = new Date(`${date}T00:00:00+08:00`);
  const now = new Date(initialNow);
  const dateLabel = dateObj.toLocaleDateString("en-PH", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: BRANCH_TIMEZONE,
  });
  const isToday = isScheduleToday(date, now);

  function shiftDate(days: number) {
    const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() + days);
    onDateChange(toLocalYmd(d));
  }

  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.2rem" }}>
          <h1
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "var(--cs-text)",
              margin: 0,
              lineHeight: 1.25,
              fontFamily: "var(--font-display)",
            }}
          >
            Schedule
          </h1>
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: "var(--cs-r-pill)",
              background: "var(--cs-sand-mist)",
              color: "var(--cs-sand)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            CRM
          </span>
        </div>
        <p
          style={{
            fontSize: "0.8125rem",
            color: "var(--cs-text-muted)",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Manage staff availability, bookings, and resources for today.
        </p>
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--cs-text-subtle)",
            margin: "0.125rem 0 0",
          }}
        >
          {branchName}
        </p>
        <div className="mt-3 inline-flex rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-1">
          {[
            { key: "daily_timeline" as const, label: "Daily Timeline" },
            { key: "full_schedule" as const, label: "Full Schedule + Live Bookings" },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onViewModeChange(option.key)}
              className={cn(
                "h-8 rounded-md px-3 text-xs font-bold transition-colors",
                viewMode === option.key
                  ? "bg-emerald-800 text-white"
                  : "text-[var(--cs-text-secondary)] hover:bg-[var(--cs-surface-warm)] hover:text-[var(--cs-text)]"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap sm:shrink-0">
        {/* Date navigator */}
        <div
          className="min-w-0 flex-1 sm:flex-none"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 10px",
            borderRadius: "var(--cs-r-md)",
            background: "var(--cs-surface)",
            border: "1px solid var(--cs-border-soft)",
          }}
        >
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              borderRadius: "var(--cs-r-sm)",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--cs-text-muted)",
            }}
          >
            <ChevronLeft size={14} />
          </button>
          <span
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--cs-text)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minWidth: 0,
              justifyContent: "center",
            }}
          >
            <CalendarDays size={14} style={{ color: "var(--cs-sand)" }} />
            {dateLabel}
          </span>
          <button
            type="button"
            onClick={() => shiftDate(1)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              borderRadius: "var(--cs-r-sm)",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--cs-text-muted)",
            }}
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {!isToday && (
          <button
            type="button"
            onClick={() => onDateChange(getBranchTime(now, BRANCH_TIMEZONE).ymd)}
            style={{
              padding: "6px 12px",
              fontSize: "0.75rem",
              fontWeight: 600,
              borderRadius: "var(--cs-r-md)",
              border: "1px solid var(--cs-border-soft)",
              background: "var(--cs-surface-warm)",
              color: "var(--cs-text-secondary)",
              cursor: "pointer",
            }}
          >
            Today
          </button>
        )}

        <OpenAdministrativeBookingButton
          mode="standard_future"
          date={date}
          label="+ New Booking"
          showIcon={false}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            borderRadius: "var(--cs-r-md)",
            backgroundColor: "var(--cs-sand)",
            color: "#fff",
            fontSize: "0.8125rem",
            fontWeight: 600,
            textDecoration: "none",
            transition: "opacity 150ms ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "0.9";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "1";
          }}
        />
      </div>
    </div>
  );
}
