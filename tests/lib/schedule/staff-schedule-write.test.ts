import { describe, expect, it } from "vitest";
import {
  STAFF_SCHEDULE_CONFLICT_TARGET,
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
});
