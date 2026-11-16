"use client";

import { useEffect, useState } from "react";
import { computeAttendanceMetrics } from "@/lib/attendance/time";
import type { AttendanceCredit } from "@/lib/attendance/v2-policy";

/**
 * Isolated leaf timer component that displays live elapsed duration from an ISO
 * clock-in timestamp without re-rendering parent tables or workspace state.
 */
export function LiveShiftClock({
  clockInAt,
  initialNowMs,
  className,
  credit,
}: {
  clockInAt: string;
  initialNowMs: number;
  className?: string;
  credit?: AttendanceCredit | null;
}) {
  const [nowMs, setNowMs] = useState(initialNowMs);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const diffMinutes = credit
    ? computeAttendanceMetrics({
        checkedInAt: clockInAt,
        credit,
        asOf: new Date(nowMs).toISOString(),
        lateGraceMinutes: 0,
        earlyLeaveGraceMinutes: 0,
      }).workedMinutes
    : Math.max(0, Math.floor((nowMs - new Date(clockInAt).getTime()) / 60_000));
  const hrs = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  const label = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

  return (
    <span className={className}>
      {label} {credit ? "credited · preliminary" : "elapsed"}
    </span>
  );
}
