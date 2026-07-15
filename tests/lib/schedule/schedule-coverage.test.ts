import { describe, expect, it } from "vitest";
import {
  doesDurationFitWithinScheduleWindows,
  getUniqueScheduleCoverageMinutes,
  mergeScheduleCoverageRanges,
} from "@/lib/schedule/schedule-coverage";

describe("schedule coverage", () => {
  it("counts overlapping and touching windows only once", () => {
    const overlapping = [
      { startTime: "10:00", endTime: "19:30", endsNextDay: false },
      { startTime: "17:00", endTime: "01:30", endsNextDay: true },
    ];
    const adjacent = [
      { startTime: "10:00", endTime: "17:00", endsNextDay: false },
      { startTime: "17:00", endTime: "01:30", endsNextDay: true },
    ];

    expect(getUniqueScheduleCoverageMinutes(overlapping)).toBe(15.5 * 60);
    expect(getUniqueScheduleCoverageMinutes(adjacent)).toBe(15.5 * 60);
    expect(mergeScheduleCoverageRanges(adjacent)).toEqual([{ start: 10 * 60, end: 25.5 * 60 }]);
  });

  it("allows work to cross a touching handoff but not a real split-shift gap", () => {
    const adjacent = [
      { startTime: "10:00", endTime: "17:00", endsNextDay: false },
      { startTime: "17:00", endTime: "01:30", endsNextDay: true },
    ];
    const gapped = [
      { startTime: "10:00", endTime: "14:00", endsNextDay: false },
      { startTime: "17:00", endTime: "21:00", endsNextDay: false },
    ];

    expect(
      doesDurationFitWithinScheduleWindows({
        slotStartTime: "16:00",
        durationMinutes: 120,
        windows: adjacent,
      })
    ).toBe(true);
    expect(
      doesDurationFitWithinScheduleWindows({
        slotStartTime: "13:00",
        durationMinutes: 120,
        windows: gapped,
      })
    ).toBe(false);
    expect(
      doesDurationFitWithinScheduleWindows({
        slotStartTime: "00:30",
        durationMinutes: 60,
        windows: adjacent,
      })
    ).toBe(true);
  });
});
