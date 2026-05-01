import { MapPin, Clock, FileText } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import { HomeServiceTrackingActions } from "./home-service-tracking-actions";
import { TrackingTimer } from "./tracking-timer";
import type { StaffPortalBooking } from "./types";
import { getTrackingStage, isTrackingComplete } from "./types";

function firstRelation<T>(relation: T | T[] | null): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

function statusStripColor(status: string): string {
  if (status === "completed") return "var(--cs-success)";
  if (status === "in_progress") return "var(--cs-sand)";
  if (status === "cancelled" || status === "no_show") return "var(--cs-text-muted)";
  return "var(--cs-sand)";
}

type StaffAppointmentCardProps = {
  booking: StaffPortalBooking;
  isNext?: boolean;
};

export function StaffAppointmentCard({ booking, isNext }: StaffAppointmentCardProps) {
  const customer = firstRelation(booking.customers);
  const service = firstRelation(booking.services);
  const duration = service?.duration_minutes ?? 60;
  const isHomeService = booking.type === "home_service";
  const address = (booking.metadata?.address as string) || (booking.metadata?.home_address as string);
  const notes = (booking.metadata?.customer_notes as string) || (booking.metadata?.notes as string);
  const trackingStage = getTrackingStage(booking);
  const trackingActive = trackingStage !== null && !isTrackingComplete(booking);

  return (
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

      {/* Location / Address */}
      <div style={{ fontSize: 12, color: "var(--cs-text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
        <MapPin size={12} />
        {isHomeService ? (
          address ? (
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{address}</span>
          ) : (
            "Home Service — address not recorded"
          )
        ) : (
          "In-Spa"
        )}
      </div>

      {/* Notes */}
      {notes && (
        <div style={{ fontSize: 12, color: "var(--cs-text-muted)", display: "flex", alignItems: "flex-start", gap: 4 }}>
          <FileText size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ lineHeight: 1.4 }}>{notes}</span>
        </div>
      )}

      {/* Tracking timer */}
      {trackingActive && booking.travel_started_at && (
        <TrackingTimer startTimestamp={booking.travel_started_at} />
      )}

      {/* Home service tracking actions */}
      {isHomeService && !isTrackingComplete(booking) && (
        <HomeServiceTrackingActions booking={booking} />
      )}

      {/* Completed summary */}
      {isHomeService && isTrackingComplete(booking) && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--cs-success-text)",
            backgroundColor: "var(--cs-success-bg)",
            padding: "4px 10px",
            borderRadius: "var(--cs-r-sm)",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            alignSelf: "flex-start",
          }}
        >
          Home service completed
        </div>
      )}
    </div>
  );
}
