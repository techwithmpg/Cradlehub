import { describe, expect, it } from "vitest";
import {
  MAX_STAFF_SCHEDULE_WINDOWS_PER_DAY,
  STAFF_SCHEDULE_CONFLICT_TARGET,
  buildStaffWeeklyScheduleRows,
  buildStaffWeeklyWindowScheduleRows,
  savedRowsMatchRequest,
  type SavedStaffScheduleRow,
  type StaffScheduleUpsertRow,
} from "../../../src/lib/schedule/staff-schedule-write";

describe("staff schedule write helpers", () => {
  const requestedRows: StaffScheduleUpsertRow[] = [
    {
      staff_id: "staff-1",
      day_of_week: 1,
      shift_type: "single",
      window_order: 1,
      ends_next_day: false,
      start_time: "10:00",
      end_time: "19:00",
      is_active: true,
    },
  ];

  it("uses the verified staff/day/window conflict target", () => {
    expect(STAFF_SCHEDULE_CONFLICT_TARGET).toBe("staff_id,day_of_week,window_order");
  });

  it("treats returned rows as confirmation that the save succeeded", () => {
    const savedRows: SavedStaffScheduleRow[] = [{ ...requestedRows[0]!, id: "row-1" }];

    expect(savedRowsMatchRequest({ requestedRows, savedRows })).toBe(true);
  });

  it("rejects a save result when Supabase returns no saved rows", () => {
    expect(savedRowsMatchRequest({ requestedRows, savedRows: [] })).toBe(false);
    expect(savedRowsMatchRequest({ requestedRows, savedRows: null })).toBe(false);
  });

  it("rejects a save result when the returned row content does not match", () => {
    const savedRows: SavedStaffScheduleRow[] = [
      { ...requestedRows[0]!, id: "row-1", is_active: false },
    ];

    expect(savedRowsMatchRequest({ requestedRows, savedRows })).toBe(false);
  });

  it("requires Split Shift when a day has more than one active shift", () => {
    const result = buildStaffWeeklyScheduleRows({
      staffId: "staff-1",
      days: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        opening: dayOfWeek === 1,
        closing: dayOfWeek === 1,
        regular: dayOfWeek !== 1,
        dayOff: false,
        splitShift: false,
      })),
      times: {
        opening: { start: "09:00", end: "13:00" },
        closing: { start: "14:00", end: "18:00" },
        regular: { start: "09:00", end: "18:00" },
      },
    });

    expect(result).toEqual({
      ok: false,
      error: "Choose one shift or enable Split Shift for multiple windows.",
    });
  });

  it("writes configured weekly windows for an explicit non-overlapping split shift", () => {
    const result = buildStaffWeeklyScheduleRows({
      staffId: "staff-1",
      days: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        opening: dayOfWeek === 1,
        closing: dayOfWeek === 1,
        regular: dayOfWeek !== 1,
        dayOff: false,
        splitShift: dayOfWeek === 1,
      })),
      times: {
        opening: { start: "09:00", end: "13:00" },
        closing: { start: "14:00", end: "18:00" },
        regular: { start: "09:00", end: "18:00" },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(8);
    expect(result.rows.filter((row) => row.day_of_week !== 1)).toHaveLength(6);
    expect(
      result.rows
        .filter((row) => row.day_of_week === 1 && row.is_active)
        .map((row) => ({
          shiftType: row.shift_type,
          windowOrder: row.window_order,
          endsNextDay: row.ends_next_day,
        }))
    ).toEqual([
      { shiftType: "opening", windowOrder: 1, endsNextDay: false },
      { shiftType: "closing", windowOrder: 2, endsNextDay: false },
    ]);
  });

  it("writes variable ordered windows without generating inactive placeholders", () => {
    const result = buildStaffWeeklyWindowScheduleRows({
      staffId: "staff-1",
      staff: { staff_type: "therapist", system_role: "staff" },
      days: Array.from({ length: 7 }, (_, dayOfWeek) =>
        dayOfWeek === 1
          ? {
              dayOfWeek,
              mode: "working" as const,
              windows: [
                {
                  shiftType: "opening" as const,
                  startTime: "06:00",
                  endTime: "14:00",
                  endsNextDay: false,
                  order: 1,
                },
                {
                  shiftType: "single" as const,
                  startTime: "16:00",
                  endTime: "20:00",
                  endsNextDay: false,
                  order: 2,
                },
              ],
            }
          : { dayOfWeek, mode: "unconfigured" as const, windows: [] }
      ),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toEqual([
      expect.objectContaining({ day_of_week: 1, shift_type: "opening", window_order: 1 }),
      expect.objectContaining({ day_of_week: 1, shift_type: "single", window_order: 2 }),
    ]);
  });

  it("rejects more than the supported number of windows for one weekday", () => {
    const result = buildStaffWeeklyWindowScheduleRows({
      staffId: "staff-1",
      staff: { staff_type: "therapist", system_role: "staff" },
      days: Array.from({ length: 7 }, (_, dayOfWeek) =>
        dayOfWeek === 1
          ? {
              dayOfWeek,
              mode: "working" as const,
              windows: Array.from(
                { length: MAX_STAFF_SCHEDULE_WINDOWS_PER_DAY + 1 },
                (_, index) => ({
                  shiftType: "single" as const,
                  startTime: "09:00",
                  endTime: "10:00",
                  endsNextDay: false,
                  order: index + 1,
                })
              ),
            }
          : { dayOfWeek, mode: "unconfigured" as const, windows: [] }
      ),
    });

    expect(result).toEqual({
      ok: false,
      error: `A weekday can have up to ${MAX_STAFF_SCHEDULE_WINDOWS_PER_DAY} schedule windows.`,
    });
  });

  it("persists deliberate day off as one inactive marker while leaving unconfigured days empty", () => {
    const result = buildStaffWeeklyWindowScheduleRows({
      staffId: "staff-1",
      days: Array.from({ length: 7 }, (_, dayOfWeek) =>
        dayOfWeek === 0
          ? { dayOfWeek, mode: "day_off" as const, windows: [] }
          : { dayOfWeek, mode: "unconfigured" as const, windows: [] }
      ),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toEqual([
      expect.objectContaining({
        day_of_week: 0,
        is_active: false,
        start_time: "00:00",
        end_time: "00:01",
        window_order: 1,
      }),
    ]);
  });

  it("requires explicit overnight state for windows crossing midnight", () => {
    const days = Array.from({ length: 7 }, (_, dayOfWeek) =>
      dayOfWeek === 5
        ? {
            dayOfWeek,
            mode: "working" as const,
            windows: [
              {
                shiftType: "closing" as const,
                startTime: "17:00",
                endTime: "01:30",
                endsNextDay: false,
                order: 1,
              },
            ],
          }
        : { dayOfWeek, mode: "unconfigured" as const, windows: [] }
    );

    expect(
      buildStaffWeeklyWindowScheduleRows({
        staffId: "staff-1",
        staff: { staff_type: "therapist", system_role: "staff" },
        days,
      })
    ).toEqual({ ok: false, error: "Enable Ends next day when a window crosses midnight." });

    const valid = buildStaffWeeklyWindowScheduleRows({
      staffId: "staff-1",
      staff: { staff_type: "therapist", system_role: "staff" },
      days: days.map((day) =>
        day.dayOfWeek === 5
          ? {
              ...day,
              windows: day.windows.map((window) => ({ ...window, endsNextDay: true })),
            }
          : day
      ),
    });
    expect(valid.ok).toBe(true);
  });

  it("persists adjacent CRM Open-Close responsibility windows", () => {
    const result = buildStaffWeeklyWindowScheduleRows({
      staffId: "staff-1",
      staff: { staff_type: "csr", system_role: "crm" },
      days: Array.from({ length: 7 }, (_, dayOfWeek) =>
        dayOfWeek === 3
          ? {
              dayOfWeek,
              mode: "working" as const,
              windows: [
                {
                  shiftType: "opening" as const,
                  startTime: "10:00",
                  endTime: "17:00",
                  endsNextDay: false,
                  order: 1,
                },
                {
                  shiftType: "closing" as const,
                  startTime: "17:00",
                  endTime: "01:30",
                  endsNextDay: true,
                  order: 2,
                },
              ],
            }
          : { dayOfWeek, mode: "unconfigured" as const, windows: [] }
      ),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toEqual([
      expect.objectContaining({
        day_of_week: 3,
        shift_type: "opening",
        start_time: "10:00",
        end_time: "17:00",
        ends_next_day: false,
      }),
      expect.objectContaining({
        day_of_week: 3,
        shift_type: "closing",
        start_time: "17:00",
        end_time: "01:30",
        ends_next_day: true,
      }),
    ]);
  });

  it("rejects ineligible opening or closing windows and overlapping windows", () => {
    const ineligible = buildStaffWeeklyWindowScheduleRows({
      staffId: "staff-1",
      staff: { staff_type: "driver", system_role: "staff" },
      days: Array.from({ length: 7 }, (_, dayOfWeek) =>
        dayOfWeek === 1
          ? {
              dayOfWeek,
              mode: "working" as const,
              windows: [
                {
                  shiftType: "opening" as const,
                  startTime: "09:00",
                  endTime: "18:00",
                  endsNextDay: false,
                  order: 1,
                },
              ],
            }
          : { dayOfWeek, mode: "unconfigured" as const, windows: [] }
      ),
    });
    expect(ineligible).toEqual({
      ok: false,
      error: "Opening and Closing shifts are only available for therapists and CRM staff.",
    });

    const overlap = buildStaffWeeklyWindowScheduleRows({
      staffId: "staff-1",
      staff: { staff_type: "therapist", system_role: "staff" },
      days: Array.from({ length: 7 }, (_, dayOfWeek) =>
        dayOfWeek === 1
          ? {
              dayOfWeek,
              mode: "working" as const,
              windows: [
                {
                  shiftType: "single" as const,
                  startTime: "09:00",
                  endTime: "13:00",
                  endsNextDay: false,
                  order: 1,
                },
                {
                  shiftType: "closing" as const,
                  startTime: "12:00",
                  endTime: "18:00",
                  endsNextDay: false,
                  order: 2,
                },
              ],
            }
          : { dayOfWeek, mode: "unconfigured" as const, windows: [] }
      ),
    });
    expect(overlap).toEqual({
      ok: false,
      error: "Window 2 overlaps another window on this weekday.",
    });
  });
});
