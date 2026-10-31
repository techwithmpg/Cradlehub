import { describe, expect, it, vi } from "vitest";
import {
  isOperationalBookingGroup,
  isBookingLineCompleted,
  resolveBookingLifecycleState,
} from "@/lib/bookings/operational-booking-eligibility";
import type { CrmBookingGroup } from "@/lib/bookings/crm-booking-groups";
import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";

function createMockLine(overrides: Partial<WorkspaceBookingRow> = {}): WorkspaceBookingRow {
  return {
    id: "booking-1",
    branch_id: "branch-1",
    booking_date: "2026-10-29",
    start_time: "14:00:00",
    end_time: "15:00:00",
    status: "confirmed",
    booking_progress_status: "confirmed",
    type: "walkin",
    delivery_type: "in_spa",
    payment_status: "paid",
    metadata: {},
    services: { id: "svc-1", name: "Massage", duration_minutes: 60 },
    staff: { id: "staff-1", full_name: "Ana" },
    customers: { id: "cust-1", full_name: "Customer One" },
    ...overrides,
  } as WorkspaceBookingRow;
}

function createMockGroup(
  lines: WorkspaceBookingRow[],
  paymentOverrides: Partial<CrmBookingGroup["payment"]> = {},
  groupOverrides: Partial<CrmBookingGroup> = {}
): CrmBookingGroup {
  const primary = lines[0]!;
  return {
    displayId: `booking:${primary.id}`,
    orderId: primary.order_id ?? null,
    orderNumber: null,
    primaryBookingId: primary.id,
    organizerName: "Customer One",
    guestCount: lines.length,
    serviceCount: lines.length,
    lines,
    bookingDate: primary.booking_date,
    startTime: primary.start_time,
    endTime: primary.end_time ?? null,
    elapsedMinutes: 60,
    deliveryType: primary.delivery_type ?? "in_spa",
    payment: {
      total: 1000,
      paid: 1000,
      due: 0,
      status: "paid",
      ...paymentOverrides,
    },
    attentionSummary: [],
    stage: "waiting",
    ...groupOverrides,
  };
}

describe("Operational Booking Eligibility (Pass 3)", () => {
  const context = {
    businessDate: "2026-10-29",
    clockTime: "12:00:00",
  };

  it("1. shows upcoming valid appointment scheduled for today", () => {
    const line = createMockLine({ booking_date: "2026-10-29", start_time: "14:00:00", end_time: "15:00:00" });
    const group = createMockGroup([line]);
    expect(isOperationalBookingGroup(group, context)).toBe(true);
  });

  it("2. shows upcoming valid appointment scheduled for a future date", () => {
    const line = createMockLine({ booking_date: "2026-10-30", start_time: "10:00:00", end_time: "11:00:00" });
    const group = createMockGroup([line], {}, { bookingDate: "2026-10-30" });
    expect(isOperationalBookingGroup(group, context)).toBe(true);
  });

  it("3. shows customer checked in and waiting", () => {
    const line = createMockLine({
      booking_progress_status: "checked_in",
      checked_in_at: "2026-10-29T11:55:00Z",
    });
    const group = createMockGroup([line]);
    expect(isOperationalBookingGroup(group, context)).toBe(true);
  });

  it("4. shows in-service booking", () => {
    const line = createMockLine({
      status: "in_progress",
      booking_progress_status: "in_service",
      session_started_at: "2026-10-29T11:45:00Z",
    });
    const group = createMockGroup([line]);
    expect(isOperationalBookingGroup(group, context)).toBe(true);
  });

  it("5. hides completed service that is fully paid with no remaining operational work", () => {
    const line = createMockLine({
      status: "completed",
      booking_progress_status: "completed",
      session_completed_at: "2026-10-29T11:30:00Z",
    });
    const group = createMockGroup([line], { status: "paid", due: 0, paid: 1000, total: 1000 });
    expect(isOperationalBookingGroup(group, context)).toBe(false);
  });

  it("6. shows completed service with partial payment balance", () => {
    const line = createMockLine({
      status: "completed",
      booking_progress_status: "completed",
      session_completed_at: "2026-10-29T11:30:00Z",
    });
    const group = createMockGroup([line], { status: "partial", due: 500, paid: 500, total: 1000 });
    expect(isOperationalBookingGroup(group, context)).toBe(true);
  });

  it("7. shows completed service with unpaid balance", () => {
    const line = createMockLine({
      status: "completed",
      booking_progress_status: "completed",
      session_completed_at: "2026-10-29T11:30:00Z",
    });
    const group = createMockGroup([line], { status: "unpaid", due: 1000, paid: 0, total: 1000 });
    expect(isOperationalBookingGroup(group, context)).toBe(true);
  });

  it("8. shows multi-guest order where Guest 1 is completed & paid, but Guest 2 is in service", () => {
    const line1 = createMockLine({
      id: "line-1",
      status: "completed",
      booking_progress_status: "completed",
      session_completed_at: "2026-10-29T11:00:00Z",
    });
    const line2 = createMockLine({
      id: "line-2",
      status: "in_progress",
      booking_progress_status: "in_service",
      session_started_at: "2026-10-29T11:30:00Z",
    });
    const group = createMockGroup([line1, line2], { status: "paid", due: 0 });
    expect(isOperationalBookingGroup(group, context)).toBe(true);
  });

  it("9. shows multi-guest order where Guest 1 is completed & paid, but Guest 2 is completed with unpaid balance", () => {
    const line1 = createMockLine({
      id: "line-1",
      status: "completed",
      booking_progress_status: "completed",
      session_completed_at: "2026-10-29T11:00:00Z",
    });
    const line2 = createMockLine({
      id: "line-2",
      status: "completed",
      booking_progress_status: "completed",
      session_completed_at: "2026-10-29T11:45:00Z",
    });
    const group = createMockGroup([line1, line2], { status: "partial", due: 800, paid: 1200, total: 2000 });
    expect(isOperationalBookingGroup(group, context)).toBe(true);
  });

  it("10. hides multi-guest order where all guests are completed and fully paid", () => {
    const line1 = createMockLine({
      id: "line-1",
      status: "completed",
      booking_progress_status: "completed",
      session_completed_at: "2026-10-29T11:00:00Z",
    });
    const line2 = createMockLine({
      id: "line-2",
      status: "completed",
      booking_progress_status: "completed",
      session_completed_at: "2026-10-29T11:45:00Z",
    });
    const group = createMockGroup([line1, line2], { status: "paid", due: 0, paid: 2000, total: 2000 });
    expect(isOperationalBookingGroup(group, context)).toBe(false);
  });

  it("11. hides cancelled single booking", () => {
    const line = createMockLine({ status: "cancelled", booking_progress_status: "cancelled" });
    const group = createMockGroup([line]);
    expect(isOperationalBookingGroup(group, context)).toBe(false);
  });

  it("12. hides multi-guest order where all guests are cancelled", () => {
    const line1 = createMockLine({ id: "line-1", status: "cancelled" });
    const line2 = createMockLine({ id: "line-2", status: "cancelled" });
    const group = createMockGroup([line1, line2]);
    expect(isOperationalBookingGroup(group, context)).toBe(false);
  });

  it("13. shows multi-guest order where Guest 1 is cancelled but Guest 2 is upcoming", () => {
    const line1 = createMockLine({ id: "line-1", status: "cancelled" });
    const line2 = createMockLine({ id: "line-2", status: "confirmed", start_time: "14:00:00", end_time: "15:00:00" });
    const group = createMockGroup([line1, line2]);
    expect(isOperationalBookingGroup(group, context)).toBe(true);
  });

  it("14. hides expired unattended appointment from yesterday without delivered service (never treats as payment-ready completed)", () => {
    const line = createMockLine({
      booking_date: "2026-10-28",
      start_time: "14:00:00",
      end_time: "15:00:00",
      status: "confirmed",
      // Never attended / arrived
      checked_in_at: null,
      arrived_at: null,
      session_started_at: null,
      session_completed_at: null,
    });
    // Even if payment has an unpaid due amount, unattended expired appointment is NOT actionable
    const group = createMockGroup([line], { status: "unpaid", due: 1200, paid: 0 }, { bookingDate: "2026-10-28" });
    expect(isOperationalBookingGroup(group, context)).toBe(false);
  });

  it("15. hides expired unattended appointment earlier today whose scheduled end time elapsed", () => {
    const line = createMockLine({
      booking_date: "2026-10-29",
      start_time: "09:00:00",
      end_time: "10:00:00",
      status: "confirmed",
      checked_in_at: null,
      arrived_at: null,
      session_started_at: null,
      session_completed_at: null,
    });
    // Current clock time is 12:00:00, end time was 10:00:00, no attendance
    const group = createMockGroup([line], {}, { startTime: "09:00:00", endTime: "10:00:00" });
    expect(isOperationalBookingGroup(group, context)).toBe(false);
  });

  it("16. shows active Home Service booking", () => {
    const line = createMockLine({
      type: "home_service",
      delivery_type: "home_service",
      status: "confirmed",
      booking_progress_status: "confirmed",
    });
    const group = createMockGroup([line], {}, { deliveryType: "home_service" });
    expect(isOperationalBookingGroup(group, context)).toBe(true);
  });

  it("17. hides expired unattended appointment earlier today when clockTime is omitted (resolves branch clock)", () => {
    // 2026-10-29 14:30:00 Manila time (UTC+8) is 2026-10-29 06:30:00 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T06:30:00Z"));

    try {
      const line = createMockLine({
        booking_date: "2026-10-29",
        start_time: "10:00:00",
        end_time: "11:00:00",
        status: "confirmed",
        checked_in_at: null,
        arrived_at: null,
        session_started_at: null,
        session_completed_at: null,
      });
      const group = createMockGroup([line], {}, { startTime: "10:00:00", endTime: "11:00:00" });
      // Call with no context or businessDate only (clockTime omitted)
      expect(isOperationalBookingGroup(group, { businessDate: "2026-10-29" })).toBe(false);
      expect(isOperationalBookingGroup(group)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("19. hides completed service that is fully paid even with historical checked_in_at and session_started_at timestamps", () => {
    const line = createMockLine({
      status: "completed",
      booking_progress_status: "completed",
      checked_in_at: "2026-10-29T10:00:00Z",
      arrived_at: "2026-10-29T10:00:00Z",
      session_started_at: "2026-10-29T10:05:00Z",
      session_completed_at: "2026-10-29T11:05:00Z",
    });
    const group = createMockGroup([line], { status: "paid", due: 0, paid: 1200, total: 1200 });
    expect(isOperationalBookingGroup(group, context)).toBe(false);
  });

  it("20. shows completed service that has unpaid balance even with historical checked_in_at", () => {
    const line = createMockLine({
      status: "completed",
      booking_progress_status: "completed",
      checked_in_at: "2026-10-29T10:00:00Z",
      session_started_at: "2026-10-29T10:05:00Z",
      session_completed_at: "2026-10-29T11:05:00Z",
    });
    const group = createMockGroup([line], { status: "unpaid", due: 1200, paid: 0, total: 1200 });
    expect(isOperationalBookingGroup(group, context)).toBe(true);
  });

  it("21. shows multi-guest order where Guest 1 is completed with historical check-in and paid, but Guest 2 is checked in / waiting", () => {
    const line1 = createMockLine({
      id: "line-1",
      status: "completed",
      booking_progress_status: "completed",
      checked_in_at: "2026-10-29T10:00:00Z",
      session_started_at: "2026-10-29T10:05:00Z",
      session_completed_at: "2026-10-29T11:00:00Z",
    });
    const line2 = createMockLine({
      id: "line-2",
      status: "confirmed",
      booking_progress_status: "checked_in",
      checked_in_at: "2026-10-29T10:00:00Z",
      session_started_at: null,
      session_completed_at: null,
    });
    const group = createMockGroup([line1, line2], { status: "paid", due: 0 });
    expect(isOperationalBookingGroup(group, context)).toBe(true);
  });

  it("22. hides cancelled booking even if it had earlier checked_in_at and session_started_at", () => {
    const line = createMockLine({
      status: "cancelled",
      booking_progress_status: "cancelled",
      checked_in_at: "2026-10-29T10:00:00Z",
      session_started_at: "2026-10-29T10:05:00Z",
    });
    const group = createMockGroup([line]);
    expect(isOperationalBookingGroup(group, context)).toBe(false);
  });

  describe("resolveBookingLifecycleState", () => {
    it("resolves cancelled when status is cancelled regardless of timestamps", () => {
      const line = createMockLine({
        status: "cancelled",
        checked_in_at: "2026-10-29T10:00:00Z",
        session_started_at: "2026-10-29T10:05:00Z",
        session_completed_at: "2026-10-29T11:00:00Z",
      });
      expect(resolveBookingLifecycleState(line)).toBe("cancelled");
    });

    it("resolves completed when status/progress is completed even with historical check-in", () => {
      const line = createMockLine({
        status: "completed",
        booking_progress_status: "completed",
        checked_in_at: "2026-10-29T10:00:00Z",
        arrived_at: "2026-10-29T10:00:00Z",
        session_started_at: "2026-10-29T10:05:00Z",
        session_completed_at: "2026-10-29T11:00:00Z",
      });
      expect(resolveBookingLifecycleState(line)).toBe("completed");
    });

    it("resolves in_service when session is started and not completed", () => {
      const line = createMockLine({
        status: "in_progress",
        booking_progress_status: "session_started",
        checked_in_at: "2026-10-29T10:00:00Z",
        session_started_at: "2026-10-29T10:05:00Z",
        session_completed_at: null,
      });
      expect(resolveBookingLifecycleState(line)).toBe("in_service");
    });

    it("resolves checked_in when customer checked in or arrived and service not yet started", () => {
      const line = createMockLine({
        status: "confirmed",
        booking_progress_status: "checked_in",
        checked_in_at: "2026-10-29T10:00:00Z",
        session_started_at: null,
        session_completed_at: null,
      });
      expect(resolveBookingLifecycleState(line)).toBe("checked_in");
    });

    it("resolves upcoming when booking is scheduled with no check-in", () => {
      const line = createMockLine({
        status: "confirmed",
        booking_progress_status: "confirmed",
        checked_in_at: null,
        session_started_at: null,
        session_completed_at: null,
      });
      expect(resolveBookingLifecycleState(line)).toBe("upcoming");
      expect(isBookingLineCompleted(line)).toBe(false);
    });
  });
});

