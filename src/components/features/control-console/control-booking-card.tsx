"use client";

import { useTransition, useState } from "react";
import { PaymentActionMenu } from "@/components/features/dashboard/payment-action-menu";
import { BookingActionMenu } from "@/components/features/dashboard/booking-action-menu";
import { getBookingProgressLabel } from "@/lib/bookings/progress";
import { DriverAssignMenu } from "./driver-assign-menu";
import type { AvailableDriver } from "./driver-assign-menu";
import type { ControlBooking } from "./types";
import {
  computeOperationalWarnings,
  maxWarningSeverity,
} from "@/lib/bookings/ops-warnings";
import type { LiveEtaData, OperationalWarning } from "@/lib/bookings/ops-warnings";
import type { EtaRefreshResult } from "@/lib/actions/eta-actions";

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

const WARNING_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  critical: { bg: "#FEF2F2", border: "#FECACA", color: "#991B1B" },
  warning: { bg: "#FFFBEB", border: "#FDE68A", color: "#92400E" },
  info: { bg: "#EFF6FF", border: "#BFDBFE", color: "#1E40AF" },
};

const WARNING_ICONS: Record<OperationalWarning["type"], string> = {
  missing_driver: "🚗",
  missing_location: "📡",
  location_stale: "⏰",
  missing_destination_coordinates: "📍",
  traffic_delay: "🚦",
  next_booking_conflict: "⚡",
  location_review_required: "🔍",
};

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const hr = h ?? 0;
  const ampm = hr >= 12 ? "PM" : "AM";
  const display = hr % 12 === 0 ? 12 : hr % 12;
  return `${display}:${String(m ?? 0).padStart(2, "0")}${ampm}`;
}

function minutesAgo(isoTs: string): number {
  return Math.floor((Date.now() - new Date(isoTs).getTime()) / 60000);
}

function durationMins(start: string, end: string): number {
  const [h1, m1] = start.split(":").map(Number);
  const [h2, m2] = end.split(":").map(Number);
  return h2! * 60 + m2! - (h1! * 60 + m1!);
}

function formatEtaAge(calculatedAt: string): string {
  const mins = Math.floor((Date.now() - new Date(calculatedAt).getTime()) / 60000);
  if (mins < 1) return "just now";
  return `${mins}m ago`;
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
        const color = isDone
          ? "var(--cs-success)"
          : isCurrent
          ? "var(--cs-sand)"
          : "var(--cs-border)";
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
              {getBookingProgressLabel(
                stage as
                  | "no_show"
                  | "completed"
                  | "not_started"
                  | "travel_started"
                  | "arrived"
                  | "session_started"
                  | "checked_in"
              )}
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

type TrackingPhase = "idle" | "loading" | "copied" | "error";

function TrackingLinkButton({
  bookingId,
  existingMessage,
  getTrackingLinkAction,
}: {
  bookingId: string;
  existingMessage: string | null | undefined;
  getTrackingLinkAction: (
    input: unknown
  ) => Promise<{ ok: boolean; message?: string; error?: string }>;
}) {
  const [phase, setPhase] = useState<TrackingPhase>("idle");
  const [isPending, startTransition] = useTransition();

  async function handleCopy() {
    if (isPending || phase === "copied") return;

    if (existingMessage) {
      await navigator.clipboard.writeText(existingMessage);
      setPhase("copied");
      setTimeout(() => setPhase("idle"), 3000);
      return;
    }

    setPhase("loading");
    startTransition(async () => {
      const result = await getTrackingLinkAction({ bookingId });
      if (result.ok && result.message) {
        try {
          await navigator.clipboard.writeText(result.message);
          setPhase("copied");
          setTimeout(() => setPhase("idle"), 3000);
        } catch {
          setPhase("error");
          setTimeout(() => setPhase("idle"), 3000);
        }
      } else {
        setPhase("error");
        setTimeout(() => setPhase("idle"), 3000);
      }
    });
  }

  const label =
    phase === "loading"
      ? "Generating…"
      : phase === "copied"
      ? "✅ Copied!"
      : phase === "error"
      ? "❌ Failed"
      : existingMessage
      ? "📋 Copy Message"
      : "🔗 Get & Copy";

  return (
    <button
      onClick={handleCopy}
      disabled={isPending || phase === "loading"}
      style={{
        fontSize: "0.6875rem",
        padding: "3px 8px",
        borderRadius: 4,
        border: "1px solid var(--cs-border)",
        backgroundColor: phase === "copied" ? "#ECFDF5" : "var(--cs-surface)",
        color: phase === "copied" ? "#065F46" : "var(--cs-text-muted)",
        cursor: isPending || phase === "loading" ? "default" : "pointer",
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

type EtaPhase = "idle" | "loading" | "error";

function EtaPanel({
  bookingId,
  initialEta,
  destLat,
  destLng,
  travelBufferMins,
  refreshEtaAction,
}: {
  bookingId: string;
  initialEta: LiveEtaData | null;
  destLat: number | null | undefined;
  destLng: number | null | undefined;
  travelBufferMins: number | null;
  refreshEtaAction?: (bookingId: string) => Promise<EtaRefreshResult>;
}) {
  const [currentEta, setCurrentEta] = useState<LiveEtaData | null>(initialEta);
  const [phase, setPhase] = useState<EtaPhase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasDestCoords = !!(destLat && destLng);

  async function handleRefresh() {
    if (!refreshEtaAction || isPending || phase === "loading") return;
    setPhase("loading");
    setErrorMsg(null);
    startTransition(async () => {
      const result = await refreshEtaAction(bookingId);
      if (result.ok) {
        setCurrentEta(result.eta);
        setPhase("idle");
      } else {
        setPhase("error");
        setErrorMsg(result.error);
        setTimeout(() => {
          setPhase("idle");
          setErrorMsg(null);
        }, 4000);
      }
    });
  }

  const buffer = travelBufferMins ?? 30;
  const isDelayed =
    currentEta !== null && currentEta.eta_minutes > buffer * 1.5 && currentEta.eta_minutes > buffer + 10;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginTop: 4,
        flexWrap: "wrap",
      }}
    >
      {currentEta ? (
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            color: isDelayed ? "#B45309" : "#065F46",
            background: isDelayed ? "#FFFBEB" : "#ECFDF5",
            padding: "2px 6px",
            borderRadius: 4,
          }}
        >
          {isDelayed ? "🚦" : "🗺️"} ETA {currentEta.eta_minutes}m
          <span
            style={{
              fontWeight: 400,
              color: "var(--cs-text-muted)",
              marginLeft: 4,
            }}
          >
            · {formatEtaAge(currentEta.calculated_at)}
          </span>
        </span>
      ) : (
        <span style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)" }}>
          {hasDestCoords ? "No ETA yet" : "📍 No coords"}
        </span>
      )}

      {refreshEtaAction && (
        <button
          onClick={handleRefresh}
          disabled={isPending || phase === "loading" || !hasDestCoords}
          title={!hasDestCoords ? "Destination coordinates missing" : "Refresh live ETA"}
          style={{
            fontSize: "0.6875rem",
            padding: "2px 7px",
            borderRadius: 4,
            border: "1px solid var(--cs-border)",
            backgroundColor:
              phase === "error"
                ? "#FEF2F2"
                : isPending || phase === "loading"
                ? "#F7F3EB"
                : "var(--cs-surface)",
            color:
              phase === "error"
                ? "#991B1B"
                : !hasDestCoords
                ? "#9CA8A2"
                : "var(--cs-text-muted)",
            cursor:
              isPending || phase === "loading" || !hasDestCoords ? "default" : "pointer",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          {phase === "loading" ? "…" : phase === "error" ? "❌" : "↻ ETA"}
        </button>
      )}

      {errorMsg && (
        <span style={{ fontSize: "0.625rem", color: "#991B1B" }}>{errorMsg}</span>
      )}
    </div>
  );
}

function WarningsPanel({ warnings }: { warnings: OperationalWarning[] }) {
  if (warnings.length === 0) return null;

  const severity = maxWarningSeverity(warnings)!;
  const colors = WARNING_COLORS[severity]!;

  return (
    <div
      style={{
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 6,
        padding: "5px 8px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      {warnings.map((w, i) => (
        <div
          key={i}
          style={{
            fontSize: "0.6875rem",
            color: WARNING_COLORS[w.severity]!.color,
            fontWeight: w.severity === "critical" ? 700 : 500,
          }}
        >
          {WARNING_ICONS[w.type]} {w.message}
        </div>
      ))}
    </div>
  );
}

export type ControlBookingCardProps = {
  booking: ControlBooking;
  viewerRole: string;
  paymentAction?: (input: unknown) => Promise<{ success: boolean; error?: string }>;
  statusAction?: (input: unknown) => Promise<{ success: boolean; error?: string }>;
  assignDriverAction?: (input: unknown) => Promise<{ success: boolean; error?: string }>;
  availableDrivers?: AvailableDriver[];
  getTrackingLinkAction?: (
    input: unknown
  ) => Promise<{ ok: boolean; message?: string; error?: string }>;
  refreshEtaAction?: (bookingId: string) => Promise<EtaRefreshResult>;
};

export function ControlBookingCard({
  booking,
  viewerRole,
  paymentAction,
  statusAction,
  assignDriverAction,
  availableDrivers,
  getTrackingLinkAction,
  refreshEtaAction,
}: ControlBookingCardProps) {
  const statusStyle = STATUS_COLORS[booking.status] ?? STATUS_COLORS["pending"]!;
  const payStatus = booking.payment_status ?? "unpaid";
  const payStyle = PAYMENT_STATUS_COLORS[payStatus] ?? PAYMENT_STATUS_COLORS["pending"]!;
  const isHomeService = booking.type === "home_service";
  const dur = durationMins(booking.start_time, booking.end_time);

  // Compute operational warnings for home-service bookings
  const opWarnings = computeOperationalWarnings({
    isHomeService,
    driverId: booking.driver_id,
    location: booking.last_location_at ? { recorded_at: booking.last_location_at } : null,
    destLat: booking.dest_lat,
    destLng: booking.dest_lng,
    needsLocationReview: booking.needs_location_review,
    liveEta: booking.live_eta ?? null,
    bookingEndTime: booking.end_time,
    travelBufferMins: booking.travel_buffer_mins,
  });

  return (
    <div
      className="cs-card"
      style={{
        padding: "0.75rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        borderLeft: `3px solid ${
          isHomeService
            ? "#92400E"
            : booking.status === "in_progress"
            ? "var(--cs-sand)"
            : booking.status === "completed"
            ? "var(--cs-success)"
            : "var(--cs-border)"
        }`,
      }}
    >
      {/* Static dispatch warning from booking metadata */}
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
          {booking.dispatch_warning && <div>⚠️ {booking.dispatch_warning}</div>}
          {booking.needs_location_review && <div>📍 Location needs review</div>}
        </div>
      )}

      {/* Dynamic operational warnings (Phase 10) */}
      {isHomeService && <WarningsPanel warnings={opWarnings} />}

      {/* Main row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        {/* Time */}
        <div style={{ minWidth: 52, textAlign: "center", flexShrink: 0 }}>
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
            {booking.staff_name && (
              <span style={{ marginLeft: 6 }}>· {booking.staff_name}</span>
            )}
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
              {booking.hs_address && (
                <span style={{ marginLeft: 4 }}>· {booking.hs_address}</span>
              )}
            </div>
          )}

          {/* Driver assignment (home-service only) */}
          {isHomeService && (
            <div style={{ marginTop: 4 }}>
              {assignDriverAction && availableDrivers ? (
                <DriverAssignMenu
                  bookingId={booking.id}
                  currentDriverId={booking.driver_id}
                  currentDriverName={booking.driver_name}
                  availableDrivers={availableDrivers}
                  assignDriverAction={assignDriverAction}
                />
              ) : booking.driver_name ? (
                <span style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)" }}>
                  🚗 {booking.driver_name}
                </span>
              ) : booking.no_driver_warning ? (
                <span style={{ fontSize: "0.6875rem", color: "#B45309", fontWeight: 600 }}>
                  ⚠️ No driver assigned
                </span>
              ) : null}
            </div>
          )}

          {/* Location + tracking link (home-service only) */}
          {isHomeService && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 2,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)" }}>
                {booking.last_location_at ? (
                  <>📡 Location {minutesAgo(booking.last_location_at)}m ago</>
                ) : (
                  <span style={{ opacity: 0.6 }}>📡 No location yet</span>
                )}
              </span>
              {getTrackingLinkAction && (
                <TrackingLinkButton
                  bookingId={booking.id}
                  existingMessage={booking.tracking_message}
                  getTrackingLinkAction={getTrackingLinkAction}
                />
              )}
            </div>
          )}

          {/* Live ETA panel (home-service only) */}
          {isHomeService && (
            <EtaPanel
              bookingId={booking.id}
              initialEta={booking.live_eta ?? null}
              destLat={booking.dest_lat}
              destLng={booking.dest_lng}
              travelBufferMins={booking.travel_buffer_mins}
              refreshEtaAction={refreshEtaAction}
            />
          )}

          {/* Progress stepper */}
          <div style={{ marginTop: 4 }}>
            <ProgressMiniStepper
              status={booking.booking_progress_status}
              type={booking.type}
            />
          </div>
        </div>

        {/* Badges */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 4,
            flexShrink: 0,
          }}
        >
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
