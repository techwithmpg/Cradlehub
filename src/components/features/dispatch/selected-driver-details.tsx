"use client";

import {
  AlertTriangle,
  Car,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Navigation,
  Route,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatTime12h } from "@/lib/utils/time-format";
import type { DriverTrack } from "@/lib/dispatch/crm-live-map-model";
import {
  formatArrivalClockTime,
  formatDistanceRemaining,
  formatDurationMinutes,
  type RouteCacheEntry,
} from "@/lib/dispatch/route-eta";

function buildExternalRouteUrl(stop: DriverTrack["nextStop"]): string {
  if (!stop || !stop.hasAuthorizedDestination || stop.lat === null || stop.lng === null) {
    return "https://www.google.com/maps";
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}&travelmode=driving`;
}

export function statusBadgeClasses(statusLabel: string): string {
  switch (statusLabel) {
    case "En route":
    case "Collection en route":
      return "border-blue-300 bg-blue-50 text-blue-700";
    case "Arrived at pickup":
    case "Arrived at customer":
    case "Arrived for collection":
      return "border-cyan-300 bg-cyan-50 text-cyan-800";
    case "Service in progress":
      return "border-emerald-300 bg-emerald-50 text-emerald-700";
    case "Service completed":
    case "Ready for collection":
    case "Collected":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "Completed":
      return "border-green-300 bg-green-50 text-green-700";
    case "Needs attention":
      return "border-red-300 bg-red-50 text-red-700";
    default:
      return "border-slate-300 bg-slate-50 text-slate-700";
  }
}

export function freshnessBadgeClasses(state: DriverTrack["reliability"]["state"]): string {
  switch (state) {
    case "live":
      return "border-emerald-300 bg-emerald-50 text-emerald-700";
    case "delayed":
    case "poor_accuracy":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "stale":
    case "permission_missing":
    case "offline":
      return "border-red-300 bg-red-50 text-red-700";
    default:
      return "border-slate-300 bg-slate-50 text-slate-600";
  }
}

export function SelectedDriverDetails({
  driver,
  route,
}: {
  driver: DriverTrack;
  route?: RouteCacheEntry | null;
}) {
  const nextStop = driver.nextStop;
  const arrivalClock = formatArrivalClockTime(driver.estimatedArrivalIso);
  const externalUrl = buildExternalRouteUrl(nextStop);

  return (
    <div
      data-testid="selected-driver-details"
      className="max-h-[430px] w-full max-w-[360px] overflow-y-auto rounded-2xl border border-white/80 bg-white/95 p-4 shadow-xl backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
            Selected Driver
          </p>
          <h3 className="mt-0.5 flex items-center gap-1.5 truncate text-base font-bold text-[var(--cs-text)]">
            <Car size={15} className="shrink-0 text-[#1F4E33]" />
            <span className="truncate">{driver.driverName}</span>
          </h3>
        </div>
        <Badge
          variant="outline"
          className={`shrink-0 text-[0.68rem] ${statusBadgeClasses(driver.currentStatusLabel)}`}
        >
          {driver.currentStatusLabel}
        </Badge>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge
          variant="outline"
          className={`text-[0.65rem] ${freshnessBadgeClasses(driver.reliability.state)}`}
        >
          {driver.reliability.label}
        </Badge>
        {driver.predictiveEndingSoon ? (
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[0.65rem] text-amber-800">
            Ending soon
          </Badge>
        ) : null}
      </div>

      <p className="mt-1.5 text-[0.72rem] text-[var(--cs-text-muted)]">{driver.reliability.note}</p>

      <div className="mt-3 space-y-2 rounded-xl bg-[var(--cs-surface-warm)] p-3 text-xs">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[var(--cs-text-muted)]">Current journey</span>
          <span className="text-right font-semibold text-[var(--cs-text)]">
            {driver.stops.length} {driver.stops.length === 1 ? "active stop" : "stops"} ·{" "}
            {nextStop?.serviceName ?? "Home Service"}
          </span>
        </div>

        <div className="flex items-start justify-between gap-2">
          <span className="text-[var(--cs-text-muted)]">Next stop</span>
          <span className="max-w-[205px] text-right font-semibold text-[var(--cs-text)]">
            {nextStop ? `${nextStop.customerName} · ${nextStop.destinationLabel}` : "None"}
          </span>
        </div>

        <div className="flex items-start justify-between gap-2">
          <span className="text-[var(--cs-text-muted)]">ETA &amp; distance</span>
          <span className="text-right font-semibold text-[var(--cs-text)]">
            {formatDurationMinutes(driver.etaMinutes)}
            {arrivalClock ? ` (ETA ${arrivalClock})` : ""}
            {driver.distanceMeters !== null
              ? ` · ${formatDistanceRemaining(driver.distanceMeters)}`
              : ""}
          </span>
        </div>

        {route?.basis ? (
          <div className="flex items-center justify-between gap-2 text-[0.68rem] text-[var(--cs-text-muted)]">
            <span className="inline-flex items-center gap-1">
              <Route size={11} />
              Route source
            </span>
            <span>{route.basis === "routes_api" ? "Google Routes API" : "Direct guide"}</span>
          </div>
        ) : null}

        {driver.location ? (
          <div className="flex items-center justify-between gap-2 text-[0.68rem] text-[var(--cs-text-muted)]">
            <span className="inline-flex items-center gap-1">
              <Navigation size={11} />
              Driver GPS
            </span>
            <span className="font-mono">
              {driver.location.lat.toFixed(5)}, {driver.location.lng.toFixed(5)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        <p className="text-[0.68rem] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
          Assigned Therapists &amp; Stops ({driver.stops.length})
        </p>
        {driver.stops.map((stop, index) => (
          <div
            key={stop.stopId}
            className="rounded-xl border border-[var(--cs-border)] bg-white p-2.5 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 font-semibold text-[var(--cs-text)]">
                <UserRound size={12} className="text-[#1F4E33]" />
                #{index + 1} {stop.therapistName ?? "Assigned therapist"}
              </span>
              <Badge
                variant="outline"
                className={`text-[0.62rem] ${statusBadgeClasses(stop.statusLabel)}`}
              >
                {stop.statusLabel}
              </Badge>
            </div>
            <p className="mt-1 truncate text-[var(--cs-text-secondary)]">
              {stop.customerName} · {formatTime12h(stop.scheduledStartTime)}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-[0.7rem] text-[var(--cs-text-muted)]">
              <MapPin size={11} />
              <span className="truncate">{stop.destinationLabel}</span>
            </p>
            <p className="mt-1 flex items-center gap-1 text-[0.7rem] text-[var(--cs-text-secondary)]">
              <Clock size={11} />
              <span>{stop.serviceTimer.label}</span>
            </p>
            {stop.serviceTimer.predictiveNote ? (
              <p className="mt-0.5 text-[0.67rem] text-amber-700">
                {stop.serviceTimer.predictiveNote}
              </p>
            ) : null}
            <div className="mt-1 flex items-start gap-1 text-[0.7rem]">
              {stop.collection.requiresResolution ? (
                <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-600" />
              ) : (
                <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-600" />
              )}
              <span
                className={
                  stop.collection.requiresResolution
                    ? "font-medium text-amber-800"
                    : "text-[var(--cs-text-secondary)]"
                }
              >
                {stop.collection.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {nextStop ? (
        <div className="mt-3 flex gap-2">
          <a
            href={externalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1F4E33] px-3 text-xs font-bold text-white transition hover:bg-[#163B26]"
          >
            Open Customer Route
            <ExternalLink size={12} />
          </a>
          <a
            href={`/crm/bookings?bookingId=${encodeURIComponent(nextStop.bookingId)}`}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-[var(--cs-border)] px-3 text-xs font-semibold text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)]"
          >
            Booking
          </a>
        </div>
      ) : null}
    </div>
  );
}
