"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Car, CheckCircle2, Clock, MapPin, Navigation, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTime12h } from "@/lib/utils/time-format";
import type { DispatchData, RealDispatchItem } from "@/lib/queries/dispatch-queries";

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
}: {
  item: RealDispatchItem;
  selected: boolean;
  onSelect: () => void;
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

function SelectedVisit({ item }: { item: RealDispatchItem }) {
  const badge = statusBadge(item.dispatchStatus);
  const hasLocation = item.lat !== null && item.lng !== null;

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
            </p>
            <p className="text-xs text-[var(--cs-text-muted)]">Driver</p>
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

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--cs-border)] bg-[var(--cs-surface)] p-10 text-center">
      <h3 className="font-bold text-[var(--cs-text)]">No home-service visits today</h3>

      <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
        Today&apos;s Home Service bookings will appear here automatically.
      </p>
    </div>
  );
}

export function DispatchFlowTab({
  data,
}: {
  data: DispatchData;
  role: string;
  onChanged: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeSelectedId =
    selectedId && data.items.some((item) => item.id === selectedId)
      ? selectedId
      : (data.items[0]?.id ?? null);

  const sortedItems = useMemo(
    () => [...data.items].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [data.items]
  );

  const selected =
    sortedItems.find((item) => item.id === activeSelectedId) ?? sortedItems[0] ?? null;

  if (sortedItems.length === 0) {
    return <EmptyState />;
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
      <div className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-[var(--cs-border)] pb-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--cs-text)]">Today&apos;s Home Visits</h2>

            <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
              Live operational status for today&apos;s Home Service visits.
            </p>
          </div>

          <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
            {sortedItems.length} visit
            {sortedItems.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="space-y-3">
          {sortedItems.map((item) => (
            <VisitCard
              key={item.id}
              item={item}
              selected={selected?.id === item.id}
              onSelect={() => setSelectedId(item.id)}
            />
          ))}
        </div>
      </div>

      {selected ? <SelectedVisit item={selected} /> : null}
    </section>
  );
}
