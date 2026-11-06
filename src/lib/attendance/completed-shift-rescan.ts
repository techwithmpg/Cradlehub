/**
 * Conservative, read-only decision for re-scans following a completed shift.
 *
 * This is an application preflight, NOT an atomic database constraint. The
 * database commit path must enforce the same invariant before release.
 */
export type CompletedAttendanceShift = {
  shift_instance_key: string | null;
  shift_date: string;
  shift_type: string;
  checked_out_at: string | null;
};

export type IncomingAttendanceShift = {
  key: string;
  shiftDate: string;
  shiftType: string;
  scheduledStartAt: string | null;
};

function windowOrder(key: string | null): string | null {
  const segment = key?.split("|")[4] ?? null;
  return segment?.startsWith("window:") ? segment : null;
}

/**
 * A second scan is blocked unless it unambiguously belongs to a different,
 * newly scheduled window that starts AFTER the last completed clock-out.
 * Different branches are deliberately assessed separately by the caller.
 */
export function shouldBlockCompletedShiftRescan(params: {
  completed: CompletedAttendanceShift[];
  incoming: IncomingAttendanceShift;
  intentAction: string;
  requiresRecovery: boolean;
}): boolean {
  if (params.completed.length === 0) return false;

  for (const closed of params.completed) {
    if (closed.shift_instance_key && closed.shift_instance_key === params.incoming.key) {
      return true;
    }

    const previousWindow = windowOrder(closed.shift_instance_key);
    const nextWindow = windowOrder(params.incoming.key);
    const explicitlyDifferentWindow =
      previousWindow !== null &&
      nextWindow !== null &&
      previousWindow !== nextWindow &&
      closed.shift_date === params.incoming.shiftDate;

    const previousEnd = Date.parse(closed.checked_out_at ?? "");
    const nextStart = Date.parse(params.incoming.scheduledStartAt ?? "");
    const genuinelyLaterShift =
      params.intentAction === "clock_in" &&
      !params.requiresRecovery &&
      explicitlyDifferentWindow &&
      Number.isFinite(previousEnd) &&
      Number.isFinite(nextStart) &&
      nextStart > previousEnd;

    if (!genuinelyLaterShift) return true;
  }

  return false;
}
