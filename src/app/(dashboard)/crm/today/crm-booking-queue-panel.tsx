"use client";

import { useState } from "react";
import Link from "next/link";

type BookingCardData = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  type: string;
  travel_buffer_mins: number | null;
  payment_status?: string;
  payment_method?: string;
  amount_paid?: number;
  customer_name: string | null;
  service_name: string | null;
  service_duration: number | null;
  staff_name: string | null;
  resource_name: string | null;
};

type FilterTab = "active" | "confirmed" | "in_progress" | "completed" | "cancelled";

const TAB_LABELS: Record<FilterTab, string> = {
  active: "Active",
  confirmed: "Confirmed",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled/No-show",
};

const PAYMENT_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  paid:       { bg: "#ECFDF5", color: "#065F46" },
  unpaid:     { bg: "#FEF2F2", color: "#991B1B" },
  pending:    { bg: "#FFF7ED", color: "#92400E" },
  waived:     { bg: "#F0FDF4", color: "#166534" },
  pay_on_site:{ bg: "var(--cs-surface-warm)", color: "var(--cs-text-muted)" },
};

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const hr = h ?? 0;
  const ampm = hr >= 12 ? "PM" : "AM";
  const display = hr % 12 === 0 ? 12 : hr % 12;
  return `${display}:${String(m ?? 0).padStart(2, "0")}${ampm}`;
}

function PaymentBadge({ status, amount }: { status?: string; method?: string; amount?: number }) {
  if (!status) return null;
  const isPaid = status === "paid";
  const style = PAYMENT_STATUS_COLORS[status] ?? PAYMENT_STATUS_COLORS["pending"]!;

  return (
    <span
      style={{
        fontSize: "0.625rem",
        fontWeight: 700,
        padding: "2px 5px",
        borderRadius: 3,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        ...style,
      }}
    >
      {isPaid && amount ? `₱${amount.toLocaleString()}` : status.replace(/_/g, " ")}
    </span>
  );
}

function BookingCard({ booking, isNext }: { booking: BookingCardData; isNext: boolean }) {
  const payStatus = booking.payment_status ?? "pay_on_site";

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
        borderLeft: isNext ? "3px solid var(--cs-sand)" : "3px solid transparent",
      }}
    >
      <div style={{ minWidth: 56, textAlign: "center", flexShrink: 0 }}>
        <div
          style={{
            fontSize: "0.9375rem",
            fontWeight: 700,
            color: "var(--cs-text)",
            lineHeight: 1,
          }}
        >
          {formatTime(booking.start_time)}
        </div>
        <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)" }}>
          {booking.type === "home_service" && booking.travel_buffer_mins
            ? `+${booking.travel_buffer_mins}m`
            : `${booking.service_duration ?? "—"}m`}
        </div>
      </div>

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
              backgroundColor: booking.type === "home_service" ? "#FFF7ED" : "var(--cs-sand-mist)",
              color: booking.type === "home_service" ? "#92400E" : "var(--cs-sand)",
            }}
          >
            {booking.type === "home_service" ? "Home" : booking.type === "walk_in" ? "Walk-in" : "Online"}
          </span>
          <span
            style={{
              fontSize: "0.625rem",
              fontWeight: 700,
              padding: "2px 5px",
              borderRadius: 3,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              backgroundColor:
                booking.status === "completed" ? "#ECFDF5"
                : booking.status === "in_progress" ? "#FFF7ED"
                : booking.status === "confirmed" ? "var(--cs-sand-mist)"
                : "#FEF2F2",
              color:
                booking.status === "completed" ? "#065F46"
                : booking.status === "in_progress" ? "#92400E"
                : booking.status === "confirmed" ? "var(--cs-sand)"
                : "#991B1B",
            }}
          >
            {booking.status.replace(/_/g, " ")}
          </span>
        </div>
        <PaymentBadge
          status={payStatus}
          method={booking.payment_method}
          amount={booking.amount_paid}
        />
      </div>
    </Link>
  );
}

export function CrmBookingQueuePanel({
  bookings,
  nextApptId,
}: {
  bookings: BookingCardData[];
  nextApptId?: string;
}) {
  const [activeTab, setActiveTab] = useState<FilterTab>("active");

  const filtered = bookings.filter((b) => {
    if (activeTab === "active") return b.status === "confirmed" || b.status === "in_progress";
    if (activeTab === "confirmed") return b.status === "confirmed";
    if (activeTab === "in_progress") return b.status === "in_progress";
    if (activeTab === "completed") return b.status === "completed";
    if (activeTab === "cancelled") return b.status === "cancelled" || b.status === "no_show";
    return true;
  });

  const tabCounts: Record<FilterTab, number> = {
    active: bookings.filter((b) => b.status === "confirmed" || b.status === "in_progress").length,
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    in_progress: bookings.filter((b) => b.status === "in_progress").length,
    completed: bookings.filter((b) => b.status === "completed").length,
    cancelled: bookings.filter((b) => b.status === "cancelled" || b.status === "no_show").length,
  };

  const tabs: FilterTab[] = ["active", "confirmed", "in_progress", "completed", "cancelled"];

  return (
    <div>
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 2,
          marginBottom: "0.875rem",
          flexWrap: "wrap",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "4px 10px",
              borderRadius: 20,
              border: "1px solid",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
              borderColor: activeTab === tab ? "var(--cs-sand)" : "var(--cs-border)",
              backgroundColor: activeTab === tab ? "var(--cs-sand-mist)" : "transparent",
              color: activeTab === tab ? "var(--cs-sand)" : "var(--cs-text-muted)",
            }}
          >
            {TAB_LABELS[tab]}
            {tabCounts[tab] > 0 && (
              <span
                style={{
                  marginLeft: 5,
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  opacity: 0.75,
                }}
              >
                {tabCounts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "var(--cs-text-muted)",
            fontSize: "0.875rem",
            backgroundColor: "var(--cs-surface)",
            border: "1px solid var(--cs-border)",
            borderRadius: 10,
          }}
        >
          {activeTab === "active" ? "No active bookings right now." : `No ${TAB_LABELS[activeTab].toLowerCase()} bookings today.`}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {filtered.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              isNext={booking.id === nextApptId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
