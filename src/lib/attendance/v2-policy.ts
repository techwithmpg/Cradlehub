/** Owner-approved 2026-11-16: one scan; arrival and credited start stay distinct. */
export const EARLY_ARRIVAL_LIMIT_MINUTES = 120;
export const CLOCK_OUT_REMINDER_INTERVAL_MS = 5 * 60_000;

export type AttendanceCredit = {
  version: 2;
  creditedStartAt: string;
  authorizedEndAt: string | null;
  creditedEndAt: string | null;
  actualClockOutAt: string | null;
  state: "preliminary" | "final" | "review";
  reason: string;
  revision?: number;
  activeWork?: boolean;
};

export function readAttendanceCredit(snapshot: unknown): AttendanceCredit | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const value = (snapshot as Record<string, unknown>).v2;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const credit = value as Partial<AttendanceCredit>;
  if (
    credit.version !== 2 ||
    typeof credit.creditedStartAt !== "string" ||
    !Number.isFinite(Date.parse(credit.creditedStartAt)) ||
    !["preliminary", "final", "review"].includes(credit.state ?? "")
  )
    return null;
  for (const field of ["authorizedEndAt", "creditedEndAt", "actualClockOutAt"] as const) {
    if (
      credit[field] !== null &&
      (typeof credit[field] !== "string" || !Number.isFinite(Date.parse(credit[field])))
    )
      return null;
  }
  if (credit.revision !== undefined && (!Number.isInteger(credit.revision) || credit.revision < 1))
    return null;
  return credit as AttendanceCredit;
}

/** Current interval only after an outage; never replay a burst of missed notices. */
export function dueClockOutReminder(
  deadline: string,
  now: string
): {
  interval: number;
  dueAt: string;
  nextDueAt: string;
} | null {
  const end = Date.parse(deadline);
  const instant = Date.parse(now);
  if (![end, instant].every(Number.isFinite)) return null;
  const interval = Math.floor((instant - end) / CLOCK_OUT_REMINDER_INTERVAL_MS);
  if (interval < 1) return null;
  return {
    interval,
    dueAt: new Date(end + interval * CLOCK_OUT_REMINDER_INTERVAL_MS).toISOString(),
    nextDueAt: new Date(end + (interval + 1) * CLOCK_OUT_REMINDER_INTERVAL_MS).toISOString(),
  };
}

export function attendanceV2Status(input: {
  checkedInAt: string;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  checkedOutAt: string | null;
  provisionalAutoClosedAt?: string | null;
  snapshot: unknown;
  now: string;
}): string | null {
  const credit = readAttendanceCredit(input.snapshot);
  if (!credit) return null;
  if (input.provisionalAutoClosedAt && !credit.actualClockOutAt) return "Provisionally closed";
  if (credit.state === "review") return "Needs review";
  if (input.checkedOutAt) return "Completed";
  const now = Date.parse(input.now);
  if (now < Date.parse(credit.creditedStartAt)) return "Early arrival";
  const active = credit.activeWork === true || (input.snapshot as Record<string, unknown>).hasActiveAssignment === true;
  if (active) return input.scheduledEndAt && now > Date.parse(input.scheduledEndAt) ? "Authorized extension" : "Working";
  if (credit.authorizedEndAt && now > Date.parse(credit.authorizedEndAt))
    return "Clock-out overdue";
  if (input.scheduledEndAt && now > Date.parse(input.scheduledEndAt)) return "Authorized extension";
  return "Working";
}

export function attendanceClockOutLabel(
  record: {
    checked_out_at: string | null;
    clock_out_method?: string | null;
    attendance_policy_snapshot?: unknown;
  },
  format: (value: string | null) => string
): string {
  const credit = readAttendanceCredit(record.attendance_policy_snapshot);
  if (record.clock_out_method === "system_auto_close") return "Provisional closure";
  if (credit && record.checked_out_at && !credit.actualClockOutAt) return "Reviewed time";
  return format(credit ? credit.actualClockOutAt : record.checked_out_at);
}
