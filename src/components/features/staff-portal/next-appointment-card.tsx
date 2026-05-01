import { Clock, MapPin, ArrowRight } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import type { StaffPortalBooking } from "./types";

function firstRelation<T>(relation: T | T[] | null): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

type NextAppointmentCardProps = {
  booking: StaffPortalBooking;
};

export function NextAppointmentCard({ booking }: NextAppointmentCardProps) {
  const customer = firstRelation(booking.customers);
  const service = firstRelation(booking.services);
  const duration = service?.duration_minutes ?? 60;
  const isHomeService = booking.type === "home_service";
  const address = (booking.metadata?.address as string) || (booking.metadata?.home_address as string);

  return (
    <div
      className="cs-card"
      style={{
        padding: "1rem 1.125rem",
        border: "1px solid var(--cs-border)",
        background: "linear-gradient(135deg, var(--cs-surface) 0%, var(--cs-sand-mist) 100%)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--cs-staff-accent)",
          marginBottom: "0.5rem",
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        <ArrowRight size={13} />
        Next Appointment
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "0.75rem",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--cs-text)", lineHeight: 1.2 }}>
            {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--cs-text)", marginTop: "0.375rem" }}>
            {customer?.full_name ?? "—"}
          </div>
          <div style={{ fontSize: 13, color: "var(--cs-text-muted)", marginTop: 2 }}>
            {service?.name ?? "Service"}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: "0.375rem",
              flexWrap: "wrap",
            }}
          >
            <BookingTypeBadge type={booking.type} />
            <BookingStatusBadge status={booking.status} />
            <span
              style={{
                fontSize: 12,
                color: "var(--cs-text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <Clock size={12} />
              {duration} min
            </span>
          </div>
          {isHomeService && address && (
            <div
              style={{
                fontSize: 12,
                color: "var(--cs-text-muted)",
                marginTop: "0.375rem",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <MapPin size={12} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{address}</span>
            </div>
          )}
          {!isHomeService && (
            <div
              style={{
                fontSize: 12,
                color: "var(--cs-text-muted)",
                marginTop: "0.375rem",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <MapPin size={12} />
              In-Spa
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
