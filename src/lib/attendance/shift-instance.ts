import { addDaysToYmd, getBranchTime } from "@/lib/engine/slot-time";
import { timeToMinutes } from "@/lib/utils/time-format";
import type { AttendanceScheduleSelection } from "@/lib/attendance/attendance-intent-engine";
import type { AttendanceSettings } from "@/lib/attendance/types";

const DEFAULT_ATTENDANCE_TIMEZONE = "Asia/Manila";
const DEFAULT_ATTENDANCE_DAY_BOUNDARY = "06:00:00";

export type AttendanceScheduleSourceType =
  | "weekly"
  | "override"
  | "recovery"
  | "none";

export type AttendanceShiftInstance = {
  key: string;
  staffId: string;
  branchId: string;
  businessDate: string;
  shiftType: string;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  sourceType: AttendanceScheduleSourceType;
  sourceId: string | null;
  isOvernight: boolean;
  branchTimezone: string;
  attendanceBusinessDate: string;
};

export type AttendanceBranchNow = {
  localDate: string;
  businessDate: string;
  time: string;
  minutesIntoDay: number;
  timezone: string;
  dayBoundary: string;
};

function normalizeTimezone(value: string | null | undefined): string {
  const timezone = value?.trim();
  return timezone || DEFAULT_ATTENDANCE_TIMEZONE;
}

function normalizeBoundary(value: string | null | undefined): string {
  const boundary = value?.trim();
  return boundary || DEFAULT_ATTENDANCE_DAY_BOUNDARY;
}

function normalizeTimeForKey(value: string | null | undefined): string {
  return value?.trim().slice(0, 8) || "none";
}

function minutesToClockTime(minutesIntoDay: number): string {
  const totalSeconds = Math.floor(minutesIntoDay * 60);
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":");
}

function localEpoch(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
}

function localPartsForInstant(instant: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

function parseLocalDateTime(date: string, time: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const [year = "0", month = "1", day = "1"] = date.split("-");
  const [hour = "0", minute = "0", second = "0"] = normalizeTimeForKey(time).split(":");
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
}

export function branchDateTimeToIsoInTimezone(params: {
  date: string;
  time: string;
  timezone?: string | null;
  addDay?: boolean;
}): string {
  const timezone = normalizeTimezone(params.timezone);
  const date = params.addDay ? addDaysToYmd(params.date, 1) : params.date;
  const desiredParts = parseLocalDateTime(date, params.time);
  const desiredLocalEpoch = localEpoch(desiredParts);
  let utcGuess = desiredLocalEpoch;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observedParts = localPartsForInstant(new Date(utcGuess), timezone);
    const observedLocalEpoch = localEpoch(observedParts);
    const delta = desiredLocalEpoch - observedLocalEpoch;
    if (delta === 0) break;
    utcGuess += delta;
  }

  return new Date(utcGuess).toISOString();
}

export function getAttendanceBranchNow(
  settings: Pick<AttendanceSettings, "timezone" | "attendance_day_boundary">,
  now: Date = new Date()
): AttendanceBranchNow {
  const timezone = normalizeTimezone(settings.timezone);
  const dayBoundary = normalizeBoundary(settings.attendance_day_boundary);
  const branch = getBranchTime(now, timezone);
  const boundaryMinutes = timeToMinutes(dayBoundary) ?? 0;
  const businessDate =
    branch.minutesIntoDay < boundaryMinutes
      ? addDaysToYmd(branch.ymd, -1)
      : branch.ymd;

  return {
    localDate: branch.ymd,
    businessDate,
    time: minutesToClockTime(branch.minutesIntoDay),
    minutesIntoDay: branch.minutesIntoDay,
    timezone,
    dayBoundary,
  };
}

export function scheduleSourceType(
  schedule: Pick<AttendanceScheduleSelection, "source" | "isUnscheduled" | "isDayOff">
): AttendanceScheduleSourceType {
  if (schedule.source === "override") return "override";
  if (schedule.source === "individual") return "weekly";
  if (schedule.isUnscheduled || schedule.isDayOff) return "recovery";
  return "none";
}

export function buildAttendanceShiftInstance(params: {
  staffId: string;
  branchId: string;
  schedule: AttendanceScheduleSelection;
  businessDate: string;
  branchTimezone: string;
  scheduleSourceId?: string | null;
}): AttendanceShiftInstance {
  const selectedWindow = params.schedule.selectedWindow;
  const isOvernight = Boolean(
    selectedWindow &&
      (selectedWindow.endsNextDay ??
        (timeToMinutes(selectedWindow.endTime) ?? 0) <=
          (timeToMinutes(selectedWindow.startTime) ?? 0))
  );
  const sourceType = scheduleSourceType(params.schedule);
  const sourceId = params.scheduleSourceId ?? selectedWindow?.id ?? null;
  const windowOrder = selectedWindow?.windowOrder ?? 1;
  const keyParts = [
    params.staffId,
    params.branchId,
    params.schedule.shiftDate,
    params.schedule.shiftType,
    `window:${windowOrder}`,
    normalizeTimeForKey(selectedWindow?.startTime),
    normalizeTimeForKey(selectedWindow?.endTime),
    sourceType,
    sourceId ?? "none",
  ];

  return {
    key: keyParts.join("|"),
    staffId: params.staffId,
    branchId: params.branchId,
    businessDate: params.businessDate,
    shiftType: params.schedule.shiftType,
    scheduledStartAt: params.schedule.scheduledStartAt,
    scheduledEndAt: params.schedule.scheduledEndAt,
    sourceType,
    sourceId,
    isOvernight,
    branchTimezone: normalizeTimezone(params.branchTimezone),
    attendanceBusinessDate: params.businessDate,
  };
}
