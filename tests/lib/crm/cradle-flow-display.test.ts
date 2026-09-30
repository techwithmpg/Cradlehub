import { describe, expect, it } from "vitest";
import type { CradleFlowBooking } from "@/lib/crm/cradle-flow";
import {
  getCradleFlowAttention,
  getCradleFlowDisplayCounts,
  getCradleFlowDisplayStatus,
  matchesCradleFlowFilter,
} from "@/components/features/crm/today/cradle-flow-display";

function visit(overrides: Partial<CradleFlowBooking> = {}): CradleFlowBooking {
  return {
    id: "visit-1",
    booking_date: "2026-09-30",
    start_time: "10:00:00",
    end_time: "11:00:00",
    status: "confirmed",
    type: "walkin",
    delivery_type: "in_spa",
    travel_buffer_mins: null,
    payment_status: "pending",
    amount_paid: 0,
    price_paid: 850,
    customer_name: "Example Customer",
    service_name: "Massage",
    service_duration: 60,
    staff_name: "Assigned Therapist",
    resource_id: "room-1",
    resource_name: "Room 1",
    booking_progress_status: "not_started",
    ...overrides,
  };
}

describe("Cradle Flow display organization", () => {
  it("separates not-arrived visits from checked-in waiting visits using existing facts", () => {
    const booked = visit();
    const arrived = visit({ id: "visit-2", checked_in_at: "2026-09-30T02:00:00Z" });

    expect(getCradleFlowDisplayStatus(booked)).toBe("Booked · Not Arrived");
    expect(getCradleFlowDisplayStatus(arrived)).toBe("Arrived · Ready to Start");
    expect(matchesCradleFlowFilter(booked, "not_arrived")).toBe(true);
    expect(matchesCradleFlowFilter(arrived, "waiting_arrived")).toBe(true);
    expect(getCradleFlowDisplayCounts([booked, arrived])).toMatchObject({
      all: 2,
      not_arrived: 1,
      waiting_arrived: 1,
    });
  });

  it("shows attention only when actual assignment, dispatch or payment facts support it", () => {
    const ordinary = visit();
    const missingRoom = visit({ id: "visit-2", resource_id: null, resource_name: null });
    const homeVisit = visit({
      id: "visit-3",
      type: "home_service",
      delivery_type: "home_service",
      resource_name: null,
      needs_location_review: true,
    });
    const paymentDue = visit({
      id: "visit-4",
      status: "completed",
      booking_progress_status: "completed",
    });

    expect(getCradleFlowAttention(ordinary)).toEqual([]);
    expect(getCradleFlowAttention(missingRoom)).toContain("Room not assigned");
    expect(getCradleFlowAttention(homeVisit)).toContain("Home Service location review");
    expect(getCradleFlowAttention(homeVisit)).not.toContain("Room not assigned");
    expect(getCradleFlowAttention(paymentDue)).toContain("Payment due");
    expect(getCradleFlowDisplayCounts([ordinary, missingRoom, homeVisit, paymentDue])).toMatchObject({
      needs_action: 3,
      home_service: 1,
      ready_to_pay: 1,
    });
  });

  it("excludes closed bookings from workflow counts", () => {
    const closed = visit({ status: "cancelled" });
    expect(getCradleFlowDisplayCounts([closed]).all).toBe(0);
    expect(matchesCradleFlowFilter(closed, "needs_action")).toBe(false);
  });
});
