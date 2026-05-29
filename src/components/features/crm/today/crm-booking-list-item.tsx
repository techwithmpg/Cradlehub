"use client";

import Link from "next/link";

export type BookingListItemData = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  type: string;
  travel_buffer_mins: number | null;
  payment_status?: string | null;
  payment_method?: string | null;
  amount_paid?: number | null;
  price_paid?: number | null;
  customer_name: string | null;
  service_name: string | null;
  service_duration: number | null;
  staff_name: string | null;
  resource_name: string | null;
  hs_zone?: string | null;
  hs_address?: string | null;
  hs_city?: string | null;
  hs_map_url?: string | null;
  dispatch_warning?: string | null;
  needs_location_review?: boolean;
};

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const hr = h ?? 0;
  const ampm = hr >= 12 ? "PM" : "AM";
  const display = hr % 12 === 0 ? 12 : hr % 12;
  return `${display}:${String(m ?? 0).padStart(2, "0")}${ampm}`;
}

const STATUS_META: Record<string, { bg: string; color: string }> = {
  confirmed: { bg: "var(--cs-sand-mist)", color: "var(--cs-sand)" },
  in_progress: { bg: "#FFF7ED", color: "#92400E" },
  completed: { bg: "#ECFDF5", color: "#065F46" },
  cancelled: { bg: "#FEF2F2", color: "#991B1B" },
  no_show: { bg: "#FEF2F2", color: "#991B1B" },
  pending: { bg: "#F3EEF8", color: "#4A2A6A" },
  pending_payment: { bg: "#FFF7ED", color: "#92400E" },
  pending_crm_confirmation: { bg: "#EEF0F8", color: "#1A2A5A" },
};

const PAYMENT_META: Record<string, { bg: string; color: string }> = {
  paid: { bg: "#ECFDF5", color: "#065F46" },
  unpaid: { bg: "#FEF2F2", color: "#991B1B" },
  pending: { bg: "#FFF7ED", color: "#92400E" },
  pay_on_site: { bg: "var(--cs-surface-warm)", color: "var(--cs-text-muted)" },
};

export function CrmBookingListItem({
  booking,
  highlight = false,
}: {
  booking: BookingListItemData;
  highlight?: boolean;
}) {
  const statusMeta = STATUS_META[booking.status] ?? { bg: "var(--cs-surface-warm)", color: "var(--cs-text-muted)" };
  const payStatus = booking.payment_status ?? "pay_on_site";
  const payMeta = PAYMENT_META[payStatus] ?? PAYMENT_META["pending"]!;
  const isHomeService = booking.type === "home_service";

  return (
    <Link
      href={`/crm/bookings?highlight=${booking.id}`}
      className="cs-card"
      style={{
        padding: "0.75rem 1rem",
        display: "flex",
        alignItems: "center",
        gap: "0.875rem",
        textDecoration: "none",
        color: "inherit",
        borderLeft: highlight ? "3px solid var(--cs-sand)" : "3px solid transparent",
        position: "relative",
        transition: "box-shadow 150ms ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--cs-shadow-sm)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--cs-shadow-xs)";
      }}
    >
      {/* Time column */}
      <div style={{ minWidth: 56, textAlign: "center", flexShrink: 0 }}>
        <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--cs-text)", lineHeight: 1 }}>
          {formatTime(booking.start_time)}
        </div>
        <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)" }}>
          {isHomeService && booking.travel_buffer_mins
            ? `+${booking.travel_buffer_mins}m`
            : `${booking.service_duration ?? "—"}m`}
        </div>
      </div>

      {/* Status stripe */}
      <div
        style={{
          width: 3,
          alignSelf: "stretch",
          borderRadius: 2,
          backgroundColor:
            booking.status === "in_progress"
              ? "var(--cs-sand)"
              : booking.status === "completed"
              ? "var(--cs-success)"
              : "var(--cs-border)",
        }}
      />

      {/* Main info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "var(--cs-text)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginBottom: 2,
          }}
        >
          {booking.customer_name ?? "—"}
        </div>
        <div
          style={{
            fontSize: "0.8125rem",
            color: "var(--cs-text-muted)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {booking.service_name ?? "Service"}
          {booking.staff_name && <span style={{ marginLeft: 6 }}>· {booking.staff_name}</span>}
          {booking.resource_name && (
            <span style={{ marginLeft: 6, color: "var(--cs-sand)", fontWeight: 500 }}>
              · {booking.resource_name}
            </span>
          )}
        </div>
      </div>

      {/* Badges */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 4 }}>
          <span
            style={{
              fontSize: "0.625rem",
              fontWeight: 700,
              padding: "2px 5px",
              borderRadius: 3,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              backgroundColor: isHomeService ? "#FFF7ED" : "var(--cs-sand-mist)",
              color: isHomeService ? "#92400E" : "var(--cs-sand)",
            }}
          >
            {isHomeService ? "Home" : booking.type === "walk_in" ? "Walk-in" : "Online"}
          </span>
          <span
            style={{
              fontSize: "0.625rem",
              fontWeight: 700,
              padding: "2px 5px",
              borderRadius: 3,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              backgroundColor: statusMeta.bg,
              color: statusMeta.color,
            }}
          >
            {booking.status.replace(/_/g, " ")}
          </span>
        </div>
        <span
          style={{
            fontSize: "0.625rem",
            fontWeight: 700,
            padding: "2px 5px",
            borderRadius: 3,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            backgroundColor: payMeta.bg,
            color: payMeta.color,
          }}
        >
          {payStatus === "paid" && booking.amount_paid
            ? `₱${booking.amount_paid.toLocaleString()}`
            : payStatus.replace(/_/g, " ")}
        </span>
        {booking.needs_location_review && (
          <span
            style={{
              fontSize: "0.5625rem",
              fontWeight: 700,
              padding: "2px 5px",
              borderRadius: 3,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              backgroundColor: "#FEF2F2",
              color: "#991B1B",
            }}
          >
            Review Location
          </span>
        )}
      </div>
    </Link>
  );
}
