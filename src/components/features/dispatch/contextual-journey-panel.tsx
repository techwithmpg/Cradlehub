"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Navigation,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatTime12h } from "@/lib/utils/time-format";
import { computeCrmServiceTimerSummary } from "@/lib/dispatch/crm-live-map-model";
import {
  formatArrivalClockTime,
  formatDistanceRemaining,
  formatDurationMinutes,
  type RouteCacheEntry,
} from "@/lib/dispatch/route-eta";
import type { LiveMapTripItem } from "@/lib/dispatch/trip-presentation";
import { gpsFreshnessBadgeClass, TRIP_STAGE_STYLES } from "./trip-stage-styles";

function buildCustomerRouteUrl(trip: LiveMapTripItem): string {
  if (!trip.hasCustomerGps || trip.lat === null || trip.lng === null) {
    return "https://www.google.com/maps";
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${trip.lat},${trip.lng}&travelmode=driving`;
}

function formatCountdownClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${String(secs).padStart(2, "0")}s`;
  return `${secs}s`;
}

function LiveServiceCountdownCard({
  trip,
}: {
  trip: LiveMapTripItem;
}) {
  const [tickNowMs, setTickNowMs] = useState<number>(() => Date.now());
  const sessionStartedAt =
    trip.timeline.find((step) => step.key === "in_service")?.timestampIso ?? null;

  useEffect(() => {
    if (!trip.serviceTimer.isActive) return;
    const id = window.setInterval(() => setTickNowMs(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, [trip.serviceTimer.isActive]);

  const liveTimer = trip.serviceTimer.isActive
    ? computeCrmServiceTimerSummary({
        bookingStatus: "in_progress",
        bookingProgressStatus: "session_started",
        sessionStartedAt,
        sessionDueAt: trip.serviceTimer.expectedEndIso,
        nowMs: tickNowMs,
      })
    : trip.serviceTimer;

  if (!liveTimer.isActive && !liveTimer.isCompleted) return null;

  const expectedClock = formatArrivalClockTime(liveTimer.expectedEndIso);

  if (liveTimer.isCompleted) {
    return (
      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-emerald-900">
          <CheckCircle2 size={14} className="text-emerald-700" />
          <span>Service Completed (Confirmed)</span>
        </div>
        {expectedClock ? (
          <p className="mt-1 text-emerald-800">Completed at {expectedClock}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-[#F5CBA7] bg-[#FEF5E7] p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1 font-semibold text-[#935116]">
            <Clock size={13} />
            <span>Service Ends In</span>
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-[#7E5109]">
            {liveTimer.remainingSeconds !== null
              ? formatCountdownClock(liveTimer.remainingSeconds)
              : "Active"}
          </p>
        </div>
        {expectedClock ? (
          <span className="mt-4 font-semibold text-[#935116]">({expectedClock})</span>
        ) : null}
      </div>
      {liveTimer.predictiveNote ? (
        <p className="mt-1.5 text-[0.7rem] text-[#935116]">{liveTimer.predictiveNote}</p>
      ) : null}
    </div>
  );
}

export function ContextualJourneyPanel({
  trip,
  sharedStops,
  route,
  open,
  onClose,
  onReopen,
  onSelectTrip,
}: {
  trip: LiveMapTripItem | null;
  sharedStops: LiveMapTripItem[];
  route?: RouteCacheEntry | null;
  open: boolean;
  onClose: () => void;
  onReopen: () => void;
  onSelectTrip: (bookingId: string) => void;
}) {
  if (!trip) return null;

  if (!open) {
    return (
      <div className="pointer-events-auto absolute right-3 top-12 z-20 md:right-4 md:top-4">
        <button
          type="button"
          onClick={onReopen}
          aria-label="Open journey details"
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--cs-border)] bg-white/95 px-3 py-1.5 text-xs font-bold text-[var(--cs-text)] shadow-lg backdrop-blur transition hover:border-[#155A33] md:px-3.5 md:py-2"
        >
          <span className="font-mono text-[var(--cs-text-muted)]">{trip.bookingNumber}</span>
          <span>Show Details</span>
        </button>
      </div>
    );
  }

  const stageStyle = TRIP_STAGE_STYLES[trip.stageKey];
  const etaClock = formatArrivalClockTime(trip.estimatedArrivalIso);
  const routeUrl = buildCustomerRouteUrl(trip);
  const approvedIndependent =
    trip.collection.decision === "not_required" && trip.collection.hasValidApproval;

  return (
    <aside
      data-testid="selected-driver-details"
      aria-label="Selected journey details"
      className="pointer-events-auto absolute inset-x-3 bottom-3 z-30 flex max-h-[68vh] flex-col overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-xl backdrop-blur md:inset-x-auto md:bottom-16 md:right-4 md:top-4 md:z-20 md:max-h-none md:w-[320px] lg:w-[340px]"
    >
      <div className="flex items-start justify-between gap-2 border-b border-[var(--cs-border-soft)] px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-[var(--cs-text-muted)]">
              {trip.bookingNumber}
            </span>
            <Badge variant="outline" className={cn("text-[0.66rem]", stageStyle.badgeClass)}>
              {trip.detailedStatusLabel}
            </Badge>
          </div>
          <h3 className="mt-0.5 truncate text-base font-bold text-[var(--cs-text)]">
            {trip.customerName}
          </h3>
          <p className="truncate text-xs text-[var(--cs-text-secondary)]">{trip.serviceName}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close journey details"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-[var(--cs-text-muted)] transition hover:bg-[var(--cs-surface-warm)] hover:text-[var(--cs-text)]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 py-2.5 text-xs">
        <div className="space-y-1.5 text-[var(--cs-text-secondary)]">
          <div className="flex items-center gap-2">
            <Clock size={14} className="shrink-0 text-[var(--cs-text-muted)]" />
            <span className="font-medium text-[var(--cs-text)]">
              {formatTime12h(trip.startTime)}
              {trip.endTime ? ` – ${formatTime12h(trip.endTime)}` : ""}
            </span>
          </div>

          <div className="flex items-start gap-2">
            <MapPin size={14} className="mt-0.5 shrink-0 text-[var(--cs-text-muted)]" />
            <span>
              {trip.locationSummary}
              {!trip.hasCustomerGps ? (
                <span className="ml-1 font-semibold text-amber-700"> (Customer GPS pending)</span>
              ) : null}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <UserRound size={14} className="shrink-0 text-[var(--cs-text-muted)]" />
            <span>Therapist: {trip.therapistName ?? "Unassigned"}</span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2">
              <Car size={14} className="shrink-0 text-[var(--cs-text-muted)]" />
              <span>Driver: {trip.driverName ?? "Not assigned"}</span>
            </span>
            {trip.driverId ? (
              <Badge
                variant="outline"
                className={cn(
                  "text-[0.62rem]",
                  gpsFreshnessBadgeClass(trip.driverReliability.state)
                )}
              >
                {trip.driverReliability.badgeText}
              </Badge>
            ) : null}
          </div>

          {trip.driverId ? (
            <p className="pl-5 text-[0.68rem] text-[var(--cs-text-muted)]">
              {trip.driverReliability.label}
              {trip.driverReliability.accuracyMeters !== null
                ? ` (±${Math.round(trip.driverReliability.accuracyMeters)}m)`
                : ""}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2">
              <Navigation size={14} className="shrink-0 text-[var(--cs-text-muted)]" />
              <span>
                {formatDurationMinutes(trip.etaMinutes)}
                {etaClock ? ` (ETA ${etaClock})` : ""}
                {trip.distanceMeters !== null
                  ? ` · ${formatDistanceRemaining(trip.distanceMeters)}`
                  : ""}
              </span>
            </span>
            {route?.basis === "routes_api" ? (
              <span className="text-[0.65rem] text-emerald-700">Google Routes</span>
            ) : null}
          </div>
        </div>

        {sharedStops.length > 1 ? (
          <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/60 p-2.5">
            <p className="flex items-center gap-1.5 text-[0.7rem] font-bold text-blue-900">
              <Users size={12} />
              Shared Driver Vehicle ({sharedStops.length} assigned stops)
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {sharedStops.map((stop) => (
                <button
                  key={stop.bookingId}
                  type="button"
                  onClick={() => onSelectTrip(stop.bookingId)}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[0.66rem] font-semibold transition",
                    stop.bookingId === trip.bookingId
                      ? "border-[#155A33] bg-[#155A33] text-white"
                      : "border-blue-200 bg-white text-blue-900 hover:bg-blue-100"
                  )}
                >
                  {stop.bookingNumber} · {stop.therapistName ?? stop.customerName}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <LiveServiceCountdownCard trip={trip} />

        <div className="mt-2.5 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-3 py-1.5">
          <div className="flex items-start gap-1.5 text-[0.7rem]">
            {trip.collection.requiresResolution ? (
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-600" />
            ) : (
              <CheckCircle2
                size={13}
                className={cn(
                  "mt-0.5 shrink-0",
                  approvedIndependent ? "text-slate-500" : "text-emerald-600"
                )}
              />
            )}
            <span
              className={cn(
                trip.collection.requiresResolution
                  ? "font-semibold text-amber-900"
                  : "text-[var(--cs-text-secondary)]"
              )}
            >
              {trip.collection.label}
            </span>
          </div>
        </div>

        <div className="mt-3">
          <p className="mb-1.5 text-[0.68rem] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
            Journey Timeline
          </p>
          <ol className="space-y-1.5">
            {trip.timeline.map((step, idx) => {
              const recordedTime = formatArrivalClockTime(step.timestampIso);
              return (
                <li key={step.key} title={step.tooltip} className="relative flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border",
                        step.status === "completed" &&
                          "border-[#15803D] bg-[#15803D] text-white",
                        step.status === "current" &&
                          "border-[#15803D] bg-white ring-2 ring-emerald-200",
                        step.status === "attention" &&
                          "border-amber-500 bg-amber-100 text-amber-800",
                        step.status === "skipped" && "border-slate-300 bg-slate-100 text-slate-400",
                        step.status === "upcoming" && "border-slate-300 bg-white"
                      )}
                    >
                      {step.status === "completed" ? (
                        <CheckCircle2 size={10} />
                      ) : step.status === "current" ? (
                        <span className="size-1.5 rounded-full bg-[#15803D]" />
                      ) : step.status === "attention" ? (
                        <AlertTriangle size={9} />
                      ) : null}
                    </span>
                    {idx < trip.timeline.length - 1 ? (
                      <span
                        className={cn(
                          "mt-0.5 w-[1.5px] flex-1",
                          step.status === "completed" ? "bg-[#15803D]" : "bg-slate-200"
                        )}
                      />
                    ) : null}
                  </div>

                  <div className="flex flex-1 items-start justify-between gap-2 pb-1">
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-xs font-semibold leading-tight",
                          step.status === "current" && "text-[#155A33]",
                          step.status === "skipped" && "text-[var(--cs-text-muted)]",
                          step.status === "upcoming" && "text-[var(--cs-text-muted)]",
                          step.status === "attention" && "text-amber-900"
                        )}
                      >
                        {step.label}
                      </p>
                      {step.detail ? (
                        <p className="text-[0.67rem] text-[var(--cs-text-muted)]">{step.detail}</p>
                      ) : null}
                    </div>

                    <span className="shrink-0 font-mono text-[0.68rem] text-[var(--cs-text-muted)]">
                      {recordedTime ??
                        (step.status === "current"
                          ? "Active"
                          : step.status === "skipped"
                            ? "Exempt"
                            : "—")}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className="space-y-2 border-t border-[var(--cs-border-soft)] bg-white p-3.5">
        <a
          href={routeUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition",
            trip.hasCustomerGps
              ? "bg-[#155A33] text-white hover:bg-[#104728]"
              : "bg-slate-200 text-slate-600 hover:bg-slate-300"
          )}
        >
          <span>{trip.hasCustomerGps ? "Open Customer Route" : "Customer GPS Missing"}</span>
          <ExternalLink size={13} />
        </a>
        <div className="flex gap-2">
          <a
            href={`/crm/bookings?bookingId=${encodeURIComponent(trip.bookingId)}`}
            className="inline-flex h-8 flex-1 items-center justify-center rounded-lg border border-[var(--cs-border)] text-[0.7rem] font-semibold text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)]"
          >
            View / Edit Booking
          </a>
        </div>
      </div>
    </aside>
  );
}
