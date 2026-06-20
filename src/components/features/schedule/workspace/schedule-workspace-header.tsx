"use client";

import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

export function ScheduleWorkspaceHeader({
  branchName,
  date,
  onDateChange,
}: {
  branchName: string;
  date: string;
  onDateChange: (date: string) => void;
}) {
  const dateObj = new Date(date + "T00:00:00");
  const dateLabel = dateObj.toLocaleDateString("en-PH", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const isToday = date === new Date().toISOString().split("T")[0];

  function shiftDate(days: number) {
    const d = new Date(dateObj);
    d.setDate(d.getDate() + days);
    onDateChange(d.toISOString().split("T")[0]!);
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
            onClick={() => onDateChange(new Date().toISOString().split("T")[0]!)}
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

        <Link
          href="/crm/bookings/new"
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
        >
          + New Booking
        </Link>
      </div>
    </div>
  );
}
