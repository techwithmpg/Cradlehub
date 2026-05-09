"use client";

import { AlertTriangle } from "lucide-react";
import { formatDayCard } from "./schedule-week-utils";
import type { DailyScheduleBooking } from "@/lib/queries/schedule";

type ScheduleWeekDayCardProps = {
  date: string;
  isSelected: boolean;
  isLoaded: boolean; // true if this date matches the server-provided date
  bookingCount: number;
  staffCount: number;
  alertCount: number;
  previewBookings: DailyScheduleBooking[];
  onClick: () => void;
};

export function ScheduleWeekDayCard({
  date,
  isSelected,
  isLoaded,
  bookingCount,
  staffCount,
  alertCount,
  previewBookings,
  onClick,
}: ScheduleWeekDayCardProps) {
  const { dayName, dateLabel } = formatDayCard(date);
  const hasAlerts = alertCount > 0;
  const isEmpty = isLoaded && bookingCount === 0;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        padding: "0.75rem",
        borderRadius: 10,
        border: isSelected ? "2px solid var(--cs-sand)" : "1px solid var(--cs-border)",
        backgroundColor: isSelected ? "var(--cs-surface)" : "var(--cs-bg)",
        cursor: "pointer",
        textAlign: "left",
        minWidth: 0,
        transition: "all 120ms ease",
        opacity: isLoaded ? 1 : 0.7,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = "var(--cs-border-soft)";
          e.currentTarget.style.backgroundColor = "var(--cs-surface)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = "var(--cs-border)";
          e.currentTarget.style.backgroundColor = "var(--cs-bg)";
        }
      }}
      aria-pressed={isSelected}
    >
      {/* Day header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--cs-text-muted)",
            }}
          >
            {dayName}
          </div>
          <div
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--cs-text)",
              marginTop: 2,
            }}
          >
            {dateLabel}
          </div>
        </div>
        {hasAlerts && (
          <div
            title={`${alertCount} alert${alertCount === 1 ? "" : "s"}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              backgroundColor: "#FEF2F2",
              color: "#DC2626",
              fontSize: "0.625rem",
              fontWeight: 700,
              padding: "2px 6px",
              borderRadius: 100,
            }}
          >
            <AlertTriangle size={10} />
            {alertCount}
          </div>
        )}
      </div>

      {/* Metrics */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <MetricRow
          label="Bookings"
          value={isLoaded ? String(bookingCount) : "—"}
          muted={!isLoaded || bookingCount === 0}
        />
        <MetricRow
          label="Staff"
          value={isLoaded ? String(staffCount) : "—"}
          muted={!isLoaded || staffCount === 0}
        />
      </div>

      {/* Preview list */}
      {isLoaded && previewBookings.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 2 }}>
          {previewBookings.map((b) => (
            <div
              key={b.id}
              style={{
                fontSize: "0.6875rem",
                color: "var(--cs-text)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: 1.3,
              }}
            >
              <span style={{ color: "var(--cs-text-muted)", fontWeight: 500 }}>
                {b.start_time.slice(0, 5)}
              </span>{" "}
              {b.service}
            </div>
          ))}
          {bookingCount > previewBookings.length && (
            <div
              style={{
                fontSize: "0.625rem",
                color: "var(--cs-text-muted)",
                fontStyle: "italic",
              }}
            >
              + {bookingCount - previewBookings.length} more
            </div>
          )}
        </div>
      ) : isEmpty ? (
        <div
          style={{
            fontSize: "0.6875rem",
            color: "var(--cs-text-muted)",
            fontStyle: "italic",
            marginTop: 2,
          }}
        >
          No bookings
        </div>
      ) : null}
    </button>
  );
}

function MetricRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span
        style={{
          fontSize: "0.625rem",
          color: "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: muted ? "var(--cs-text-muted)" : "var(--cs-text)",
        }}
      >
        {value}
      </span>
    </div>
  );
}
