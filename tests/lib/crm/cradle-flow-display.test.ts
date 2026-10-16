import { describe, expect, it } from "vitest";
import {
  futureCradleFlowHref,
  getCradleFlowPrimaryLabel,
  type CradleFlowBooking,
} from "@/lib/crm/cradle-flow";
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
      session_due_at: "2026-09-30T03:00:00Z",
    });

    expect(getCradleFlowAttention(ordinary)).toEqual([]);
    expect(getCradleFlowAttention(missingRoom)).toContain("Room not assigned");
    expect(getCradleFlowAttention(homeVisit)).toContain("Home Service location review");
    expect(getCradleFlowAttention(homeVisit)).not.toContain("Room not assigned");
    expect(getCradleFlowAttention(paymentDue, new Date("2026-09-30T02:59:00Z"))).not.toContain(
      "Payment Overdue"
    );
    expect(getCradleFlowAttention(paymentDue, new Date("2026-09-30T03:01:00Z"))).toContain(
      "Payment Overdue"
    );
    expect(
      getCradleFlowDisplayCounts([ordinary, missingRoom, homeVisit, paymentDue])
    ).toMatchObject({
      needs_action: 3,
      home_service: 1,
      ready_to_pay: 1,
    });
  });

  it("keeps ordinary unpaid visits clear and only warns when an elapsed service deadline still has a balance", () => {
    const expectedEnd = "2026-09-30T03:00:00Z";
    const beforeEnd = new Date("2026-09-30T02:59:00Z");
    const afterEnd = new Date("2026-09-30T03:01:00Z");
    const booked = visit({ session_due_at: expectedEnd, payment_status: "pay_on_site" });
    const active = visit({
      status: "in_progress",
      booking_progress_status: "session_started",
      session_due_at: expectedEnd,
    });
    const settled = visit({
      status: "completed",
      booking_progress_status: "completed",
      session_due_at: expectedEnd,
      payment_status: "paid",
      amount_paid: 850,
    });
    const overdue = visit({
      status: "in_progress",
      booking_progress_status: "session_started",
      session_due_at: expectedEnd,
      amount_paid: 100,
    });

    expect(getCradleFlowAttention(booked, afterEnd)).toEqual([]);
    expect(getCradleFlowAttention(active, beforeEnd)).toEqual([]);
    expect(getCradleFlowAttention(settled, afterEnd)).toEqual([]);
    expect(getCradleFlowAttention(overdue, afterEnd)).toEqual(["Payment Overdue"]);
  });

  it("excludes closed bookings from workflow counts", () => {
    const closed = visit({ status: "cancelled" });
    expect(getCradleFlowDisplayCounts([closed]).all).toBe(0);
    expect(matchesCradleFlowFilter(closed, "needs_action")).toBe(false);
  });

  it("keeps confirmed future work in Upcoming while preserving today's capsules", () => {
    const today = visit({ id: "today", booking_date: "2026-10-13" });
    const futurePending = visit({ id: "pending", booking_date: "2026-10-16", status: "pending" });
    const futureConfirmed = visit({
      id: "confirmed",
      booking_date: "2026-10-16",
      status: "confirmed",
      delivery_type: "home_service",
    });
    const counts = getCradleFlowDisplayCounts(
      [today, futurePending, futureConfirmed],
      "2026-10-13"
    );
    expect(counts).toMatchObject({ all: 1, upcoming: 2, needs_action: 1, home_service: 0 });
    expect(matchesCradleFlowFilter(futureConfirmed, "upcoming", "2026-10-13")).toBe(true);
    expect(matchesCradleFlowFilter(futureConfirmed, "not_arrived", "2026-10-13")).toBe(false);
    expect(getCradleFlowPrimaryLabel(futurePending, "2026-10-13")).toBe("View Booking");
    expect(getCradleFlowPrimaryLabel(futureConfirmed, "2026-10-13")).toBe("Open Home Service");
    expect(futureCradleFlowHref(futurePending)).toBe(
      "/crm/bookings?tab=upcoming&bookingId=pending"
    );
    expect(futureCradleFlowHref(futureConfirmed)).toBe("/crm/dispatch?bookingId=confirmed");
  });
});
