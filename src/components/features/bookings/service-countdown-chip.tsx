"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Hourglass,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isCrmPendingBookingStatus } from "@/lib/bookings/crm-booking-status";

// ── Constants ────────────────────────────────────────────────────────────────

const BUFFER_SECS = 300; // 5-minute start buffer
const GRACE_SECS  = 300; // 5-minute grace period after service ends

// ── Types ────────────────────────────────────────────────────────────────────

type Phase = "buffer" | "delayed" | "running" | "grace" | "overtime" | "done";

type TimerState = {
  phase: Phase;
  /** Seconds to display (remaining for countdowns, elapsed for overtime/delay). */
  displaySecs: number;
  /** 0–100 for the progress bar. */
  progressPct: number;
  elapsedSecs: number;
  totalSecs: number;
};

export type ServiceCountdownChipProps = {
  status?: string | null;
  progressStatus?: string | null;
  checkedInAt?: string | null;
  sessionStartedAt?: string | null;
  sessionCompletedAt?: string | null;
  durationMinutes?: number | null;
  resourceId?: string | null;
  isHomeService?: boolean;
};

// ── Pure helpers ─────────────────────────────────────────────────────────────

function toMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function fmtSecs(secs: number, prefix: "+" | "" = ""): string {
  const s = Math.abs(Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm  = String(m).padStart(2, "0");
  const ss  = String(sec).padStart(2, "0");
  const base = h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  return `${prefix}${base}`;
}

function computeState(
  props: ServiceCountdownChipProps,
  nowMs: number,
  mountMs: number,
): TimerState | null {
  const { status, progressStatus, checkedInAt, sessionStartedAt, durationMinutes, resourceId, isHomeService } = props;

  if (isHomeService || !status) return null;
  if (isCrmPendingBookingStatus(status)) return null;
  if (status === "cancelled" || status === "no_show" || progressStatus === "no_show") return null;

  // Completed — tiny calm chip
  if (status === "completed" || progressStatus === "completed") {
    return { phase: "done", displaySecs: 0, progressPct: 100, elapsedSecs: 0, totalSecs: 0 };
  }

  // Session running / grace / overtime
  if (progressStatus === "session_started" || status === "in_progress") {
    const startMs = toMs(sessionStartedAt);
    if (startMs === null) return null;

    const dSecs   = (durationMinutes ?? 60) * 60;
    const endMs   = startMs + dSecs * 1000;
    const graceMs = endMs   + GRACE_SECS * 1000;
    const elapsed = Math.floor((nowMs - startMs) / 1000);

    if (nowMs <= endMs) {
      return { phase: "running",   displaySecs: Math.ceil((endMs - nowMs) / 1000),    progressPct: clamp((elapsed / dSecs)       * 100), elapsedSecs: elapsed,                      totalSecs: dSecs       };
    }
    if (nowMs <= graceMs) {
      const ge = Math.floor((nowMs - endMs) / 1000);
      return { phase: "grace",    displaySecs: Math.ceil((graceMs - nowMs) / 1000),   progressPct: clamp((ge / GRACE_SECS)       * 100), elapsedSecs: ge,                           totalSecs: GRACE_SECS  };
    }
    const ot = Math.floor((nowMs - graceMs) / 1000);
    return   { phase: "overtime", displaySecs: ot,                                    progressPct: 100,                                   elapsedSecs: ot,                           totalSecs: GRACE_SECS  };
  }

  // Start buffer — checked_in with room assigned
  if (progressStatus === "checked_in" && resourceId) {
    // Use checkedInAt as the reference; fall back to mount time (never changes) if absent.
    const refMs   = toMs(checkedInAt) ?? mountMs;
    const bufEnd  = refMs + BUFFER_SECS * 1000;
    const elapsed = Math.floor((nowMs - refMs) / 1000);

    if (nowMs <= bufEnd) {
      return { phase: "buffer",  displaySecs: Math.ceil((bufEnd - nowMs) / 1000), progressPct: clamp((elapsed / BUFFER_SECS) * 100), elapsedSecs: elapsed,               totalSecs: BUFFER_SECS };
    }
    const del = Math.floor((nowMs - bufEnd) / 1000);
    return     { phase: "delayed", displaySecs: del,                              progressPct: 100,                                   elapsedSecs: del + BUFFER_SECS,     totalSecs: BUFFER_SECS };
  }

  return null;
}

// ── Visual config per phase ──────────────────────────────────────────────────

type PhaseViz = {
  Icon: LucideIcon;
  label: string;
  helper: string;
  badge: string;
  timer: (s: number) => string;
  card: string;
  icon: string;
  text: string;
  pill: string;
  bar: string;
  track: string;
};

const SAND_CARD   = "border-[var(--cs-sand-mist)] bg-[var(--cs-sand-tint)]";
const SAND_TEXT   = "text-[var(--cs-sand-dark)]";
const SAND_PILL   = "border-[var(--cs-sand)] bg-[var(--cs-sand-mist)] text-[var(--cs-sand-dark)]";
const SAND_BAR    = "bg-[var(--cs-sand)]";

const ERR_CARD    = "border-[var(--cs-error-bg)] bg-[var(--cs-error-bg)]";
const ERR_TEXT    = "text-[var(--cs-error-text)]";
const ERR_PILL    = "border-[var(--cs-error-text)] bg-[var(--cs-error-bg)] text-[var(--cs-error-text)]";
const ERR_BAR     = "bg-[var(--cs-error)]";

const SOFT_TRACK  = "bg-[var(--cs-border-soft)]";

const VIZ: Record<Phase, PhaseViz> = {
  buffer: {
    Icon: Clock,        label: "Start within",  helper: "5 min buffer to start service",
    badge: "Start Buffer", timer: (s) => fmtSecs(s),
    card: SAND_CARD, icon: SAND_TEXT, text: SAND_TEXT, pill: SAND_PILL, bar: SAND_BAR, track: SOFT_TRACK,
  },
  delayed: {
    Icon: AlertTriangle, label: "Start delayed", helper: "Start service soon",
    badge: "Delayed",      timer: (s) => fmtSecs(s, "+"),
    card: ERR_CARD,  icon: ERR_TEXT, text: ERR_TEXT, pill: ERR_PILL, bar: ERR_BAR, track: SOFT_TRACK,
  },
  running: {
    Icon: Timer,         label: "Time remaining", helper: "Service running",
    badge: "In Service",   timer: (s) => fmtSecs(s),
    card: "border-[var(--cs-success-bg)] bg-[var(--cs-success-bg)]",
    icon: "text-[var(--cs-success-text)]", text: "text-[var(--cs-success-text)]",
    pill: "border-[var(--cs-success-bg)] bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]",
    bar: "bg-[var(--cs-success)]", track: SOFT_TRACK,
  },
  grace: {
    Icon: Hourglass,     label: "Grace period",  helper: "Wrap up soon",
    badge: "Grace",        timer: (s) => fmtSecs(s),
    card: SAND_CARD, icon: SAND_TEXT, text: SAND_TEXT, pill: SAND_PILL, bar: SAND_BAR, track: SOFT_TRACK,
  },
  overtime: {
    Icon: AlertTriangle, label: "Overtime",      helper: "Needs attention",
    badge: "Overtime",     timer: (s) => fmtSecs(s, "+"),
    card: ERR_CARD,  icon: ERR_TEXT, text: ERR_TEXT, pill: ERR_PILL, bar: ERR_BAR, track: SOFT_TRACK,
  },
  done: {
    Icon: CheckCircle2,  label: "Completed",     helper: "Service finished",
    badge: "",             timer: () => "",
    card: "border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]",
    icon: "text-[var(--cs-success-text)]", text: "text-[var(--cs-text-muted)]",
    pill: "", bar: "bg-[var(--cs-success)]", track: SOFT_TRACK,
  },
};

// ── Tick state ────────────────────────────────────────────────────────────────

/**
 * `null` while server-rendering / before first client tick.
 * `mountMs` is captured once and stays stable; `nowMs` advances every second.
 * Both are set from inside timer callbacks (never directly in the effect body)
 * to satisfy the react-hooks/set-state-in-effect and react-hooks/refs rules.
 */
type TickState = { mountMs: number; nowMs: number };

// ── Component ────────────────────────────────────────────────────────────────

export function ServiceCountdownChip(props: ServiceCountdownChipProps) {
  const [tick, setTick] = useState<TickState | null>(null);

  useEffect(() => {
    // Capture mount time inside a callback so setState is never called
    // directly in the effect body (react-hooks/set-state-in-effect).
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

  if (!tick) return null;

  const state = computeState(props, tick.nowMs, tick.mountMs);
  if (!state) return null;

  const v    = VIZ[state.phase];
  const Icon = v.Icon;

  // Completed — tiny one-line chip, no countdown
  if (state.phase === "done") {
    return (
      <div className={cn("flex items-center gap-2 rounded-xl border px-3 py-2", v.card)}>
        <Icon size={13} className={v.icon} aria-hidden />
        <span className="text-[11px] font-medium text-[var(--cs-text-secondary)]">
          {v.label}
          {" · "}
          <span className="text-[var(--cs-text-muted)]">{v.helper}</span>
        </span>
      </div>
    );
  }

  return (
    <div
      role="timer"
      aria-live="off"
      className={cn(
        "overflow-hidden rounded-2xl border px-3 pb-2 pt-2.5 shadow-[var(--cs-shadow-xs)]",
        v.card,
      )}
    >
      {/* Label row + badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Icon size={14} className={cn("shrink-0", v.icon)} aria-hidden />
          <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
            {v.label}
          </span>
        </div>
        {v.badge ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide",
              v.pill,
            )}
          >
            {v.badge}
          </span>
        ) : null}
      </div>

      {/* Timer + helper — indented to align with label text */}
      <div className="mt-0.5 pl-[22px]">
        <div className={cn("text-[22px] font-bold leading-none tabular-nums", v.text)}>
          {v.timer(state.displaySecs)}
        </div>
        <div className="mt-0.5 text-[10px] leading-4 text-[var(--cs-text-muted)]">
          {v.helper}
        </div>
      </div>

      {/* Progress bar */}
      <div
        className={cn("mt-2 h-1 w-full overflow-hidden rounded-full", v.track)}
        role="progressbar"
        aria-valuenow={Math.round(state.progressPct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-700 ease-linear", v.bar)}
          style={{ width: `${state.progressPct}%` }}
        />
      </div>
    </div>
  );
}
