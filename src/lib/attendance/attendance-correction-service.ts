import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { asAttendanceDb, type AttendanceDb } from "@/lib/attendance/db";
import { computeAttendanceMetrics } from "@/lib/attendance/time";
import { getAttendanceSettings } from "@/lib/attendance/queries";
import type { AttendanceActionContext } from "@/lib/attendance/queries";
import type { AttendanceSettings } from "@/lib/attendance/types";
import type { Json } from "@/types/supabase";

export type AttendanceCorrectionActionType =
  | "reclassify_scan"
  | "set_manual_clock_in"
  | "set_manual_clock_out"
  | "correct_attendance_times"
  | "reset_staff_day"
  | "reset_attendance_state"
  | "rebuild_from_scans"
  | "ignore_scan"
  | "accept_recorded_attendance"
  | "void_duplicate"
  | "mark_accidental_scan"
  | "allow_branch_today"
  | "change_permanent_branch"
  | "apply_launch_recovery"
  | "update_attendance_rules"
  | "archive_test_data"
  | "revert_correction";

function toJson(value: unknown): Json {
  return value as Json;
}

export type ApplyAttendanceCorrectionInput = {
  branchId?: string | null;
  actionType: AttendanceCorrectionActionType;
  exceptionId?: string | null;
  checkinId?: string | null;
  staffId?: string | null;
  attendanceDate?: string | null;
  targetBranchId?: string | null;
  manualClockInAt?: string | null;
  manualClockOutAt?: string | null;
  resetMode?:
    | "next_scan_state"
    | "void_incorrect_attendance"
    | "manual_attendance"
    | "rebuild_from_scans"
    | null;
  confirmVoid?: boolean | null;
  reason?: string | null;
};

export type UpdateAttendanceRulesInput = {
  branchId?: string | null;
  settings: Partial<AttendanceSettings>;
  reason?: string | null;
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
  is_test?: boolean;
};

type ResetAttendanceStateTransactionRow = {
  success?: boolean;
  code?: string | null;
  message?: string | null;
  staff_id?: string | null;
  checkin_id?: string | null;
  attendance_date?: string | null;
  next_expected_action?: string | null;
  resolved_exception_count?: number | null;
  correction_id?: string | null;
};

type ReviewCorrectionTransactionRow = {
  success?: boolean;
  code?: string | null;
  message?: string | null;
  correction_id?: string | null;
};

type CorrectAttendanceTimesTransactionRow = ReviewCorrectionTransactionRow;

async function applyReviewCorrectionTransaction(params: {
  admin: AttendanceDb;
  ctx: AttendanceActionContext;
  action: AttendanceCorrectionActionType;
  reason: string;
  exceptionId?: string | null;
  checkinId?: string | null;
  values?: Record<string, unknown>;
}): Promise<string> {
  if (!params.ctx.actorStaffId)
    throw new Error("A staff actor is required before correcting attendance.");
  const settings = await getAttendanceSettings(params.ctx.branchId);
  const { data, error } = await params.admin
    .rpc("apply_attendance_review_correction", {
      p_branch_id: params.ctx.branchId,
      p_actor_staff_id: params.ctx.actorStaffId,
      p_action: params.action,
      p_reason: requiredReason(params.reason, "applying this review action"),
      p_exception_id: params.exceptionId ?? undefined,
      p_checkin_id: params.checkinId ?? undefined,
      p_values: toJson(params.values ?? {}),
      p_is_test: settings.test_mode_enabled,
    })
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as ReviewCorrectionTransactionRow | null;
  if (!row?.success)
    throw new Error(row?.message ?? "Attendance review correction could not be applied.");
  return row.message ?? "Attendance review correction applied.";
}

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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

function requiredReason(value: string | null | undefined, action: string): string {
  const reason = value?.trim();
  if (!reason) throw new Error(`Enter a reason before ${action}.`);
  return reason;
}

async function loadCheckin(
  admin: AttendanceDb,
  ctx: AttendanceActionContext,
  checkinId: string
): Promise<CheckinRow> {
  const { data, error } = await admin
    .from("staff_shift_checkins")
    .select(
      "id, branch_id, staff_id, shift_date, shift_type, checked_in_at, checked_out_at, scheduled_start_at, scheduled_end_at, status, is_test"
    )
    .eq("id", checkinId)
    .eq("branch_id", ctx.branchId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Attendance record was not found.");
  return data as CheckinRow;
}

async function insertCorrectionAudit(
  admin: AttendanceDb,
  params: {
    ctx: AttendanceActionContext;
    actionType: AttendanceCorrectionActionType;
    staffId?: string | null;
    checkinId?: string | null;
    attendanceDate?: string | null;
    scanEventIds?: string[];
    previousValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    reason: string;
  }
) {
  const settings = await getAttendanceSettings(params.ctx.branchId);
  const { error } = await admin.from("attendance_corrections").insert({
    branch_id: params.ctx.branchId,
    staff_id: params.staffId ?? null,
    checkin_id: params.checkinId ?? null,
    attendance_date: params.attendanceDate ?? null,
    scan_event_ids: params.scanEventIds ?? [],
    correction_type: params.actionType,
    action_type: params.actionType,
    previous_values: toJson(params.previousValues ?? {}),
    new_values: toJson(params.newValues ?? {}),
    reason: params.reason,
    status: "applied",
    requested_by: params.ctx.actorStaffId,
    approved_by: params.ctx.actorStaffId,
    corrected_by: params.ctx.actorStaffId,
    applied_at: new Date().toISOString(),
    corrected_at: new Date().toISOString(),
    is_test: settings.test_mode_enabled,
  });
  if (error) throw new Error(error.message);
}

async function correctAttendanceTimes(params: {
  admin: AttendanceDb;
  ctx: AttendanceActionContext;
  input: ApplyAttendanceCorrectionInput;
  reason: string;
}): Promise<string> {
  const checkinId = params.input.checkinId?.trim();
  if (!checkinId) throw new Error("Choose an attendance record before correcting its times.");
  if (!params.ctx.actorStaffId)
    throw new Error("A staff actor is required before correcting attendance.");
  const checkin = await loadCheckin(params.admin, params.ctx, checkinId);
  const checkedInAt = params.input.manualClockInAt?.trim() || checkin.checked_in_at;
  const checkedOutAt = params.input.manualClockOutAt?.trim() || null;
  if (checkedOutAt && new Date(checkedOutAt).getTime() <= new Date(checkedInAt).getTime()) {
    throw new Error("Clock-out must be after clock-in.");
  }
  const settings = await getAttendanceSettings(params.ctx.branchId);
  const metrics = checkedOutAt
    ? computeAttendanceMetrics({
        checkedInAt,
        checkedOutAt,
        scheduledStartAt: checkin.scheduled_start_at,
        scheduledEndAt: checkin.scheduled_end_at,
        lateGraceMinutes: settings.late_grace_minutes,
        earlyLeaveGraceMinutes: settings.early_leave_threshold_minutes,
      })
    : {
        workedMinutes: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        attendanceStatus: "present",
      };
  const { data, error } = await params.admin
    .rpc(
      "correct_attendance_times_transaction" as never,
      {
        p_branch_id: params.ctx.branchId,
        p_actor_staff_id: params.ctx.actorStaffId,
        p_action: params.input.actionType,
        p_reason: requiredReason(params.reason, "correcting attendance times"),
        p_exception_id: params.input.exceptionId ?? undefined,
        p_checkin_id: checkinId,
        p_checked_in_at: checkedInAt,
        p_checked_out_at: checkedOutAt ?? undefined,
        p_metrics: toJson(metrics),
        p_is_test: settings.test_mode_enabled,
      } as never
    )
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as CorrectAttendanceTimesTransactionRow | null;
  if (!row?.success) throw new Error(row?.message ?? "Attendance times could not be corrected.");
  return row.message ?? "Attendance times corrected.";
}

async function resetAttendanceState(params: {
  admin: AttendanceDb;
  ctx: AttendanceActionContext;
  input: ApplyAttendanceCorrectionInput;
  reason: string;
}): Promise<string> {
  const checkinId = params.input.checkinId?.trim();
  if (!checkinId) throw new Error("Choose one attendance record before resetting state.");
  const reason = requiredReason(params.reason, "resetting attendance state");
  const resetMode = params.input.resetMode ?? "next_scan_state";

  if (resetMode === "rebuild_from_scans" || resetMode === "manual_attendance") {
    throw new Error(
      "Use the dedicated manual or rebuild action after reviewing raw scan evidence."
    );
  }
  if (!params.input.confirmVoid) {
    throw new Error("Confirm that the selected interpreted attendance record should be voided.");
  }
  if (!params.ctx.actorStaffId) {
    throw new Error("A staff actor is required before resetting attendance state.");
  }

  const settings = await getAttendanceSettings(params.ctx.branchId);
  const { data, error } = await params.admin
    .rpc("reset_attendance_state_transaction", {
      p_branch_id: params.ctx.branchId,
      p_checkin_id: checkinId,
      p_actor_staff_id: params.ctx.actorStaffId,
      p_reason: reason,
      p_reset_mode: resetMode,
      p_is_test: settings.test_mode_enabled,
    })
    .maybeSingle();

  if (error) throw new Error(error.message);
  const row = data as ResetAttendanceStateTransactionRow | null;
  if (!row?.success) {
    throw new Error(row?.message ?? "Attendance record was already reset or could not be updated.");
  }

  const nextAction =
    row.next_expected_action === "clock_out"
      ? "Clock Out"
      : row.next_expected_action === "clock_in"
        ? "Clock In"
        : "Recovery Required";

  return `Attendance state reset. Next expected action: ${nextAction}.`;
}

async function ignoreScan(params: {
  admin: AttendanceDb;
  ctx: AttendanceActionContext;
  input: ApplyAttendanceCorrectionInput;
  reason: string;
}): Promise<string> {
  return applyReviewCorrectionTransaction({
    admin: params.admin,
    ctx: params.ctx,
    action: "ignore_scan",
    reason: params.reason,
    exceptionId: params.input.exceptionId,
    checkinId: params.input.checkinId,
    values: { ignored: true },
  });
}

async function archiveTestData(params: {
  admin: AttendanceDb;
  ctx: AttendanceActionContext;
  reason: string;
}): Promise<string> {
  if (!params.reason.trim()) {
    throw new Error("Enter a reason before archiving Test Mode data.");
  }

  const [checkinsBefore, exceptionsBefore, scansBefore] = await Promise.all([
    params.admin
      .from("staff_shift_checkins")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", params.ctx.branchId)
      .eq("is_test", true)
      .neq("status", "voided"),
    params.admin
      .from("attendance_exceptions")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", params.ctx.branchId)
      .eq("is_test", true)
      .eq("status", "open"),
    params.admin
      .from("qr_scan_events")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", params.ctx.branchId)
      .eq("is_test", true),
  ]);

  if (checkinsBefore.error) throw new Error(checkinsBefore.error.message);
  if (exceptionsBefore.error) throw new Error(exceptionsBefore.error.message);
  if (scansBefore.error) throw new Error(scansBefore.error.message);

  const nowIso = new Date().toISOString();
  const checkinsUpdate = await params.admin
    .from("staff_shift_checkins")
    .update({
      status: "voided",
      exception_state: "none",
      notes: params.reason,
    })
    .eq("branch_id", params.ctx.branchId)
    .eq("is_test", true)
    .neq("status", "voided");

  if (checkinsUpdate.error) throw new Error(checkinsUpdate.error.message);

  const exceptionsUpdate = await params.admin
    .from("attendance_exceptions")
    .update({
      status: "resolved",
      resolved_at: nowIso,
      resolved_by: params.ctx.actorStaffId,
      resolution_note: params.reason,
    })
    .eq("branch_id", params.ctx.branchId)
    .eq("is_test", true)
    .eq("status", "open");

  if (exceptionsUpdate.error) throw new Error(exceptionsUpdate.error.message);

  await insertCorrectionAudit(params.admin, {
    ctx: params.ctx,
    actionType: "archive_test_data",
    previousValues: {
      testCheckins: checkinsBefore.count ?? 0,
      openTestExceptions: exceptionsBefore.count ?? 0,
      testScanEvents: scansBefore.count ?? 0,
    },
    newValues: {
      testCheckinsVoided: true,
      openTestExceptionsResolved: true,
      archivedAt: nowIso,
    },
    reason: params.reason,
  });

  return "Test Mode data archived from live operations.";
}

export async function applyAttendanceCorrection(params: {
  ctx: AttendanceActionContext;
  input: ApplyAttendanceCorrectionInput;
}): Promise<{ message: string }> {
  const admin = asAttendanceDb(createAdminClient());
  const reason = params.input.reason?.trim() || "";

  if (params.input.actionType === "apply_launch_recovery") {
    throw new Error(
      "Legacy launch recovery is disabled. Use an atomic Attendance review action after confirming the raw scans."
    );
  }
  if (
    ["set_manual_clock_in", "set_manual_clock_out", "correct_attendance_times"].includes(
      params.input.actionType
    )
  ) {
    return {
      message: await correctAttendanceTimes({
        admin,
        ctx: params.ctx,
        input: params.input,
        reason,
      }),
    };
  }
  if (
    params.input.actionType === "reset_attendance_state" ||
    params.input.actionType === "reset_staff_day"
  ) {
    return {
      message: await resetAttendanceState({ admin, ctx: params.ctx, input: params.input, reason }),
    };
  }
  if (params.input.actionType === "ignore_scan") {
    return { message: await ignoreScan({ admin, ctx: params.ctx, input: params.input, reason }) };
  }
  if (
    [
      "accept_recorded_attendance",
      "void_duplicate",
      "mark_accidental_scan",
      "allow_branch_today",
      "change_permanent_branch",
    ].includes(params.input.actionType)
  ) {
    return {
      message: await applyReviewCorrectionTransaction({
        admin,
        ctx: params.ctx,
        action: params.input.actionType,
        reason,
        exceptionId: params.input.exceptionId,
        checkinId: params.input.checkinId,
        values: {
          attendanceDate: params.input.attendanceDate ?? null,
          targetBranchId: params.input.targetBranchId ?? null,
        },
      }),
    };
  }
  if (params.input.actionType === "archive_test_data") {
    return { message: await archiveTestData({ admin, ctx: params.ctx, reason }) };
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
    "test_mode_reason",
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
  const launchRecoveryEnabled = booleanFromRecord(
    input as Record<string, unknown>,
    "launch_recovery_enabled"
  );
  if (launchRecoveryEnabled !== null) next.launch_recovery_enabled = launchRecoveryEnabled;
  const testModeEnabled = booleanFromRecord(input as Record<string, unknown>, "test_mode_enabled");
  if (testModeEnabled !== null) next.test_mode_enabled = testModeEnabled;

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
  const reason =
    params.input.reason?.trim() ||
    rules.test_mode_reason?.trim() ||
    rules.launch_recovery_reason?.trim() ||
    "";
  const testModeChanged =
    typeof rules.test_mode_enabled === "boolean" &&
    rules.test_mode_enabled !== previous.test_mode_enabled;
  const launchRecoveryEnabled =
    typeof rules.launch_recovery_enabled === "boolean"
      ? rules.launch_recovery_enabled
      : previous.launch_recovery_enabled;

  if (testModeChanged && !reason) {
    throw new Error("Enter a reason before changing Test / Training Mode.");
  }

  if (launchRecoveryEnabled) {
    const startDate = rules.launch_recovery_start_date ?? previous.launch_recovery_start_date;
    const endDate = rules.launch_recovery_end_date ?? previous.launch_recovery_end_date;
    const launchReason =
      reason || rules.launch_recovery_reason?.trim() || previous.launch_recovery_reason?.trim();

    if (!startDate || !endDate) {
      throw new Error("Launch Recovery needs a start date and end date.");
    }
    if (endDate < startDate) {
      throw new Error("Launch Recovery end date must be on or after the start date.");
    }
    if (!launchReason) {
      throw new Error("Enter a reason before enabling Launch Recovery.");
    }
  }

  if (testModeChanged) {
    const nowIso = new Date().toISOString();
    rules.test_mode_reason = reason;
    if (rules.test_mode_enabled) {
      rules.test_mode_enabled_at = nowIso;
      rules.test_mode_enabled_by = params.ctx.actorStaffId;
      rules.test_mode_disabled_at = null;
      rules.test_mode_disabled_by = null;
    } else {
      rules.test_mode_disabled_at = nowIso;
      rules.test_mode_disabled_by = params.ctx.actorStaffId;
    }
  }

  const nextSettings = { ...previous, ...rules, branch_id: params.ctx.branchId };
  const versionResult = await admin
    .rpc("save_attendance_branch_rule_version", {
      p_branch_id: params.ctx.branchId,
      p_actor_staff_id: params.ctx.actorStaffId as string,
      p_effective_from: new Date().toISOString(),
      p_rule_values: toJson(nextSettings),
      p_reason: reason || "Attendance rules updated from Recovery.",
    })
    .maybeSingle();
  if (versionResult.error || !versionResult.data?.success) {
    throw new Error(
      versionResult.data?.message ??
        versionResult.error?.message ??
        "Attendance rule history could not be saved."
    );
  }

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
    reason: reason || "Attendance rules updated.",
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
