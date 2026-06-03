/**
 * Shared service-session timing helpers.
 *
 * Used by:
 *   - ServiceSessionCountdown (staff portal modal)
 *
 * The CRM ServiceCountdownChip keeps its own self-contained implementation
 * to avoid coupling changes here from breaking the CRM panel.
 */

export const SERVICE_BUFFER_SECS = 300; // 5-minute start buffer
export const SERVICE_GRACE_SECS  = 300; // 5-minute grace after service ends

export type ServiceTimerPhase =
  | "buffer"
  | "delayed"
  | "running"
  | "grace"
  | "overtime"
  | "done";

export type ServiceTimerState = {
  phase: ServiceTimerPhase;
  /** Seconds shown in the timer (remaining or elapsed depending on phase). */
  displaySecs: number;
  /** 0–100 clamped progress bar value. */
  progressPct: number;
  elapsedSecs: number;
  totalSecs: number;
  /** True when the service duration has just expired (phase becomes grace). */
  isDue: boolean;
};

export type ServiceTimerInput = {
  status?: string | null;
  progressStatus?: string | null;
  checkedInAt?: string | null;
  sessionStartedAt?: string | null;
  durationMinutes?: number | null;
  resourceId?: string | null;
  isHomeService?: boolean;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function toMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function fmtServiceSecs(secs: number, prefix: "+" | "" = ""): string {
  const s = Math.abs(Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm  = String(m).padStart(2, "0");
  const ss  = String(sec).padStart(2, "0");
  const base = h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  return `${prefix}${base}`;
}

// ── Core state computation (pure) ─────────────────────────────────────────────

export function computeServiceTimerState(
  input: ServiceTimerInput,
  nowMs: number,
  mountMs: number,
): ServiceTimerState | null {
  const { status, progressStatus, checkedInAt, sessionStartedAt, durationMinutes, resourceId, isHomeService } = input;

  if (isHomeService || !status) return null;

  // Hide for pending / closed / cancelled
  const pendingStatuses = new Set(["pending", "pending_payment", "pending_crm_confirmation"]);
  if (pendingStatuses.has(status)) return null;
  if (status === "cancelled" || status === "no_show" || progressStatus === "no_show") return null;

  if (status === "completed" || progressStatus === "completed") {
    return { phase: "done", displaySecs: 0, progressPct: 100, elapsedSecs: 0, totalSecs: 0, isDue: false };
  }

  // Session running / grace / overtime
  if (progressStatus === "session_started" || status === "in_progress") {
    const startMs = toMs(sessionStartedAt);
    if (startMs === null) return null;

    const dSecs   = (durationMinutes ?? 60) * 60;
    const endMs   = startMs + dSecs * 1000;
    const graceMs = endMs + SERVICE_GRACE_SECS * 1000;
    const elapsed = Math.floor((nowMs - startMs) / 1000);

    if (nowMs <= endMs) {
      return { phase: "running",  displaySecs: Math.ceil((endMs - nowMs) / 1000),   progressPct: clamp((elapsed / dSecs) * 100),                 elapsedSecs: elapsed, totalSecs: dSecs,              isDue: false };
    }
    if (nowMs <= graceMs) {
      const ge = Math.floor((nowMs - endMs) / 1000);
      return { phase: "grace",    displaySecs: Math.ceil((graceMs - nowMs) / 1000), progressPct: clamp((ge / SERVICE_GRACE_SECS) * 100),          elapsedSecs: ge,      totalSecs: SERVICE_GRACE_SECS, isDue: true  };
    }
    const ot = Math.floor((nowMs - graceMs) / 1000);
    return   { phase: "overtime", displaySecs: ot,                                  progressPct: 100,                                             elapsedSecs: ot,      totalSecs: SERVICE_GRACE_SECS, isDue: true  };
  }

  // Start buffer — checked_in with room assigned
  if (progressStatus === "checked_in" && resourceId) {
    const refMs   = toMs(checkedInAt) ?? mountMs;
    const bufEnd  = refMs + SERVICE_BUFFER_SECS * 1000;
    const elapsed = Math.floor((nowMs - refMs) / 1000);

    if (nowMs <= bufEnd) {
      return { phase: "buffer",  displaySecs: Math.ceil((bufEnd - nowMs) / 1000), progressPct: clamp((elapsed / SERVICE_BUFFER_SECS) * 100), elapsedSecs: elapsed,               totalSecs: SERVICE_BUFFER_SECS, isDue: false };
    }
    const del = Math.floor((nowMs - bufEnd) / 1000);
    return   { phase: "delayed", displaySecs: del,                                progressPct: 100,                                          elapsedSecs: del + SERVICE_BUFFER_SECS, totalSecs: SERVICE_BUFFER_SECS, isDue: false };
  }

  return null;
}
