import { describe, expect, it } from "vitest";
import { shouldBlockCompletedShiftRescan } from "@/lib/attendance/completed-shift-rescan";

const staff = "staff-1|branch-main|2026-11-06|single";
const first = `${staff}|window:1|10:00:00|17:30:00|weekly|sched-1`;
const second = `${staff}|window:2|18:00:00|22:30:00|weekly|sched-2`;
const adjacentSecond = `${staff}|window:2|17:30:00|22:30:00|weekly|sched-adj`;

const closed = {
  shift_instance_key: first,
  shift_date: "2026-11-06",
  shift_type: "single",
  checked_out_at: "2026-11-06T09:30:00.000Z", // 17:30 in Manila
  attendance_business_date: "2026-11-06",
};

const incoming = {
  key: first,
  shiftDate: "2026-11-06",
  shiftType: "single",
  scheduledStartAt: "2026-11-06T02:00:00.000Z",
  scheduledEndAt: "2026-11-06T09:30:00.000Z",
  attendanceBusinessDate: "2026-11-06",
};

describe("completed shift QR rescan preflight", () => {
  it("allows the first shift when no completed record exists", () => {
    expect(
      shouldBlockCompletedShiftRescan({
        completed: [],
        incoming,
        intentAction: "clock_in",
        requiresRecovery: false,
      })
    ).toBe(false);
  });

  it("blocks another scan of a completed shift", () => {
    expect(
      shouldBlockCompletedShiftRescan({
        completed: [closed],
        incoming,
        intentAction: "clock_in",
        requiresRecovery: false,
      })
    ).toBe(true);
  });

  it("blocks changed schedule keys for an already closed window", () => {
    expect(
      shouldBlockCompletedShiftRescan({
        completed: [closed],
        incoming: { ...incoming, key: first.replace("17:30:00", "18:30:00") },
        intentAction: "clock_in",
        requiresRecovery: false,
      })
    ).toBe(true);
  });

  it("blocks an ambiguous late-night clock-in after an earlier clock-out", () => {
    expect(
      shouldBlockCompletedShiftRescan({
        completed: [closed],
        incoming: {
          ...incoming,
          key: second,
          scheduledStartAt: "2026-11-06T10:00:00.000Z",
          scheduledEndAt: "2026-11-06T14:30:00.000Z",
        },
        intentAction: "clock_in",
        requiresRecovery: true,
      })
    ).toBe(true);
  });

  it("allows an explicit later split-shift window after the previous shift ended", () => {
    expect(
      shouldBlockCompletedShiftRescan({
        completed: [closed],
        incoming: {
          ...incoming,
          key: second,
          scheduledStartAt: "2026-11-06T10:00:00.000Z",
          scheduledEndAt: "2026-11-06T14:30:00.000Z",
        },
        intentAction: "clock_in",
        requiresRecovery: false,
      })
    ).toBe(false);
  });

  it("blocks even a different window when it starts before prior clock-out", () => {
    expect(
      shouldBlockCompletedShiftRescan({
        completed: [closed],
        incoming: {
          ...incoming,
          key: second,
          scheduledStartAt: "2026-11-06T09:00:00.000Z",
          scheduledEndAt: "2026-11-06T14:30:00.000Z",
        },
        intentAction: "clock_in",
        requiresRecovery: false,
      })
    ).toBe(true);
  });

  it("blocks recovery and missing schedule after a completed shift", () => {
    expect(
      shouldBlockCompletedShiftRescan({
        completed: [closed],
        incoming: { ...incoming, key: "review|new", scheduledStartAt: null },
        intentAction: "recovery_required",
        requiresRecovery: true,
      })
    ).toBe(true);
  });

  it("blocks reverse window ordering (window:2 completed -> window:1 incoming)", () => {
    expect(
      shouldBlockCompletedShiftRescan({
        completed: [{ ...closed, shift_instance_key: second }],
        incoming: {
          ...incoming,
          key: first,
          scheduledStartAt: "2026-11-06T11:00:00.000Z",
        },
        intentAction: "clock_in",
        requiresRecovery: false,
      })
    ).toBe(true);
  });

  it("blocks adjacent continuous open_close windows (17:30 end followed immediately by 17:30 start)", () => {
    expect(
      shouldBlockCompletedShiftRescan({
        completed: [{ ...closed, checked_out_at: "2026-11-06T09:00:00.000Z" }],
        incoming: {
          ...incoming,
          key: adjacentSecond,
          scheduledStartAt: "2026-11-06T09:30:00.000Z",
          scheduledEndAt: "2026-11-06T14:30:00.000Z",
        },
        intentAction: "clock_in",
        requiresRecovery: false,
      })
    ).toBe(true);
  });

  it("blocks premature second-shift scan (11:01 AM Manila for an 18:00 second window)", () => {
    expect(
      shouldBlockCompletedShiftRescan({
        completed: [
          {
            ...closed,
            checked_out_at: "2026-11-06T03:00:00.000Z", // 11:00 AM Manila
          },
        ],
        incoming: {
          ...incoming,
          key: second,
          scheduledStartAt: "2026-11-06T10:00:00.000Z", // 18:00 Manila
          scheduledEndAt: "2026-11-06T14:30:00.000Z",
        },
        intentAction: "clock_in",
        requiresRecovery: false,
        scanIso: "2026-11-06T03:01:00.000Z", // 11:01 AM Manila
        clockInWindowBeforeMinutes: 30,
        clockInWindowAfterMinutes: 120,
      })
    ).toBe(true);
  });

  it("allows valid early (17:35) and valid late (18:20) arrivals for an 18:00 second window", () => {
    const earlyBlocked = shouldBlockCompletedShiftRescan({
      completed: [closed],
      incoming: {
        ...incoming,
        key: second,
        scheduledStartAt: "2026-11-06T10:00:00.000Z", // 18:00 Manila
        scheduledEndAt: "2026-11-06T14:30:00.000Z",
      },
      intentAction: "clock_in",
      requiresRecovery: false,
      scanIso: "2026-11-06T09:35:00.000Z", // 17:35 Manila (after 17:30 checkout, within 30m early window)
      clockInWindowBeforeMinutes: 30,
      clockInWindowAfterMinutes: 120,
    });
    const lateBlocked = shouldBlockCompletedShiftRescan({
      completed: [closed],
      incoming: {
        ...incoming,
        key: second,
        scheduledStartAt: "2026-11-06T10:00:00.000Z", // 18:00 Manila
        scheduledEndAt: "2026-11-06T14:30:00.000Z",
      },
      intentAction: "clock_in",
      requiresRecovery: false,
      scanIso: "2026-11-06T10:20:00.000Z", // 18:20 Manila (within 120m late window)
      clockInWindowBeforeMinutes: 30,
      clockInWindowAfterMinutes: 120,
    });

    expect(earlyBlocked).toBe(false);
    expect(lateBlocked).toBe(false);
  });

  it("blocks legacy completed records with NULL attendance_business_date via shift_date fallback", () => {
    expect(
      shouldBlockCompletedShiftRescan({
        completed: [{ ...closed, attendance_business_date: null }],
        incoming: { ...incoming, key: first.replace("17:30:00", "18:00:00") },
        intentAction: "clock_in",
        requiresRecovery: false,
      })
    ).toBe(true);
  });
});
