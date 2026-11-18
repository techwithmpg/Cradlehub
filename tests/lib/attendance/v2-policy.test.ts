import { describe, expect, it } from "vitest";
import { computeAttendanceMetrics } from "@/lib/attendance/time";
import {
  attendanceV2Status,
  dueClockOutReminder,
  readAttendanceCredit,
} from "@/lib/attendance/v2-policy";
import { mayOpenScheduledAttendance } from "@/lib/attendance/clock-in-authority";
import { resolveAttendanceScanIntent } from "@/lib/attendance/attendance-intent-engine";
import type { AttendanceSettings, AttendanceWorkspaceData } from "@/lib/attendance/types";
import type { ResolvedStaffSchedule } from "@/lib/schedule/resolve-staff-schedule";
import { buildAttendanceReport } from "@/lib/attendance/reports";
import { mapRecentScan } from "@/lib/attendance/recent-scans-map";
import { scanShiftLabel } from "@/lib/attendance/scan-shift-label";

const start = "2026-11-16T05:00:00.000Z",
  end = "2026-11-16T12:00:00.000Z";
const credit = {
  version: 2 as const,
  creditedStartAt: start,
  authorizedEndAt: end,
  creditedEndAt: null,
  actualClockOutAt: null,
  state: "preliminary" as const,
  reason: "scheduled_credit",
};
const schedule: ResolvedStaffSchedule = {
  status: "resolved",
  state: "VALID_SCHEDULE",
  source: "individual",
  isWorking: true,
  isDayOff: false,
  windows: [{ id: "weekly-test", shiftType: "closing", startTime: "13:00", endTime: "20:00" }],
};
const settings = {
  timezone: "Asia/Manila",
  late_grace_minutes: 10,
  clock_in_window_after_shift_start_minutes: 120,
  clock_out_window_before_shift_end_minutes: 120,
  clock_out_window_after_shift_end_minutes: 120,
} as AttendanceSettings;
const metrics = (asOf: string, checkedOutAt?: string) =>
  computeAttendanceMetrics({
    checkedInAt: "2026-11-16T03:54:00.000Z",
    scheduledStartAt: start,
    scheduledEndAt: end,
    credit,
    asOf,
    checkedOutAt,
    lateGraceMinutes: 10,
    earlyLeaveGraceMinutes: 5,
  });

describe("V2 single-scan arrival and credited working time", () => {
  it("accepts 11:54 for 13:00, identifies Closing, and requires no recovery", () => {
    const intent = resolveAttendanceScanIntent({
      scanIso: "2026-11-16T03:54Z",
      scanDate: "2026-11-16",
      scanTime: "11:54",
      schedule,
      settings,
      attendanceV2: true,
    });
    expect(intent).toMatchObject({
      type: "early_clock_in",
      action: "clock_in",
      requiresRecovery: false,
      schedule: { shiftType: "closing", scheduledStartAt: start },
    });
    expect(
      mayOpenScheduledAttendance({
        scanIso: "2026-11-16T03:54Z",
        schedule: intent.schedule,
        resolvedSchedule: schedule,
        attendanceV2: true,
      })
    ).toBe(true);
    expect(
      mayOpenScheduledAttendance({
        scanIso: "2026-11-16T03:54Z",
        schedule: intent.schedule,
        resolvedSchedule: schedule,
      })
    ).toBe(false);
  });
  it.each([
    ["2026-11-16T03:00Z", true],
    ["2026-11-16T02:59:59Z", false],
    [start, true],
    ["2026-11-16T05:15Z", true],
    [end, false],
  ])("bounded window %s", (scanIso, allowed) => {
    const intent = resolveAttendanceScanIntent({
      scanIso,
      scanDate: "2026-11-16",
      scanTime: "11:00",
      schedule,
      settings,
      attendanceV2: true,
    });
    expect(
      mayOpenScheduledAttendance({
        scanIso,
        schedule: intent.schedule,
        resolvedSchedule: schedule,
        attendanceV2: true,
      })
    ).toBe(allowed);
  });
  it("does not promote missing or conflicting schedules", () => {
    for (const status of ["missing", "conflict"] as const) {
      const intent = resolveAttendanceScanIntent({
        scanIso: start,
        scanDate: "2026-11-16",
        scanTime: "13:00",
        schedule: { ...schedule, status },
        settings,
        attendanceV2: true,
      });
      expect(
        mayOpenScheduledAttendance({
          scanIso: start,
          schedule: intent.schedule,
          resolvedSchedule: { ...schedule, status },
          attendanceV2: true,
        })
      ).toBe(false);
    }
  });
  it.each([
    ["2026-11-16T04:59Z", 0],
    [start, 0],
    ["2026-11-16T05:30Z", 30],
    [end, 420],
    ["2026-11-17T00:00Z", 420],
  ])("credits as of %s without a second scan", (now, minutes) => {
    expect(metrics(now).workedMinutes).toBe(minutes);
  });
  it("credits only through early departure", () =>
    expect(metrics(end, "2026-11-16T11:00Z").workedMinutes).toBe(360));
  it("does not credit an arrival that departs before shift start", () =>
    expect(metrics(end, "2026-11-16T04:30Z").workedMinutes).toBe(0));
  it("unknown authorized end is zero pending review", () =>
    expect(
      computeAttendanceMetrics({
        checkedInAt: start,
        credit: { ...credit, authorizedEndAt: null },
        asOf: end,
        lateGraceMinutes: 0,
        earlyLeaveGraceMinutes: 0,
      }).workedMinutes
    ).toBe(0));
  it("retains the correct day for an early overnight arrival", () => {
    const intent = resolveAttendanceScanIntent({
      scanIso: "2026-11-16T08:00Z",
      scanDate: "2026-11-16",
      scanTime: "16:00",
      settings,
      schedule: {
        ...schedule,
        windows: [
          {
            id: "overnight",
            shiftType: "closing",
            startTime: "17:00",
            endTime: "01:00",
            endsNextDay: true,
          },
        ],
      },
      attendanceV2: true,
    });
    expect(intent.schedule.shiftDate).toBe("2026-11-16");
    expect(intent.schedule.scheduledStartAt).toBe("2026-11-16T09:00:00.000Z");
  });
});

describe("V2 due intervals and states", () => {
  it("does not label verified active work as clock-out overdue", () => {
    expect(attendanceV2Status({ checkedInAt: start, checkedOutAt: null, scheduledStartAt: start,
      scheduledEndAt: end, snapshot: { v2: { ...credit, activeWork: true } }, now: "2026-11-16T12:10Z",
    })).toBe("Authorized extension");
  });
  it("first standard reminder is 20 minutes after deadline; final home-service is 10 minutes", () => {
    expect(dueClockOutReminder(end, "2026-11-16T12:19:59Z")).toBeNull();
    expect(dueClockOutReminder(end, "2026-11-16T12:20Z")).toMatchObject({
      interval: 1,
      delayMinutes: 20,
      reminderKind: "shift_end",
      nextDueAt: "2026-11-16T12:35:00.000Z",
    });
    expect(dueClockOutReminder(end, "2026-11-16T12:35Z")?.interval).toBe(2);

    expect(
      dueClockOutReminder(end, "2026-11-16T12:09:59Z", { reminderKind: "final_home_service" })
    ).toBeNull();
    expect(
      dueClockOutReminder(end, "2026-11-16T12:10Z", { reminderKind: "final_home_service" })
    ).toMatchObject({
      interval: 1,
      delayMinutes: 10,
      reminderKind: "final_home_service",
      nextDueAt: "2026-11-16T12:25:00.000Z",
    });
  });
  it("invalid timestamps fail closed", () => {
    expect(dueClockOutReminder("bad", end)).toBeNull();
    expect(readAttendanceCredit({ v2: { ...credit, authorizedEndAt: "bad" } })).toBeNull();
    expect(readAttendanceCredit({ v2: { ...credit, version: 1 } })).toBeNull();
  });
  it.each([
    ["2026-11-16T04:00Z", "Early arrival"],
    [start, "Working"],
    ["2026-11-16T12:01Z", "Clock-out overdue"],
  ])("presents %s", (now, label) => {
    expect(
      attendanceV2Status({
        checkedInAt: "2026-11-16T03:54Z",
        checkedOutAt: null,
        scheduledStartAt: start,
        scheduledEndAt: end,
        snapshot: { v2: credit },
        now,
      })
    ).toBe(label);
  });
});

describe("V2 payroll protection and retained schedule labels", () => {
  it.each(["preliminary", "review", "final"] as const)(
    "only finalized minutes enter payable export: %s",
    (state) => {
      const data = {
        records: [
          {
            id: "test",
            staff_id: "test-staff",
            staff_name: "TEST",
            shift_date: "2026-11-16",
            status: "checked_out",
            worked_minutes: 420,
            checked_in_at: "2026-11-16T03:54Z",
            checked_out_at: end,
            clock_out_confirmation_required: false,
            attendance_policy_snapshot: { v2: { ...credit, state, creditedEndAt: end } },
          },
        ],
        exceptions: [],
        corrections: [],
        staffOptions: [],
      } as unknown as AttendanceWorkspaceData;
      const report = buildAttendanceReport({
        name: "Payroll Export",
        data,
        filters: {
          startDate: "2026-11-16",
          endDate: "2026-11-16",
          staffType: "all",
          staffId: "all",
        },
      });
      expect(report.rows[0]?.approvedPayableMinutes).toBe(state === "final" ? 420 : 0);
      expect(report.rows[0]?.actualClockOut).toBe("");
    }
  );
  it.each([
    { authorizedEndAt: null }, { creditedEndAt: null }, { creditedEndAt: "2026-11-16T13:00Z" },
  ])("rejects incomplete or over-cap final credit: %s", (invalid) => {
    const record = { id: "test", staff_id: "staff", shift_date: "2026-11-16", status: "checked_out",
      checked_out_at: end, worked_minutes: 420,
      attendance_policy_snapshot: { v2: { ...credit, state: "final", creditedEndAt: end, ...invalid } } };
    const report = buildAttendanceReport({ name: "Payroll Export", data: { records: [record], exceptions: [], corrections: [] } as unknown as AttendanceWorkspaceData,
      filters: { startDate: "2026-11-16", endDate: "2026-11-16", staffId: "all", staffType: "all" } });
    expect(report.rows[0]?.approvedPayableMinutes).toBe(0);
  });
  it("uses retained schedule metadata without an attendance session", () => {
    const row = mapRecentScan(
      {
        id: "event",
        branch_id: "test",
        staff_id: "staff",
        action: "scan_captured",
        outcome: "exception",
        reason_code: "outside_schedule_window",
        message: "TEST",
        request_id: null,
        operation_id: null,
        created_at: start,
        metadata: { schedule: { shiftType: "closing" } },
      },
      { timezone: "Asia/Manila" }
    );
    expect(row?.shiftType).toBe("closing");
    expect(row?.clockInAt).toBeNull();
  });
  it("preserves primary labels and rejects malformed metadata", () => {
    expect(scanShiftLabel("opening", { schedule: { shiftType: "closing" } })).toBe("opening");
    expect(scanShiftLabel(null, { shiftInstance: { shiftType: { secret: "bad" } } })).toBeNull();
    expect(scanShiftLabel(null, { schedule: { shiftType: " " + "x".repeat(81) } })).toBeNull();
  });
});
