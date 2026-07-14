import "server-only";

import { createClient } from "@/lib/supabase/server";
import { addDaysToYmd } from "@/lib/attendance/time";
import { getAttendanceSettings } from "@/lib/attendance/queries";
import { getAttendanceBranchNow } from "@/lib/attendance/shift-instance";
import { resolveAttendanceDayStaffStates, type AttendanceDayStaffState } from "@/lib/attendance/day-model";
import { getResolvedStaffSchedulesForDate } from "@/lib/queries/resolved-staff-schedules";

export type StaffAttendanceHistoryRecord = {
  id: string;
  shiftDate: string;
  shiftType: string;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  checkedInAt: string;
  checkedOutAt: string | null;
  status: string;
  attendanceStatus: string;
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  reviewState: "clear" | "review" | "open";
  reviewLabel: string;
};

export type StaffAttendanceData = {
  staffId: string;
  staffName: string;
  today: string;
  scheduleLabel: string;
  scheduleState: "scheduled" | "day_off" | "not_scheduled";
  currentClockState: "clocked_in" | "clocked_out" | "not_clocked_in";
  currentRecord: StaffAttendanceHistoryRecord | null;
  todayState: AttendanceDayStaffState;
  history: StaffAttendanceHistoryRecord[];
};

type CheckinRow = {
  id: string;
  shift_date: string;
  shift_type: string;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  checked_in_at: string;
  checked_out_at: string | null;
  status: string;
  attendance_status: string | null;
  exception_state: string | null;
  worked_minutes: number | null;
  late_minutes: number | null;
  early_leave_minutes: number | null;
  overtime_minutes: number | null;
};

function formatTime(value: string): string {
  const [hourRaw, minute = "00"] = value.slice(0, 5).split(":");
  const hour = Number(hourRaw);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

export function deriveStaffAttendanceReviewState(row: Pick<CheckinRow, "status" | "attendance_status" | "exception_state">): {
  state: StaffAttendanceHistoryRecord["reviewState"];
  label: string;
} {
  const exception = row.exception_state?.trim().toLowerCase();
  if (exception && !["none", "clear", "resolved"].includes(exception)) {
    return { state: "review", label: "Needs CRM review" };
  }
  if (row.status === "checked_in") return { state: "open", label: "Shift in progress" };
  if (["incomplete", "exception", "needs_review"].includes((row.attendance_status ?? "").toLowerCase())) {
    return { state: "review", label: "Needs CRM review" };
  }
  return { state: "clear", label: "Attendance recorded" };
}

function mapCheckin(row: CheckinRow): StaffAttendanceHistoryRecord {
  const review = deriveStaffAttendanceReviewState(row);
  return {
    id: row.id,
    shiftDate: row.shift_date,
    shiftType: row.shift_type,
    scheduledStartAt: row.scheduled_start_at,
    scheduledEndAt: row.scheduled_end_at,
    checkedInAt: row.checked_in_at,
    checkedOutAt: row.checked_out_at,
    status: row.status,
    attendanceStatus: row.attendance_status ?? "recorded",
    workedMinutes: row.worked_minutes ?? 0,
    lateMinutes: row.late_minutes ?? 0,
    earlyLeaveMinutes: row.early_leave_minutes ?? 0,
    overtimeMinutes: row.overtime_minutes ?? 0,
    reviewState: review.state,
    reviewLabel: review.label,
  };
}

export async function getMyAttendanceData(days = 90): Promise<StaffAttendanceData | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const staffResult = await supabase
    .from("staff")
    .select("id, full_name, branch_id, staff_type, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .is("archived_at", null)
    .is("merged_into_staff_id", null)
    .maybeSingle();
  if (staffResult.error || !staffResult.data) return null;
  const staff = staffResult.data;

  const settings = await getAttendanceSettings(staff.branch_id);
  const branchNow = getAttendanceBranchNow(settings);
  const today = branchNow.businessDate;
  const historyStart = addDaysToYmd(today, -Math.max(1, Math.min(days, 90)));
  const [checkinsResult, exceptionsResult, sessionsResult, schedules] = await Promise.all([
    supabase
      .from("staff_shift_checkins")
      .select("id, shift_date, shift_type, scheduled_start_at, scheduled_end_at, checked_in_at, checked_out_at, status, attendance_status, exception_state, worked_minutes, late_minutes, early_leave_minutes, overtime_minutes")
      .eq("staff_id", staff.id)
      .eq("is_test", false)
      .gte("shift_date", historyStart)
      .order("checked_in_at", { ascending: false })
      .limit(200),
    supabase
      .from("attendance_exceptions")
      .select("id, branch_id, staff_id, checkin_id, scan_event_id, exception_type, severity, status, message, metadata, detected_at, resolved_at")
      .eq("staff_id", staff.id)
      .eq("is_test", false)
      .eq("status", "open"),
    supabase
      .from("bookings")
      .select("id, staff_id, booking_date, start_time, status, booking_progress_status, session_started_at, session_due_at, session_completed_at, session_duration_minutes_snapshot")
      .eq("staff_id", staff.id)
      .eq("branch_id", staff.branch_id)
      .eq("booking_progress_status", "session_started")
      .is("session_completed_at", null),
    getResolvedStaffSchedulesForDate({
      supabase,
      branchId: staff.branch_id,
      date: today,
      staff: [{
        id: staff.id,
        staff_type: staff.staff_type,
        system_role: staff.system_role,
      }],
    }),
  ]);
  if (checkinsResult.error) throw new Error(checkinsResult.error.message);
  if (exceptionsResult.error) throw new Error(exceptionsResult.error.message);
  if (sessionsResult.error) throw new Error(sessionsResult.error.message);

  const history = ((checkinsResult.data ?? []) as CheckinRow[]).map(mapCheckin);
  const todayRecords = history.filter((record) => record.shiftDate === today);
  const currentRecord = todayRecords.find((record) => record.status === "checked_in") ?? todayRecords[0] ?? null;
  const currentClockState = currentRecord?.status === "checked_in"
    ? "clocked_in"
    : currentRecord?.checkedOutAt
      ? "clocked_out"
      : "not_clocked_in";
  const attendanceRecords = ((checkinsResult.data ?? []) as CheckinRow[]).map((row) => ({
    id: row.id,
    branch_id: staff.branch_id,
    staff_id: staff.id,
    staff_name: staff.full_name,
    staff_nickname: null,
    staff_type: staff.staff_type,
    system_role: staff.system_role,
    shift_date: row.shift_date,
    shift_type: row.shift_type,
    scheduled_start_at: row.scheduled_start_at,
    scheduled_end_at: row.scheduled_end_at,
    checked_in_at: row.checked_in_at,
    checked_out_at: row.checked_out_at,
    status: row.status,
    attendance_status: row.attendance_status ?? "recorded",
    exception_state: row.exception_state,
    worked_minutes: row.worked_minutes ?? 0,
    late_minutes: row.late_minutes ?? 0,
    early_leave_minutes: row.early_leave_minutes ?? 0,
    overtime_minutes: row.overtime_minutes ?? 0,
    clock_in_method: null,
    clock_out_method: null,
    source_label: null,
  }));
  const todayState = resolveAttendanceDayStaffStates({
    branchId: staff.branch_id,
    businessDate: today,
    timezone: branchNow.timezone,
    now: new Date(),
    settings,
    staff: [{ id: staff.id, fullName: staff.full_name, staffType: staff.staff_type }],
    schedules,
    records: attendanceRecords,
    exceptions: (exceptionsResult.data ?? []).map((row) => ({
      ...row,
      staff_name: staff.full_name,
      metadata: (row.metadata as Record<string, unknown> | null) ?? {},
    })),
    sessions: (sessionsResult.data ?? []).map((row) => ({
      id: row.id,
      staff_id: row.staff_id ?? staff.id,
      customer_name: "Customer",
      service_name: "Service",
      staff_name: staff.full_name,
      resource_name: null,
      booking_date: row.booking_date,
      start_time: row.start_time,
      status: row.status,
      booking_progress_status: row.booking_progress_status,
      session_started_at: row.session_started_at,
      session_due_at: row.session_due_at,
      session_completed_at: row.session_completed_at,
      duration_minutes: row.session_duration_minutes_snapshot,
    })),
  })[0]!;
  const scheduleState: StaffAttendanceData["scheduleState"] = todayState.scheduleState === "day_off"
    ? "day_off"
    : todayState.shiftWindows.length > 0
      ? "scheduled"
      : "not_scheduled";
  const scheduleLabel = todayState.shiftWindows.length > 0
    ? todayState.shiftWindows.map((window) => `${formatTime(window.startTime)}–${formatTime(window.endTime)}`).join(" · ")
    : todayState.displayLabel;

  return {
    staffId: staff.id,
    staffName: staff.full_name,
    today,
    scheduleLabel,
    scheduleState,
    currentClockState: todayState.currentAttendanceState === "clocked_in" || todayState.currentAttendanceState === "available" || todayState.currentAttendanceState === "in_service"
      ? "clocked_in"
      : todayState.currentAttendanceState === "clocked_out"
        ? "clocked_out"
        : currentClockState,
    currentRecord,
    todayState,
    history,
  };
}
