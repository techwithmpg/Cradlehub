import { describe, expect, it } from "vitest";
import {
  getCurrentTimePercent,
  getDefaultTimelineRange,
  isToday,
} from "@/lib/utils/schedule-timeline";

describe("schedule timeline current-time helpers", () => {
  const range = getDefaultTimelineRange();
  const fixedNow = new Date("2026-07-01T10:30:00.000Z");

  it("uses the supplied timestamp when checking the current schedule date", () => {
    expect(isToday("2026-07-01", fixedNow)).toBe(true);
    expect(isToday("2026-07-02", fixedNow)).toBe(false);
  });

  it("returns deterministic marker percentages from the supplied timestamp", () => {
    expect(getCurrentTimePercent(range, fixedNow)).toBe(70);
    expect(getCurrentTimePercent(range, new Date("2026-07-01T11:30:00.000Z"))).toBeCloseTo((690 / 900) * 100, 5);
  });

  it("hides the marker for non-current dates and times outside the range", () => {
    const markerForTomorrow = isToday("2026-07-02", fixedNow)
      ? getCurrentTimePercent(range, fixedNow)
      : null;

    expect(markerForTomorrow).toBeNull();
    expect(getCurrentTimePercent(range, new Date("2026-07-01T23:30:00.000Z"))).toBeNull();
  });
});
