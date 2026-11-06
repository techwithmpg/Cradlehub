import { describe, expect, it } from "vitest";
import { shouldBlockCompletedShiftRescan } from "@/lib/attendance/completed-shift-rescan";

const staff = "staff-1|branch-main|2026-11-06|single";
const first = `${staff}|window:1|10:00:00|17:30:00|weekly|none`;
const second = `${staff}|window:2|18:00:00|22:30:00|weekly|none`;
const closed = {
  shift_instance_key: first,
  shift_date: "2026-11-06",
  shift_type: "single",
  checked_out_at: "2026-11-06T09:30:00.000Z", // 17:30 in Manila
};
const incoming = {
  key: first,
  shiftDate: "2026-11-06",
  shiftType: "single",
  scheduledStartAt: "2026-11-06T02:00:00.000Z",
};

describe("completed shift QR rescan preflight", () => {
  it("allows the first shift when no completed record exists", () => {
    expect(shouldBlockCompletedShiftRescan({
      completed: [], incoming, intentAction: "clock_in", requiresRecovery: false,
    })).toBe(false);
  });

  it("blocks another scan of a completed shift", () => {
    expect(shouldBlockCompletedShiftRescan({
      completed: [closed], incoming, intentAction: "clock_in", requiresRecovery: false,
    })).toBe(true);
  });

  it("blocks changed schedule keys for an already closed window", () => {
    expect(shouldBlockCompletedShiftRescan({
      completed: [closed],
      incoming: { ...incoming, key: first.replace("17:30:00", "18:30:00") },
      intentAction: "clock_in", requiresRecovery: false,
    })).toBe(true);
  });

  it("blocks an ambiguous late-night clock-in after an earlier clock-out", () => {
    expect(shouldBlockCompletedShiftRescan({
      completed: [closed],
      incoming: { ...incoming, key: second, scheduledStartAt: "2026-11-06T10:00:00.000Z" },
      intentAction: "clock_in", requiresRecovery: true,
    })).toBe(true);
  });

  it("allows an explicit later split-shift window after the previous shift ended", () => {
    expect(shouldBlockCompletedShiftRescan({
      completed: [closed],
      incoming: { ...incoming, key: second, scheduledStartAt: "2026-11-06T10:00:00.000Z" },
      intentAction: "clock_in", requiresRecovery: false,
    })).toBe(false);
  });

  it("blocks even a different window when it starts before prior clock-out", () => {
    expect(shouldBlockCompletedShiftRescan({
      completed: [closed],
      incoming: { ...incoming, key: second, scheduledStartAt: "2026-11-06T09:00:00.000Z" },
      intentAction: "clock_in", requiresRecovery: false,
    })).toBe(true);
  });

  it("blocks recovery and missing schedule after a completed shift", () => {
    expect(shouldBlockCompletedShiftRescan({
      completed: [closed],
      incoming: { ...incoming, key: "review|new", scheduledStartAt: null },
      intentAction: "recovery_required", requiresRecovery: true,
    })).toBe(true);
  });
});
