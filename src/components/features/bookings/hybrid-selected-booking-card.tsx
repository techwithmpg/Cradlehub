"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Play, X } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type HybridBookingViewModel = {
  id: string;
  booking_code?: string | null;
  customer_name?: string | null;
  service_name?: string | null;
  staff_name?: string | null;
  resource_name?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status: string;
  booking_progress_status?: string | null;
  session_started_at?: string | null;
  session_completed_at?: string | null;
  service_duration?: number | null;
  duration_minutes?: number | null;
  type?: string | null;
};

export type HybridSelectedBookingCardProps = {
  booking: HybridBookingViewModel;
  onClose?: () => void;
  onStartService?: () => void;
  onCompleteService?: () => void;
  isStarting?: boolean;
  isCompleting?: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Tick state: mountMs captured once; nowMs ticks every second. */
type TickState = { mountMs: number; nowMs: number };

function customerInitials(name: string | null | undefined): string {
  if (!name) return "CH";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first  = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${second}`.toUpperCase() || "CH";
}

function fmtCountdown(secs: number): string {
  const s  = Math.abs(Math.floor(secs));
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sc).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function fmtTimeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 text-[0.8125rem]">
      <span className="shrink-0 text-[var(--cs-text-muted)]">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-[var(--cs-text)]">
        {value}
      </span>
    </div>
  );
}

// ── Countdown zone (only in active-service mode) ──────────────────────────────

type CountdownZoneProps = {
  tick: TickState;
  sessionStartedAt: string;
  durationMins: number;
  staffName?: string | null;
  resourceName?: string | null;
};

function CountdownZone({
  tick,
  sessionStartedAt,
  durationMins,
  staffName,
  resourceName,
}: CountdownZoneProps) {
  const durationSecs = durationMins * 60;
  const startMs      = new Date(sessionStartedAt).getTime();

  const elapsedSecs  = Number.isFinite(startMs)
    ? Math.max(0, Math.floor((tick.nowMs - startMs) / 1000))
    : 0;
  const remainingSecs = Math.max(0, durationSecs - elapsedSecs);
  const progressPct   = Math.min(100, (elapsedSecs / durationSecs) * 100);
  const isOvertime    = elapsedSecs > durationSecs;
  const minutesLabel  = isOvertime
    ? "Overtime"
    : `${Math.ceil(remainingSecs / 60)} min`;
  const helperLabel   = isOvertime ? "Ready to complete" : "remaining";
  const timerDisplay  = isOvertime
    ? `+${fmtCountdown(elapsedSecs - durationSecs)}`
    : fmtCountdown(remainingSecs);
  const startedLabel  = Number.isFinite(startMs) ? fmtTimeLabel(sessionStartedAt) : null;

  return (
    <div className="mx-4 mb-4 overflow-hidden rounded-xl bg-[var(--cs-success-bg)] px-4 py-3">
      {/* Timer display */}
      <div className="text-center">
        <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--cs-success-text)]">
          {minutesLabel}
        </div>
        <div className="text-[10px] text-[var(--cs-text-muted)]">{helperLabel}</div>
        <div className="mt-1 text-[30px] font-bold tabular-nums leading-none text-[var(--cs-success-text)]">
          {timerDisplay}
        </div>
        <div className="mt-0.5 text-[11px] text-[var(--cs-text-muted)]">
          of {durationMins} min
        </div>
      </div>

      {/* Segmented progress bar */}
      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[rgba(0,0,0,0.08)]"
        role="progressbar"
        aria-valuenow={Math.round(progressPct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-[var(--cs-success)] transition-[width] duration-700 ease-linear"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Meta row */}
      {startedLabel ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1 text-[10px] text-[var(--cs-text-muted)]">
          <span>Started {startedLabel}</span>
          {staffName ? (
            <>
              <span>·</span>
              <span>{staffName}</span>
            </>
          ) : null}
          {resourceName ? (
            <>
              <span>·</span>
              <span>{resourceName}</span>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function HybridSelectedBookingCard({
  booking,
  onClose,
  onStartService,
  onCompleteService,
  isStarting  = false,
  isCompleting = false,
}: HybridSelectedBookingCardProps) {
  const [tick, setTick] = useState<TickState | null>(null);

  // Tick from inside callbacks only — never directly in effect body.
  useEffect(() => {
    const initId = setTimeout(() => {
      const now = Date.now();
      setTick({ mountMs: now, nowMs: now });
    }, 0);
    const tickId = setInterval(() => {
      setTick((prev) => (prev ? { mountMs: prev.mountMs, nowMs: Date.now() } : null));
    }, 1000);
    return () => {
      clearTimeout(initId);
      clearInterval(tickId);
    };
  }, []);

  const isServiceActive =
    booking.status === "in_progress" ||
    booking.booking_progress_status === "session_started";

  const shouldShowCountdown =
    isServiceActive && Boolean(booking.session_started_at) && tick !== null;

  const durationMins = booking.service_duration ?? booking.duration_minutes ?? 60;
  const showActions  = Boolean(onStartService ?? onCompleteService);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border",
        isServiceActive
          ? "border-[var(--cs-success-bg)] bg-[var(--cs-surface)]"
          : "border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]"
      )}
    >
      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--cs-sand-mist)] text-sm font-bold text-[var(--cs-sand-dark)]">
          {customerInitials(booking.customer_name)}
        </div>
        <div className="min-w-0 flex-1">
          <h2
            className="truncate text-lg font-semibold leading-tight text-[var(--cs-text)]"
            title={booking.customer_name ?? undefined}
          >
            {booking.customer_name ?? "Customer"}
          </h2>
          <div className="mt-1 text-sm leading-5 text-[var(--cs-text-secondary)]">
            {booking.service_name ?? "Service"}
            {booking.start_time ? ` / ${formatTime(booking.start_time)}` : ""}
          </div>
          {booking.resource_name ? (
            <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-[var(--cs-text-muted)]">
              {booking.resource_name}
            </div>
          ) : null}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close booking details"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text-muted)] transition-colors hover:text-[var(--cs-text)]"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      {/* ── Active-service countdown ─────────────────────────────────────── */}
      {shouldShowCountdown && tick ? (
        <CountdownZone
          tick={tick}
          sessionStartedAt={booking.session_started_at!}
          durationMins={durationMins}
          staffName={booking.staff_name}
          resourceName={booking.resource_name}
        />
      ) : null}

      {/* ── Detail rows ──────────────────────────────────────────────────── */}
      <div className="space-y-2 border-t border-[var(--cs-border-soft)] px-4 py-3">
        {booking.customer_name ? (
          <DetailRow label="Customer" value={booking.customer_name} />
        ) : null}
        {booking.service_name ? (
          <DetailRow
            label="Service"
            value={`${booking.service_name} (${durationMins} min)`}
          />
        ) : null}
        {booking.staff_name ? (
          <DetailRow label="Staff" value={booking.staff_name} />
        ) : null}
        {booking.resource_name ? (
          <DetailRow label="Room" value={booking.resource_name} />
        ) : null}
        {booking.start_time ? (
          <DetailRow
            label="Time"
            value={`${formatTime(booking.start_time)}${booking.end_time ? ` – ${formatTime(booking.end_time)}` : ""}`}
          />
        ) : null}
      </div>

      {/* ── Action buttons ───────────────────────────────────────────────── */}
      {showActions ? (
        <div className="grid grid-cols-2 gap-2 border-t border-[var(--cs-border-soft)] p-3">
          {/* Edit Booking — placeholder, no handler yet */}
          <button
            type="button"
            disabled
            aria-label="Edit booking (coming soon)"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-xs font-semibold text-[var(--cs-text-muted)] opacity-60"
          >
            <Clock size={13} />
            Edit Booking
          </button>

          {onCompleteService ? (
            <button
              type="button"
              onClick={onCompleteService}
              disabled={isCompleting}
              className={cn(
                "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors",
                "bg-[var(--cs-success)] text-white hover:bg-[var(--cs-success-text)]",
                isCompleting && "cursor-not-allowed opacity-60"
              )}
            >
              <CheckCircle2 size={13} />
              {isCompleting ? "Completing…" : "Complete Service"}
            </button>
          ) : onStartService ? (
            <button
              type="button"
              onClick={onStartService}
              disabled={isStarting}
              className={cn(
                "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors",
                "bg-[var(--cs-crm-text)] text-[var(--cs-text-inverse)] hover:bg-[var(--cs-success-text)]",
                isStarting && "cursor-not-allowed opacity-60"
              )}
            >
              <Play size={13} />
              {isStarting ? "Starting…" : "Start Service"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
