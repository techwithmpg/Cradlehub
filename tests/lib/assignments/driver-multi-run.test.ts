import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  type RecommendationContext,
  scoreDriverCandidates,
} from "@/lib/assignments/recommendation-engine";

const DRIVER_ID = "driver-1";
const BRANCH_ID = "branch-main";

function driverContext(overrides: Partial<RecommendationContext> = {}): RecommendationContext {
  const bookingDate = overrides.bookingDate ?? "2026-10-19"; // Monday
  const dayOfWeek = new Date(
    Number(bookingDate.slice(0, 4)),
    Number(bookingDate.slice(5, 7)) - 1,
    Number(bookingDate.slice(8, 10))
  ).getDay();

  return {
    bookingDate,
    bookingStartTime: "18:00:00",
    bookingEndTime: "19:00:00",
    bookingMode: "home_service",
    isHomeService: true,
    service: null,
    staffList: [{
      id: DRIVER_ID,
      full_name: "On-duty Driver",
      staff_type: "driver",
      system_role: "driver",
      tier: "n/a",
      is_active: true,
      branch_id: BRANCH_ID,
    }],
    staffServices: [],
    schedules: [{
      staff_id: DRIVER_ID,
      day_of_week: dayOfWeek,
      start_time: "17:00:00",
      end_time: "00:00:00",
      is_active: true,
      shift_type: "closing",
      ends_next_day: true,
    }],
    overrides: [],
    blockedTimes: [],
    checkins: [],
    existingBookings: [],
    preferences: [],
    ...overrides,
  };
}

function assignedBooking(index: number, progress: string) {
  return {
    booking_id: `previous-booking-${index}`,
    staff_id: DRIVER_ID,
    start_time: "17:00:00",
    end_time: "20:00:00",
    status: "in_progress",
    booking_progress_status: progress,
  };
}

describe("driver dispatch capacity is based on outbound travel, not service count", () => {
  it("allows a fourth sequential job when three staff drop-offs are already marked arrived", () => {
    const result = scoreDriverCandidates(driverContext({
      existingBookings: [
        assignedBooking(1, "arrived"),
        assignedBooking(2, "session_started"),
        assignedBooking(3, "arrived"),
      ],
    }));

    expect(result).toHaveLength(1);
    expect(result[0]?.workloadCount).toBe(3);
    expect(result[0]?.status).toBe("recommended");
    expect(result[0]?.reasons).toContain("No outbound trip in progress");
    expect(result[0]?.warnings).not.toContain(
      "Driver is already en route; confirm return before dispatching"
    );
  });

  it("warns when the driver really is travelling on another active run", () => {
    const result = scoreDriverCandidates(driverContext({
      existingBookings: [assignedBooking(1, "travel_started")],
    }));

    expect(result[0]?.warnings).toContain(
      "Driver is already en route; confirm return before dispatching"
    );
    expect(result[0]?.reasons).not.toContain("No outbound trip in progress");
  });

  it("does not treat a completed booking as an active outbound trip", () => {
    const result = scoreDriverCandidates(driverContext({
      existingBookings: [
        { ...assignedBooking(1, "completed"), status: "completed" },
      ],
    }));

    expect(result[0]?.warnings).not.toContain(
      "Driver is already en route; confirm return before dispatching"
    );
  });

  it("fits weekday closing driver shift from 5 PM to midnight", () => {
    const result = scoreDriverCandidates(driverContext({
      bookingStartTime: "23:00:00",
      bookingEndTime: "23:30:00",
    }));
    expect(result[0]?.reasons).toContain("Inside active shift");
  });

  it("supports Saturday 2 PM to Sunday 1 AM as an overnight shift", () => {
    const result = scoreDriverCandidates(driverContext({
      bookingDate: "2026-10-17", // Saturday
      bookingStartTime: "23:30:00",
      bookingEndTime: "00:30:00",
      schedules: [{
        staff_id: DRIVER_ID,
        day_of_week: 6,
        start_time: "14:00:00",
        end_time: "01:00:00",
        is_active: true,
        shift_type: "single",
        ends_next_day: true,
      }],
    }));
    expect(result[0]?.reasons).toContain("Inside active shift");
  });

  it("warns when a proposed run extends beyond the scheduled driver shift", () => {
    const result = scoreDriverCandidates(driverContext({
      bookingStartTime: "23:30:00",
      bookingEndTime: "00:30:00",
    }));
    expect(result[0]?.warnings).toContain("Dispatch extends outside shift hours");
  });
});
