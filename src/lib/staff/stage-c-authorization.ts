import { BRANCH_TIMEZONE, addDaysToYmd } from "@/lib/engine/slot-time";
import type { WorkspaceNotification } from "@/lib/notifications/types";

const STAGE_C_EARLY_ARRIVAL_MS = 120 * 60_000;
const MAX_SHIFT_WINDOW_MS = 24 * 3600_000;
const CALENDAR_YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TZ_ISO_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)$/i;

export type StageCAssistanceRowCandidate = {
  id?: string | null;
  staff_id?: string | null;
  receiving_branch_id?: string | null;
  assistance_date?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  status?: string | null;
};

export type ParsedStageCAssistanceWindow = {
  id: string;
  staffId: string;
  receivingBranchId: string;
  assistanceDate: string;
  nextAssistanceDate: string;
  startMs: number;
  effectiveStartMs: number;
  endMs: number;
  crossesMidnight: boolean;
};

export type BorrowedBookingAuthorityRow = {
  id?: string | null;
  branch_id?: string | null;
  staff_id?: string | null;
  booking_date?: string | null;
  status?: string | null;
  booking_progress_status?: string | null;
  session_started_at?: string | null;
  session_completed_at?: string | null;
};

export type BorrowedStaffScope = {
  id: string;
  branch_id: string | null | undefined;
  is_active: boolean;
  archived_at?: string | null;
  merged_into_staff_id?: string | null;
};

function isValidCalendarYmdParts(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

/** Validates an exact YYYY-MM-DD calendar date without silently rolling invalid days forward. */
export function isValidCalendarYmd(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = CALENDAR_YMD_RE.exec(value);
  if (!match) return false;
  return isValidCalendarYmdParts(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** Parses an ISO-8601 timestamp requiring an explicit UTC or numeric offset so TZ cannot drift. */
export function parseTzIsoTimestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = TZ_ISO_RE.exec(trimmed);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (!isValidCalendarYmdParts(year, month, day)) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;

  let normalized = trimmed.replace(" ", "T");
  if (/[+-]\d{2}$/.test(normalized)) {
    normalized += ":00";
  } else if (/[+-]\d{4}$/.test(normalized)) {
    normalized = `${normalized.slice(0, -2)}:${normalized.slice(-2)}`;
  }

  const parsedMs = Date.parse(normalized);
  return Number.isFinite(parsedMs) ? parsedMs : null;
}

function manilaDateAndTime(ms: number): { ymd: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRANCH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms));

  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const hour = pick("hour") === "24" ? "00" : pick("hour");
  return {
    ymd: `${pick("year")}-${pick("month")}-${pick("day")}`,
    time: `${hour}:${pick("minute")}:${pick("second")}`,
  };
}

/**
 * Validates and normalizes a Stage C assistance assignment row using Asia/Manila
 * timezone boundaries. Fails closed on missing, malformed, inverted, multi-day,
 * unarrived/inactive, or mismatched assistance rows.
 */
export function parseStageCAssistanceWindow(
  row: StageCAssistanceRowCandidate | null | undefined,
  expected?: {
    staffId?: string;
    receivingBranchId?: string;
    allowedStatuses?: readonly string[];
  }
): ParsedStageCAssistanceWindow | null {
  if (!row || typeof row !== "object") return null;

  const id = typeof row.id === "string" ? row.id.trim() : "";
  const staffId = typeof row.staff_id === "string" ? row.staff_id.trim() : "";
  const receivingBranchId =
    typeof row.receiving_branch_id === "string" ? row.receiving_branch_id.trim() : "";
  const status = typeof row.status === "string" ? row.status.trim() : "";

  if (!id || !staffId || !receivingBranchId) return null;
  if (expected?.staffId && staffId !== expected.staffId) return null;
  if (expected?.receivingBranchId && receivingBranchId !== expected.receivingBranchId) return null;

  const allowedStatuses = expected?.allowedStatuses ?? ["arrived_clocked_in"];
  if (!allowedStatuses.includes(status)) return null;

  if (!isValidCalendarYmd(row.assistance_date)) return null;
  const startMs = parseTzIsoTimestamp(row.start_at);
  const endMs = parseTzIsoTimestamp(row.end_at);
  if (startMs === null || endMs === null || endMs <= startMs) return null;
  if (endMs - startMs > MAX_SHIFT_WINDOW_MS) return null;

  const startLocal = manilaDateAndTime(startMs);
  const endLocal = manilaDateAndTime(endMs);
  if (startLocal.ymd !== row.assistance_date) return null;

  const nextAssistanceDate = addDaysToYmd(row.assistance_date, 1);
  const endsAtNextMidnight = endLocal.ymd === nextAssistanceDate && endLocal.time === "00:00:00";
  const crossesMidnight = endLocal.ymd === nextAssistanceDate && endLocal.time > "00:00:00";

  if (endLocal.ymd !== row.assistance_date && !crossesMidnight && !endsAtNextMidnight) {
    return null;
  }

  return {
    id,
    staffId,
    receivingBranchId,
    assistanceDate: row.assistance_date,
    nextAssistanceDate,
    startMs,
    effectiveStartMs: startMs - STAGE_C_EARLY_ARRIVAL_MS,
    endMs,
    crossesMidnight,
  };
}

/** Returns permitted booking business dates for a validated Stage C assistance shift. */
export function getPermittedAssistanceDates(window: ParsedStageCAssistanceWindow): string[] {
  return window.crossesMidnight
    ? [window.assistanceDate, window.nextAssistanceDate]
    : [window.assistanceDate];
}

export function isStageCAssistanceDateAllowed(
  window: ParsedStageCAssistanceWindow,
  bookingDate: string
): boolean {
  if (!isValidCalendarYmd(bookingDate)) return false;
  if (bookingDate === window.assistanceDate) return true;
  return window.crossesMidnight && bookingDate === window.nextAssistanceDate;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isVerifiedDelayedServiceCompletion(
  notification: WorkspaceNotification,
  booking: BorrowedBookingAuthorityRow,
  window: ParsedStageCAssistanceWindow,
  nowMs: number
): boolean {
  if (notification.type !== "booking_status_changed") return false;
  if (!isPlainRecord(notification.metadata)) return false;
  if (notification.metadata.service_transition !== "completed") return false;

  const isBookingCompleted =
    booking.status === "completed" || booking.booking_progress_status === "completed";
  if (!isBookingCompleted) return false;

  const completedAtMs = parseTzIsoTimestamp(booking.session_completed_at);
  if (completedAtMs === null || completedAtMs > nowMs) return false;

  if (
    notification.metadata.service_transition_at !== undefined &&
    notification.metadata.service_transition_at !== null
  ) {
    const metadataTransitionMs = parseTzIsoTimestamp(notification.metadata.service_transition_at);
    if (metadataTransitionMs === null || Math.abs(metadataTransitionMs - completedAtMs) > 1000) {
      return false;
    }
  }

  if (booking.session_started_at !== undefined && booking.session_started_at !== null) {
    const startedAtMs = parseTzIsoTimestamp(booking.session_started_at);
    if (
      startedAtMs === null ||
      startedAtMs < window.effectiveStartMs ||
      startedAtMs > completedAtMs
    ) {
      return false;
    }
  }

  // Only allow post-expiration delivery when authoritative completion occurred within the shift.
  return completedAtMs >= window.effectiveStartMs && completedAtMs <= window.endMs;
}

/**
 * Authorizes cross-branch Stage C booking push notifications strictly from persisted
 * booking + assistance assignment evidence. Always fails closed.
 */
export function authorizeBorrowedStaffBookingPush(input: {
  notification: WorkspaceNotification;
  targetStaff: BorrowedStaffScope | undefined;
  booking: BorrowedBookingAuthorityRow | null | undefined;
  assistanceRows: readonly StageCAssistanceRowCandidate[] | null | undefined;
  nowMs: number;
}): string | undefined {
  const { notification, targetStaff, booking, assistanceRows, nowMs } = input;
  if (!Number.isFinite(nowMs)) return undefined;
  if (
    notification.target_workspace !== "staff" ||
    notification.entity_type !== "booking" ||
    !notification.recipient_staff_id ||
    !notification.branch_id ||
    !notification.entity_id
  ) {
    return undefined;
  }

  if (
    !targetStaff ||
    !targetStaff.is_active ||
    targetStaff.archived_at ||
    targetStaff.merged_into_staff_id ||
    !targetStaff.branch_id ||
    targetStaff.branch_id === notification.branch_id
  ) {
    return undefined;
  }

  if (
    !booking ||
    booking.id !== notification.entity_id ||
    booking.branch_id !== notification.branch_id ||
    booking.staff_id !== notification.recipient_staff_id ||
    !isValidCalendarYmd(booking.booking_date)
  ) {
    return undefined;
  }

  if (!Array.isArray(assistanceRows) || assistanceRows.length === 0) {
    return undefined;
  }

  const bookingDate = booking.booking_date;
  const authorized = assistanceRows.some((row) => {
    const window = parseStageCAssistanceWindow(row, {
      staffId: notification.recipient_staff_id!,
      receivingBranchId: notification.branch_id!,
      allowedStatuses: ["arrived_clocked_in"],
    });
    if (!window) return false;
    if (!isStageCAssistanceDateAllowed(window, bookingDate)) return false;

    const withinActiveWindow = nowMs >= window.effectiveStartMs && nowMs <= window.endMs;
    if (withinActiveWindow) return true;

    return isVerifiedDelayedServiceCompletion(notification, booking, window, nowMs);
  });

  return authorized ? notification.recipient_staff_id : undefined;
}
