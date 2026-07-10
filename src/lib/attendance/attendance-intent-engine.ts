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
  | "likely_closing_scan_without_clock_in"
  | "missing_schedule"
  | "off_day_exception"
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
  settings: AttendanceSettings;
  schedule: ResolvedStaffSchedule;
  duplicateScan?: boolean;
  activeCheckin?: ActiveAttendanceIntentCheckin | null;
};

function minutesOrZero(value: number | null): number {
  return value ?? 0;
}

function absoluteScanMinutesForWindow(time: string, window: ResolvedStaffScheduleWindow): number | null {
  const current = timeToMinutes(time);
  const start = timeToMinutes(window.startTime);
  const end = timeToMinutes(window.endTime);
  if (current === null || start === null || end === null) return null;

  if (end <= start && current <= end) {
    return current + DAY_MINUTES;
  }

  return current;
}

function absoluteWindowEndMinutes(window: ResolvedStaffScheduleWindow): number | null {
  const start = timeToMinutes(window.startTime);
  const end = timeToMinutes(window.endTime);
  if (start === null || end === null) return null;
  return end <= start ? end + DAY_MINUTES : end;
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

function isTimeWithinSimpleRange(time: string, start: string, end: string): boolean {
  const current = timeToMinutes(time);
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (current === null || startMinutes === null || endMinutes === null) return false;

  if (endMinutes < startMinutes) {
    return current >= startMinutes || current <= endMinutes;
  }

  return current >= startMinutes && current <= endMinutes;
}

function isDateInLaunchRecoveryRange(date: string, settings: AttendanceSettings): boolean {
  if (!settings.launch_recovery_enabled) return false;
  if (settings.launch_recovery_start_date && date < settings.launch_recovery_start_date) return false;
  if (settings.launch_recovery_end_date && date > settings.launch_recovery_end_date) return false;
  return true;
}

function isLaunchRecoveryClosingScan(input: ResolveAttendanceScanIntentInput): boolean {
  if (!isDateInLaunchRecoveryRange(input.scanDate, input.settings)) return false;
  return isTimeWithinSimpleRange(
    input.scanTime,
    input.settings.launch_recovery_closing_start_time,
    input.settings.launch_recovery_closing_end_time
  );
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
  const start = params.schedule.selectedWindow ? timeToMinutes(params.schedule.selectedWindow.startTime) : null;
  if (current === null || start === null) return "clock_in";
  if (current < start) return "early_clock_in";
  if (current > start + params.settings.late_grace_minutes) return "late_clock_in";
  return "clock_in";
}

function scheduleSelectionFromWindow(params: {
  scanDate: string;
  scanTime: string;
  schedule: ResolvedStaffSchedule;
  window: ResolvedStaffScheduleWindow;
}): AttendanceScheduleSelection {
  const scanMinutes = timeToMinutes(params.scanTime);
  const startMinutes = timeToMinutes(params.window.startTime);
  const shiftDate =
    isOvernightWindow(params.window.startTime, params.window.endTime) &&
    scanMinutes !== null &&
    startMinutes !== null &&
    scanMinutes < startMinutes
      ? addDaysToYmd(params.scanDate, -1)
      : params.scanDate;

  return {
    shiftDate,
    shiftType: params.window.shiftType,
    scheduledStartAt: branchDateTimeToIso({ date: shiftDate, time: params.window.startTime }),
    scheduledEndAt: branchDateTimeToIso({
      date: shiftDate,
      time: params.window.endTime,
      addDay: isOvernightWindow(params.window.startTime, params.window.endTime),
    }),
    isUnscheduled: false,
    isDayOff: params.schedule.isDayOff,
    source: params.schedule.source,
    selectedWindow: params.window,
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
  schedule: ResolvedStaffSchedule;
}): AttendanceScheduleSelection {
  const windows = params.schedule.windows;
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

export function resolveAttendanceScanIntent(input: ResolveAttendanceScanIntentInput): AttendanceScanIntent {
  const schedule = resolveStaffAttendanceSchedule({
    scanDate: input.scanDate,
    scanTime: input.scanTime,
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

  if (isLaunchRecoveryClosingScan(input)) {
    return intent({
      type: "likely_closing_scan_without_clock_in",
      action: "recovery_required",
      schedule,
      requiresRecovery: true,
      shouldWriteAttendance: false,
      severity: "warning",
      title: "Closing scan needs recovery",
      message: "This looks like a closing scan, but no earlier clock-in was found.",
    });
  }

  if (input.schedule.isDayOff) {
    return intent({
      type: "off_day_exception",
      action: "recovery_required",
      schedule,
      requiresRecovery: true,
      shouldWriteAttendance: input.settings.off_day_scan_behavior === "allow_clock_in_with_exception",
      severity: "warning",
      title: "Off-day scan",
      message: "This staff member is marked off for this schedule day.",
    });
  }

  if (schedule.isUnscheduled) {
    return intent({
      type: "missing_schedule",
      action: "recovery_required",
      schedule,
      requiresRecovery: true,
      shouldWriteAttendance: input.settings.missing_schedule_behavior === "allow_clock_in_with_exception",
      severity: "warning",
      title: "Missing schedule",
      message: "No resolved schedule window was found for this staff member.",
    });
  }

  const clockOutWindow = input.schedule.windows.find((window) =>
    isInClockOutWindow({
      scanTime: input.scanTime,
      settings: input.settings,
      window,
    })
  );
  if (clockOutWindow) {
    return intent({
      type: "likely_closing_scan_without_clock_in",
      action: "recovery_required",
      schedule: scheduleSelectionFromWindow({
        scanDate: input.scanDate,
        scanTime: input.scanTime,
        schedule: input.schedule,
        window: clockOutWindow,
      }),
      requiresRecovery: true,
      shouldWriteAttendance: false,
      severity: "warning",
      title: "Closing scan needs recovery",
      message: "This looks like a clock-out scan, but no earlier clock-in was found.",
    });
  }

  const clockInWindow = input.schedule.windows.find((window) =>
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
    action: "recovery_required",
    schedule,
    requiresRecovery: true,
    shouldWriteAttendance: false,
    severity: "warning",
    title: "Scan needs review",
    message: "The scan is outside the configured clock-in and clock-out windows.",
  });
}

export function classifyAttendanceScan(input: ResolveAttendanceScanIntentInput): AttendanceScanIntentType {
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
