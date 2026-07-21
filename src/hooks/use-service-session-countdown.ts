"use client";

import { useEffect, useRef, useState } from "react";

type ServiceSessionCountdownInput = {
  status: string;
  progressStatus?: string | null;
  sessionStartedAt?: string | null;
  sessionDueAt?: string | null;
  durationMinutes: number;
  onDue?: () => void;
};

export type ServiceSessionCountdown = {
  active: boolean;
  ready: boolean;
  overtime: boolean;
  elapsedSeconds: number;
  remainingSeconds: number;
  overtimeSeconds: number;
  progressPercent: number;
};

function timestampMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function useServiceSessionCountdown({
  status,
  progressStatus,
  sessionStartedAt,
  sessionDueAt,
  durationMinutes,
  onDue,
}: ServiceSessionCountdownInput): ServiceSessionCountdown {
  const [nowMs, setNowMs] = useState<number | null>(null);
  const dueNotifiedRef = useRef(false);
  const active =
    (status === "in_progress" || progressStatus === "session_started") &&
    Boolean(sessionStartedAt);
  const startedMs = timestampMs(sessionStartedAt);
  const authoritativeDueMs = timestampMs(sessionDueAt);
  const fallbackDurationMs = Math.max(1, durationMinutes) * 60_000;
  const dueMs =
    authoritativeDueMs ??
    (startedMs === null ? null : startedMs + fallbackDurationMs);

  useEffect(() => {
    dueNotifiedRef.current = false;
  }, [sessionStartedAt, sessionDueAt]);

  useEffect(() => {
    if (!active) {
      const clearTimer = window.setTimeout(() => setNowMs(null), 0);
      return () => window.clearTimeout(clearTimer);
    }

    const initialTimer = window.setTimeout(() => setNowMs(Date.now()), 0);
    const interval = window.setInterval(() => setNowMs(Date.now()), 1_000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [active]);

  const elapsedSeconds =
    active && nowMs !== null && startedMs !== null
      ? Math.max(0, Math.floor((nowMs - startedMs) / 1_000))
      : 0;
  const remainingSeconds =
    active && nowMs !== null && dueMs !== null
      ? Math.max(0, Math.ceil((dueMs - nowMs) / 1_000))
      : 0;
  const overtimeSeconds =
    active && nowMs !== null && dueMs !== null
      ? Math.max(0, Math.floor((nowMs - dueMs) / 1_000))
      : 0;
  const totalSeconds =
    startedMs !== null && dueMs !== null
      ? Math.max(1, Math.floor((dueMs - startedMs) / 1_000))
      : Math.max(1, durationMinutes * 60);
  const progressPercent = Math.min(
    100,
    (elapsedSeconds / totalSeconds) * 100
  );
  const due = active && nowMs !== null && dueMs !== null && nowMs >= dueMs;

  useEffect(() => {
    if (!due || !onDue || dueNotifiedRef.current) return;
    dueNotifiedRef.current = true;
    onDue();
  }, [due, onDue]);

  return {
    active,
    ready: active && nowMs !== null && dueMs !== null,
    overtime: overtimeSeconds > 0,
    elapsedSeconds,
    remainingSeconds,
    overtimeSeconds,
    progressPercent,
  };
}
