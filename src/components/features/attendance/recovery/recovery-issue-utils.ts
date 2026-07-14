import type {
  AttendanceException,
  AttendanceRecord,
  AttendanceScanEvent,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";
import type {
  RecoveryIssue,
  RecoveryIssueCategory,
  RecoveryIssueCounts,
  RecoveryIssuePriority,
} from "@/components/features/attendance/recovery/recovery-issue-types";
import { getInternalAttendanceExceptionType } from "@/lib/attendance/exception-codes";

const DEVICE_EXCEPTION_TYPES = new Set([
  "unknown_device",
  "revoked_device",
  "device_not_registered",
  "missing_device",
  "browser_data_cleared",
  "device_cookie_missing",
]);

const SCAN_RECOVERY_TYPES = new Set([
  "likely_closing_scan_without_clock_in",
  "missing_schedule",
  "off_day_exception",
  "ambiguous_scan",
  "early_clock_in",
  "late_clock_in",
  "early_clock_out",
  "overtime_clock_out",
  "duplicate_scan",
  "stale_open_checkin",
  "conflicting_open_checkin",
]);

function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function priorityFromSeverity(severity: string | null | undefined): RecoveryIssuePriority {
  if (severity === "critical" || severity === "high") return "high";
  if (severity === "warning" || severity === "medium") return "medium";
  return "low";
}

function isBlockedDeviceScan(event: AttendanceScanEvent): boolean {
  const message = event.message?.toLowerCase() ?? "";
  const reasonCode = event.reason_code?.toLowerCase() ?? "";

  return (
    event.outcome === "blocked" ||
    event.outcome === "error" ||
    reasonCode.includes("device") ||
    message.includes("registered device") ||
    message.includes("device cookie")
  );
}

function categoryForException(exceptionType: string): RecoveryIssueCategory {
  if (DEVICE_EXCEPTION_TYPES.has(exceptionType)) return "device_access";
  if (SCAN_RECOVERY_TYPES.has(exceptionType)) return "scan_recovery";
  return "staff_day_repair";
}

function issueTitleForException(exception: AttendanceException): string {
  const exceptionType = getInternalAttendanceExceptionType(exception);
  if (exceptionType === "unknown_device") return "Unregistered device scan";
  if (exceptionType === "revoked_device") return "Revoked device scan";
  if (exceptionType === "browser_data_cleared") return "Browser data cleared";
  if (exceptionType === "likely_closing_scan_without_clock_in") {
    return "First scan near closing";
  }
  if (exceptionType === "stale_open_checkin") return "Stale open attendance row";
  if (exceptionType === "conflicting_open_checkin") return "Conflicting open attendance row";

  return titleCase(exceptionType);
}

function issueForException(
  exception: AttendanceException,
  branchName: string
): RecoveryIssue {
  const category = categoryForException(getInternalAttendanceExceptionType(exception));

  return {
    id: `exception-${exception.id}`,
    category,
    priority: priorityFromSeverity(exception.severity),
    source: "exception",
    title: issueTitleForException(exception),
    subtitle: exception.staff_name ?? "Unassigned device",
    description: exception.message,
    detectedAt: exception.detected_at,
    branchName,
    staffId: exception.staff_id,
    staffName: exception.staff_name,
    staffRole: null,
    deviceInfo: metadataText(exception.metadata, "device") ?? metadataText(exception.metadata, "platform"),
    scanCount: numberMetadata(exception.metadata, "scan_count"),
    recommendedAction:
      category === "device_access"
        ? "Create a device recovery link or open the device registry."
        : category === "scan_recovery"
          ? "Review the scan evidence and apply a safe attendance-state correction."
          : "Review the staff day and repair the attendance record if needed.",
    reasonBullets:
      category === "device_access"
        ? [
            "The phone is not connected to a trusted staff device.",
            "Browser data may have been cleared.",
            "The staff member may be using a new phone or browser.",
          ]
        : [
            "The scan could not be safely interpreted automatically.",
            "The system protected the attendance record from a wrong update.",
            "A CRM review is required before applying a correction.",
          ],
    exception,
    record: null,
    scanEvent: null,
  };
}

function issueForScanEvent(
  event: AttendanceScanEvent,
  branchName: string,
  scanCount: number
): RecoveryIssue {
  return {
    id: `scan-${event.id}`,
    category: "device_access",
    priority: "high",
    source: "scan_event",
    title: "Unregistered device scan",
    subtitle: event.point_label ?? `${branchName} Attendance QR`,
    description:
      event.message ??
      "This phone scanned the Attendance QR but no registered device cookie was found.",
    detectedAt: event.created_at,
    branchName,
    staffId: null,
    staffName: event.staff_name,
    staffRole: null,
    deviceInfo: event.reason_code ?? "No device cookie",
    scanCount,
    recommendedAction: "Generate a recovery link or open the Devices tab.",
    reasonBullets: [
      "The phone has no trusted device cookie.",
      "The device may never have been activated.",
      "The browser may have been reset or changed.",
    ],
    exception: null,
    record: null,
    scanEvent: event,
  };
}

function issueForRecord(record: AttendanceRecord, branchName: string): RecoveryIssue {
  const stillCheckedIn = record.status === "checked_in" && !record.checked_out_at;
  const title = stillCheckedIn
    ? "Forgot to clock out"
    : record.exception_state === "open"
      ? "Record has open exception"
      : titleCase(record.attendance_status);

  return {
    id: `record-${record.id}`,
    category: "staff_day_repair",
    priority: stillCheckedIn || record.exception_state === "open" ? "high" : "medium",
    source: "attendance_record",
    title,
    subtitle: record.staff_name,
    description: stillCheckedIn
      ? "Staff is still showing as active. Review before setting a manual clock-out."
      : "This attendance record needs review because timing or status is not normal.",
    detectedAt: record.checked_in_at,
    branchName,
    staffId: record.staff_id,
    staffName: record.staff_name,
    staffRole: record.staff_type,
    deviceInfo: record.source_label ?? record.clock_in_method,
    scanCount: null,
    recommendedAction: stillCheckedIn
      ? "Set a manual clock-out or reset the staff day after checking raw scans."
      : "Open staff records and review the correction details.",
    reasonBullets: [
      "The record is not a clean present/completed attendance day.",
      "Corrections should be audited with a reason.",
      "Raw scans should remain unchanged.",
    ],
    exception: null,
    record,
    scanEvent: null,
  };
}

function issueForSystemRule(
  title: string,
  description: string,
  priority: RecoveryIssuePriority,
  branchName: string
): RecoveryIssue {
  return {
    id: `rule-${title.toLowerCase().replaceAll(" ", "-")}`,
    category: "rules_safety",
    priority,
    source: "system_rule",
    title,
    subtitle: "System",
    description,
    detectedAt: new Date().toISOString(),
    branchName,
    staffId: null,
    staffName: null,
    staffRole: null,
    deviceInfo: null,
    scanCount: null,
    recommendedAction: "Open Rules & Safety and review the current attendance mode.",
    reasonBullets: [
      "System safety settings affect scan interpretation.",
      "Rule changes should be reviewed before live operations.",
      "All changes must be audited with a reason.",
    ],
    exception: null,
    record: null,
    scanEvent: null,
  };
}

function metadataText(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

function numberMetadata(metadata: Record<string, unknown>, key: string): number | null {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildRecoveryIssues(data: AttendanceWorkspaceData): RecoveryIssue[] {
  const branchName = data.branchName;

  const blockedScans = data.scanEvents.filter(isBlockedDeviceScan);
  const scanGroups = new Map<string, AttendanceScanEvent[]>();
  for (const event of blockedScans) {
    const key = `${event.staff_name ?? "unknown"}|${event.point_label ?? "unknown"}|${event.reason_code ?? "device"}`;
    scanGroups.set(key, [...(scanGroups.get(key) ?? []), event]);
  }
  const scanDeviceIssues = [...scanGroups.values()].map((events) =>
    issueForScanEvent(events[0]!, branchName, events.length)
  );

  const exceptionIssues = data.exceptions
    .filter((exception) => exception.status === "open")
    .map((exception) => issueForException(exception, branchName));

  const recordIssues = data.records
    .filter((record) => {
      return (
        record.status === "checked_in" ||
        record.exception_state === "open" ||
        record.attendance_status !== "present"
      );
    })
    .map((record) => issueForRecord(record, branchName));

  const systemIssues: RecoveryIssue[] = [];

  if (data.settings.test_mode_enabled) {
    systemIssues.push(
      issueForSystemRule(
        "Test mode enabled",
        "Training mode is active. Confirm whether this branch should still be excluding test scans from live reporting.",
        "low",
        branchName
      )
    );
  }

  if (data.settings.launch_recovery_enabled) {
    systemIssues.push(
      issueForSystemRule(
        "Launch recovery enabled",
        "Launch recovery is active for this branch. Confirm the date range before live use.",
        "medium",
        branchName
      )
    );
  }

  return [
    ...scanDeviceIssues,
    ...exceptionIssues,
    ...recordIssues,
    ...systemIssues,
  ].sort((first, second) => {
    const priorityWeight = { high: 0, medium: 1, low: 2 };
    const priorityDelta = priorityWeight[first.priority] - priorityWeight[second.priority];
    if (priorityDelta !== 0) return priorityDelta;
    return new Date(second.detectedAt).getTime() - new Date(first.detectedAt).getTime();
  });
}

export function countRecoveryIssues(issues: RecoveryIssue[]): RecoveryIssueCounts {
  return {
    all: issues.length,
    deviceAccess: issues.filter((issue) => issue.category === "device_access").length,
    scanRecovery: issues.filter((issue) => issue.category === "scan_recovery").length,
    staffDayRepair: issues.filter((issue) => issue.category === "staff_day_repair").length,
    rulesSafety: issues.filter((issue) => issue.category === "rules_safety").length,
  };
}
