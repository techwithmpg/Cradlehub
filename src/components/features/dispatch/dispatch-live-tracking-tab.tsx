"use client";

import { useState } from "react";
import { DispatchMockMap } from "./dispatch-mock-map";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";
import type { TripStep } from "./types";

const ACCENT = "#6D28D9";

interface DispatchLiveTrackingTabProps {
  activeItems: RealDispatchItem[];
}

export function DispatchLiveTrackingTab({ activeItems }: DispatchLiveTrackingTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(activeItems[0]?.id ?? null);
  const selected = activeItems.find((t) => t.id === selectedId) ?? activeItems[0] ?? null;

  if (activeItems.length === 0) {
    return (
      <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--cs-text-subtle)", fontSize: 13 }}>
        No active trips right now.
      </div>
    );
  }

  return (
    <div
      style={{
        display:             "grid",
        gridTemplateColumns: "220px minmax(0, 1fr) 240px",
        gap:                 "0.75rem",
        alignItems:          "start",
      }}
    >
      {/* Left: active trip list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
          Active Trips
        </div>
        {activeItems.map((trip) => (
          <TripCard
            key={trip.id}
            trip={trip}
            isActive={selectedId === trip.id}
            onClick={() => setSelectedId(trip.id)}
          />
        ))}
      </div>

      {/* Middle: route map + timeline */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {selected?.lat && selected?.lng ? (
          <DispatchMockMap variant="route" height={300} />
        ) : (
          <div
            style={{
              height:         300,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              background:     "var(--cs-surface)",
              border:         "1px solid var(--cs-border-soft)",
              borderRadius:   "var(--cs-r-md)",
              color:          "var(--cs-text-subtle)",
              fontSize:       13,
              textAlign:      "center",
              padding:        "1rem",
            }}
          >
            Route preview unavailable until customer location is confirmed.
          </div>
        )}
        {selected && <TripTimeline item={selected} />}
      </div>

      {/* Right: trip summary */}
      {selected && <TripSummaryPanel item={selected} />}
    </div>
  );
}

function TripCard({ trip, isActive, onClick }: { trip: RealDispatchItem; isActive: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background:   "var(--cs-surface)",
        border:       `1.5px solid ${isActive ? ACCENT : "var(--cs-border-soft)"}`,
        borderRadius: "var(--cs-r-md)",
        padding:      "0.625rem 0.75rem",
        cursor:       "pointer",
        transition:   "border-color 0.15s",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 2 }}>{trip.number}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)", marginBottom: 2 }}>{trip.customerName}</div>
      <div style={{ fontSize: 11.5, color: "var(--cs-text-muted)", marginBottom: 3 }}>
        {trip.dispatchStatus.replace(/_/g, " ")}
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--cs-text)" }}>
        {trip.etaMinutes !== null ? `ETA: ${trip.etaMinutes} min` : "ETA unavailable"}
      </div>
    </div>
  );
}

function deriveTimeline(item: RealDispatchItem): TripStep[] {
  const steps: { label: string; ts: string | null }[] = [
    { label: "Confirmed",       ts: item.bookingDate },
    { label: "Driver Departed", ts: item.travelStartedAt },
    { label: "Arrived",         ts: item.arrivedAt },
    { label: "Service Started", ts: item.sessionStartedAt },
    { label: "Completed",       ts: item.completedAt },
  ];

  const firstPendingIdx = steps.findIndex((s) => !s.ts);

  return steps.map((s, i) => ({
    label: s.label,
    time: s.ts ? new Date(s.ts).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true }) : undefined,
    state:
      s.ts ? "done" :
      i === firstPendingIdx ? "active" :
      "pending",
  }));
}

function TripTimeline({ item }: { item: RealDispatchItem }) {
  const steps = deriveTimeline(item);
  return (
    <div
      style={{
        background:   "var(--cs-surface)",
        border:       "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-md)",
        padding:      "0.875rem 1rem",
      }}
    >
      <div
        style={{
          display:        "flex",
          alignItems:     "flex-start",
          justifyContent: "space-between",
          position:       "relative",
        }}
      >
        <div
          style={{
            position:   "absolute",
            top:        9,
            left:       "5%",
            right:      "5%",
            height:     2,
            background: "var(--cs-border-soft)",
            zIndex:     0,
          }}
        />
        {steps.map((step, i) => (
          <StepDot key={i} step={step} />
        ))}
      </div>
    </div>
  );
}

function StepDot({ step }: { step: TripStep }) {
  const color =
    step.state === "done"   ? "#16A34A" :
    step.state === "active" ? ACCENT    : "var(--cs-border-soft)";
  const textColor =
    step.state === "done"   ? "#16A34A" :
    step.state === "active" ? ACCENT    : "var(--cs-text-subtle)";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, zIndex: 1, flex: 1 }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", background: color, border: `2px solid ${color}`, flexShrink: 0 }} />
      <div style={{ fontSize: 10.5, fontWeight: 600, color: textColor, textAlign: "center", whiteSpace: "nowrap" }}>
        {step.label}
      </div>
      {step.time && (
        <div style={{ fontSize: 10, color: "var(--cs-text-subtle)", textAlign: "center" }}>
          {step.time}
        </div>
      )}
    </div>
  );
}

function TripSummaryPanel({ item }: { item: RealDispatchItem }) {
  const lastUpdate = item.currentLocation?.recorded_at
    ? new Date(item.currentLocation.recorded_at).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true })
    : null;

  const fields = [
    { label: "Driver",      value: item.driverName ?? "Not assigned" },
    { label: "Therapist",   value: item.therapistName ?? "—" },
    { label: "Destination", value: item.area ?? item.formattedAddress ?? "Location not confirmed" },
    { label: "ETA",         value: item.etaMinutes !== null ? `${item.etaMinutes} min` : "ETA unavailable" },
    { label: "Traffic",     value: "Not available" },
    { label: "Last Update", value: lastUpdate ?? "Not available" },
  ];

  return (
    <div
      style={{
        background:   "var(--cs-surface)",
        border:       "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-md)",
        padding:      "1rem 1.125rem",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cs-text)", marginBottom: "0.875rem" }}>
        Trip Summary
      </div>
      {fields.map((f) => (
        <div key={f.label} style={{ marginBottom: "0.625rem" }}>
          <div style={{ fontSize: 10.5, fontWeight: 500, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>
            {f.label}
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--cs-text)" }}>{f.value}</div>
        </div>
      ))}
    </div>
  );
}
