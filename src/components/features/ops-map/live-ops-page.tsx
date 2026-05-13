"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { getActiveTripsForOpsMap } from "@/lib/actions/live-ops-actions";
import type { ActiveTripData } from "@/lib/actions/live-ops-actions";
import { OpsTripList } from "./ops-trip-list";

const OpsMap = dynamic(() => import("./ops-map").then((m) => m.OpsMap), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: 440,
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
  ),
});

const POLL_INTERVAL_MS = 30_000;

export type LiveOpsPageProps = {
  branchName: string;
  todayLabel: string;
  initialTrips: ActiveTripData[];
  controlPath: string;
};

export function LiveOpsPage({
  branchName,
  todayLabel,
  initialTrips,
  controlPath,
}: LiveOpsPageProps) {
  const [trips, setTrips] = useState<ActiveTripData[]>(initialTrips);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<number>(() => Date.now());
  const isRefreshingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    try {
      const result = await getActiveTripsForOpsMap();
      setTrips(result);
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
      setLastRefreshAt(Date.now());
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const withLocation = trips.filter((t) => t.location !== null).length;
  const noLocation = trips.length - withLocation;

  return (
    <div>
      <div style={{ marginBottom: "1.25rem" }}>
        <h1
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "var(--cs-text, #163A2B)",
            margin: 0,
          }}
        >
          Live Operations Map
        </h1>
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--cs-text-muted, #6B7A6F)",
            margin: "0.25rem 0 0",
          }}
        >
          {branchName} · {todayLabel}
        </p>
      </div>

      {/* KPI strip */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <KpiChip label="Active trips" value={trips.length} />
        <KpiChip label="With location" value={withLocation} />
        <KpiChip label="No location" value={noLocation} muted={noLocation === 0} />
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span
            style={{ fontSize: "0.75rem", color: "var(--cs-text-muted, #6B7A6F)" }}
          >
            {new Date(lastRefreshAt).toLocaleTimeString("en-PH", {
              hour: "2-digit",
              minute: "2-digit",
            })}
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
            }}
          >
            {isRefreshing ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* Map + trip list */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: "1.25rem",
          alignItems: "start",
        }}
      >
        <div
          className="cs-card"
          style={{ padding: "1rem", overflow: "hidden" }}
        >
          <OpsMap trips={trips} />
          <p
            style={{
              marginTop: "0.75rem",
              fontSize: "0.75rem",
              color: "var(--cs-text-muted, #6B7A6F)",
              margin: "0.75rem 0 0",
            }}
          >
            🔵 Staff / driver location &nbsp;·&nbsp; 🔴 Customer destination
          </p>
        </div>

        <div style={{ maxHeight: 540, overflowY: "auto" }}>
          <OpsTripList trips={trips} controlPath={controlPath} />
        </div>
      </div>

      <p
        style={{
          marginTop: "1rem",
          fontSize: "0.6875rem",
          color: "var(--cs-text-muted, #9CA8A2)",
          textAlign: "center",
        }}
      >
        Auto-refreshes every 30 s · Branch-scoped · Internal use only
      </p>
    </div>
  );
}

function KpiChip({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 8,
        padding: "0.5rem 0.875rem",
        boxShadow: "0 1px 4px rgba(22,58,43,0.07)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <span
        style={{
          fontSize: "1.125rem",
          fontWeight: 700,
          color: muted ? "#9CA8A2" : "var(--cs-text, #163A2B)",
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: "0.6875rem",
          color: "var(--cs-text-muted, #6B7A6F)",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}
