"use client";

import Link from "next/link";
import { CalendarDays, ChevronDown } from "lucide-react";
import { CrmPanel } from "../crm-panel";
import { CrmEmptyState } from "../crm-empty-state";
import { CrmBookingFlowRow, CrmBookingFlowRowMobile } from "../crm-booking-flow-row";
import { OpenAdministrativeBookingButton } from "@/components/features/bookings/administrative-booking-modal-provider";
import type { BookingListItemData } from "../crm-booking-list-item";
import { isCrmPendingBookingStatus } from "@/lib/bookings/crm-booking-status";

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const hr = h ?? 0;
  const ampm = hr >= 12 ? "PM" : "AM";
  const display = hr % 12 === 0 ? 12 : hr % 12;
  return `${display}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

function Avatar({ name }: { name: string | null }) {
  const initial = (name ?? "?").charAt(0).toUpperCase();
  return (
    <div
      style={{
        width: 32,
        height: 32,
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

export function TodayOverviewTab({
  queueData,
  nextApptId,
}: {
  queueData: BookingListItemData[];
  nextApptId?: string;
}) {
  const pending = queueData.filter((b) => isCrmPendingBookingStatus(b.status));
  const active = queueData.filter((b) => b.status === "confirmed" || b.status === "in_progress");
  const upcoming = queueData
    .filter((b) => b.status === "confirmed")
    .slice(0, 3);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {pending.length > 0 && (
        <CrmPanel
          title="Incoming / Pending"
          action={
            <Link
              href="/crm/bookings?tab=needs-confirmation"
              style={{ fontSize: "0.75rem", color: "var(--cs-sand)", fontWeight: 600, textDecoration: "none" }}
            >
              Review queue →
            </Link>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {pending.slice(0, 5).map((b) => (
              <div key={b.id}>
                <CrmBookingFlowRow booking={b} />
                <CrmBookingFlowRowMobile booking={b} />
              </div>
            ))}
          </div>
        </CrmPanel>
      )}

      {/* Today's Booking Flow */}
      <CrmPanel
        title={
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CalendarDays size={16} style={{ color: "var(--cs-sand)" }} />
            Today&apos;s Booking Flow
          </span>
        }
        action={
          <Link
            href="/crm/bookings"
            style={{ fontSize: "0.75rem", color: "var(--cs-sand)", fontWeight: 600, textDecoration: "none" }}
          >
            View full schedule →
          </Link>
        }
      >
        {active.length === 0 ? (
          <CrmEmptyState
            title="No active bookings"
            description="Confirmed and in-progress bookings will appear here when the day starts."
            action={
              <OpenAdministrativeBookingButton
                mode="standard_future"
                label="New Booking ->"
                showIcon={false}
                variant="ghost"
                className="mt-1 h-auto p-0 text-[0.8125rem] font-semibold text-[var(--cs-sand)] hover:bg-transparent"
              />
            }
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {/* Column headers - desktop only */}
            <div
              className="hidden md:grid"
              style={{
                display: "grid",
                gridTemplateColumns: "72px 1fr 1fr 100px 90px",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0 0.875rem 0.25rem",
              }}
            >
              <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Time</span>
              <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Customer</span>
              <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Service</span>
              <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Staff</span>
              <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right" }}>Status</span>
            </div>

            {active.slice(0, 6).map((b) => (
              <div key={b.id}>
                <CrmBookingFlowRow booking={b} isActive={b.id === nextApptId} />
                <CrmBookingFlowRowMobile booking={b} isActive={b.id === nextApptId} />
              </div>
            ))}

            {active.length > 6 && (
              <button
                type="button"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  padding: "0.5rem",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "var(--cs-text-muted)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  marginTop: 4,
                }}
              >
                Show more <ChevronDown size={14} />
              </button>
            )}
          </div>
        )}
      </CrmPanel>

      {/* Upcoming Next */}
      {upcoming.length > 0 && (
        <CrmPanel
          title={
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CalendarDays size={16} style={{ color: "var(--cs-sand)" }} />
              Upcoming Next
            </span>
          }
          action={
            <Link
              href="/crm/bookings"
              style={{ fontSize: "0.75rem", color: "var(--cs-sand)", fontWeight: 600, textDecoration: "none" }}
            >
              View all upcoming →
            </Link>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {upcoming.map((b) => (
              <div
                key={b.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.625rem 0.875rem",
                  borderRadius: "var(--cs-r-md)",
                  border: "1px solid var(--cs-border-soft)",
                  background: "var(--cs-surface)",
                  transition: "box-shadow 150ms ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "var(--cs-shadow-xs)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                <div style={{ minWidth: 56, textAlign: "center" }}>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--cs-text)" }}>
                    {formatTime(b.start_time)}
                  </div>
                </div>
                <Avatar name={b.customer_name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--cs-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {b.customer_name ?? "—"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {b.service_name ?? "Service"} {b.service_duration ? `(${b.service_duration}m)` : ""}
                  </div>
                  {b.staff_name && (
                    <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                      Staff: {b.staff_name}
                    </div>
                  )}
                </div>
                <StatusBadge status={b.status} />
              </div>
            ))}
          </div>
        </CrmPanel>
      )}
    </div>
  );
}
