"use client";

import { useEffect, useRef, useState } from "react";
import { BedDouble, Clock3, Timer, UserRound } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type HybridBookingViewModel = {
  id: string;
  booking_code?: string | null;
  customer_name?: string | null;
  service_name?: string | null;
  staff_name?: string | null;
  resource_name?: string | null;
  booking_date?: string | null;
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
  /** Called once when the service countdown reaches zero (server must re-validate). */
  onAutoComplete?: () => void;
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

function fmtDateLabel(date: string | null | undefined): string | null {
  if (!date) return null;
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function SummaryStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 border-t border-[var(--cs-border-soft)] px-3 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--cs-surface)] text-[var(--cs-text-secondary)]">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
          {label}
        </div>
        <div className="mt-0.5 truncate text-sm font-semibold leading-5 text-[var(--cs-text)]" title={value}>
          {value}
        </div>
      </div>
    </div>
  );
}

// ── Countdown zone (active-service mode only) ─────────────────────────────────

type CountdownZoneProps = {
  elapsedSecs: number;
  remainingSecs: number;
  progressPct: number;
  durationMins: number;
  sessionStartedAt: string;
  staffName?: string | null;
  resourceName?: string | null;
};

function CountdownZone({
  elapsedSecs,
  remainingSecs,
  progressPct,
  durationMins,
  sessionStartedAt,
  staffName,
  resourceName,
}: CountdownZoneProps) {
  const isOvertime   = elapsedSecs > durationMins * 60;
  const minutesLabel = isOvertime
    ? "Overtime"
    : `${Math.ceil(remainingSecs / 60)} min`;
  const helperLabel  = isOvertime ? "Ready to complete" : "remaining";
  const timerDisplay = isOvertime
    ? `+${fmtCountdown(elapsedSecs - durationMins * 60)}`
    : fmtCountdown(remainingSecs);
  const startMs      = new Date(sessionStartedAt).getTime();
  const startedLabel = Number.isFinite(startMs) ? fmtTimeLabel(sessionStartedAt) : null;

  return (
    <div className="border-t border-[var(--cs-success-bg)] bg-[var(--cs-success-bg)] px-4 py-3">
      <div className="mb-1 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--cs-success-text)]">
        IN SERVICE
      </div>

      <div className="text-center">
        <div className="text-[11px] font-semibold text-[var(--cs-success-text)]">
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

      {/* Progress bar */}
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
          {staffName ? <><span>·</span><span>Staff: {staffName}</span></> : null}
          {resourceName ? <><span>·</span><span>Room: {resourceName}</span></> : null}
        </div>
      ) : null}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function HybridSelectedBookingCard({
  booking,
  onAutoComplete,
}: HybridSelectedBookingCardProps) {
  const [tick, setTick] = useState<TickState | null>(null);

  // Guard: fire onAutoComplete at most once per session.
  // Reset when the parent provides a new key (session_started_at changed).
  const hasAutoCompletedRef = useRef(false);

  // Tick setup — setState only from callbacks to satisfy react-hooks/set-state-in-effect.
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

  // ── Derived state ──────────────────────────────────────────────────────────

  const progress = booking.booking_progress_status ?? null;

  // Active ONLY when status flag AND session_started_at are both present.
  // This prevents showing "Complete Service" when the old statusAction only
  // wrote status = 'in_progress' but skipped the RPC (which also sets
  // session_started_at via update_booking_progress).
  const isServiceActive = (
    booking.status === "in_progress" ||
    progress === "session_started"
  ) && Boolean(booking.session_started_at);

  const shouldShowCountdown = isServiceActive && Boolean(booking.session_started_at) && tick !== null;

  const durationMins = booking.service_duration ?? booking.duration_minutes ?? 60;
  const durationSecs = durationMins * 60;

  // Compute elapsed / remaining at the top level so the auto-complete
  // effect can read them without needing a ref or additional state.
  let elapsedSecs  = 0;
  let remainingSecs = durationSecs;
  let progressPct  = 0;

  if (shouldShowCountdown && tick && booking.session_started_at) {
    const startMs = new Date(booking.session_started_at).getTime();
    if (Number.isFinite(startMs)) {
      const rawElapsed = Math.floor((tick.nowMs - startMs) / 1000);
      elapsedSecs   = Math.max(0, rawElapsed);
      remainingSecs = Math.max(0, durationSecs - elapsedSecs);
      progressPct   = Math.min(100, (elapsedSecs / durationSecs) * 100);
    }
  }

  const isCountdownDue = shouldShowCountdown && elapsedSecs >= durationSecs;
  const dateLabel = fmtDateLabel(booking.booking_date);
  const timeLabel = booking.start_time
    ? `${formatTime(booking.start_time)}${booking.end_time ? ` - ${formatTime(booking.end_time)}` : ""}`
    : "Time TBD";

  // Auto-complete effect — refs read in effects (never during render).
  useEffect(() => {
    if (!isCountdownDue) return;
    if (hasAutoCompletedRef.current) return;
    if (!onAutoComplete) return;
    hasAutoCompletedRef.current = true;
    onAutoComplete();
  }, [isCountdownDue, onAutoComplete]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border shadow-[var(--cs-shadow-xs)]",
        isServiceActive
          ? "border-[var(--cs-success-bg)] bg-[var(--cs-surface)]"
          : "border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]"
      )}
    >
      <div className="flex items-center gap-3 p-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--cs-sand-mist)] text-lg font-bold text-[var(--cs-sand-dark)]">
          {customerInitials(booking.customer_name)}
        </div>
        <div className="min-w-0 flex-1">
          <h2
            className="truncate text-lg font-semibold leading-tight text-[var(--cs-text)]"
            title={booking.customer_name ?? undefined}
          >
            {booking.customer_name ?? "Customer"}
          </h2>
          <div className="mt-1 truncate text-sm leading-5 text-[var(--cs-text-secondary)]">
            {booking.service_name ?? "Service"}
            {dateLabel ? ` · ${dateLabel}` : ""}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2">
        <SummaryStat icon={<Clock3 size={16} />} label="Time" value={timeLabel} />
        <SummaryStat icon={<UserRound size={16} />} label="Staff" value={booking.staff_name ?? "Unassigned"} />
        <SummaryStat icon={<BedDouble size={16} />} label="Room" value={booking.resource_name ?? "Room TBD"} />
        <SummaryStat icon={<Timer size={16} />} label="Duration" value={`${durationMins} min`} />
      </div>

      {shouldShowCountdown && booking.session_started_at ? (
        <CountdownZone
          elapsedSecs={elapsedSecs}
          remainingSecs={remainingSecs}
          progressPct={progressPct}
          durationMins={durationMins}
          sessionStartedAt={booking.session_started_at}
          staffName={booking.staff_name}
          resourceName={booking.resource_name}
        />
      ) : null}
    </div>
  );
}
