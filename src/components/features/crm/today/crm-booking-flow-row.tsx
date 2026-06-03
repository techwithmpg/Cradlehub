"use client";

import Link from "next/link";
import type { BookingListItemData } from "./crm-booking-list-item";

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const hr = h ?? 0;
  const ampm = hr >= 12 ? "PM" : "AM";
  const display = hr % 12 === 0 ? 12 : hr % 12;
  return `${display}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  confirmed: { bg: "var(--cs-success-bg)", color: "var(--cs-success)", label: "Confirmed" },
  in_progress: { bg: "#FFF7ED", color: "#92400E", label: "In Progress" },
  completed: { bg: "#ECFDF5", color: "#065F46", label: "Completed" },
  cancelled: { bg: "#FEF2F2", color: "#991B1B", label: "Cancelled" },
  no_show: { bg: "#FEF2F2", color: "#991B1B", label: "No-show" },
  pending: { bg: "#F3EEF8", color: "#4A2A6A", label: "Pending" },
  pending_payment: { bg: "#FFF7ED", color: "#92400E", label: "Pending Payment" },
  pending_crm_confirmation: { bg: "#EEF0F8", color: "#1A2A5A", label: "Pending Confirm" },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_BADGE[status] ?? { bg: "var(--cs-surface-warm)", color: "var(--cs-text-muted)", label: status };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 8px",
        borderRadius: "var(--cs-r-sm)",
        background: meta.bg,
        color: meta.color,
        fontSize: "0.6875rem",
        fontWeight: 600,
        textTransform: "capitalize",
        whiteSpace: "nowrap",
      }}
    >
      {meta.label}
    </span>
  );
}

function Avatar({ name }: { name: string | null }) {
  const initial = (name ?? "?").charAt(0).toUpperCase();
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "var(--cs-sand-mist)",
        color: "var(--cs-sand)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "0.75rem",
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}

export function CrmBookingFlowRow({
  booking,
  isActive = false,
}: {
  booking: BookingListItemData;
  isActive?: boolean;
}) {
  return (
    <Link
      href={`/crm/bookings?bookingId=${booking.id}`}
      style={{
        display: "grid",
        gridTemplateColumns: "72px 1fr 1fr 100px 90px",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.625rem 0.875rem",
        borderRadius: "var(--cs-r-md)",
        border: "1px solid var(--cs-border-soft)",
        background: isActive ? "var(--cs-sand-tint)" : "var(--cs-surface)",
        textDecoration: "none",
        color: "inherit",
        transition: "box-shadow 150ms ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--cs-shadow-xs)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
      className="hidden md:grid"
    >
      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--cs-text)", whiteSpace: "nowrap" }}>
        {formatTime(booking.start_time)}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <Avatar name={booking.customer_name} />
        <div style={{ minWidth: 0, overflow: "hidden" }}>
          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--cs-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {booking.customer_name ?? "—"}
          </div>
        </div>
      </div>

      <div style={{ minWidth: 0, overflow: "hidden" }}>
        <div style={{ fontSize: "0.8125rem", color: "var(--cs-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {booking.service_name ?? "Service"}
        </div>
        <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {booking.service_duration ?? "—"} min
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <Avatar name={booking.staff_name} />
        <span style={{ fontSize: "0.75rem", color: "var(--cs-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {booking.staff_name ?? "Unassigned"}
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <StatusBadge status={booking.status} />
      </div>
    </Link>
  );
}

export function CrmBookingFlowRowMobile({
  booking,
  isActive = false,
}: {
  booking: BookingListItemData;
  isActive?: boolean;
}) {
  return (
    <Link
      href={`/crm/bookings?bookingId=${booking.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.625rem 0.875rem",
        borderRadius: "var(--cs-r-md)",
        border: "1px solid var(--cs-border-soft)",
        background: isActive ? "var(--cs-sand-tint)" : "var(--cs-surface)",
        textDecoration: "none",
        color: "inherit",
        transition: "box-shadow 150ms ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--cs-shadow-xs)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
      className="md:hidden"
    >
      <Avatar name={booking.customer_name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--cs-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {booking.customer_name ?? "—"}
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {formatTime(booking.start_time)} · {booking.service_name ?? "Service"}
        </div>
      </div>
      <StatusBadge status={booking.status} />
    </Link>
  );
}
