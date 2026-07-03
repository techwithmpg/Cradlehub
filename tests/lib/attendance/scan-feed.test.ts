import { describe, expect, it } from "vitest";
import {
  buildAttendanceRecordHref,
  formatShiftTypeLabel,
  formatWorkedMinutesBadge,
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
    occurredAt: "2026-07-03T01:58:00.000Z",
    shiftType: "opening",
    attendanceStatus: "present",
    workedMinutes: null,
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
        scan({ eventType: "clock_out", workedMinutes: 545 })
      )
    ).toEqual({ label: "9h 05m", tone: "info" });
  });

  it("keeps short clock-out labels stable when duration is missing", () => {
    expect(formatWorkedMinutesBadge(null)).toBe("Clocked out");
    expect(formatWorkedMinutesBadge(25)).toBe("25m");
  });

  it("formats shift type labels for feed rows", () => {
    expect(formatShiftTypeLabel("opening")).toBe("Opening shift");
    expect(formatShiftTypeLabel("split_shift")).toBe("Split shift");
    expect(formatShiftTypeLabel(null)).toBe("Shift");
  });
});
