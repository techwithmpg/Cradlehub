"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Clock, MapPin, X } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { BookingProgressActions } from "./booking-progress-actions";
import { ServiceSessionCountdown } from "./service-session-countdown";
import type { StaffPortalBooking } from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function firstRelation<T>(rel: T | T[] | null): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

function isActiveSession(booking: StaffPortalBooking): boolean {
  return (
    booking.booking_progress_status === "session_started" ||
    booking.status === "in_progress"
  );
}

// ── Modal header (booking overview) ──────────────────────────────────────────

function BookingHeader({ booking }: { booking: StaffPortalBooking }) {
  const customer = firstRelation(booking.customers);
  const service  = firstRelation(booking.services);
  const duration = service?.duration_minutes ?? 60;
  const isHome   = booking.delivery_type === "home_service";
  const address  = (booking.metadata?.address as string | undefined)
    ?? (booking.metadata?.home_address as string | undefined);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--cs-text)", lineHeight: 1.2 }}>
        {customer?.full_name ?? "—"}
      </div>
      <div style={{ fontSize: 14, color: "var(--cs-text-secondary)" }}>
        {service?.name ?? "Service"}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 4 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--cs-text-muted)" }}>
          <Clock size={13} aria-hidden />
          {formatTime(booking.start_time)} — {formatTime(booking.end_time)}
        </span>
        <span style={{ fontSize: 12, color: "var(--cs-text-subtle)", background: "var(--cs-surface)", border: "1px solid var(--cs-border-soft)", borderRadius: 99, padding: "2px 10px" }}>
          {duration} min
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--cs-text-muted)", marginTop: 2 }}>
        <MapPin size={12} aria-hidden />
        {isHome
          ? (address ?? "Home service — address not recorded")
          : booking.branch_resources
            ? `Room: ${booking.branch_resources.name}`
            : "In-spa · Space not assigned"}
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────


type ServiceProgressModalProps = {
  booking: StaffPortalBooking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ServiceProgressModal({ booking, open, onOpenChange }: ServiceProgressModalProps) {
  const router = useRouter();
  const service  = firstRelation(booking.services);

  const handleProgressUpdated = useCallback(() => {
    router.refresh();
    onOpenChange(false);
  }, [router, onOpenChange]);


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="rounded-t-3xl bg-[var(--cs-bg)] px-0 pb-safe"
          style={{ maxHeight: "82dvh", overflowY: "auto" }}
        >
          {/* Drag handle */}
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--cs-border-strong)" }} />
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close service progress"
            style={{ position: "absolute", top: 14, right: 16, display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--cs-border)", background: "var(--cs-surface)", color: "var(--cs-text-muted)", cursor: "pointer" }}
          >
            <X size={15} />
          </button>

          <div style={{ padding: "0 1.25rem 1.5rem" }}>
            {/* Header label */}
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--cs-staff-accent)", marginBottom: 12 }}>
              Service Progress
            </div>

            {/* Booking overview */}
            <div style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border-soft)", borderRadius: 16, padding: "1rem", marginBottom: 16 }}>
              <BookingHeader booking={booking} />
            </div>

            {/* Live countdown — shown only during session */}
            {isActiveSession(booking) ? (
              <ServiceSessionCountdown
                status={booking.status}
                progressStatus={booking.booking_progress_status}
                sessionStartedAt={booking.session_started_at}
                sessionDueAt={booking.session_due_at}
                durationMinutes={
                  booking.session_duration_minutes_snapshot ??
                  service?.duration_minutes
                }
                isHomeService={booking.delivery_type === "home_service"}
                className="mb-4"
              />
            ) : null}

            {/* Full progress actions (stepper + buttons) */}
            <BookingProgressActions
              booking={booking}
              onSuccess={handleProgressUpdated}
            />
          </div>
        </SheetContent>
      </Sheet>
  );
}
