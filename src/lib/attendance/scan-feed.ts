import type {
  AttendanceScanFeedWorkspace,
  RecentAttendanceScan,
} from "@/lib/attendance/types";

const MAX_COMPLETED_SHIFT_MINUTES = 16 * 60;
const CLOCK_DIFF_TOLERANCE_MINUTES = 2;

type ScanHrefInput = {
  workspace: AttendanceScanFeedWorkspace;
  staffId?: string | null;
  selectedDate: string;
  branchId?: string | null;
};

export function buildAttendanceRecordHref({
  workspace,
  staffId,
  selectedDate,
  branchId,
}: ScanHrefInput): string {
  const params = new URLSearchParams({ tab: "records", date: selectedDate });
  if (staffId) params.set("staffId", staffId);
  if (workspace === "owner" && branchId) params.set("branchId", branchId);

  return `${workspace === "owner" ? "/owner/attendance" : "/crm/attendance"}?${params.toString()}`;
}

export function buildAttendanceViewAllHref({
  workspace,
  selectedDate,
  branchId,
}: Omit<ScanHrefInput, "staffId">): string {
  return buildAttendanceRecordHref({
    workspace,
    selectedDate,
    branchId,
  });
}

export function getAttendanceScanInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "CH";
}

export function getAttendanceScanEventLabel(scan: RecentAttendanceScan): string {
  return scan.eventType === "clock_out" ? "Clocked out" : "Clocked in";
}

export function formatAttendanceScanTime(value: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function manilaDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const valueFor = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${valueFor("year")}-${valueFor("month")}-${valueFor("day")}`;
}

export function formatAttendanceFeedDateLabel(value: string): string {
  if (value === manilaDateString()) return "Today";

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatWorkedMinutesBadge(minutes: number | null): string {
  if (!minutes || minutes <= 0) return "Clocked out";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours <= 0) return `${remainingMinutes}m`;
  return `${hours}h ${String(remainingMinutes).padStart(2, "0")}m`;
}

export function formatShiftTypeLabel(value: string | null): string {
  if (!value) return "Shift";
  const label = value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
  return label.endsWith(" shift") ? label : `${label} shift`;
}

function timestampMs(value: string | null): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function attendanceCompletedDurationNeedsReview(
  scan: Pick<
    RecentAttendanceScan,
    "eventType" | "workedMinutes" | "clockInAt" | "clockOutAt"
  >
): boolean {
  if (scan.eventType !== "clock_out") return false;

  if (scan.workedMinutes !== null) {
    if (!Number.isFinite(scan.workedMinutes)) return true;
    if (scan.workedMinutes < 0) return true;
    if (scan.workedMinutes > MAX_COMPLETED_SHIFT_MINUTES) return true;
  }

  const clockInMs = timestampMs(scan.clockInAt);
  const clockOutMs = timestampMs(scan.clockOutAt);
  if (clockInMs === null || clockOutMs === null) return false;
  if (clockOutMs < clockInMs) return true;

  if (scan.workedMinutes === null) return false;
  const clockDurationMinutes = Math.round((clockOutMs - clockInMs) / 60000);
  return (
    Math.abs(clockDurationMinutes - scan.workedMinutes) >
    CLOCK_DIFF_TOLERANCE_MINUTES
  );
}

export function getAttendanceScanDurationDetail(
  scan: RecentAttendanceScan
): string | null {
  if (scan.eventType !== "clock_out") return null;
  if (attendanceCompletedDurationNeedsReview(scan)) return null;
  if (scan.workedMinutes === null || scan.workedMinutes <= 0) return null;
  return formatWorkedMinutesBadge(scan.workedMinutes);
}

export function getAttendanceScanBadge(scan: RecentAttendanceScan): {
  label: string;
  tone: "good" | "warn" | "info";
} {
  if (scan.eventType === "clock_out") {
    if (attendanceCompletedDurationNeedsReview(scan)) {
      return { label: "Needs review", tone: "warn" };
    }

    return { label: "Completed", tone: "good" };
  }

  if (scan.attendanceStatus === "late") {
    return { label: "Late", tone: "warn" };
  }

  return { label: "On duty", tone: "good" };
}
