import type {
  AttendanceScanFeedWorkspace,
  RecentAttendanceScan,
} from "@/lib/attendance/types";

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

export function getAttendanceScanBadge(scan: RecentAttendanceScan): {
  label: string;
  tone: "good" | "warn" | "info";
} {
  if (scan.eventType === "clock_out") {
    return {
      label: formatWorkedMinutesBadge(scan.workedMinutes),
      tone: "info",
    };
  }

  if (scan.attendanceStatus === "late") {
    return { label: "Late", tone: "warn" };
  }

  return { label: "On duty", tone: "good" };
}
