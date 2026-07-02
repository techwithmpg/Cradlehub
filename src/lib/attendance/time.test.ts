import { describe, expect, it } from "vitest";
import {
  branchDateTimeToIso,
  computeAttendanceMetrics,
  isOvernightWindow,
} from "@/lib/attendance/time";

describe("attendance time helpers", () => {
  it("computes late minutes beyond grace", () => {
    const result = computeAttendanceMetrics({
      checkedInAt: "2026-07-02T01:20:00.000Z",
      checkedOutAt: "2026-07-02T09:00:00.000Z",
      scheduledStartAt: "2026-07-02T01:00:00.000Z",
      scheduledEndAt: "2026-07-02T09:00:00.000Z",
      lateGraceMinutes: 5,
      earlyLeaveGraceMinutes: 5,
    });

    expect(result.lateMinutes).toBe(20);
    expect(result.attendanceStatus).toBe("late");
    expect(result.exceptionState).toBe("open");
  });

  it("computes early leave and overtime", () => {
    const early = computeAttendanceMetrics({
      checkedInAt: "2026-07-02T01:00:00.000Z",
      checkedOutAt: "2026-07-02T08:40:00.000Z",
      scheduledStartAt: "2026-07-02T01:00:00.000Z",
      scheduledEndAt: "2026-07-02T09:00:00.000Z",
      lateGraceMinutes: 5,
      earlyLeaveGraceMinutes: 5,
    });

    const overtime = computeAttendanceMetrics({
      checkedInAt: "2026-07-02T01:00:00.000Z",
      checkedOutAt: "2026-07-02T09:25:00.000Z",
      scheduledStartAt: "2026-07-02T01:00:00.000Z",
      scheduledEndAt: "2026-07-02T09:00:00.000Z",
      lateGraceMinutes: 5,
      earlyLeaveGraceMinutes: 5,
    });

    expect(early.earlyLeaveMinutes).toBe(20);
    expect(early.attendanceStatus).toBe("early_leave");
    expect(overtime.overtimeMinutes).toBe(25);
    expect(overtime.attendanceStatus).toBe("overtime");
  });

  it("builds overnight branch datetimes", () => {
    expect(isOvernightWindow("22:00", "06:00")).toBe(true);
    expect(branchDateTimeToIso({ date: "2026-07-02", time: "06:00", addDay: true }))
      .toBe("2026-07-02T22:00:00.000Z");
  });
});
