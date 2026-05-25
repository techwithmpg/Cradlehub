"use client";

/**
 * DispatchTravelProgressTab — Tab 3
 *
 * Shows all non-cancelled home-service trips for today with a visual
 * progress stage indicator and key timestamps.
 *
 * Desktop: responsive table with progress dots.
 * Mobile:  stacked cards.
 *
 * Progress stages (derived from dispatchStatus + driverId):
 *   Confirmed → Driver → En Route → Arrived → In Service → Done
 *
 * No fake data. Status values and timestamps sourced from RealDispatchItem.
 */

import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatTime12h } from "@/lib/utils/time-format";
import type { DispatchData, RealDispatchItem } from "@/lib/queries/dispatch-queries";
import type { DispatchStatus } from "@/features/dispatch/types";

// ── Progress stages ────────────────────────────────────────────────────────────

type StageKey =
  | "confirmed"
  | "driver"
  | "enRoute"
  | "arrived"
  | "inService"
  | "done";

const STAGE_LABELS: Record<StageKey, string> = {
  confirmed: "Confirmed",
  driver:    "Driver",
  enRoute:   "En Route",
  arrived:   "Arrived",
  inService: "In Service",
  done:      "Done",
};

const STAGE_KEYS: StageKey[] = [
  "confirmed",
  "driver",
  "enRoute",
  "arrived",
  "inService",
  "done",
];

function getReachedStages(item: RealDispatchItem): Record<StageKey, boolean> {
  const s = item.dispatchStatus;
  return {
    confirmed: true,
    driver:    !!item.driverId,
    enRoute:   ["in_route", "arrived_at_customer", "service_started", "completed"].includes(s),
    arrived:   ["arrived_at_customer", "service_started", "completed"].includes(s),
    inService: ["service_started", "completed"].includes(s),
    done:      s === "completed",
  };
}

// ── Status badge helpers ──────────────────────────────────────────────────────

function currentStageLabel(s: DispatchStatus): string {
  switch (s) {
    case "awaiting_driver":     return "Needs Driver";
    case "ready":               return "Ready";
    case "in_route":            return "En Route";
    case "arrived_at_customer": return "Arrived";
    case "service_started":     return "In Service";
    case "completed":           return "Completed";
    case "cancelled":           return "Cancelled";
  }
}

function statusBadgeClass(s: DispatchStatus): string {
  switch (s) {
    case "awaiting_driver":     return "border-amber-400 text-amber-700 bg-amber-50";
    case "ready":               return "border-blue-400 text-blue-700 bg-blue-50";
    case "in_route":            return "border-purple-400 text-purple-700 bg-purple-50";
    case "arrived_at_customer": return "border-cyan-400 text-cyan-700 bg-cyan-50";
    case "service_started":     return "border-green-500 text-green-700 bg-green-50";
    case "completed":           return "border-gray-300 text-gray-500 bg-gray-50";
    case "cancelled":           return "border-red-300 text-red-500 bg-red-50";
  }
}

// ── Last update helper ─────────────────────────────────────────────────────────

function formatTs(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function getLastUpdate(item: RealDispatchItem): string {
  if (item.completedAt) return formatTs(item.completedAt);
  if (item.sessionStartedAt) return formatTs(item.sessionStartedAt);
  if (item.arrivedAt) return formatTs(item.arrivedAt);
  if (item.travelStartedAt) return formatTs(item.travelStartedAt);
  return "—";
}

// ── Progress dots ──────────────────────────────────────────────────────────────

function ProgressDots({ item }: { item: RealDispatchItem }) {
  const reached = getReachedStages(item);

  return (
    <div className="flex items-center" aria-label="Trip progress">
      {STAGE_KEYS.map((key, idx) => {
        const isReached = reached[key];
        return (
          <div key={key} className="flex items-center">
            {/* Stage dot */}
            <div
              title={STAGE_LABELS[key]}
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: isReached
                  ? "var(--cs-success)"
                  : "transparent",
                border: isReached
                  ? "none"
                  : "1.5px solid var(--cs-border-strong)",
                flexShrink: 0,
              }}
            />
            {/* Connector */}
            {idx < STAGE_KEYS.length - 1 && (
              <div
                style={{
                  width: 16,
                  height: 2,
                  background: isReached
                    ? "var(--cs-success)"
                    : "var(--cs-border)",
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Mobile card ────────────────────────────────────────────────────────────────

function ProgressCard({ item }: { item: RealDispatchItem }) {
  return (
    <div className="cs-card p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--cs-text)" }}
          >
            {item.customerName}
          </p>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--cs-text-secondary)" }}
          >
            {item.serviceName} · {formatTime12h(item.startTime)} ·{" "}
            <span
              className="font-mono"
              style={{ color: "var(--cs-text-muted)" }}
            >
              {item.number}
            </span>
          </p>
        </div>
        <Badge
          variant="outline"
          className={`shrink-0 text-xs ${statusBadgeClass(item.dispatchStatus)}`}
        >
          {currentStageLabel(item.dispatchStatus)}
        </Badge>
      </div>

      {/* Staff info */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
        style={{ color: "var(--cs-text-muted)" }}
      >
        {item.therapistName && <span>👤 {item.therapistName}</span>}
        {item.driverName ? (
          <span>🚗 {item.driverName}</span>
        ) : (
          <span className="text-amber-600">🚗 No driver</span>
        )}
        {item.etaMinutes !== null && <span>⏱ ETA {item.etaMinutes}m</span>}
        <span>
          Last: {getLastUpdate(item)}
        </span>
      </div>

      {/* Progress dots */}
      <div>
        <ProgressDots item={item} />
        {/* Stage labels below dots */}
        <div className="mt-1 flex items-center">
          {STAGE_KEYS.map((key, idx) => (
            <div key={key} className="flex items-center">
              <span
                style={{
                  fontSize: "0.5625rem",
                  width: 10,
                  textAlign: "center",
                  color: "var(--cs-text-muted)",
                  display: "block",
                  overflow: "hidden",
                }}
              />
              {idx < STAGE_KEYS.length - 1 && (
                <div style={{ width: 16 }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function DispatchTravelProgressTab({ data }: { data: DispatchData }) {
  // Show all non-cancelled trips (completed trips still informative)
  const visibleItems = data.items.filter(
    (i) => i.dispatchStatus !== "cancelled"
  );

  if (visibleItems.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <CheckCircle2
          className="h-8 w-8"
          style={{ color: "var(--cs-text-muted)" }}
        />
        <p className="text-sm" style={{ color: "var(--cs-text-secondary)" }}>
          No home-service trips to show today.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--cs-text)" }}
        >
          Trip Progress ({visibleItems.length})
        </h2>
        {/* Stage legend */}
        <div
          className="flex flex-wrap items-center gap-3 text-xs"
          style={{ color: "var(--cs-text-muted)" }}
        >
          {Object.entries(STAGE_LABELS).map(([key, label]) => (
            <span key={key} className="flex items-center gap-1">
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--cs-success)",
                  flexShrink: 0,
                }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Mobile: cards */}
      <div className="space-y-3 lg:hidden">
        {visibleItems.map((item) => (
          <ProgressCard key={item.id} item={item} />
        ))}
      </div>

      {/* Desktop: table */}
      <div
        className="hidden overflow-x-auto rounded-xl lg:block"
        style={{ border: "1px solid var(--cs-border-soft)" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr
              style={{
                borderBottom: "1px solid var(--cs-border)",
                background: "var(--cs-surface-warm)",
              }}
            >
              {[
                "#",
                "Customer",
                "Service",
                "Time",
                "Therapist",
                "Driver",
                "Progress",
                "ETA",
                "Last Update",
                "Status",
              ].map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left"
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: "var(--cs-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
              <tr
                key={item.id}
                style={{ borderBottom: "1px solid var(--cs-border-soft)" }}
                className="hover:bg-[var(--cs-sand-tint)] transition-colors"
              >
                <td
                  className="px-4 py-3 font-mono"
                  style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}
                >
                  {item.number}
                </td>
                <td
                  className="px-4 py-3"
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    color: "var(--cs-text)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.customerName}
                </td>
                <td
                  className="px-4 py-3"
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--cs-text-secondary)",
                    maxWidth: 140,
                  }}
                >
                  <span className="block truncate">{item.serviceName}</span>
                </td>
                <td
                  className="px-4 py-3 whitespace-nowrap"
                  style={{ fontSize: "0.75rem", color: "var(--cs-text-secondary)" }}
                >
                  {formatTime12h(item.startTime)}
                </td>
                <td
                  className="px-4 py-3"
                  style={{ fontSize: "0.75rem", color: "var(--cs-text-secondary)", whiteSpace: "nowrap" }}
                >
                  {item.therapistName ?? (
                    <span style={{ color: "var(--cs-text-muted)" }}>—</span>
                  )}
                </td>
                <td
                  className="px-4 py-3 whitespace-nowrap"
                  style={{ fontSize: "0.75rem" }}
                >
                  {item.driverName ? (
                    <span style={{ color: "var(--cs-text-secondary)" }}>
                      {item.driverName}
                    </span>
                  ) : (
                    <span style={{ color: "#B45309" }}>No driver</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <ProgressDots item={item} />
                </td>
                <td
                  className="px-4 py-3 whitespace-nowrap"
                  style={{ fontSize: "0.75rem", color: "var(--cs-text-secondary)" }}
                >
                  {item.etaMinutes !== null ? `${item.etaMinutes}m` : "—"}
                </td>
                <td
                  className="px-4 py-3 whitespace-nowrap"
                  style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}
                >
                  {getLastUpdate(item)}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={`text-xs whitespace-nowrap ${statusBadgeClass(
                      item.dispatchStatus
                    )}`}
                  >
                    {currentStageLabel(item.dispatchStatus)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
