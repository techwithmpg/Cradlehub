import type { AttendanceReviewItem } from "@/lib/attendance/crm-review";
import type { AttendanceStaffDiagnostic } from "@/lib/attendance/staff-diagnostics";
import type {
  AttendanceDeviceRegistryEntry,
  AttendanceException,
  AttendanceRecord,
} from "@/lib/attendance/types";

export type ReviewIssueBucket = "unclosed" | "duplicate_conflict" | "missing_scan" | "other";
export type ReviewSeverityRank = "critical" | "high" | "medium" | "low";

const ROLE_LABELS: Record<string, string> = {
  staff: "Therapist",
  therapist: "Therapist",
  nail_tech: "Nail Tech",
  aesthetician: "Aesthetician",
  receptionist: "Receptionist",
  front_desk: "Front Desk",
  csr: "CSR",
  managerial: "Managerial",
  manager: "Manager",
  driver: "Driver",
  utility: "Utility",
};

/**
 * Formats an internal staff_type / system_role identifier into a readable UI label.
 */
export function formatAttendanceRole(role: string | null | undefined): string {
  if (!role) return "Staff Member";
  const normalized = role.trim().toLowerCase();
  if (ROLE_LABELS[normalized]) return ROLE_LABELS[normalized];
  return normalized
    .replaceAll("_", " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/**
 * Formats an ISO timestamp as short clock time (e.g. "1:47 PM") in the branch timezone.
 */
export function formatShortClock(value: string | null | undefined, timezone: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

/**
 * Formats a YYYY-MM-DD shift date as "Nov 15, 2026".
 */
export function formatShortShiftDate(shiftDate: string): string {
  if (!shiftDate) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${shiftDate}T00:00:00Z`));
}

/**
 * Formats a duration in minutes as "8h 43m" (or "—" when not positive / open).
 */
export function formatWorkedDuration(minutes: number | null | undefined, fallback = "—"): string {
  if (minutes === null || minutes === undefined || minutes <= 0) return fallback;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

/**
 * Classifies a canonical AttendanceReviewItem into one of the four visual review buckets
 * while preserving exact underlying diagnostic context.
 */
export function classifyReviewIssueBucket(item: AttendanceReviewItem): ReviewIssueBucket {
  const code = `${item.diagnostic.code} ${item.exception.exception_type} ${item.exception.safe_error_code ?? ""}`.toLowerCase();
  if (
    code.includes("stale") ||
    code.includes("open") ||
    code.includes("unclosed") ||
    code.includes("clock_out_missing") ||
    code.includes("missed_clock_out") ||
    code.includes("forgot") ||
    code.includes("mismatch")
  ) {
    return "unclosed";
  }
  if (
    code.includes("duplicate") ||
    code.includes("conflict") ||
    code.includes("double") ||
    code.includes("overlap") ||
    code.includes("ambiguous")
  ) {
    return "duplicate_conflict";
  }
  if (
    code.includes("missing") ||
    code.includes("missed") ||
    code.includes("no_scan") ||
    code.includes("unscheduled") ||
    code.includes("absent") ||
    code.includes("late")
  ) {
    return "missing_scan";
  }
  return "other";
}

/**
 * Maps an exception + diagnostic severity onto Critical / High / Medium / Low UI tiers.
 */
export function resolveReviewSeverity(item: AttendanceReviewItem): ReviewSeverityRank {
  const sev = item.exception.severity?.toLowerCase();
  if (sev === "critical" || item.priority === "critical") return "critical";
  if (sev === "high" || item.priority === "high") return "high";
  if (sev === "low" || sev === "info") return "low";
  if (sev === "medium" || sev === "warning" || item.diagnostic.severity === "warning") return "medium";
  return "medium";
}

const ISO_TIMESTAMP_PATTERN =
  /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})\b/g;

/**
 * Replaces raw ISO 8601 timestamps inside freeform exception text with
 * readable branch-timezone date/time labels while preserving all other text.
 */
export function humanizeAttendanceText(
  text: string | null | undefined,
  timezone = "Asia/Manila"
): string {
  if (!text) return "";
  return text.replace(ISO_TIMESTAMP_PATTERN, (match) => {
    const parsed = new Date(match);
    if (Number.isNaN(parsed.getTime())) return match;
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(parsed);
  });
}

/**
 * Determines whether a review item has an authorized correction path
 * in the Attendance correction modal instead of being technical/acknowledge-only.
 */
export function hasAuthorizedCorrectionPath(
  item: AttendanceReviewItem,
  hasMatchedRecord = false
): boolean {
  if (item.diagnostic.resolutionKind !== "technical") return true;
  if (item.category !== "technical") return true;
  return Boolean(hasMatchedRecord || item.exception.checkin_id || item.exception.scan_event_id);
}

export function getReviewIssueHeadline(
  item: AttendanceReviewItem,
  timezone = "Asia/Manila"
): {
  title: string;
  description: string;
  shortTag: string;
} {
  const bucket = classifyReviewIssueBucket(item);
  const code = `${item.diagnostic.code} ${item.exception.exception_type}`.toLowerCase();
  const cleanSummary = humanizeAttendanceText(
    item.diagnostic.crmSummary || item.exception.message,
    timezone
  );

  if (code.includes("device") || code.includes("phone") || code.includes("browser")) {
    return {
      title: "Phone connection needed",
      description: cleanSummary || "Scanned from an untrusted or unlinked phone.",
      shortTag: "Phone Setup",
    };
  }
  if (code.includes("branch") || code.includes("location")) {
    return {
      title: "Branch check required",
      description: cleanSummary || "Staff member scanned outside their profile branch.",
      shortTag: "Wrong Branch",
    };
  }
  if (bucket === "unclosed") {
    return {
      title: code.includes("stale") || code.includes("previous")
        ? "Previous shift still open"
        : "Unclosed shift",
      description: cleanSummary || "Clock-in recorded, but no clock-out recorded yet.",
      shortTag: "Unclosed Shift",
    };
  }
  if (bucket === "duplicate_conflict") {
    return {
      title: code.includes("duplicate") ? "Duplicate scan" : "Schedule / scan conflict",
      description: cleanSummary || "Multiple or conflicting scan records need confirmation.",
      shortTag: "Conflict",
    };
  }
  if (bucket === "missing_scan") {
    if (code.includes("late")) {
      return {
        title: "Late clock-in",
        description: cleanSummary || "Arrived after scheduled grace period.",
        shortTag: "Late",
      };
    }
    return {
      title: code.includes("schedule") ? "Unscheduled scan" : "Missed expected scan",
      description: cleanSummary || "Expected attendance scan is missing or unscheduled.",
      shortTag: "Missing Scan",
    };
  }
  return {
    title: item.diagnostic.crmTitle.replace(/^[a-z]/, (c) => c.toUpperCase()),
    description: cleanSummary,
    shortTag: "Needs Review",
  };
}

/**
 * Returns the active shift window start/end ISO strings for a staff diagnostic row.
 */
export function getStaffShiftWindow(row: AttendanceStaffDiagnostic): {
  startAt: string | null;
  endAt: string | null;
} {
  const w = row.staff.currentShiftWindow ?? row.staff.nextShiftWindow ?? row.staff.shiftWindows[0];
  return {
    startAt: w?.scheduledStartAt ?? row.staff.scheduledStart ?? null,
    endAt: w?.scheduledEndAt ?? row.staff.scheduledEnd ?? null,
  };
}

export type ShiftProgressDetail = {
  percent: number;
  isBeyondSchedule: boolean;
  overtimeMinutes: number;
};

/**
 * Computes bounded shift progress details (visual bar capped at 100%, with separate overtime indicator).
 */
export function computeShiftProgressDetail(params: {
  clockInAt: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  nowMs: number;
}): ShiftProgressDetail | null {
  const { clockInAt, scheduledStartAt, scheduledEndAt, nowMs } = params;
  const startMs = scheduledStartAt ? new Date(scheduledStartAt).getTime() : clockInAt ? new Date(clockInAt).getTime() : NaN;
  const endMs = scheduledEndAt ? new Date(scheduledEndAt).getTime() : NaN;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return null;
  }
  const elapsedOrigin = clockInAt ? Math.max(startMs, new Date(clockInAt).getTime()) : startMs;
  const rawPct = Math.round(((nowMs - elapsedOrigin) / (endMs - elapsedOrigin)) * 100);
  const overtimeMinutes = nowMs > endMs ? Math.max(1, Math.round((nowMs - endMs) / 60_000)) : 0;
  return {
    percent: Math.max(4, Math.min(100, rawPct)),
    isBeyondSchedule: overtimeMinutes > 0,
    overtimeMinutes,
  };
}

/**
 * Computes bounded shift progress percentage [0, 100] from clockIn/schedule window.
 */
export function computeShiftProgressPercent(params: {
  clockInAt: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  nowMs: number;
}): number | null {
  return computeShiftProgressDetail(params)?.percent ?? null;
}

/**
 * Computes compact page buttons with ellipsis (e.g. [1, 2, 3, '...', 13]).
 */
export function buildPaginationRange(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: Array<number | "ellipsis"> = [1];
  const left = Math.max(2, currentPage - 1);
  const right = Math.min(totalPages - 1, currentPage + 1);
  if (left > 2) pages.push("ellipsis");
  for (let p = left; p <= right; p += 1) pages.push(p);
  if (right < totalPages - 1) pages.push("ellipsis");
  pages.push(totalPages);
  return pages;
}

function exceptionMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string
): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function resolveExceptionTargetCheckinId(exception: AttendanceException): string | null {
  const internalType = (
    exceptionMetadataString(exception.metadata, "internalExceptionType") ??
    exceptionMetadataString(exception.metadata, "internal_exception_type") ??
    exception.exception_type
  ).toLowerCase();
  if (internalType === "stale_open_checkin" || exception.exception_type === "missed_checkout") {
    return exceptionMetadataString(exception.metadata, "staleCheckinId") ?? exception.checkin_id ?? null;
  }
  return exception.checkin_id ?? null;
}

export function resolveExceptionBusinessDate(
  exception: AttendanceException,
  record: AttendanceRecord | null,
  timezone = "Asia/Manila"
): string {
  const staleDate =
    exceptionMetadataString(exception.metadata, "staleBusinessDate") ??
    exceptionMetadataString(exception.metadata, "staleShiftDate");
  if (staleDate) return staleDate;
  if (record?.shift_date) return record.shift_date;
  const iso = exception.last_detected_at ?? exception.detected_at;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/**
 * Finds the matching attendance record (preferring explicit target checkin_id / staleCheckinId,
 * never falling back to an unrelated active shift when an explicit checkin_id is missing from the slice)
 * for display inside the Review table and Correct Attendance modal.
 */
export function findExceptionRecord(
  exception: AttendanceException,
  records: AttendanceRecord[]
): AttendanceRecord | null {
  const targetCheckinId = resolveExceptionTargetCheckinId(exception);
  if (targetCheckinId) {
    return records.find((r) => r.id === targetCheckinId) ?? null;
  }
  if (exception.staff_id) {
    return (
      records.find((r) => r.staff_id === exception.staff_id && !r.checked_out_at) ??
      records.find((r) => r.staff_id === exception.staff_id) ??
      null
    );
  }
  return null;
}

/**
 * Formats platform + browser metadata concisely for the Staff Phones directory.
 */
export function formatDevicePlatformSummary(entry: AttendanceDeviceRegistryEntry): string {
  if (!entry.device) return "No phone connected";
  const platform = entry.device.platformName || "Phone";
  const browser = entry.device.browserName || "Browser";
  return `${platform} · ${browser}`;
}
