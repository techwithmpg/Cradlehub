"use client";

import { useEffect, useRef, useState } from "react";

type ServiceSessionCountdownInput = {
  status: string;
  progressStatus?: string | null;
  sessionStartedAt?: string | null;
  durationMinutes: number;
  onDue?: () => void;
};

export type ServiceSessionCountdown = {
  active: boolean;
  ready: boolean;
  overtime: boolean;
  elapsedSeconds: number;
  remainingSeconds: number;
  progressPercent: number;
};

export function useServiceSessionCountdown({
  status,
  progressStatus,
  sessionStartedAt,
  durationMinutes,
  onDue,
}: ServiceSessionCountdownInput): ServiceSessionCountdown {
  const [nowMs, setNowMs] = useState<number | null>(null);
  const dueNotifiedRef = useRef(false);
  const active =
    (status === "in_progress" || progressStatus === "session_started") &&
    Boolean(sessionStartedAt);
  const durationSeconds = Math.max(1, durationMinutes) * 60;

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setNowMs(Date.now()), 0);
    const interval = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);

  let elapsedSeconds = 0;
  if (active && nowMs !== null && sessionStartedAt) {
    const startedMs = new Date(sessionStartedAt).getTime();
    if (Number.isFinite(startedMs)) {
      elapsedSeconds = Math.max(0, Math.floor((nowMs - startedMs) / 1_000));
    }
}
  const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);
  const progressPercent = Math.min(100, (elapsedSeconds / durationSeconds) * 100);
  const due = active && nowMs !== null && elapsedSeconds >= durationSeconds;

  useEffect(() => {
    if (!due || !onDue || dueNotifiedRef.current) return;
    dueNotifiedRef.current = true;
    onDue();
  }, [due, onDue]);

  return {
    active,
    ready: active && nowMs !== null,
    overtime: elapsedSeconds > durationSeconds,
    elapsedSeconds,
    remainingSeconds,
    progressPercent,
  };
}
