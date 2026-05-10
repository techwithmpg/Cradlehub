"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { formatTime12, timeToMinutes, type TodayBooking } from "./manager-today-utils";

const OPEN_HOUR = 8;
const CLOSE_HOUR = 22;
const HOURS = Array.from({ length: CLOSE_HOUR - OPEN_HOUR + 1 }, (_, i) => OPEN_HOUR + i);

export function TodayTimelinePreview({
  bookings,
}: {
  bookings: TodayBooking[];
}) {
  const active = bookings.filter(
    (b) => b.status !== "cancelled" && b.status !== "no_show"
  );

  return (
    <div className="cs-card" style={{ padding: "1.25rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Clock size={16} style={{ color: "var(--cs-sand)" }} />
          <div
            style={{
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: "var(--cs-text)",
              fontFamily: "var(--font-display)",
            }}
          >
            Today at a Glance
          </div>
        </div>
        <Link
          href="/manager/schedule"
          style={{
            fontSize: "0.75rem",
            color: "var(--cs-sand)",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          View Full Schedule →
        </Link>
      </div>

      {/* Time axis */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: "0.75rem",
        }}
      >
        {HOURS.map((h) => (
          <div
            key={h}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: "0.6875rem",
              color: "var(--cs-text-muted)",
              fontWeight: 500,
            }}
          >
            {h > 12 ? h - 12 : h} {h >= 12 ? "PM" : "AM"}
          </div>
        ))}
      </div>

      {/* Booking blocks */}
      <div
        style={{
          position: "relative",
          height: 40,
          backgroundColor: "var(--cs-surface-warm)",
          borderRadius: "var(--cs-r-sm)",
          overflow: "hidden",
        }}
      >
        {active.map((booking) => {
          const startMins = timeToMinutes(booking.start_time);
          const endMins = timeToMinutes(booking.end_time);
          const dayStartMins = OPEN_HOUR * 60;
          const dayEndMins = CLOSE_HOUR * 60;
          const dayTotalMins = dayEndMins - dayStartMins;

          const left = Math.max(0, ((startMins - dayStartMins) / dayTotalMins) * 100);
          const width = Math.min(
            100 - left,
            ((endMins - startMins) / dayTotalMins) * 100
          );

          const color =
            booking.type === "home_service"
              ? "#D97706"
              : booking.type === "walkin"
              ? "var(--cs-sand)"
              : "#4A7C59";

          const customer =
            (booking.customers as { full_name: string } | { full_name: string }[] | null)
              ? Array.isArray(booking.customers)
                ? booking.customers[0]?.full_name
                : booking.customers?.full_name
              : null;

          return (
            <div
              key={booking.id}
              title={`${customer ?? "Guest"} · ${formatTime12(booking.start_time)} – ${formatTime12(booking.end_time)}`}
              style={{
                position: "absolute",
                left: `${left}%`,
                width: `${Math.max(width, 1.5)}%`,
                top: 8,
                height: 24,
                backgroundColor: color,
                borderRadius: 4,
                opacity: 0.85,
                cursor: "pointer",
                transition: "opacity 0.15s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.opacity = "0.85";
              }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          marginTop: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        {[
          { color: "#4A7C59", label: "In-house" },
          { color: "var(--cs-sand)", label: "Walk-in" },
          { color: "#D97706", label: "Home Service" },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.75rem",
              color: "var(--cs-text-muted)",
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                backgroundColor: item.color,
              }}
            />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
