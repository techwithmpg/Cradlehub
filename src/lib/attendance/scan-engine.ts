import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { asAttendanceDb, type AttendanceDb } from "@/lib/attendance/db";
import { inferDeviceClientHints } from "@/lib/attendance/device-display";
import { getAttendanceSettings } from "@/lib/attendance/queries";
import { getAttendanceDeviceBranchDecision } from "@/lib/attendance/branch-validation";
import { createDeviceCredential, hashSecret, maskId } from "@/lib/attendance/tokens";
import {
  ACTIVE_ATTENDANCE_DEVICE_LIMIT,
  nextAttendanceDeviceRole,
} from "@/lib/attendance/device-policy";
import { isOperationalStaff } from "@/lib/staff/operational-staff";
import { reconcileFirstScanDeviceRegistration } from "@/lib/attendance/device-registration";
import {
  computeAttendanceMetrics,
  formatMinutesCompact,
} from "@/lib/attendance/time";
import {
  buildAttendanceShiftInstance,
  getAttendanceBranchNow,
} from "@/lib/attendance/shift-instance";
import {
  attendanceReviewLabel,
  buildAttendanceGreeting,
} from "@/lib/attendance/greetings";
import {
  attendanceExceptionMetadata,
  toAttendanceDbExceptionType,
} from "@/lib/attendance/exception-codes";
import {
  classifyAttendanceDbError,
  createAttendanceDataError,
  createAttendanceScanError,
  normalizeAttendanceOperationId,
  type AttendanceSafeErrorCode,
  type AttendanceErrorLike,
} from "@/lib/attendance/scan-errors";
import { getResolvedStaffSchedulesForDate } from "@/lib/queries/resolved-staff-schedules";
import type { ResolvedStaffSchedule } from "@/lib/schedule/resolve-staff-schedule";
import {
  classifyOpenAttendanceCheckins,
  resolveAttendanceScanIntent,
  resolveStaffAttendanceSchedule,
  type AttendanceScheduleSelection,
  type AttendanceScanIntent,
  type OpenAttendanceIntentCheckin,
} from "@/lib/attendance/attendance-intent-engine";
import type { PublicScanResult, QrScanOutcome, QrScanType } from "@/lib/attendance/types";
import type { Database, Json } from "@/types/supabase";
import {
  markNotificationResolved,
  resolveWorkflowTask,
} from "@/lib/notifications/workflow-signals";
import { recalculateAttendanceClockOutPolicy } from "@/lib/attendance/dynamic-clock-out";

export type ScanRequestContext = {
  requestId?: string | null;
  rawDeviceCredential?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
};

export type ActivationResult = PublicScanResult & {
  rawDeviceCredential?: string;
};

export type FirstScanDeviceRegistrationResult =
  | {
      ok: true;
      rawDeviceCredential: string;
      deviceId: string;
      staffId: string;
      branchId: string;
      staffName: string;
      branchName: string;
      scanEventId?: string;
      registeredNewDevice: boolean;
    }
  | {
      ok: false;
      result: PublicScanResult;
    };

type StaffDeviceRow = {
  id: string;
  staff_id: string;
  branch_id: string;
  status: "active" | "revoked" | "expired" | "lost" | "stolen" | "security_blocked";
  staff?: {
    branch_id: string | null;
    full_name: string | null;
    nickname: string | null;
    staff_type: string | null;
    system_role: string | null;
    is_cross_branch: boolean;
    is_active: boolean;
    archived_at: string | null;
    merged_into_staff_id: string | null;
    metadata: Record<string, unknown> | null;
    branches?: { name: string | null } | Array<{ name: string | null }> | null;
  } | Array<{
    branch_id: string | null;
    full_name: string | null;
    nickname: string | null;
    staff_type: string | null;
    system_role: string | null;
    is_cross_branch: boolean;
    is_active: boolean;
    archived_at: string | null;
    merged_into_staff_id: string | null;
    metadata: Record<string, unknown> | null;
    branches?: { name: string | null } | Array<{ name: string | null }> | null;
  }> | null;
};

type AuthenticatedStaffRow = {
  id: string;
  branch_id: string;
  full_name: string | null;
  nickname: string | null;
  staff_type: string | null;
  system_role: string | null;
  is_active: boolean;
  archived_at: string | null;
  merged_into_staff_id: string | null;
  metadata: Record<string, unknown> | null;
  branches?: { name: string | null } | Array<{ name: string | null }> | null;
};

type QrPointRow = {
  id: string;
  branch_id: string;
  public_code: string;
  point_type: "attendance" | "room" | "resource";
  resource_id: string | null;
  label: string;
  is_active: boolean;
  requires_registered_device: boolean;
  scan_behavior: string;
  branch_resources?: { name: string | null; type: string | null } | Array<{ name: string | null; type: string | null }> | null;
  branches?: { name: string | null } | Array<{ name: string | null }> | null;
};

type CheckinRow = {
  id: string;
  staff_id: string;
  branch_id: string;
  shift_date: string;
  shift_type: string;
  shift_instance_key?: string | null;
  checked_in_at: string;
  checked_out_at: string | null;
  status: string;
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
  schedule_source?: string | null;
  schedule_source_id?: string | null;
  branch_timezone?: string | null;
  attendance_business_date?: string | null;
  attendance_expected_end_at?: string | null;
  earliest_normal_clock_out_at?: string | null;
  latest_normal_clock_out_at?: string | null;
  attendance_policy_source?:
    | "schedule"
    | "crm_closing"
    | "service_completion"
    | "home_service"
    | "driver_trip"
    | null;
  attendance_policy_snapshot?: Record<string, unknown> | null;
  provisional_auto_closed_at?: string | null;
  clock_out_confirmation_required?: boolean;
  is_test?: boolean;
};

type BookingRow = {
  id: string;
  branch_id: string;
  staff_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  booking_progress_status: string;
  resource_id: string | null;
  session_started_at: string | null;
  session_due_at?: string | null;
  session_completed_at?: string | null;
  session_duration_minutes_snapshot?: number | null;
  customers?: { full_name: string | null } | Array<{ full_name: string | null }> | null;
  services?: { name: string | null; duration_minutes: number | null } | Array<{ name: string | null; duration_minutes: number | null }> | null;
  branch_resources?: { name: string | null } | Array<{ name: string | null }> | null;
};

type ScheduleSelection = AttendanceScheduleSelection & {
  resolvedSchedule: ResolvedStaffSchedule;
};

type EventInput = {
  branchId?: string | null;
  qrPointId?: string | null;
  staffId?: string | null;
  deviceId?: string | null;
  checkinId?: string | null;
  bookingId?: string | null;
  resourceId?: string | null;
  scanType: QrScanType;
  action: string;
  outcome: QrScanOutcome;
  reasonCode?: string | null;
  message?: string | null;
  requestId?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
  isTest?: boolean;
};

type StaffShiftCheckinInsertPayload = Partial<
  Pick<
    Database["public"]["Tables"]["staff_shift_checkins"]["Insert"],
    | "shift_date"
    | "shift_type"
    | "shift_instance_key"
    | "checked_in_at"
    | "status"
    | "clock_in_method"
    | "scheduled_start_at"
    | "scheduled_end_at"
    | "schedule_source"
    | "schedule_source_id"
    | "branch_timezone"
    | "attendance_business_date"
    | "late_minutes"
    | "attendance_status"
    | "exception_state"
    | "is_test"
  >
> & {
  shift_date: string;
};

type StaffShiftCheckinUpdatePayload = Partial<
  Pick<
    Database["public"]["Tables"]["staff_shift_checkins"]["Update"],
    | "shift_instance_key"
    | "schedule_source"
    | "schedule_source_id"
    | "branch_timezone"
    | "attendance_business_date"
    | "checked_out_at"
    | "status"
    | "clock_out_method"
    | "worked_minutes"
    | "late_minutes"
    | "early_leave_minutes"
    | "overtime_minutes"
    | "attendance_status"
    | "exception_state"
    | "notes"
  >
>;

type AttendanceScanCommitInput = {
  event: EventInput;
  result: PublicScanResult;
  checkinId?: string | null;
  checkinInsert?: StaffShiftCheckinInsertPayload | null;
  checkinUpdate?: StaffShiftCheckinUpdatePayload | null;
  exception?: {
    exceptionType: string;
    severity?: "info" | "warning" | "critical";
    message: string;
    metadata?: Record<string, unknown>;
    dedupeKey?: string | null;
    recommendedAction?: string | null;
    priority?: "low" | "normal" | "high" | "urgent";
  } | null;
  deviceScanType?: "attendance" | "service" | null;
};

type AttendanceScanCommitRow =
  Database["public"]["Functions"]["commit_attendance_scan_transaction"]["Returns"][number];

function isPublicScanResult(value: unknown): value is PublicScanResult {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<PublicScanResult>;
  return (
    typeof record.ok === "boolean" &&
    typeof record.outcome === "string" &&
    typeof record.title === "string" &&
    typeof record.message === "string"
  );
}

function toJson(value: unknown): Json {
  return value as Json;
}

function withOperationId(result: PublicScanResult, operationId: string): PublicScanResult {
  return {
    ...result,
    operationId: result.operationId ?? operationId,
  };
}

function throwAttendanceDataError(params: {
  error: AttendanceErrorLike;
  fallback: AttendanceSafeErrorCode;
  stage: string;
  operationId?: string | null;
}): never {
  const code = classifyAttendanceDbError(params.error, params.fallback);
  throw createAttendanceScanError(code, params.error.message ?? undefined, {
    operationId: params.operationId ?? undefined,
    dbCode: params.error.code ?? null,
    details: { stage: params.stage },
    cause: params.error,
  });
}

function rpcRejectionCode(code: string | null | undefined): AttendanceSafeErrorCode {
  switch (code) {
    case "checkin_required":
    case "checkin_not_open":
    case "invalid_checkin_insert":
    case "invalid_request":
    case "invalid_scan_type":
    case "invalid_outcome":
      return "ATTENDANCE_RPC_REJECTED";
    case "already_checked_in":
    case "already_checked_out":
      return "DUPLICATE_SCAN";
    default:
      return "ATTENDANCE_RPC_REJECTED";
  }
}

function buildExceptionDedupeKey(params: {
  input: NonNullable<AttendanceScanCommitInput["exception"]>;
  event: EventInput;
  checkinId?: string | null;
}): string {
  return (
    params.input.dedupeKey ??
    [
      params.event.staffId ?? "unknown_staff",
      params.checkinId ?? params.event.checkinId ?? "no_checkin",
      params.input.exceptionType,
      params.event.isTest ? "test" : "live",
    ].join("|")
  );
}

async function commitAttendanceScanTransaction(
  admin: AttendanceDb,
  input: AttendanceScanCommitInput
): Promise<{
  result: PublicScanResult;
  scanEventId?: string;
  checkinId?: string;
  recoveryIssueId?: string;
}> {
  const operationId = normalizeAttendanceOperationId(input.event.requestId);
  if (
    !input.event.branchId ||
    !input.event.qrPointId ||
    !input.event.staffId ||
    !input.event.deviceId
  ) {
    throw createAttendanceScanError(
      "ATTENDANCE_TRANSACTION_FAILED",
      "Attendance scan transaction is missing required identity fields.",
      {
        operationId,
        details: {
          hasBranchId: Boolean(input.event.branchId),
          hasQrPointId: Boolean(input.event.qrPointId),
          hasStaffId: Boolean(input.event.staffId),
          hasDeviceId: Boolean(input.event.deviceId),
        },
      }
    );
  }

  const publicResult = {
    ...withOperationId(input.result, operationId),
    isTest: input.event.isTest ?? false,
  };
  const exception = input.exception
    ? {
        internalType: input.exception.exceptionType,
        dbType: toAttendanceDbExceptionType(input.exception.exceptionType),
        metadata: attendanceExceptionMetadata({
          internalType: input.exception.exceptionType,
          metadata: input.exception.metadata,
        }),
        dedupeKey: buildExceptionDedupeKey({
          input: input.exception,
          event: input.event,
          checkinId: input.checkinId,
        }),
      }
    : null;

  const rpcArgs: Database["public"]["Functions"]["commit_attendance_scan_transaction"]["Args"] = {
    p_request_id: operationId,
    p_branch_id: input.event.branchId,
    p_qr_point_id: input.event.qrPointId,
    p_staff_id: input.event.staffId,
    p_device_id: input.event.deviceId,
    p_scan_type: input.event.scanType,
    p_action: input.event.action,
    p_outcome: input.event.outcome,
    p_reason_code: input.event.reasonCode ?? undefined,
    p_message: input.event.message ?? undefined,
    p_user_agent: input.event.userAgent ?? undefined,
    p_ip_address: input.event.ipAddress ?? undefined,
    p_metadata: toJson({
      ...(input.event.metadata ?? {}),
      operationId,
    }),
    p_is_test: input.event.isTest ?? false,
    p_public_result: toJson(publicResult),
    p_checkin_id: input.checkinId ?? input.event.checkinId ?? undefined,
    p_checkin_insert: input.checkinInsert ? toJson(input.checkinInsert) : undefined,
    p_checkin_update: input.checkinUpdate ? toJson(input.checkinUpdate) : undefined,
    p_exception: exception
      ? toJson({
          exception_type: exception.dbType,
          severity: input.exception!.severity ?? "warning",
          message: input.exception!.message,
          metadata: exception.metadata,
          dedupe_key: exception.dedupeKey,
          recommended_action: input.exception!.recommendedAction ?? null,
          priority: input.exception!.priority ?? "normal",
        })
      : undefined,
    p_device_scan_type: input.deviceScanType ?? undefined,
  };

  const { data, error } = await admin
    .rpc("commit_attendance_scan_transaction", rpcArgs)
    .maybeSingle();

  if (error) {
    throwAttendanceDataError({
      error,
      fallback: "ATTENDANCE_TRANSACTION_FAILED",
      stage: "commit_attendance_scan_transaction",
      operationId,
    });
  }

  const row = data as AttendanceScanCommitRow | null;
  if (!row?.success) {
    throw createAttendanceScanError(
      rpcRejectionCode(row?.code),
      row?.message ?? "Attendance scan transaction was rejected.",
      {
        operationId,
        details: {
          rpcCode: row?.code ?? null,
          scanEventId: row?.scan_event_id ?? null,
          checkinId: row?.checkin_id ?? null,
        },
      }
    );
  }

  const committedResult = isPublicScanResult(row.operation_result)
    ? {
        ...withOperationId(row.operation_result, operationId),
        scanEventId: row.scan_event_id ?? row.operation_result.scanEventId,
      }
    : {
        ...publicResult,
        scanEventId: row.scan_event_id ?? input.result.scanEventId,
      };

  return {
    result: committedResult,
    scanEventId: row.scan_event_id ?? undefined,
    checkinId: row.checkin_id ?? undefined,
    recoveryIssueId: row.recovery_issue_id ?? undefined,
  };
}

async function loadCommittedScanResult(
  admin: AttendanceDb,
  requestId: string | null | undefined
): Promise<PublicScanResult | null> {
  if (!requestId) return null;
  const { data, error } = await admin
    .from("qr_scan_events")
    .select("id, operation_result, metadata")
    .eq("request_id", requestId)
    .maybeSingle();

  if (error) {
    throwAttendanceDataError({
      error,
      fallback: "ATTENDANCE_TRANSACTION_FAILED",
      stage: "load_committed_scan_result",
      operationId: requestId,
    });
  }

  const row = data as { id?: string; operation_result?: unknown; metadata?: unknown } | null;
  if (isPublicScanResult(row?.operation_result)) return withOperationId(row.operation_result, requestId);
  const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
  return isPublicScanResult(metadata.committedResult)
    ? withOperationId(metadata.committedResult, requestId)
    : null;
}

async function persistCommittedScanResult(params: {
  admin: AttendanceDb;
  requestId?: string | null;
  result: PublicScanResult;
}) {
  if (!params.requestId) return;
  const completedAt = new Date().toISOString();
  const { error } = await params.admin
    .from("qr_scan_events")
    .update({
      operation_id: params.requestId,
      operation_result: withOperationId(params.result, params.requestId),
      operation_result_recorded_at: completedAt,
    })
    .eq("request_id", params.requestId);
  if (error) {
    throwAttendanceDataError({
      error,
      fallback: "ATTENDANCE_WRITE_FAILED",
      stage: "persist_committed_scan_result",
      operationId: params.requestId,
    });
  }
}

function testModeMetadata(settings: {
  test_mode_enabled?: boolean;
  test_mode_reason?: string | null;
  test_mode_enabled_at?: string | null;
}): Record<string, unknown> {
  if (!settings.test_mode_enabled) return {};
  return {
    isTest: true,
    testModeReason: settings.test_mode_reason ?? null,
    testModeEnabledAt: settings.test_mode_enabled_at ?? null,
  };
}

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function scanTypeForPoint(point: QrPointRow): QrScanType {
  return point.point_type === "attendance" ? "attendance" : "room";
}

function success(title: string, message: string, extra: Partial<PublicScanResult> = {}): PublicScanResult {
  const outcome = extra.outcome ?? "success";
  return {
    ok: true,
    outcome,
    severity: extra.severity ?? (outcome === "noop" ? "info" : "success"),
    title,
    message,
    ...extra,
  };
}

function blocked(title: string, message: string, extra: Partial<PublicScanResult> = {}): PublicScanResult {
  const outcome = extra.outcome ?? "blocked";
  return {
    ok: false,
    outcome,
    severity: extra.severity ?? (outcome === "error" ? "critical" : "warning"),
    title,
    message,
    ...extra,
  };
}

function captured(title: string, message: string, extra: Partial<PublicScanResult> = {}): PublicScanResult {
  return {
    ok: true,
    outcome: "exception",
    severity: "warning",
    title,
    message,
    ...extra,
  };
}

function parseIp(value: string | null | undefined): string | null {
  const firstIp = value?.split(",")[0]?.trim();
  if (!firstIp) return null;
  if (!/^[0-9a-fA-F:.]+$/.test(firstIp)) return null;
  return firstIp;
}

function appendRequestId(requestId: string | null | undefined, suffix: string): string | null {
  return requestId ? `${requestId}:${suffix}` : null;
}

async function recordScanEvent(admin: AttendanceDb, input: EventInput): Promise<string | null> {
  const operationId = input.requestId || null;
  const metadata = input.isTest
    ? { ...(input.metadata ?? {}), isTest: true }
    : input.metadata ?? {};
  const payload: Database["public"]["Tables"]["qr_scan_events"]["Insert"] = {
    branch_id: input.branchId ?? null,
    qr_point_id: input.qrPointId ?? null,
    staff_id: input.staffId ?? null,
    device_id: input.deviceId ?? null,
    checkin_id: input.checkinId ?? null,
    booking_id: input.bookingId ?? null,
    resource_id: input.resourceId ?? null,
    scan_type: input.scanType,
    action: input.action,
    outcome: input.outcome,
    reason_code: input.reasonCode ?? null,
    message: input.message ?? null,
    request_id: input.requestId || null,
    user_agent: input.userAgent ?? null,
    ip_address: parseIp(input.ipAddress),
    metadata: toJson(metadata),
    is_test: input.isTest ?? false,
    operation_id: operationId,
  };

  const inserted = await admin.from("qr_scan_events").insert(payload).select("id").maybeSingle();
  if (!inserted.error) return inserted.data?.id ?? null;

  if (inserted.error.code === "23505" && input.requestId) {
    const existing = await admin
      .from("qr_scan_events")
      .select("id")
      .eq("request_id", input.requestId)
      .maybeSingle();
    if (existing.error) {
      throwAttendanceDataError({
        error: existing.error,
        fallback: "ATTENDANCE_WRITE_FAILED",
        stage: "record_scan_event_lookup_duplicate",
        operationId,
      });
    }
    return existing.data?.id ?? null;
  }

  if (payload.ip_address) {
    const retry = await admin
      .from("qr_scan_events")
      .insert({ ...payload, ip_address: null })
      .select("id")
      .maybeSingle();
    if (!retry.error) return retry.data?.id ?? null;
    throwAttendanceDataError({
      error: retry.error,
      fallback: "ATTENDANCE_WRITE_FAILED",
      stage: "record_scan_event_retry_without_ip",
      operationId,
    });
  }

  throwAttendanceDataError({
    error: inserted.error,
    fallback: "ATTENDANCE_WRITE_FAILED",
    stage: "record_scan_event",
    operationId,
  });
}

async function recordException(admin: AttendanceDb, input: {
  branchId: string;
  staffId?: string | null;
  checkinId?: string | null;
  scanEventId?: string | null;
  exceptionType: string;
  severity?: "info" | "warning" | "critical";
  message: string;
  metadata?: Record<string, unknown>;
  dedupeKey?: string | null;
  recommendedAction?: string | null;
  priority?: "low" | "normal" | "high" | "urgent";
  isTest?: boolean;
}): Promise<string | null> {
  const nowIso = new Date().toISOString();
  const dbExceptionType = toAttendanceDbExceptionType(input.exceptionType);
  const dedupeKey =
    input.dedupeKey ??
    [
      input.staffId ?? "unknown_staff",
      input.checkinId ?? "no_checkin",
      input.exceptionType,
      input.isTest ? "test" : "live",
    ].join("|");
  const metadata = attendanceExceptionMetadata({
    internalType: input.exceptionType,
    metadata: {
      ...(input.metadata ?? {}),
      dedupeKey,
    },
  });

  const existing = await admin
    .from("attendance_exceptions")
    .select("id, occurrence_count, metadata, related_checkin_ids")
    .eq("branch_id", input.branchId)
    .eq("is_test", input.isTest ?? false)
    .eq("status", "open")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();

  if (existing.error) {
    throwAttendanceDataError({
      error: existing.error,
      fallback: "ATTENDANCE_WRITE_FAILED",
      stage: "record_exception_lookup",
    });
  }

  if (existing.data?.id) {
    const row = existing.data as {
      id: string;
      occurrence_count?: number | null;
      metadata?: unknown;
      related_checkin_ids?: string[] | null;
    };
    const priorMetadata =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata as Record<string, unknown>
        : {};
    const relatedCheckinIds = new Set(row.related_checkin_ids ?? []);
    if (input.checkinId) relatedCheckinIds.add(input.checkinId);

    const updated = await admin
      .from("attendance_exceptions")
      .update({
        scan_event_id: input.scanEventId ?? null,
        latest_scan_event_id: input.scanEventId ?? null,
        severity: input.severity ?? "warning",
        message: input.message,
        metadata: toJson({ ...priorMetadata, ...metadata }),
        occurrence_count: Math.max(1, row.occurrence_count ?? 1) + 1,
        last_detected_at: nowIso,
        detected_at: nowIso,
        related_checkin_ids: Array.from(relatedCheckinIds),
        recommended_action: input.recommendedAction ?? null,
        priority: input.priority ?? "normal",
      })
      .eq("id", row.id)
      .eq("branch_id", input.branchId);
    if (updated.error) {
      throwAttendanceDataError({
        error: updated.error,
        fallback: "ATTENDANCE_WRITE_FAILED",
        stage: "record_exception_update",
      });
    }
    return row.id;
  }

  const inserted = await admin.from("attendance_exceptions").insert({
    branch_id: input.branchId,
    staff_id: input.staffId ?? null,
    checkin_id: input.checkinId ?? null,
    scan_event_id: input.scanEventId ?? null,
    latest_scan_event_id: input.scanEventId ?? null,
    exception_type: dbExceptionType,
    severity: input.severity ?? "warning",
    message: input.message,
    metadata: toJson(metadata),
    dedupe_key: dedupeKey,
    occurrence_count: 1,
    first_detected_at: nowIso,
    last_detected_at: nowIso,
    related_checkin_ids: input.checkinId ? [input.checkinId] : [],
    recommended_action: input.recommendedAction ?? null,
    priority: input.priority ?? "normal",
    is_test: input.isTest ?? false,
  }).select("id").maybeSingle();

  if (inserted.error) {
    throwAttendanceDataError({
      error: inserted.error,
      fallback: "ATTENDANCE_WRITE_FAILED",
      stage: "record_exception_insert",
    });
  }

  return (inserted.data as { id?: string } | null)?.id ?? null;
}

async function resolveDevice(admin: AttendanceDb, rawCredential: string | null | undefined): Promise<StaffDeviceRow | null> {
  if (!rawCredential) return null;
  const { data, error } = await admin
    .from("staff_devices")
    .select("id, staff_id, branch_id, status, staff:staff!staff_devices_staff_id_fkey(branch_id, full_name, nickname, staff_type, system_role, is_cross_branch, is_active, archived_at, merged_into_staff_id, metadata, branches(name))")
    .eq("device_fingerprint_hash", hashSecret(rawCredential))
    .maybeSingle();

  if (error) {
    throwAttendanceDataError({
      error,
      fallback: "ATTENDANCE_TRANSACTION_FAILED",
      stage: "resolve_device",
    });
  }

  return (data as StaffDeviceRow | null) ?? null;
}

async function resolveEffectiveAttendanceBranch(admin: AttendanceDb, params: {
  staffId: string;
  qrBranchId: string;
  attendanceDate: string;
}): Promise<{ allowed: boolean; branchId: string | null; source: string }> {
  const { data, error } = await admin
    .rpc("resolve_effective_attendance_branch", {
      p_staff_id: params.staffId,
      p_qr_branch_id: params.qrBranchId,
      p_attendance_date: params.attendanceDate,
    })
    .maybeSingle();
  if (error) {
    throwAttendanceDataError({
      error,
      fallback: "ATTENDANCE_TRANSACTION_FAILED",
      stage: "resolve_effective_attendance_branch",
    });
  }
  const row = data as { allowed?: boolean; effective_branch_id?: string | null; source?: string | null } | null;
  return {
    allowed: row?.allowed === true,
    branchId: row?.effective_branch_id ?? null,
    source: row?.source ?? "review",
  };
}

async function markDeviceScanSuccess(admin: AttendanceDb, params: {
  deviceId: string;
  scanType: "attendance" | "service";
  scannedAt?: string;
}) {
  const scannedAt = params.scannedAt ?? new Date().toISOString();
  const update =
    params.scanType === "attendance"
      ? { last_seen_at: scannedAt, last_attendance_scan_at: scannedAt }
      : { last_seen_at: scannedAt, last_service_scan_at: scannedAt };

  const { error } = await admin.from("staff_devices").update(update).eq("id", params.deviceId);
  if (error) {
    throwAttendanceDataError({
      error,
      fallback: "ATTENDANCE_WRITE_FAILED",
      stage: "mark_device_scan_success",
    });
  }
}

async function syncDeviceBranchToQrBranch(
  admin: AttendanceDb,
  device: StaffDeviceRow,
  point: QrPointRow
) {
  if (device.branch_id === point.branch_id) return;

  const { error } = await admin
    .from("staff_devices")
    .update({ branch_id: point.branch_id })
    .eq("id", device.id);
  if (error) {
    throwAttendanceDataError({
      error,
      fallback: "ATTENDANCE_WRITE_FAILED",
      stage: "sync_device_branch",
    });
  }
  device.branch_id = point.branch_id;
}

async function loadQrPoint(admin: AttendanceDb, publicCode: string): Promise<QrPointRow | null> {
  const { data, error } = await admin
    .from("qr_points")
    .select("id, branch_id, public_code, point_type, resource_id, label, is_active, requires_registered_device, scan_behavior, branch_resources(name, type), branches(name)")
    .eq("public_code", publicCode)
    .maybeSingle();

  if (error) {
    throwAttendanceDataError({
      error,
      fallback: "ATTENDANCE_TRANSACTION_FAILED",
      stage: "load_qr_point",
    });
  }

  return (data as QrPointRow | null) ?? null;
}

async function loadPendingBranchCorrectionRequest(
  admin: AttendanceDb,
  staffId: string,
  requestedBranchId: string
): Promise<{ id: string; created_at: string } | null> {
  const { data, error } = await admin
    .from("staff_branch_change_requests")
    .select("id, created_at")
    .eq("staff_id", staffId)
    .eq("requested_branch_id", requestedBranchId)
    .eq("status", "pending")
    .maybeSingle();

  if (error) {
    throwAttendanceDataError({
      error,
      fallback: "ATTENDANCE_TRANSACTION_FAILED",
      stage: "load_pending_branch_correction_request",
    });
  }
  return (data as { id: string; created_at: string } | null) ?? null;
}

function wrongBranchMetadata(params: {
  point: QrPointRow;
  staffId: string;
  staffName: string | null;
  staffBranchId: string | null;
  staffBranchName: string | null;
  deviceId?: string | null;
  deviceBranchId?: string | null;
  authUserId?: string | null;
  pendingRequestId?: string | null;
}) {
  return {
    qr_point_id: params.point.id,
    qr_public_code: params.point.public_code,
    scanned_branch_id: params.point.branch_id,
    scanned_branch_name: first(params.point.branches)?.name ?? null,
    staff_id: params.staffId,
    staff_name: params.staffName,
    staff_branch_id: params.staffBranchId,
    staff_branch_name: params.staffBranchName,
    device_id: params.deviceId ?? null,
    device_branch_id: params.deviceBranchId ?? null,
    auth_user_id: params.authUserId ?? null,
    reason: "staff_branch_does_not_match_scanned_qr_branch",
    can_request_branch_correction: Boolean(params.staffBranchId && params.staffBranchId !== params.point.branch_id),
    pending_request_id: params.pendingRequestId ?? null,
  };
}

function branchCorrectionDetails(params: {
  staffId: string;
  staffName: string | null;
  currentBranchId: string | null;
  currentBranchName: string | null;
  point: QrPointRow;
  scanEventId: string | null;
  deviceId?: string | null;
  pendingRequest?: { id: string; created_at: string } | null;
}): PublicScanResult["branchCorrection"] | undefined {
  if (!params.currentBranchId || params.currentBranchId === params.point.branch_id) return undefined;

  const requestedBranchName = first(params.point.branches)?.name ?? "Scanned QR branch";

  return {
    staffId: params.staffId,
    staffName: params.staffName ?? "Staff member",
    currentBranchId: params.currentBranchId,
    currentBranchName: params.currentBranchName ?? "Current profile branch",
    requestedBranchId: params.point.branch_id,
    requestedBranchName,
    qrPointId: params.point.id,
    scanEventId: params.scanEventId ?? undefined,
    publicCode: params.point.public_code,
    deviceId: params.deviceId ?? undefined,
    canRequestBranchCorrection: !params.pendingRequest,
    existingPendingRequest: params.pendingRequest
      ? {
          id: params.pendingRequest.id,
          createdAt: params.pendingRequest.created_at,
          requestedBranchName,
        }
      : null,
  };
}

export async function registerDeviceForAuthenticatedScan(
  publicCode: string,
  authUserId: string,
  ctx: ScanRequestContext
): Promise<FirstScanDeviceRegistrationResult> {
  const admin = asAttendanceDb(createAdminClient());
  const point = await loadQrPoint(admin, publicCode);

  if (!point || !point.is_active) {
    const eventId = await recordScanEvent(admin, {
      scanType: "unknown",
      action: "first_scan_register_device",
      outcome: "blocked",
      reasonCode: "invalid_qr",
      message: "Unknown or inactive QR code.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      metadata: { publicCode: maskId(publicCode) },
    });

    return {
      ok: false,
      result: blocked("QR not recognized", "This QR code is not active in CradleHub.", {
        reasonCode: "invalid_qr",
        securityNote: "No attendance change was recorded from this scan.",
        scanEventId: eventId ?? undefined,
      }),
    };
  }

  if (point.point_type !== "attendance") {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      scanType: scanTypeForPoint(point),
      action: "first_scan_register_device",
      outcome: "blocked",
      reasonCode: "attendance_qr_required",
      message: "First-scan device registration requires an attendance QR.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });

    return {
      ok: false,
      result: blocked("Attendance QR needed", "Please use the attendance QR to connect this phone.", {
        reasonCode: "attendance_qr_required",
        securityNote: "No phone was connected from this scan.",
        scanEventId: eventId ?? undefined,
      }),
    };
  }

  const existingDevice = await resolveDevice(admin, ctx.rawDeviceCredential);
  const existingDeviceStaff = first(existingDevice?.staff);
  if (
    existingDevice &&
    (existingDevice.status !== "active" || !existingDeviceStaff || !isOperationalStaff(existingDeviceStaff))
  ) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: existingDevice.staff_id,
      deviceId: existingDevice.id,
      scanType: scanTypeForPoint(point),
      action: "first_scan_register_device",
      outcome: "blocked",
      reasonCode: "revoked_device",
      message: "The registered device is revoked or staff is inactive.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });

    await recordException(admin, {
      branchId: point.branch_id,
      staffId: existingDevice.staff_id,
      scanEventId: eventId,
      exceptionType: "revoked_device",
      severity: "critical",
      message: `A revoked or inactive device attempted first-scan login at ${point.label}.`,
    });

    return {
      ok: false,
      result: blocked("Device blocked", "This device is no longer active. Ask the front desk to re-activate it.", {
        reasonCode: "revoked_device",
        severity: "critical",
        securityNote: "This phone cannot be used for attendance until access is restored.",
        scanEventId: eventId ?? undefined,
      }),
    };
  }

  const staffResult = await admin
    .from("staff")
    .select("id, branch_id, full_name, nickname, staff_type, system_role, is_cross_branch, is_active, archived_at, merged_into_staff_id, metadata, branches(name)")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  const staff = (staffResult.data as AuthenticatedStaffRow | null) ?? null;
  if (staffResult.error || !staff || !isOperationalStaff(staff)) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      scanType: scanTypeForPoint(point),
      action: "first_scan_register_device",
      outcome: staffResult.error ? "error" : "blocked",
      reasonCode: staffResult.error ? "device_registration_failed" : "account_not_eligible",
      message: staffResult.error?.message ?? "Authenticated user is not connected to an active staff profile.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });

    return {
      ok: false,
      result: blocked("Account not eligible", "This staff account is inactive. Please contact CRM or management.", {
        outcome: staffResult.error ? "error" : "blocked",
        reasonCode: staffResult.error ? "device_registration_failed" : "account_not_eligible",
        severity: staffResult.error ? "critical" : "warning",
        securityNote: "No phone was connected from this sign-in.",
        scanEventId: eventId ?? undefined,
      }),
    };
  }

  const staffName = staff.full_name ?? "Staff member";
  const branchName = first(point.branches)?.name ?? first(staff.branches)?.name ?? "Branch";

  if (existingDevice) {
    if (existingDevice.staff_id !== staff.id) {
      const eventId = await recordScanEvent(admin, {
        branchId: point.branch_id,
        qrPointId: point.id,
        staffId: staff.id,
        deviceId: existingDevice.id,
        scanType: scanTypeForPoint(point),
        action: "first_scan_register_device",
        outcome: "blocked",
        reasonCode: "device_staff_mismatch",
        message: "Authenticated staff does not own the existing device credential.",
        requestId: ctx.requestId,
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
      });

      return {
        ok: false,
        result: blocked("Phone already connected", "This phone is already linked to another staff account. Please contact CRM or management.", {
          reasonCode: "device_staff_mismatch",
          severity: "critical",
          securityNote: "No attendance change was recorded from this sign-in.",
          scanEventId: eventId ?? undefined,
        }),
      };
    }

    const branchDecision = getAttendanceDeviceBranchDecision({
      qrBranchId: point.branch_id,
      staffBranchId: staff.branch_id,
      deviceBranchId: existingDevice.branch_id,
      staffIsActive: staff.is_active,
    });

    if (branchDecision === "wrong_branch") {
      const pendingRequest = await loadPendingBranchCorrectionRequest(admin, staff.id, point.branch_id);
      const staffBranchName = first(staff.branches)?.name ?? null;
      const eventId = await recordScanEvent(admin, {
        branchId: point.branch_id,
        qrPointId: point.id,
        staffId: staff.id,
        deviceId: existingDevice.id,
        scanType: scanTypeForPoint(point),
        action: "first_scan_register_device",
        outcome: "blocked",
        reasonCode: "wrong_branch",
        message: "Authenticated staff belongs to a different branch.",
        requestId: ctx.requestId,
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
        metadata: wrongBranchMetadata({
          point,
          staffId: staff.id,
          staffName,
          staffBranchId: staff.branch_id,
          staffBranchName,
          deviceId: existingDevice.id,
          deviceBranchId: existingDevice.branch_id,
          authUserId,
          pendingRequestId: pendingRequest?.id,
        }),
      });

      await recordException(admin, {
        branchId: point.branch_id,
        staffId: staff.id,
        scanEventId: eventId,
        exceptionType: "wrong_branch",
        severity: "critical",
        message: `${staffName} attempted first-scan login at another branch.`,
        metadata: wrongBranchMetadata({
          point,
          staffId: staff.id,
          staffName,
          staffBranchId: staff.branch_id,
          staffBranchName,
          deviceId: existingDevice.id,
          deviceBranchId: existingDevice.branch_id,
          authUserId,
          pendingRequestId: pendingRequest?.id,
        }),
      });

      return {
        ok: false,
        result: blocked("Wrong branch detected", "This attendance QR belongs to another branch. Use your assigned branch QR or request a branch correction.", {
          reasonCode: "wrong_branch",
          severity: "critical",
          securityNote: "Your request must be approved by the front desk before scanning again.",
          scanEventId: eventId ?? undefined,
          branchCorrection: branchCorrectionDetails({
            staffId: staff.id,
            staffName,
            currentBranchId: staff.branch_id,
            currentBranchName: staffBranchName,
            point,
            scanEventId: eventId,
            deviceId: existingDevice.id,
            pendingRequest,
          }),
        }),
      };
    }

    if (branchDecision === "sync_device_branch") {
      const previousDeviceBranchId = existingDevice.branch_id;
      await syncDeviceBranchToQrBranch(admin, existingDevice, point);
      await recordScanEvent(admin, {
        branchId: point.branch_id,
        qrPointId: point.id,
        staffId: staff.id,
        deviceId: existingDevice.id,
        scanType: scanTypeForPoint(point),
        action: "attendance_device_branch_synchronized",
        outcome: "noop",
        reasonCode: "sync_device_branch",
        message: "Device branch metadata was synchronized during staff sign-in.",
        requestId: appendRequestId(ctx.requestId, "device-branch-sync"),
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
        metadata: {
          previousDeviceBranchId,
          nextDeviceBranchId: point.branch_id,
          authUserId,
        },
      });
    }

    await reconcileFirstScanDeviceRegistration({
      staffId: staff.id,
      deviceId: existingDevice.id,
      rawCredential: ctx.rawDeviceCredential ?? "",
    });
    return {
      ok: true,
      rawDeviceCredential: ctx.rawDeviceCredential ?? "",
      deviceId: existingDevice.id,
      staffId: staff.id,
      branchId: point.branch_id,
      staffName,
      branchName,
      registeredNewDevice: false,
    };
  }

  if (staff.branch_id !== point.branch_id) {
    const pendingRequest = await loadPendingBranchCorrectionRequest(admin, staff.id, point.branch_id);
    const staffBranchName = first(staff.branches)?.name ?? null;
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: staff.id,
      scanType: scanTypeForPoint(point),
      action: "first_scan_register_device",
      outcome: "blocked",
      reasonCode: "wrong_branch",
      message: "Authenticated staff belongs to a different branch.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      metadata: wrongBranchMetadata({
        point,
        staffId: staff.id,
        staffName,
        staffBranchId: staff.branch_id,
        staffBranchName,
        authUserId,
        pendingRequestId: pendingRequest?.id,
      }),
    });

    await recordException(admin, {
      branchId: point.branch_id,
      staffId: staff.id,
      scanEventId: eventId,
      exceptionType: "wrong_branch",
      severity: "critical",
      message: `${staffName} attempted first-scan login at another branch.`,
      metadata: wrongBranchMetadata({
        point,
        staffId: staff.id,
        staffName,
        staffBranchId: staff.branch_id,
        staffBranchName,
        authUserId,
        pendingRequestId: pendingRequest?.id,
      }),
    });

    return {
      ok: false,
      result: blocked("Wrong branch detected", "This attendance QR belongs to another branch. Use your assigned branch QR or request a branch correction.", {
        reasonCode: "wrong_branch",
        severity: "critical",
        securityNote: "Your request must be approved by the front desk before scanning again.",
        scanEventId: eventId ?? undefined,
        branchCorrection: branchCorrectionDetails({
          staffId: staff.id,
          staffName,
          currentBranchId: staff.branch_id,
          currentBranchName: staffBranchName,
          point,
          scanEventId: eventId,
          pendingRequest,
        }),
      }),
    };
  }

  const activeDevicesResult = await admin
    .from("staff_devices")
    .select("id, device_role")
    .eq("staff_id", staff.id)
    .eq("status", "active");
  if (activeDevicesResult.error) {
    throwAttendanceDataError({
      error: activeDevicesResult.error,
      fallback: "ATTENDANCE_TRANSACTION_FAILED",
      stage: "load_active_devices_for_first_scan",
      operationId: ctx.requestId,
    });
  }
  const activeDevices = (activeDevicesResult.data ?? []) as Array<{ id: string; device_role?: string | null }>;
  const registrationFingerprint = hashSecret(ctx.rawDeviceCredential || "");
  const relatedRequestResult = ctx.rawDeviceCredential
    ? await admin
        .from("staff_device_registration_requests")
        .select("request_type, existing_device_id, replacement_device_id")
        .eq("staff_id", staff.id)
        .eq("device_fingerprint_hash", registrationFingerprint)
        .in("status", ["pending", "approved"])
        .maybeSingle()
    : { data: null, error: null };
  if (relatedRequestResult.error) {
    throwAttendanceDataError({
      error: relatedRequestResult.error,
      fallback: "ATTENDANCE_TRANSACTION_FAILED",
      stage: "load_related_device_registration_request",
      operationId: ctx.requestId,
    });
  }
  const replacementDeviceId = relatedRequestResult.data?.replacement_device_id
    ?? relatedRequestResult.data?.existing_device_id
    ?? null;
  const replacesActiveDevice = relatedRequestResult.data?.request_type === "replacement"
    && activeDevices.some((device) => device.id === replacementDeviceId);
  const effectiveActiveCount = activeDevices.length - (replacesActiveDevice ? 1 : 0);
  if (effectiveActiveCount >= ACTIVE_ATTENDANCE_DEVICE_LIMIT) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: staff.id,
      scanType: scanTypeForPoint(point),
      action: "first_scan_register_device",
      outcome: "blocked",
      reasonCode: "device_limit_reached",
      message: "Active attendance device limit reached.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });
    return {
      ok: false,
      result: blocked("Device limit reached", "Your attendance device limit has been reached. Ask CRM to replace or revoke an old phone.", {
        reasonCode: "device_limit_reached",
        severity: "warning",
        securityNote: "No phone was connected and no attendance change was recorded.",
        scanEventId: eventId ?? undefined,
      }),
    };
  }

  const rawDeviceCredential = ctx.rawDeviceCredential || createDeviceCredential();
  const deviceHints = inferDeviceClientHints(ctx.userAgent);
  const nowIso = new Date().toISOString();
  const inserted = await admin
    .from("staff_devices")
    .insert({
      staff_id: staff.id,
      branch_id: point.branch_id,
      device_fingerprint_hash: hashSecret(rawDeviceCredential),
      device_label: deviceHints.label,
      status: "active",
      device_role: nextAttendanceDeviceRole(
        activeDevices.some((device) => device.device_role === "primary")
      ),
      registration_source: "first_scan_activation",
      browser_name: deviceHints.browserName,
      browser_version: deviceHints.browserVersion,
      platform_name: deviceHints.platformName,
      last_seen_at: nowIso,
      metadata: {
        source: "first_scan_login",
        qr_point_id: point.id,
        auth_user_id: authUserId,
        user_agent: ctx.userAgent ?? null,
      },
    })
    .select("id")
    .single();

  if ((inserted.error as { code?: string } | null)?.code === "23505") {
    const retryDevice = await resolveDevice(admin, rawDeviceCredential);
    if (retryDevice?.staff_id === staff.id && retryDevice.status === "active") {
      await reconcileFirstScanDeviceRegistration({
        staffId: staff.id,
        deviceId: retryDevice.id,
        rawCredential: rawDeviceCredential,
      });
      return {
        ok: true,
        rawDeviceCredential,
        deviceId: retryDevice.id,
        staffId: staff.id,
        branchId: point.branch_id,
        staffName,
        branchName,
        registeredNewDevice: false,
      };
    }
  }

  if (inserted.error || !inserted.data) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: staff.id,
      scanType: scanTypeForPoint(point),
      action: "first_scan_register_device",
      outcome: "error",
      reasonCode: "device_registration_failed",
      message: inserted.error?.message ?? "Device insert failed.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });

    return {
      ok: false,
      result: blocked("Phone connection failed", "This phone could not be connected. Please try again or contact the front desk.", {
        outcome: "error",
        reasonCode: "device_registration_failed",
        severity: "critical",
        securityNote: "No attendance change was recorded from this sign-in.",
        scanEventId: eventId ?? undefined,
      }),
    };
  }

  const eventId = await recordScanEvent(admin, {
    branchId: point.branch_id,
    staffId: staff.id,
    deviceId: inserted.data.id as string,
    scanType: "activation",
    action: "first_scan_device_registered",
    outcome: "success",
    reasonCode: "device_registered",
    message: "Device registered after staff sign-in.",
    requestId: ctx.requestId,
    userAgent: ctx.userAgent,
    ipAddress: ctx.ipAddress,
    metadata: {
      source: "first_scan_login",
      qr_point_id: point.id,
      registration_source: "first_scan_activation",
    },
  });

  await reconcileFirstScanDeviceRegistration({
    staffId: staff.id,
    deviceId: inserted.data.id as string,
    rawCredential: rawDeviceCredential,
  });

  return {
    ok: true,
    rawDeviceCredential,
    deviceId: inserted.data.id as string,
    staffId: staff.id,
    branchId: point.branch_id,
    staffName,
    branchName,
    scanEventId: eventId ?? undefined,
    registeredNewDevice: true,
  };
}

async function findRecentDuplicate(admin: AttendanceDb, params: {
  pointId: string;
  deviceId: string;
  seconds: number;
  isTest: boolean;
}): Promise<boolean> {
  const cutoff = new Date(Date.now() - params.seconds * 1000).toISOString();
  const { data, error } = await admin
    .from("qr_scan_events")
    .select("id")
    .eq("qr_point_id", params.pointId)
    .eq("device_id", params.deviceId)
    .eq("is_test", params.isTest)
    .in("outcome", ["success", "exception"])
    .gte("created_at", cutoff)
    .limit(1);

  if (error) {
    throwAttendanceDataError({
      error,
      fallback: "ATTENDANCE_TRANSACTION_FAILED",
      stage: "find_recent_duplicate",
    });
  }

  return (data?.length ?? 0) > 0;
}

async function getOpenCheckins(admin: AttendanceDb, params: {
  staffId: string;
  branchId?: string;
  isTest: boolean;
}): Promise<CheckinRow[]> {
  let query = admin
    .from("staff_shift_checkins")
    .select("id, staff_id, branch_id, shift_date, shift_type, shift_instance_key, checked_in_at, checked_out_at, status, scheduled_start_at, scheduled_end_at, schedule_source, schedule_source_id, branch_timezone, attendance_business_date, attendance_expected_end_at, earliest_normal_clock_out_at, latest_normal_clock_out_at, attendance_policy_source, attendance_policy_snapshot, provisional_auto_closed_at, clock_out_confirmation_required, is_test")
    .eq("staff_id", params.staffId)
    .eq("is_test", params.isTest)
    .eq("status", "checked_in")
    .is("checked_out_at", null);
  if (params.branchId) query = query.eq("branch_id", params.branchId);
  const { data, error } = await query
    .order("checked_in_at", { ascending: false })
    .limit(10);

  if (error) {
    throwAttendanceDataError({
      error,
      fallback: "ATTENDANCE_TRANSACTION_FAILED",
      stage: "get_open_checkins",
    });
  }

  return (data as CheckinRow[] | null) ?? [];
}

async function getActiveCheckin(admin: AttendanceDb, params: {
  staffId: string;
  branchId: string;
  isTest: boolean;
}): Promise<CheckinRow | null> {
  const rows = await getOpenCheckins(admin, params);
  return rows[0] ?? null;
}

function toOpenIntentCheckin(checkin: CheckinRow): OpenAttendanceIntentCheckin {
  return {
    id: checkin.id,
    checkedInAt: checkin.checked_in_at,
    checkedOutAt: checkin.checked_out_at,
    scheduledStartAt: checkin.scheduled_start_at ?? null,
    scheduledEndAt: checkin.scheduled_end_at ?? null,
    shiftDate: checkin.shift_date,
    shiftType: checkin.shift_type,
    shiftInstanceKey: checkin.shift_instance_key ?? null,
    status: checkin.status,
    isTest: checkin.is_test ?? false,
  };
}

function policySnapshotNumber(
  checkin: CheckinRow,
  key: string,
  fallback: number
): number {
  const value = checkin.attendance_policy_snapshot?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

async function getPendingProvisionalClockOuts(
  admin: AttendanceDb,
  params: { staffId: string; branchId: string; isTest: boolean }
): Promise<CheckinRow[]> {
  const cutoff = new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("staff_shift_checkins")
    .select(
      "id, staff_id, branch_id, shift_date, shift_type, shift_instance_key, checked_in_at, checked_out_at, status, scheduled_start_at, scheduled_end_at, schedule_source, schedule_source_id, branch_timezone, attendance_business_date, attendance_expected_end_at, earliest_normal_clock_out_at, latest_normal_clock_out_at, attendance_policy_source, attendance_policy_snapshot, provisional_auto_closed_at, clock_out_confirmation_required, is_test"
    )
    .eq("staff_id", params.staffId)
    .eq("branch_id", params.branchId)
    .eq("is_test", params.isTest)
    .eq("status", "checked_out")
    .eq("clock_out_method", "system_auto_close")
    .eq("clock_out_confirmation_required", true)
    .gte("provisional_auto_closed_at", cutoff)
    .order("provisional_auto_closed_at", { ascending: false })
    .limit(10);

  if (error) {
    throwAttendanceDataError({
      error,
      fallback: "ATTENDANCE_TRANSACTION_FAILED",
      stage: "get_pending_provisional_clock_outs",
    });
  }
  return (data as CheckinRow[] | null) ?? [];
}

async function reconcileProvisionalClockOut(params: {
  admin: AttendanceDb;
  point: QrPointRow;
  device: StaffDeviceRow;
  checkin: CheckinRow;
  ctx: ScanRequestContext;
  staffName: string;
  branchName: string;
  actualClockOutAt: string;
  isTest: boolean;
}): Promise<PublicScanResult> {
  const operationId = normalizeAttendanceOperationId(params.ctx.requestId);
  const metrics = computeAttendanceMetrics({
    checkedInAt: params.checkin.checked_in_at,
    checkedOutAt: params.actualClockOutAt,
    scheduledStartAt: params.checkin.scheduled_start_at ?? null,
    scheduledEndAt: params.checkin.scheduled_end_at ?? null,
    earliestNormalClockOutAt: params.checkin.earliest_normal_clock_out_at ?? null,
    latestNormalClockOutAt: params.checkin.latest_normal_clock_out_at ?? null,
    lateGraceMinutes: policySnapshotNumber(params.checkin, "lateGraceMinutes", 10),
    earlyLeaveGraceMinutes: policySnapshotNumber(
      params.checkin,
      "earlyLeaveThresholdMinutes",
      5
    ),
  });
  const publicResult = withOperationId(
    success(
      "Clock-out confirmed",
      `${params.staffName}'s actual QR clock-out replaced the provisional auto-close.`,
      {
        reasonCode: "provisional_clock_out_reconciled",
        securityNote: "The original Attendance row was corrected; no second check-in was created.",
        attendance: {
          action: "clock_out",
          staffName: params.staffName,
          branchName: params.branchName,
          branchTimezone: params.checkin.branch_timezone ?? "Asia/Manila",
          shiftLabel: params.checkin.shift_type,
          occurredAt: params.actualClockOutAt,
          sessionStartedAt: params.checkin.checked_in_at,
          workedMinutes: metrics.workedMinutes,
        },
      }
    ),
    operationId
  );

  const rpcArgs: Database["public"]["Functions"]["reconcile_provisional_attendance_clock_out"]["Args"] = {
    p_request_id: operationId,
    p_checkin_id: params.checkin.id,
    p_branch_id: params.point.branch_id,
    p_staff_id: params.device.staff_id,
    p_qr_point_id: params.point.id,
    p_device_id: params.device.id,
    p_actual_clock_out_at: params.actualClockOutAt,
    p_public_result: toJson(publicResult),
    p_user_agent: params.ctx.userAgent ?? undefined,
    p_ip_address: params.ctx.ipAddress ?? undefined,
    p_metadata: toJson({
      policySnapshot: params.checkin.attendance_policy_snapshot ?? {},
      metrics,
    }),
    p_is_test: params.isTest,
  };
  const { data, error } = await params.admin
    .rpc("reconcile_provisional_attendance_clock_out", rpcArgs)
    .maybeSingle();
  if (error) {
    throwAttendanceDataError({
      error,
      fallback: "ATTENDANCE_TRANSACTION_FAILED",
      stage: "reconcile_provisional_attendance_clock_out",
      operationId,
    });
  }
  if (!data?.success) {
    throw createAttendanceScanError(
      "ATTENDANCE_RPC_REJECTED",
      data?.message ?? "Provisional clock-out reconciliation was rejected.",
      { operationId, details: { rpcCode: data?.code ?? null } }
    );
  }
  await resolveClosingInterventionSignals(params.admin, params.checkin.id);
  return isPublicScanResult(data.operation_result)
    ? withOperationId(data.operation_result, operationId)
    : publicResult;
}

export async function resolveClosingInterventionSignals(
  admin: AttendanceDb,
  checkinId: string
): Promise<void> {
  await Promise.all([
    markNotificationResolved({
      entityType: "attendance_record",
      entityId: checkinId,
      type: "attendance_clock_out_reminder",
    }),
    markNotificationResolved({
      entityType: "attendance_record",
      entityId: checkinId,
      type: "attendance_closing_escalation",
    }),
    markNotificationResolved({
      entityType: "attendance_record",
      entityId: checkinId,
      type: "attendance_provisional_auto_close",
    }),
  ]);

  const { data } = await admin
    .from("attendance_closing_interventions")
    .select("stage, dedupe_key, branch_id")
    .eq("checkin_id", checkinId)
    .neq("stage", "reminder");
  await Promise.all(
    (data ?? []).map((row) =>
      resolveWorkflowTask({
        branchId: row.branch_id,
        workspaceScope: "manager",
        assignedToRole: "manager",
        taskType: `attendance.crm_closing.${row.stage}`,
        entityType: "attendance_record",
        entityId: checkinId,
        dedupeKey: `${row.dedupe_key}:task`,
      })
    )
  );
}

async function hasActiveService(admin: AttendanceDb, params: {
  staffId: string;
  branchId: string;
}): Promise<BookingRow | null> {
  const { data, error } = await admin
    .from("bookings")
    .select("id, branch_id, staff_id, booking_date, start_time, end_time, status, booking_progress_status, resource_id, session_started_at, session_due_at, session_completed_at, session_duration_minutes_snapshot, customers(full_name), services(name, duration_minutes), branch_resources!bookings_resource_id_fkey(name)")
    .eq("staff_id", params.staffId)
    .eq("branch_id", params.branchId)
    .eq("status", "in_progress")
    .eq("booking_progress_status", "session_started")
    .is("session_completed_at", null)
    .order("session_started_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throwAttendanceDataError({
      error,
      fallback: "ATTENDANCE_TRANSACTION_FAILED",
      stage: "has_active_service",
    });
  }

  return (data as BookingRow | null) ?? null;
}

async function selectScheduleWindow(admin: AttendanceDb, params: {
  branchId: string;
  staffId: string;
  staffType: string | null;
  systemRole: string | null;
  scheduleDate: string;
  scanDate: string;
  branchTime: string;
  timezone: string;
}): Promise<ScheduleSelection> {
  let schedules: Map<string, ResolvedStaffSchedule>;
  try {
    schedules = await getResolvedStaffSchedulesForDate({
      supabase: admin as never,
      branchId: params.branchId,
      date: params.scheduleDate,
      staff: [
        {
          id: params.staffId,
          staff_type: params.staffType,
          system_role: params.systemRole,
        },
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Schedule query failed.";
    const code = message.toLowerCase().includes("schema cache") ||
      message.toLowerCase().includes("column")
      ? "SCHEDULE_SCHEMA_MISMATCH"
      : "SCHEDULE_QUERY_FAILED";
    throw createAttendanceScanError(code, message, {
      details: {
        stage: "select_schedule_window",
        staffId: params.staffId,
        scheduleDate: params.scheduleDate,
      },
      cause: error,
    });
  }

  const resolvedSchedule = schedules.get(params.staffId) ?? {
    source: "none",
    status: "missing",
    state: "NO_SCHEDULE_CONFIGURED",
    isWorking: false,
    isDayOff: false,
    windows: [],
  } satisfies ResolvedStaffSchedule;

  return {
    ...resolveStaffAttendanceSchedule({
      scanDate: params.scanDate,
      scanTime: params.branchTime,
      timezone: params.timezone,
      schedule: resolvedSchedule,
    }),
    resolvedSchedule,
  };
}

function buildCountdown(booking: BookingRow, fallbackResourceName?: string | null): NonNullable<PublicScanResult["countdown"]> | undefined {
  if (!booking.session_started_at) return undefined;
  const service = first(booking.services);
  const durationMinutes = booking.session_duration_minutes_snapshot ?? service?.duration_minutes ?? 60;
  const dueAt =
    booking.session_due_at ??
    new Date(new Date(booking.session_started_at).getTime() + durationMinutes * 60000).toISOString();

  return {
    bookingId: booking.id,
    customerName: first(booking.customers)?.full_name ?? "Customer",
    serviceName: service?.name ?? "Service",
    resourceName: first(booking.branch_resources)?.name ?? fallbackResourceName ?? null,
    startedAt: booking.session_started_at,
    dueAt,
    durationMinutes,
  };
}

async function recordAttendanceRecoveryIntent(params: {
  admin: AttendanceDb;
  point: QrPointRow;
  device: StaffDeviceRow;
  ctx: ScanRequestContext;
  staffName: string;
  staffNickname?: string | null;
  intent: AttendanceScanIntent;
  scannedAt: string;
  branchLocalTime: string;
  branchTimezone: string;
  businessDate: string;
  isTest: boolean;
  testMetadata: Record<string, unknown>;
}): Promise<PublicScanResult> {
  const greeting = params.intent.type === "likely_closing_scan_without_clock_in"
    ? buildAttendanceGreeting({
        staffId: params.device.staff_id,
        nickname: params.staffNickname,
        fullName: params.staffName,
        branchLocalTime: params.branchLocalTime,
        action: "captured",
        reasonCode: params.intent.reasonCode,
        requestId: params.ctx.requestId,
        businessDate: params.businessDate,
      })
    : null;
  const result = captured(greeting?.title ?? params.intent.title, greeting?.message ?? params.intent.message, {
    outcome: "exception",
    reasonCode: params.intent.reasonCode,
    severity: params.intent.severity,
    reviewLabel:
      params.intent.type === "likely_closing_scan_without_clock_in"
        ? "Captured · For review"
        : undefined,
  });

  const committed = await commitAttendanceScanTransaction(params.admin, {
    event: {
      branchId: params.point.branch_id,
      qrPointId: params.point.id,
      staffId: params.device.staff_id,
      deviceId: params.device.id,
      scanType: "attendance",
      action: params.intent.action,
      outcome: "exception",
      reasonCode: params.intent.reasonCode,
      message: greeting?.message ?? params.intent.message,
      requestId: params.ctx.requestId,
      userAgent: params.ctx.userAgent,
      ipAddress: params.ctx.ipAddress,
      metadata: {
        intent: params.intent.type,
        schedule: params.intent.schedule,
        scannedAt: params.scannedAt,
        branchTimezone: params.branchTimezone,
        attendanceBusinessDate: params.businessDate,
        requestId: params.ctx.requestId ?? null,
        ...params.testMetadata,
      },
      isTest: params.isTest,
    },
    result,
    exception: {
      exceptionType: params.intent.type,
      severity: params.intent.severity === "info" ? "warning" : params.intent.severity,
      message: `${params.staffName}: ${params.intent.message}`,
      metadata: {
        intent: params.intent.type,
        schedule: params.intent.schedule,
        scannedAt: params.scannedAt,
        branchTimezone: params.branchTimezone,
        attendanceBusinessDate: params.businessDate,
        requestId: params.ctx.requestId ?? null,
        staffId: params.device.staff_id,
        branchId: params.point.branch_id,
        ...params.testMetadata,
      },
      recommendedAction:
        params.intent.type === "likely_closing_scan_without_clock_in"
          ? "rebuild_from_raw_scans"
          : "review_scan",
      priority: params.intent.severity === "critical" ? "high" : "normal",
    },
    deviceScanType: "attendance",
  });

  return committed.result;
}

async function processAttendanceScan(admin: AttendanceDb, point: QrPointRow, device: StaffDeviceRow, ctx: ScanRequestContext): Promise<PublicScanResult> {
  const settings = await getAttendanceSettings(point.branch_id);
  const isTest = settings.test_mode_enabled;
  const testMetadata = testModeMetadata(settings);
  const staff = first(device.staff);
  const staffName = staff?.full_name ?? "Staff member";
  const staffNickname = staff?.nickname ?? null;
  const branchName = first(point.branches)?.name ?? "Branch";

  if (await findRecentDuplicate(admin, {
    pointId: point.id,
    deviceId: device.id,
    seconds: settings.duplicate_scan_window_seconds,
    isTest,
  })) {
    const result = success("Already recorded", "A recent attendance scan was already accepted.", {
      outcome: "noop",
      reasonCode: "duplicate_scan",
      securityNote: "No new attendance record was created.",
    });
    const committed = await commitAttendanceScanTransaction(admin, {
      event: {
        branchId: point.branch_id,
        qrPointId: point.id,
        staffId: device.staff_id,
        deviceId: device.id,
        scanType: "attendance",
        action: "duplicate_scan",
        outcome: "noop",
        reasonCode: "duplicate_scan",
        message: "Duplicate scan ignored.",
        requestId: ctx.requestId,
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
        metadata: testMetadata,
        isTest,
      },
      result,
      deviceScanType: "attendance",
    });
    return committed.result;
  }

  const branchNow = getAttendanceBranchNow(settings);
  const schedule = await selectScheduleWindow(admin, {
    branchId: point.branch_id,
    staffId: device.staff_id,
    staffType: staff?.staff_type ?? null,
    systemRole: staff?.system_role ?? null,
    scheduleDate: branchNow.businessDate,
    scanDate: branchNow.localDate,
    branchTime: branchNow.time,
    timezone: branchNow.timezone,
  });
  const nowIso = new Date().toISOString();
  const openCheckins = await getOpenCheckins(admin, {
    staffId: device.staff_id,
    isTest,
  });
  const openCheckinClassification = classifyOpenAttendanceCheckins({
    openCheckins: openCheckins.map(toOpenIntentCheckin),
    schedule,
  });
  if (openCheckins.length > 1) {
    const openCheckinIds = openCheckins.map((checkin) => checkin.id);
    const result = captured(
      "Multiple open attendance records",
      "The scan was captured, but no clock-in or clock-out was inferred. A manager must resolve the conflicting open records.",
      {
        reasonCode: "conflicting_open_checkin",
        securityNote: "Raw scan evidence was preserved and attendance was left unchanged.",
      }
    );
    const committed = await commitAttendanceScanTransaction(admin, {
      event: {
        branchId: point.branch_id,
        qrPointId: point.id,
        staffId: device.staff_id,
        deviceId: device.id,
        scanType: "attendance",
        action: "scan_captured",
        outcome: "exception",
        reasonCode: "conflicting_open_checkin",
        message: "Multiple open attendance records require review.",
        requestId: ctx.requestId,
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
        metadata: { openCheckinIds, schedule, scannedAt: nowIso, ...testMetadata },
        isTest,
      },
      result,
      exception: {
        exceptionType: "conflicting_open_checkin",
        severity: "critical",
        message: `${staffName} has ${openCheckins.length} open attendance records.`,
        metadata: {
          openCheckinIds,
          openCheckins: openCheckins.map((checkin) => ({
            id: checkin.id,
            branchId: checkin.branch_id,
            shiftDate: checkin.shift_date,
            shiftType: checkin.shift_type,
            checkedInAt: checkin.checked_in_at,
          })),
          schedule,
          scannedAt: nowIso,
          ...testMetadata,
        },
        recommendedAction: "resolve_conflicting_open_records",
        priority: "high",
      },
      deviceScanType: "attendance",
    });
    return committed.result;
  }

  const activeCheckin = openCheckins[0] ?? null;
  const activeCheckinMatchesSchedule =
    Boolean(activeCheckin) && openCheckinClassification.matchingCheckin?.id === activeCheckin?.id;

  const scanIntent = resolveAttendanceScanIntent({
    scanIso: nowIso,
    scanDate: branchNow.localDate,
    scanTime: branchNow.time,
    timezone: branchNow.timezone,
    settings,
    schedule: schedule.resolvedSchedule,
    activeCheckin: activeCheckin ? toOpenIntentCheckin(activeCheckin) : null,
  });
  const attendanceSchedule = {
    ...schedule,
    ...scanIntent.schedule,
    resolvedSchedule: schedule.resolvedSchedule,
  };
  const shiftInstance = buildAttendanceShiftInstance({
    staffId: device.staff_id,
    branchId: point.branch_id,
    schedule: attendanceSchedule,
    businessDate: branchNow.businessDate,
    branchTimezone: branchNow.timezone,
  });

  if (activeCheckin) {
    const nowIso = new Date().toISOString();
    const dynamicPolicy = await recalculateAttendanceClockOutPolicy(
      admin,
      activeCheckin.id,
      nowIso
    );
    activeCheckin.attendance_expected_end_at = dynamicPolicy.expectedClockOutAt;
    activeCheckin.earliest_normal_clock_out_at = dynamicPolicy.earliestNormalClockOutAt;
    activeCheckin.latest_normal_clock_out_at = dynamicPolicy.latestNormalClockOutAt;
    activeCheckin.attendance_policy_source = dynamicPolicy.source;
    activeCheckin.attendance_policy_snapshot = dynamicPolicy.snapshot;
    const metrics = computeAttendanceMetrics({
      checkedInAt: activeCheckin.checked_in_at,
      checkedOutAt: nowIso,
      scheduledStartAt: activeCheckin.scheduled_start_at ?? null,
      scheduledEndAt: activeCheckin.scheduled_end_at ?? null,
      earliestNormalClockOutAt: activeCheckin.earliest_normal_clock_out_at ?? null,
      latestNormalClockOutAt: activeCheckin.latest_normal_clock_out_at ?? null,
      lateGraceMinutes: settings.late_grace_minutes,
      earlyLeaveGraceMinutes: settings.early_leave_threshold_minutes,
    });
    const timingReasonCode =
      metrics.earlyLeaveMinutes > 0
        ? "early_clock_out"
        : metrics.overtimeMinutes >=
            policySnapshotNumber(
              activeCheckin,
              "overtimeThresholdMinutes",
              settings.overtime_threshold_minutes
            )
          ? "overtime_clock_out"
          : "clock_out";
    const clockOutReasonCode = activeCheckinMatchesSchedule
      ? timingReasonCode
      : "stale_open_checkin";
    const anomalyCodes = [
      ...(activeCheckinMatchesSchedule ? [] : ["stale_open_checkin"]),
      ...(timingReasonCode === "clock_out" ? [] : [timingReasonCode]),
    ];
    const needsClockOutReview = anomalyCodes.length > 0;
    const clockOutReviewReason = timingReasonCode !== "clock_out"
      ? timingReasonCode
      : clockOutReasonCode;
    const greeting = buildAttendanceGreeting({
      staffId: device.staff_id,
      nickname: staffNickname,
      fullName: staffName,
      branchLocalTime: branchNow.time,
      action: "clock_out",
      reasonCode: clockOutReasonCode,
      requestId: ctx.requestId,
      businessDate: branchNow.businessDate,
    });
    const result = success(greeting.title, greeting.message, {
      reasonCode: clockOutReasonCode,
      severity: needsClockOutReview ? "warning" : "success",
      reviewLabel: attendanceReviewLabel(clockOutReviewReason, needsClockOutReview),
      securityNote: "This device is recognized and ready for future scans.",
      attendance: {
        action: "clock_out",
        staffName,
        branchName,
        branchTimezone: settings.timezone,
        shiftLabel: activeCheckin.shift_type,
        occurredAt: nowIso,
        sessionStartedAt: activeCheckin.checked_in_at,
        workedMinutes: metrics.workedMinutes,
      },
    });

    const exception = anomalyCodes.length > 0
        ? {
            exceptionType: activeCheckinMatchesSchedule ? timingReasonCode : "stale_open_checkin",
            message: !activeCheckinMatchesSchedule
              ? `${staffName}'s sole open attendance record was closed even though it did not match the current schedule.`
              : metrics.earlyLeaveMinutes > 0
                ? `${staffName} clocked out ${formatMinutesCompact(metrics.earlyLeaveMinutes)} early.`
                : `${staffName} worked ${formatMinutesCompact(metrics.overtimeMinutes)} overtime.`,
            metadata: {
              anomalyCodes,
              metrics,
              currentSchedule: shiftInstance,
              scannedAt: nowIso,
              branchTimezone: branchNow.timezone,
              attendanceBusinessDate: branchNow.businessDate,
              requestId: ctx.requestId ?? null,
              staffId: device.staff_id,
              branchId: activeCheckin.branch_id,
              originalSnapshot: {
                branchId: activeCheckin.branch_id,
                shiftInstanceKey: activeCheckin.shift_instance_key ?? null,
                shiftDate: activeCheckin.shift_date,
                shiftType: activeCheckin.shift_type,
                scheduledStartAt: activeCheckin.scheduled_start_at ?? null,
                scheduledEndAt: activeCheckin.scheduled_end_at ?? null,
                scheduleSource: activeCheckin.schedule_source ?? null,
                scheduleSourceId: activeCheckin.schedule_source_id ?? null,
                branchTimezone: activeCheckin.branch_timezone ?? null,
                attendanceBusinessDate: activeCheckin.attendance_business_date ?? null,
                attendanceExpectedEndAt: activeCheckin.attendance_expected_end_at ?? null,
                earliestNormalClockOutAt: activeCheckin.earliest_normal_clock_out_at ?? null,
                latestNormalClockOutAt: activeCheckin.latest_normal_clock_out_at ?? null,
                attendancePolicySource: activeCheckin.attendance_policy_source ?? "schedule",
                attendancePolicySnapshot: activeCheckin.attendance_policy_snapshot ?? {},
              },
            },
            recommendedAction: "review_clock_out",
          }
        : null;

    const committed = await commitAttendanceScanTransaction(admin, {
      event: {
        branchId: activeCheckin.branch_id,
        qrPointId: point.id,
        staffId: device.staff_id,
        deviceId: device.id,
        checkinId: activeCheckin.id,
        scanType: "attendance",
        action: "clock_out",
        outcome: "success",
        reasonCode: clockOutReasonCode,
        message: "Clock-out recorded.",
        requestId: ctx.requestId,
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
        metadata: {
          metrics,
          shiftInstance,
          anomalyCodes,
          activeCheckinMatchesSchedule,
          scannedBranchId: point.branch_id,
          attendanceRecordBranchId: activeCheckin.branch_id,
        },
        isTest,
      },
      result,
      checkinId: activeCheckin.id,
      checkinUpdate: {
        checked_out_at: nowIso,
        status: "checked_out",
        clock_out_method: "qr",
        worked_minutes: metrics.workedMinutes,
        late_minutes: metrics.lateMinutes,
        early_leave_minutes: metrics.earlyLeaveMinutes,
        overtime_minutes: metrics.overtimeMinutes,
        attendance_status: metrics.attendanceStatus,
        exception_state: exception ? "open" : metrics.exceptionState,
      },
      exception,
      deviceScanType: "attendance",
    });

    await resolveClosingInterventionSignals(admin, activeCheckin.id);
    return committed.result;
  }

  const pendingProvisionalClockOuts = await getPendingProvisionalClockOuts(admin, {
    staffId: device.staff_id,
    branchId: point.branch_id,
    isTest,
  });
  const provisionalClockOuts = pendingProvisionalClockOuts.filter(
    (row) => (row.attendance_business_date ?? row.shift_date) === branchNow.businessDate
  );
  const outsideBusinessDateProvisionalClockOuts = pendingProvisionalClockOuts.filter(
    (row) => (row.attendance_business_date ?? row.shift_date) !== branchNow.businessDate
  );
  if (provisionalClockOuts.length === 1) {
    return reconcileProvisionalClockOut({
      admin,
      point,
      device,
      checkin: provisionalClockOuts[0]!,
      ctx,
      staffName,
      branchName,
      actualClockOutAt: nowIso,
      isTest,
    });
  }
  if (provisionalClockOuts.length > 1) {
    const result = captured(
      "Multiple provisional clock-outs",
      "The QR scan was preserved, but a manager must choose which provisional Attendance record to reconcile.",
      {
        reasonCode: "conflicting_provisional_clock_outs",
        securityNote: "No Attendance row was changed.",
      }
    );
    const committed = await commitAttendanceScanTransaction(admin, {
      event: {
        branchId: point.branch_id,
        qrPointId: point.id,
        staffId: device.staff_id,
        deviceId: device.id,
        scanType: "attendance",
        action: "scan_captured",
        outcome: "exception",
        reasonCode: "conflicting_provisional_clock_outs",
        message: "Multiple provisional clock-outs require manager review.",
        requestId: ctx.requestId,
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
        metadata: { checkinIds: provisionalClockOuts.map((row) => row.id), ...testMetadata },
        isTest,
      },
      result,
      exception: {
        exceptionType: "conflicting_open_checkin",
        severity: "critical",
        message: `${staffName} has multiple provisional clock-outs awaiting confirmation.`,
        metadata: { checkinIds: provisionalClockOuts.map((row) => row.id), ...testMetadata },
        recommendedAction: "review_clock_out",
        priority: "high",
      },
      deviceScanType: "attendance",
    });
    return committed.result;
  }
  if (outsideBusinessDateProvisionalClockOuts.length > 0) {
    const checkin = outsideBusinessDateProvisionalClockOuts[0]!;
    const result = captured(
      "Previous provisional clock-out requires review",
      "The QR scan was preserved, but it is outside that Attendance business day and was not applied automatically.",
      {
        reasonCode: "provisional_clock_out_outside_business_day",
        securityNote: "No Attendance row was changed and no new clock-in was created.",
      }
    );
    const committed = await commitAttendanceScanTransaction(admin, {
      event: {
        branchId: point.branch_id,
        qrPointId: point.id,
        staffId: device.staff_id,
        deviceId: device.id,
        checkinId: checkin.id,
        scanType: "attendance",
        action: "scan_captured",
        outcome: "exception",
        reasonCode: "provisional_clock_out_outside_business_day",
        message: "Provisional clock-out belongs to a different Attendance business day.",
        requestId: ctx.requestId,
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
        metadata: {
          checkinIds: outsideBusinessDateProvisionalClockOuts.map((row) => row.id),
          currentBusinessDate: branchNow.businessDate,
          ...testMetadata,
        },
        isTest,
      },
      result,
      checkinId: checkin.id,
      exception: {
        exceptionType: "stale_open_checkin",
        severity: "warning",
        message: `${staffName}'s real QR scan arrived outside the provisional Attendance business day.`,
        metadata: {
          checkinIds: outsideBusinessDateProvisionalClockOuts.map((row) => row.id),
          currentBusinessDate: branchNow.businessDate,
          ...testMetadata,
        },
        recommendedAction: "review_clock_out",
        priority: "high",
      },
      deviceScanType: "attendance",
    });
    return committed.result;
  }

  if (scanIntent.requiresRecovery && !scanIntent.shouldWriteAttendance) {
    return recordAttendanceRecoveryIntent({
      admin,
      point,
      device,
      ctx,
      staffName,
      staffNickname,
      intent: scanIntent,
      scannedAt: nowIso,
      branchLocalTime: branchNow.time,
      branchTimezone: branchNow.timezone,
      businessDate: branchNow.businessDate,
      isTest,
      testMetadata,
    });
  }

  const existingForShiftQuery = admin
    .from("staff_shift_checkins")
    .select("id, status")
    .eq("staff_id", device.staff_id)
    .eq("branch_id", point.branch_id)
    .eq("is_test", isTest)
    .neq("status", "voided")
    .limit(1);
  const existingForShift = await (
    shiftInstance.key
      ? existingForShiftQuery.eq("shift_instance_key", shiftInstance.key)
      : existingForShiftQuery
          .eq("shift_date", attendanceSchedule.shiftDate)
          .eq("shift_type", attendanceSchedule.shiftType)
  ).maybeSingle();

  if (existingForShift.error) {
    throwAttendanceDataError({
      error: existingForShift.error,
      fallback: "ATTENDANCE_TRANSACTION_FAILED",
      stage: "existing_for_shift_lookup",
      operationId: ctx.requestId,
    });
  }

  if (existingForShift.data?.status === "checked_in") {
    const result = success("Already clocked in", "Attendance is already open for this scheduled shift.", {
      outcome: "noop",
      reasonCode: "already_checked_in",
      securityNote: "No new attendance record was created.",
    });
    const committed = await commitAttendanceScanTransaction(admin, {
      event: {
        branchId: point.branch_id,
        qrPointId: point.id,
        staffId: device.staff_id,
        deviceId: device.id,
        scanType: "attendance",
        action: "duplicate_scan",
        outcome: "noop",
        reasonCode: "already_checked_in",
        message: "Staff is already checked in for this shift.",
        requestId: ctx.requestId,
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
        metadata: { schedule: attendanceSchedule, shiftInstance, ...testMetadata },
        isTest,
      },
      result,
      deviceScanType: "attendance",
    });
    return committed.result;
  }

  if (existingForShift.data?.status === "checked_out") {
    const result = captured("Scan captured", "This shift is already closed. The new scan was preserved for manager review.", {
      reasonCode: "already_checked_out",
      securityNote: "The completed attendance record was not changed.",
    });
    const committed = await commitAttendanceScanTransaction(admin, {
      event: {
        branchId: point.branch_id,
        qrPointId: point.id,
        staffId: device.staff_id,
        deviceId: device.id,
        scanType: "attendance",
        action: "scan_captured",
        outcome: "exception",
        reasonCode: "already_checked_out",
        message: "A completed shift received another scan.",
        requestId: ctx.requestId,
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
        metadata: { shiftInstance, ...testMetadata },
        isTest,
      },
      result,
      exception: {
        exceptionType: "already_checked_out",
        message: `${staffName} scanned again after this attendance shift was closed.`,
        metadata: { shiftInstance, ...testMetadata },
        recommendedAction: "review_scan",
      },
      deviceScanType: "attendance",
    });
    return committed.result;
  }

  const metrics = computeAttendanceMetrics({
    checkedInAt: nowIso,
    checkedOutAt: nowIso,
    scheduledStartAt: attendanceSchedule.scheduledStartAt,
    scheduledEndAt: attendanceSchedule.scheduledEndAt,
    lateGraceMinutes: settings.late_grace_minutes,
    earlyLeaveGraceMinutes: settings.early_leave_threshold_minutes,
  });

  const needsClockInRecovery = scanIntent.requiresRecovery || scanIntent.type !== "clock_in" || metrics.lateMinutes > 0;
  const greeting = buildAttendanceGreeting({
    staffId: device.staff_id,
    nickname: staffNickname,
    fullName: staffName,
    branchLocalTime: branchNow.time,
    action: "clock_in",
    reasonCode: scanIntent.reasonCode,
    requestId: ctx.requestId,
    businessDate: branchNow.businessDate,
  });
  const result = success(greeting.title, greeting.message, {
    reasonCode: scanIntent.reasonCode,
    severity: needsClockInRecovery ? "warning" : "success",
    reviewLabel: attendanceReviewLabel(scanIntent.reasonCode, needsClockInRecovery),
    securityNote: "This device is recognized and ready for future scans.",
    attendance: {
      action: "clock_in",
      staffName,
      branchName,
      branchTimezone: settings.timezone,
      shiftLabel: attendanceSchedule.shiftType,
      occurredAt: nowIso,
      sessionStartedAt: nowIso,
    },
  });

  const exceptionMessage = scanIntent.type === "off_day_exception"
    ? `${staffName} clocked in on a scheduled off day.`
    : scanIntent.type === "schedule_state_unsupported"
      ? `${staffName} clocked in while the schedule configuration was conflicting.`
      : attendanceSchedule.isUnscheduled
        ? `${staffName} clocked in without a resolved schedule.`
    : scanIntent.type === "early_clock_in"
      ? `${staffName} clocked in before the scheduled start window.`
      : scanIntent.type === "late_clock_in"
        ? `${staffName} clocked in ${formatMinutesCompact(metrics.lateMinutes)} late.`
        : `${staffName} clock-in needs review.`;

  const committed = await commitAttendanceScanTransaction(admin, {
    event: {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      scanType: "attendance",
      action: "clock_in",
      outcome: "success",
      reasonCode: scanIntent.reasonCode,
      message: "Clock-in recorded.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      metadata: {
        intent: scanIntent.type,
        schedule: attendanceSchedule,
        shiftInstance,
        lateMinutes: metrics.lateMinutes,
        scannedAt: nowIso,
        branchTimezone: branchNow.timezone,
        attendanceBusinessDate: branchNow.businessDate,
        requestId: ctx.requestId ?? null,
        staffId: device.staff_id,
        branchId: point.branch_id,
        ...testMetadata,
      },
      isTest,
    },
    result,
    checkinInsert: {
      shift_date: attendanceSchedule.shiftDate,
      shift_type: attendanceSchedule.shiftType,
      shift_instance_key: shiftInstance.key,
      checked_in_at: nowIso,
      status: "checked_in",
      clock_in_method: "qr",
      scheduled_start_at: attendanceSchedule.scheduledStartAt,
      scheduled_end_at: attendanceSchedule.scheduledEndAt,
      schedule_source: shiftInstance.sourceType,
      schedule_source_id: shiftInstance.sourceId,
      branch_timezone: shiftInstance.branchTimezone,
      attendance_business_date: shiftInstance.attendanceBusinessDate,
      late_minutes: metrics.lateMinutes,
      attendance_status: metrics.attendanceStatus,
      exception_state: needsClockInRecovery ? "open" : "none",
      is_test: isTest,
    },
    exception: needsClockInRecovery
      ? {
          exceptionType: scanIntent.type,
          message: exceptionMessage,
          metadata: {
            intent: scanIntent.type,
            schedule: attendanceSchedule,
            shiftInstance,
            lateMinutes: metrics.lateMinutes,
            scannedAt: nowIso,
            branchTimezone: branchNow.timezone,
            attendanceBusinessDate: branchNow.businessDate,
            requestId: ctx.requestId ?? null,
            staffId: device.staff_id,
            branchId: point.branch_id,
            ...testMetadata,
          },
        }
      : null,
    deviceScanType: "attendance",
  });

  return committed.result;
}

function timeDistanceFromNow(startTime: string, nowMinutes: number): number {
  const [hh = "0", mm = "0"] = startTime.slice(0, 5).split(":");
  return Math.abs(Number(hh) * 60 + Number(mm) - nowMinutes);
}

async function findEligibleBooking(admin: AttendanceDb, params: {
  branchId: string;
  staffId: string;
  date: string;
  nowMinutes: number;
}): Promise<BookingRow | null> {
  const { data, error } = await admin
    .from("bookings")
    .select("id, branch_id, staff_id, booking_date, start_time, end_time, status, booking_progress_status, resource_id, session_started_at, session_due_at, session_completed_at, session_duration_minutes_snapshot, customers(full_name), services(name, duration_minutes), branch_resources!bookings_resource_id_fkey(name)")
    .eq("branch_id", params.branchId)
    .eq("staff_id", params.staffId)
    .eq("booking_date", params.date)
    .eq("delivery_type", "in_spa")
    .not("status", "in", '("cancelled","completed","no_show")')
    .in("booking_progress_status", ["not_started", "checked_in", "session_started"])
    .order("start_time");

  if (error) {
    throwAttendanceDataError({
      error,
      fallback: "ATTENDANCE_TRANSACTION_FAILED",
      stage: "find_eligible_booking",
    });
  }

  const candidates = ((data as unknown as BookingRow[] | null) ?? []).filter((booking) => {
    const [startHour = "0", startMinute = "0"] = booking.start_time.slice(0, 5).split(":");
    const [endHour = "0", endMinute = "0"] = booking.end_time.slice(0, 5).split(":");
    const start = Number(startHour) * 60 + Number(startMinute);
    const end = Number(endHour) * 60 + Number(endMinute);
    return start <= params.nowMinutes + 90 && end >= params.nowMinutes - 45;
  });

  return candidates.sort((a, b) => timeDistanceFromNow(a.start_time, params.nowMinutes) - timeDistanceFromNow(b.start_time, params.nowMinutes))[0] ?? null;
}

async function processRoomScan(admin: AttendanceDb, point: QrPointRow, device: StaffDeviceRow, ctx: ScanRequestContext): Promise<PublicScanResult> {
  const settings = await getAttendanceSettings(point.branch_id);
  const isTest = settings.test_mode_enabled;
  const testMetadata = testModeMetadata(settings);
  const staff = first(device.staff);
  const staffName = staff?.full_name ?? "Staff member";
  const resource = first(point.branch_resources);
  const resourceName = resource?.name ?? point.label;

  if (!point.resource_id) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      scanType: "room",
      action: "start_session",
      outcome: "blocked",
      reasonCode: "missing_resource",
      message: "QR point is not linked to a resource.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      metadata: testMetadata,
      isTest,
    });
    return blocked("Room unavailable", "This QR is not linked to an active room.", {
      reasonCode: "missing_resource",
      scanEventId: eventId ?? undefined,
    });
  }

  const activeCheckin = await getActiveCheckin(admin, {
    staffId: device.staff_id,
    branchId: point.branch_id,
    isTest,
  });

  if (!activeCheckin) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      resourceId: point.resource_id,
      scanType: "room",
      action: "start_session",
      outcome: "blocked",
      reasonCode: "not_clocked_in",
      message: "Staff must be clocked in before starting a room session.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      metadata: testMetadata,
      isTest,
    });
    return blocked("Clock in first", "Clock in at the attendance QR before starting a service session.", {
      reasonCode: "not_clocked_in",
      scanEventId: eventId ?? undefined,
    });
  }

  if (isTest) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      resourceId: point.resource_id,
      scanType: "room",
      action: "start_session",
      outcome: "blocked",
      reasonCode: "test_mode_protects_real_bookings",
      message: "Test Mode is enabled. Real booking countdowns are protected.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      metadata: testMetadata,
      isTest,
    });

    await markDeviceScanSuccess(admin, {
      deviceId: device.id,
      scanType: "service",
    });

    return blocked("Test Mode protects bookings", "Test Mode is enabled. Real booking countdowns are protected.", {
      reasonCode: "test_mode_protects_real_bookings",
      securityNote: "Use a live scan only after Test / Training Mode is disabled.",
      scanEventId: eventId ?? undefined,
    });
  }

  const activeService = await hasActiveService(admin, {
    staffId: device.staff_id,
    branchId: point.branch_id,
  });

  if (activeService) {
    const countdown = buildCountdown(activeService, resourceName);
    const sameResource = activeService.resource_id === point.resource_id;
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      bookingId: activeService.id,
      resourceId: point.resource_id,
      scanType: "room",
      action: sameResource ? "reopen_session" : "start_session",
      outcome: sameResource ? "success" : "blocked",
      reasonCode: sameResource ? null : "active_service",
      message: sameResource ? "Active session reopened." : "A different service session is already active.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      isTest,
    });

    if (sameResource) {
      await markDeviceScanSuccess(admin, {
        deviceId: device.id,
        scanType: "service",
      });
      return success("Session active", "The service countdown is already running.", {
        reasonCode: "session_active",
        scanEventId: eventId ?? undefined,
        countdown,
      });
    }

    await recordException(admin, {
      branchId: point.branch_id,
      staffId: device.staff_id,
      scanEventId: eventId,
      exceptionType: "active_service",
      severity: "critical",
      message: `${staffName} scanned ${resourceName} while another service was active.`,
      metadata: { activeBookingId: activeService.id },
      isTest,
    });
    return blocked("Session already active", "Complete the current service before starting another room.", {
      reasonCode: "active_service",
      securityNote: "Finish the active service before scanning a different room.",
      countdown,
      scanEventId: eventId ?? undefined,
    });
  }

  if (await findRecentDuplicate(admin, {
    pointId: point.id,
    deviceId: device.id,
    seconds: settings.duplicate_scan_window_seconds,
    isTest,
  })) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      resourceId: point.resource_id,
      scanType: "room",
      action: "duplicate_scan",
      outcome: "noop",
      reasonCode: "duplicate_scan",
      message: "Duplicate room scan ignored.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      metadata: testMetadata,
      isTest,
    });
    return success("Already recorded", "A recent room scan was already accepted.", {
      outcome: "noop",
      reasonCode: "duplicate_scan",
      securityNote: "No new service session was created.",
      scanEventId: eventId ?? undefined,
    });
  }

  const occupied = await admin
    .from("bookings")
    .select("id, staff_id")
    .eq("branch_id", point.branch_id)
    .eq("resource_id", point.resource_id)
    .eq("status", "in_progress")
    .eq("booking_progress_status", "session_started")
    .is("session_completed_at", null)
    .limit(1)
    .maybeSingle();

  if (occupied.error) {
    throwAttendanceDataError({
      error: occupied.error,
      fallback: "ATTENDANCE_TRANSACTION_FAILED",
      stage: "room_occupied_lookup",
      operationId: ctx.requestId,
    });
  }

  if (occupied.data) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      bookingId: occupied.data.id,
      resourceId: point.resource_id,
      scanType: "room",
      action: "start_session",
      outcome: "blocked",
      reasonCode: "resource_conflict",
      message: "Room is already occupied by an active session.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      isTest,
    });
    await recordException(admin, {
      branchId: point.branch_id,
      staffId: device.staff_id,
      scanEventId: eventId,
      exceptionType: "resource_conflict",
      severity: "critical",
      message: `${staffName} scanned occupied room ${resourceName}.`,
      metadata: { occupiedBookingId: occupied.data.id },
      isTest,
    });
    return blocked("Room in use", `${resourceName} already has an active service session.`, {
      reasonCode: "resource_conflict",
      scanEventId: eventId ?? undefined,
    });
  }

  const branchNow = getAttendanceBranchNow(settings);
  const booking = await findEligibleBooking(admin, {
    branchId: point.branch_id,
    staffId: device.staff_id,
    date: branchNow.localDate,
    nowMinutes: branchNow.minutesIntoDay,
  });

  if (!booking) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      resourceId: point.resource_id,
      scanType: "room",
      action: "start_session",
      outcome: "blocked",
      reasonCode: "no_eligible_booking",
      message: "No eligible in-spa booking found for this staff member.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      isTest,
    });
    return blocked("No booking found", "No current in-spa booking is ready for this room scan.", {
      reasonCode: "no_eligible_booking",
      scanEventId: eventId ?? undefined,
    });
  }

  if (booking.resource_id && booking.resource_id !== point.resource_id) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      bookingId: booking.id,
      resourceId: point.resource_id,
      scanType: "room",
      action: "start_session",
      outcome: "blocked",
      reasonCode: "resource_conflict",
      message: "Booking already has a different room assigned.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      isTest,
    });
    await recordException(admin, {
      branchId: point.branch_id,
      staffId: device.staff_id,
      scanEventId: eventId,
      exceptionType: "resource_conflict",
      message: `${staffName} scanned ${resourceName}, but the booking has another room assigned.`,
      metadata: { bookingId: booking.id, assignedResourceId: booking.resource_id },
      isTest,
    });
    return blocked("Different room assigned", "This booking is already assigned to another room.", {
      reasonCode: "resource_conflict",
      scanEventId: eventId ?? undefined,
    });
  }

  const service = first(booking.services);
  const durationMinutes = service?.duration_minutes ?? 60;
  const startedAt = new Date().toISOString();
  const dueAt = new Date(Date.now() + durationMinutes * 60000).toISOString();
  const update = await admin
    .from("bookings")
    .update({
      resource_id: booking.resource_id ?? point.resource_id,
      status: "in_progress",
      booking_progress_status: "session_started",
      session_started_at: startedAt,
      session_duration_minutes_snapshot: durationMinutes,
      session_due_at: dueAt,
      session_started_from_resource_id: point.resource_id,
      session_completion_source: null,
      updated_at: startedAt,
    })
    .eq("id", booking.id)
    .eq("branch_id", point.branch_id)
    .in("booking_progress_status", ["not_started", "checked_in"])
    .select("id, branch_id, staff_id, booking_date, start_time, end_time, status, booking_progress_status, resource_id, session_started_at, session_due_at, session_completed_at, session_duration_minutes_snapshot, customers(full_name), services(name, duration_minutes), branch_resources!bookings_resource_id_fkey(name)")
    .maybeSingle();

  if (update.error || !update.data) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      bookingId: booking.id,
      resourceId: point.resource_id,
      scanType: "room",
      action: "start_session",
      outcome: "error",
      reasonCode: "db_error",
      message: update.error?.message ?? "Booking could not be updated.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      isTest,
    });
    return blocked("Session start failed", "The booking could not be moved into session.", {
      outcome: "error",
      reasonCode: "db_error",
      scanEventId: eventId ?? undefined,
    });
  }

  const updatedBooking = update.data as unknown as BookingRow;
  const eventId = await recordScanEvent(admin, {
    branchId: point.branch_id,
    qrPointId: point.id,
    staffId: device.staff_id,
    deviceId: device.id,
    bookingId: booking.id,
    resourceId: point.resource_id,
    scanType: "room",
    action: "start_session",
    outcome: "success",
    message: "Service session started from room QR.",
    requestId: ctx.requestId,
    userAgent: ctx.userAgent,
    ipAddress: ctx.ipAddress,
    metadata: { durationMinutes, dueAt },
    isTest,
  });

  if (eventId) {
    await admin
      .from("bookings")
      .update({ session_start_scan_event_id: eventId })
      .eq("id", booking.id);
  }
  await markDeviceScanSuccess(admin, {
    deviceId: device.id,
    scanType: "service",
    scannedAt: startedAt,
  });

  return success("Session started", `${resourceName} session started for ${durationMinutes} minutes.`, {
    reasonCode: "session_started",
    scanEventId: eventId ?? undefined,
    countdown: buildCountdown(updatedBooking, resourceName),
  });
}

async function processQrScanFresh(
  admin: AttendanceDb,
  publicCode: string,
  ctx: ScanRequestContext
): Promise<PublicScanResult> {
  const point = await loadQrPoint(admin, publicCode);

  if (!point || !point.is_active) {
    const eventId = await recordScanEvent(admin, {
      scanType: "unknown",
      action: "scan",
      outcome: "blocked",
      reasonCode: "invalid_qr",
      message: "Unknown or inactive QR code.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      metadata: { publicCode: maskId(publicCode) },
    });
    return blocked("QR not recognized", "This QR code is not active in CradleHub.", {
      reasonCode: "invalid_qr",
      securityNote: "No attendance change was recorded from this scan.",
      scanEventId: eventId ?? undefined,
    });
  }

  const pointSettings = await getAttendanceSettings(point.branch_id);
  const isTest = pointSettings.test_mode_enabled;
  const testMetadata = testModeMetadata(pointSettings);
  const device = await resolveDevice(admin, ctx.rawDeviceCredential);
  if (!device) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      scanType: point.point_type === "attendance" ? "attendance" : "room",
      action: "scan",
      outcome: "blocked",
      reasonCode: "unknown_device",
      message: "No registered device cookie was found.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      metadata: testMetadata,
      isTest,
    });
    await recordException(admin, {
      branchId: point.branch_id,
      scanEventId: eventId,
      exceptionType: "unknown_device",
      message: `An unregistered device scanned ${point.label}.`,
      metadata: testMetadata,
      isTest,
    });
    return blocked("Sign in", "Use your staff account to continue.", {
      reasonCode: "unknown_device",
      securityNote: "This phone will be remembered for faster attendance scans.",
      scanEventId: eventId ?? undefined,
    });
  }

  const deviceStaff = first(device.staff);

  if (device.status !== "active" || !deviceStaff || !isOperationalStaff(deviceStaff)) {
    const reasonCode = device.status !== "active" ? "revoked_device" : "staff_inactive";
    const reasonMessage = reasonCode === "revoked_device"
      ? "The registered device is revoked or security-blocked."
      : "The linked staff profile is inactive, archived, or merged.";
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      scanType: point.point_type === "attendance" ? "attendance" : "room",
      action: "scan",
      outcome: "blocked",
      reasonCode,
      message: reasonMessage,
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      metadata: testMetadata,
      isTest,
    });
    await recordException(admin, {
      branchId: point.branch_id,
      staffId: device.staff_id,
      scanEventId: eventId,
      exceptionType: reasonCode,
      severity: "critical",
      message: `${reasonMessage} It scanned ${point.label}.`,
      metadata: testMetadata,
      isTest,
    });
    return blocked(reasonCode === "revoked_device" ? "Device blocked" : "Staff profile inactive", reasonMessage, {
      reasonCode,
      severity: "critical",
      securityNote: "This phone cannot be used for attendance until access is restored.",
      scanEventId: eventId ?? undefined,
    });
  }

  const attendanceBranchNow = getAttendanceBranchNow(pointSettings);
  const effectiveAttendanceBranch = point.point_type === "attendance"
    ? await resolveEffectiveAttendanceBranch(admin, {
        staffId: device.staff_id,
        qrBranchId: point.branch_id,
        attendanceDate: attendanceBranchNow.businessDate,
      })
    : null;
  const branchDecision = point.point_type === "attendance"
    ? effectiveAttendanceBranch?.allowed ? "allowed" : "wrong_branch"
    : getAttendanceDeviceBranchDecision({
        qrBranchId: point.branch_id,
        staffBranchId: deviceStaff.branch_id,
        deviceBranchId: device.branch_id,
        staffIsActive: deviceStaff.is_active,
        isCrossBranch: deviceStaff.is_cross_branch,
      });

  if (branchDecision === "wrong_branch") {
    const pendingRequest = await loadPendingBranchCorrectionRequest(admin, device.staff_id, point.branch_id);
    const staffBranchName = first(deviceStaff.branches)?.name ?? null;
    const metadata = {
      ...wrongBranchMetadata({
        point,
        staffId: device.staff_id,
        staffName: deviceStaff.full_name,
        staffBranchId: deviceStaff.branch_id,
        staffBranchName,
        deviceId: device.id,
        deviceBranchId: device.branch_id,
        pendingRequestId: pendingRequest?.id,
      }),
      ...testMetadata,
    };
    const result = captured("Branch needs review", "This attendance scan is for a branch that is not currently assigned to your profile.", {
      reasonCode: "wrong_branch",
      securityNote: "The scan was preserved. A manager can allow this branch for today or correct the permanent branch.",
      branchCorrection: branchCorrectionDetails({
        staffId: device.staff_id,
        staffName: deviceStaff.full_name,
        currentBranchId: deviceStaff.branch_id,
        currentBranchName: staffBranchName,
        point,
        scanEventId: null,
        deviceId: device.id,
        pendingRequest,
      }),
    });
    if (point.point_type === "attendance") {
      const committed = await commitAttendanceScanTransaction(admin, {
        event: {
          branchId: point.branch_id,
          qrPointId: point.id,
          staffId: device.staff_id,
          deviceId: device.id,
          scanType: "attendance",
          action: "scan_captured",
          outcome: "exception",
          reasonCode: "wrong_branch",
          message: "Attendance branch assignment requires review.",
          requestId: ctx.requestId,
          userAgent: ctx.userAgent,
          ipAddress: ctx.ipAddress,
          metadata: { ...metadata, effectiveBranchSource: effectiveAttendanceBranch?.source ?? "review" },
          isTest,
        },
        result,
        exception: {
          exceptionType: "wrong_branch",
          severity: "warning",
          message: `${deviceStaff.full_name ?? "Staff member"} scanned attendance for an unassigned branch.`,
          metadata: { ...metadata, attendanceDate: attendanceBranchNow.businessDate },
          recommendedAction: "review_branch_assignment",
          priority: "high",
        },
        deviceScanType: "attendance",
      });
      return committed.result;
    }
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      scanType: "room",
      action: "scan",
      outcome: "blocked",
      reasonCode: "wrong_branch",
      message: "Registered staff belongs to a different branch.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      metadata,
      isTest,
    });
    return { ...result, ok: false, outcome: "blocked", scanEventId: eventId ?? undefined };
  }

  if (branchDecision === "sync_device_branch" && point.point_type !== "attendance") {
    const previousDeviceBranchId = device.branch_id;
    await syncDeviceBranchToQrBranch(admin, device, point);
    await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      scanType: "room",
      action: "attendance_device_branch_synchronized",
      outcome: "noop",
      reasonCode: "sync_device_branch",
      message: "Device branch metadata was synchronized before scan processing.",
      requestId: ctx.requestId ? `${ctx.requestId}:device-branch-sync` : null,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      metadata: {
        previousDeviceBranchId,
        nextDeviceBranchId: point.branch_id,
      },
      isTest,
    });
  }

  if (point.point_type === "attendance") {
    return processAttendanceScan(admin, point, device, ctx);
  }

  const seenUpdate = await admin
    .from("staff_devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", device.id);
  if (seenUpdate.error) {
    throwAttendanceDataError({
      error: seenUpdate.error,
      fallback: "ATTENDANCE_WRITE_FAILED",
      stage: "device_last_seen_update",
      operationId: ctx.requestId,
    });
  }

  return processRoomScan(admin, point, device, ctx);
}

export async function processQrScan(publicCode: string, ctx: ScanRequestContext): Promise<PublicScanResult> {
  const admin = asAttendanceDb(createAdminClient());
  const operationId = normalizeAttendanceOperationId(ctx.requestId);
  const scanCtx: ScanRequestContext = { ...ctx, requestId: operationId };
  const replayed = await loadCommittedScanResult(admin, operationId);
  if (replayed) return replayed;

  const result = await processQrScanFresh(admin, publicCode, scanCtx);
  await persistCommittedScanResult({
    admin,
    requestId: operationId,
    result: withOperationId(result, operationId),
  });
  return withOperationId(result, operationId);
}

export async function activateDeviceWithToken(token: string, ctx: ScanRequestContext): Promise<ActivationResult> {
  const admin = asAttendanceDb(createAdminClient());
  const tokenHash = hashSecret(token);
  const { data: activation, error: activationError } = await admin
    .from("device_activation_tokens")
    .select("id, staff_id, branch_id, expires_at, used_at, staff:staff!device_activation_tokens_staff_id_fkey(full_name, is_active)")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (activationError) {
    throw createAttendanceDataError({
      error: activationError,
      fallback: "DEVICE_LINK_INVALID",
      stage: "activate_device_token_lookup",
      operationId: ctx.requestId,
    });
  }

  const activationRow = activation as {
    id: string;
    staff_id: string;
    branch_id: string;
    expires_at: string;
    used_at: string | null;
    staff?: { full_name: string | null; is_active: boolean } | Array<{ full_name: string | null; is_active: boolean }> | null;
  } | null;

  if (!activationRow) {
    const eventId = await recordScanEvent(admin, {
      scanType: "activation",
      action: "activate_device",
      outcome: "blocked",
      reasonCode: "invalid_token",
      message: "Device activation token was not found.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      metadata: { token: maskId(token) },
    });
    return blocked("Activation expired", "Ask the front desk for a new device activation link.", {
      reasonCode: "invalid_token",
      scanEventId: eventId ?? undefined,
    });
  }

  const staff = first(activationRow.staff);
  if (activationRow.used_at || new Date(activationRow.expires_at).getTime() < Date.now() || staff?.is_active === false) {
    const eventId = await recordScanEvent(admin, {
      branchId: activationRow.branch_id,
      staffId: activationRow.staff_id,
      scanType: "activation",
      action: "activate_device",
      outcome: "blocked",
      reasonCode: activationRow.used_at ? "token_used" : "token_expired",
      message: "Device activation token is no longer valid.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });
    return blocked("Activation expired", "Ask the front desk for a new device activation link.", {
      reasonCode: activationRow.used_at ? "token_used" : "token_expired",
      scanEventId: eventId ?? undefined,
    });
  }

  const rawDeviceCredential = createDeviceCredential();
  const deviceHints = inferDeviceClientHints(ctx.userAgent);
  const inserted = await admin
    .from("staff_devices")
    .insert({
      staff_id: activationRow.staff_id,
      branch_id: activationRow.branch_id,
      device_fingerprint_hash: hashSecret(rawDeviceCredential),
      device_label: deviceHints.label,
      status: "active",
      registration_source: "first_scan_activation",
      browser_name: deviceHints.browserName,
      browser_version: deviceHints.browserVersion,
      platform_name: deviceHints.platformName,
      last_seen_at: new Date().toISOString(),
      metadata: {
        activated_from: "first_scan_activation",
        user_agent: ctx.userAgent ?? null,
      },
    })
    .select("id")
    .single();

  if (inserted.error || !inserted.data) {
    const eventId = await recordScanEvent(admin, {
      branchId: activationRow.branch_id,
      staffId: activationRow.staff_id,
      scanType: "activation",
      action: "activate_device",
      outcome: "error",
      reasonCode: "db_error",
      message: inserted.error?.message ?? "Device insert failed.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });
    return blocked("Activation failed", "The device could not be registered.", {
      outcome: "error",
      reasonCode: "db_error",
      scanEventId: eventId ?? undefined,
    });
  }

  const tokenUpdate = await admin
    .from("device_activation_tokens")
    .update({
      used_at: new Date().toISOString(),
      used_by_device_id: inserted.data.id,
    })
    .eq("id", activationRow.id)
    .is("used_at", null);

  if (tokenUpdate.error) {
    throw createAttendanceDataError({
      error: tokenUpdate.error,
      fallback: "ATTENDANCE_WRITE_FAILED",
      stage: "activate_device_token_consume",
      operationId: ctx.requestId,
    });
  }

  const eventId = await recordScanEvent(admin, {
    branchId: activationRow.branch_id,
    staffId: activationRow.staff_id,
    deviceId: inserted.data.id,
    scanType: "activation",
    action: "activate_device",
    outcome: "success",
    message: "Device activated.",
    requestId: ctx.requestId,
    userAgent: ctx.userAgent,
    ipAddress: ctx.ipAddress,
  });

  return {
    ...success("Device activated", `${staff?.full_name ?? "Staff member"} can now use this device for attendance and room scans.`, {
      reasonCode: "device_activated",
      securityNote: "This phone is now trusted for this staff member.",
      scanEventId: eventId ?? undefined,
    }),
    rawDeviceCredential,
  };
}
