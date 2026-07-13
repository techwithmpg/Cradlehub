export const ATTENDANCE_DB_EXCEPTION_TYPES = [
  "late",
  "early_leave",
  "overtime",
  "missed_checkout",
  "wrong_branch",
  "unscheduled",
  "duplicate_scan",
  "active_service",
  "unknown_device",
  "revoked_device",
  "resource_conflict",
  "manual",
] as const;

export type AttendanceDbExceptionType = (typeof ATTENDANCE_DB_EXCEPTION_TYPES)[number];

const DB_EXCEPTION_TYPE_SET = new Set<string>(ATTENDANCE_DB_EXCEPTION_TYPES);

export function toAttendanceDbExceptionType(value: string | null | undefined): AttendanceDbExceptionType {
  if (value && DB_EXCEPTION_TYPE_SET.has(value)) {
    return value as AttendanceDbExceptionType;
  }

  switch (value) {
    case "late_clock_in":
      return "late";
    case "early_clock_out":
      return "early_leave";
    case "overtime_clock_out":
      return "overtime";
    case "missing_schedule":
    case "off_day_exception":
      return "unscheduled";
    case "duplicate_scan":
      return "duplicate_scan";
    case "likely_closing_scan_without_clock_in":
    case "stale_open_checkin":
      return "missed_checkout";
    case "active_service":
      return "active_service";
    case "unknown_device":
    case "device_not_registered":
    case "missing_device":
      return "unknown_device";
    case "revoked_device":
      return "revoked_device";
    case "wrong_branch":
      return "wrong_branch";
    case "resource_conflict":
      return "resource_conflict";
    case "early_clock_in":
    case "ambiguous_scan":
    case "conflicting_open_checkin":
    default:
      return "manual";
  }
}

export function attendanceExceptionMetadata(params: {
  internalType: string;
  metadata?: Record<string, unknown>;
}): Record<string, unknown> {
  const dbType = toAttendanceDbExceptionType(params.internalType);
  return {
    ...(params.metadata ?? {}),
    internalExceptionType: params.internalType,
    dbExceptionType: dbType,
  };
}

export function getInternalAttendanceExceptionType(exception: {
  exception_type: string;
  metadata?: Record<string, unknown> | null;
}): string {
  const metadataType = exception.metadata?.internalExceptionType;
  return typeof metadataType === "string" && metadataType.trim()
    ? metadataType
    : exception.exception_type;
}
