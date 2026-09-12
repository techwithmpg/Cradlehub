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

  it("classifies appointment as home_service when type = online and delivery_type = home_service", () => {
    const planner = buildStaffWeekPlanner({
      days: ["2026-07-15"],
      bookings: [
        {
          id: "b-online-home",
          booking_date: "2026-07-15",
          start_time: "10:00:00",
          end_time: "11:00:00",
          type: "online",
          delivery_type: "home_service",
          status: "confirmed",
          metadata: {},
          services: { id: "s-1", name: "Home Prenatal", duration_minutes: 60 },
          customers: { id: "c-1", full_name: "Alice Smith" },
        },
      ] as WeekBooking[],
      schedule: [],
      overrides: [],
      todayIso: "2026-07-15",
    });

    expect(planner.days[0]?.appointments[0]?.bookingType).toBe("home_service");
    expect(planner.summary.homeService).toBe(1);
    expect(planner.summary.inSpa).toBe(0);
    expect(planner.summary.online).toBe(0);
  });

  it("classifies appointment as non-home-service when type = online and delivery_type = in_spa", () => {
    const planner = buildStaffWeekPlanner({
      days: ["2026-07-15"],
      bookings: [
        {
          id: "b-online-spa",
          booking_date: "2026-07-15",
          start_time: "14:00:00",
          end_time: "15:00:00",
          type: "online",
          delivery_type: "in_spa",
          status: "confirmed",
          metadata: {},
          services: { id: "s-2", name: "In-Spa Massage", duration_minutes: 60 },
          customers: { id: "c-2", full_name: "Bob Jones" },
        },
      ] as WeekBooking[],
      schedule: [],
      overrides: [],
      todayIso: "2026-07-15",
    });

    expect(planner.days[0]?.appointments[0]?.bookingType).toBe("online");
    expect(planner.summary.homeService).toBe(0);
    expect(planner.summary.inSpa).toBe(1);
    expect(planner.summary.online).toBe(1);
  });

  it("classifies appointment as walk_in when type = walkin and delivery_type = in_spa", () => {
    const planner = buildStaffWeekPlanner({
      days: ["2026-07-15"],
      bookings: [
        {
          id: "b-walkin-spa",
          booking_date: "2026-07-15",
          start_time: "16:00:00",
          end_time: "17:00:00",
          type: "walkin",
          delivery_type: "in_spa",
          status: "confirmed",
          metadata: {},
          services: { id: "s-3", name: "Walk-in Foot Reflex", duration_minutes: 60 },
          customers: { id: "c-3", full_name: "Charlie Brown" },
        },
      ] as WeekBooking[],
      schedule: [],
      overrides: [],
      todayIso: "2026-07-15",
    });

    expect(planner.days[0]?.appointments[0]?.bookingType).toBe("walk_in");
    expect(planner.summary.homeService).toBe(0);
    expect(planner.summary.inSpa).toBe(1);
    expect(planner.summary.walkIn).toBe(1);
  });
});
