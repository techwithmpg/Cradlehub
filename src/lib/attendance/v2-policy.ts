/** Owner-approved 2026-11-16 / reconciled 2026-11-18: one scan; arrival and credited start stay distinct. */
export const EARLY_ARRIVAL_LIMIT_MINUTES = 480;
export const STANDARD_CLOCK_OUT_REMINDER_DELAY_MINUTES = 20;
export const HOME_SERVICE_CLOCK_OUT_REMINDER_DELAY_MINUTES = 10;
export const CLOCK_OUT_REMINDER_REPEAT_INTERVAL_MS = 15 * 60_000;
export const CLOCK_OUT_REMINDER_INTERVAL_MS = STANDARD_CLOCK_OUT_REMINDER_DELAY_MINUTES * 60_000;

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
  now: string,
  options?: {
    delayMinutes?: number;
    repeatMinutes?: number;
    reminderKind?: "shift_end" | "final_home_service";
  }
): {
  interval: number;
  delayMinutes: number;
  reminderKind: "shift_end" | "final_home_service";
  dueAt: string;
  nextDueAt: string;
} | null {
  const end = Date.parse(deadline);
  const instant = Date.parse(now);
  if (![end, instant].every(Number.isFinite)) return null;
  const reminderKind = options?.reminderKind ?? "shift_end";
  const delayMinutes =
    options?.delayMinutes ??
    (reminderKind === "final_home_service"
      ? HOME_SERVICE_CLOCK_OUT_REMINDER_DELAY_MINUTES
      : STANDARD_CLOCK_OUT_REMINDER_DELAY_MINUTES);
  const delayMs = delayMinutes * 60_000;
  const repeatMs = (options?.repeatMinutes ?? 15) * 60_000;
  const elapsed = instant - end;
  if (elapsed < delayMs) return null;
  const interval = 1 + Math.floor((elapsed - delayMs) / repeatMs);
  return {
    interval,
    delayMinutes,
    reminderKind,
    dueAt: new Date(end + delayMs + (interval - 1) * repeatMs).toISOString(),
    nextDueAt: new Date(end + delayMs + interval * repeatMs).toISOString(),
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


