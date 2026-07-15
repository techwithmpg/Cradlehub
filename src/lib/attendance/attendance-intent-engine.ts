import { addDaysToYmd, branchDateTimeToIso, isOvernightWindow } from "@/lib/attendance/time";
import {
  isTimeWithinScheduleWindows,
  type ResolvedStaffSchedule,
  type ResolvedStaffScheduleWindow,
} from "@/lib/schedule/resolve-staff-schedule";
import { timeToMinutes } from "@/lib/utils/time-format";
import type { AttendanceSettings } from "@/lib/attendance/types";

const DAY_MINUTES = 24 * 60;

export type AttendanceScanIntentType =
  | "clock_in"
  | "early_clock_in"
  | "late_clock_in"
  | "clock_out"
  | "early_clock_out"
  | "overtime_clock_out"
  | "duplicate_scan"
  | "ambiguous_scan"
  | "outside_schedule_window"
  | "likely_closing_scan_without_clock_in"
  | "missing_schedule"
  | "off_day_exception"
  | "staff_not_operational"
  | "schedule_state_unsupported"
  | "recovery_required"
  | "ignored_test_scan";

export type AttendanceScheduleSelection = {
  shiftDate: string;
  shiftType: string;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  isUnscheduled: boolean;
  isDayOff: boolean;
  source: ResolvedStaffSchedule["source"];
  selectedWindow: ResolvedStaffScheduleWindow | null;
  windows: ResolvedStaffScheduleWindow[];
};

export type AttendanceScanIntent = {
  type: AttendanceScanIntentType;
  action: "clock_in" | "clock_out" | "duplicate_scan" | "recovery_required" | "ignored";
  reasonCode: AttendanceScanIntentType;
  requiresRecovery: boolean;
  shouldWriteAttendance: boolean;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  schedule: AttendanceScheduleSelection;
};

export type ActiveAttendanceIntentCheckin = {
  checkedInAt: string;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  shiftDate?: string | null;
  shiftType?: string | null;
};

export type ResolveAttendanceScanIntentInput = {
  scanIso: string;
  scanDate: string;
  scanTime: string;
  timezone?: string | null;
  settings: AttendanceSettings;
  schedule: ResolvedStaffSchedule;
  duplicateScan?: boolean;
  activeCheckin?: ActiveAttendanceIntentCheckin | null;
};

export type OpenAttendanceIntentCheckin = ActiveAttendanceIntentCheckin & {
  id: string;
  status?: string | null;
  checkedOutAt?: string | null;
  shiftInstanceKey?: string | null;
  isTest?: boolean | null;
};

export type OpenAttendanceClassification = {
  matchingCheckin: OpenAttendanceIntentCheckin | null;
  staleCheckins: OpenAttendanceIntentCheckin[];
  conflictingCheckins: OpenAttendanceIntentCheckin[];
};

function minutesOrZero(value: number | null): number {
  return value ?? 0;
}

function toMillis(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function intervalOverlaps(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number
): boolean {
  return firstStart <= secondEnd && secondStart <= firstEnd;
}

function normalizedShiftType(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function isGenericShiftType(value: string | null | undefined): boolean {
  const normalized = normalizedShiftType(value);
  return (
    !normalized || normalized === "single" || normalized === "default" || normalized === "legacy"
  );
}

function checkinFallsInsideScheduleWindow(params: {
  checkin: OpenAttendanceIntentCheckin;
  schedule: AttendanceScheduleSelection;
}): boolean {
  const scheduledStart = toMillis(params.schedule.scheduledStartAt);
  const scheduledEnd = toMillis(params.schedule.scheduledEndAt);
  const checkedInAt = toMillis(params.checkin.checkedInAt);
  if (scheduledStart === null || scheduledEnd === null || checkedInAt === null) return false;

  const legacyGrace = 4 * 60 * 60000;
  return checkedInAt >= scheduledStart - legacyGrace && checkedInAt <= scheduledEnd + legacyGrace;
}

function scheduledWindowsOverlap(params: {
  checkin: OpenAttendanceIntentCheckin;
  schedule: AttendanceScheduleSelection;
}): boolean {
  const checkinStart = toMillis(params.checkin.scheduledStartAt);
  const checkinEnd = toMillis(params.checkin.scheduledEndAt);
  const scheduledStart = toMillis(params.schedule.scheduledStartAt);
  const scheduledEnd = toMillis(params.schedule.scheduledEndAt);
  if (
    checkinStart === null ||
    checkinEnd === null ||
    scheduledStart === null ||
    scheduledEnd === null
  ) {
    return false;
  }

  return intervalOverlaps(checkinStart, checkinEnd, scheduledStart, scheduledEnd);
}

function openCheckinMatchesSchedule(params: {
  checkin: OpenAttendanceIntentCheckin;
  schedule: AttendanceScheduleSelection;
}): boolean {
  if (params.schedule.isUnscheduled || params.schedule.isDayOff) return false;
  if (params.checkin.shiftDate !== params.schedule.shiftDate) return false;

  const checkinShiftType = normalizedShiftType(params.checkin.shiftType);
  const scheduleShiftType = normalizedShiftType(params.schedule.shiftType);
  if (checkinShiftType && scheduleShiftType && checkinShiftType === scheduleShiftType) {
    if (!isGenericShiftType(checkinShiftType)) return true;
    if (params.schedule.windows.length <= 1) return true;
    return scheduledWindowsOverlap(params) || checkinFallsInsideScheduleWindow(params);
  }

  if (!isGenericShiftType(checkinShiftType)) return false;
  return scheduledWindowsOverlap(params) || checkinFallsInsideScheduleWindow(params);
}

export function classifyOpenAttendanceCheckins(params: {
  openCheckins: OpenAttendanceIntentCheckin[];
  schedule: AttendanceScheduleSelection;
}): OpenAttendanceClassification {
  const matching = params.openCheckins
    .filter((checkin) => openCheckinMatchesSchedule({ checkin, schedule: params.schedule }))
    .sort(
      (first, second) => (toMillis(second.checkedInAt) ?? 0) - (toMillis(first.checkedInAt) ?? 0)
    );
  const matchingCheckin = matching[0] ?? null;
  const extraMatching = matching.slice(1);
  const unmatched = params.openCheckins.filter((checkin) => !matching.includes(checkin));

  return {
    matchingCheckin,
    staleCheckins: unmatched.filter((checkin) => checkin.shiftDate !== params.schedule.shiftDate),
    conflictingCheckins: [
      ...extraMatching,
      ...unmatched.filter((checkin) => checkin.shiftDate === params.schedule.shiftDate),
    ],
  };
}

function absoluteScanMinutesForWindow(
  time: string,
  window: ResolvedStaffScheduleWindow
): number | null {
  const current = timeToMinutes(time);
  const start = timeToMinutes(window.startTime);
  const end = timeToMinutes(window.endTime);
  if (current === null || start === null || end === null) return null;

  const crossesMidnight = window.endsNextDay ?? end <= start;
  if (crossesMidnight && current <= end) {
    return current + DAY_MINUTES;
  }

  return current;
}

function absoluteWindowEndMinutes(window: ResolvedStaffScheduleWindow): number | null {
  const start = timeToMinutes(window.startTime);
  const end = timeToMinutes(window.endTime);
  if (start === null || end === null) return null;
  return (window.endsNextDay ?? end <= start) ? end + DAY_MINUTES : end;
}

function inWindowMinutes(params: {
  scanTime: string;
  window: ResolvedStaffScheduleWindow;
  start: number;
  end: number;
}): boolean {
  const current = absoluteScanMinutesForWindow(params.scanTime, params.window);
  if (current === null) return false;
  return current >= params.start && current <= params.end;
}

function closingScanRecoveryIntent(params: {
  schedule: AttendanceScheduleSelection;
}): AttendanceScanIntent {
  return intent({
    type: "likely_closing_scan_without_clock_in",
    action: "recovery_required",
    schedule: params.schedule,
    requiresRecovery: true,
    shouldWriteAttendance: false,
    severity: "warning",
    title: "Scan captured",
    message: "The front desk will confirm today’s attendance. You may continue normally.",
  });
}

function isInClockOutWindow(params: {
  scanTime: string;
  settings: AttendanceSettings;
  window: ResolvedStaffScheduleWindow;
}): boolean {
  const end = absoluteWindowEndMinutes(params.window);
  if (end === null) return false;
  const start = end - params.settings.clock_out_window_before_shift_end_minutes;
  const windowEnd = end + params.settings.clock_out_window_after_shift_end_minutes;
  return inWindowMinutes({
    scanTime: params.scanTime,
    window: params.window,
    start,
    end: windowEnd,
  });
}

function isInClockInWindow(params: {
  scanTime: string;
  settings: AttendanceSettings;
  window: ResolvedStaffScheduleWindow;
}): boolean {
  const start = timeToMinutes(params.window.startTime);
  if (start === null) return false;
  return inWindowMinutes({
    scanTime: params.scanTime,
    window: params.window,
    start: start - params.settings.clock_in_window_before_shift_minutes,
    end: start + params.settings.clock_in_window_after_shift_start_minutes,
  });
}

function clockInIntentForWindow(params: {
  scanTime: string;
  settings: AttendanceSettings;
  schedule: AttendanceScheduleSelection;
}): AttendanceScanIntentType {
  const current = timeToMinutes(params.scanTime);
  const start = params.schedule.selectedWindow
    ? timeToMinutes(params.schedule.selectedWindow.startTime)
    : null;
  if (current === null || start === null) return "clock_in";
  if (current < start) return "early_clock_in";
  if (current > start + params.settings.late_grace_minutes) return "late_clock_in";
  return "clock_in";
}

function getOpenCloseAttendanceWindow(
  schedule: ResolvedStaffSchedule
): ResolvedStaffScheduleWindow | null {
  if (schedule.coverageKind !== "open_close") return null;
  const opening = schedule.windows.find((window) => window.shiftType === "opening");
  const closing = schedule.windows.find((window) => window.shiftType === "closing");
  if (!opening || !closing) return null;

  return {
    ...closing,
    shiftType: "closing",
    startTime: opening.startTime,
    endTime: closing.endTime,
    endsNextDay: closing.endsNextDay,
  };
}

function getAttendanceWindows(schedule: ResolvedStaffSchedule): ResolvedStaffScheduleWindow[] {
  const openCloseWindow = getOpenCloseAttendanceWindow(schedule);
  return openCloseWindow ? [openCloseWindow] : schedule.windows;
}

function scheduleSelectionFromWindow(params: {
  scanDate: string;
  scanTime: string;
  timezone?: string | null;
  schedule: ResolvedStaffSchedule;
  window: ResolvedStaffScheduleWindow;
}): AttendanceScheduleSelection {
  const effectiveWindow = getOpenCloseAttendanceWindow(params.schedule) ?? params.window;
  const scanMinutes = timeToMinutes(params.scanTime);
  const startMinutes = timeToMinutes(effectiveWindow.startTime);
  const openCloseClosing =
    params.schedule.coverageKind === "open_close"
      ? params.schedule.windows.find((window) => window.shiftType === "closing")
      : null;
  const openCloseEndMinutes = openCloseClosing ? timeToMinutes(openCloseClosing.endTime) : null;
  const crossesMidnight =
    effectiveWindow.endsNextDay ??
    isOvernightWindow(effectiveWindow.startTime, effectiveWindow.endTime);
  const shiftDate =
    crossesMidnight &&
    scanMinutes !== null &&
    startMinutes !== null &&
    (openCloseClosing
      ? openCloseEndMinutes !== null && scanMinutes <= openCloseEndMinutes
      : scanMinutes < startMinutes)
      ? addDaysToYmd(params.scanDate, -1)
      : params.scanDate;

  return {
    shiftDate,
    shiftType: effectiveWindow.shiftType,
    scheduledStartAt: branchDateTimeToIso({
      date: shiftDate,
      time: effectiveWindow.startTime,
      timezone: params.timezone,
    }),
    scheduledEndAt: branchDateTimeToIso({
      date: shiftDate,
      time: effectiveWindow.endTime,
      addDay: crossesMidnight,
      timezone: params.timezone,
    }),
    isUnscheduled: false,
    isDayOff: params.schedule.isDayOff,
    source: params.schedule.source,
    selectedWindow: effectiveWindow,
    windows: params.schedule.windows,
  };
}

function emptyScheduleSelection(params: {
  scanDate: string;
  schedule: ResolvedStaffSchedule;
}): AttendanceScheduleSelection {
  return {
    shiftDate: params.scanDate,
    shiftType: "single",
    scheduledStartAt: null,
    scheduledEndAt: null,
    isUnscheduled: true,
    isDayOff: params.schedule.isDayOff,
    source: params.schedule.source,
    selectedWindow: null,
    windows: params.schedule.windows,
  };
}

export function resolveStaffAttendanceSchedule(params: {
  scanDate: string;
  scanTime: string;
  timezone?: string | null;
  schedule: ResolvedStaffSchedule;
}): AttendanceScheduleSelection {
  const windows = getAttendanceWindows(params.schedule);
  const selected =
    windows.find((window) => isTimeWithinScheduleWindows(params.scanTime, [window])) ??
    windows.find((window) => {
      const start = timeToMinutes(window.startTime);
      const end = absoluteWindowEndMinutes(window);
      const current = absoluteScanMinutesForWindow(params.scanTime, window);
      if (start === null || end === null || current === null) return false;
      return current >= start - 120 && current <= end + 120;
    }) ??
    windows[0] ??
    null;

  if (!selected) {
    return emptyScheduleSelection({
      scanDate: params.scanDate,
      schedule: params.schedule,
    });
  }

  return scheduleSelectionFromWindow({
    scanDate: params.scanDate,
    scanTime: params.scanTime,
    timezone: params.timezone,
    schedule: params.schedule,
    window: selected,
  });
}

function intent(params: {
  type: AttendanceScanIntentType;
  action: AttendanceScanIntent["action"];
  schedule: AttendanceScheduleSelection;
  requiresRecovery?: boolean;
  shouldWriteAttendance?: boolean;
  severity?: AttendanceScanIntent["severity"];
  title: string;
  message: string;
}): AttendanceScanIntent {
  return {
    type: params.type,
    action: params.action,
    reasonCode: params.type,
    requiresRecovery: params.requiresRecovery ?? false,
    shouldWriteAttendance: params.shouldWriteAttendance ?? true,
    severity: params.severity ?? "info",
    title: params.title,
    message: params.message,
    schedule: params.schedule,
  };
}

function isUnsupportedScheduleState(schedule: ResolvedStaffSchedule): boolean {
  return (
    schedule.status === "conflict" ||
    schedule.state === "OVERLAPPING_WINDOWS" ||
    schedule.state === "INVALID_TIME_WINDOW" ||
    schedule.state === "INELIGIBLE_SHIFT_TYPE" ||
    schedule.state === "CONTRADICTORY_DAY_STATE"
  );
}

export function resolveAttendanceScanIntent(
  input: ResolveAttendanceScanIntentInput
): AttendanceScanIntent {
  const schedule = resolveStaffAttendanceSchedule({
    scanDate: input.scanDate,
    scanTime: input.scanTime,
    timezone: input.timezone ?? input.settings.timezone,
    schedule: input.schedule,
  });

  if (input.duplicateScan) {
    return intent({
      type: "duplicate_scan",
      action: "duplicate_scan",
      schedule,
      shouldWriteAttendance: false,
      title: "Duplicate scan",
      message: "A recent attendance scan was already recorded.",
    });
  }

  if (input.activeCheckin) {
    const scheduledEnd = input.activeCheckin.scheduledEndAt
      ? new Date(input.activeCheckin.scheduledEndAt).getTime()
      : NaN;
    const scanAt = new Date(input.scanIso).getTime();

    if (
      Number.isFinite(scheduledEnd) &&
      scanAt < scheduledEnd - input.settings.early_leave_threshold_minutes * 60000
    ) {
      return intent({
        type: "early_clock_out",
        action: "clock_out",
        schedule,
        title: "Early clock-out",
        message: "Clock-out is before the scheduled end time.",
      });
    }

    if (
      Number.isFinite(scheduledEnd) &&
      scanAt > scheduledEnd + input.settings.overtime_threshold_minutes * 60000
    ) {
      return intent({
        type: "overtime_clock_out",
        action: "clock_out",
        schedule,
        title: "Overtime clock-out",
        message: "Clock-out is after the scheduled end time.",
      });
    }

    return intent({
      type: "clock_out",
      action: "clock_out",
      schedule,
      title: "Clock-out",
      message: "Active attendance can be closed.",
    });
  }

  if (
    input.schedule.status === "not_operational" ||
    input.schedule.state === "STAFF_NOT_OPERATIONAL"
  ) {
    return intent({
      type: "staff_not_operational",
      action: "recovery_required",
      schedule,
      requiresRecovery: true,
      shouldWriteAttendance: false,
      severity: "critical",
      title: "Staff unavailable",
      message: "This staff member is not operational for attendance scans.",
    });
  }

  if (isUnsupportedScheduleState(input.schedule)) {
    return intent({
      type: "schedule_state_unsupported",
      action: "clock_in",
      schedule,
      requiresRecovery: true,
      shouldWriteAttendance: true,
      severity: "warning",
      title: "Schedule needs review",
      message:
        input.schedule.conflictReason ??
        "Attendance was recorded and the conflicting schedule needs review.",
    });
  }

  if (input.schedule.isDayOff) {
    return intent({
      type: "off_day_exception",
      action: "clock_in",
      schedule,
      requiresRecovery: true,
      shouldWriteAttendance: true,
      severity: "warning",
      title: "Off-day scan",
      message: "This staff member is marked off for this schedule day.",
    });
  }

  if (schedule.isUnscheduled) {
    return intent({
      type: "missing_schedule",
      action: "clock_in",
      schedule,
      requiresRecovery: true,
      shouldWriteAttendance: true,
      severity: "warning",
      title: "Missing schedule",
      message: "No resolved schedule window was found for this staff member.",
    });
  }

  const attendanceWindows = getAttendanceWindows(input.schedule);
  const clockOutWindow = attendanceWindows.find((window) =>
    isInClockOutWindow({
      scanTime: input.scanTime,
      settings: input.settings,
      window,
    })
  );
  if (clockOutWindow) {
    return closingScanRecoveryIntent({
      schedule: scheduleSelectionFromWindow({
        scanDate: input.scanDate,
        scanTime: input.scanTime,
        timezone: input.timezone ?? input.settings.timezone,
        schedule: input.schedule,
        window: clockOutWindow,
      }),
    });
  }

  const clockInWindow = attendanceWindows.find((window) =>
    isInClockInWindow({
      scanTime: input.scanTime,
      settings: input.settings,
      window,
    })
  );
  if (clockInWindow) {
    const clockInSchedule = scheduleSelectionFromWindow({
      scanDate: input.scanDate,
      scanTime: input.scanTime,
      timezone: input.timezone ?? input.settings.timezone,
      schedule: input.schedule,
      window: clockInWindow,
    });
    const type = clockInIntentForWindow({
      scanTime: input.scanTime,
      settings: input.settings,
      schedule: clockInSchedule,
    });

    return intent({
      type,
      action: "clock_in",
      schedule: clockInSchedule,
      title: type === "late_clock_in" ? "Late clock-in" : "Clock-in",
      message: "Attendance can be opened for this scheduled shift.",
    });
  }

  return intent({
    type: "ambiguous_scan",
    action: "clock_in",
    schedule,
    requiresRecovery: true,
    shouldWriteAttendance: true,
    severity: "warning",
    title: "Attendance recorded outside schedule",
    message:
      "The scan is outside the expected schedule windows. Attendance was recorded and flagged for review.",
  });
}

export function classifyAttendanceScan(
  input: ResolveAttendanceScanIntentInput
): AttendanceScanIntentType {
  return resolveAttendanceScanIntent(input).type;
}

export function applyAttendanceScanIntent(intentResult: AttendanceScanIntent): {
  writeAttendance: boolean;
  sendToRecovery: boolean;
  action: AttendanceScanIntent["action"];
} {
  return {
    writeAttendance: intentResult.shouldWriteAttendance,
    sendToRecovery: intentResult.requiresRecovery,
    action: intentResult.action,
  };
}

export function previewAttendanceScanRecovery(intentResult: AttendanceScanIntent): {
  title: string;
  message: string;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
} {
  return {
    title: intentResult.title,
    message: intentResult.message,
    scheduledStartAt: intentResult.schedule.scheduledStartAt,
    scheduledEndAt: intentResult.schedule.scheduledEndAt,
  };
}

export function resolveAttendanceDayForShift(params: {
  scanDate: string;
  scanTime: string;
  window: ResolvedStaffScheduleWindow;
}): string {
  const selection = scheduleSelectionFromWindow({
    scanDate: params.scanDate,
    scanTime: params.scanTime,
    schedule: {
      source: "none",
      status: "resolved",
      state: "VALID_SCHEDULE",
      isWorking: true,
      isDayOff: false,
      windows: [params.window],
    },
    window: params.window,
  });
  return selection.shiftDate;
}

export function minutesFromScheduleStart(params: {
  scanTime: string;
  window: ResolvedStaffScheduleWindow;
}): number {
  const current = absoluteScanMinutesForWindow(params.scanTime, params.window);
  const start = timeToMinutes(params.window.startTime);
  if (current === null || start === null) return 0;
  return minutesOrZero(current - start);
}
