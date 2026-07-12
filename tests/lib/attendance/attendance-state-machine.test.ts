import { describe, expect, it } from "vitest";
import {
  describeAttendanceNextAction,
  nextActionForAttendanceState,
  resolveAttendanceState,
} from "@/lib/attendance/attendance-state-machine";

describe("attendance state machine", () => {
  it("returns clock out when a matching open check-in remains", () => {
    const state = resolveAttendanceState({
      schedule: { isUnscheduled: false, isDayOff: false },
      matchingOpenCheckin: {
        id: "open-1",
        status: "checked_in",
      },
    });

    expect(nextActionForAttendanceState(state)).toBe("clock_out");
    expect(describeAttendanceNextAction("clock_out")).toBe("Clock Out");
  });

  it("returns clock in when no open current session remains", () => {
    const state = resolveAttendanceState({
      schedule: { isUnscheduled: false, isDayOff: false },
      matchingOpenCheckin: null,
    });

    expect(nextActionForAttendanceState(state)).toBe("clock_in");
  });

  it("does not turn conflicting sessions into a normal next action", () => {
    const state = resolveAttendanceState({
      schedule: { isUnscheduled: false, isDayOff: false },
      hasConflictingOpenCheckins: true,
    });

    expect(nextActionForAttendanceState(state)).toBe("recovery_required");
  });

  it("distinguishes off-day and missing schedule states", () => {
    expect(
      nextActionForAttendanceState(
        resolveAttendanceState({
          schedule: { isUnscheduled: false, isDayOff: true },
        })
      )
    ).toBe("off_day");

    expect(
      nextActionForAttendanceState(
        resolveAttendanceState({
          schedule: { isUnscheduled: true, isDayOff: false },
        })
      )
    ).toBe("no_current_shift");
  });
});
