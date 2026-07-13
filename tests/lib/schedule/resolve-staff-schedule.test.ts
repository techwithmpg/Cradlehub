import { describe, expect, it } from "vitest";
import {
  dayOfWeekFromDateString,
  doesDurationFitWithinScheduleWindow,
  getScheduleWindowSpan,
  isTimeWithinScheduleWindows,
  resolveScheduleForStaffDay,
} from "../../../src/lib/schedule/resolve-staff-schedule";

describe("resolveScheduleForStaffDay", () => {
  it("uses date-specific day-off overrides before all weekly schedules", () => {
    const resolved = resolveScheduleForStaffDay({
      override: { is_day_off: true, start_time: "09:00", end_time: "17:00" },
      individualRows: [
        {
          shift_type: "single",
          start_time: "10:00",
          end_time: "19:00",
          is_active: true,
        },
      ],
    });

    expect(resolved).toMatchObject({
      source: "override",
      isWorking: false,
      isDayOff: true,
      windows: [],
    });
  });

  it("uses date-specific custom schedule overrides before individual schedules", () => {
    const resolved = resolveScheduleForStaffDay({
      override: { is_day_off: false, shift_type: "single", start_time: "12:00", end_time: "18:00" },
      individualRows: [
        {
          shift_type: "single",
          start_time: "10:00",
          end_time: "19:00",
          is_active: true,
        },
      ],
    });

    expect(resolved.source).toBe("override");
    expect(resolved.windows).toEqual([
      { shiftType: "single", startTime: "12:00", endTime: "18:00", windowOrder: 1 },
    ]);
  });

  it("preserves explicit opening shift type on timed overrides", () => {
    const resolved = resolveScheduleForStaffDay({
      override: { is_day_off: false, shift_type: "opening", start_time: "11:00", end_time: "16:00" },
      individualRows: [
        {
          shift_type: "opening",
          start_time: "10:00",
          end_time: "17:30",
          is_active: true,
        },
      ],
    });

    expect(resolved.source).toBe("override");
    expect(resolved.windows).toEqual([
      { shiftType: "opening", startTime: "11:00", endTime: "16:00", windowOrder: 1 },
    ]);
  });

  it("preserves explicit closing shift type on timed overrides", () => {
    const resolved = resolveScheduleForStaffDay({
      override: { is_day_off: false, shift_type: "closing", start_time: "15:00", end_time: "21:00" },
      individualRows: [
        {
          shift_type: "closing",
          start_time: "14:00",
          end_time: "22:30",
          is_active: true,
        },
      ],
    });

    expect(resolved.windows).toEqual([
      { shiftType: "closing", startTime: "15:00", endTime: "21:00", windowOrder: 1 },
    ]);
  });

  it("preserves explicit single shift type on timed overrides", () => {
    const resolved = resolveScheduleForStaffDay({
      override: { is_day_off: false, shift_type: "single", start_time: "10:00", end_time: "18:00" },
      individualRows: [
        {
          shift_type: "single",
          start_time: "09:00",
          end_time: "17:00",
          is_active: true,
        },
      ],
    });

    expect(resolved.windows).toEqual([
      { shiftType: "single", startTime: "10:00", endTime: "18:00", windowOrder: 1 },
    ]);
  });

  it("falls back to the matching individual shift type for legacy timed overrides", () => {
    const resolved = resolveScheduleForStaffDay({
      override: { is_day_off: false, shift_type: null, start_time: "14:00", end_time: "22:30" },
      individualRows: [
        {
          shift_type: "opening",
          start_time: "10:00",
          end_time: "17:30",
          is_active: true,
        },
        {
          shift_type: "closing",
          start_time: "14:00",
          end_time: "22:30",
          is_active: true,
        },
      ],
    });

    expect(resolved.windows).toEqual([
      { shiftType: "closing", startTime: "14:00", endTime: "22:30", windowOrder: 1 },
    ]);
  });

  it("uses single shift type for legacy timed overrides when no individual schedule exists", () => {
    const resolved = resolveScheduleForStaffDay({
      override: { is_day_off: false, shift_type: null, start_time: "14:00", end_time: "22:30" },
    });

    expect(resolved.windows).toEqual([
      { shiftType: "single", startTime: "14:00", endTime: "22:30", windowOrder: 1 },
    ]);
  });

  it("uses active individual rows and preserves multiple windows", () => {
    const resolved = resolveScheduleForStaffDay({
      individualRows: [
        {
          shift_type: "opening",
          start_time: "10:00",
          end_time: "13:00",
          is_active: true,
        },
        {
          shift_type: "closing",
          start_time: "14:00",
          end_time: "22:30",
          is_active: true,
        },
      ],
    });

    expect(resolved.source).toBe("individual");
    expect(resolved.windows).toEqual([
      { shiftType: "opening", startTime: "10:00", endTime: "13:00" },
      { shiftType: "closing", startTime: "14:00", endTime: "22:30" },
    ]);
    expect(getScheduleWindowSpan(resolved.windows)).toEqual({
      startTime: "10:00",
      endTime: "22:30",
    });
  });

  it("blocks overlapping individual windows as a non-operational conflict", () => {
    const resolved = resolveScheduleForStaffDay({
      individualRows: [
        {
          shift_type: "opening",
          start_time: "10:00",
          end_time: "17:30",
          is_active: true,
        },
        {
          shift_type: "closing",
          start_time: "14:00",
          end_time: "22:30",
          is_active: true,
        },
      ],
    });

    expect(resolved).toMatchObject({
      source: "individual",
      status: "conflict",
      isWorking: false,
      isDayOff: false,
      conflictCode: "overlapping_windows",
    });
    expect(resolved.windows).toEqual([
      { shiftType: "opening", startTime: "10:00", endTime: "17:30" },
      { shiftType: "closing", startTime: "14:00", endTime: "22:30" },
    ]);
  });

  it("treats malformed timed overrides as conflicts instead of falling through", () => {
    const resolved = resolveScheduleForStaffDay({
      override: { is_day_off: false, shift_type: "single", start_time: null, end_time: null },
      individualRows: [
        {
          shift_type: "single",
          start_time: "10:00",
          end_time: "19:00",
          is_active: true,
        },
      ],
    });

    expect(resolved).toMatchObject({
      source: "override",
      status: "conflict",
      windows: [],
      conflictCode: "invalid_time_range",
    });
  });

  it("treats inactive individual rows as an individual day off", () => {
    const resolved = resolveScheduleForStaffDay({
      individualRows: [
        {
          shift_type: "single",
          start_time: "10:00",
          end_time: "19:00",
          is_active: false,
        },
      ],
    });

    expect(resolved).toMatchObject({
      source: "individual",
      isWorking: false,
      isDayOff: true,
      windows: [],
    });
  });

  it("returns no schedule when no individual schedule exists", () => {
    const resolved = resolveScheduleForStaffDay({});

    expect(resolved).toMatchObject({
      source: "none",
      status: "missing",
      isWorking: false,
      windows: [],
    });
  });

  it("returns a distinct state for non-operational staff", () => {
    const resolved = resolveScheduleForStaffDay({
      operational: false,
      individualRows: [
        {
          shift_type: "single",
          start_time: "10:00",
          end_time: "19:00",
          is_active: true,
        },
      ],
    });

    expect(resolved).toMatchObject({
      source: "none",
      status: "not_operational",
      state: "STAFF_NOT_OPERATIONAL",
      isWorking: false,
      isDayOff: false,
      windows: [],
    });
  });

});

describe("schedule date and time helpers", () => {
  it("uses Sunday-zero weekday conversion consistently", () => {
    expect(dayOfWeekFromDateString("2026-06-14")).toBe(0);
    expect(dayOfWeekFromDateString("2026-06-15")).toBe(1);
  });

  it("handles overnight windows when checking current time and slot fit", () => {
    const window = {
      shiftType: "closing" as const,
      startTime: "17:00",
      endTime: "01:00",
    };

    expect(isTimeWithinScheduleWindows("23:30:00", [window])).toBe(true);
    expect(isTimeWithinScheduleWindows("00:30:00", [window])).toBe(true);
    expect(isTimeWithinScheduleWindows("09:00:00", [window])).toBe(false);
    expect(
      doesDurationFitWithinScheduleWindow({
        slotStartTime: "00:15",
        durationMinutes: 30,
        window,
      })
    ).toBe(true);
  });
});
