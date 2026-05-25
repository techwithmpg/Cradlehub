"use client";

/**
 * DispatchFlowTab — Tab 1
 *
 * Left:  Booking queue — all today's home-service bookings with status badges,
 *        missing-info indicators, and therapist/driver/address snippets.
 * Right: Selected booking panel — readiness checklist + driver recommendation
 *        (via AssignmentRecommendationPanel) when awaiting a driver.
 *
 * No fake data. All values from RealDispatchItem.
 * AssignmentRecommendationPanel is the existing recommendation UI;
 * driver assignment calls the existing assignBookingDriverAction.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Car,
  User,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Inbox,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AssignmentRecommendationPanel } from "@/components/features/assignments/assignment-recommendation-panel";
import { getDriverRecommendationsAction } from "@/lib/actions/assignment-recommendations";
import { assignBookingDriverAction } from "@/lib/actions/driver-actions";
import { formatTime12h } from "@/lib/utils/time-format";
import type { DispatchData, RealDispatchItem } from "@/lib/queries/dispatch-queries";
import type { DispatchStatus } from "@/features/dispatch/types";

// ── Status helpers ─────────────────────────────────────────────────────────────

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

function statusLabel(s: DispatchStatus): string {
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

function statusBadgeClass(s: DispatchStatus): { variant: BadgeVariant; cls: string } {
  switch (s) {
    case "awaiting_driver":
      return { variant: "outline", cls: "border-amber-400 text-amber-700 bg-amber-50" };
    case "ready":
      return { variant: "outline", cls: "border-blue-400 text-blue-700 bg-blue-50" };
    case "in_route":
      return { variant: "outline", cls: "border-purple-400 text-purple-700 bg-purple-50" };
    case "arrived_at_customer":
      return { variant: "outline", cls: "border-cyan-400 text-cyan-700 bg-cyan-50" };
    case "service_started":
      return { variant: "outline", cls: "border-green-500 text-green-700 bg-green-50" };
    case "completed":
      return { variant: "secondary", cls: "text-[var(--cs-text-secondary)]" };
    case "cancelled":
      return { variant: "outline", cls: "border-red-300 text-red-600 bg-red-50" };
  }
}

function paymentLabel(ps: string): { label: string; cls: string } {
  if (ps === "paid") return { label: "Paid", cls: "border-green-400 text-green-700 bg-green-50" };
  if (ps === "pending") return { label: "Payment Pending", cls: "border-amber-400 text-amber-700 bg-amber-50" };
  if (ps === "unpaid") return { label: "Unpaid", cls: "border-red-300 text-red-600 bg-red-50" };
  return { label: ps, cls: "border-[var(--cs-border)] text-[var(--cs-text-muted)]" };
}

// ── Queue item ─────────────────────────────────────────────────────────────────

function QueueItem({
  item,
  selected,
  onSelect,
}: {
  item: RealDispatchItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const ss = statusBadgeClass(item.dispatchStatus);
  const hasMissingLocation = !item.formattedAddress || item.needsLocationReview;
  const isPendingPayment =
    item.paymentStatus !== "paid" &&
    item.dispatchStatus !== "completed" &&
    item.dispatchStatus !== "cancelled";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border px-4 py-3.5 text-left transition-colors hover:border-[var(--cs-sand)] ${
        selected
          ? "border-[var(--cs-sand)] bg-[var(--cs-sand-tint)]"
          : "border-[var(--cs-border)]"
      }`}
    >
      {/* Top row: booking reference + status badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-xs"
              style={{ color: "var(--cs-text-muted)" }}
            >
              {item.number}
            </span>
            <span
              className="text-xs font-medium"
              style={{ color: "var(--cs-text-muted)" }}
            >
              {formatTime12h(item.startTime)}
            </span>
          </div>
          <p
            className="mt-0.5 text-sm font-semibold truncate"
            style={{ color: "var(--cs-text)" }}
          >
            {item.customerName}
          </p>
          <p
            className="text-xs truncate"
            style={{ color: "var(--cs-text-secondary)" }}
          >
            {item.serviceName}
          </p>
        </div>

        {/* Badges */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant={ss.variant} className={`text-xs ${ss.cls}`}>
            {statusLabel(item.dispatchStatus)}
          </Badge>
          {hasMissingLocation && (
            <Badge
              variant="outline"
              className="text-xs border-red-300 text-red-600 bg-red-50"
            >
              Missing Info
            </Badge>
          )}
          {isPendingPayment && (
            <Badge
              variant="outline"
              className="text-xs border-amber-300 text-amber-600 bg-amber-50"
            >
              Unpaid
            </Badge>
          )}
        </div>
      </div>

      {/* Detail row: address + staff */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {item.formattedAddress ? (
          <span
            className="flex items-center gap-1 text-xs"
            style={{ color: "var(--cs-text-muted)" }}
          >
            <MapPin className="h-3 w-3 shrink-0" />
            {item.area ?? item.formattedAddress.slice(0, 38)}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-red-500">
            <MapPin className="h-3 w-3 shrink-0" />
            No address
          </span>
        )}
        {item.therapistName && (
          <span
            className="flex items-center gap-1 text-xs"
            style={{ color: "var(--cs-text-muted)" }}
          >
            <User className="h-3 w-3 shrink-0" />
            {item.therapistName}
          </span>
        )}
        {item.driverName && (
          <span
            className="flex items-center gap-1 text-xs"
            style={{ color: "var(--cs-text-muted)" }}
          >
            <Car className="h-3 w-3 shrink-0" />
            {item.driverName}
          </span>
        )}
      </div>
    </button>
  );
}

// ── Readiness row ─────────────────────────────────────────────────────────────

function ReadinessRow({
  status,
  label,
  children,
}: {
  status: "ok" | "warn" | "missing";
  label: string;
  children: React.ReactNode;
}) {
  const iconEl =
    status === "ok" ? (
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
    ) : status === "warn" ? (
      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
    ) : (
      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
    );

  return (
    <div className="flex items-center gap-2 border-b border-[var(--cs-border-soft)] py-1.5 last:border-0">
      {iconEl}
      <span
        className="w-20 shrink-0 text-xs font-medium"
        style={{ color: "var(--cs-text-muted)" }}
      >
        {label}
      </span>
      <span className="text-xs" style={{ color: "var(--cs-text-secondary)" }}>
        {children}
      </span>
    </div>
  );
}

// ── Selected booking panel ─────────────────────────────────────────────────────

function SelectedBookingPanel({
  item,
  onRefresh,
}: {
  item: RealDispatchItem;
  onRefresh: () => void;
}) {
  const hasAddress = !!item.formattedAddress && !item.needsLocationReview;
  const hasCoords = item.lat !== null && item.lng !== null;
  const pb = paymentLabel(item.paymentStatus);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3
            className="text-base font-semibold"
            style={{ color: "var(--cs-text)" }}
          >
            {item.customerName}
          </h3>
          <span
            className="font-mono text-xs"
            style={{ color: "var(--cs-text-muted)" }}
          >
            {item.number}
          </span>
        </div>
        <p
          className="mt-0.5 text-sm"
          style={{ color: "var(--cs-text-secondary)" }}
        >
          {item.serviceName}
          {" · "}
          {formatTime12h(item.startTime)}
          {item.endTime ? ` – ${formatTime12h(item.endTime)}` : ""}
        </p>
        {item.formattedAddress && (
          <p
            className="mt-0.5 flex items-center gap-1 text-xs"
            style={{ color: "var(--cs-text-muted)" }}
          >
            <MapPin className="h-3 w-3 shrink-0" />
            {item.formattedAddress}
          </p>
        )}
      </div>

      {/* Readiness checklist */}
      <div>
        <p
          className="mb-2 text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--cs-text-muted)" }}
        >
          Dispatch Readiness
        </p>
        <div
          className="rounded-lg px-3 py-1"
          style={{ border: "1px solid var(--cs-border-soft)" }}
        >
          <ReadinessRow
            status={item.therapistName ? "ok" : "missing"}
            label="Therapist"
          >
            {item.therapistName ?? "Not assigned"}
          </ReadinessRow>
          <ReadinessRow
            status={item.driverName ? "ok" : "missing"}
            label="Driver"
          >
            {item.driverName ?? "Not assigned"}
          </ReadinessRow>
          <ReadinessRow
            status={hasAddress ? "ok" : "missing"}
            label="Address"
          >
            {hasAddress
              ? (item.area ?? item.formattedAddress ?? "Address confirmed")
              : item.needsLocationReview
              ? "Needs review"
              : "Missing address"}
          </ReadinessRow>
          <ReadinessRow status={hasCoords ? "ok" : "warn"} label="GPS">
            {hasCoords ? "Coordinates ready" : "No coordinates"}
          </ReadinessRow>
          <div className="flex items-center gap-2 py-1.5">
            <span
              className="w-20 shrink-0 text-xs font-medium"
              style={{ color: "var(--cs-text-muted)" }}
            >
              Payment
            </span>
            <Badge
              variant="outline"
              className={`text-xs ${pb.cls}`}
            >
              {pb.label}
            </Badge>
          </div>
        </div>
      </div>

      {/* Current progress timestamps (if trip has started) */}
      {(item.travelStartedAt ||
        item.arrivedAt ||
        item.sessionStartedAt ||
        item.completedAt) && (
        <div>
          <p
            className="mb-2 text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--cs-text-muted)" }}
          >
            Trip Timeline
          </p>
          <div className="space-y-1">
            {item.travelStartedAt && (
              <p className="text-xs" style={{ color: "var(--cs-text-secondary)" }}>
                <span style={{ color: "var(--cs-text-muted)" }}>Travel started: </span>
                {new Date(item.travelStartedAt).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
            {item.arrivedAt && (
              <p className="text-xs" style={{ color: "var(--cs-text-secondary)" }}>
                <span style={{ color: "var(--cs-text-muted)" }}>Arrived: </span>
                {new Date(item.arrivedAt).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
            {item.sessionStartedAt && (
              <p className="text-xs" style={{ color: "var(--cs-text-secondary)" }}>
                <span style={{ color: "var(--cs-text-muted)" }}>Session started: </span>
                {new Date(item.sessionStartedAt).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
            {item.completedAt && (
              <p className="text-xs" style={{ color: "var(--cs-text-secondary)" }}>
                <span style={{ color: "var(--cs-text-muted)" }}>Completed: </span>
                {new Date(item.completedAt).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Driver assignment panel (awaiting driver only) */}
      {item.dispatchStatus === "awaiting_driver" && (
        <div>
          <p
            className="mb-2 text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--cs-text-muted)" }}
          >
            Driver Assignment
          </p>
          <AssignmentRecommendationPanel
            bookingId={item.id}
            fetchRecommendations={getDriverRecommendationsAction}
            onAssignDriver={async (driverId) => {
              await assignBookingDriverAction({ bookingId: item.id, driverId });
              onRefresh();
            }}
            currentDriverId={item.driverId}
            showTherapists={false}
            showDrivers={true}
          />
        </div>
      )}

      {/* No dispatch-confirm action exists yet — honest state */}
      {item.dispatchStatus === "ready" && (
        <div
          className="rounded-lg px-3 py-2.5 text-xs"
          style={{
            background: "var(--cs-surface-warm)",
            border: "1px solid var(--cs-border-soft)",
            color: "var(--cs-text-muted)",
          }}
        >
          This booking is ready to dispatch. Driver and therapist are assigned.
          Dispatch confirmation and trip start are handled by the driver via the
          Driver Portal.
        </div>
      )}

      {/* View booking link */}
      <Link
        href="/crm/bookings"
        className="flex items-center gap-1.5 text-xs font-medium"
        style={{ color: "var(--cs-sand)", textDecoration: "none" }}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        View in Bookings
      </Link>
    </div>
  );
}

// ── Main tab ───────────────────────────────────────────────────────────────────

export function DispatchFlowTab({
  data,
}: {
  data: DispatchData;
  role: string;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>(
    data.items[0]?.id ?? ""
  );

  const selectedItem =
    data.items.find((i) => i.id === selectedId) ?? null;

  const activeItems = data.items.filter(
    (i) =>
      i.dispatchStatus !== "completed" && i.dispatchStatus !== "cancelled"
  );
  const doneItems = data.items.filter(
    (i) =>
      i.dispatchStatus === "completed" || i.dispatchStatus === "cancelled"
  );

  if (data.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <CheckCircle2
          className="h-8 w-8"
          style={{ color: "var(--cs-text-muted)" }}
        />
        <p className="text-sm" style={{ color: "var(--cs-text-secondary)" }}>
          No home-service bookings scheduled for today.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ── Left: Booking queue (2/5) ── */}
      <div className="space-y-4 lg:col-span-2">
        <div className="flex items-center justify-between">
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--cs-text)" }}
          >
            Booking Queue
          </h2>
          <span
            className="text-xs"
            style={{ color: "var(--cs-text-muted)" }}
          >
            {activeItems.length} active{" "}
            {doneItems.length > 0 ? `· ${doneItems.length} done` : ""}
          </span>
        </div>

        {/* Active */}
        {activeItems.length > 0 && (
          <div className="space-y-2">
            {activeItems.map((item) => (
              <QueueItem
                key={item.id}
                item={item}
                selected={selectedId === item.id}
                onSelect={() => setSelectedId(item.id)}
              />
            ))}
          </div>
        )}

        {/* Completed / Cancelled */}
        {doneItems.length > 0 && (
          <div className="space-y-2">
            <p
              className="text-xs font-semibold"
              style={{ color: "var(--cs-text-muted)" }}
            >
              Completed / Cancelled
            </p>
            <div className="space-y-1.5 opacity-60">
              {doneItems.map((item) => (
                <QueueItem
                  key={item.id}
                  item={item}
                  selected={selectedId === item.id}
                  onSelect={() => setSelectedId(item.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Selected booking panel (3/5) ── */}
      <div className="lg:col-span-3">
        {selectedItem ? (
          <div className="cs-card p-5">
            <SelectedBookingPanel
              item={selectedItem}
              onRefresh={() => router.refresh()}
            />
          </div>
        ) : (
          <div
            className="flex flex-col items-center gap-3 py-16 text-center"
            style={{
              border: "1px dashed var(--cs-border)",
              borderRadius: "var(--cs-r-lg)",
            }}
          >
            <Inbox
              className="h-7 w-7"
              style={{ color: "var(--cs-text-muted)" }}
            />
            <p className="text-sm" style={{ color: "var(--cs-text-muted)" }}>
              Select a booking from the queue to see details
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
