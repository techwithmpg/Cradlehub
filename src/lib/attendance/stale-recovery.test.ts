import { describe, expect, it } from "vitest";
import { resolveStaleAttendanceRecoveryClockOutAt } from "@/lib/attendance/stale-recovery";

describe("stale Attendance recovery", () => {
  it("uses the old shift policy instead of the current-day scan", () => {
    expect(resolveStaleAttendanceRecoveryClockOutAt({
      checkedInAt: "2026-07-19T01:00:00.000Z",
      attendanceExpectedEndAt: "2026-07-19T09:00:00.000Z",
      latestNormalClockOutAt: "2026-07-19T09:30:00.000Z",
      nowIso: "2026-07-21T01:00:00.000Z",
    })).toBe("2026-07-19T09:00:00.000Z");
  });

  it("caps an unscheduled stale record instead of creating a multi-day shift", () => {
    expect(resolveStaleAttendanceRecoveryClockOutAt({
      checkedInAt: "2026-07-19T01:00:00.000Z",
      nowIso: "2026-07-21T01:00:00.000Z",
    })).toBe("2026-07-19T17:00:00.000Z");
  });

  it("does not recover a future or malformed record", () => {
    expect(resolveStaleAttendanceRecoveryClockOutAt({
      checkedInAt: "2026-07-22T01:00:00.000Z",
      nowIso: "2026-07-21T01:00:00.000Z",
    })).toBeNull();
  });
});
