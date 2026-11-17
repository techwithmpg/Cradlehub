"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Car, CheckCircle2, Clock, MapPin, Navigation, Route, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTime12h } from "@/lib/utils/time-format";
import type { DispatchData, RealDispatchItem } from "@/lib/queries/dispatch-queries";
import { formatBranchYmd } from "@/lib/engine/slot-time";
import {
  optimizeBranchDispatchAction,
  commitOptimizedDispatchPlanAction,
  updateBookingCollectionDispositionAction,
} from "@/lib/actions/optimizer-dispatch-actions";
import type { OptimizerPlanResult } from "@/lib/dispatch/optimizer-bridge";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

function statusText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function statusLabel(status: unknown, bookingStatus?: string): string {
  if (bookingStatus === "pending_crm_confirmation") return "Awaiting CRM confirmation";
  const value = statusText(status);

  if (value === "awaiting_driver") return "Scheduled";
  if (value === "ready") return "Awaiting Travel";
  if (value === "in_route") return "En Route";
  if (value === "arrived_at_customer") return "Arrived";
  if (value === "service_started") return "In Service";
  if (value === "completed") return "Completed";
  if (value === "cancelled") return "Cancelled";

  return "Scheduled";
}

function statusBadge(status: unknown): {
  variant: BadgeVariant;
  cls: string;
} {
  const value = statusText(status);

  if (value === "completed") {
    return {
      variant: "outline",
      cls: "border-green-300 bg-green-50 text-green-700",
    };
  }

  if (value === "cancelled") {
    return {
      variant: "outline",
      cls: "border-red-300 bg-red-50 text-red-700",
    };
  }

  if (value === "in_route" || value === "arrived_at_customer" || value === "service_started") {
    return {
      variant: "outline",
      cls: "border-emerald-300 bg-emerald-50 text-emerald-700",
    };
  }

  if (value === "ready") {
    return {
      variant: "outline",
      cls: "border-blue-300 bg-blue-50 text-blue-700",
    };
  }

  return {
    variant: "outline",
    cls: "border-amber-300 bg-amber-50 text-amber-700",
  };
}

function locationLabel(item: RealDispatchItem): string {
  return item.formattedAddress ?? item.area ?? "Location needs attention";
}

function etaLabel(item: RealDispatchItem): string {
  if (item.eta?.minutes) return `${item.eta.minutes} min`;
  if (item.etaMinutes) return `${item.etaMinutes} min`;
  return "—";
}

function VisitCard({
  item,
  selected,
  onSelect,
  upcoming = false,
}: {
  item: RealDispatchItem;
  selected: boolean;
  onSelect: () => void;
  upcoming?: boolean;
}) {
  const badge = statusBadge(item.dispatchStatus);
  const hasDriver = Boolean(item.driverId);
  const hasTherapist = Boolean(item.therapistId);
  const hasLocation = item.lat !== null && item.lng !== null;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        selected
          ? "border-[#155A33] bg-green-50/60 shadow-sm"
          : "border-[var(--cs-border)] bg-[var(--cs-surface)] hover:border-[#155A33]/50"
      }`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-bold text-[var(--cs-text)]">
              {upcoming
                ? formatBranchYmd(item.bookingDate, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : null}
              {upcoming ? " · " : null}
              {formatTime12h(item.startTime)}
            </span>

            <Badge variant={badge.variant} className={`text-[0.68rem] ${badge.cls}`}>
              {statusLabel(item.dispatchStatus, item.bookingStatus)}
            </Badge>

            {item.paymentStatus && item.paymentStatus !== "paid" ? (
              <Badge
                variant="outline"
                className="border-[var(--cs-border)] bg-white text-[0.68rem] text-[var(--cs-text-muted)]"
              >
                Payment {item.paymentStatus}
              </Badge>
            ) : null}
          </div>

          <h3 className="mt-2 truncate text-lg font-bold text-[var(--cs-text)]">
            {item.customerName}
          </h3>

          <p className="truncate text-sm text-[var(--cs-text-secondary)]">{item.serviceName}</p>
        </div>

        <span className="font-mono text-xs text-[var(--cs-text-muted)]">{item.number}</span>
      </div>

      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex min-w-0 items-center gap-2 text-[var(--cs-text-secondary)]">
          <UserRound size={15} className="shrink-0" />
          <span className="truncate">{item.therapistName ?? "Therapist not assigned"}</span>
        </div>

        <div className="flex min-w-0 items-center gap-2 text-[var(--cs-text-secondary)]">
          <Car size={15} className="shrink-0" />
          <span className="truncate">{item.driverName ?? "Driver not assigned"}</span>
        </div>

        <div className="flex min-w-0 items-center gap-2 text-[var(--cs-text-secondary)]">
          <MapPin size={15} className="shrink-0" />
          <span className="truncate">{locationLabel(item)}</span>
        </div>

        <div className="flex items-center gap-2 text-[var(--cs-text-secondary)]">
          <Clock size={15} className="shrink-0" />
          <span>ETA {etaLabel(item)}</span>
        </div>
      </div>

      {(!hasDriver || !hasTherapist || !hasLocation || item.needsLocationReview) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!hasDriver ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
              <AlertCircle size={12} />
              Driver not assigned
            </span>
          ) : null}

          {!hasTherapist ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
              <AlertCircle size={12} />
              Therapist not assigned
            </span>
          ) : null}

          {!hasLocation || item.needsLocationReview ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
              <AlertCircle size={12} />
              Location needs attention
            </span>
          ) : null}
        </div>
      )}
    </button>
  );
}

function SelectedVisit({
  item,
  canManage,
  collectionDriverName,
  collectionDecisionOverride,
  collectionDriverIdOverride,
  stopOrder,
  onCollectionUpdated,
}: {
  item: RealDispatchItem;
  canManage: boolean;
  collectionDriverName: string | null;
  collectionDecisionOverride: "required" | "not_required" | "undecided" | null;
  collectionDriverIdOverride: string | null;
  stopOrder: number | null;
  onCollectionUpdated: () => void;
}) {
  const badge = statusBadge(item.dispatchStatus);
  const hasLocation = item.lat !== null && item.lng !== null;
  const [updatingCollection, setUpdatingCollection] = useState(false);
  const [collectionFeedback, setCollectionFeedback] = useState<string | null>(null);
  const decision =
    item.collectionRequirement?.decision ?? collectionDecisionOverride ?? "undecided";

  async function handleCollectionChange(nextDecision: "required" | "not_required" | "undecided") {
    setUpdatingCollection(true);
    setCollectionFeedback(null);
    const res = await updateBookingCollectionDispositionAction({
      bookingId: item.id,
      decision: nextDecision,
      collectionDriverId:
        nextDecision === "required"
          ? (collectionDriverIdOverride ??
            item.collectionRequirement?.collectionDriverId ??
            item.driverId ??
            null)
          : null,
    });
    setUpdatingCollection(false);
    if (!res.success) {
      setCollectionFeedback(res.error);
      return;
    }
    setCollectionFeedback("Collection arrangement updated.");
    onCollectionUpdated();
  }

  return (
    <aside className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cs-text-muted)]">
            Selected visit
          </p>

          <h3 className="mt-1 truncate text-xl font-bold text-[var(--cs-text)]">
            {item.customerName}
          </h3>

          <p className="mt-1 text-sm text-[var(--cs-text-secondary)]">{item.serviceName}</p>
        </div>

        <Badge variant={badge.variant} className={badge.cls}>
          {statusLabel(item.dispatchStatus, item.bookingStatus)}
        </Badge>
      </div>

      <div className="mt-5 space-y-3 text-sm">
        <div className="flex items-start gap-3">
          <Clock size={16} className="mt-0.5 shrink-0 text-[var(--cs-text-muted)]" />
          <div>
            <p className="font-semibold text-[var(--cs-text)]">
              {formatTime12h(item.startTime)}
              {item.endTime ? ` – ${formatTime12h(item.endTime)}` : ""}
            </p>
            <p className="text-xs text-[var(--cs-text-muted)]">Scheduled visit</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <UserRound size={16} className="mt-0.5 shrink-0 text-[var(--cs-text-muted)]" />
          <div>
            <p className="font-semibold text-[var(--cs-text)]">
              {item.therapistName ?? "Not assigned"}
            </p>
            <p className="text-xs text-[var(--cs-text-muted)]">Therapist</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Car size={16} className="mt-0.5 shrink-0 text-[var(--cs-text-muted)]" />
          <div>
            <p className="font-semibold text-[var(--cs-text)]">
              {item.driverName ?? "Not assigned"}
              {stopOrder ? ` · Stop #${stopOrder}` : ""}
            </p>
            <p className="text-xs text-[var(--cs-text-muted)]">
              Delivery driver
              {collectionDriverName && collectionDriverName !== item.driverName
                ? ` · Collection: ${collectionDriverName}`
                : ""}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <MapPin size={16} className="mt-0.5 shrink-0 text-[var(--cs-text-muted)]" />
          <div className="min-w-0">
            <p className="font-semibold text-[var(--cs-text)]">{locationLabel(item)}</p>
            <p className="text-xs text-[var(--cs-text-muted)]">Customer destination</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Navigation size={16} className="mt-0.5 shrink-0 text-[var(--cs-text-muted)]" />
          <div>
            <p className="font-semibold text-[var(--cs-text)]">{etaLabel(item)}</p>
            <p className="text-xs text-[var(--cs-text-muted)]">Current ETA</p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-[var(--cs-surface-warm)] p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
          Progress
        </p>

        <div className="mt-3 space-y-2">
          <ProgressLine complete={Boolean(item.travelStartedAt)} label="Travel started" />
          <ProgressLine complete={Boolean(item.arrivedAt)} label="Arrived" />
          <ProgressLine complete={Boolean(item.sessionStartedAt)} label="Service started" />
          <ProgressLine complete={Boolean(item.completedAt)} label="Completed" />
        </div>
      </div>

      {(!hasLocation || item.needsLocationReview) && (
        <div className="mt-4 flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <span>Customer location requires attention in the booking workflow.</span>
        </div>
      )}

      {canManage ? (
        <div className="mt-4 rounded-2xl border border-[var(--cs-border)] bg-white p-3.5 text-xs">
          <p className="font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
            Therapist collection arrangement
          </p>
          <p className="mt-1 text-[var(--cs-text-secondary)]">
            Current: <span className="font-semibold text-[var(--cs-text)]">{decision}</span>
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={decision === "required" ? "default" : "outline"}
              disabled={updatingCollection}
              onClick={() => void handleCollectionChange("required")}
              className="h-7 px-2.5 text-xs"
            >
              Collection Required
            </Button>
            <Button
              type="button"
              size="sm"
              variant={decision === "not_required" ? "default" : "outline"}
              disabled={updatingCollection}
              onClick={() => void handleCollectionChange("not_required")}
              className="h-7 px-2.5 text-xs"
            >
              Independent Departure
            </Button>
            <Button
              type="button"
              size="sm"
              variant={decision === "undecided" ? "default" : "outline"}
              disabled={updatingCollection}
              onClick={() => void handleCollectionChange("undecided")}
              className="h-7 px-2.5 text-xs"
            >
              Undecided
            </Button>
          </div>
          {collectionFeedback ? (
            <p className="mt-2 text-[11px] font-medium text-[#155A33]">{collectionFeedback}</p>
          ) : null}
        </div>
      ) : null}

      <Button asChild variant="outline" className="mt-5 h-11 w-full rounded-xl">
        <a href={`/crm/bookings?bookingId=${encodeURIComponent(item.id)}`}>
          {item.needsLocationReview ? "View / Fix Booking" : "View Booking"}
        </a>
      </Button>
    </aside>
  );
}

function ProgressLine({ complete, label }: { complete: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {complete ? (
        <CheckCircle2 size={15} className="text-emerald-600" />
      ) : (
        <span className="size-[15px] rounded-full border-2 border-[var(--cs-border)]" />
      )}

      <span
        className={complete ? "font-medium text-[var(--cs-text)]" : "text-[var(--cs-text-muted)]"}
      >
        {label}
      </span>
    </div>
  );
}

function EmptyState({ upcoming }: { upcoming: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--cs-border)] bg-[var(--cs-surface)] p-10 text-center">
      <h3 className="font-bold text-[var(--cs-text)]">
        {upcoming ? "No upcoming Home Service visits" : "No home-service visits today"}
      </h3>

      <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
        {upcoming
          ? "Future Home Service bookings in the planning window will appear here."
          : "Today's Home Service bookings will appear here automatically."}
      </p>
    </div>
  );
}

export function DispatchFlowTab({
  data,
  role,
  onChanged,
  upcoming = false,
  selectedBookingId,
}: {
  data: DispatchData;
  role: string;
  onChanged: () => void;
  upcoming?: boolean;
  selectedBookingId?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(selectedBookingId ?? null);
  const [optimizing, setOptimizing] = useState(false);
  const [applyingPlan, setApplyingPlan] = useState(false);
  const [optimizerPlan, setOptimizerPlan] = useState<OptimizerPlanResult | null>(null);
  const [optimizerStatus, setOptimizerStatus] = useState<string | null>(null);
  const canManage = role !== "driver" && role !== "therapist";

  const journeyByBooking = useMemo(
    () => new Map((data.transportJourneys ?? []).map((entry) => [entry.journey.bookingId, entry])),
    [data.transportJourneys]
  );

  async function handleOptimizePreview() {
    setOptimizing(true);
    setOptimizerStatus(null);
    const res = await optimizeBranchDispatchAction({ planningDate: data.today, commit: false });
    setOptimizing(false);
    if (!res.success) {
      setOptimizerStatus(res.error);
      return;
    }
    setOptimizerPlan(res.plan);
    if (!res.plan.available) {
      setOptimizerStatus(res.plan.reason);
    }
  }

  async function handleCommitPlan() {
    if (!optimizerPlan || !optimizerPlan.available) return;
    setApplyingPlan(true);
    setOptimizerStatus(null);
    const res = await commitOptimizedDispatchPlanAction({
      snapshotId: optimizerPlan.snapshotId,
      bookingUpdates: optimizerPlan.bookingUpdates,
    });
    setApplyingPlan(false);
    if (!res.success) {
      setOptimizerStatus(res.error);
      return;
    }
    setOptimizerPlan(null);
    setOptimizerStatus(
      `Applied optimized route plan across ${res.committedCount} booking(s) (${res.notifiedDriverIds.length} driver notice(s)).`
    );
    onChanged();
  }

  const activeSelectedId =
    selectedId && data.items.some((item) => item.id === selectedId)
      ? selectedId
      : (data.items[0]?.id ?? null);

  const sortedItems = useMemo(
    () =>
      [...data.items].sort(
        (a, b) =>
          a.bookingDate.localeCompare(b.bookingDate) || a.startTime.localeCompare(b.startTime)
      ),
    [data.items]
  );

  const selected =
    sortedItems.find((item) => item.id === activeSelectedId) ?? sortedItems[0] ?? null;

  if (sortedItems.length === 0) {
    return <EmptyState upcoming={upcoming} />;
  }

  const selectedJourney = selected ? journeyByBooking.get(selected.id) : undefined;

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
      <div className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cs-border)] pb-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--cs-text)]">
              {upcoming ? "Upcoming Home Visits" : "Today's Home Visits"}
            </h2>

            <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
              {upcoming
                ? "Future Home Service bookings by scheduled date."
                : "Live operational status for today's Home Service visits."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canManage && !upcoming ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={optimizing || applyingPlan}
                onClick={() => void handleOptimizePreview()}
                className="h-8 gap-1.5 rounded-full border-[#155A33]/40 text-xs font-semibold text-[#155A33]"
              >
                <Route size={14} />
                {optimizing ? "Optimizing…" : "Optimize Routes"}
              </Button>
            ) : null}

            <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
              {sortedItems.length} visit
              {sortedItems.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {optimizerStatus ? (
          <div
            role="status"
            className="mb-4 rounded-xl border border-[var(--cs-border)] bg-[#f7f5ee] px-3.5 py-2.5 text-xs text-[var(--cs-text)]"
          >
            {optimizerStatus}
          </div>
        ) : null}

        {optimizerPlan && optimizerPlan.available ? (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-950">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold">
                  Route Plan Ready ({optimizerPlan.response.feasibility_status}) ·{" "}
                  {optimizerPlan.response.metrics.active_driver_count} driver(s),{" "}
                  {optimizerPlan.response.metrics.pooled_route_count} pooled route(s),{" "}
                  {Math.round(optimizerPlan.response.metrics.total_driving_minutes)} driving min
                </p>
                <p className="mt-0.5 text-emerald-800">
                  Travel matrix: {optimizerPlan.matrixVersion} · Assigned legs:{" "}
                  {optimizerPlan.bookingUpdates.length}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={applyingPlan}
                  onClick={() => setOptimizerPlan(null)}
                  className="h-8 text-xs"
                >
                  Dismiss
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={applyingPlan}
                  onClick={() => void handleCommitPlan()}
                  className="h-8 bg-[#1F4E33] text-xs text-white hover:bg-[#163a26]"
                >
                  {applyingPlan ? "Applying…" : "Apply Optimized Plan"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          {sortedItems.map((item) => (
            <VisitCard
              key={item.id}
              item={item}
              selected={selected?.id === item.id}
              upcoming={upcoming}
              onSelect={() => setSelectedId(item.id)}
            />
          ))}
        </div>
      </div>

      {selected ? (
        <SelectedVisit
          item={selected}
          canManage={canManage}
          collectionDriverName={
            selectedJourney?.collectionDriverName ??
            selected.collectionRequirement?.collectionDriverName ??
            null
          }
          collectionDecisionOverride={selectedJourney?.journey.collectionDecision ?? null}
          collectionDriverIdOverride={selectedJourney?.journey.collectionDriverId ?? null}
          stopOrder={selectedJourney?.journey.stopOrder ?? null}
          onCollectionUpdated={onChanged}
        />
      ) : null}
    </section>
  );
}
