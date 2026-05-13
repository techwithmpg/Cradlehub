"use client";

import { useState, useTransition } from "react";
import { updateBookingProgressAction } from "@/app/(dashboard)/staff-portal/actions";
import { recordStaffLocationSnapshotAction } from "@/lib/actions/location-actions";
import type { BookingProgressStatus } from "@/lib/bookings/progress";

const ZONE_LABELS: Record<string, string> = {
  central_bacolod: "Central Bacolod",
  north_bacolod_talisay: "North / Talisay",
  south_bacolod_alijis: "South / Alijis",
  east_bacolod: "East Bacolod",
  outside_bacolod: "Outside Bacolod",
  unknown: "Zone unconfirmed",
};

const PROGRESS_LABELS: Record<string, string> = {
  not_started: "Not started",
  travel_started: "En route",
  arrived: "Arrived",
  session_started: "Session in progress",
  completed: "Completed",
};

type DriverTrip = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  type: string;
  status: string;
  booking_progress_status: string;
  travel_buffer_mins: number | null;
  travel_started_at: string | null;
  arrived_at: string | null;
  session_started_at: string | null;
  session_completed_at: string | null;
  service_name: string;
  service_duration: number | null;
  customer_name: string;
  therapist_name: string | null;
  hs_address: string | null;
  hs_city: string | null;
  hs_zone: string | null;
  hs_map_url: string | null;
};

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const hr = h ?? 0;
  const ampm = hr >= 12 ? "PM" : "AM";
  const display = hr % 12 === 0 ? 12 : hr % 12;
  return `${display}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

function formatTimestamp(ts: string | null): string | null {
  if (!ts) return null;
  return new Date(ts).toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Location capture button ───────────────────────────────────────────────────
type LocationState =
  | { phase: "idle" }
  | { phase: "requesting" }
  | { phase: "submitting" }
  | { phase: "ok"; ts: number }
  | { phase: "error"; msg: string };

function LocationUpdateButton({ bookingId }: { bookingId: string }) {
  const [state, setState] = useState<LocationState>({ phase: "idle" });

  function handleClick() {
    if (state.phase === "requesting" || state.phase === "submitting") return;

    if (!navigator.geolocation) {
      setState({ phase: "error", msg: "Geolocation is not supported on this device." });
      return;
    }

    setState({ phase: "requesting" });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setState({ phase: "submitting" });
        const result = await recordStaffLocationSnapshotAction({
          bookingId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy ?? undefined,
          source: "gps",
        });
        if (result.ok) {
          setState({ phase: "ok", ts: Date.now() });
          // Reset to idle after 8 seconds so the button is usable again
          setTimeout(() => setState({ phase: "idle" }), 8000);
        } else {
          setState({ phase: "error", msg: result.message });
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState({ phase: "error", msg: "Location permission denied. Enable it in your browser settings." });
        } else {
          setState({ phase: "error", msg: "Could not get location. Try again." });
        }
      },
      { timeout: 10000, maximumAge: 30000, enableHighAccuracy: true }
    );
  }

  const isActive = state.phase === "requesting" || state.phase === "submitting";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
      <button
        onClick={handleClick}
        disabled={isActive || state.phase === "ok"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "5px 12px",
          borderRadius: 6,
          border: "1px solid",
          borderColor: state.phase === "ok" ? "#059669" : state.phase === "error" ? "#FECACA" : "var(--cs-border)",
          backgroundColor: state.phase === "ok" ? "#ECFDF5" : "transparent",
          color: state.phase === "ok" ? "#065F46" : "var(--cs-text-muted)",
          fontSize: "0.75rem",
          fontWeight: 600,
          cursor: isActive || state.phase === "ok" ? "not-allowed" : "pointer",
          opacity: isActive ? 0.7 : 1,
        }}
      >
        {state.phase === "requesting" && "📡 Getting location…"}
        {state.phase === "submitting" && "📡 Updating…"}
        {state.phase === "ok" && "📍 Location updated just now"}
        {(state.phase === "idle" || state.phase === "error") && "📍 Update my location"}
      </button>
      {state.phase === "error" && (
        <div style={{ fontSize: "0.6875rem", color: "#991B1B" }}>{state.msg}</div>
      )}
      <div style={{ fontSize: "0.625rem", color: "var(--cs-text-muted)", lineHeight: 1.4 }}>
        Location is shared only during active home-service trips.
      </div>
    </div>
  );
}

// Next driver actions for home-service progress
function getNextDriverAction(
  status: string
): { label: string; next: BookingProgressStatus } | null {
  switch (status) {
    case "not_started":
      return { label: "Start Trip", next: "travel_started" };
    case "travel_started":
      return { label: "Mark Arrived", next: "arrived" };
    default:
      return null;
  }
}

function TripCard({
  trip,
}: {
  trip: DriverTrip;
}) {
  const [localStatus, setLocalStatus] = useState(trip.booking_progress_status);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const nextAction = getNextDriverAction(localStatus);
  const progressLabel = PROGRESS_LABELS[localStatus] ?? localStatus;

  function handleAction(next: BookingProgressStatus) {
    startTransition(async () => {
      const result = await updateBookingProgressAction({
        bookingId: trip.id,
        nextStatus: next,
      });
      if (result.ok) {
        setLocalStatus(next);
        setFeedback(null);
      } else {
        setFeedback({ ok: false, msg: result.message });
      }
    });
  }

  const isTerminal =
    localStatus === "completed" ||
    localStatus === "session_started" ||
    localStatus === "no_show";

  return (
    <div
      style={{
        backgroundColor: "var(--cs-surface)",
        border: `1px solid ${localStatus === "travel_started" ? "var(--cs-sand)" : localStatus === "arrived" ? "#059669" : "var(--cs-border)"}`,
        borderRadius: "var(--cs-r-lg)",
        overflow: "hidden",
        marginBottom: "0.75rem",
      }}
    >
      {/* Header strip */}
      <div
        style={{
          backgroundColor:
            localStatus === "travel_started"
              ? "#FFF7ED"
              : localStatus === "arrived"
              ? "#ECFDF5"
              : localStatus === "completed"
              ? "#F0FDF4"
              : "var(--cs-surface-warm)",
          padding: "0.625rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--cs-border-soft)",
        }}
      >
        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--cs-text)" }}>
          {formatTime(trip.start_time)}
          {trip.travel_buffer_mins ? (
            <span style={{ fontWeight: 400, color: "var(--cs-text-muted)", marginLeft: 4 }}>
              +{trip.travel_buffer_mins}m buffer
            </span>
          ) : null}
        </span>
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 99,
            backgroundColor:
              localStatus === "travel_started"
                ? "#FEF3C7"
                : localStatus === "arrived"
                ? "#D1FAE5"
                : localStatus === "completed"
                ? "#D1FAE5"
                : "var(--cs-border-soft)",
            color:
              localStatus === "travel_started"
                ? "#92400E"
                : localStatus === "arrived"
                ? "#065F46"
                : localStatus === "completed"
                ? "#065F46"
                : "var(--cs-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {progressLabel}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "0.875rem 1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {/* Customer + service */}
        <div>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--cs-text)", lineHeight: 1.2 }}>
            {trip.customer_name}
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", marginTop: 2 }}>
            {trip.service_name}
            {trip.service_duration ? ` · ${trip.service_duration}min` : ""}
          </div>
        </div>

        {/* Therapist */}
        {trip.therapist_name && (
          <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
            👩‍⚕️ Therapist: <strong style={{ color: "var(--cs-text)" }}>{trip.therapist_name}</strong>
          </div>
        )}

        {/* Location */}
        {(trip.hs_address || trip.hs_zone) && (
          <div
            style={{
              backgroundColor: "#FFF7ED",
              borderRadius: 6,
              padding: "0.5rem 0.75rem",
              fontSize: "0.8125rem",
              color: "#92400E",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 2 }}>
              📍 {ZONE_LABELS[trip.hs_zone ?? "unknown"] ?? trip.hs_zone ?? "Location"}
            </div>
            {trip.hs_address && (
              <div style={{ fontSize: "0.75rem", opacity: 0.85 }}>{trip.hs_address}</div>
            )}
            {trip.hs_city && (
              <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>{trip.hs_city}</div>
            )}
          </div>
        )}

        {/* Timestamps */}
        <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", color: "var(--cs-text-muted)", flexWrap: "wrap" }}>
          {trip.travel_started_at && (
            <span>🚗 Departed {formatTimestamp(trip.travel_started_at)}</span>
          )}
          {trip.arrived_at && (
            <span>📍 Arrived {formatTimestamp(trip.arrived_at)}</span>
          )}
          {trip.session_started_at && (
            <span>✅ Session started {formatTimestamp(trip.session_started_at)}</span>
          )}
          {trip.session_completed_at && (
            <span>🏁 Done {formatTimestamp(trip.session_completed_at)}</span>
          )}
        </div>

        {/* Feedback */}
        {feedback && !feedback.ok && (
          <div
            style={{
              fontSize: "0.8125rem",
              color: "#991B1B",
              backgroundColor: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: 6,
              padding: "0.375rem 0.625rem",
            }}
          >
            {feedback.msg}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: 2 }}>
          {/* Open in Maps */}
          {trip.hs_map_url && (
            <a
              href={trip.hs_map_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "6px 14px",
                borderRadius: 6,
                border: "1px solid #92400E",
                backgroundColor: "#FFF7ED",
                color: "#92400E",
                fontSize: "0.8125rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              🗺️ Open in Maps
            </a>
          )}

          {/* Progress action */}
          {nextAction && !isTerminal && (
            <button
              onClick={() => handleAction(nextAction.next)}
              disabled={isPending}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                backgroundColor:
                  nextAction.next === "arrived" ? "#059669" : "var(--cs-sand)",
                color: "#fff",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.7 : 1,
              }}
            >
              {isPending
                ? "Updating…"
                : nextAction.next === "travel_started"
                ? "🚗 " + nextAction.label
                : "📍 " + nextAction.label}
            </button>
          )}
        </div>

        {/* Location sharing — only during active travel */}
        {(localStatus === "travel_started" || localStatus === "arrived") && (
          <LocationUpdateButton bookingId={trip.id} />
        )}
      </div>
    </div>
  );
}

export function DriverTripList({
  trips,
}: {
  trips: DriverTrip[];
}) {
  if (trips.length === 0) {
    return (
      <div
        style={{
          backgroundColor: "var(--cs-surface-warm)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-lg)",
          padding: "2.5rem 1.5rem",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🚗</div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.125rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            marginBottom: "0.375rem",
          }}
        >
          No trips assigned today
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--cs-text-muted)", maxWidth: 360, margin: "0 auto" }}>
          Your home-service assignments will appear here once a manager or CSR dispatches a booking to you.
        </p>
      </div>
    );
  }

  const active = trips.filter(
    (t) => t.booking_progress_status !== "completed" && t.status !== "completed"
  );
  const done = trips.filter(
    (t) => t.booking_progress_status === "completed" || t.status === "completed"
  );

  return (
    <div>
      {/* Summary strip */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
        }}
      >
        {[
          { label: "Total trips", value: trips.length, color: "var(--cs-text)" },
          { label: "Active", value: active.length, color: "var(--cs-sand)" },
          { label: "Completed", value: done.length, color: "#059669" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            style={{
              backgroundColor: "var(--cs-surface)",
              border: "1px solid var(--cs-border)",
              borderRadius: "var(--cs-r-lg)",
              padding: "0.625rem 1rem",
              minWidth: 90,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "1.375rem", fontWeight: 700, color: kpi.color }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", marginTop: 2 }}>
              {kpi.label}
            </div>
          </div>
        ))}
      </div>

      {/* Active trips */}
      {active.length > 0 && (
        <>
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              color: "var(--cs-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "0.625rem",
            }}
          >
            Active Trips
          </div>
          {active.map((t) => (
            <TripCard key={t.id} trip={t} />
          ))}
        </>
      )}

      {/* Completed trips */}
      {done.length > 0 && (
        <>
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              color: "var(--cs-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "0.625rem",
              marginTop: active.length > 0 ? "1.25rem" : 0,
            }}
          >
            Completed
          </div>
          {done.map((t) => (
            <TripCard key={t.id} trip={t} />
          ))}
        </>
      )}
    </div>
  );
}
