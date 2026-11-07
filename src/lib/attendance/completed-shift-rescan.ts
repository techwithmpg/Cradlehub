import { timeToMinutes } from "@/lib/utils/time-format";

/**
 * Conservative, read-only decision for re-scans following a completed shift.
 *
 * This is an application preflight, NOT an atomic database constraint. The
 * database commit path (`public.commit_attendance_scan_transaction`) enforces
 * the authoritative schedule, business-date, and clock-in window invariants.
 */
export type CompletedAttendanceShift = {
  shift_instance_key: string | null;
  shift_date: string;
  shift_type: string;
  checked_out_at: string | null;
  attendance_business_date?: string | null;
};

export type IncomingAttendanceShift = {
  key: string;
  shiftDate: string;
  shiftType: string;
  scheduledStartAt: string | null;
  scheduledEndAt?: string | null;
  attendanceBusinessDate?: string | null;
};

function parseWindowNumber(key: string | null): number | null {
  const segment = key?.split("|")[4] ?? null;
  if (!segment?.startsWith("window:")) return null;
  const parsed = Number.parseInt(segment.slice("window:".length), 10);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
}

function parseKeyWindowTimes(key: string | null): {
  startMinutes: number | null;
  endMinutes: number | null;
  sourceType: string | null;
} {
  if (!key) return { startMinutes: null, endMinutes: null, sourceType: null };
  const parts = key.split("|");
  if (parts.length < 9) {
    return { startMinutes: null, endMinutes: null, sourceType: null };
  }
  return {
    startMinutes: timeToMinutes(parts[5] ?? null),
    endMinutes: timeToMinutes(parts[6] ?? null),
    sourceType: parts[7] ?? null,
  };
}

/**
 * A second scan is blocked unless it unambiguously belongs to a higher-ordered,
 * non-adjacent weekly split-shift window that starts strictly AFTER the prior
 * shift's scheduled end and actual clock-out, and (when scan timing is supplied)
 * falls inside the authorized clock-in window.
 */
export function shouldBlockCompletedShiftRescan(params: {
  completed: CompletedAttendanceShift[];
  incoming: IncomingAttendanceShift;
  intentAction: string;
  requiresRecovery: boolean;
  scanIso?: string | null;
  clockInWindowBeforeMinutes?: number;
  clockInWindowAfterMinutes?: number;
}): boolean {
  if (params.completed.length === 0) return false;

  const incomingKeyInfo = parseKeyWindowTimes(params.incoming.key);
  const incomingBusinessDate = params.incoming.attendanceBusinessDate ?? params.incoming.shiftDate;

  for (const closed of params.completed) {
    if (closed.shift_instance_key && closed.shift_instance_key === params.incoming.key) {
      return true;
    }

    const closedBusinessDate = closed.attendance_business_date ?? closed.shift_date;
    const previousWindow = parseWindowNumber(closed.shift_instance_key);
    const nextWindow = parseWindowNumber(params.incoming.key);
    const closedKeyInfo = parseKeyWindowTimes(closed.shift_instance_key);

    const explicitlyLaterWindow =
      previousWindow !== null &&
      nextWindow !== null &&
      nextWindow > previousWindow &&
      closedBusinessDate === incomingBusinessDate &&
      closed.shift_date === params.incoming.shiftDate;

    const hasValidSplitSeparation =
      closedKeyInfo.startMinutes !== null &&
      closedKeyInfo.endMinutes !== null &&
      incomingKeyInfo.startMinutes !== null &&
      incomingKeyInfo.endMinutes !== null
        ? closedKeyInfo.startMinutes < closedKeyInfo.endMinutes &&
          closedKeyInfo.endMinutes < incomingKeyInfo.startMinutes &&
          closedKeyInfo.sourceType === "weekly" &&
          incomingKeyInfo.sourceType === "weekly"
        : true;

    const previousEnd = Date.parse(closed.checked_out_at ?? "");
    const nextStart = Date.parse(params.incoming.scheduledStartAt ?? "");
    let withinAuthorizedClockInWindow = true;
    if (params.scanIso && Number.isFinite(nextStart)) {
      const scanMs = Date.parse(params.scanIso);
      const beforeMs = Math.max(params.clockInWindowBeforeMinutes ?? 30, 0) * 60_000;
      const afterMs = Math.max(params.clockInWindowAfterMinutes ?? 120, 0) * 60_000;
      const nextEnd = Date.parse(params.incoming.scheduledEndAt ?? "");
      const latestAllowedMs = Number.isFinite(nextEnd)
        ? Math.min(nextEnd, nextStart + afterMs)
        : nextStart + afterMs;
      withinAuthorizedClockInWindow =
        Number.isFinite(scanMs) &&
        scanMs > previousEnd &&
        scanMs >= nextStart - beforeMs &&
        scanMs <= latestAllowedMs;
    }

    const genuinelyLaterShift =
      params.intentAction === "clock_in" &&
      !params.requiresRecovery &&
      explicitlyLaterWindow &&
      hasValidSplitSeparation &&
      withinAuthorizedClockInWindow &&
      Number.isFinite(previousEnd) &&
      Number.isFinite(nextStart) &&
      nextStart > previousEnd;

    if (!genuinelyLaterShift) return true;
  }

  return false;
}
