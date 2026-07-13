import { describe, expect, it } from "vitest";
import {
  attendanceCompletedDurationNeedsReview,
  buildAttendanceRecordHref,
  formatShiftTypeLabel,
  formatWorkedMinutesBadge,
  getAttendanceScanDurationDetail,
  getAttendanceScanBadge,
} from "@/lib/attendance/scan-feed";
import type { RecentAttendanceScan } from "@/lib/attendance/types";

function scan(overrides: Partial<RecentAttendanceScan> = {}): RecentAttendanceScan {
  return {
    eventId: "scan-1",
    staffId: "staff-1",
    staffName: "Virgilio Balatayo",
    staffNickname: null,
    staffAvatarUrl: null,
    branchId: "branch-1",
    branchName: "Main Branch",
    eventType: "clock_in",
    outcome: "success",
    reasonCode: "clock_in",
    message: "Clock-in recorded.",
    occurredAt: "2026-07-03T01:58:00.000Z",
    timezone: "Asia/Manila",
    shiftType: "opening",
    attendanceStatus: "present",
    workedMinutes: null,
    clockInAt: "2026-07-03T01:00:00.000Z",
    clockOutAt: null,
    sourceLabel: "Main Attendance",
    ...overrides,
  };
}

describe("attendance scan feed helpers", () => {
  it("builds CRM record deep links with staff and date filters", () => {
    expect(
      buildAttendanceRecordHref({
        workspace: "crm",
        selectedDate: "2026-07-03",
        staffId: "staff-1",
        branchId: "branch-1",
      })
    ).toBe("/crm/attendance?tab=records&date=2026-07-03&staffId=staff-1");
  });

  it("builds owner record deep links with branch context", () => {
    expect(
      buildAttendanceRecordHref({
        workspace: "owner",
        selectedDate: "2026-07-03",
        staffId: "staff-1",
        branchId: "branch-1",
      })
    ).toBe(
      "/owner/attendance?tab=records&date=2026-07-03&staffId=staff-1&branchId=branch-1"
    );
  });

  it("formats scan badges for on-duty, late, and clock-out states", () => {
    expect(getAttendanceScanBadge(scan())).toEqual({
      label: "On duty",
      tone: "good",
    });
    expect(getAttendanceScanBadge(scan({ attendanceStatus: "late" }))).toEqual({
      label: "Late",
      tone: "warn",
    });
    expect(
      getAttendanceScanBadge(
        scan({
          eventType: "clock_out",
          workedMinutes: 545,
          clockOutAt: "2026-07-03T10:05:00.000Z",
        })
      )
    ).toEqual({ label: "Completed", tone: "good" });
  });

  it("keeps completed duration as secondary detail", () => {
    expect(formatWorkedMinutesBadge(null)).toBe("Clocked out");
    expect(formatWorkedMinutesBadge(25)).toBe("25m");
    expect(
      getAttendanceScanDurationDetail(
        scan({
          eventType: "clock_out",
          workedMinutes: 545,
          clockOutAt: "2026-07-03T10:05:00.000Z",
        })
      )
    ).toBe("9h 05m");
  });

  it("marks impossible completed durations for review instead of displaying the raw value", () => {
    const longShift = scan({
      eventType: "clock_out",
      workedMinutes: 4220,
      clockOutAt: "2026-07-05T23:20:00.000Z",
    });

    expect(attendanceCompletedDurationNeedsReview(longShift)).toBe(true);
    expect(getAttendanceScanBadge(longShift)).toEqual({
      label: "Needs review",
      tone: "warn",
    });
    expect(getAttendanceScanDurationDetail(longShift)).toBeNull();
  });

  it("marks clock-out records inconsistent with clock timestamps for review", () => {
    const inconsistent = scan({
      eventType: "clock_out",
      workedMinutes: 60,
      clockInAt: "2026-07-03T01:00:00.000Z",
      clockOutAt: "2026-07-03T10:05:00.000Z",
    });

    expect(attendanceCompletedDurationNeedsReview(inconsistent)).toBe(true);
    expect(getAttendanceScanBadge(inconsistent).label).toBe("Needs review");
  });

  it("formats shift type labels for feed rows", () => {
    expect(formatShiftTypeLabel("opening")).toBe("Opening shift");
    expect(formatShiftTypeLabel("split_shift")).toBe("Split shift");
    expect(formatShiftTypeLabel(null)).toBe("Shift");
  });
});
