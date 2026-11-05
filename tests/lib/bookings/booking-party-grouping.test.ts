import { describe, expect, it } from "vitest";
import { groupCrmBookings } from "@/lib/bookings/crm-booking-groups";
import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";

function service(id: string, orderId: string, recipient: string): WorkspaceBookingRow {
  return {
    id, order_id: orderId, booking_date: "2026-11-05",
    start_time: "11:00:00", end_time: "12:00:00",
    status: "confirmed", type: "walkin", delivery_type: "in_spa",
    staff_id: null, resource_id: null, metadata: { price_paid: 750 },
    payment_method: "cash", payment_status: "unpaid", amount_paid: 0,
    order_payment_status: "unpaid", order_total_amount: 750, order_amount_paid: 0,
    customers: { id: "customer-1", full_name: "Main Booker", phone: null, email: null },
    booking_attendees: {
      id: `attendee-${id}`, sequence: 1, display_name: recipient, customer_id: null,
    },
    booking_orders: {
      id: orderId, order_number: `ORDER-${orderId}`,
      organizer_customer_id: "customer-1", metadata: null,
    },
  } as WorkspaceBookingRow;
}

describe("CRM group booker identity and financial grouping", () => {
  it("uses the main customer for the order header, never the first attendee", () => {
    const group = groupCrmBookings([
      service("line-1", "shared-order", "Guest One"),
      service("line-2", "shared-order", "Guest Two"),
    ])[0]!;
    expect(group.organizerName).toBe("Main Booker");
    expect(group.lines).toHaveLength(2);
    expect(group.orderId).toBe("shared-order");
  });

  it("never consolidates independent orders only because they share a customer", () => {
    const groups = groupCrmBookings([
      service("line-1", "first-order", "Main Booker"),
      service("line-2", "second-order", "Guest Two"),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.orderId).sort()).toEqual(["first-order", "second-order"]);
    expect(groups.every((group) => group.organizerName === "Main Booker")).toBe(true);
  });
});
