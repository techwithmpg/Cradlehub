"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { getPublicTrackingLocationAction } from "@/lib/actions/public-tracking-actions";
import type { PublicTrackingLocation } from "@/lib/actions/public-tracking-actions";

// Load map client-only to avoid SSR/window errors
const TrackingMap = dynamic(
  () => import("./tracking-map").then((m) => m.TrackingMap),
  { ssr: false, loading: () => <MapSkeleton /> }
);

const STATUS_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  not_started:     { label: "Preparing your visit",    emoji: "🌿", color: "#163A2B" },
  travel_started:  { label: "Therapist is on the way", emoji: "🚗", color: "#92400E" },
  arrived:         { label: "Therapist has arrived",   emoji: "📍", color: "#065F46" },
  session_started: { label: "Service is in progress",  emoji: "💆", color: "#163A2B" },
  completed:       { label: "Service completed",       emoji: "✅", color: "#065F46" },
};

export type TrackingPageClientProps = {
  token: string;
  serviceName: string;
  bookingDateLabel: string;
  startTimeLabel: string;
  progressStatus: string;
  bookingStatus: string;
  therapistName: string | null;
  destLat: number | null;
  destLng: number | null;
  destAddress: string | null;
  etaMinutes: number | null;
  initialLocation: PublicTrackingLocation | null;
};

function minutesAgo(isoTs: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(isoTs).getTime()) / 60000));
}

const POLL_INTERVAL_MS = 30_000;

export function TrackingPageClient({
  token,
  serviceName,
  bookingDateLabel,
  startTimeLabel,
  progressStatus,
  bookingStatus,
  therapistName,
  destLat,
  destLng,
  destAddress,
  etaMinutes,
  initialLocation,
}: TrackingPageClientProps) {
  const [location, setLocation] = useState<PublicTrackingLocation | null>(initialLocation);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<number>(() => Date.now());

  const statusConfig = STATUS_CONFIG[progressStatus] ?? STATUS_CONFIG["not_started"]!;
  const isCompleted = bookingStatus === "completed" || progressStatus === "completed";

  const refresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const result = await getPublicTrackingLocationAction(token);
      if (result) setLocation(result);
    } finally {
      setIsRefreshing(false);
      setLastRefreshAt(Date.now());
    }
  }, [token, isRefreshing]);

  // Auto-refresh every 30s while not terminal
  useEffect(() => {
    if (isCompleted) return;
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isCompleted, refresh]);

  return (
    <>
      {/* Status card */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 14,
          padding: "1.125rem 1.25rem",
          boxShadow: "0 1px 6px rgba(22,58,43,0.07)",
          borderLeft: `4px solid ${isCompleted ? "#059669" : "#C8A96B"}`,
        }}
      >
        <div style={{ fontSize: "1.5rem", marginBottom: 4 }}>{statusConfig.emoji}</div>
        <div
          style={{
            fontSize: "1.0625rem",
            fontWeight: 700,
            color: statusConfig.color,
            marginBottom: 6,
          }}
        >
          {statusConfig.label}
        </div>
        <div style={{ fontSize: "0.8125rem", color: "#6B7A6F" }}>
          {serviceName}
          {therapistName && (
            <span style={{ marginLeft: 4 }}>· {therapistName}</span>
          )}
        </div>
        <div style={{ fontSize: "0.75rem", color: "#9CA8A2", marginTop: 2 }}>
          {bookingDateLabel} · {startTimeLabel}
        </div>
      </div>

      {/* ETA row */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 10,
          padding: "0.75rem 1rem",
          fontSize: "0.8125rem",
          color: "#6B7A6F",
          boxShadow: "0 1px 4px rgba(22,58,43,0.05)",
        }}
      >
        {isCompleted ? (
          <span style={{ color: "#065F46", fontWeight: 600 }}>
            ✅ Your session has ended. Thank you for choosing Cradle!
          </span>
        ) : etaMinutes != null ? (
          <>⏱ Estimated arrival: <strong style={{ color: "#163A2B" }}>{etaMinutes} min</strong></>
        ) : (
          <span>⏱ ETA will appear once the trip starts.</span>
        )}
      </div>

      {/* Map */}
      {!isCompleted && (
        <div>
          <TrackingMap
            driverLat={location?.lat ?? null}
            driverLng={location?.lng ?? null}
            destLat={destLat}
            destLng={destLng}
            destAddress={destAddress ?? undefined}
          />
        </div>
      )}

      {/* Location status + refresh */}
      {!isCompleted && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.8125rem",
            color: "#6B7A6F",
            gap: "0.5rem",
          }}
        >
          <span>
            {location ? (
              <>📡 Last location: <strong>{minutesAgo(location.recorded_at)}m ago</strong></>
            ) : (
              <>📡 No location shared yet</>
            )}
          </span>
          <button
            onClick={refresh}
            disabled={isRefreshing}
            style={{
              fontSize: "0.75rem",
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid #D4C9A8",
              background: isRefreshing ? "#F7F3EB" : "#FFFFFF",
              color: "#163A2B",
              cursor: isRefreshing ? "default" : "pointer",
              fontWeight: 500,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {isRefreshing ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>
      )}

      {/* Privacy / info note */}
      <p
        style={{
          fontSize: "0.75rem",
          color: "#9CA8A2",
          textAlign: "center",
          margin: "0.25rem 0 0",
          lineHeight: 1.6,
        }}
      >
        Location is shared only during active home-service trips.
        <br />
        This link expires 24 hours after it was generated.
      </p>

      {/* Last page refresh */}
      <p
        style={{
          fontSize: "0.6875rem",
          color: "#B8C2BC",
          textAlign: "center",
          margin: 0,
        }}
      >
        Page checked: {new Date(lastRefreshAt).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
        {!isCompleted && " · Auto-refreshes every 30 sec"}
      </p>
    </>
  );
}

function MapSkeleton() {
  return (
    <div
      style={{
        width: "100%",
        height: 280,
        borderRadius: 12,
        background: "#E8E8E8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#9CA8A2",
        fontSize: "0.875rem",
      }}
    >
      Loading map…
    </div>
  );
}
