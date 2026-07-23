import { branchDateTimeToIsoInTimezone } from "@/lib/attendance/shift-instance";
import {
  effectiveAttendanceExceptionType,
  isActionableAttendanceException,
} from "@/lib/attendance/attendance-exception-actionability";
import { getAttendanceScheduleWindows } from "@/lib/attendance/attendance-schedule-windows";
import type {
  AttendanceException,
  AttendanceRecord,
  AttendanceSession,
  AttendanceSettings,
} from "@/lib/attendance/types";
import type {
  ResolvedStaffSchedule,
  ResolvedStaffScheduleWindow,
} from "@/lib/schedule/resolve-staff-schedule";

export type AttendanceDayScheduleState =
  | "not_scheduled"
  | "scheduled_later"
  | "expected_soon"
  | "expected_now"
  | "day_off"
  | "schedule_missing"
  | "schedule_conflict"
  | "shift_complete";

export type AttendanceDayCurrentState =
  | "not_expected"
  | "not_arrived"
  | "late_not_arrived"
  | "clocked_in"
  | "on_break"
  | "in_service"
  | "available"
  | "clocked_out"
  | "forgotten_clock_out"
  | "absent"
  | "needs_review";

export type AttendanceAvailabilityState = "not_available" | "available" | "in_service" | "on_break";

export type AttendanceOperationalStatus =
  | "not_expected"
  | "expected_later"
  | "missing"
  | "clocked_in"
  | "on_service"
  | "clocked_out"
  | "needs_review"
  | "scan_captured";

export type AttendanceDayShiftWindow = {
  id: string | null;
  shiftType: string;
  windowOrder: number;
  startTime: string;
  endTime: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  endsNextDay: boolean;
};

export type AttendanceDayStaffState = {
  staffId: string;
  staffName: string;
  staffType: string | null;
  branchId: string;
  businessDate: string;
  timezone: string;
  scheduleSource: ResolvedStaffSchedule["source"];
  scheduleState: AttendanceDayScheduleState;
  shiftWindows: AttendanceDayShiftWindow[];
  currentShiftWindow: AttendanceDayShiftWindow | null;
  nextShiftWindow: AttendanceDayShiftWindow | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  attendanceRecordId: string | null;
  clockInAt: string | null;
  clockOutAt: string | null;
  currentAttendanceState: AttendanceDayCurrentState;
  operationalStatus: AttendanceOperationalStatus;
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  activeBookingId: string | null;
  activeServiceSession: AttendanceSession | null;
  availabilityState: AttendanceAvailabilityState;
  exceptionState: "clear" | "open";
  currentExceptionIds: string[];
  issueCodes: string[];
  displayLabel: string;
  actionRequired: boolean;
};

export type AttendanceDayStaffMember = {
  id: string;
  fullName: string;
  staffType: string | null;
};

function windowToDayWindow(params: {
  window: ResolvedStaffScheduleWindow;
  businessDate: string;
  timezone: string;
  index: number;
}): AttendanceDayShiftWindow {
  const startMinutes = timeMinutes(params.window.startTime);
  const endMinutes = timeMinutes(params.window.endTime);
  const endsNextDay = params.window.endsNextDay ?? endMinutes <= startMinutes;
  return {
    id: params.window.id ?? null,
    shiftType: params.window.shiftType,
    windowOrder: params.window.windowOrder ?? params.index + 1,
    startTime: params.window.startTime,
    endTime: params.window.endTime,
    scheduledStartAt: branchDateTimeToIsoInTimezone({
      date: params.businessDate,
      time: params.window.startTime,
      timezone: params.timezone,
    }),
    scheduledEndAt: branchDateTimeToIsoInTimezone({
      date: params.businessDate,
      time: params.window.endTime,
      timezone: params.timezone,
      addDay: endsNextDay,
    }),
    endsNextDay,
  };
}

function timeMinutes(value: string): number {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

function minuteDifference(start: string, end: string): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000));
}

function recordForStaffDay(params: {
  records: AttendanceRecord[];
  staffId: string;
  branchId: string;
  businessDate: string;
  currentWindow: AttendanceDayShiftWindow | null;
}): AttendanceRecord | null {
  const rows = params.records.filter(
    (record) =>
      record.staff_id === params.staffId &&
      record.branch_id === params.branchId &&
      record.shift_date === params.businessDate
  );
  const open = rows.find((record) => record.status === "checked_in" && !record.checked_out_at);
  if (open) return open;
  if (params.currentWindow) {
    const exact = rows.find(
      (record) =>
        record.scheduled_start_at === params.currentWindow?.scheduledStartAt ||
        (record.shift_type === params.currentWindow?.shiftType &&
          record.scheduled_end_at === params.currentWindow?.scheduledEndAt)
    );
    if (exact) return exact;
  }
  return rows[0] ?? null;
}

function scheduleDisplayLabel(
  scheduleState: AttendanceDayScheduleState,
  currentState: AttendanceDayCurrentState
): string {
  if (currentState === "in_service") return "In Service";
  if (currentState === "needs_review") return "Needs Review";
  if (currentState === "late_not_arrived") return "Late";
  if (currentState === "not_arrived") return "Not Arrived";
  if (currentState === "available") return "Available";
  if (currentState === "clocked_in") return "Clocked In";
  if (currentState === "clocked_out") return "Clocked Out";
  if (scheduleState === "day_off") return "Day Off";
  if (scheduleState === "not_scheduled") return "Not Scheduled";
  if (scheduleState === "schedule_missing") return "Schedule Missing";
  if (scheduleState === "schedule_conflict") return "Schedule Conflict";
  if (scheduleState === "scheduled_later") return "Scheduled Later";
  if (scheduleState === "expected_soon") return "Expected Soon";
  if (scheduleState === "shift_complete") return "Shift Complete";
  return "Expected Now";
}

export function resolveAttendanceDayStaffStates(params: {
  branchId: string;
  businessDate: string;
  timezone: string;
  now: Date;
  settings: Pick<
    AttendanceSettings,
    "clock_in_early_grace_minutes" | "clock_in_late_grace_minutes" | "late_grace_minutes"
  >;
  staff: AttendanceDayStaffMember[];
  schedules: Map<string, ResolvedStaffSchedule>;
  records: AttendanceRecord[];
  sessions: AttendanceSession[];
  exceptions: AttendanceException[];
}): AttendanceDayStaffState[] {
  const nowMs = params.now.getTime();
  const earlyMinutes = Math.max(0, params.settings.clock_in_early_grace_minutes);
  const lateGraceMinutes = Math.max(
    0,
    params.settings.late_grace_minutes ?? params.settings.clock_in_late_grace_minutes
  );

  return params.staff.map((staff) => {
    const schedule =
      params.schedules.get(staff.id) ??
      ({
        source: "none",
        status: "missing",
        state: "NO_SCHEDULE_CONFIGURED",
        isWorking: false,
        isDayOff: false,
        windows: [],
      } satisfies ResolvedStaffSchedule);
    const shiftWindows = getAttendanceScheduleWindows(schedule)
      .map((window, index) =>
        windowToDayWindow({
          window,
          businessDate: params.businessDate,
          timezone: params.timezone,
          index,
        })
      )
      .sort(
        (first, second) =>
          new Date(first.scheduledStartAt).getTime() - new Date(second.scheduledStartAt).getTime()
      );
    const currentShiftWindow =
      shiftWindows.find((window) => {
        const start = new Date(window.scheduledStartAt).getTime();
        const end = new Date(window.scheduledEndAt).getTime();
        return nowMs >= start && nowMs <= end;
      }) ?? null;
    const nextShiftWindow =
      shiftWindows.find((window) => new Date(window.scheduledStartAt).getTime() > nowMs) ?? null;
    const startedShiftWindow =
      shiftWindows.find((window) => new Date(window.scheduledStartAt).getTime() <= nowMs) ?? null;

    let scheduleState: AttendanceDayScheduleState;
    if (schedule.status === "not_operational") scheduleState = "not_scheduled";
    else if (schedule.status === "day_off") scheduleState = "day_off";
    else if (schedule.status === "missing") scheduleState = "schedule_missing";
    else if (schedule.status === "conflict") scheduleState = "schedule_conflict";
    else if (currentShiftWindow) scheduleState = "expected_now";
    else if (nextShiftWindow) {
      const minutesUntilStart = minuteDifference(
        params.now.toISOString(),
        nextShiftWindow.scheduledStartAt
      );
      scheduleState = minutesUntilStart <= earlyMinutes ? "expected_soon" : "scheduled_later";
    } else scheduleState = "shift_complete";

    const record = recordForStaffDay({
      records: params.records,
      staffId: staff.id,
      branchId: params.branchId,
      businessDate: params.businessDate,
      currentWindow: currentShiftWindow,
    });
    const activeServiceSession =
      params.sessions.find(
        (session) =>
          session.staff_id === staff.id &&
          session.booking_progress_status === "session_started" &&
          !session.session_completed_at
      ) ?? null;
    const openExceptions = params.exceptions.filter(
      (exception) => exception.staff_id === staff.id && isActionableAttendanceException(exception)
    );
    const issueCodes = [
      ...(schedule.conflictCode ? [schedule.conflictCode] : []),
      ...openExceptions.map(effectiveAttendanceExceptionType),
    ];
    const isOpen = record?.status === "checked_in" && !record.checked_out_at;
    const scheduledStart =
      currentShiftWindow?.scheduledStartAt ??
      nextShiftWindow?.scheduledStartAt ??
      shiftWindows[0]?.scheduledStartAt ??
      null;
    const scheduledEnd =
      currentShiftWindow?.scheduledEndAt ??
      nextShiftWindow?.scheduledEndAt ??
      shiftWindows.at(-1)?.scheduledEndAt ??
      null;
    const lateBoundary = startedShiftWindow
      ? new Date(startedShiftWindow.scheduledStartAt).getTime() + lateGraceMinutes * 60_000
      : null;

    let currentAttendanceState: AttendanceDayCurrentState;
    if (activeServiceSession) currentAttendanceState = "in_service";
    else if (openExceptions.length > 0) currentAttendanceState = "needs_review";
    else if (isOpen && currentShiftWindow) currentAttendanceState = "available";
    else if (isOpen) currentAttendanceState = "clocked_in";
    else if (record?.checked_out_at || record?.status === "checked_out")
      currentAttendanceState = "clocked_out";
    else if (scheduleState === "schedule_conflict") currentAttendanceState = "needs_review";
    else if (startedShiftWindow && lateBoundary !== null && nowMs > lateBoundary) {
      currentAttendanceState = "late_not_arrived";
    } else if (scheduleState === "expected_now") currentAttendanceState = "not_arrived";
    else currentAttendanceState = "not_expected";

    const capturedWithoutAttendance =
      !record &&
      openExceptions.length > 0 &&
      openExceptions.every((exception) =>
        ["likely_closing_scan_without_clock_in", "already_checked_out", "wrong_branch"].includes(
          effectiveAttendanceExceptionType(exception)
        )
      );
    let operationalStatus: AttendanceOperationalStatus;
    if (activeServiceSession) operationalStatus = "on_service";
    else if (capturedWithoutAttendance) operationalStatus = "scan_captured";
    else if (openExceptions.length > 0 || scheduleState === "schedule_conflict")
      operationalStatus = "needs_review";
    else if (isOpen) operationalStatus = "clocked_in";
    else if (record?.checked_out_at || record?.status === "checked_out")
      operationalStatus = "clocked_out";
    else if (startedShiftWindow && lateBoundary !== null && nowMs > lateBoundary)
      operationalStatus = "missing";
    else if (["expected_now", "expected_soon", "scheduled_later"].includes(scheduleState))
      operationalStatus = "expected_later";
    else operationalStatus = "not_expected";

    const workedMinutes = record
      ? record.checked_out_at
        ? record.worked_minutes
        : minuteDifference(record.checked_in_at, params.now.toISOString())
      : 0;
    const lateMinutes =
      record?.late_minutes ??
      (currentAttendanceState === "late_not_arrived" && startedShiftWindow
        ? minuteDifference(startedShiftWindow.scheduledStartAt, params.now.toISOString())
        : 0);
    const availabilityState: AttendanceAvailabilityState = activeServiceSession
      ? "in_service"
      : isOpen && currentShiftWindow !== null && openExceptions.length === 0
        ? "available"
        : "not_available";
    const actionRequired = operationalStatus === "missing" || operationalStatus === "needs_review";

    return {
      staffId: staff.id,
      staffName: staff.fullName,
      staffType: staff.staffType,
      branchId: params.branchId,
      businessDate: params.businessDate,
      timezone: params.timezone,
      scheduleSource: schedule.source,
      scheduleState,
      shiftWindows,
      currentShiftWindow,
      nextShiftWindow,
      scheduledStart,
      scheduledEnd,
      attendanceRecordId: record?.id ?? null,
      clockInAt: record?.checked_in_at ?? null,
      clockOutAt: record?.checked_out_at ?? null,
      currentAttendanceState,
      operationalStatus,
      workedMinutes,
      lateMinutes,
      earlyLeaveMinutes: record?.early_leave_minutes ?? 0,
      overtimeMinutes: record?.overtime_minutes ?? 0,
      activeBookingId: activeServiceSession?.id ?? null,
      activeServiceSession,
      availabilityState,
      exceptionState: openExceptions.length > 0 ? "open" : "clear",
      currentExceptionIds: openExceptions.map((exception) => exception.id),
      issueCodes: Array.from(new Set(issueCodes)),
      displayLabel: scheduleDisplayLabel(scheduleState, currentAttendanceState),
      actionRequired,
    };
  });
}
