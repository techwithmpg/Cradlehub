import type { AttendanceScheduleSelection } from "@/lib/attendance/attendance-intent-engine";

export type AttendanceSessionState =
  | "no_current_shift"
  | "off_day"
  | "needs_recovery"
  | "ready_to_clock_in"
  | "ready_to_clock_out"
  | "already_completed";

export type AttendanceNextAction =
  | "no_current_shift"
  | "off_day"
  | "recovery_required"
  | "clock_in"
  | "clock_out"
  | "already_checked_out";

export type AttendanceStateMachineCheckin = {
  id: string;
  status: string | null;
  checkedOutAt?: string | null;
  shiftInstanceKey?: string | null;
};

export function resolveAttendanceState(params: {
  schedule: Pick<AttendanceScheduleSelection, "isUnscheduled" | "isDayOff">;
  matchingOpenCheckin?: AttendanceStateMachineCheckin | null;
  completedCurrentShift?: AttendanceStateMachineCheckin | null;
  hasConflictingOpenCheckins?: boolean;
}): AttendanceSessionState {
  if (params.hasConflictingOpenCheckins) return "needs_recovery";
  if (params.matchingOpenCheckin?.status === "checked_in") return "ready_to_clock_out";
  if (params.completedCurrentShift?.status === "checked_out" || params.completedCurrentShift?.checkedOutAt) {
    return "already_completed";
  }
  if (params.schedule.isDayOff) return "off_day";
  if (params.schedule.isUnscheduled) return "no_current_shift";
  return "ready_to_clock_in";
}

export function nextActionForAttendanceState(
  state: AttendanceSessionState
): AttendanceNextAction {
  if (state === "ready_to_clock_in") return "clock_in";
  if (state === "ready_to_clock_out") return "clock_out";
  if (state === "already_completed") return "already_checked_out";
  if (state === "off_day") return "off_day";
  if (state === "no_current_shift") return "no_current_shift";
  return "recovery_required";
}

export function describeAttendanceNextAction(action: AttendanceNextAction): string {
  switch (action) {
    case "clock_in":
      return "Clock In";
    case "clock_out":
      return "Clock Out";
    case "already_checked_out":
      return "Already Checked Out";
    case "off_day":
      return "Off Day";
    case "no_current_shift":
      return "No Current Shift";
    case "recovery_required":
      return "Recovery Required";
  }
}
