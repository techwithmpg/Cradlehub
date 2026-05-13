import Link from "next/link";
import type { ActiveTripData } from "@/lib/actions/live-ops-actions";
import {
  computeOperationalWarnings,
  maxWarningSeverity,
} from "@/lib/bookings/ops-warnings";

const PROGRESS_CONFIG: Record<string, { label: string; emoji: string }> = {
  not_started:     { label: "Preparing",   emoji: "🌿" },
  travel_started:  { label: "On the way",  emoji: "🚗" },
  arrived:         { label: "Arrived",     emoji: "📍" },
  session_started: { label: "In progress", emoji: "💆" },
  completed:       { label: "Completed",   emoji: "✅" },
};

const SEVERITY_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  critical: { bg: "#FEF2F2", color: "#991B1B", label: "⚡ Critical" },
  warning:  { bg: "#FFFBEB", color: "#92400E", label: "⚠️ Warning" },
  info:     { bg: "#EFF6FF", color: "#1E40AF", label: "ℹ️ Info" },
};

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const hr = h ?? 0;
  const ampm = hr >= 12 ? "PM" : "AM";
  const display = hr % 12 === 0 ? 12 : hr % 12;
  return `${display}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

function minutesAgo(isoTs: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(isoTs).getTime()) / 60000));
}

function formatEtaAge(calculatedAt: string): string {
  const mins = Math.floor((Date.now() - new Date(calculatedAt).getTime()) / 60000);
  if (mins < 1) return "just now";
  return `${mins}m ago`;
}

export type OpsTripListProps = {
  trips: ActiveTripData[];
  controlPath: string;
};

export function OpsTripList({ trips, controlPath }: OpsTripListProps) {
  if (trips.length === 0) {
    return (
      <div
        style={{
          padding: "2rem 1rem",
          textAlign: "center",
          color: "#9CA8A2",
          fontSize: "0.875rem",
          background: "#FFFFFF",
          borderRadius: 10,
          boxShadow: "0 1px 4px rgba(22,58,43,0.07)",
        }}
      >
        No active home-service trips right now.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {trips.map((trip) => {
        const progress =
          PROGRESS_CONFIG[trip.booking_progress_status ?? "not_started"] ??
          PROGRESS_CONFIG["not_started"]!;

        const warnings = computeOperationalWarnings({
          isHomeService: true,
          driverId: trip.driver_id,
          location: trip.location ? { recorded_at: trip.location.recorded_at } : null,
          destLat: trip.dest_lat,
          destLng: trip.dest_lng,
          liveEta: trip.live_eta,
          bookingEndTime: trip.end_time,
        });
        const topSeverity = maxWarningSeverity(warnings);
        const severityBadge = topSeverity ? SEVERITY_BADGE[topSeverity] : null;

        const eta = trip.live_eta;

        return (
          <div
            key={trip.id}
            style={{
              background: "#FFFFFF",
              borderRadius: 10,
              padding: "0.875rem 1rem",
              boxShadow: "0 1px 4px rgba(22,58,43,0.07)",
              borderLeft: `3px solid ${
                topSeverity === "critical"
                  ? "#EF4444"
                  : topSeverity === "warning"
                  ? "#F59E0B"
                  : "#C8A96B"
              }`,
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 3,
              }}
            >
              <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#163A2B" }}>
                {trip.customer_name ?? "Unknown Customer"}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, marginLeft: 8 }}>
                {severityBadge && (
                  <span
                    style={{
                      fontSize: "0.625rem",
                      fontWeight: 700,
                      padding: "2px 5px",
                      borderRadius: 3,
                      background: severityBadge.bg,
                      color: severityBadge.color,
                    }}
                  >
                    {severityBadge.label}
                  </span>
                )}
                <span style={{ fontSize: "0.75rem", color: "#9CA8A2" }}>
                  {formatTime(trip.start_time)}
                </span>
              </div>
            </div>

            <div style={{ fontSize: "0.8125rem", color: "#6B7A6F", marginBottom: 3 }}>
              {trip.service_name ?? "Wellness Service"}
            </div>

            <div style={{ fontSize: "0.75rem", color: "#6B7A6F", marginBottom: 3 }}>
              {trip.therapist_name && <span>👤 {trip.therapist_name}</span>}
              {trip.driver_name ? (
                <span style={{ marginLeft: trip.therapist_name ? 8 : 0 }}>
                  🚗 {trip.driver_name}
                </span>
              ) : (
                <span
                  style={{
                    marginLeft: trip.therapist_name ? 8 : 0,
                    color: "#B45309",
                    fontWeight: 600,
                  }}
                >
                  ⚠️ No driver
                </span>
              )}
            </div>

            <div style={{ fontSize: "0.75rem", color: "#6B7A6F", marginBottom: 3 }}>
              {progress.emoji} {progress.label}
            </div>

            {/* Location */}
            {trip.location ? (
              <div style={{ fontSize: "0.75rem", color: "#059669" }}>
                📡 {minutesAgo(trip.location.recorded_at)}m ago
              </div>
            ) : (
              <div style={{ fontSize: "0.75rem", color: "#9CA8A2" }}>
                📡 No location yet
              </div>
            )}

            {/* Live ETA */}
            {eta ? (
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#163A2B",
                  marginTop: 3,
                }}
              >
                🗺️ ETA {eta.eta_minutes}m
                <span
                  style={{
                    fontWeight: 400,
                    color: "#9CA8A2",
                    marginLeft: 4,
                    fontSize: "0.6875rem",
                  }}
                >
                  · {formatEtaAge(eta.calculated_at)}
                </span>
              </div>
            ) : trip.dest_lat && trip.dest_lng ? (
              <div style={{ fontSize: "0.6875rem", color: "#9CA8A2", marginTop: 3 }}>
                🗺️ No ETA — use Control to refresh
              </div>
            ) : null}

            {/* Warning messages */}
            {warnings.length > 0 && (
              <div
                style={{
                  marginTop: 5,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                {warnings.slice(0, 3).map((w, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: "0.625rem",
                      color:
                        w.severity === "critical"
                          ? "#991B1B"
                          : w.severity === "warning"
                          ? "#92400E"
                          : "#1E40AF",
                    }}
                  >
                    {w.message}
                  </div>
                ))}
                {warnings.length > 3 && (
                  <div style={{ fontSize: "0.625rem", color: "#9CA8A2" }}>
                    +{warnings.length - 3} more…
                  </div>
                )}
              </div>
            )}

            {/* Destination address */}
            {trip.hs_address && (
              <div
                style={{
                  fontSize: "0.6875rem",
                  color: "#9CA8A2",
                  marginTop: 4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                📍 {trip.hs_address}
              </div>
            )}

            <Link
              href={controlPath}
              style={{
                display: "inline-block",
                marginTop: "0.5rem",
                fontSize: "0.75rem",
                color: "#163A2B",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Open Control →
            </Link>
          </div>
        );
      })}
    </div>
  );
}
