import { describe, expect, it } from "vitest";
import {
  EARLIEST_CLOCK_IN_MINUTES,
  isOpenShiftForCurrentAttendanceDay,
  mayOpenScheduledAttendance,
} from "@/lib/attendance/clock-in-authority";
import type { AttendanceScheduleSelection } from "@/lib/attendance/attendance-intent-engine";
import type { ResolvedStaffSchedule } from "@/lib/schedule/resolve-staff-schedule";

const resolved: ResolvedStaffSchedule = {
  source: "individual",
  status: "resolved",
  state: "VALID_SCHEDULE",
  isWorking: true,
  isDayOff: false,
  windows: [{ shiftType: "opening", startTime: "09:00:00", endTime: "21:30:00" }],
};

const shift: AttendanceScheduleSelection = {
  shiftDate: "2026-11-09",
  shiftType: "opening",
  scheduledStartAt: "2026-11-09T01:00:00.000Z",
  scheduledEndAt: "2026-11-09T13:30:00.000Z",
  isUnscheduled: false,
  isDayOff: false,
  source: "individual",
  selectedWindow: resolved.windows[0]!,
  windows: resolved.windows,
};

const check = (
  scanIso: string,
  selection: AttendanceScheduleSelection = shift,
  source: ResolvedStaffSchedule = resolved
) => mayOpenScheduledAttendance({ scanIso, schedule: selection, resolvedSchedule: source });

describe("P0 clock-in authority", () => {
  it("allows exactly 60 minutes before shift, not one second earlier", () => {
    expect(EARLIEST_CLOCK_IN_MINUTES).toBe(60);
    expect(check("2026-11-09T00:00:00.000Z")).toBe(true); // 08:00 Manila
    expect(check("2026-11-08T23:59:59.000Z")).toBe(false);
  });

  it("blocks confirmed 00:00 QR scan for 09:00 opening shift", () => {
    expect(check("2026-11-08T16:00:34.862Z")).toBe(false);
  });

  it("preserves late first scans inside the shift but not after shift end", () => {
    expect(check("2026-11-09T05:20:27.012Z")).toBe(true);
    expect(check("2026-11-09T13:29:59.000Z")).toBe(true);
    expect(check("2026-11-09T13:30:00.000Z")).toBe(false);
  });

  it("does not treat missing, off-day, conflicting or incomplete schedule as authorization", () => {
    expect(check("2026-11-09T01:00:00Z", shift, { ...resolved, status: "missing" })).toBe(false);
    expect(check("2026-11-09T01:00:00Z", shift, { ...resolved, status: "conflict" })).toBe(false);
    expect(check("2026-11-09T01:00:00Z", shift, { ...resolved, isDayOff: true })).toBe(false);
    expect(check("2026-11-09T01:00:00Z", { ...shift, selectedWindow: null })).toBe(false);
    expect(check("2026-11-09T01:00:00Z", { ...shift, scheduledEndAt: null })).toBe(false);
  });

  it("permits post-midnight clock-in only during a genuinely authorized overnight shift", () => {
    const overnight: AttendanceScheduleSelection = {
      ...shift,
      shiftDate: "2026-11-08",
      shiftType: "closing",
      scheduledStartAt: "2026-11-08T09:00:00.000Z", // 17:00 Manila
      scheduledEndAt: "2026-11-08T17:30:00.000Z", // 01:30 Manila next day
      selectedWindow: {
        shiftType: "closing",
        startTime: "17:00:00",
        endTime: "01:30:00",
        endsNextDay: true,
      },
    };
    expect(check("2026-11-08T16:00:00.000Z", overnight)).toBe(true);
    expect(check("2026-11-08T17:30:00.000Z", overnight)).toBe(false);
  });

  it("honors second split-shift window independently", () => {
    const split: AttendanceScheduleSelection = {
      ...shift,
      shiftType: "closing",
      scheduledStartAt: "2026-11-09T06:00:00.000Z",
      scheduledEndAt: "2026-11-09T13:30:00.000Z",
      selectedWindow: { shiftType: "closing", startTime: "14:00:00", endTime: "21:30:00" },
    };
    expect(check("2026-11-09T05:00:00.000Z", split)).toBe(true);
    expect(check("2026-11-09T04:59:59.000Z", split)).toBe(false);
  });
});

describe("P0 midnight open-shift routing", () => {
  const previous = {
    openBranchId: "main",
    openAttendanceBusinessDate: "2026-11-08",
    openShiftDate: "2026-11-08",
    scannedBranchId: "main",
    scannedBusinessDate: "2026-11-08",
  };
  it("treats a current-business-day midnight QR as clock-out", () => {
    expect(isOpenShiftForCurrentAttendanceDay(previous)).toBe(true);
  });
  it("preserves different-branch and genuinely stale prior-business-day cases", () => {
    expect(isOpenShiftForCurrentAttendanceDay({ ...previous, scannedBranchId: "sm" })).toBe(false);
    expect(isOpenShiftForCurrentAttendanceDay({ ...previous, scannedBusinessDate: "2026-11-09" })).toBe(false);
  });
  it("supports older open rows without attendance_business_date", () => {
    expect(isOpenShiftForCurrentAttendanceDay({ ...previous, openAttendanceBusinessDate: null })).toBe(true);
  });
});
