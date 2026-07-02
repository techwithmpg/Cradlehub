import { BRANCH_TIMEZONE, getBranchBusinessDate, getBranchTime } from "@/lib/engine/slot-time";
import { timeToMinutes } from "@/lib/utils/time-format";

const MANILA_OFFSET = "+08:00";

export type AttendanceMetricInput = {
  checkedInAt: string;
  checkedOutAt?: string | null;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
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

export function branchDateTimeToIso(params: {
  date: string;
  time: string;
  addDay?: boolean;
}): string {
  const date = params.addDay ? addDaysToYmd(params.date, 1) : params.date;
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

  const lateMinutes =
    Number.isFinite(scheduledStart) && clockIn > scheduledStart + input.lateGraceMinutes * 60000
      ? Math.round((clockIn - scheduledStart) / 60000)
      : 0;

  const earlyLeaveMinutes =
    Number.isFinite(scheduledEnd) && clockOut < scheduledEnd - input.earlyLeaveGraceMinutes * 60000
      ? Math.round((scheduledEnd - clockOut) / 60000)
      : 0;

  const overtimeMinutes =
    Number.isFinite(scheduledEnd) && clockOut > scheduledEnd
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
