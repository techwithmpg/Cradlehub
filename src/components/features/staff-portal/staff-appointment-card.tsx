"use client";

import { useState } from "react";
import { MapPin, Clock, FileText, ChevronRight } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import { ServiceProgressModal } from "./service-progress-modal";
import type { StaffPortalBooking } from "./types";
import type { BookingProgressStatus } from "@/lib/bookings/progress";

// ── Helpers ───────────────────────────────────────────────────────────────────

function firstRelation<T>(rel: T | T[] | null): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

function statusStripColor(status: string): string {
  if (status === "completed") return "var(--cs-success)";
  if (status === "in_progress") return "var(--cs-sand)";
  if (status === "cancelled" || status === "no_show") return "var(--cs-text-muted)";
  return "var(--cs-sand)";
}

function isTerminal(progress: BookingProgressStatus): boolean {
  return progress === "completed" || progress === "no_show";
}

function progressLabel(progress: BookingProgressStatus): string {
  const labels: Record<BookingProgressStatus, string> = {
    not_started:    "Not started",
    checked_in:     "Checked in",
    travel_started: "Travel started",
    arrived:        "Arrived",
    session_started:"In session",
    completed:      "Completed",
    no_show:        "No show",
  };
  return labels[progress] ?? progress;
}

function progressDotColor(progress: BookingProgressStatus): string {
  if (progress === "session_started") return "var(--cs-success)";
  if (progress === "completed")       return "var(--cs-success)";
  if (progress === "no_show")         return "var(--cs-warning)";
  if (progress === "not_started")     return "var(--cs-border-strong)";
  return "var(--cs-sand)";
}

// ── Component ─────────────────────────────────────────────────────────────────

type StaffAppointmentCardProps = {
  booking: StaffPortalBooking;
  isNext?: boolean;
};

export function StaffAppointmentCard({ booking, isNext }: StaffAppointmentCardProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const customer  = firstRelation(booking.customers);
  const service   = firstRelation(booking.services);
  const duration  = service?.duration_minutes ?? 60;
  const isHome    = booking.type === "home_service";
  const address   = (booking.metadata?.address as string | undefined)
    ?? (booking.metadata?.home_address as string | undefined);
  const notes     = (booking.metadata?.customer_notes as string | undefined)
    ?? (booking.metadata?.notes as string | undefined);
  const terminal  = isTerminal(booking.booking_progress_status);
  const showTrigger = !terminal && booking.status !== "cancelled";

  return (
    <>
      <div
        className="cs-card"
        style={{
          padding: "0.875rem 1rem",
          borderLeft: `3px solid ${isNext ? "var(--cs-staff-accent)" : statusStripColor(booking.status)}`,
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          backgroundColor: isNext ? "var(--cs-surface-warm)" : "var(--cs-surface)",
        }}
      >
        {/* Time row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--cs-text)", lineHeight: 1.2 }}>
            {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <BookingTypeBadge type={booking.type} />
            <BookingStatusBadge status={booking.status} />
          </div>
        </div>

        {/* Customer + Service */}
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--cs-text)" }}>
            {customer?.full_name ?? "—"}
          </div>
          <div style={{ fontSize: 13, color: "var(--cs-text-muted)", marginTop: 1, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span>{service?.name ?? "Service"}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Clock size={12} />
              {duration} min
            </span>
          </div>
        </div>

        {/* Location */}
        <div style={{ fontSize: 12, color: "var(--cs-text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
          <MapPin size={12} />
          {isHome ? (
            address ? (
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{address}</span>
            ) : "Home Service — address not recorded"
          ) : (
            <span>
              In-Spa
              {booking.branch_resources ? (
                <span style={{ color: "var(--cs-text)", fontWeight: 500 }}> · Room: {booking.branch_resources.name}</span>
              ) : " · Space not assigned"}
            </span>
          )}
        </div>

        {/* Notes */}
        {notes ? (
          <div style={{ fontSize: 12, color: "var(--cs-text-muted)", display: "flex", alignItems: "flex-start", gap: 4 }}>
            <FileText size={12} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ lineHeight: 1.4 }}>{notes}</span>
          </div>
        ) : null}

        {/* Compact progress status + trigger */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: progressDotColor(booking.booking_progress_status), flexShrink: 0, display: "inline-block" }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--cs-text-secondary)" }}>
              {progressLabel(booking.booking_progress_status)}
            </span>
          </div>

          {showTrigger ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                fontWeight: 600,
                color: "var(--cs-staff-accent)",
                background: "var(--cs-sand-tint)",
                border: "1px solid var(--cs-sand-mist)",
                borderRadius: 99,
                padding: "4px 12px",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Service Progress
              <ChevronRight size={13} />
            </button>
          ) : null}
        </div>
      </div>

      <ServiceProgressModal
        booking={booking}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}
