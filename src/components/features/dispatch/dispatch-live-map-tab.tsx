"use client";

/**
 * DispatchLiveMapTab — Tab 2
 *
 * Left:   Active trips list (in_route, arrived_at_customer, service_started).
 * Center: Live map area — honest empty state (no map integration is wired yet).
 *         Driver location snapshots are collected in staff_location_snapshots
 *         and customer coordinates in metadata.home_service_address, but no
 *         map rendering library is connected. When integration is added, replace
 *         the placeholder div with the map component.
 * Right:  Selected trip detail panel (visible after selecting a trip card).
 *
 * No fake data. No fake route lines. No fake location markers.
 */

import { useState } from "react";
import {
  Car,
  User,
  MapPin,
  Clock,
  Navigation,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatTime12h } from "@/lib/utils/time-format";
import type { DispatchData, RealDispatchItem } from "@/lib/queries/dispatch-queries";
import type { DispatchStatus } from "@/features/dispatch/types";

// ── Status helpers (local to this tab) ────────────────────────────────────────

function tripStatusBadge(s: DispatchStatus): { label: string; cls: string } {
  switch (s) {
    case "in_route":
      return { label: "En Route", cls: "border-purple-400 text-purple-700 bg-purple-50" };
    case "arrived_at_customer":
      return { label: "Arrived", cls: "border-cyan-400 text-cyan-700 bg-cyan-50" };
    case "service_started":
      return { label: "In Service", cls: "border-green-500 text-green-700 bg-green-50" };
    default:
      return { label: "Active", cls: "border-blue-400 text-blue-700 bg-blue-50" };
  }
}

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

// ── Trip card (left panel list) ───────────────────────────────────────────────

function TripCard({
  item,
  selected,
  onSelect,
}: {
  item: RealDispatchItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const badge = tripStatusBadge(item.dispatchStatus);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border px-4 py-3 text-left transition-colors hover:border-[var(--cs-sand)] ${
        selected
          ? "border-[var(--cs-sand)] bg-[var(--cs-sand-tint)]"
          : "border-[var(--cs-border)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold"
            style={{ color: "var(--cs-text)" }}
          >
            {item.customerName}
          </p>
          <p
            className="text-xs"
            style={{ color: "var(--cs-text-secondary)" }}
          >
            {item.driverName ?? "No driver"} · {formatTime12h(item.startTime)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant="outline" className={`text-xs ${badge.cls}`}>
            {badge.label}
          </Badge>
          {item.etaMinutes !== null && (
            <span
              className="text-xs"
              style={{ color: "var(--cs-text-muted)" }}
            >
              ETA {item.etaMinutes}m
            </span>
          )}
        </div>
      </div>

      {item.formattedAddress && (
        <div
          className="mt-1.5 flex items-center gap-1 text-xs"
          style={{ color: "var(--cs-text-muted)" }}
        >
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {item.area ?? item.formattedAddress.slice(0, 45)}
          </span>
        </div>
      )}

      {/* Live location badge */}
      {item.currentLocation && (
        <div
          className="mt-1.5 text-xs"
          style={{ color: "var(--cs-success)" }}
        >
          ● Live location available
        </div>
      )}
    </button>
  );
}

// ── Detail row ────────────────────────────────────────────────────────────────

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span style={{ color: "var(--cs-text-muted)", marginTop: 2 }}>
        {icon}
      </span>
      <span
        className="w-20 shrink-0 text-xs font-medium"
        style={{ color: "var(--cs-text-muted)" }}
      >
        {label}
      </span>
      <span
        className="min-w-0 flex-1 text-xs break-words"
        style={{ color: "var(--cs-text-secondary)" }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Selected trip detail panel ─────────────────────────────────────────────────

function TripDetailPanel({ item }: { item: RealDispatchItem }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3
          className="text-base font-semibold"
          style={{ color: "var(--cs-text)" }}
        >
          {item.customerName}
        </h3>
        <p
          className="mt-0.5 text-sm"
          style={{ color: "var(--cs-text-secondary)" }}
        >
          {item.serviceName} · {formatTime12h(item.startTime)}
        </p>
      </div>

      <div className="space-y-2">
        <DetailRow
          icon={<Car className="h-3.5 w-3.5" />}
          label="Driver"
          value={item.driverName ?? "Not assigned"}
        />
        <DetailRow
          icon={<User className="h-3.5 w-3.5" />}
          label="Therapist"
          value={item.therapistName ?? "Not assigned"}
        />
        <DetailRow
          icon={<MapPin className="h-3.5 w-3.5" />}
          label="Address"
          value={item.formattedAddress ?? "No address recorded"}
        />
        {item.etaMinutes !== null && (
          <DetailRow
            icon={<Clock className="h-3.5 w-3.5" />}
            label="ETA"
            value={`${item.etaMinutes} minutes`}
          />
        )}
        {item.travelStartedAt && (
          <DetailRow
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Started"
            value={formatTs(item.travelStartedAt)}
          />
        )}
        {item.arrivedAt && (
          <DetailRow
            icon={<MapPin className="h-3.5 w-3.5" />}
            label="Arrived"
            value={formatTs(item.arrivedAt)}
          />
        )}
      </div>

      {/* Live location data (coordinates, not rendered on a map) */}
      {item.currentLocation && (
        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{
            background: "var(--cs-surface-warm)",
            border: "1px solid var(--cs-border-soft)",
          }}
        >
          <p
            className="mb-0.5 font-semibold"
            style={{ color: "var(--cs-text-muted)" }}
          >
            Last location snapshot
          </p>
          <p style={{ color: "var(--cs-text-secondary)" }}>
            {item.currentLocation.lat.toFixed(5)},{" "}
            {item.currentLocation.lng.toFixed(5)}
          </p>
          <p style={{ color: "var(--cs-text-muted)" }}>
            Recorded at {formatTs(item.currentLocation.recorded_at)}
          </p>
        </div>
      )}

      <Link
        href="/crm/bookings"
        className="text-xs font-medium"
        style={{ color: "var(--cs-sand)", textDecoration: "none" }}
      >
        View in Bookings →
      </Link>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function DispatchLiveMapTab({ data }: { data: DispatchData }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeTrips = data.items.filter((i) =>
    ["in_route", "arrived_at_customer", "service_started"].includes(
      i.dispatchStatus
    )
  );

  const selectedTrip = selectedId
    ? (data.items.find((i) => i.id === selectedId) ?? null)
    : null;

  const tripsWithLocation = data.items.filter((i) => i.currentLocation).length;
  const tripsMissingCoords = data.items.filter(
    (i) =>
      (i.lat === null || i.lng === null) &&
      i.dispatchStatus !== "cancelled" &&
      i.dispatchStatus !== "completed"
  ).length;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* ── Left: Active trips ── */}
      <div className="flex flex-col gap-4">
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--cs-text)" }}
        >
          Active Trips ({activeTrips.length})
        </h2>

        {activeTrips.length === 0 ? (
          <div
            className="flex flex-col items-center gap-2 rounded-xl py-12 text-center"
            style={{
              border: "1px dashed var(--cs-border)",
            }}
          >
            <Navigation
              className="h-6 w-6"
              style={{ color: "var(--cs-text-muted)" }}
            />
            <p
              className="text-sm"
              style={{ color: "var(--cs-text-secondary)" }}
            >
              No active trips right now.
            </p>
            <p className="text-xs" style={{ color: "var(--cs-text-muted)" }}>
              Active trips appear here when drivers are en route.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeTrips.map((trip) => (
              <TripCard
                key={trip.id}
                item={trip}
                selected={selectedId === trip.id}
                onSelect={() =>
                  setSelectedId(selectedId === trip.id ? null : trip.id)
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Center + Right: Map area + selected detail ── */}
      <div className="flex flex-col gap-4 lg:col-span-2">
        {/* Map placeholder — honest empty state */}
        <div
          className="flex min-h-[360px] flex-col items-center justify-center gap-5 rounded-xl p-8 text-center"
          style={{
            background: "var(--cs-surface-warm)",
            border: "1px solid var(--cs-border-soft)",
          }}
        >
          <div style={{ fontSize: 40, lineHeight: 1 }}>🗺️</div>
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--cs-text)" }}
            >
              Live Map
            </p>
            <p
              className="mt-1.5 max-w-sm text-xs"
              style={{ color: "var(--cs-text-secondary)" }}
            >
              Live map will appear here when a map integration (Google Maps or
              similar) is connected. Driver location and customer destination
              coordinates are already being collected.
            </p>
          </div>

          {/* Status of location data we do have */}
          <div className="space-y-2">
            {tripsWithLocation > 0 && (
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                style={{
                  background: "var(--cs-success-bg)",
                  color: "var(--cs-success-text)",
                }}
              >
                <CheckIcon />
                {tripsWithLocation} trip{tripsWithLocation !== 1 ? "s have" : " has"}{" "}
                live location snapshots
              </div>
            )}
            {tripsMissingCoords > 0 && (
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                style={{
                  background: "var(--cs-warning-bg)",
                  color: "var(--cs-warning-text)",
                }}
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {tripsMissingCoords} booking{tripsMissingCoords !== 1 ? "s are" : " is"}{" "}
                missing destination coordinates
              </div>
            )}
          </div>

          <p className="text-xs" style={{ color: "var(--cs-text-muted)" }}>
            Missing coordinates?{" "}
            <Link
              href="/crm/bookings"
              className="underline"
              style={{ color: "var(--cs-sand)" }}
            >
              Review booking addresses
            </Link>
          </p>
        </div>

        {/* Selected trip detail */}
        {selectedTrip && (
          <div className="cs-card p-5">
            <p
              className="mb-3 text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--cs-text-muted)" }}
            >
              Trip Detail
            </p>
            <TripDetailPanel item={selectedTrip} />
          </div>
        )}

        {!selectedTrip && activeTrips.length > 0 && (
          <p
            className="text-center text-xs"
            style={{ color: "var(--cs-text-muted)" }}
          >
            Select a trip from the list to see details
          </p>
        )}
      </div>
    </div>
  );
}

// Inline check icon to avoid lucide import for trivial case
function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
