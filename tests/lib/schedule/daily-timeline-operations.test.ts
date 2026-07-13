import { describe, expect, it } from "vitest";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import {
  filterTimelineRows,
  getScheduleDisplayLabel,
  getScheduleDisplayState,
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
    schedule_status: "resolved",
    schedule_is_day_off: false,
    schedule_windows: [{ shiftType: "opening", startTime: "10:00:00", endTime: "17:00:00" }],
    schedule_conflict_code: null,
    schedule_conflict_reason: null,
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

  it("keeps no schedule, configured day off, and needs review as distinct display states", () => {
    expect(getScheduleDisplayState(row({ schedule_status: "missing", schedule_source: "none", schedule_windows: [] }))).toBe("not_configured");
    expect(getScheduleDisplayLabel(row({ schedule_status: "missing", schedule_source: "none", schedule_windows: [] }))).toBe("Not Configured");
    expect(getScheduleDisplayState(row({ schedule_status: "day_off", schedule_is_day_off: true, schedule_windows: [] }))).toBe("day_off");
    expect(getScheduleDisplayLabel(row({ schedule_status: "day_off", schedule_is_day_off: true, schedule_windows: [] }))).toBe("Day Off");
    expect(getScheduleDisplayState(row({ schedule_status: "conflict", schedule_windows: [] }))).toBe("needs_review");
    expect(getScheduleDisplayLabel(row({ schedule_status: "conflict", schedule_windows: [] }))).toBe("Needs Review");
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

  it("filters split-shift rows by any matching window", () => {
    const rows = [
      row({
        staff_id: "staff-1",
        schedule_windows: [
          { shiftType: "opening", startTime: "06:00:00", endTime: "10:00:00" },
          { shiftType: "single", startTime: "14:00:00", endTime: "18:00:00" },
        ],
      }),
      row({ staff_id: "staff-2", schedule_windows: [{ shiftType: "closing", startTime: "15:00:00", endTime: "23:00:00" }] }),
    ];

    const result = filterTimelineRows({
      rows,
      staffTypeById: new Map([["staff-1", "therapist"], ["staff-2", "therapist"]]),
      group: "therapist",
      filters: { query: "", shift: "regular", status: "all" },
      date: "2026-06-17",
    });

    expect(result.map((item) => item.staff_id)).toEqual(["staff-1"]);
  });

  it("derives live available and busy states from schedule, bookings, and blocks", () => {
    const now = new Date("2026-06-17T04:30:00.000Z");
    expect(getTimelineStatus(row(), "2026-06-17", now)).toBe("available");
    expect(getTimelineStatus(row({ blocks: [{ id: "break", start_time: "12:00:00", end_time: "13:00:00", reason: "Break" }] }), "2026-06-17", now)).toBe("busy");
    expect(getTimelineStatus(row(), "2026-06-18", now)).toBe("scheduled");
  });

  it("uses branch-local time for overnight live states", () => {
    const afterMidnightBranchTime = new Date("2026-06-17T16:30:00.000Z");

    expect(
      getTimelineStatus(
        row({
          schedule_windows: [{ shiftType: "closing", startTime: "17:00:00", endTime: "01:00:00" }],
        }),
        "2026-06-18",
        afterMidnightBranchTime
      )
    ).toBe("available");
  });

  it("detects staff and room conflicts while retaining travel and explicit missing-room signals", () => {
    const bookings = [
      { id: "a", start_time: "10:00:00", end_time: "11:00:00", service: "Massage", customer: "A", status: "confirmed", type: "online", resource_id: "room-1", resource_name: "Room 1" },
      { id: "b", start_time: "10:30:00", end_time: "11:30:00", service: "Facial", customer: "B", status: "confirmed", type: "online", resource_id: "room-1", resource_name: "Room 1" },
      { id: "c", start_time: "13:00:00", end_time: "14:00:00", service: "Home Massage", customer: "C", status: "confirmed", type: "home_service", resource_id: null, resource_name: null },
      { id: "d", start_time: "15:00:00", end_time: "16:00:00", service: "Massage", service_metadata: { requires_room: true }, customer: "D", status: "confirmed", type: "walkin", resource_id: null, resource_name: null },
    ];
    const alerts = buildDailyTimelineAlerts([row({ bookings })]);
    expect(alerts.map((alert) => alert.type)).toEqual(expect.arrayContaining(["staff_conflict", "resource_conflict", "travel", "missing_resource"]));
  });

  it("does not flag missing room when the service has no explicit resource requirement", () => {
    const bookings = [
      { id: "d", start_time: "15:00:00", end_time: "16:00:00", service: "Massage", service_metadata: {}, customer: "D", status: "confirmed", type: "walkin", resource_id: null, resource_name: null },
    ];

    expect(buildDailyTimelineAlerts([row({ bookings })])).toHaveLength(0);
  });

  it("ignores cancelled bookings when calculating conflicts", () => {
    const active = { id: "a", start_time: "10:00:00", end_time: "11:00:00", service: "Massage", customer: "A", status: "confirmed", type: "online", resource_id: "room-1", resource_name: "Room 1" };
    const cancelled = { ...active, id: "b", status: "cancelled" };
    expect(buildDailyTimelineAlerts([row({ bookings: [active, cancelled] })])).toHaveLength(0);
  });
});
