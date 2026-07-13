import { describe, expect, it } from "vitest";
import {
  buildStaffWeekPlanner,
  type WeekBooking,
} from "@/lib/staff-portal/week";
import type { Database } from "@/types/supabase";

type ScheduleRow = Database["public"]["Tables"]["staff_schedules"]["Row"];
type OverrideRow = Database["public"]["Tables"]["schedule_overrides"]["Row"];

function schedule(overrides: Partial<ScheduleRow>): ScheduleRow {
  return {
    id: "schedule-1",
    staff_id: "staff-1",
    branch_id: "branch-1",
    day_of_week: 1,
    shift_type: "single",
    start_time: "10:00:00",
    end_time: "18:00:00",
    is_active: true,
    window_order: 1,
    ends_next_day: false,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  } as ScheduleRow;
}

function override(overrides: Partial<OverrideRow>): OverrideRow {
  return {
    id: "override-1",
    staff_id: "staff-1",
    override_date: "2026-07-14",
    is_day_off: true,
    shift_type: null,
    start_time: null,
    end_time: null,
    reason: null,
    created_by: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  } as OverrideRow;
}

describe("buildStaffWeekPlanner", () => {
  it("uses all schedule windows for the same day instead of overwriting split shifts", () => {
    const planner = buildStaffWeekPlanner({
      days: ["2026-07-13", "2026-07-14"],
      bookings: [] as WeekBooking[],
      schedule: [
        schedule({ id: "morning", day_of_week: 1, start_time: "06:00:00", end_time: "10:00:00", window_order: 1 }),
        schedule({ id: "afternoon", day_of_week: 1, start_time: "14:00:00", end_time: "18:00:00", window_order: 2 }),
      ],
      overrides: [override({ override_date: "2026-07-14" })],
      todayIso: "2026-07-13",
    });

    expect(planner.days[0]).toMatchObject({
      date: "2026-07-13",
      workHoursLabel: "06:00 — 10:00, 14:00 — 18:00",
      isDayOff: false,
    });
    expect(planner.days[1]).toMatchObject({
      date: "2026-07-14",
      workHoursLabel: "Day off",
      isDayOff: true,
      hasOverride: true,
    });
  });

  it("keeps unconfigured days distinct from day off", () => {
    const planner = buildStaffWeekPlanner({
      days: ["2026-07-15"],
      bookings: [] as WeekBooking[],
      schedule: [],
      overrides: [],
      todayIso: "2026-07-13",
    });

    expect(planner.days[0]).toMatchObject({
      workHoursLabel: null,
      isDayOff: false,
    });
  });
});
