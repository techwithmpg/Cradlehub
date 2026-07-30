import type { AttendanceDayStaffState } from "@/lib/attendance/day-model";
import type { AttendanceRecord, AttendanceWorkspaceData } from "@/lib/attendance/types";
import type { Database, Json } from "@/types/supabase";

export type AttendanceCheckinRealtimeRow =
  Database["public"]["Tables"]["staff_shift_checkins"]["Row"];

const POLICY_SOURCES = new Set<AttendanceRecord["attendance_policy_source"]>([
  "schedule",
  "crm_closing",
  "service_completion",
  "home_service",
  "driver_trip",
]);

function recordObject(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function isCompleteAttendanceCheckinRow(
  value: unknown
): value is AttendanceCheckinRealtimeRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Partial<AttendanceCheckinRealtimeRow>;
  return (
    typeof row.id === "string" &&
    typeof row.branch_id === "string" &&
    typeof row.staff_id === "string" &&
    typeof row.shift_date === "string" &&
    typeof row.checked_in_at === "string" &&
    typeof row.status === "string" &&
    row.status !== "voided" &&
    row.is_test === false
  );
}

function toAttendanceRecord(
  workspace: AttendanceWorkspaceData,
  row: AttendanceCheckinRealtimeRow,
  existing: AttendanceRecord | null
): AttendanceRecord {
  const staffState = workspace.dailyStaffStates.find((item) => item.staffId === row.staff_id);
  const staffOption = workspace.staffOptions.find((item) => item.id === row.staff_id);
  const policySource = POLICY_SOURCES.has(
    row.attendance_policy_source as AttendanceRecord["attendance_policy_source"]
  )
    ? (row.attendance_policy_source as AttendanceRecord["attendance_policy_source"])
    : (existing?.attendance_policy_source ?? "schedule");

  return {
    id: row.id,
    branch_id: row.branch_id,
    staff_id: row.staff_id,
    staff_name: existing?.staff_name ?? staffState?.staffName ?? staffOption?.full_name ?? "Staff member",
    staff_nickname: existing?.staff_nickname ?? null,
    staff_type: existing?.staff_type ?? staffState?.staffType ?? staffOption?.staff_type ?? null,
    system_role: existing?.system_role ?? null,
    shift_date: row.shift_date,
    shift_type: row.shift_type,
    scheduled_start_at: row.scheduled_start_at,
    scheduled_end_at: row.scheduled_end_at,
    checked_in_at: row.checked_in_at,
    checked_out_at: row.checked_out_at,
    status: row.status,
    attendance_status: row.attendance_status,
    exception_state: row.exception_state,
    worked_minutes: row.worked_minutes,
    late_minutes: row.late_minutes,
    early_leave_minutes: row.early_leave_minutes,
    overtime_minutes: row.overtime_minutes,
    clock_in_method: row.clock_in_method,
    clock_out_method: row.clock_out_method,
    attendance_expected_end_at: row.attendance_expected_end_at,
    earliest_normal_clock_out_at: row.earliest_normal_clock_out_at,
    latest_normal_clock_out_at: row.latest_normal_clock_out_at,
    attendance_policy_source: policySource,
    attendance_policy_snapshot: recordObject(row.attendance_policy_snapshot),
    provisional_auto_closed_at: row.provisional_auto_closed_at,
    clock_out_confirmation_required: row.clock_out_confirmation_required,
    actual_clock_out_reconciled_at: row.actual_clock_out_reconciled_at,
    source_label: existing?.source_label ?? null,
  };
}

function mergeStaffState(
  state: AttendanceDayStaffState,
  row: AttendanceCheckinRealtimeRow,
  nowMs: number
): AttendanceDayStaffState {
  if (state.staffId !== row.staff_id) return state;
  const isOpen = row.status === "checked_in" && !row.checked_out_at;
  const needsReview = row.exception_state === "open";
  const isInService = isOpen && Boolean(state.activeServiceSession);
  const currentAttendanceState = isInService
    ? "in_service"
    : needsReview
      ? "needs_review"
      : isOpen && state.currentShiftWindow
        ? "available"
        : isOpen
          ? "clocked_in"
          : "clocked_out";
  const operationalStatus = isInService
    ? "on_service"
    : needsReview
      ? "needs_review"
      : isOpen
        ? "clocked_in"
        : "clocked_out";
  const workedMinutes = isOpen
    ? Math.max(0, Math.round((nowMs - new Date(row.checked_in_at).getTime()) / 60_000))
    : row.worked_minutes;

  return {
    ...state,
    attendanceRecordId: row.id,
    clockInAt: row.checked_in_at,
    clockOutAt: row.checked_out_at,
    currentAttendanceState,
    operationalStatus,
    workedMinutes,
    lateMinutes: row.late_minutes,
    earlyLeaveMinutes: row.early_leave_minutes,
    overtimeMinutes: row.overtime_minutes,
    availabilityState: isInService
      ? "in_service"
      : isOpen && state.currentShiftWindow && !needsReview
        ? "available"
        : "not_available",
    exceptionState: needsReview ? "open" : "clear",
    displayLabel: isInService
      ? "In Service"
      : needsReview
        ? "Needs Review"
        : isOpen && state.currentShiftWindow
          ? "Available"
          : isOpen
            ? "Clocked In"
            : "Clocked Out",
    actionRequired: needsReview,
  };
}

export function mergeAttendanceWorkspaceCheckin(
  workspace: AttendanceWorkspaceData,
  row: AttendanceCheckinRealtimeRow,
  nowMs = Date.now()
): AttendanceWorkspaceData {
  if (
    !isCompleteAttendanceCheckinRow(row) ||
    row.branch_id !== workspace.branchId ||
    row.shift_date !== workspace.businessDate
  ) {
    return workspace;
  }

  const existing = workspace.records.find((record) => record.id === row.id) ?? null;
  const nextRecord = toAttendanceRecord(workspace, row, existing);
  const records = [nextRecord, ...workspace.records.filter((record) => record.id !== row.id)];
  const dailyStaffStates = workspace.dailyStaffStates.map((state) =>
    mergeStaffState(state, row, nowMs)
  );

  return {
    ...workspace,
    serverNowMs: nowMs,
    records,
    dailyStaffStates,
    summary: {
      ...workspace.summary,
      checkedInNow: records.filter(
        (record) => record.status === "checked_in" && !record.checked_out_at
      ).length,
      recordsToday: records.filter((record) => record.shift_date === workspace.businessDate).length,
    },
  };
}
