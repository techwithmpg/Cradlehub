"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Car,
  Check,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LiveMapTripItem } from "@/lib/dispatch/trip-presentation";
import { formatDurationMinutes } from "@/lib/dispatch/route-eta";
import { gpsFreshnessBadgeClass, TRIP_STAGE_STYLES } from "./trip-stage-styles";

function TripCardMiniProgress({ trip }: { trip: LiveMapTripItem }) {
  const stageStyle = TRIP_STAGE_STYLES[trip.stageKey];

  return (
    <div className="mt-2.5">
      <div className="flex items-center">
        {trip.miniSteps.map((step, index) => (
          <div key={step.key} className="flex flex-1 items-center last:flex-none">
            <span
              title={step.tooltip}
              aria-label={step.tooltip}
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                step.state === "completed" &&
                  "border-[#15803D] bg-[#15803D] text-white",
                step.state === "current" &&
                  `${stageStyle.ringClass} border-2 bg-white ring-2`,
                step.state === "attention" &&
                  "border-amber-500 bg-amber-100 text-amber-800 ring-2 ring-amber-200",
                step.state === "skipped" &&
                  "border-slate-300 bg-slate-100 text-slate-400",
                step.state === "upcoming" && "border-slate-300 bg-white"
              )}
            >
              {step.state === "completed" ? (
                <Check size={9} strokeWidth={3} />
              ) : step.state === "current" ? (
                <span className={cn("size-1.5 rounded-full", stageStyle.dotClass)} />
              ) : step.state === "skipped" ? (
                <span className="h-[1.5px] w-2 bg-slate-400" />
              ) : null}
            </span>

            {index < trip.miniSteps.length - 1 ? (
              <span
                className={cn(
                  "h-[2px] flex-1 transition-colors",
                  step.state === "completed" ? "bg-[#15803D]" : "bg-slate-200"
                )}
              />
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-0.5 text-center text-[9px] leading-tight text-[var(--cs-text-muted)]">
        {trip.miniSteps.map((step) => (
          <span
            key={step.key}
            title={step.tooltip}
            className={cn(
              "truncate",
              step.state === "current" && "font-bold text-[var(--cs-text)]",
              step.state === "skipped" && "line-through opacity-70"
            )}
          >
            {step.shortLabel}
          </span>
        ))}
      </div>
    </div>
  );
}

function TripRailCard({
  trip,
  selected,
  onSelect,
}: {
  trip: LiveMapTripItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const stageStyle = TRIP_STAGE_STYLES[trip.stageKey];
  const approvedIndependent =
    trip.collection.decision === "not_required" && trip.collection.hasValidApproval;

  return (
    <button
      type="button"
      data-testid={`trip-card-${trip.bookingId}`}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border bg-white p-3 text-left transition hover:border-[#155A33]/60 hover:shadow-sm",
        selected
          ? "border-2 border-[#155A33] bg-[#F6FBF8] shadow-sm"
          : "border-[var(--cs-border)]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <UserRound size={13} className="shrink-0 text-[var(--cs-text-muted)]" />
          <p className="truncate text-sm font-bold text-[var(--cs-text)]">
            <span className="font-mono text-xs font-semibold text-[var(--cs-text-muted)]">
              {trip.bookingNumber}
            </span>{" "}
            · {trip.customerName}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Badge variant="outline" className={cn("text-[0.64rem]", stageStyle.badgeClass)}>
            {trip.stageBadgeLabel}
          </Badge>
          <ChevronRight size={14} className="text-[var(--cs-text-muted)]" />
        </div>
      </div>

      <p className="mt-0.5 truncate text-xs text-[var(--cs-text-secondary)]">
        {trip.serviceName} · {trip.locationSummary}
      </p>

      <TripCardMiniProgress trip={trip} />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 text-[0.68rem]">
        <span className="inline-flex min-w-0 items-center gap-1 text-[var(--cs-text-muted)]">
          <Car size={11} className="shrink-0" />
          <span className="truncate">
            {trip.driverName ?? "Needs driver"}
            {trip.sharedDriverTripCount > 1 ? ` (${trip.sharedDriverTripCount} stops)` : ""}
          </span>
        </span>

        <div className="flex flex-wrap items-center gap-1">
          {trip.driverId ? (
            <Badge
              variant="outline"
              className={cn(
                "px-1.5 py-0 text-[0.6rem]",
                gpsFreshnessBadgeClass(trip.driverReliability.state)
              )}
            >
              {trip.driverReliability.badgeText}
            </Badge>
          ) : null}

          {trip.stageKey === "en_route" || trip.stageKey === "collection" ? (
            <span className="font-medium text-[var(--cs-text-secondary)]">
              {formatDurationMinutes(trip.etaMinutes)}
            </span>
          ) : null}

          {approvedIndependent ? (
            <Badge
              variant="outline"
              className="border-slate-300 bg-slate-50 px-1.5 py-0 text-[0.6rem] text-slate-600"
              title="Approved independent departure — no collection needed"
            >
              Indep. dep.
            </Badge>
          ) : trip.collection.requiresResolution && trip.serviceTimer.isCompleted ? (
            <Badge
              variant="outline"
              className="inline-flex items-center gap-0.5 border-amber-300 bg-amber-50 px-1.5 py-0 text-[0.6rem] text-amber-800"
            >
              <AlertTriangle size={9} />
              Resolve collection
            </Badge>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export function FloatingTripRail({
  trips,
  totalCount,
  selectedBookingId,
  collapsed,
  hiddenOnMobile,
  searchQuery,
  hasActiveFilter,
  onToggleCollapsed,
  onSearchChange,
  onClearFilter,
  onSelectTrip,
}: {
  trips: LiveMapTripItem[];
  totalCount: number;
  selectedBookingId: string | null;
  collapsed: boolean;
  hiddenOnMobile?: boolean;
  searchQuery: string;
  hasActiveFilter: boolean;
  onToggleCollapsed: () => void;
  onSearchChange: (value: string) => void;
  onClearFilter: () => void;
  onSelectTrip: (bookingId: string) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(Boolean(searchQuery));

  if (collapsed) {
    return (
      <div
        className={cn(
          "pointer-events-auto absolute left-3 top-12 z-20 md:left-4 md:top-4",
          hiddenOnMobile ? "hidden md:block" : "block"
        )}
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Expand trip list"
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--cs-border)] bg-white/95 px-3.5 py-2 text-xs font-bold text-[var(--cs-text)] shadow-lg backdrop-blur transition hover:border-[#155A33]"
        >
          <span>
            Trips ({trips.length}
            {trips.length !== totalCount ? `/${totalCount}` : ""})
          </span>
          <ChevronsRight size={15} className="text-[#155A33]" />
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Trips list"
      className={cn(
        "pointer-events-auto absolute inset-x-3 bottom-3 z-30 max-h-[46vh] flex-col overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-xl backdrop-blur md:inset-x-auto md:bottom-16 md:left-4 md:top-4 md:z-20 md:max-h-none md:w-[292px] lg:w-[318px]",
        hiddenOnMobile ? "hidden md:flex" : "flex"
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--cs-border-soft)] px-3.5 py-2.5">
        <h3 className="text-sm font-bold text-[var(--cs-text)]">
          Trips ({trips.length}
          {trips.length !== totalCount ? ` of ${totalCount}` : ""})
        </h3>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSearchOpen((prev) => !prev)}
            aria-label="Toggle trip search"
            aria-pressed={searchOpen}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-lg border text-[var(--cs-text-secondary)] transition hover:bg-[var(--cs-surface-warm)]",
              searchOpen || searchQuery
                ? "border-[#155A33] bg-[#EEF7F1] text-[#155A33]"
                : "border-transparent"
            )}
          >
            <Search size={14} />
          </button>

          {hasActiveFilter ? (
            <button
              type="button"
              onClick={onClearFilter}
              aria-label="Clear status filter"
              title="Reset status filter"
              className="inline-flex size-7 items-center justify-center rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
            >
              <SlidersHorizontal size={13} />
            </button>
          ) : null}

          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="Collapse trip list"
            className="inline-flex size-7 items-center justify-center rounded-lg text-[var(--cs-text-secondary)] transition hover:bg-[var(--cs-surface-warm)] hover:text-[var(--cs-text)]"
          >
            <ChevronsLeft size={16} />
          </button>
        </div>
      </div>

      {searchOpen || searchQuery ? (
        <div className="border-b border-[var(--cs-border-soft)] px-3 py-2">
          <div className="relative">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--cs-text-muted)]"
            />
            <input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search customer, #ref, service, driver..."
              aria-label="Search trips"
              className="h-8 w-full rounded-lg border border-[var(--cs-border)] bg-white pl-8 pr-7 text-xs outline-none focus:border-[#155A33]"
            />
            {searchQuery ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--cs-text-muted)] hover:text-[var(--cs-text)]"
              >
                <X size={12} />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
        {trips.map((trip) => (
          <TripRailCard
            key={trip.bookingId}
            trip={trip}
            selected={selectedBookingId === trip.bookingId}
            onSelect={() => onSelectTrip(trip.bookingId)}
          />
        ))}

        {trips.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--cs-border)] px-3 py-6 text-center text-xs text-[var(--cs-text-muted)]">
            No matching trips in this filter.
          </div>
        ) : null}
      </div>
    </aside>
  );
}
