import type { AttendanceScheduleSelection } from "@/lib/attendance/attendance-intent-engine";
import type { ResolvedStaffSchedule } from "@/lib/schedule/resolve-staff-schedule";

/** Owner policy: earliest ordinary clock-in is exactly 60 minutes before shift start. */
export const EARLIEST_CLOCK_IN_MINUTES = 60;

export function mayOpenScheduledAttendance(input: {
  scanIso: string;
  schedule: AttendanceScheduleSelection;
  resolvedSchedule: ResolvedStaffSchedule;
}): boolean {
  const { schedule, resolvedSchedule } = input;
  if (
    resolvedSchedule.status !== "resolved" ||
    !resolvedSchedule.isWorking ||
    resolvedSchedule.isDayOff ||
    schedule.isUnscheduled ||
    schedule.isDayOff ||
    !schedule.selectedWindow ||
    !schedule.scheduledStartAt ||
    !schedule.scheduledEndAt
  ) return false;

  const scan = Date.parse(input.scanIso);
  const start = Date.parse(schedule.scheduledStartAt);
  const end = Date.parse(schedule.scheduledEndAt);
  if (![scan, start, end].every(Number.isFinite) || end <= start) return false;

  // Late first scans during an authorized shift retain existing review behavior.
  // Established clock-outs and last-service extensions are NOT gated here.
  return scan >= start - EARLIEST_CLOCK_IN_MINUTES * 60_000 && scan < end;
}

/** A still-open shift at the same branch and business date is for clock-out, not next-day clock-in. */
export function isOpenShiftForCurrentAttendanceDay(input: {
  openBranchId: string;
  openAttendanceBusinessDate: string | null;
  openShiftDate: string;
  scannedBranchId: string;
  scannedBusinessDate: string;
}): boolean {
  return (
    input.openBranchId === input.scannedBranchId &&
    (input.openAttendanceBusinessDate ?? input.openShiftDate) === input.scannedBusinessDate
  );
}
