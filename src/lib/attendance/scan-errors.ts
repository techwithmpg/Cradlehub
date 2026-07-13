import type { PublicScanResult } from "@/lib/attendance/types";

export type AttendanceSafeErrorCode =
  | "ATTENDANCE_RPC_MISSING"
  | "ATTENDANCE_RPC_SIGNATURE_MISMATCH"
  | "ATTENDANCE_RPC_REJECTED"
  | "ATTENDANCE_TRANSACTION_FAILED"
  | "ATTENDANCE_CONSTRAINT_FAILED"
  | "ATTENDANCE_RLS_DENIED"
  | "SCHEDULE_SCHEMA_MISMATCH"
  | "SCHEDULE_QUERY_FAILED"
  | "SCHEDULE_STATE_UNSUPPORTED"
  | "DEVICE_NOT_REGISTERED"
  | "DEVICE_REVOKED"
  | "DEVICE_LINK_INVALID"
  | "STAFF_NOT_OPERATIONAL"
  | "BRANCH_MISMATCH"
  | "NO_SCHEDULE_CONFIGURED"
  | "OFF_DAY_SCAN"
  | "NO_RELEVANT_SHIFT_WINDOW"
  | "SHIFT_INSTANCE_CONFLICT"
  | "DUPLICATE_SCAN"
  | "ATTENDANCE_WRITE_FAILED"
  | "UNKNOWN_ATTENDANCE_ERROR";

export type AttendanceErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const PUBLIC_MESSAGES: Record<AttendanceSafeErrorCode, { title: string; message: string; status: number }> = {
  ATTENDANCE_RPC_MISSING: {
    title: "Attendance service unavailable",
    message: "Attendance cannot be confirmed because the scan transaction is not installed.",
    status: 503,
  },
  ATTENDANCE_RPC_SIGNATURE_MISMATCH: {
    title: "Attendance service unavailable",
    message: "Attendance cannot be confirmed because the scan transaction contract is out of date.",
    status: 503,
  },
  ATTENDANCE_RPC_REJECTED: {
    title: "Attendance not confirmed",
    message: "Attendance was not changed because the transaction rejected this scan.",
    status: 409,
  },
  ATTENDANCE_TRANSACTION_FAILED: {
    title: "Attendance not confirmed",
    message: "Attendance could not be safely updated. Please ask the front desk to review this scan.",
    status: 500,
  },
  ATTENDANCE_CONSTRAINT_FAILED: {
    title: "Attendance not confirmed",
    message: "Attendance was not changed because it did not match the database attendance rules.",
    status: 409,
  },
  ATTENDANCE_RLS_DENIED: {
    title: "Attendance not confirmed",
    message: "Attendance was denied by database permissions.",
    status: 403,
  },
  SCHEDULE_SCHEMA_MISMATCH: {
    title: "Schedule contract mismatch",
    message: "Attendance could not read the required schedule columns for this scan.",
    status: 503,
  },
  SCHEDULE_QUERY_FAILED: {
    title: "Schedule unavailable",
    message: "Attendance could not confirm the staff schedule for this scan.",
    status: 500,
  },
  SCHEDULE_STATE_UNSUPPORTED: {
    title: "Schedule needs review",
    message: "Attendance could not safely interpret this schedule state.",
    status: 409,
  },
  DEVICE_NOT_REGISTERED: {
    title: "Device not registered",
    message: "This phone is not connected to a staff device record.",
    status: 403,
  },
  DEVICE_REVOKED: {
    title: "Device blocked",
    message: "This phone is no longer active for attendance scans.",
    status: 403,
  },
  DEVICE_LINK_INVALID: {
    title: "Device link invalid",
    message: "This device link could not be verified.",
    status: 403,
  },
  STAFF_NOT_OPERATIONAL: {
    title: "Staff unavailable",
    message: "This staff member is not operational for attendance scans.",
    status: 409,
  },
  BRANCH_MISMATCH: {
    title: "Wrong branch",
    message: "This scan does not match the staff member's branch.",
    status: 409,
  },
  NO_SCHEDULE_CONFIGURED: {
    title: "Schedule missing",
    message: "No individual schedule is configured for this staff member.",
    status: 409,
  },
  OFF_DAY_SCAN: {
    title: "Off-day scan",
    message: "This staff member is configured as off for this schedule day.",
    status: 409,
  },
  NO_RELEVANT_SHIFT_WINDOW: {
    title: "Scan needs review",
    message: "No relevant scheduled shift window matched this scan.",
    status: 409,
  },
  SHIFT_INSTANCE_CONFLICT: {
    title: "Attendance already exists",
    message: "Attendance was not changed because this shift instance already has a record.",
    status: 409,
  },
  DUPLICATE_SCAN: {
    title: "Duplicate scan",
    message: "A recent attendance scan was already recorded.",
    status: 409,
  },
  ATTENDANCE_WRITE_FAILED: {
    title: "Attendance not confirmed",
    message: "Attendance could not write the audit or Recovery record for this scan.",
    status: 500,
  },
  UNKNOWN_ATTENDANCE_ERROR: {
    title: "Scan interrupted",
    message: "Something interrupted the scan. Please ask the front desk to review this attempt.",
    status: 500,
  },
};

export class AttendanceScanError extends Error {
  readonly code: AttendanceSafeErrorCode;
  readonly status: number;
  readonly operationId?: string;
  readonly dbCode?: string | null;
  readonly details?: Record<string, unknown>;
  readonly cause?: unknown;

  constructor(
    code: AttendanceSafeErrorCode,
    message: string,
    options: {
      status?: number;
      operationId?: string | null;
      dbCode?: string | null;
      details?: Record<string, unknown>;
      cause?: unknown;
    } = {}
  ) {
    super(message);
    this.name = "AttendanceScanError";
    this.code = code;
    this.status = options.status ?? PUBLIC_MESSAGES[code].status;
    this.operationId = options.operationId ?? undefined;
    this.dbCode = options.dbCode;
    this.details = options.details;
    this.cause = options.cause;
  }
}

function errorText(error: AttendanceErrorLike): string {
  return [error.message, error.details, error.hint]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ")
    .toLowerCase();
}

export function createAttendanceOperationId(prefix = "attendance-scan"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeAttendanceOperationId(
  candidate: string | null | undefined,
  prefix = "attendance-scan"
): string {
  const trimmed = candidate?.trim();
  if (trimmed && trimmed.length <= 160) return trimmed;
  return createAttendanceOperationId(prefix);
}

export function isAttendanceScanError(error: unknown): error is AttendanceScanError {
  return error instanceof AttendanceScanError;
}

export function createAttendanceScanError(
  code: AttendanceSafeErrorCode,
  message?: string,
  options: ConstructorParameters<typeof AttendanceScanError>[2] = {}
): AttendanceScanError {
  return new AttendanceScanError(code, message ?? PUBLIC_MESSAGES[code].message, options);
}

export function classifyAttendanceDbError(
  error: AttendanceErrorLike,
  fallback: AttendanceSafeErrorCode = "ATTENDANCE_TRANSACTION_FAILED"
): AttendanceSafeErrorCode {
  const dbCode = error.code ?? undefined;
  const text = errorText(error);

  if (dbCode === "PGRST202") return "ATTENDANCE_RPC_SIGNATURE_MISMATCH";
  if (dbCode === "42883" || text.includes("does not exist")) return "ATTENDANCE_RPC_MISSING";
  if (dbCode === "42501" || text.includes("row-level security") || text.includes("permission denied")) {
    return "ATTENDANCE_RLS_DENIED";
  }
  if (dbCode === "23514" || text.includes("violates check constraint")) {
    return "ATTENDANCE_CONSTRAINT_FAILED";
  }
  if (dbCode === "23505" || text.includes("duplicate key")) {
    return "SHIFT_INSTANCE_CONFLICT";
  }
  if (text.includes("could not find") && text.includes("schema cache")) {
    return "SCHEDULE_SCHEMA_MISMATCH";
  }

  return fallback;
}

export function attendanceScanFailureFromError(params: {
  error: unknown;
  operationId?: string | null;
  fallbackCode?: AttendanceSafeErrorCode;
  title?: string;
}): { result: PublicScanResult; status: number; code: AttendanceSafeErrorCode } {
  const operationId = normalizeAttendanceOperationId(params.operationId);
  const classified = isAttendanceScanError(params.error)
    ? params.error
    : createAttendanceScanError(
        params.fallbackCode ?? "UNKNOWN_ATTENDANCE_ERROR",
        params.error instanceof Error ? params.error.message : undefined,
        { operationId, cause: params.error }
      );
  const code = classified.code;
  const publicText = PUBLIC_MESSAGES[code];

  return {
    code,
    status: classified.status,
    result: {
      ok: false,
      outcome: "error",
      reasonCode: code,
      severity: "critical",
      title: params.title ?? publicText.title,
      message: publicText.message,
      detail: `Operation ID: ${classified.operationId ?? operationId}`,
      securityNote: "No attendance change was confirmed from this attempt.",
      operationId: classified.operationId ?? operationId,
      recoverable: code !== "DEVICE_REVOKED" && code !== "ATTENDANCE_RLS_DENIED",
    },
  };
}

export function logAttendanceScanError(params: {
  scope: string;
  operationId?: string | null;
  error: unknown;
  context?: Record<string, unknown>;
}) {
  const operationId = params.operationId ?? (isAttendanceScanError(params.error) ? params.error.operationId : null);
  const error = params.error as AttendanceErrorLike & { stack?: string; cause?: unknown };
  console.error(`[${params.scope}] attendance scan failed`, {
    operationId,
    safeCode: isAttendanceScanError(params.error) ? params.error.code : "UNKNOWN_ATTENDANCE_ERROR",
    dbCode: isAttendanceScanError(params.error) ? params.error.dbCode ?? null : error.code ?? null,
    message: error.message ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
    context: params.context ?? {},
    stack: error.stack ?? null,
    at: new Date().toISOString(),
  });
}
