"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Hourglass,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  computeServiceTimerState,
  fmtServiceSecs,
  type ServiceTimerInput,
  type ServiceTimerPhase,
} from "@/lib/bookings/service-session";

// ── Phase visual config ────────────────────────────────────────────────────────

type PhaseViz = {
  Icon: LucideIcon;
  label: string;
  helper: string;
  badge: string;
  timer: (s: number) => string;
  bg: string;
  accent: string;
  bar: string;
};

const VIZ: Record<ServiceTimerPhase, PhaseViz> = {
  buffer: {
    Icon: Clock,         label: "Start within",   helper: "5 min buffer to start service",
    badge: "Start Buffer", timer: (s) => fmtServiceSecs(s),
    bg: "var(--cs-sand-tint)", accent: "var(--cs-sand-dark)", bar: "var(--cs-sand)",
  },
  delayed: {
    Icon: AlertTriangle, label: "Start delayed",  helper: "Start service soon",
    badge: "Delayed",      timer: (s) => fmtServiceSecs(s, "+"),
    bg: "var(--cs-error-bg)", accent: "var(--cs-error-text)", bar: "var(--cs-error)",
  },
  running: {
    Icon: Timer,         label: "Time remaining", helper: "Service in progress",
    badge: "In Service",   timer: (s) => fmtServiceSecs(s),
    bg: "var(--cs-success-bg)", accent: "var(--cs-success-text)", bar: "var(--cs-success)",
  },
  grace: {
    Icon: Hourglass,     label: "Grace period",   helper: "Wrap up soon",
    badge: "Grace",        timer: (s) => fmtServiceSecs(s),
    bg: "var(--cs-sand-tint)", accent: "var(--cs-sand-dark)", bar: "var(--cs-sand)",
  },
  overtime: {
    Icon: AlertTriangle, label: "Overtime",       helper: "Needs attention",
    badge: "Overtime",     timer: (s) => fmtServiceSecs(s, "+"),
    bg: "var(--cs-error-bg)", accent: "var(--cs-error-text)", bar: "var(--cs-error)",
  },
  done: {
    Icon: CheckCircle2,  label: "Completed",      helper: "Service finished",
    badge: "",             timer: () => "",
    bg: "var(--cs-success-bg)", accent: "var(--cs-success-text)", bar: "var(--cs-success)",
  },
};

// ── Tick state ─────────────────────────────────────────────────────────────────
// mountMs is captured once; nowMs advances every second.
// Both are set from inside timer callbacks (never directly in effect body).

type TickState = { mountMs: number; nowMs: number };

// ── Component ─────────────────────────────────────────────────────────────────

type ServiceSessionCountdownProps = ServiceTimerInput & {
  /** Fired once when the service duration expires (phase reaches grace or overtime). */
  onDue?: () => void;
  className?: string;
};

export function ServiceSessionCountdown({
  onDue,
  className,
  ...input
}: ServiceSessionCountdownProps) {
  const [tick, setTick] = useState<TickState | null>(null);

  // Stable ref to onDue — reads happen in effects only (not during render).
  const onDueRef    = useRef(onDue);
  const dueFiredRef = useRef(false);

  // Keep onDueRef current without causing re-renders.
  useEffect(() => {
    onDueRef.current = onDue;
  }, [onDue]);

  // Tick setup — setState only from callbacks, never directly in effect body.
  useEffect(() => {
    const initId = setTimeout(() => {
      const now = Date.now();
      setTick({ mountMs: now, nowMs: now });
    }, 0);
    const tickId = setInterval(() => {
      setTick((prev) => (prev ? { mountMs: prev.mountMs, nowMs: Date.now() } : null));
    }, 1000);
    return () => { clearTimeout(initId); clearInterval(tickId); };
  }, []);

  // Derive phase (no ref reads — pure computation from state).
  const state = tick
    ? computeServiceTimerState(input, tick.nowMs, tick.mountMs)
    : null;
  const currentPhase: ServiceTimerPhase | null = state?.phase ?? null;

  // Fire onDue in an effect (safe for ref reads/writes; not during render).
  useEffect(() => {
    if (currentPhase !== "grace" && currentPhase !== "overtime") return;
    if (dueFiredRef.current) return;
    dueFiredRef.current = true;
    onDueRef.current?.();
  }, [currentPhase]);

  if (!tick || !state) return null;

  const v    = VIZ[state.phase];
  const Icon = v.Icon;

  // Completed — small one-line chip
  if (state.phase === "done") {
    return (
      <div
        className={cn("flex items-center gap-2 rounded-xl px-3 py-2", className)}
        style={{ background: v.bg }}
      >
        <Icon size={14} aria-hidden style={{ color: v.accent, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: v.accent }}>
          {v.label} · {v.helper}
        </span>
      </div>
    );
  }

  return (
    <div
      role="timer"
      aria-live="off"
      className={cn("overflow-hidden rounded-2xl", className)}
      style={{ background: v.bg, padding: "1rem" }}
    >
      {/* Label + badge row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon size={15} aria-hidden style={{ color: v.accent, flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--cs-text-muted)" }}>
            {v.label}
          </span>
        </div>
        {v.badge ? (
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: v.accent, background: "rgba(255,255,255,0.35)", borderRadius: 99, padding: "2px 8px" }}>
            {v.badge}
          </span>
        ) : null}
      </div>

      {/* Big timer */}
      <div style={{ marginTop: 6, paddingLeft: 21 }}>
        <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: v.accent }}>
          {v.timer(state.displaySecs)}
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: "var(--cs-text-muted)" }}>
          {v.helper}
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{ marginTop: 12, height: 4, width: "100%", borderRadius: 99, background: "rgba(0,0,0,0.08)", overflow: "hidden" }}
        role="progressbar"
        aria-valuenow={Math.round(state.progressPct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 99,
            background: v.bar,
            width: `${state.progressPct}%`,
            transition: "width 0.7s linear",
          }}
        />
      </div>
    </div>
  );
}
