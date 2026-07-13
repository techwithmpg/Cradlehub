import { describe, expect, it } from "vitest";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import {
  buildTimelineRange,
  formatMinutesAsScheduleTime,
  getCurrentTimePercent,
  getDefaultTimelineRange,
  getTimelineBlockPercent,
  isToday,
} from "@/lib/utils/schedule-timeline";

function row(overrides: Partial<DailyScheduleStaffRow> = {}): DailyScheduleStaffRow {
  return {
    staff_id: "staff-1",
    staff_name: "Closing Staff",
    staff_tier: null,
    work_start: "22:00:00",
    work_end: "02:00:00",
    current_override: null,
    schedule_source: "individual",
    schedule_status: "resolved",
    schedule_is_day_off: false,
    schedule_windows: [
      { shiftType: "closing", startTime: "22:00:00", endTime: "02:00:00", endsNextDay: true },
    ],
    schedule_conflict_code: null,
    schedule_conflict_reason: null,
    bookings: [],
    blocks: [],
    ...overrides,
  };
}

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

  it("builds a visible range and block width for overnight shifts", () => {
    const overnightRange = buildTimelineRange([row()]);
    const position = getTimelineBlockPercent(
      "22:00:00",
      "02:00:00",
      overnightRange,
      true
    );

    expect(overnightRange.startMinutes).toBe(22 * 60);
    expect(overnightRange.endMinutes).toBe(26 * 60);
    expect(formatMinutesAsScheduleTime(overnightRange.endMinutes)).toBe("2:00 AM +1d");
    expect(position.leftPercent).toBe(0);
    expect(position.widthPercent).toBe(100);
  });
});
