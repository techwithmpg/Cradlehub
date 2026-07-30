import { rootAttendanceOperationId } from "@/lib/attendance/recent-scan-grouping";
import type { PublicScanResult, RecentAttendanceScan } from "@/lib/attendance/types";
import type { Database } from "@/types/supabase";

type QrScanEventRow = Database["public"]["Tables"]["qr_scan_events"]["Row"];

export type AttendanceRealtimeScanRow = Pick<
  QrScanEventRow,
  | "id"
  | "branch_id"
  | "staff_id"
  | "action"
  | "outcome"
  | "reason_code"
  | "message"
  | "request_id"
  | "operation_id"
  | "operation_result"
  | "operation_result_recorded_at"
  | "created_at"
  | "scan_type"
  | "is_test"
>;

export type CompleteAttendanceRealtimeScanRow = Omit<
  AttendanceRealtimeScanRow,
  "operation_result"
> & {
  operation_result: PublicScanResult;
};

type ScanEventMapContext = {
  branchId?: string | null;
  branchName?: string | null;
  timezone: string;
};

export function isStoredPublicScanResult(value: unknown): value is PublicScanResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<PublicScanResult>;
  return (
    typeof record.ok === "boolean" &&
    ["success", "blocked", "noop", "exception", "error"].includes(String(record.outcome)) &&
    typeof record.title === "string" &&
    typeof record.message === "string"
  );
}

/**
 * A scan can update the feed without another request when the transaction has
 * recorded its public result and that result contains the identity needed by
 * the CRM UI. Staff-less security blocks are complete by design.
 */
export function isCompleteAttendanceScanPayload(
  value: unknown
): value is CompleteAttendanceRealtimeScanRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Partial<AttendanceRealtimeScanRow>;
  if (
    typeof row.id !== "string" ||
    typeof row.created_at !== "string" ||
    row.scan_type !== "attendance" ||
    row.is_test !== false ||
    typeof row.operation_result_recorded_at !== "string" ||
    !isStoredPublicScanResult(row.operation_result)
  ) {
    return false;
  }

  if (!row.staff_id) return true;
  return Boolean(
    row.operation_result.attendance?.staffName?.trim() ||
      row.operation_result.branchCorrection?.staffName?.trim()
  );
}

export function mapStoredAttendanceScan(
  row: AttendanceRealtimeScanRow,
  context: ScanEventMapContext
): RecentAttendanceScan | null {
  if (!isCompleteAttendanceScanPayload(row)) return null;
  const result = row.operation_result;
  const attendance = result.attendance;
  const branchCorrection = result.branchCorrection;
  const operationId = result.operationId ?? row.operation_id ?? row.request_id ?? null;
  const staffName =
    attendance?.staffName?.trim() ||
    branchCorrection?.staffName?.trim() ||
    (row.staff_id ? "Staff member" : "Unknown device");
  const occurredAt = attendance?.occurredAt ?? row.created_at;
  const eventType = attendance?.action ?? row.action;

  return {
    eventId: row.id,
    staffId: row.staff_id,
    staffName,
    staffNickname: null,
    staffAvatarUrl: null,
    branchId: row.branch_id ?? context.branchId ?? null,
    branchName:
      attendance?.branchName ??
      branchCorrection?.requestedBranchName ??
      context.branchName ??
      null,
    eventType,
    outcome: result.outcome,
    reasonCode: result.reasonCode ?? row.reason_code,
    message: result.message || row.message,
    occurredAt,
    timezone: attendance?.branchTimezone ?? context.timezone,
    shiftType: attendance?.shiftLabel ?? null,
    attendanceStatus:
      attendance?.action === "clock_in" && result.outcome === "success" ? "on_time" : null,
    workedMinutes:
      typeof attendance?.workedMinutes === "number" ? attendance.workedMinutes : null,
    clockInAt: attendance?.sessionStartedAt ?? null,
    clockOutAt: attendance?.action === "clock_out" ? attendance.occurredAt : null,
    sourceLabel: null,
    operationId,
    rootOperationId: rootAttendanceOperationId(operationId, row.request_id, row.id),
  };
}
