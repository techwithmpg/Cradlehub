"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import {
  readRelation,
  formatTime12,
  type TodayBooking,
} from "./manager-today-utils";

export function UpcomingBookings({
  bookings,
}: {
  bookings: TodayBooking[];
}) {
  const active = bookings
    .filter((b) => b.status !== "cancelled" && b.status !== "no_show")
    .sort(
      (a, b) =>
        a.start_time.localeCompare(b.start_time)
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
          <CalendarClock size={16} style={{ color: "var(--cs-sand)" }} />
          <div
            style={{
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: "var(--cs-text)",
              fontFamily: "var(--font-display)",
            }}
          >
            Upcoming Bookings
          </div>
        </div>
        <Link
          href="/manager/bookings"
          style={{
            fontSize: "0.75rem",
            color: "var(--cs-sand)",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          View All →
        </Link>
      </div>

      {active.length === 0 ? (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "var(--cs-text-muted)",
            fontSize: "0.875rem",
          }}
        >
          No bookings scheduled for today.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {active.slice(0, 8).map((booking) => {
            const customer = readRelation(booking.customers);
            const service = readRelation(booking.services);
            const resource = booking.branch_resources;

            return (
              <div
                key={booking.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  padding: "0.5rem 0.625rem",
                  borderRadius: "var(--cs-r-sm)",
                  backgroundColor: "var(--cs-surface-warm)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "var(--cs-text)",
                    minWidth: 56,
                    flexShrink: 0,
                  }}
                >
                  {formatTime12(booking.start_time)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 500,
                      color: "var(--cs-text)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {customer?.full_name ?? "—"}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--cs-text-muted)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {service?.name ?? "Service"}
                    {resource && (
                      <span style={{ marginLeft: 4 }}>· {resource.name}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                  <BookingTypeBadge type={booking.type} />
                  <BookingStatusBadge status={booking.status} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
