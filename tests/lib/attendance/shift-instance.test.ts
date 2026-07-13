import { describe, expect, it } from "vitest";
import { resolveAttendanceScanIntent } from "@/lib/attendance/attendance-intent-engine";
import {
  branchDateTimeToIsoInTimezone,
  buildAttendanceShiftInstance,
  getAttendanceBranchNow,
} from "@/lib/attendance/shift-instance";
import type { AttendanceScheduleSelection } from "@/lib/attendance/attendance-intent-engine";
import type { AttendanceSettings } from "@/lib/attendance/types";
import type { ResolvedStaffSchedule } from "@/lib/schedule/resolve-staff-schedule";

const baseSettings: AttendanceSettings = {
  branch_id: "branch-1",
  duplicate_scan_window_seconds: 90,
  clock_in_early_grace_minutes: 15,
  clock_in_late_grace_minutes: 5,
  clock_out_early_grace_minutes: 5,
  clock_out_late_grace_minutes: 15,
  overnight_shift_cutoff_time: "06:00:00",
  active_service_blocks_clock_out: true,
  require_registered_device_for_attendance: false,
  timezone: "Asia/Manila",
  attendance_day_boundary: "06:00:00",
  early_clock_in_allowed_minutes: 30,
  late_grace_minutes: 10,
  clock_in_window_before_shift_minutes: 30,
  clock_in_window_after_shift_start_minutes: 120,
  clock_out_window_before_shift_end_minutes: 120,
  clock_out_window_after_shift_end_minutes: 120,
  early_leave_threshold_minutes: 5,
  overtime_threshold_minutes: 15,
  duplicate_scan_debounce_minutes: 3,
  first_scan_closing_behavior: "flag_for_recovery",
  missing_schedule_behavior: "flag_for_recovery",
  off_day_scan_behavior: "flag_for_recovery",
  ambiguous_scan_behavior: "flag_for_recovery",
  launch_recovery_enabled: false,
  launch_recovery_start_date: null,
  launch_recovery_end_date: null,
  launch_recovery_closing_start_time: "20:30:00",
  launch_recovery_closing_end_time: "23:59:00",
  launch_recovery_reason: null,
  test_mode_enabled: false,
  test_mode_reason: null,
  test_mode_enabled_at: null,
  test_mode_enabled_by: null,
  test_mode_disabled_at: null,
  test_mode_disabled_by: null,
  updated_by: null,
};

const schedule: ResolvedStaffSchedule = {
  source: "individual",
  status: "resolved",
  state: "VALID_SCHEDULE",
  isWorking: true,
  isDayOff: false,
  windows: [{
    id: "weekly-row-1",
    windowOrder: 1,
    shiftType: "single",
    startTime: "09:00:00",
    endTime: "18:00:00",
  }],
};

describe("attendance shift instances", () => {
  it("converts Manila schedule timestamps using the branch timezone default", () => {
    expect(
      branchDateTimeToIsoInTimezone({
        date: "2026-07-10",
        time: "09:00:00",
        timezone: "Asia/Manila",
      })
    ).toBe("2026-07-10T01:00:00.000Z");
  });

  it("converts daylight-saving branch timestamps without hardcoded offsets", () => {
    expect(
      branchDateTimeToIsoInTimezone({
        date: "2026-07-10",
        time: "09:00:00",
        timezone: "America/New_York",
      })
    ).toBe("2026-07-10T13:00:00.000Z");

    expect(
      branchDateTimeToIsoInTimezone({
        date: "2026-01-10",
        time: "09:00:00",
        timezone: "America/New_York",
      })
    ).toBe("2026-01-10T14:00:00.000Z");
  });

  it("uses the attendance day boundary for business date", () => {
    const branchNow = getAttendanceBranchNow(
      {
        timezone: "Asia/Manila",
        attendance_day_boundary: "06:00:00",
      },
      new Date("2026-07-10T21:30:00.000Z")
    );

    expect(branchNow.localDate).toBe("2026-07-11");
    expect(branchNow.time).toBe("05:30:00");
    expect(branchNow.businessDate).toBe("2026-07-10");
  });

  it("captures stable shift-instance identity and schedule source", () => {
    const intent = resolveAttendanceScanIntent({
      scanIso: "2026-07-10T13:05:00.000Z",
      scanDate: "2026-07-10",
      scanTime: "09:05:00",
      timezone: "America/New_York",
      settings: { ...baseSettings, timezone: "America/New_York" },
      schedule,
    });

    const instance = buildAttendanceShiftInstance({
      staffId: "staff-1",
      branchId: "branch-1",
      schedule: intent.schedule,
      businessDate: "2026-07-10",
      branchTimezone: "America/New_York",
    });

    expect(instance.scheduledStartAt).toBe("2026-07-10T13:00:00.000Z");
    expect(instance.scheduledEndAt).toBe("2026-07-10T22:00:00.000Z");
    expect(instance.sourceType).toBe("weekly");
    expect(instance.sourceId).toBe("weekly-row-1");
    expect(instance.key).toContain("staff-1|branch-1|2026-07-10|single|window:1");
    expect(instance.key).toContain("weekly|weekly-row-1");
  });

  it("uses window order and row id so split shifts stay distinct", () => {
    const morningWindow = {
      id: "weekly-row-opening",
      windowOrder: 1,
      shiftType: "opening" as const,
      startTime: "06:00:00",
      endTime: "14:00:00",
    };
    const eveningWindow = {
      id: "weekly-row-closing",
      windowOrder: 2,
      shiftType: "closing" as const,
      startTime: "15:00:00",
      endTime: "23:00:00",
    };
    const baseSelection = {
      shiftDate: "2026-07-10",
      scheduledStartAt: "2026-07-10T10:00:00.000Z",
      scheduledEndAt: "2026-07-10T18:00:00.000Z",
      isUnscheduled: false,
      isDayOff: false,
      source: "individual",
      windows: [morningWindow, eveningWindow],
    } satisfies Omit<AttendanceScheduleSelection, "shiftType" | "selectedWindow">;

    const morning = buildAttendanceShiftInstance({
      staffId: "staff-1",
      branchId: "branch-1",
      schedule: { ...baseSelection, shiftType: "opening", selectedWindow: morningWindow },
      businessDate: "2026-07-10",
      branchTimezone: "Asia/Manila",
    });
    const evening = buildAttendanceShiftInstance({
      staffId: "staff-1",
      branchId: "branch-1",
      schedule: { ...baseSelection, shiftType: "closing", selectedWindow: eveningWindow },
      businessDate: "2026-07-10",
      branchTimezone: "Asia/Manila",
    });

    expect(morning.key).not.toBe(evening.key);
    expect(morning.key).toContain("window:1");
    expect(evening.key).toContain("window:2");
    expect(morning.sourceId).toBe("weekly-row-opening");
    expect(evening.sourceId).toBe("weekly-row-closing");
  });

  it("uses the authoritative overnight flag when building shift identity", () => {
    const overnight = buildAttendanceShiftInstance({
      staffId: "staff-1",
      branchId: "branch-1",
      schedule: {
        shiftDate: "2026-07-10",
        shiftType: "closing",
        scheduledStartAt: "2026-07-10T14:00:00.000Z",
        scheduledEndAt: "2026-07-10T22:00:00.000Z",
        isUnscheduled: false,
        isDayOff: false,
        source: "override",
        selectedWindow: {
          id: "override-1",
          windowOrder: 1,
          shiftType: "closing",
          startTime: "22:00:00",
          endTime: "06:00:00",
          endsNextDay: true,
        },
        windows: [],
      },
      businessDate: "2026-07-10",
      branchTimezone: "Asia/Manila",
    });

    expect(overnight.sourceType).toBe("override");
    expect(overnight.sourceId).toBe("override-1");
    expect(overnight.isOvernight).toBe(true);
    expect(overnight.attendanceBusinessDate).toBe("2026-07-10");
  });
});
