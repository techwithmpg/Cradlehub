import { describe, expect, it } from "vitest";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import {
  filterTimelineRows,
  getShiftGroup,
  getStaffGroupKey,
  getTimelineStatus,
} from "@/components/features/schedule/tabs/daily-timeline-operations";
import { buildDailyTimelineAlerts } from "@/components/features/schedule/tabs/daily-timeline-alerts";

function row(overrides: Partial<DailyScheduleStaffRow> = {}): DailyScheduleStaffRow {
  return {
    staff_id: "staff-1",
    staff_name: "Nikki Joy Villarias",
    staff_tier: "junior",
    work_start: "10:00:00",
    work_end: "17:00:00",
    current_override: null,
    schedule_source: "individual",
    schedule_is_day_off: false,
    schedule_windows: [{ shiftType: "opening", startTime: "10:00:00", endTime: "17:00:00" }],
    bookings: [],
    blocks: [],
    ...overrides,
  };
}

describe("Daily Timeline operations model", () => {
  it("maps operational staff types into role-aware groups", () => {
    expect(getStaffGroupKey("therapist")).toBe("therapist");
    expect(getStaffGroupKey("csr")).toBe("front_desk");
    expect(getStaffGroupKey("nail_tech")).toBe("salon");
    expect(getStaffGroupKey("unknown_role")).toBe("other");
  });

  it("classifies opening, closing, regular, and day-off rows", () => {
    expect(getShiftGroup(row())).toBe("opening");
    expect(getShiftGroup(row({ schedule_windows: [{ shiftType: "closing", startTime: "14:00:00", endTime: "22:00:00" }] }))).toBe("closing");
    expect(getShiftGroup(row({ schedule_windows: [{ shiftType: "single", startTime: "10:00:00", endTime: "18:00:00" }] }))).toBe("regular");
    expect(getShiftGroup(row({ schedule_is_day_off: true, schedule_windows: [] }))).toBe("off");
  });

  it("filters by staff group, name, and shift without changing source rows", () => {
    const rows = [row(), row({ staff_id: "staff-2", staff_name: "Melrose Delina" })];
    const result = filterTimelineRows({
      rows,
      staffTypeById: new Map([["staff-1", "therapist"], ["staff-2", "csr"]]),
      group: "therapist",
      filters: { query: "nikki", shift: "opening", status: "all" },
      date: "2026-06-17",
    });
    expect(result.map((item) => item.staff_id)).toEqual(["staff-1"]);
    expect(rows).toHaveLength(2);
  });

  it("derives live available and busy states from schedule, bookings, and blocks", () => {
    const now = new Date("2026-06-17T12:30:00");
    expect(getTimelineStatus(row(), "2026-06-17", now)).toBe("available");
    expect(getTimelineStatus(row({ blocks: [{ id: "break", start_time: "12:00:00", end_time: "13:00:00", reason: "Break" }] }), "2026-06-17", now)).toBe("busy");
    expect(getTimelineStatus(row(), "2026-06-18", now)).toBe("scheduled");
  });

  it("detects staff and room conflicts while retaining travel and missing-room signals", () => {
    const bookings = [
      { id: "a", start_time: "10:00:00", end_time: "11:00:00", service: "Massage", customer: "A", status: "confirmed", type: "online", resource_id: "room-1", resource_name: "Room 1" },
      { id: "b", start_time: "10:30:00", end_time: "11:30:00", service: "Facial", customer: "B", status: "confirmed", type: "online", resource_id: "room-1", resource_name: "Room 1" },
      { id: "c", start_time: "13:00:00", end_time: "14:00:00", service: "Home Massage", customer: "C", status: "confirmed", type: "home_service", resource_id: null, resource_name: null },
      { id: "d", start_time: "15:00:00", end_time: "16:00:00", service: "Massage", customer: "D", status: "confirmed", type: "walkin", resource_id: null, resource_name: null },
    ];
    const alerts = buildDailyTimelineAlerts([row({ bookings })]);
    expect(alerts.map((alert) => alert.type)).toEqual(expect.arrayContaining(["staff_conflict", "resource_conflict", "travel", "missing_resource"]));
  });

  it("ignores cancelled bookings when calculating conflicts", () => {
    const active = { id: "a", start_time: "10:00:00", end_time: "11:00:00", service: "Massage", customer: "A", status: "confirmed", type: "online", resource_id: "room-1", resource_name: "Room 1" };
    const cancelled = { ...active, id: "b", status: "cancelled" };
    expect(buildDailyTimelineAlerts([row({ bookings: [active, cancelled] })])).toHaveLength(0);
  });
});
