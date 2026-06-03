import Link from "next/link";
import { MapPin, Home as HomeIcon, Clock, Stethoscope } from "lucide-react";
import { formatTime } from "@/lib/utils";
import type { StaffPortalBooking } from "@/components/features/staff-portal/types";

type TherapistNextServiceCardProps = {
  booking: StaffPortalBooking | null;
};

function firstRelation<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function getCountdownLabel(startTime: string, status: string): string {
  if (status === "in_progress") return "Now";
  const now = new Date();
  const [h = 0, m = 0] = startTime.split(":").map(Number);
  const startMinutes = h * 60 + m;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const diff = startMinutes - nowMinutes;
  if (diff <= 0) return "Now";
  if (diff < 60) return `In ${diff}m`;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return mins > 0 ? `In ${hours}h ${mins}m` : `In ${hours}h`;
}

function getProgressBadge(progressStatus: string): { label: string; bg: string; color: string } {
  switch (progressStatus) {
    case "session_started":
      return { label: "In Progress", bg: "rgba(139,92,246,0.1)", color: "#7C3AED" };
    case "checked_in":
      return { label: "Checked In", bg: "rgba(59,130,246,0.1)", color: "#2563EB" };
    case "travel_started":
      return { label: "Traveling", bg: "rgba(251,191,36,0.12)", color: "#92700A" };
    case "arrived":
      return { label: "Arrived", bg: "rgba(34,197,94,0.1)", color: "#15803D" };
    default:
      return { label: "Upcoming", bg: "var(--cs-success-bg)", color: "var(--cs-success)" };
  }
}

function EmptyState() {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        border: "1px solid var(--cs-border-soft)",
        padding: "1.25rem 1.125rem",
        boxShadow: "var(--cs-shadow-xs)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "0.5rem",
      }}
    >
      <Stethoscope size={28} color="var(--cs-text-muted)" style={{ opacity: 0.35 }} />
      <div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--cs-text)" }}>
          {"You're clear for today"}
        </p>
        <p style={{ margin: "0.25rem 0 0", fontSize: 12, color: "var(--cs-text-muted)", lineHeight: 1.5 }}>
          No assigned services. New bookings will appear here automatically.
        </p>
      </div>
      <Link
        href="/staff-portal/service-progress"
        style={{
          padding: "0.5rem 0.875rem",
          borderRadius: 10,
          border: "1px solid var(--cs-border)",
          backgroundColor: "var(--cs-surface-warm)",
          color: "var(--cs-staff-accent)",
          fontSize: 12,
          fontWeight: 600,
          textDecoration: "none",
          marginTop: "0.25rem",
        }}
      >
        View All Services
      </Link>
    </div>
  );
}

export function TherapistNextServiceCard({ booking }: TherapistNextServiceCardProps) {
  if (!booking) return <EmptyState />;

  const service = firstRelation(booking.services);
  const customer = firstRelation(booking.customers);
  const isHome = booking.delivery_type === "home_service";
  const address = (booking.metadata?.address as string | undefined) ?? (booking.metadata?.home_address as string | undefined);
  const countdown = getCountdownLabel(booking.start_time, booking.status);
  const badge = getProgressBadge(booking.booking_progress_status);

  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        border: "1px solid var(--cs-border-soft)",
        borderLeft: "3px solid var(--cs-staff-accent)",
        padding: "1rem 1.125rem",
        boxShadow: "var(--cs-shadow-xs)",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--cs-staff-accent)",
          }}
        >
          Next Service
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 9px",
            borderRadius: 100,
            backgroundColor: "var(--cs-success-bg)",
            color: "var(--cs-success)",
            border: "1px solid rgba(90,138,106,0.2)",
            flexShrink: 0,
          }}
        >
          {countdown}
        </span>
      </div>

      {/* Service name */}
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--cs-text)", lineHeight: 1.25 }}>
          {service?.name ?? "Appointment"}
        </div>
        <div style={{ fontSize: 13, color: "var(--cs-text-muted)", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
          <Clock size={12} />
          {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
        </div>
      </div>

      {/* Location + customer row */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {isHome ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--cs-text-muted)" }}>
            <HomeIcon size={12} />
            {address ? (
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {address}
              </span>
            ) : (
              "Home Service"
            )}
          </div>
        ) : booking.branch_resources ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--cs-text-muted)" }}>
            <MapPin size={12} />
            {booking.branch_resources.name}
          </div>
        ) : null}

        {customer && (
          <div style={{ fontSize: 12, color: "var(--cs-text-secondary)" }}>
            {customer.full_name}
          </div>
        )}
      </div>

      {/* Progress badge + link */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.25rem" }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 100,
            backgroundColor: badge.bg,
            color: badge.color,
          }}
        >
          {badge.label}
        </span>
        <Link
          href="/staff-portal/service-progress"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--cs-staff-accent)",
            textDecoration: "none",
          }}
        >
          View All Services →
        </Link>
      </div>
    </div>
  );
}
