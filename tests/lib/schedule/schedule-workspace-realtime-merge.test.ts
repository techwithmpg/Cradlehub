import { describe, expect, it } from "vitest";
import type { DailyScheduleApiResponse } from "@/components/features/schedule/hooks/use-live-daily-schedule";
import {
  mergeScheduleAttendanceRealtimeChange,
  mergeScheduleBookingRealtimeChange,
} from "@/lib/schedule/schedule-workspace-realtime-merge";

function fixture(): DailyScheduleApiResponse {
  const booking = {
    id: "booking-1",
    start_time: "2026-10-17T09:00:00+08:00",
    end_time: "2026-10-17T10:00:00+08:00",
    service_id: "service-1",
    service: "Massage",
    service_metadata: null,
    customer: "Client One",
    status: "confirmed",
    type: "spa",
    delivery_type: "in_store",
    resource_id: "room-1",
    resource_name: "Room 1",
    resource_type: "room",
    resource_capacity: 1,
    payment_method: null,
    payment_status: "unpaid",
    amount_paid: 0,
  };

  const staffA = {
    staff_id: "staff-a",
    staff_name: "Staff A",
    staff_tier: null,
    work_start: "09:00",
    work_end: "17:00",
    current_override: null,
    schedule_source: "weekly",
    schedule_status: "working",
    schedule_state: "WORKING",
    schedule_is_day_off: false,
    schedule_windows: [],
    schedule_conflict_code: null,
    schedule_conflict_reason: null,
    bookings: [booking],
    blocks: [],
    attendance_presence: {
      state: "not_checked_in",
      checkin_id: null,
      checked_in_at: null,
      checked_out_at: null,
      status: null,
    },
  } as unknown as DailyScheduleApiResponse["staffRows"][number];

  const staffB = {
    ...staffA,
    staff_id: "staff-b",
    staff_name: "Staff B",
    bookings: [],
  } as unknown as DailyScheduleApiResponse["staffRows"][number];

  const room = (id: string, name: string) =>
    ({
      id,
      branch_id: "branch-1",
      name,
      type: "room",
      capacity: 1,
      is_active: true,
    }) as unknown as DailyScheduleApiResponse["branchResources"][number];

  return {
    branchId: "branch-1",
    branchName: "Main",
    staffRows: [staffA, staffB],
    branchResources: [room("room-1", "Room 1"), room("room-2", "Room 2")],
    stats: {
      total: 1,
      confirmed: 1,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
    },
    readiness: null,
    schedulingRules: null,
  };
}

describe("PERF-4 schedule realtime tactical merge", () => {
  it("moves an existing booking between staff slots while preserving joined display data", () => {
    const source = fixture();
    const result = mergeScheduleBookingRealtimeChange(source, "2026-10-17", {
      eventType: "UPDATE",
      oldRow: {
        id: "booking-1",
        branch_id: "branch-1",
        booking_date: "2026-10-17",
        staff_id: "staff-a",
      },
      newRow: {
        id: "booking-1",
        branch_id: "branch-1",
        booking_date: "2026-10-17",
        staff_id: "staff-b",
        start_time: "2026-10-17T10:30:00+08:00",
        end_time: "2026-10-17T11:30:00+08:00",
        status: "in_progress",
        resource_id: "room-2",
        payment_status: "partial",
        amount_paid: 500,
      },
    });

    expect(result.relevant).toBe(true);
    expect(result.patched).toBe(true);
    expect(result.data.staffRows[0]?.bookings).toHaveLength(0);
    const moved = result.data.staffRows[1]?.bookings[0];
    expect(moved).toMatchObject({
      id: "booking-1",
      service: "Massage",
      customer: "Client One",
      status: "in_progress",
      resource_id: "room-2",
      resource_name: "Room 2",
      payment_status: "partial",
      amount_paid: 500,
    });
    expect(result.data.stats).toEqual(source.stats);
  });

  it("safely parses numeric string amount_paid values from realtime payloads", () => {
    const source = fixture();
    const result = mergeScheduleBookingRealtimeChange(source, "2026-10-17", {
      eventType: "UPDATE",
      oldRow: {
        id: "booking-1",
        branch_id: "branch-1",
        booking_date: "2026-10-17",
        staff_id: "staff-a",
      },
      newRow: {
        id: "booking-1",
        branch_id: "branch-1",
        booking_date: "2026-10-17",
        staff_id: "staff-a",
        start_time: "2026-10-17T09:00:00+08:00",
        end_time: "2026-10-17T10:00:00+08:00",
        amount_paid: "750.50",
      },
    });

    expect(result.relevant).toBe(true);
    expect(result.patched).toBe(true);
    expect(result.data.staffRows[0]?.bookings[0]?.amount_paid).toBe(750.5);
  });

  it("keeps service/resource joins server-authoritative when realtime references unloaded data", () => {
    const source = fixture();

    const serviceChange = mergeScheduleBookingRealtimeChange(source, "2026-10-17", {
      eventType: "UPDATE",
      oldRow: {
        id: "booking-1",
        branch_id: "branch-1",
        booking_date: "2026-10-17",
        staff_id: "staff-a",
      },
      newRow: {
        id: "booking-1",
        branch_id: "branch-1",
        booking_date: "2026-10-17",
        staff_id: "staff-a",
        start_time: "2026-10-17T09:00:00+08:00",
        end_time: "2026-10-17T10:00:00+08:00",
        service_id: "service-2",
      },
    });
    expect(serviceChange.relevant).toBe(true);
    expect(serviceChange.patched).toBe(false);
    expect(serviceChange.data).toBe(source);

    const unloadedResource = mergeScheduleBookingRealtimeChange(source, "2026-10-17", {
      eventType: "UPDATE",
      oldRow: {
        id: "booking-1",
        branch_id: "branch-1",
        booking_date: "2026-10-17",
        staff_id: "staff-a",
      },
      newRow: {
        id: "booking-1",
        branch_id: "branch-1",
        booking_date: "2026-10-17",
        staff_id: "staff-a",
        start_time: "2026-10-17T09:00:00+08:00",
        end_time: "2026-10-17T10:00:00+08:00",
        service_id: "service-1",
        resource_id: "room-not-loaded",
      },
    });
    expect(unloadedResource.relevant).toBe(true);
    expect(unloadedResource.patched).toBe(false);
    expect(unloadedResource.data).toBe(source);
  });

  it("does not invent joined data for a newly inserted booking", () => {
    const source = fixture();
    const result = mergeScheduleBookingRealtimeChange(source, "2026-10-17", {
      eventType: "INSERT",
      oldRow: {},
      newRow: {
        id: "booking-2",
        branch_id: "branch-1",
        booking_date: "2026-10-17",
        staff_id: "staff-a",
        start_time: "2026-10-17T13:00:00+08:00",
        end_time: "2026-10-17T14:00:00+08:00",
      },
    });

    expect(result.relevant).toBe(true);
    expect(result.patched).toBe(false);
    expect(result.data).toBe(source);
  });

  it("ignores booking events for another date when the booking is not already in the visible schedule", () => {
    const source = fixture();
    const result = mergeScheduleBookingRealtimeChange(source, "2026-10-17", {
      eventType: "UPDATE",
      oldRow: { id: "booking-x", booking_date: "2026-10-18", branch_id: "branch-1" },
      newRow: { id: "booking-x", booking_date: "2026-10-18", branch_id: "branch-1" },
    });

    expect(result).toEqual({ data: source, relevant: false, patched: false });
  });

  it("removes a visible booking immediately when it moves away from the selected date", () => {
    const source = fixture();
    const result = mergeScheduleBookingRealtimeChange(source, "2026-10-17", {
      eventType: "UPDATE",
      oldRow: { id: "booking-1", booking_date: "2026-10-17", branch_id: "branch-1" },
      newRow: {
        id: "booking-1",
        booking_date: "2026-10-18",
        branch_id: "branch-1",
        staff_id: "staff-a",
      },
    });

    expect(result.relevant).toBe(true);
    expect(result.patched).toBe(true);
    expect(result.data.staffRows[0]?.bookings).toHaveLength(0);
  });

  it("removes an existing booking from the visible staff slot when it becomes unassigned", () => {
    const source = fixture();
    const result = mergeScheduleBookingRealtimeChange(source, "2026-10-17", {
      eventType: "UPDATE",
      oldRow: {
        id: "booking-1",
        branch_id: "branch-1",
        booking_date: "2026-10-17",
        staff_id: "staff-a",
      },
      newRow: {
        id: "booking-1",
        branch_id: "branch-1",
        booking_date: "2026-10-17",
        staff_id: null,
        start_time: "2026-10-17T09:00:00+08:00",
        end_time: "2026-10-17T10:00:00+08:00",
      },
    });

    expect(result.relevant).toBe(true);
    expect(result.patched).toBe(true);
    expect(result.data.staffRows[0]?.bookings).toHaveLength(0);
    expect(result.data.staffRows[1]?.bookings).toHaveLength(0);
  });

  it("ignores an attendance event for the same staff when it belongs to another business date", () => {
    const source = fixture();
    const result = mergeScheduleAttendanceRealtimeChange(source, "2026-10-17", {
      eventType: "UPDATE",
      oldRow: {
        id: "checkin-next-day",
        branch_id: "branch-1",
        staff_id: "staff-a",
        attendance_business_date: "2026-10-18",
        shift_date: "2026-10-18",
      },
      newRow: {
        id: "checkin-next-day",
        branch_id: "branch-1",
        staff_id: "staff-a",
        attendance_business_date: "2026-10-18",
        shift_date: "2026-10-18",
        checked_in_at: "2026-10-18T08:55:00+08:00",
        checked_out_at: null,
        status: "checked_in",
      },
    });

    expect(result).toEqual({ data: source, relevant: false, patched: false });
  });

  it("patches only the affected staff attendance presence", () => {
    const source = fixture();
    const result = mergeScheduleAttendanceRealtimeChange(source, "2026-10-17", {
      eventType: "UPDATE",
      oldRow: {},
      newRow: {
        id: "checkin-1",
        branch_id: "branch-1",
        staff_id: "staff-a",
        attendance_business_date: "2026-10-17",
        shift_date: "2026-10-17",
        checked_in_at: "2026-10-17T08:55:00+08:00",
        checked_out_at: null,
        status: "checked_in",
      },
    });

    expect(result.relevant).toBe(true);
    expect(result.patched).toBe(true);
    expect(result.data.staffRows[0]?.attendance_presence).toMatchObject({
      state: "checked_in",
      checkin_id: "checkin-1",
      checked_in_at: "2026-10-17T08:55:00+08:00",
    });
    expect(result.data.staffRows[1]?.attendance_presence).toEqual(
      source.staffRows[1]?.attendance_presence
    );
  });

  it("keeps delete/void semantics server-authoritative", () => {
    const source = fixture();
    const result = mergeScheduleAttendanceRealtimeChange(source, "2026-10-17", {
      eventType: "DELETE",
      oldRow: {
        id: "checkin-1",
        branch_id: "branch-1",
        staff_id: "staff-a",
        attendance_business_date: "2026-10-17",
      },
      newRow: {},
    });

    expect(result.relevant).toBe(true);
    expect(result.patched).toBe(false);
    expect(result.data).toBe(source);
  });
});
