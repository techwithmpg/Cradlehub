import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  generateOrderNumber,
  buildBookingOrderMetadata,
  extractBookingOrderFromMetadata,
  type BookingOrderAttendee,
  type BookingOrderSummary,
} from "@/lib/bookings/booking-order-contract";
import { findDistinctStaffAssignment } from "@/lib/engine/availability";

describe("Booking Order Contract", () => {
  it("generates formatted order numbers matching CRD-YYMM-XXXX pattern", () => {
    const orderNumber = generateOrderNumber("2026-09-26");
    expect(orderNumber).toMatch(/^CRD-2609-[A-Z0-9]{4}$/);
  });

  it("builds consistent booking order metadata for single-person booking", () => {
    const attendees: BookingOrderAttendee[] = [
      {
        id: "att-1",
        index: 0,
        name: "Malcom",
        isOrganizer: true,
        serviceIds: ["svc-1"],
      },
    ];

    const orderSummary: BookingOrderSummary = {
      orderId: "ord-123",
      orderNumber: "CRD-2609-TEST",
      branchId: "branch-1",
      branchName: "Main Branch",
      bookingDate: "2026-09-26",
      startTime: "14:00:00",
      deliveryType: "in_spa",
      bookingFor: "me",
      organizer: {
        fullName: "Malcom",
        phone: "09171234567",
        email: "malcom@example.com",
      },
      recipientName: null,
      attendees,
      totalAttendees: 1,
      totalServices: 1,
      totalDurationMinutes: 60,
      subtotalAmount: 800,
      homeServiceFee: 0,
      totalAmount: 800,
      paymentChoice: "pay_later",
      paymentStatus: "unpaid",
      bookingIds: ["bkg-1"],
      createdAt: new Date().toISOString(),
    };

    const metadata = buildBookingOrderMetadata({
      orderSummary,
      attendee: attendees[0]!,
      serviceLine: {
        serviceId: "svc-1",
        serviceName: "Swedish Massage",
        durationMinutes: 60,
        price: 800,
        attendeeIndex: 0,
        attendeeId: "att-1",
        attendeeName: "Malcom",
        serviceLineIndex: 0,
        totalServicesForAttendee: 1,
      },
      groupBookingIds: ["bkg-1"],
    });

    const bookingOrder = metadata.booking_order as Record<string, unknown>;
    const serviceLine = metadata.service_line as Record<string, unknown>;

    expect(metadata.order_id).toBe("ord-123");
    expect(metadata.order_number).toBe("CRD-2609-TEST");
    expect(bookingOrder.total_attendees).toBe(1);
    expect(bookingOrder.total_services).toBe(1);
    expect(bookingOrder.total_amount).toBe(800);
    expect(serviceLine.service_id).toBe("svc-1");

    const extracted = extractBookingOrderFromMetadata(metadata);
    expect(extracted?.orderId).toBe("ord-123");
    expect(extracted?.orderNumber).toBe("CRD-2609-TEST");
    expect(extracted?.organizer.fullName).toBe("Malcom");
  });

  it("builds metadata for multi-attendee multi-service order", () => {
    const attendees: BookingOrderAttendee[] = [
      {
        id: "att-1",
        index: 0,
        name: "Malcom",
        isOrganizer: true,
        serviceIds: ["svc-massage", "svc-facial"],
      },
      {
        id: "att-2",
        index: 1,
        name: "Sarah",
        isOrganizer: false,
        serviceIds: ["svc-massage"],
      },
    ];

    const orderSummary: BookingOrderSummary = {
      orderId: "ord-group",
      orderNumber: "CRD-2609-GRP1",
      branchId: "branch-1",
      branchName: "Main Branch",
      bookingDate: "2026-09-26",
      startTime: "14:00:00",
      deliveryType: "in_spa",
      bookingFor: "me_and_others",
      organizer: {
        fullName: "Malcom",
        phone: "09171234567",
      },
      recipientName: null,
      attendees,
      totalAttendees: 2,
      totalServices: 3,
      totalDurationMinutes: 120,
      subtotalAmount: 2400,
      homeServiceFee: 0,
      totalAmount: 2400,
      paymentChoice: "pay_later",
      paymentStatus: "unpaid",
      bookingIds: ["bkg-1", "bkg-2", "bkg-3"],
      createdAt: new Date().toISOString(),
    };

    const metadata = buildBookingOrderMetadata({
      orderSummary,
      attendee: attendees[1]!,
      serviceLine: {
        serviceId: "svc-massage",
        serviceName: "Swedish Massage",
        durationMinutes: 60,
        price: 800,
        attendeeIndex: 1,
        attendeeId: "att-2",
        attendeeName: "Sarah",
        serviceLineIndex: 0,
        totalServicesForAttendee: 1,
      },
      groupBookingIds: ["bkg-1", "bkg-2", "bkg-3"],
    });

    const bookingOrder = metadata.booking_order as Record<string, unknown>;
    const attendee = metadata.attendee as Record<string, unknown>;

    expect(bookingOrder.total_attendees).toBe(2);
    expect(bookingOrder.total_services).toBe(3);
    expect(bookingOrder.booking_for).toBe("me_and_others");
    expect(attendee.name).toBe("Sarah");
    expect(attendee.is_organizer).toBe(false);
  });
});

describe("Distinct Staff Assignment (findDistinctStaffAssignment)", () => {
  it("assigns distinct staff when sufficient qualified therapists exist", () => {
    // 3 attendees needing services:
    // attendee 0: qualified staff [staffA, staffB]
    // attendee 1: qualified staff [staffA]
    // attendee 2: qualified staff [staffB, staffC]
    const candidates = [
      ["staffA", "staffB"],
      ["staffA"],
      ["staffB", "staffC"],
    ];

    const assignment = findDistinctStaffAssignment(candidates);
    expect(assignment).not.toBeNull();
    expect(assignment).toHaveLength(3);

    // Verify all assigned staff IDs are unique
    const uniqueAssigned = new Set(assignment);
    expect(uniqueAssigned.size).toBe(3);

    // Verify attendee 1 got staffA (only choice)
    expect(assignment![1]).toBe("staffA");
  });

  it("returns null when therapists cannot satisfy concurrent attendee demand", () => {
    // 3 attendees, but only 2 therapists available
    const candidates = [
      ["staffA", "staffB"],
      ["staffA", "staffB"],
      ["staffA", "staffB"],
    ];

    const assignment = findDistinctStaffAssignment(candidates);
    expect(assignment).toBeNull();
  });
});
