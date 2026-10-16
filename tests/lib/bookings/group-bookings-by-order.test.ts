import { describe, expect, it } from "vitest";
import {
  findBookingGroup,
  groupBookingsByOrder,
  matchesBookingGroupSearch,
  type GroupableBooking,
} from "@/lib/bookings/group-bookings-by-order";

type Line = GroupableBooking & {
  customer: string;
  service: string;
  therapist: string;
  room: string;
  phone: string;
  paymentTotal: number;
  paymentPaid: number;
  issues: string[];
};

function line(id: string, overrides: Partial<Line> = {}): Line {
  return {
    id,
    order_id: null,
    attendee_id: null,
    booking_date: "2026-10-15",
    start_time: "20:00:00",
    end_time: "21:30:00",
    status: "confirmed",
    booking_progress_status: "not_started",
    type: "walkin",
    delivery_type: "in_spa",
    customer: "Gwanmesia Malcom",
    service: "Sports Massage",
    therapist: "Janice",
    room: "Room 1",
    phone: "09170000000",
    paymentTotal: 800,
    paymentPaid: 0,
    issues: [],
    ...overrides,
  };
}

function orderLine(id: string, attendeeId: string, overrides: Partial<Line> = {}): Line {
  return line(id, {
    order_id: "order-1",
    attendee_id: attendeeId,
    booking_attendees: {
      id: attendeeId,
      sequence: Number(attendeeId.slice(-1)),
      display_name: `Guest ${attendeeId.slice(-1)}`,
      customer_id: null,
    },
    booking_orders: {
      id: "order-1",
      order_number: "CRD-123",
      organizer_customer_id: "customer-1",
      metadata: null,
    },
    paymentTotal: 2400,
    ...overrides,
  });
}

const read = {
  organizerName: (booking: Line) => booking.customer,
  payment: (booking: Line) => ({
    total: booking.paymentTotal,
    paid: booking.paymentPaid,
    due: booking.paymentTotal - booking.paymentPaid,
    status: booking.paymentPaid >= booking.paymentTotal ? "paid" : "unpaid",
  }),
  attention: (booking: Line) => booking.issues,
};

describe("order display grouping", () => {
  it("preserves unrelated legacy rows and single-line orders", () => {
    const groups = groupBookingsByOrder(
      [line("legacy-1"), line("legacy-2"), orderLine("order-line", "guest-1")],
      read
    );
    expect(groups).toHaveLength(3);
    expect(groups[0]).toMatchObject({
      orderId: null,
      serviceCount: 1,
      guestCount: 1,
      primaryBookingId: "legacy-1",
    });
    expect(groups[2]).toMatchObject({
      orderId: "order-1",
      serviceCount: 1,
      guestCount: 1,
      orderNumber: "CRD-123",
    });
  });

  it("counts distinct attendees independently of service lines and finds any child deep link", () => {
    const rows = [
      orderLine("b1", "guest-1"),
      orderLine("b2", "guest-1", { service: "Foot Massage" }),
      orderLine("b3", "guest-2"),
      orderLine("b4", "guest-2"),
      orderLine("b5", "guest-3"),
    ];
    const groups = groupBookingsByOrder(rows, read);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      guestCount: 3,
      serviceCount: 5,
      organizerName: "Gwanmesia Malcom",
    });
    expect(findBookingGroup(groups, "b5")?.displayId).toBe("order:order-1");
    expect(groupBookingsByOrder(rows.slice(0, 2), read)[0]).toMatchObject({
      guestCount: 1,
      serviceCount: 2,
    });
  });

  it("uses the earliest start and latest end, rather than summing concurrent durations", () => {
    const group = groupBookingsByOrder(
      [
        orderLine("b2", "guest-2", { start_time: "20:15:00", end_time: "21:00:00" }),
        orderLine("b1", "guest-1", { start_time: "20:00:00", end_time: "21:30:00" }),
      ],
      read
    )[0];
    expect(group).toMatchObject({
      primaryBookingId: "b1",
      startTime: "20:00:00",
      endTime: "21:30:00",
      elapsedMinutes: 90,
    });
  });

  it("derives mixed operational state and one counted attention summary", () => {
    const group = groupBookingsByOrder(
      [
        orderLine("b1", "guest-1", {
          status: "in_progress",
          booking_progress_status: "session_started",
          issues: ["Room not assigned"],
        }),
        orderLine("b2", "guest-2", { issues: ["Room not assigned"] }),
        orderLine("b3", "guest-3", { issues: ["Therapist not assigned"] }),
      ],
      read
    )[0];
    expect(group?.stage).toBe("in_service");
    expect(group?.attentionSummary).toEqual(["2 Room not assigned", "Therapist not assigned"]);
    expect(
      groupBookingsByOrder(
        [
          orderLine("b1", "guest-1", { status: "completed" }),
          orderLine("b2", "guest-2", { status: "completed" }),
        ],
        read
      )[0]?.stage
    ).toBe("ready_to_pay");
    expect(
      groupBookingsByOrder(
        [
          orderLine("b1", "guest-1", { status: "completed", paymentPaid: 2400 }),
          orderLine("b2", "guest-2", { status: "completed", paymentPaid: 2400 }),
        ],
        read
      )[0]?.stage
    ).toBe("completed");
  });

  it("uses parent payment only and searches any child field without splitting a group", () => {
    const groups = groupBookingsByOrder(
      [
        orderLine("b1", "guest-1"),
        orderLine("b2", "guest-2", { service: "Foot Massage", therapist: "Maria", room: "Room 2" }),
      ],
      read
    );
    expect(groups[0]?.payment).toEqual({ total: 2400, paid: 0, due: 2400, status: "unpaid" });
    const search = (query: string) =>
      groups.filter((group) =>
        matchesBookingGroupSearch(group, query, (booking) => [
          booking.service,
          booking.therapist,
          booking.room,
          booking.phone,
        ])
      );
    expect(search("guest 2")).toHaveLength(1);
    expect(search("Foot Massage")).toHaveLength(1);
    expect(search("Maria")).toHaveLength(1);
    expect(search("Room 2")).toHaveLength(1);
    expect(search("CRD-123")).toHaveLength(1);
    expect(search("b2")).toHaveLength(1);
  });
});
