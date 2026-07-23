import type {
  ResolvedStaffSchedule,
  ResolvedStaffScheduleWindow,
} from "@/lib/schedule/resolve-staff-schedule";

export function getOpenCloseAttendanceWindow(
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

export function getAttendanceScheduleWindows(
  schedule: ResolvedStaffSchedule
): ResolvedStaffScheduleWindow[] {
  const openCloseWindow = getOpenCloseAttendanceWindow(schedule);
  return openCloseWindow ? [openCloseWindow] : schedule.windows;
}
