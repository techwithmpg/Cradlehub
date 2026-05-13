"use client";

import { PaymentActionMenu } from "@/components/features/dashboard/payment-action-menu";
import { BookingActionMenu } from "@/components/features/dashboard/booking-action-menu";
import { getBookingProgressLabel } from "@/lib/bookings/progress";
import type { ControlBooking } from "./types";

const ZONE_LABELS: Record<string, string> = {
  central_bacolod: "Central Bacolod",
  north_bacolod_talisay: "North / Talisay",
  south_bacolod_alijis: "South / Alijis",
  east_bacolod: "East Bacolod",
  outside_bacolod: "Outside Bacolod",
  unknown: "Zone unconfirmed",
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  confirmed: { bg: "var(--cs-sand-mist)", color: "var(--cs-sand)" },
  in_progress: { bg: "#FFF7ED", color: "#92400E" },
  completed: { bg: "#ECFDF5", color: "#065F46" },
  cancelled: { bg: "#FEF2F2", color: "#991B1B" },
  no_show: { bg: "#FEF2F2", color: "#991B1B" },
  pending: { bg: "#F3F4F6", color: "#4B5563" },
};

const PAYMENT_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  paid: { bg: "#ECFDF5", color: "#065F46" },
  unpaid: { bg: "#FEF2F2", color: "#991B1B" },
  pending: { bg: "#FFF7ED", color: "#92400E" },
  refunded: { bg: "#F3F4F6", color: "#4B5563" },
};

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const hr = h ?? 0;
  const ampm = hr >= 12 ? "PM" : "AM";
  const display = hr % 12 === 0 ? 12 : hr % 12;
  return `${display}:${String(m ?? 0).padStart(2, "0")}${ampm}`;
}

function durationMins(start: string, end: string): number {
  const [h1, m1] = start.split(":").map(Number);
  const [h2, m2] = end.split(":").map(Number);
  return (h2! * 60 + m2!) - (h1! * 60 + m1!);
}

function progressDot(color: string) {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        backgroundColor: color,
        display: "inline-block",
      }}
    />
  );
}

function ProgressMiniStepper({ status, type }: { status?: string; type: string }) {
  const stages =
    type === "home_service"
      ? ["not_started", "travel_started", "arrived", "session_started", "completed"]
      : type === "walkin"
      ? ["not_started", "checked_in", "session_started", "completed"]
      : ["not_started", "session_started", "completed"];

  const currentIndex = stages.indexOf(status ?? "not_started");

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
      {stages.map((stage, i) => {
        const isDone = currentIndex > i;
        const isCurrent = currentIndex === i;
        const color = isDone ? "var(--cs-success)" : isCurrent ? "var(--cs-sand)" : "var(--cs-border)";
        return (
          <div key={stage} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            {progressDot(color)}
            <span
              style={{
                fontSize: "0.625rem",
                color: isDone || isCurrent ? "var(--cs-text)" : "var(--cs-text-muted)",
                fontWeight: isCurrent ? 600 : 400,
              }}
            >
              {getBookingProgressLabel(stage as "no_show" | "completed" | "not_started" | "travel_started" | "arrived" | "session_started" | "checked_in")}
            </span>
            {i < stages.length - 1 && (
              <span style={{ color: "var(--cs-border)", margin: "0 1px" }}>→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export type ControlBookingCardProps = {
  booking: ControlBooking;
  viewerRole: string;
  paymentAction?: (input: unknown) => Promise<{ success: boolean; error?: string }>;
  statusAction?: (input: unknown) => Promise<{ success: boolean; error?: string }>;
};

export function ControlBookingCard({ booking, viewerRole, paymentAction, statusAction }: ControlBookingCardProps) {
  const statusStyle = STATUS_COLORS[booking.status] ?? STATUS_COLORS["pending"]!;
  const payStatus = booking.payment_status ?? "unpaid";
  const payStyle = PAYMENT_STATUS_COLORS[payStatus] ?? PAYMENT_STATUS_COLORS["pending"]!;
  const isHomeService = booking.type === "home_service";
  const dur = durationMins(booking.start_time, booking.end_time);

  return (
    <div
      className="cs-card"
      style={{
        padding: "0.75rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        borderLeft: `3px solid ${isHomeService ? "#92400E" : booking.status === "in_progress" ? "var(--cs-sand)" : booking.status === "completed" ? "var(--cs-success)" : "var(--cs-border)"}`,
      }}
    >
      {/* Warnings */}
      {(booking.dispatch_warning || booking.needs_location_review) && (
        <div
          style={{
            backgroundColor: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: "0.6875rem",
            color: "#991B1B",
            fontWeight: 600,
          }}
        >
          {booking.dispatch_warning && <span>⚠️ {booking.dispatch_warning}</span>}
          {booking.needs_location_review && <span>📍 Location needs review</span>}
        </div>
      )}

      {/* Main row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        {/* Time */}
        <div style={{ minWidth: 52, textAlign: "center", flexShrink: 0 }}>
          <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--cs-text)", lineHeight: 1 }}>
            {formatTime(booking.start_time)}
          </div>
          <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)" }}>
            {isHomeService && booking.travel_buffer_mins
              ? `+${booking.travel_buffer_mins}m`
              : `${dur}m`}
          </div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--cs-text)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              marginBottom: 1,
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

          {/* Home service address */}
          {isHomeService && (booking.hs_address || booking.hs_zone) && (
            <div
              style={{
                fontSize: "0.6875rem",
                color: "#92400E",
                marginTop: 2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {ZONE_LABELS[booking.hs_zone ?? "unknown"] ?? booking.hs_zone}
              {booking.hs_address && <span style={{ marginLeft: 4 }}>· {booking.hs_address}</span>}
            </div>
          )}

          {/* Progress stepper */}
          <div style={{ marginTop: 4 }}>
            <ProgressMiniStepper status={booking.booking_progress_status} type={booking.type} />
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
              {isHomeService ? "Home" : booking.type === "walkin" ? "Walk-in" : "Online"}
            </span>
            <span
              style={{
                fontSize: "0.625rem",
                fontWeight: 700,
                padding: "2px 5px",
                borderRadius: 3,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                backgroundColor: statusStyle.bg,
                color: statusStyle.color,
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
              backgroundColor: payStyle.bg,
              color: payStyle.color,
            }}
          >
            {payStatus === "paid" && booking.amount_paid
              ? `₱${booking.amount_paid.toLocaleString()}`
              : payStatus.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Actions */}
      {(paymentAction || statusAction) && (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: 2 }}>
          {paymentAction && (
            <PaymentActionMenu
              bookingId={booking.id}
              paymentStatus={booking.payment_status ?? "unpaid"}
              paymentMethod={booking.payment_method ?? "pay_on_site"}
              amountPaid={booking.amount_paid ?? 0}
              pricePaid={booking.price_paid ?? 0}
              paymentAction={paymentAction}
              triggerLabel="Pay"
              triggerVariant="panelSecondary"
              fullWidth
            />
          )}
          {statusAction && (
            <BookingActionMenu
              bookingId={booking.id}
              currentStatus={booking.status}
              userRole={viewerRole}
              statusAction={statusAction}
              actionScope="status"
              triggerLabel="Status"
              triggerVariant="panelSecondary"
              fullWidth
              emptyBehavior="disabled"
            />
          )}
        </div>
      )}
    </div>
  );
}
