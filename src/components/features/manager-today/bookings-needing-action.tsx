"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import { BookingActionMenu } from "@/components/features/dashboard/booking-action-menu";
import {
  getUrgencyScore,
  readRelation,
  formatTime12,
  type TodayBooking,
} from "./manager-today-utils";

export function BookingsNeedingAction({
  bookings,
  nowMins,
  userRole,
}: {
  bookings: TodayBooking[];
  nowMins: number;
  userRole: string;
}) {
  const active = bookings.filter(
    (b) => b.status !== "cancelled" && b.status !== "no_show"
  );

  const actionable = active
    .filter((b) => getUrgencyScore(b, nowMins) > 0)
    .sort((a, b) => getUrgencyScore(b, nowMins) - getUrgencyScore(a, nowMins));

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
          <AlertCircle size={16} style={{ color: "var(--cs-error)" }} />
          <div
            style={{
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: "var(--cs-text)",
              fontFamily: "var(--font-display)",
            }}
          >
            Bookings Needing Action
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

      {actionable.length === 0 ? (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "var(--cs-text-muted)",
            fontSize: "0.875rem",
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
          No bookings need action right now.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {actionable.slice(0, 6).map((booking) => {
            const customer = readRelation(booking.customers);
            const service = readRelation(booking.services);
            const staffMember = readRelation(booking.staff);
            const resource = booking.branch_resources;

            const issues: string[] = [];
            if (booking.status === "pending") issues.push("Pending");
            if (!booking.resource_id && booking.type !== "home_service")
              issues.push("No room");
            if (!staffMember) issues.push("No therapist");
            if (getUrgencyScore(booking, nowMins) === 70) issues.push("Starting soon");

            return (
              <div
                key={booking.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.625rem 0.875rem",
                  borderRadius: "var(--cs-r-sm)",
                  backgroundColor: "var(--cs-surface-warm)",
                  border: "1px solid var(--cs-border-soft)",
                }}
              >
                <div style={{ minWidth: 52, textAlign: "center", flexShrink: 0 }}>
                  <div
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      color: "var(--cs-text)",
                      lineHeight: 1,
                    }}
                  >
                    {formatTime12(booking.start_time)}
                  </div>
                  <div style={{ fontSize: "0.625rem", color: "var(--cs-text-muted)", marginTop: 2 }}>
                    {service?.duration_minutes ?? "—"} min
                  </div>
                </div>

                <div style={{ width: 3, alignSelf: "stretch", borderRadius: 2, backgroundColor: "var(--cs-border)", flexShrink: 0 }} />

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
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      flexWrap: "wrap",
                    }}
                  >
                    {service?.name ?? "Service"}
                    {resource && (
                      <span style={{ color: "var(--cs-sand)" }}>· {resource.name}</span>
                    )}
                    {!resource && booking.type !== "home_service" && (
                      <span style={{ color: "var(--cs-error)" }}>· No room</span>
                    )}
                  </div>
                  {issues.length > 0 && (
                    <div style={{ display: "flex", gap: 4, marginTop: 3, flexWrap: "wrap" }}>
                      {issues.map((issue) => (
                        <span
                          key={issue}
                          style={{
                            fontSize: "0.625rem",
                            fontWeight: 600,
                            padding: "1px 5px",
                            borderRadius: 3,
                            backgroundColor:
                              issue === "Pending"
                                ? "#FEF3C7"
                                : issue === "Starting soon"
                                ? "#EEF0F8"
                                : "#FEE2E2",
                            color:
                              issue === "Pending"
                                ? "#92400E"
                                : issue === "Starting soon"
                                ? "#1A2A5A"
                                : "#991B1B",
                            textTransform: "uppercase",
                          }}
                        >
                          {issue}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <BookingTypeBadge type={booking.type} />
                  <BookingStatusBadge status={booking.status} />
                  <BookingActionMenu
                    bookingId={booking.id}
                    currentStatus={booking.status}
                    userRole={userRole}
                    triggerVariant="icon"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
