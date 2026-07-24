import { describe, expect, it } from "vitest";
import { resolveExactCrmScheduleMatch } from "./exact-crm-booking-time";

const window = (startTime: string, endTime: string) => ({
  shiftType: "single" as const,
  startTime,
  endTime,
});

describe("exact CRM booking schedule policy", () => {
  it("allows a service to finish after shift when it starts inside the shift", () => {
    const result = resolveExactCrmScheduleMatch({
      requestedStartTime: "17:45:00",
      durationMinutes: 90,
      windows: [window("10:00:00", "18:00:00")],
    });

    expect(result).not.toBeNull();
    expect(result?.overtimeMinutes).toBe(75);
  });

  it("allows a booking to start exactly at the scheduled end", () => {
    const result = resolveExactCrmScheduleMatch({
      requestedStartTime: "18:00:00",
      durationMinutes: 60,
      windows: [window("10:00:00", "18:00:00")],
    });

    expect(result).not.toBeNull();
    expect(result?.overtimeMinutes).toBe(60);
  });

  it("rejects a start after the scheduled end", () => {
    const result = resolveExactCrmScheduleMatch({
      requestedStartTime: "18:01:00",
      durationMinutes: 60,
      windows: [window("10:00:00", "18:00:00")],
    });

    expect(result).toBeNull();
  });

  it("keeps a real split-shift gap unavailable", () => {
    const windows = [window("10:00:00", "14:00:00"), window("16:00:00", "20:00:00")];

    expect(
      resolveExactCrmScheduleMatch({
        requestedStartTime: "14:30:00",
        durationMinutes: 60,
        windows,
      })
    ).toBeNull();

    expect(
      resolveExactCrmScheduleMatch({
        requestedStartTime: "13:45:00",
        durationMinutes: 90,
        windows,
      })?.overtimeMinutes
    ).toBe(75);
  });

  it("tracks Home Service travel before and after the shift separately", () => {
    const result = resolveExactCrmScheduleMatch({
      requestedStartTime: "10:10:00",
      durationMinutes: 60,
      windows: [window("10:00:00", "11:00:00")],
      operationalStartOffsetMinutes: 20,
      operationalEndOffsetMinutes: 20,
    });

    expect(result?.operationalStartsBeforeShift).toBe(true);
    expect(result?.overtimeMinutes).toBe(10);
    expect(result?.operationalOvertimeMinutes).toBe(30);
  });

  it("marks midnight-crossing service storage as unsupported", () => {
    const result = resolveExactCrmScheduleMatch({
      requestedStartTime: "23:30:00",
      durationMinutes: 60,
      windows: [window("20:00:00", "23:59:00")],
    });

    expect(result?.serviceCrossesDateBoundary).toBe(true);
  });
});
