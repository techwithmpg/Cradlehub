import { describe, expect, it } from "vitest";
import {
  classifyOpenAttendanceCheckins,
  resolveAttendanceDayForShift,
  resolveAttendanceScanIntent,
  type ResolveAttendanceScanIntentInput,
} from "@/lib/attendance/attendance-intent-engine";
import type { AttendanceSettings } from "@/lib/attendance/types";
import type { ResolvedStaffSchedule } from "@/lib/schedule/resolve-staff-schedule";

const settings: AttendanceSettings = {
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

const normalSchedule: ResolvedStaffSchedule = {
  source: "individual",
  status: "resolved",
  state: "VALID_SCHEDULE",
  isWorking: true,
  isDayOff: false,
  windows: [{ shiftType: "single", startTime: "09:00:00", endTime: "18:00:00" }],
};

function input(overrides: Partial<ResolveAttendanceScanIntentInput> = {}): ResolveAttendanceScanIntentInput {
  return {
    scanIso: "2026-07-10T01:05:00.000Z",
    scanDate: "2026-07-10",
    scanTime: "09:05:00",
    settings,
    schedule: normalSchedule,
    ...overrides,
  };
}

describe("resolveAttendanceScanIntent", () => {
  it("classifies a normal scan near shift start as clock-in", () => {
    const intent = resolveAttendanceScanIntent(input());
    expect(intent.type).toBe("clock_in");
    expect(intent.shouldWriteAttendance).toBe(true);
    expect(intent.requiresRecovery).toBe(false);
  });

  it("classifies a late scan inside the clock-in window as late clock-in", () => {
    const intent = resolveAttendanceScanIntent(input({ scanTime: "09:30:00" }));
    expect(intent.type).toBe("late_clock_in");
    expect(intent.shouldWriteAttendance).toBe(true);
  });

  it("classifies an active check-in scan near shift end as clock-out", () => {
    const intent = resolveAttendanceScanIntent(
      input({
        scanIso: "2026-07-10T10:02:00.000Z",
        scanTime: "18:02:00",
        activeCheckin: {
          checkedInAt: "2026-07-10T01:00:00.000Z",
          scheduledStartAt: "2026-07-10T01:00:00.000Z",
          scheduledEndAt: "2026-07-10T10:00:00.000Z",
        },
      })
    );
    expect(intent.type).toBe("clock_out");
    expect(intent.action).toBe("clock_out");
  });

  it("keeps overnight active check-out after midnight as clock-out", () => {
    const overnightSchedule: ResolvedStaffSchedule = {
      source: "individual",
      status: "resolved",
      state: "VALID_OVERNIGHT_SHIFT",
      isWorking: true,
      isDayOff: false,
      windows: [{ shiftType: "closing", startTime: "17:00:00", endTime: "01:00:00" }],
    };
    const intent = resolveAttendanceScanIntent(
      input({
        scanIso: "2026-07-10T17:20:00.000Z",
        scanDate: "2026-07-11",
        scanTime: "01:20:00",
        schedule: overnightSchedule,
        activeCheckin: {
          checkedInAt: "2026-07-10T09:00:00.000Z",
          scheduledStartAt: "2026-07-10T09:00:00.000Z",
          scheduledEndAt: "2026-07-10T17:00:00.000Z",
        },
      })
    );
    expect(intent.type).toBe("overtime_clock_out");
    expect(resolveAttendanceDayForShift({
      scanDate: "2026-07-11",
      scanTime: "01:20:00",
      window: overnightSchedule.windows[0]!,
    })).toBe("2026-07-10");
  });

  it("classifies duplicate scans without writing attendance", () => {
    const intent = resolveAttendanceScanIntent(input({ duplicateScan: true }));
    expect(intent.type).toBe("duplicate_scan");
    expect(intent.shouldWriteAttendance).toBe(false);
  });

  it("records missing schedules and flags them for review", () => {
    const intent = resolveAttendanceScanIntent(
      input({
        schedule: {
          source: "none",
          status: "missing",
          state: "NO_SCHEDULE_CONFIGURED",
          isWorking: false,
          isDayOff: false,
          windows: [],
        },
      })
    );
    expect(intent.type).toBe("missing_schedule");
    expect(intent.requiresRecovery).toBe(true);
    expect(intent.shouldWriteAttendance).toBe(true);
    expect(intent.action).toBe("clock_in");
  });

  it("records day-off scans and flags them for review", () => {
    const intent = resolveAttendanceScanIntent(
      input({
        schedule: {
          source: "override",
          status: "day_off",
          state: "CONFIGURED_DAY_OFF",
          isWorking: false,
          isDayOff: true,
          windows: [],
        },
      })
    );
    expect(intent.type).toBe("off_day_exception");
    expect(intent.requiresRecovery).toBe(true);
    expect(intent.shouldWriteAttendance).toBe(true);
  });

  it("routes first scans in the clock-out window to recovery instead of clock-in", () => {
    const intent = resolveAttendanceScanIntent(input({ scanTime: "17:30:00" }));
    expect(intent.type).toBe("likely_closing_scan_without_clock_in");
    expect(intent.shouldWriteAttendance).toBe(false);
    expect(intent.requiresRecovery).toBe(true);
  });

  it("does not let legacy launch settings override missing-schedule record-first policy", () => {
    const intent = resolveAttendanceScanIntent(
      input({
        scanTime: "21:13:00",
        settings: {
          ...settings,
          launch_recovery_enabled: true,
          launch_recovery_start_date: "2026-07-01",
          launch_recovery_end_date: "2026-07-31",
        },
        schedule: {
          source: "none",
          status: "missing",
          state: "NO_SCHEDULE_CONFIGURED",
          isWorking: false,
          isDayOff: false,
          windows: [],
        },
      })
    );
    expect(intent.type).toBe("missing_schedule");
    expect(intent.requiresRecovery).toBe(true);
    expect(intent.shouldWriteAttendance).toBe(true);
  });

  it("ignores legacy manager-confirmation behavior and uses the fixed captured result", () => {
    const intent = resolveAttendanceScanIntent(
      input({
        scanTime: "17:30:00",
        settings: {
          ...settings,
          first_scan_closing_behavior: "require_manager_confirmation",
        },
      })
    );
    expect(intent.type).toBe("likely_closing_scan_without_clock_in");
    expect(intent.shouldWriteAttendance).toBe(false);
    expect(intent.title).toBe("Scan captured for review");
  });

  it("ignores legacy launch-only behavior for closing scans", () => {
    const intent = resolveAttendanceScanIntent(
      input({
        scanTime: "17:30:00",
        settings: {
          ...settings,
          first_scan_closing_behavior: "treat_as_clock_out_launch_only",
        },
      })
    );
    expect(intent.type).toBe("likely_closing_scan_without_clock_in");
    expect(intent.shouldWriteAttendance).toBe(false);
    expect(intent.message).toContain("no earlier clock-in exists");
  });

  it("records ordinary scans outside all windows and flags them", () => {
    const intent = resolveAttendanceScanIntent(input({ scanTime: "13:00:00" }));
    expect(intent.type).toBe("outside_schedule_window");
    expect(intent.shouldWriteAttendance).toBe(true);
  });
});

describe("classifyOpenAttendanceCheckins", () => {
  it("does not treat a prior-day open row as today's active shift", () => {
    const intent = resolveAttendanceScanIntent(input({ scanTime: "09:05:00" }));
    const classification = classifyOpenAttendanceCheckins({
      schedule: intent.schedule,
      openCheckins: [
        {
          id: "launch-row",
          checkedInAt: "2026-07-09T10:30:00.000Z",
          scheduledStartAt: "2026-07-09T01:00:00.000Z",
          scheduledEndAt: "2026-07-09T10:00:00.000Z",
          shiftDate: "2026-07-09",
          shiftType: "single",
        },
      ],
    });

    expect(classification.matchingCheckin).toBeNull();
    expect(classification.staleCheckins.map((checkin) => checkin.id)).toEqual(["launch-row"]);
  });

  it("matches the exact current shift open row for clock-out", () => {
    const intent = resolveAttendanceScanIntent(input({ scanTime: "17:55:00" }));
    const classification = classifyOpenAttendanceCheckins({
      schedule: intent.schedule,
      openCheckins: [
        {
          id: "current-shift",
          checkedInAt: "2026-07-10T01:05:00.000Z",
          scheduledStartAt: "2026-07-10T01:00:00.000Z",
          scheduledEndAt: "2026-07-10T10:00:00.000Z",
          shiftDate: "2026-07-10",
          shiftType: "single",
        },
      ],
    });

    expect(classification.matchingCheckin?.id).toBe("current-shift");
    expect(classification.staleCheckins).toHaveLength(0);
  });

  it("matches legacy generic shift rows by scheduled-window overlap", () => {
    const splitSchedule: ResolvedStaffSchedule = {
      source: "individual",
      status: "resolved",
      state: "VALID_SPLIT_SHIFT",
      isWorking: true,
      isDayOff: false,
      windows: [
        { shiftType: "opening", startTime: "09:00:00", endTime: "13:00:00" },
        { shiftType: "closing", startTime: "15:00:00", endTime: "21:00:00" },
      ],
    };
    const intent = resolveAttendanceScanIntent(input({ schedule: splitSchedule, scanTime: "20:45:00" }));
    const classification = classifyOpenAttendanceCheckins({
      schedule: intent.schedule,
      openCheckins: [
        {
          id: "legacy-closing",
          checkedInAt: "2026-07-10T07:00:00.000Z",
          scheduledStartAt: "2026-07-10T07:00:00.000Z",
          scheduledEndAt: "2026-07-10T13:00:00.000Z",
          shiftDate: "2026-07-10",
          shiftType: "single",
        },
      ],
    });

    expect(classification.matchingCheckin?.id).toBe("legacy-closing");
  });

  it("separates same-day different-shift open rows as conflicts", () => {
    const splitSchedule: ResolvedStaffSchedule = {
      source: "individual",
      status: "resolved",
      state: "VALID_SPLIT_SHIFT",
      isWorking: true,
      isDayOff: false,
      windows: [
        { shiftType: "opening", startTime: "09:00:00", endTime: "13:00:00" },
        { shiftType: "closing", startTime: "15:00:00", endTime: "21:00:00" },
      ],
    };
    const intent = resolveAttendanceScanIntent(input({ schedule: splitSchedule, scanTime: "20:45:00" }));
    const classification = classifyOpenAttendanceCheckins({
      schedule: intent.schedule,
      openCheckins: [
        {
          id: "opening-still-open",
          checkedInAt: "2026-07-10T01:00:00.000Z",
          scheduledStartAt: "2026-07-10T01:00:00.000Z",
          scheduledEndAt: "2026-07-10T05:00:00.000Z",
          shiftDate: "2026-07-10",
          shiftType: "opening",
        },
      ],
    });

    expect(classification.matchingCheckin).toBeNull();
    expect(classification.conflictingCheckins.map((checkin) => checkin.id)).toEqual(["opening-still-open"]);
  });
});
