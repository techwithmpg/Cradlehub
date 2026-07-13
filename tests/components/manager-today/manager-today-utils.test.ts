import { describe, expect, it } from "vitest";
import {
  bookingNeedsResourceAssignment,
  computeAlerts,
  computeKpiData,
  getUrgencyScore,
  type TodayBooking,
} from "../../../src/components/features/manager-today/manager-today-utils";

function makeBooking(overrides: Partial<TodayBooking> = {}): TodayBooking {
  return {
    id: "booking-1",
    booking_date: "2026-07-13",
    start_time: "10:00:00",
    end_time: "11:00:00",
    type: "online",
    status: "confirmed",
    travel_buffer_mins: null,
    resource_id: null,
    branch_resources: null,
    services: {
      name: "Angels Massage",
      duration_minutes: 60,
      metadata: {},
    },
    staff: {
      id: "staff-1",
      full_name: "Andrea Guinanao",
      nickname: null,
    },
    customers: {
      full_name: "Customer",
    },
    ...overrides,
  };
}

describe("manager today room requirement handling", () => {
  it("does not flag a booking with no explicit resource requirement", () => {
    const booking = makeBooking();

    expect(bookingNeedsResourceAssignment(booking)).toBe(false);
    expect(computeKpiData([booking], 1).missingRooms).toBe(0);
    expect(computeAlerts([booking], 9 * 60)).not.toContainEqual(
      expect.objectContaining({ id: "missing-rooms" })
    );
    expect(getUrgencyScore(booking, 9 * 60)).toBe(70);
  });

  it("flags missing room only when service metadata requires one", () => {
    const booking = makeBooking({
      services: {
        name: "Couples Room Service",
        duration_minutes: 60,
        metadata: { requires_room: true },
      },
    });

    expect(bookingNeedsResourceAssignment(booking)).toBe(true);
    expect(computeKpiData([booking], 1).missingRooms).toBe(1);
    expect(computeAlerts([booking], 9 * 60)).toContainEqual(
      expect.objectContaining({ id: "missing-rooms", count: 1 })
    );
    expect(getUrgencyScore(booking, 9 * 60)).toBe(90);
  });
});
