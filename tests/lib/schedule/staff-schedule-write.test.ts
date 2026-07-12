import { describe, expect, it } from "vitest";
import {
  STAFF_SCHEDULE_CONFLICT_TARGET,
  buildStaffWeeklyScheduleRows,
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
      start_time: "10:00",
      end_time: "19:00",
      is_active: true,
    },
  ];

  it("uses the verified staff/day/shift conflict target", () => {
    expect(STAFF_SCHEDULE_CONFLICT_TARGET).toBe("staff_id,day_of_week,shift_type");
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

  it("writes a complete 21-row matrix for an explicit non-overlapping split shift", () => {
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
    expect(result.rows).toHaveLength(21);
    expect(
      result.rows.filter((row) => row.day_of_week === 1 && row.is_active).map((row) => row.shift_type)
    ).toEqual(["opening", "closing"]);
  });
});
