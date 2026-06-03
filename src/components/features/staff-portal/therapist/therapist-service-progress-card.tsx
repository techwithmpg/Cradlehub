"use client";

import { MapPin, Home as HomeIcon, Clock } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { BookingProgressActions } from "@/components/features/staff-portal/booking-progress-actions";
import type { StaffPortalBooking } from "@/components/features/staff-portal/types";

function firstRelation<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type ProgressBadge = { label: string; bg: string; color: string };

function getProgressBadge(progressStatus: string, bookingStatus: string): ProgressBadge {
  if (bookingStatus === "no_show") {
    return { label: "No Show", bg: "rgba(239,68,68,0.08)", color: "#DC2626" };
  }
  switch (progressStatus) {
    case "session_started":
      return { label: "In Progress", bg: "rgba(139,92,246,0.1)", color: "#7C3AED" };
    case "checked_in":
      return { label: "Checked In", bg: "rgba(59,130,246,0.1)", color: "#2563EB" };
    case "travel_started":
      return { label: "Traveling", bg: "rgba(251,191,36,0.12)", color: "#92700A" };
    case "arrived":
      return { label: "Arrived", bg: "rgba(34,197,94,0.1)", color: "#15803D" };
    case "completed":
      return { label: "Completed", bg: "var(--cs-success-bg)", color: "var(--cs-success)" };
    default:
      return { label: "Ready", bg: "var(--cs-surface-warm)", color: "var(--cs-text-muted)" };
  }
}

type TherapistServiceProgressCardProps = {
  booking: StaffPortalBooking;
  /** Whether to show the full progress controls (only for active bookings) */
  showControls?: boolean;
};

export function TherapistServiceProgressCard({
  booking,
  showControls = true,
}: TherapistServiceProgressCardProps) {
  const service = firstRelation(booking.services);
  const customer = firstRelation(booking.customers);
  const isHome = booking.delivery_type === "home_service";
  const address = (booking.metadata?.address as string | undefined) ?? (booking.metadata?.home_address as string | undefined);
  const badge = getProgressBadge(booking.booking_progress_status, booking.status);

  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        border: "1px solid var(--cs-border-soft)",
        overflow: "hidden",
        boxShadow: "var(--cs-shadow-xs)",
      }}
    >
      {/* Card header */}
      <div
        style={{
          padding: "0.875rem 1rem 0.75rem",
          borderBottom: showControls ? "1px solid var(--cs-border-soft)" : "none",
        }}
      >
        {/* Status badge row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--cs-text-muted)",
            }}
          >
            {isHome ? "Home Service" : "In-Spa Service"}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "3px 9px",
              borderRadius: 100,
              backgroundColor: badge.bg,
              color: badge.color,
            }}
          >
            {badge.label}
          </span>
        </div>

        {/* Service name + time */}
        <div
          style={{ fontSize: 17, fontWeight: 700, color: "var(--cs-text)", lineHeight: 1.25, marginBottom: 4 }}
        >
          {service?.name ?? "Service"}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--cs-text-muted)",
            marginBottom: 6,
          }}
        >
          <Clock size={12} />
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
          </span>
          {service?.duration_minutes && (
            <span style={{ opacity: 0.6 }}>· {service.duration_minutes} min</span>
          )}
        </div>

        {/* Location */}
        {isHome ? (
          address && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 4, fontSize: 12, color: "var(--cs-text-muted)" }}>
              <HomeIcon size={12} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ lineHeight: 1.4 }}>{address}</span>
            </div>
          )
        ) : booking.branch_resources ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--cs-text-muted)" }}>
            <MapPin size={12} />
            {booking.branch_resources.name}
          </div>
        ) : null}

        {/* Customer */}
        {customer && (
          <div style={{ fontSize: 12, color: "var(--cs-text-secondary)", marginTop: 4 }}>
            {customer.full_name}
          </div>
        )}
      </div>

      {/* Progress controls (active bookings only) */}
      {showControls && (
        <div style={{ padding: "0.75rem 1rem" }}>
          <BookingProgressActions booking={booking} />
        </div>
      )}
    </div>
  );
}
