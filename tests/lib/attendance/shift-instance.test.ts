import { describe, expect, it } from "vitest";
import { resolveAttendanceScanIntent } from "@/lib/attendance/attendance-intent-engine";
import {
  branchDateTimeToIsoInTimezone,
  buildAttendanceShiftInstance,
  getAttendanceBranchNow,
} from "@/lib/attendance/shift-instance";
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
  isWorking: true,
  isDayOff: false,
  windows: [{ shiftType: "single", startTime: "09:00:00", endTime: "18:00:00" }],
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
    expect(instance.sourceType).toBe("weekly_schedule");
    expect(instance.key).toContain("staff-1|branch-1|2026-07-10|single");
  });
});
