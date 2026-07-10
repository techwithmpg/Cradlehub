import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { asAttendanceDb, type AttendanceDb } from "@/lib/attendance/db";
import { computeAttendanceMetrics } from "@/lib/attendance/time";
import { getAttendanceSettings } from "@/lib/attendance/queries";
import type { AttendanceActionContext } from "@/lib/attendance/queries";
import type { AttendanceSettings } from "@/lib/attendance/types";

export type AttendanceCorrectionActionType =
  | "reclassify_scan"
  | "set_manual_clock_in"
  | "set_manual_clock_out"
  | "reset_staff_day"
  | "rebuild_from_scans"
  | "ignore_scan"
  | "apply_launch_recovery"
  | "update_attendance_rules"
  | "revert_correction";

export type ApplyAttendanceCorrectionInput = {
  branchId?: string | null;
  actionType: AttendanceCorrectionActionType;
  exceptionId?: string | null;
  checkinId?: string | null;
  staffId?: string | null;
  attendanceDate?: string | null;
  manualClockInAt?: string | null;
  manualClockOutAt?: string | null;
  reason?: string | null;
};

export type UpdateAttendanceRulesInput = {
  branchId?: string | null;
  settings: Partial<AttendanceSettings>;
  reason?: string | null;
};

type ExceptionRow = {
  id: string;
  branch_id: string;
  staff_id: string | null;
  checkin_id: string | null;
  scan_event_id: string | null;
  exception_type: string;
  status: string;
  message: string;
  metadata: Record<string, unknown>;
};

type ScanEventRow = {
  id: string;
  branch_id: string | null;
  qr_point_id: string | null;
  staff_id: string | null;
  created_at: string;
  action: string;
  outcome: string;
  reason_code: string | null;
  metadata: Record<string, unknown>;
};

type CheckinRow = {
  id: string;
  branch_id: string;
  staff_id: string;
  shift_date: string;
  shift_type: string;
  checked_in_at: string;
  checked_out_at: string | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  status: string;
};

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringFromRecord(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function numberFromRecord(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanFromRecord(record: Record<string, unknown>, key: string): boolean | null {
  const value = record[key];
  return typeof value === "boolean" ? value : null;
}

function scheduleFromException(exception: ExceptionRow): Record<string, unknown> {
  const metadata = safeRecord(exception.metadata);
  return safeRecord(metadata.schedule);
}

async function loadException(admin: AttendanceDb, ctx: AttendanceActionContext, exceptionId: string): Promise<ExceptionRow> {
  const { data, error } = await admin
    .from("attendance_exceptions")
    .select("id, branch_id, staff_id, checkin_id, scan_event_id, exception_type, status, message, metadata")
    .eq("id", exceptionId)
    .eq("branch_id", ctx.branchId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Recovery item was not found.");
  return { ...(data as ExceptionRow), metadata: safeRecord((data as { metadata?: unknown }).metadata) };
}

async function loadScanEvent(admin: AttendanceDb, ctx: AttendanceActionContext, scanEventId: string): Promise<ScanEventRow> {
  const { data, error } = await admin
    .from("qr_scan_events")
    .select("id, branch_id, qr_point_id, staff_id, created_at, action, outcome, reason_code, metadata")
    .eq("id", scanEventId)
    .eq("branch_id", ctx.branchId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("The raw scan event for this recovery item was not found.");
  return { ...(data as ScanEventRow), metadata: safeRecord((data as { metadata?: unknown }).metadata) };
}

async function loadCheckin(admin: AttendanceDb, ctx: AttendanceActionContext, checkinId: string): Promise<CheckinRow> {
  const { data, error } = await admin
    .from("staff_shift_checkins")
    .select("id, branch_id, staff_id, shift_date, shift_type, checked_in_at, checked_out_at, scheduled_start_at, scheduled_end_at, status")
    .eq("id", checkinId)
    .eq("branch_id", ctx.branchId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Attendance record was not found.");
  return data as CheckinRow;
}

async function insertCorrectionAudit(admin: AttendanceDb, params: {
  ctx: AttendanceActionContext;
  actionType: AttendanceCorrectionActionType;
  staffId?: string | null;
  checkinId?: string | null;
  attendanceDate?: string | null;
  scanEventIds?: string[];
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  reason: string;
}) {
  await admin.from("attendance_corrections").insert({
    branch_id: params.ctx.branchId,
    staff_id: params.staffId ?? null,
    checkin_id: params.checkinId ?? null,
    attendance_date: params.attendanceDate ?? null,
    scan_event_ids: params.scanEventIds ?? [],
    correction_type: params.actionType,
    action_type: params.actionType,
    previous_values: params.previousValues ?? {},
    new_values: params.newValues ?? {},
    reason: params.reason,
    status: "applied",
    requested_by: params.ctx.actorStaffId,
    approved_by: params.ctx.actorStaffId,
    corrected_by: params.ctx.actorStaffId,
    applied_at: new Date().toISOString(),
    corrected_at: new Date().toISOString(),
  });
}

async function markExceptionResolved(admin: AttendanceDb, params: {
  exceptionId?: string | null;
  ctx: AttendanceActionContext;
  note: string;
}) {
  if (!params.exceptionId) return;
  await admin
    .from("attendance_exceptions")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: params.ctx.actorStaffId,
      resolution_note: params.note,
    })
    .eq("id", params.exceptionId)
    .eq("branch_id", params.ctx.branchId);
}

async function applyLaunchRecovery(params: {
  admin: AttendanceDb;
  ctx: AttendanceActionContext;
  input: ApplyAttendanceCorrectionInput;
  reason: string;
}): Promise<string> {
  const exceptionId = params.input.exceptionId?.trim();
  if (!exceptionId) throw new Error("Choose a Recovery item before applying launch recovery.");

  const exception = await loadException(params.admin, params.ctx, exceptionId);
  if (!exception.staff_id) throw new Error("This Recovery item is not attached to a staff member.");
  if (!exception.scan_event_id) throw new Error("This Recovery item has no raw scan event to rebuild from.");

  const scanEvent = await loadScanEvent(params.admin, params.ctx, exception.scan_event_id);
  const schedule = scheduleFromException(exception);
  const checkedInAt = stringFromRecord(schedule, "scheduledStartAt");
  const scheduledEndAt = stringFromRecord(schedule, "scheduledEndAt");
  const shiftDate = stringFromRecord(schedule, "shiftDate");
  const shiftType = stringFromRecord(schedule, "shiftType") ?? "single";

  if (!checkedInAt || !shiftDate) {
    throw new Error("This Recovery item does not include enough schedule evidence for one-click launch recovery.");
  }

  const settings = await getAttendanceSettings(params.ctx.branchId);
  const metrics = computeAttendanceMetrics({
    checkedInAt,
    checkedOutAt: scanEvent.created_at,
    scheduledStartAt: checkedInAt,
    scheduledEndAt,
    lateGraceMinutes: settings.late_grace_minutes,
    earlyLeaveGraceMinutes: settings.early_leave_threshold_minutes,
  });

  const existing = await params.admin
    .from("staff_shift_checkins")
    .select("id")
    .eq("staff_id", exception.staff_id)
    .eq("branch_id", params.ctx.branchId)
    .eq("shift_date", shiftDate)
    .eq("shift_type", shiftType)
    .neq("status", "voided")
    .limit(1);

  if ((existing.data?.length ?? 0) > 0) {
    throw new Error("A non-voided attendance record already exists for this staff shift.");
  }

  const inserted = await params.admin
    .from("staff_shift_checkins")
    .insert({
      staff_id: exception.staff_id,
      branch_id: params.ctx.branchId,
      shift_date: shiftDate,
      shift_type: shiftType,
      checked_in_at: checkedInAt,
      checked_out_at: scanEvent.created_at,
      status: "checked_out",
      source_qr_point_id: scanEvent.qr_point_id,
      clock_in_method: "recovery",
      clock_out_method: "qr_recovery",
      clock_out_scan_event_id: scanEvent.id,
      scheduled_start_at: checkedInAt,
      scheduled_end_at: scheduledEndAt,
      worked_minutes: metrics.workedMinutes,
      late_minutes: metrics.lateMinutes,
      early_leave_minutes: metrics.earlyLeaveMinutes,
      overtime_minutes: metrics.overtimeMinutes,
      attendance_status: metrics.attendanceStatus,
      exception_state: "none",
      recorded_by: params.ctx.actorStaffId,
    })
    .select("id")
    .maybeSingle();

  if (inserted.error || !inserted.data) {
    throw new Error(inserted.error?.message ?? "Attendance recovery record could not be created.");
  }

  await markExceptionResolved(params.admin, {
    exceptionId,
    ctx: params.ctx,
    note: params.reason,
  });

  await insertCorrectionAudit(params.admin, {
    ctx: params.ctx,
    actionType: "apply_launch_recovery",
    staffId: exception.staff_id,
    checkinId: inserted.data.id as string,
    attendanceDate: shiftDate,
    scanEventIds: [scanEvent.id],
    previousValues: {
      exception,
      scanEvent: {
        id: scanEvent.id,
        action: scanEvent.action,
        outcome: scanEvent.outcome,
        reasonCode: scanEvent.reason_code,
        createdAt: scanEvent.created_at,
      },
    },
    newValues: {
      checkinId: inserted.data.id,
      checkedInAt,
      checkedOutAt: scanEvent.created_at,
      shiftDate,
      shiftType,
      metrics,
    },
    reason: params.reason,
  });

  return "Launch recovery applied.";
}

async function setManualClockOut(params: {
  admin: AttendanceDb;
  ctx: AttendanceActionContext;
  input: ApplyAttendanceCorrectionInput;
  reason: string;
}): Promise<string> {
  const checkinId = params.input.checkinId?.trim();
  if (!checkinId) throw new Error("Choose an attendance record before setting a manual clock-out.");
  const checkin = await loadCheckin(params.admin, params.ctx, checkinId);
  const checkedOutAt = params.input.manualClockOutAt?.trim() || new Date().toISOString();
  const settings = await getAttendanceSettings(params.ctx.branchId);
  const metrics = computeAttendanceMetrics({
    checkedInAt: checkin.checked_in_at,
    checkedOutAt,
    scheduledStartAt: checkin.scheduled_start_at,
    scheduledEndAt: checkin.scheduled_end_at,
    lateGraceMinutes: settings.late_grace_minutes,
    earlyLeaveGraceMinutes: settings.early_leave_threshold_minutes,
  });

  const { error } = await params.admin
    .from("staff_shift_checkins")
    .update({
      checked_out_at: checkedOutAt,
      status: "checked_out",
      clock_out_method: "manual_recovery",
      worked_minutes: metrics.workedMinutes,
      late_minutes: metrics.lateMinutes,
      early_leave_minutes: metrics.earlyLeaveMinutes,
      overtime_minutes: metrics.overtimeMinutes,
      attendance_status: metrics.attendanceStatus,
      exception_state: metrics.exceptionState,
    })
    .eq("id", checkin.id)
    .eq("branch_id", params.ctx.branchId);

  if (error) throw new Error(error.message);

  await insertCorrectionAudit(params.admin, {
    ctx: params.ctx,
    actionType: "set_manual_clock_out",
    staffId: checkin.staff_id,
    checkinId: checkin.id,
    attendanceDate: checkin.shift_date,
    previousValues: { checkin },
    newValues: { checkedOutAt, metrics },
    reason: params.reason,
  });

  return "Manual clock-out applied.";
}

async function resetStaffDay(params: {
  admin: AttendanceDb;
  ctx: AttendanceActionContext;
  input: ApplyAttendanceCorrectionInput;
  reason: string;
}): Promise<string> {
  const staffId = params.input.staffId?.trim();
  const attendanceDate = params.input.attendanceDate?.trim();
  if (!staffId || !attendanceDate) throw new Error("Choose a staff member and date before resetting attendance.");

  const previous = await params.admin
    .from("staff_shift_checkins")
    .select("*")
    .eq("branch_id", params.ctx.branchId)
    .eq("staff_id", staffId)
    .eq("shift_date", attendanceDate)
    .neq("status", "voided");

  const { error } = await params.admin
    .from("staff_shift_checkins")
    .update({
      status: "voided",
      exception_state: "open",
      notes: params.reason,
    })
    .eq("branch_id", params.ctx.branchId)
    .eq("staff_id", staffId)
    .eq("shift_date", attendanceDate)
    .neq("status", "voided");

  if (error) throw new Error(error.message);

  await insertCorrectionAudit(params.admin, {
    ctx: params.ctx,
    actionType: "reset_staff_day",
    staffId,
    attendanceDate,
    previousValues: { records: previous.data ?? [] },
    newValues: { status: "voided" },
    reason: params.reason,
  });

  return "Staff day reset.";
}

async function ignoreScan(params: {
  admin: AttendanceDb;
  ctx: AttendanceActionContext;
  input: ApplyAttendanceCorrectionInput;
  reason: string;
}): Promise<string> {
  await markExceptionResolved(params.admin, {
    exceptionId: params.input.exceptionId,
    ctx: params.ctx,
    note: params.reason,
  });

  await insertCorrectionAudit(params.admin, {
    ctx: params.ctx,
    actionType: "ignore_scan",
    staffId: params.input.staffId ?? null,
    checkinId: params.input.checkinId ?? null,
    attendanceDate: params.input.attendanceDate ?? null,
    previousValues: { exceptionId: params.input.exceptionId ?? null },
    newValues: { ignored: true },
    reason: params.reason,
  });

  return "Scan marked reviewed.";
}

export async function applyAttendanceCorrection(params: {
  ctx: AttendanceActionContext;
  input: ApplyAttendanceCorrectionInput;
}): Promise<{ message: string }> {
  const admin = asAttendanceDb(createAdminClient());
  const reason = params.input.reason?.trim() || "Attendance recovery correction.";

  if (params.input.actionType === "apply_launch_recovery") {
    return { message: await applyLaunchRecovery({ admin, ctx: params.ctx, input: params.input, reason }) };
  }
  if (params.input.actionType === "set_manual_clock_out") {
    return { message: await setManualClockOut({ admin, ctx: params.ctx, input: params.input, reason }) };
  }
  if (params.input.actionType === "reset_staff_day") {
    return { message: await resetStaffDay({ admin, ctx: params.ctx, input: params.input, reason }) };
  }
  if (params.input.actionType === "ignore_scan") {
    return { message: await ignoreScan({ admin, ctx: params.ctx, input: params.input, reason }) };
  }

  throw new Error("This correction action is not available yet.");
}

function coerceRules(input: Partial<AttendanceSettings>): Partial<AttendanceSettings> {
  const next: Partial<AttendanceSettings> = {};
  const numberKeys = [
    "early_clock_in_allowed_minutes",
    "late_grace_minutes",
    "clock_in_window_before_shift_minutes",
    "clock_in_window_after_shift_start_minutes",
    "clock_out_window_before_shift_end_minutes",
    "clock_out_window_after_shift_end_minutes",
    "early_leave_threshold_minutes",
    "overtime_threshold_minutes",
    "duplicate_scan_debounce_minutes",
  ] as const;
  const stringKeys = [
    "timezone",
    "attendance_day_boundary",
    "first_scan_closing_behavior",
    "missing_schedule_behavior",
    "off_day_scan_behavior",
    "ambiguous_scan_behavior",
    "launch_recovery_start_date",
    "launch_recovery_end_date",
    "launch_recovery_closing_start_time",
    "launch_recovery_closing_end_time",
    "launch_recovery_reason",
  ] as const;

  for (const key of numberKeys) {
    const value = numberFromRecord(input as Record<string, unknown>, key);
    if (value !== null) next[key] = Math.max(0, Math.round(value)) as never;
  }
  for (const key of stringKeys) {
    if (Object.hasOwn(input, key)) {
      next[key] = stringFromRecord(input as Record<string, unknown>, key) as never;
    }
  }
  const launchRecoveryEnabled = booleanFromRecord(input as Record<string, unknown>, "launch_recovery_enabled");
  if (launchRecoveryEnabled !== null) next.launch_recovery_enabled = launchRecoveryEnabled;

  if (typeof next.duplicate_scan_debounce_minutes === "number") {
    next.duplicate_scan_window_seconds = next.duplicate_scan_debounce_minutes * 60;
  }
  if (typeof next.late_grace_minutes === "number") {
    next.clock_in_late_grace_minutes = next.late_grace_minutes;
  }
  if (typeof next.early_leave_threshold_minutes === "number") {
    next.clock_out_early_grace_minutes = next.early_leave_threshold_minutes;
  }

  return next;
}

export async function updateAttendanceRules(params: {
  ctx: AttendanceActionContext;
  input: UpdateAttendanceRulesInput;
}): Promise<{ settings: AttendanceSettings }> {
  const admin = asAttendanceDb(createAdminClient());
  const previous = await getAttendanceSettings(params.ctx.branchId);
  const rules = coerceRules(params.input.settings);
  const reason = params.input.reason?.trim() || "Attendance rules updated.";

  const { data, error } = await admin
    .from("attendance_settings")
    .update({
      ...rules,
      updated_by: params.ctx.actorStaffId,
    })
    .eq("branch_id", params.ctx.branchId)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);

  await insertCorrectionAudit(admin, {
    ctx: params.ctx,
    actionType: "update_attendance_rules",
    previousValues: previous,
    newValues: { ...previous, ...rules, ...(data ? safeRecord(data) : {}) },
    reason,
  });

  return {
    settings: {
      ...previous,
      ...rules,
      ...(data ? safeRecord(data) : {}),
      branch_id: params.ctx.branchId,
    } as AttendanceSettings,
  };
}
