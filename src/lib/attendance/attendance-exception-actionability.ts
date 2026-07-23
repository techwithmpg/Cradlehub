import type { AttendanceException, AttendanceRecord } from "@/lib/attendance/types";

const TIMING_ONLY_EXCEPTION_TYPES = [
  "late",
  "early_leave",
  "early_clock",
  "overtime",
  "late_clock",
];

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function effectiveAttendanceExceptionType(exception: AttendanceException): string {
  return (
    metadataString(exception.metadata, "internalExceptionType") ??
    metadataString(exception.metadata, "internal_exception_type") ??
    exception.exception_type
  );
}

export function isTimingOnlyAttendanceException(exception: AttendanceException): boolean {
  const type = effectiveAttendanceExceptionType(exception).toLowerCase();
  return TIMING_ONLY_EXCEPTION_TYPES.some((value) => type.includes(value));
}

export function isActionableAttendanceException(exception: AttendanceException): boolean {
  return exception.status === "open" && !isTimingOnlyAttendanceException(exception);
}

export function filterAttendanceExceptionsForBusinessDay(params: {
  exceptions: AttendanceException[];
  records: AttendanceRecord[];
  scanEventIds: Iterable<string>;
  branchId: string;
  businessDate: string;
  businessDayStart: string;
  businessDayEnd: string;
}): AttendanceException[] {
  const recordIds = new Set(
    params.records
      .filter(
        (record) =>
          record.branch_id === params.branchId && record.shift_date === params.businessDate
      )
      .map((record) => record.id)
  );
  const scanEventIds = new Set(params.scanEventIds);
  const startMs = new Date(params.businessDayStart).getTime();
  const endMs = new Date(params.businessDayEnd).getTime();

  return params.exceptions.filter((exception) => {
    if (exception.branch_id !== params.branchId) return false;
    if (exception.checkin_id) return recordIds.has(exception.checkin_id);
    if (exception.scan_event_id) return scanEventIds.has(exception.scan_event_id);
    const detectedAtMs = new Date(exception.detected_at).getTime();
    return detectedAtMs >= startMs && detectedAtMs < endMs;
  });
}
