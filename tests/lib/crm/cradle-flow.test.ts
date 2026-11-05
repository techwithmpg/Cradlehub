import { describe, expect, it } from "vitest";
import {
  getCradleFlowCounts,
  getCradleFlowPrimaryLabel,
  getCradleFlowStage,
  getCradleFlowServiceRecipientName,
  matchesCradleFlowSearch,
  type CradleFlowBooking,
} from "@/lib/crm/cradle-flow";

function booking(overrides: Partial<CradleFlowBooking> = {}): CradleFlowBooking {
  return {
    id: "booking-1",
    branch_id: "branch-1",
    booking_date: "2026-07-23",
    start_time: "10:00:00",
    end_time: "11:00:00",
    status: "confirmed",
    type: "walkin",
    delivery_type: "in_spa",
    travel_buffer_mins: null,
    payment_status: "pending",
    amount_paid: 0,
    price_paid: 850,
    customer_name: "Ana Santos",
    customer_phone: "09171234567",
    service_name: "Signature Massage",
    service_duration: 60,
    staff_name: "Melrose",
    resource_name: "Room 2",
    booking_progress_status: "not_started",
    ...overrides,
  };
}

describe("Cradle Flow lifecycle", () => {
  it("keeps payment out of the workflow until service completion", () => {
    const waiting = booking({ payment_status: "pending" });
    const active = booking({
      status: "in_progress",
      booking_progress_status: "session_started",
    });
    const ready = booking({
      status: "completed",
      booking_progress_status: "completed",
      session_completed_at: "2026-07-23T03:00:00.000Z",
    });

    expect(getCradleFlowStage(waiting)).toBe("waiting");
    expect(getCradleFlowPrimaryLabel(waiting)).toBe("Check In");
    expect(getCradleFlowStage(active)).toBe("in_service");
    expect(getCradleFlowPrimaryLabel(active)).toBe("Complete Service");
    expect(getCradleFlowStage(ready)).toBe("ready_to_pay");
    expect(getCradleFlowPrimaryLabel(ready)).toBe("Collect Payment");
  });

  it("moves a completed paid booking into Completed", () => {
    expect(
      getCradleFlowStage(
        booking({
          status: "completed",
          booking_progress_status: "completed",
          payment_status: "paid",
          amount_paid: 850,
        })
      )
    ).toBe("completed");
  });

  it("uses paid order status for a completed service without inventing booking amount", () => {
    expect(
      getCradleFlowStage(
        booking({
          order_id: "order-1",
          status: "completed",
          booking_progress_status: "completed",
          payment_status: "pending",
          amount_paid: 0,
          order_payment_status: "paid",
          order_amount_paid: 1000,
          order_total_amount: 1000,
        })
      )
    ).toBe("completed");
  });

  it("counts home service inside the same lifecycle", () => {
    const counts = getCradleFlowCounts([
      booking(),
      booking({
        id: "home-1",
        type: "home_service",
        delivery_type: "home_service",
      }),
      booking({
        id: "complete-1",
        status: "completed",
        payment_status: "paid",
      }),
    ]);

    expect(counts).toMatchObject({
      waiting: 2,
      completed: 1,
      homeService: 1,
    });
  });

  it("labels pending Home Service confirmation as Confirm Booking", () => {
    expect(
      getCradleFlowPrimaryLabel(
        booking({
          type: "home_service",
          delivery_type: "home_service",
          status: "pending_crm_confirmation",
          payment_status: "pending",
        })
      )
    ).toBe("Confirm Booking");
  });

  it("labels confirmed Home Service as an operational workspace action", () => {
    expect(
      getCradleFlowPrimaryLabel(
        booking({
          type: "home_service",
          delivery_type: "home_service",
          status: "confirmed",
        })
      )
    ).toBe("Open Home Service");
  });


  it("shows the named service recipient, not the person who booked and pays", () => {
    const row = booking({
      customer_name: "Booking Contact",
      attendee_id: "guest-1",
      booking_attendees: {
        id: "guest-1", sequence: 1, display_name: "Treatment Recipient",
        customer_id: null,
      },
    });
    expect(getCradleFlowServiceRecipientName(row)).toBe("Treatment Recipient");
    expect(row.customer_name).toBe("Booking Contact");
    expect(matchesCradleFlowSearch(row, "treatment recipient")).toBe(true);
    expect(matchesCradleFlowSearch(row, "booking contact")).toBe(true);
  });

  it("handles relation arrays and falls back safely for legacy single-person bookings", () => {
    const attendee = {
      id: "guest-1", sequence: 1, display_name: "  Guest A  ", customer_id: null,
    };
    expect(getCradleFlowServiceRecipientName(booking({
      booking_attendees: [attendee],
    }))).toBe("Guest A");
    expect(getCradleFlowServiceRecipientName(booking({
      booking_attendees: [{ ...attendee, display_name: " " }],
    }))).toBe("Ana Santos");
    expect(getCradleFlowServiceRecipientName(booking({
      customer_name: null,
      booking_attendees: null,
    }))).toBe("Unnamed customer");
  });

  it("searches customer, phone, booking id, service, staff, and address", () => {
    const row = booking({ hs_address: "12 Lacson Street" });
    expect(matchesCradleFlowSearch(row, "0917")).toBe(true);
    expect(matchesCradleFlowSearch(row, "lacson")).toBe(true);
    expect(matchesCradleFlowSearch(row, "missing")).toBe(false);
  });
});
