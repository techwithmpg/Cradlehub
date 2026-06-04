"use client";

import { useEffect, useState } from "react";

type DriverActiveJobTimerProps = {
  startedAt?: string | null;
  fallbackLabel?: string;
};

function formatElapsed(startedAt: string): string {
  const started = new Date(startedAt).getTime();
  const diffSeconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  const seconds = diffSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function DriverActiveJobTimer({
  startedAt,
  fallbackLabel = "-",
}: DriverActiveJobTimerProps) {
  const [elapsed, setElapsed] = useState<string | null>(null);

  useEffect(() => {
    if (!startedAt) return;

    const interval = window.setInterval(() => {
      setElapsed(formatElapsed(startedAt));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [startedAt]);

  return <span>{startedAt ? elapsed ?? "-" : fallbackLabel}</span>;
}
