import { describe, expect, it } from "vitest";
import type { DailyScheduleBooking, DailyScheduleStaffRow } from "@/lib/queries/schedule";
import { buildLiveScheduleConflicts } from "@/lib/schedule/live-schedule-conflicts";
import type { SchedulingRules } from "@/lib/scheduling/types";

const baseRules: SchedulingRules = {
  id: "rules-1",
  branch_id: "branch-1",
  min_daily_staff: 2,
  min_daily_therapists: 1,
  min_daily_csr: 1,
  min_daily_drivers: 0,
  min_daily_utility: 0,
  default_days_off_per_week: 1,
  max_same_role_off_per_day: 2,
  max_therapists_off_per_day: 1,
  protect_weekends: true,
  default_break_minutes: 60,
  auto_breaks_enabled: true,
  max_working_hours_per_day: 8,
  max_services_per_staff_per_day: null,
  auto_generate_breaks: true,
  auto_generate_travel_buffers: true,
  auto_generate_room_reset_buffers: false,
  room_reset_buffer_minutes: 15,
  home_service_travel_buffer_minutes: 30,
  suggestions_require_manager_approval: true,
  created_at: "2026-07-09T00:00:00.000Z",
  updated_at: "2026-07-09T00:00:00.000Z",
};

function booking(overrides: Partial<DailyScheduleBooking> = {}): DailyScheduleBooking {
  return {
    id: "booking-1",
    start_time: "10:00:00",
    end_time: "11:00:00",
    service: "Swedish Massage",
    customer: "Maria Santos",
    status: "confirmed",
    type: "walkin",
    resource_id: "room-1",
    resource_name: "Room 1",
    ...overrides,
  };
}

function row(overrides: Partial<DailyScheduleStaffRow> = {}): DailyScheduleStaffRow {
  return {
    staff_id: "staff-1",
    staff_name: "Frannie",
    staff_tier: null,
    work_start: "10:00:00",
    work_end: "18:00:00",
    current_override: null,
    schedule_source: "individual",
    schedule_status: "resolved",
    schedule_is_day_off: false,
    schedule_windows: [{ shiftType: "single", startTime: "10:00:00", endTime: "18:00:00" }],
    schedule_conflict_code: null,
    schedule_conflict_reason: null,
    bookings: [],
    blocks: [],
    ...overrides,
  };
}

function conflictTypes(rows: DailyScheduleStaffRow[]) {
  return buildLiveScheduleConflicts(rows, {
    date: "2026-07-09",
    schedulingRules: baseRules,
    includeCoverageGap: false,
  }).map((conflict) => conflict.type);
}

describe("buildLiveScheduleConflicts", () => {
  it("detects staff overlap with staff name, booking ids, and time", () => {
    const conflicts = buildLiveScheduleConflicts(
      [
        row({
          bookings: [
            booking({ id: "a", start_time: "10:00:00", end_time: "11:00:00", resource_id: "room-1" }),
            booking({ id: "b", service: "Body Scrub", start_time: "10:30:00", end_time: "11:30:00", resource_id: "room-2" }),
          ],
        }),
      ],
      { date: "2026-07-09", schedulingRules: baseRules }
    );

    const overlap = conflicts.find((conflict) => conflict.type === "staff_overlap");
    expect(overlap).toMatchObject({
      severity: "critical",
      affected_staff_names: ["Frannie"],
      affected_booking_ids: ["a", "b"],
      start_time: "10:00:00",
    });
    expect(overlap?.plain_language_message).toContain("Frannie has two bookings");
  });

  it("detects room double-booking and includes room and affected bookings", () => {
    const conflicts = buildLiveScheduleConflicts(
      [
        row({ staff_id: "staff-1", staff_name: "Frannie", bookings: [booking({ id: "a" })] }),
        row({ staff_id: "staff-2", staff_name: "Louela", bookings: [booking({ id: "b", service: "Ventosa", start_time: "10:30:00", end_time: "11:30:00" })] }),
      ],
      { date: "2026-07-09", schedulingRules: baseRules }
    );

    const roomConflict = conflicts.find((conflict) => conflict.type === "room_double_booked");
    expect(roomConflict).toMatchObject({
      severity: "critical",
      affected_resource_name: "Room 1",
      affected_booking_ids: ["a", "b"],
    });
    expect(roomConflict?.plain_language_message).toContain("Room 1 is assigned to two bookings");
  });

  it("detects missing room, outside shift, day off, blocked time, missing schedule, duplicate windows, travel buffer, and coverage gap", () => {
    const rows = [
      row({ bookings: [booking({ id: "missing-room", resource_id: null, resource_name: null })] }),
      row({ staff_id: "staff-2", staff_name: "Outside", bookings: [booking({ id: "outside", start_time: "09:00:00", end_time: "10:00:00", resource_id: "room-2" })] }),
      row({ staff_id: "staff-3", staff_name: "Off", schedule_status: "day_off", schedule_is_day_off: true, schedule_windows: [], bookings: [booking({ id: "day-off", resource_id: "room-3" })] }),
      row({ staff_id: "staff-4", staff_name: "Blocked", bookings: [booking({ id: "blocked", resource_id: "room-4" })], blocks: [{ id: "break", start_time: "10:30:00", end_time: "11:00:00", reason: "Break" }] }),
      row({ staff_id: "staff-5", staff_name: "No schedule", work_start: null, work_end: null, schedule_source: "none", schedule_status: "missing", schedule_windows: [] }),
      row({ staff_id: "staff-6", staff_name: "Duplicate", schedule_windows: [{ shiftType: "opening", startTime: "10:00:00", endTime: "14:00:00" }, { shiftType: "closing", startTime: "13:00:00", endTime: "18:00:00" }] }),
      row({
        staff_id: "staff-7",
        staff_name: "Home",
        bookings: [
          booking({ id: "home", type: "home_service", resource_id: null, resource_name: null, end_time: "11:00:00" }),
          booking({ id: "next", start_time: "11:10:00", end_time: "12:00:00", resource_id: "room-7" }),
        ],
      }),
    ];

    const conflicts = buildLiveScheduleConflicts(rows, {
      date: "2026-07-09",
      schedulingRules: { ...baseRules, min_daily_staff: 10 },
      includeCoverageGap: true,
    });

    expect(conflicts.map((conflict) => conflict.type)).toEqual(
      expect.arrayContaining([
        "missing_room",
        "booking_outside_shift",
        "booking_on_day_off",
        "booking_during_blocked_time",
        "missing_schedule",
        "duplicate_schedule_window",
        "home_service_travel_buffer_warning",
        "coverage_gap",
      ])
    );
    expect(conflicts.every((conflict) => conflict.quick_actions.length > 0)).toBe(true);
  });

  it("does not treat staff attendance or check-in absence as a schedule conflict", () => {
    expect(conflictTypes([row()])).toEqual([]);
  });

  it("surfaces resolver-detected schedule conflicts even when windows are empty", () => {
    const conflicts = buildLiveScheduleConflicts(
      [
        row({
          schedule_status: "conflict",
          schedule_windows: [],
          schedule_conflict_code: "overlapping_windows",
          schedule_conflict_reason: "Multiple active schedule windows overlap for the same day.",
        }),
      ],
      { date: "2026-07-09", schedulingRules: baseRules }
    );

    expect(conflicts.map((conflict) => conflict.type)).toContain("schedule_rule_conflict");
  });
});
