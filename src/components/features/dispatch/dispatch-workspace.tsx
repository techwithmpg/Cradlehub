"use client";

import { useState } from "react";
import { AlertTriangle, Car, CheckCircle2, Clock, MapPin, User, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AssignmentRecommendationPanel } from "@/components/features/assignments/assignment-recommendation-panel";
import { getDriverRecommendationsAction } from "@/lib/actions/assignment-recommendations";
import { assignBookingDriverAction } from "@/lib/actions/driver-actions";
import type { DispatchData, RealDispatchItem } from "@/lib/queries/dispatch-queries";
import type { DispatchStatus } from "@/features/dispatch/types";

// ── Status helpers ──────────────────────────────────────────────────────────

function statusLabel(s: DispatchStatus): string {
  switch (s) {
    case "awaiting_driver":     return "Awaiting Driver";
    case "ready":               return "Ready";
    case "in_route":            return "En Route";
    case "arrived_at_customer": return "Arrived";
    case "service_started":     return "In Service";
    case "completed":           return "Completed";
    case "cancelled":           return "Cancelled";
  }
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";
type StatusStyle = { variant: BadgeVariant; className: string };

function statusStyle(s: DispatchStatus): StatusStyle {
  switch (s) {
    case "awaiting_driver":     return { variant: "outline", className: "border-amber-400 text-amber-700 bg-amber-50" };
    case "ready":               return { variant: "outline", className: "border-blue-400 text-blue-700 bg-blue-50" };
    case "in_route":            return { variant: "outline", className: "border-purple-400 text-purple-700 bg-purple-50" };
    case "arrived_at_customer": return { variant: "outline", className: "border-cyan-400 text-cyan-700 bg-cyan-50" };
    case "service_started":     return { variant: "outline", className: "border-green-500 text-green-700 bg-green-50" };
    case "completed":           return { variant: "secondary", className: "text-[var(--cs-text-secondary)]" };
    case "cancelled":           return { variant: "outline", className: "border-red-300 text-red-600 bg-red-50" };
  }
}

function fmt12h(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "amber" | "blue" | "green" | "red" | "default";
}) {
  const colorMap: Record<string, string> = {
    amber:   "text-amber-600",
    blue:    "text-blue-600",
    green:   "text-green-600",
    red:     "text-red-600",
    default: "text-[var(--cs-text)]",
  };
  const color = colorMap[tone ?? "default"] ?? colorMap["default"];
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className="text-xs text-[var(--cs-text-secondary)]">{label}</span>
    </Card>
  );
}

function AlertBanner({ alerts }: { alerts: DispatchData["alerts"] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-[var(--cs-text)]">Active Alerts</h2>
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
            alert.severity === "danger"
              ? "border-red-200 bg-red-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <AlertTriangle
            className={`mt-0.5 h-4 w-4 shrink-0 ${
              alert.severity === "danger" ? "text-red-500" : "text-amber-500"
            }`}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--cs-text)]">
              {alert.dispatchNumber} · {alert.title}
            </p>
            <p className="text-xs text-[var(--cs-text-secondary)]">{alert.description}</p>
          </div>
          <span className="ml-auto shrink-0 text-xs text-[var(--cs-text-secondary)]">
            {alert.timeAgo}
          </span>
        </div>
      ))}
    </div>
  );
}

function DispatchItemRow({
  item,
  selected,
  onSelect,
}: {
  item: RealDispatchItem;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const style = statusStyle(item.dispatchStatus);
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={`w-full rounded-lg border px-4 py-3 text-left transition-colors hover:border-[var(--cs-border-focus)] ${
        selected
          ? "border-[var(--cs-border-focus)] bg-[var(--cs-bg-subtle)]"
          : "border-[var(--cs-border)]"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="w-12 shrink-0 text-xs font-mono text-[var(--cs-text-secondary)]">
          {item.number}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--cs-text)]">
            {item.customerName}
          </p>
          <p className="truncate text-xs text-[var(--cs-text-secondary)]">
            {item.serviceName}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-[var(--cs-text-secondary)]">
            {fmt12h(item.startTime)}
          </span>
          <Badge variant={style.variant} className={`text-xs ${style.className}`}>
            {statusLabel(item.dispatchStatus)}
          </Badge>
        </div>
      </div>

      {selected && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--cs-border)] pt-3 sm:grid-cols-3">
          {item.driverName ? (
            <div className="flex items-center gap-1.5 text-xs text-[var(--cs-text-secondary)]">
              <Car className="h-3.5 w-3.5" />
              <span className="truncate">{item.driverName}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <Car className="h-3.5 w-3.5" />
              <span>No driver assigned</span>
            </div>
          )}

          {item.therapistName && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--cs-text-secondary)]">
              <User className="h-3.5 w-3.5" />
              <span className="truncate">{item.therapistName}</span>
            </div>
          )}

          {item.area || item.formattedAddress ? (
            <div className="flex items-center gap-1.5 text-xs text-[var(--cs-text-secondary)]">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">{item.area ?? item.formattedAddress}</span>
            </div>
          ) : null}

          {item.etaMinutes !== null && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--cs-text-secondary)]">
              <Clock className="h-3.5 w-3.5" />
              <span>ETA {item.etaMinutes}m</span>
            </div>
          )}
        </div>
      )}

      {/* Recommendations for awaiting driver */}
      {selected && item.dispatchStatus === "awaiting_driver" && (
        <div className="mt-3">
          <AssignmentRecommendationPanel
            bookingId={item.id}
            fetchRecommendations={getDriverRecommendationsAction}
            onAssignDriver={(driverId) => {
              assignBookingDriverAction({ bookingId: item.id, driverId });
            }}
            currentDriverId={item.driverId}
            showTherapists={false}
            showDrivers={true}
          />
        </div>
      )}
    </button>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export interface HomeServiceDispatchWorkspaceProps {
  role: string;
  data: DispatchData;
}

export function HomeServiceDispatchWorkspace({
  role,
  data,
}: HomeServiceDispatchWorkspaceProps) {
  const [selectedId, setSelectedId] = useState<string>(data.items[0]?.id ?? "");

  const activeItems = data.items.filter(
    (i) => i.dispatchStatus !== "completed" && i.dispatchStatus !== "cancelled"
  );
  const doneItems = data.items.filter(
    (i) => i.dispatchStatus === "completed" || i.dispatchStatus === "cancelled"
  );

  return (
    <section className="space-y-6 p-4 md:p-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold leading-tight text-[var(--cs-text)]">
          Home Service Dispatch
        </h1>
        <p className="text-sm text-[var(--cs-text-secondary)]">
          {data.today} · {role} view
        </p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total Today" value={data.stats.totalToday} />
        <StatCard label="Awaiting Driver" value={data.stats.awaitingDispatch} tone="amber" />
        <StatCard label="Active Trips" value={data.stats.activeTrips} tone="blue" />
        <StatCard label="Completed" value={data.stats.completedToday} tone="green" />
        <StatCard label="Cancelled" value={data.stats.cancelledToday} tone="red" />
      </div>

      <AlertBanner alerts={data.alerts} />

      {/* Active queue */}
      {activeItems.length === 0 && doneItems.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--cs-border)] py-16">
          <CheckCircle2 className="h-8 w-8 text-[var(--cs-text-muted)]" />
          <p className="text-sm text-[var(--cs-text-secondary)]">
            No home service dispatches scheduled for today.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeItems.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-[var(--cs-text)]">
                Active ({activeItems.length})
              </h2>
              <div className="space-y-2">
                {activeItems.map((item) => (
                  <DispatchItemRow
                    key={item.id}
                    item={item}
                    selected={selectedId === item.id}
                    onSelect={setSelectedId}
                  />
                ))}
              </div>
            </div>
          )}

          {doneItems.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-[var(--cs-text-secondary)]">
                Completed / Cancelled ({doneItems.length})
              </h2>
              <div className="space-y-2 opacity-70">
                {doneItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border border-[var(--cs-border)] px-4 py-3"
                  >
                    <span className="w-12 shrink-0 text-xs font-mono text-[var(--cs-text-secondary)]">
                      {item.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[var(--cs-text)]">
                        {item.customerName}
                      </p>
                      <p className="truncate text-xs text-[var(--cs-text-secondary)]">
                        {item.serviceName}
                      </p>
                    </div>
                    {item.dispatchStatus === "cancelled" ? (
                      <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
