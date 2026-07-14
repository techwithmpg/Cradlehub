import { BRANCH_TIMEZONE, getBranchBusinessDate, getBranchTime } from "@/lib/engine/slot-time";
import { timeToMinutes } from "@/lib/utils/time-format";

const MANILA_OFFSET = "+08:00";
const DEFAULT_BRANCH_TIMEZONE = "Asia/Manila";

export type AttendanceMetricInput = {
  checkedInAt: string;
  checkedOutAt?: string | null;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  earliestNormalClockOutAt?: string | null;
  latestNormalClockOutAt?: string | null;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
};

export type AttendanceMetricResult = {
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  attendanceStatus: "present" | "late" | "early_leave" | "overtime";
  exceptionState: "none" | "open";
};

export function normalizeTimeForDateTime(time: string): string {
  const [hh = "00", mm = "00", ss = "00"] = time.split(":");
  return `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:${ss.padStart(2, "0")}`;
}

export function addDaysToYmd(ymd: string, days: number): string {
  const [year = "0", month = "1", day = "1"] = ymd.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + days));
  return date.toISOString().slice(0, 10);
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

function parseBranchDateTime(date: string, time: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const [year = "0", month = "1", day = "1"] = date.split("-");
  const [hour = "0", minute = "0", second = "0"] = normalizeTimeForDateTime(time).split(":");
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
}

function branchDateTimeToIsoWithTimezone(params: {
  date: string;
  time: string;
  timezone: string;
}): string {
  const desiredParts = parseBranchDateTime(params.date, params.time);
  const desiredLocalEpoch = localEpoch(desiredParts);
  let utcGuess = desiredLocalEpoch;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observedParts = localPartsForInstant(new Date(utcGuess), params.timezone);
    const observedLocalEpoch = localEpoch(observedParts);
    const delta = desiredLocalEpoch - observedLocalEpoch;
    if (delta === 0) break;
    utcGuess += delta;
  }

  return new Date(utcGuess).toISOString();
}

export function branchDateTimeToIso(params: {
  date: string;
  time: string;
  addDay?: boolean;
  timezone?: string | null;
}): string {
  const date = params.addDay ? addDaysToYmd(params.date, 1) : params.date;
  const timezone = params.timezone?.trim();
  if (timezone && timezone !== DEFAULT_BRANCH_TIMEZONE) {
    return branchDateTimeToIsoWithTimezone({
      date,
      time: params.time,
      timezone,
    });
  }
  return new Date(`${date}T${normalizeTimeForDateTime(params.time)}${MANILA_OFFSET}`).toISOString();
}

export function isOvernightWindow(startTime: string, endTime: string): boolean {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return start !== null && end !== null && end <= start;
}

export function getBranchNow(now: Date = new Date()): {
  date: string;
  time: string;
  minutesIntoDay: number;
} {
  const branch = getBranchTime(now, BRANCH_TIMEZONE);
  const hours = Math.floor(branch.minutesIntoDay / 60);
  const minutes = Math.floor(branch.minutesIntoDay % 60);
  return {
    date: getBranchBusinessDate(now, BRANCH_TIMEZONE),
    time: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`,
    minutesIntoDay: branch.minutesIntoDay,
  };
}

export function minutesBetween(startIso: string | null | undefined, endIso: string | null | undefined): number {
  if (!startIso || !endIso) return 0;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 60000);
}

export function computeAttendanceMetrics(input: AttendanceMetricInput): AttendanceMetricResult {
  const end = input.checkedOutAt ?? new Date().toISOString();
  const workedMinutes = minutesBetween(input.checkedInAt, end);
  const clockIn = new Date(input.checkedInAt).getTime();
  const clockOut = new Date(end).getTime();
  const scheduledStart = input.scheduledStartAt ? new Date(input.scheduledStartAt).getTime() : NaN;
  const scheduledEnd = input.scheduledEndAt ? new Date(input.scheduledEndAt).getTime() : NaN;
  const earliestNormalClockOut = input.earliestNormalClockOutAt
    ? new Date(input.earliestNormalClockOutAt).getTime()
    : NaN;
  const latestNormalClockOut = input.latestNormalClockOutAt
    ? new Date(input.latestNormalClockOutAt).getTime()
    : NaN;

  const lateMinutes =
    Number.isFinite(scheduledStart) && clockIn > scheduledStart + input.lateGraceMinutes * 60000
      ? Math.round((clockIn - scheduledStart) / 60000)
      : 0;

  const earlyLeaveMinutes =
    Number.isFinite(earliestNormalClockOut)
      ? clockOut < earliestNormalClockOut
        ? Math.round((earliestNormalClockOut - clockOut) / 60000)
        : 0
      : Number.isFinite(scheduledEnd) && clockOut < scheduledEnd - input.earlyLeaveGraceMinutes * 60000
          ? Math.round((scheduledEnd - clockOut) / 60000)
          : 0;

  const overtimeMinutes =
    Number.isFinite(latestNormalClockOut)
      ? clockOut > latestNormalClockOut
        ? Math.round((clockOut - latestNormalClockOut) / 60000)
        : 0
      : Number.isFinite(scheduledEnd) && clockOut > scheduledEnd
          ? Math.round((clockOut - scheduledEnd) / 60000)
          : 0;

  let attendanceStatus: AttendanceMetricResult["attendanceStatus"] = "present";
  if (lateMinutes > 0) attendanceStatus = "late";
  else if (earlyLeaveMinutes > 0) attendanceStatus = "early_leave";
  else if (overtimeMinutes > 0) attendanceStatus = "overtime";

  return {
    workedMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    overtimeMinutes,
    attendanceStatus,
    exceptionState: lateMinutes > 0 || earlyLeaveMinutes > 0 || overtimeMinutes > 0 ? "open" : "none",
  };
}

export function formatMinutesCompact(minutes: number): string {
  if (minutes <= 0) return "0m";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
