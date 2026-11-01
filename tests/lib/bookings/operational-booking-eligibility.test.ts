import { describe, expect, it, vi } from "vitest";
import {
  isOperationalBookingGroup,
  isBookingLineCompleted,
  isBookingLineClosed,
  resolveBookingLifecycleState,
} from "@/lib/bookings/operational-booking-eligibility";
import {
  getVerifiedBookingPrice,
  isPaymentFullySettled,
  getBookingPaymentDisplayState,
  groupCrmBookings,
  type CrmBookingGroup,
} from "@/lib/bookings/crm-booking-groups";
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

  it("18. shows upcoming appointment later today when clockTime is omitted", () => {
    // 2026-10-29 14:30:00 Manila time (UTC+8) is 2026-10-29 06:30:00 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T06:30:00Z"));

    try {
      const line = createMockLine({
        booking_date: "2026-10-29",
        start_time: "16:00:00",
        end_time: "17:00:00",
        status: "confirmed",
        checked_in_at: null,
        arrived_at: null,
        session_started_at: null,
        session_completed_at: null,
      });
      const group = createMockGroup([line], {}, { startTime: "16:00:00", endTime: "17:00:00" });
      expect(isOperationalBookingGroup(group, { businessDate: "2026-10-29" })).toBe(true);
      expect(isOperationalBookingGroup(group)).toBe(true);
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

  it("23. keeps completed service with missing legacy price visible for review rather than silently dropping it", () => {
    const line = createMockLine({
      status: "completed",
      booking_progress_status: "completed",
      session_completed_at: "2026-10-29T11:00:00Z",
      payment_status: "unpaid",
      metadata: {}, // Missing price_paid
    });
    const group = createMockGroup([line], { total: null, paid: 0, due: null, status: "unpaid" });
    expect(isOperationalBookingGroup(group, context)).toBe(true);
  });

  it("24. keeps completed service with missing legacy price visible for review even if status is paid (inconsistent balance evidence)", () => {
    const line = createMockLine({
      status: "completed",
      booking_progress_status: "completed",
      session_completed_at: "2026-10-29T11:00:00Z",
      payment_status: "paid",
      metadata: {}, // Missing price_paid
    });
    const group = createMockGroup([line], { total: null, paid: 0, due: null, status: "paid" });
    expect(isOperationalBookingGroup(group, context)).toBe(true);
  });

  it("25. hides completed service with legitimate zero-price when authoritative settlement is paid", () => {
    const line = createMockLine({
      status: "completed",
      booking_progress_status: "completed",
      session_completed_at: "2026-10-29T11:00:00Z",
      payment_status: "paid",
      metadata: { price_paid: 0 },
    });
    const group = createMockGroup([line], { total: 0, paid: 0, due: 0, status: "paid" });
    expect(isOperationalBookingGroup(group, context)).toBe(false);
  });

  it("26. keeps completed service with zero derived balance visible when status is unpaid", () => {
    const line = createMockLine({
      status: "completed",
      booking_progress_status: "completed",
      session_completed_at: "2026-10-29T11:00:00Z",
      payment_status: "unpaid",
      metadata: { price_paid: 0 },
    });
    const group = createMockGroup([line], { total: 0, paid: 0, due: 0, status: "unpaid" });
    expect(isOperationalBookingGroup(group, context)).toBe(true);
  });

  it("27. hides completed service when fully paid with verified non-zero balance", () => {
    const line = createMockLine({
      status: "completed",
      booking_progress_status: "completed",
      session_completed_at: "2026-10-29T11:00:00Z",
      payment_status: "paid",
      metadata: { price_paid: 1200 },
    });
    const group = createMockGroup([line], { total: 1200, paid: 1200, due: 0, status: "paid" });
    expect(isOperationalBookingGroup(group, context)).toBe(false);
  });

  it("28. keeps completed service visible when payment is partial", () => {
    const line = createMockLine({
      status: "completed",
      booking_progress_status: "completed",
      session_completed_at: "2026-10-29T11:00:00Z",
      payment_status: "partial",
      metadata: { price_paid: 1200 },
    });
    const group = createMockGroup([line], { total: 1200, paid: 500, due: 700, status: "partial" });
    expect(isOperationalBookingGroup(group, context)).toBe(true);
  });

  it("29. keeps completed service visible when payment status is paid but remaining due balance is positive", () => {
    const line = createMockLine({
      status: "completed",
      booking_progress_status: "completed",
      session_completed_at: "2026-10-29T11:00:00Z",
      payment_status: "paid",
      metadata: { price_paid: 1200 },
    });
    const group = createMockGroup([line], { total: 1200, paid: 600, due: 600, status: "paid" });
    expect(isOperationalBookingGroup(group, context)).toBe(true);
  });

  it("30. hides terminal no-show booking even with historical check-in and session start timestamps", () => {
    const line = createMockLine({
      status: "no_show",
      booking_progress_status: "no_show",
      checked_in_at: "2026-10-29T10:00:00Z",
      session_started_at: "2026-10-29T10:05:00Z",
    });
    const group = createMockGroup([line]);
    expect(isOperationalBookingGroup(group, context)).toBe(false);
  });

  it("31. hides terminal expired booking even with historical check-in timestamps", () => {
    const line = createMockLine({
      status: "expired",
      checked_in_at: "2026-10-29T10:00:00Z",
      arrived_at: "2026-10-29T10:00:00Z",
    });
    const group = createMockGroup([line]);
    expect(isOperationalBookingGroup(group, context)).toBe(false);
  });

  it("32. keeps mixed multi-guest order actionable when Guest 1 is closed no-show with old timestamps but Guest 2 is waiting", () => {
    const line1 = createMockLine({
      id: "line-1",
      status: "no_show",
      booking_progress_status: "no_show",
      checked_in_at: "2026-10-29T10:00:00Z",
      session_started_at: "2026-10-29T10:05:00Z",
    });
    const line2 = createMockLine({
      id: "line-2",
      status: "confirmed",
      booking_progress_status: "checked_in",
      checked_in_at: "2026-10-29T10:00:00Z",
    });
    const group = createMockGroup([line1, line2], { status: "unpaid", due: 1200 });
    expect(isOperationalBookingGroup(group, context)).toBe(true);
  });

  it("33. keeps mixed multi-guest order actionable when Guest 1 is closed expired and Guest 2 is completed with unpaid balance", () => {
    const line1 = createMockLine({
      id: "line-1",
      status: "expired",
      checked_in_at: "2026-10-29T09:00:00Z",
    });
    const line2 = createMockLine({
      id: "line-2",
      status: "completed",
      booking_progress_status: "completed",
      session_completed_at: "2026-10-29T11:00:00Z",
    });
    const group = createMockGroup([line1, line2], { status: "unpaid", due: 800, total: 800, paid: 0 });
    expect(isOperationalBookingGroup(group, context)).toBe(true);
  });

  it("34. hides mixed multi-guest order when Guest 1 is closed no-show and Guest 2 is completed & fully paid", () => {
    const line1 = createMockLine({
      id: "line-1",
      status: "no_show",
      booking_progress_status: "no_show",
      checked_in_at: "2026-10-29T10:00:00Z",
    });
    const line2 = createMockLine({
      id: "line-2",
      status: "completed",
      booking_progress_status: "completed",
      session_completed_at: "2026-10-29T11:00:00Z",
    });
    const group = createMockGroup([line1, line2], { status: "paid", due: 0, total: 1000, paid: 1000 });
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

    it("resolves no_show when status/progress is no_show regardless of earlier timestamps", () => {
      const line = createMockLine({
        status: "no_show",
        booking_progress_status: "no_show",
        checked_in_at: "2026-10-29T10:00:00Z",
        arrived_at: "2026-10-29T10:00:00Z",
        session_started_at: "2026-10-29T10:05:00Z",
        session_completed_at: "2026-10-29T11:00:00Z",
      });
      expect(resolveBookingLifecycleState(line)).toBe("no_show");
    });

    it("resolves expired when status is expired regardless of earlier timestamps", () => {
      const line = createMockLine({
        status: "expired",
        checked_in_at: "2026-10-29T10:00:00Z",
        arrived_at: "2026-10-29T10:00:00Z",
        session_started_at: "2026-10-29T10:05:00Z",
      });
      expect(resolveBookingLifecycleState(line)).toBe("expired");
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

  describe("isBookingLineClosed", () => {
    it("returns true for cancelled status or progress", () => {
      expect(isBookingLineClosed(createMockLine({ status: "cancelled" }))).toBe(true);
      expect(isBookingLineClosed(createMockLine({ booking_progress_status: "cancelled" }))).toBe(true);
    });

    it("returns true for no_show status or progress", () => {
      expect(isBookingLineClosed(createMockLine({ status: "no_show" }))).toBe(true);
      expect(isBookingLineClosed(createMockLine({ booking_progress_status: "no_show" }))).toBe(true);
    });

    it("returns true for expired status", () => {
      expect(isBookingLineClosed(createMockLine({ status: "expired" }))).toBe(true);
    });

    it("returns false for active or completed states", () => {
      expect(isBookingLineClosed(createMockLine({ status: "confirmed" }))).toBe(false);
      expect(isBookingLineClosed(createMockLine({ status: "in_progress" }))).toBe(false);
      expect(isBookingLineClosed(createMockLine({ status: "completed" }))).toBe(false);
    });
  });

  describe("Verified Payment Settlement Unit Rules", () => {
    it("getVerifiedBookingPrice returns null for missing or invalid price metadata", () => {
      expect(getVerifiedBookingPrice(null)).toBeNull();
      expect(getVerifiedBookingPrice(undefined)).toBeNull();
      expect(getVerifiedBookingPrice({})).toBeNull();
      expect(getVerifiedBookingPrice({ price_paid: null })).toBeNull();
      expect(getVerifiedBookingPrice({ price_paid: "invalid" })).toBeNull();
      expect(getVerifiedBookingPrice({ price_paid: -100 })).toBeNull();
    });

    it("getVerifiedBookingPrice returns parsed non-negative number for valid price_paid or price", () => {
      expect(getVerifiedBookingPrice({ price_paid: 0 })).toBe(0);
      expect(getVerifiedBookingPrice({ price_paid: 1200 })).toBe(1200);
      expect(getVerifiedBookingPrice({ price_paid: "1500" })).toBe(1500);
      expect(getVerifiedBookingPrice({ price: 800 })).toBe(800);
    });

    it("isPaymentFullySettled rejects unpaid, partial, or missing price data", () => {
      // Unpaid with zero derived due
      expect(isPaymentFullySettled({ total: 0, paid: 0, due: 0, status: "unpaid" })).toBe(false);
      // Missing price total
      expect(isPaymentFullySettled({ total: null, paid: 0, due: null, status: "paid" })).toBe(false);
      expect(isPaymentFullySettled({ total: null, paid: 0, due: null, status: "unpaid" })).toBe(false);
      // Partial payment
      expect(isPaymentFullySettled({ total: 1000, paid: 500, due: 500, status: "partial" })).toBe(false);
      // Status paid but positive due
      expect(isPaymentFullySettled({ total: 1000, paid: 500, due: 500, status: "paid" })).toBe(false);
    });

    it("isPaymentFullySettled accepts authoritative paid settlements including legitimate zero-price", () => {
      // Legitimate free service
      expect(isPaymentFullySettled({ total: 0, paid: 0, due: 0, status: "paid" })).toBe(true);
      // Normal fully settled service
      expect(isPaymentFullySettled({ total: 1200, paid: 1200, due: 0, status: "paid" })).toBe(true);
    });
  });

  describe("Order-Level Payment Authority Tests", () => {
    it("order with missing financial summary is NOT settled even if completed, and stays visible in operational queue for review", () => {
      const line = createMockLine({
        order_id: "order-missing-fin",
        order_total_amount: null,
        order_amount_paid: null,
        order_payment_status: null,
        status: "completed",
        booking_progress_status: "completed",
        session_completed_at: "2026-10-29T11:00:00Z",
      });
      const group = createMockGroup([line], { total: null, paid: null, due: null, status: null }, { orderId: "order-missing-fin" });
      expect(isPaymentFullySettled(group.payment)).toBe(false);
      expect(isOperationalBookingGroup(group, context)).toBe(true);
    });

    it("order with conflicting legacy Paid status is NOT settled when authoritative order evidence is missing or unpaid", () => {
      // Legacy line fields say 'paid' and 1200 paid, but order_payment_status is 'unpaid'
      const line = createMockLine({
        order_id: "order-conflicting-status",
        payment_status: "paid",
        amount_paid: 1200,
        metadata: { price_paid: 1200 },
        order_total_amount: 1200,
        order_amount_paid: 0,
        order_payment_status: "unpaid",
        status: "completed",
        booking_progress_status: "completed",
        session_completed_at: "2026-10-29T11:00:00Z",
      });
      const group = createMockGroup([line], { total: 1200, paid: 0, due: 1200, status: "unpaid" }, { orderId: "order-conflicting-status" });
      expect(isPaymentFullySettled(group.payment)).toBe(false);
      expect(isOperationalBookingGroup(group, context)).toBe(true);
    });

    it("order with incomplete order amount (partial) is NOT settled and stays visible in operational queue", () => {
      const line = createMockLine({
        order_id: "order-partial-amt",
        order_total_amount: 1500,
        order_amount_paid: 800,
        order_payment_status: "partial",
        status: "completed",
        booking_progress_status: "completed",
        session_completed_at: "2026-10-29T11:00:00Z",
      });
      const group = createMockGroup([line], { total: 1500, paid: 800, due: 700, status: "partial" }, { orderId: "order-partial-amt" });
      expect(isPaymentFullySettled(group.payment)).toBe(false);
      expect(isOperationalBookingGroup(group, context)).toBe(true);
    });

    it("normal paid order with authoritative payment evidence is settled and hides when completed", () => {
      const line = createMockLine({
        order_id: "order-normal-paid",
        order_total_amount: 1500,
        order_amount_paid: 1500,
        order_payment_status: "paid",
        status: "completed",
        booking_progress_status: "completed",
        session_completed_at: "2026-10-29T11:00:00Z",
      });
      const group = createMockGroup([line], { total: 1500, paid: 1500, due: 0, status: "paid" }, { orderId: "order-normal-paid" });
      expect(isPaymentFullySettled(group.payment)).toBe(true);
      expect(isOperationalBookingGroup(group, context)).toBe(false);
    });

    it("normal unpaid order with authoritative payment evidence is NOT settled and stays visible for cashier collection", () => {
      const line = createMockLine({
        order_id: "order-normal-unpaid",
        order_total_amount: 1500,
        order_amount_paid: 0,
        order_payment_status: "unpaid",
        status: "completed",
        booking_progress_status: "completed",
        session_completed_at: "2026-10-29T11:00:00Z",
      });
      const group = createMockGroup([line], { total: 1500, paid: 0, due: 1500, status: "unpaid" }, { orderId: "order-normal-unpaid" });
      expect(isPaymentFullySettled(group.payment)).toBe(false);
      expect(isOperationalBookingGroup(group, context)).toBe(true);
    });

    it("groupCrmBookings enforces order financial authority when order_id is present and ignores legacy line fields", () => {
      const orderBooking = createMockLine({
        id: "b-order-1",
        order_id: "order-auth-check",
        payment_status: "paid",
        amount_paid: 2000,
        metadata: { price_paid: 2000 },
        order_total_amount: 2000,
        order_amount_paid: 500,
        order_payment_status: "partial",
      });
      const groups = groupCrmBookings([orderBooking]);
      expect(groups[0]?.payment).toEqual({
        total: 2000,
        paid: 500,
        due: 1500,
        status: "partial",
      });
    });

    it("groupCrmBookings preserves legacy booking behavior when order_id is absent", () => {
      const legacyBooking = createMockLine({
        id: "b-legacy-1",
        order_id: null,
        payment_status: "paid",
        amount_paid: 800,
        metadata: { price_paid: 800 },
        order_total_amount: null,
        order_amount_paid: null,
        order_payment_status: null,
      });
      const groups = groupCrmBookings([legacyBooking]);
      expect(groups[0]?.payment).toEqual({
        total: 800,
        paid: 800,
        due: 0,
        status: "paid",
      });
    });

    describe("getBookingPaymentDisplayState", () => {
      it("resolves to Payment Review when order_id exists but financial summary is missing", () => {
        const line = createMockLine({
          order_id: "order-missing",
          order_total_amount: null,
          order_amount_paid: null,
          order_payment_status: null,
        });
        const payment = { total: null, paid: null, due: null, status: null };
        const display = getBookingPaymentDisplayState(payment, line);
        expect(display).toEqual({
          status: "payment_review",
          label: "Payment Review",
          isPaid: false,
          isPartial: false,
          isUnpaid: false,
          isPaymentReview: true,
        });
      });

      it("resolves to Payment Review when legacy line says Paid but order_payment_status is unpaid", () => {
        const line = createMockLine({
          order_id: "order-conflict",
          payment_status: "paid",
          amount_paid: 1200,
          metadata: { price_paid: 1200 },
          order_total_amount: 1200,
          order_amount_paid: 0,
          order_payment_status: "unpaid",
        });
        const payment = { total: 1200, paid: 0, due: 1200, status: "unpaid" };
        const display = getBookingPaymentDisplayState(payment, line);
        expect(display).toEqual({
          status: "payment_review",
          label: "Payment Review",
          isPaid: false,
          isPartial: false,
          isUnpaid: false,
          isPaymentReview: true,
        });
      });

      it("resolves to Unpaid when normal order has verified unpaid evidence", () => {
        const line = createMockLine({
          order_id: "order-unpaid",
          payment_status: "unpaid",
          amount_paid: 0,
          order_total_amount: 1500,
          order_amount_paid: 0,
          order_payment_status: "unpaid",
        });
        const payment = { total: 1500, paid: 0, due: 1500, status: "unpaid" };
        const display = getBookingPaymentDisplayState(payment, line);
        expect(display).toEqual({
          status: "unpaid",
          label: "Unpaid",
          isPaid: false,
          isPartial: false,
          isUnpaid: true,
          isPaymentReview: false,
        });
      });

      it("resolves to Unpaid for actual production unpaid order containing positive metadata.price_paid snapshot", () => {
        const line = createMockLine({
          id: "booking-prod-unpaid-1",
          order_id: "ORD-PROD-UNPAID-1",
          status: "confirmed",
          booking_progress_status: "confirmed",
          payment_status: "unpaid",
          amount_paid: 0,
          order_total_amount: 1200,
          order_amount_paid: 0,
          order_payment_status: "unpaid",
          metadata: {
            price_paid: 1200, // positive price snapshot, NOT proof of payment
            duration_minutes: 60,
          },
        });
        const payment = { total: 1200, paid: 0, due: 1200, status: "unpaid" };
        const display = getBookingPaymentDisplayState(payment, line);
        expect(display).toEqual({
          status: "unpaid",
          label: "Unpaid",
          isPaid: false,
          isPartial: false,
          isUnpaid: true,
          isPaymentReview: false,
        });
      });

      it("resolves to Partial when normal order has verified partial evidence", () => {
        const line = createMockLine({
          order_id: "order-partial",
          payment_status: "partial",
          amount_paid: 800,
          order_total_amount: 1500,
          order_amount_paid: 800,
          order_payment_status: "partial",
        });
        const payment = { total: 1500, paid: 800, due: 700, status: "partial" };
        const display = getBookingPaymentDisplayState(payment, line);
        expect(display).toEqual({
          status: "partial",
          label: "Partial",
          isPaid: false,
          isPartial: true,
          isUnpaid: false,
          isPaymentReview: false,
        });
      });

      it("resolves to Paid when normal order has verified settled evidence", () => {
        const line = createMockLine({
          order_id: "order-paid",
          payment_status: "paid",
          amount_paid: 1500,
          order_total_amount: 1500,
          order_amount_paid: 1500,
          order_payment_status: "paid",
        });
        const payment = { total: 1500, paid: 1500, due: 0, status: "paid" };
        const display = getBookingPaymentDisplayState(payment, line);
        expect(display).toEqual({
          status: "paid",
          label: "Paid",
          isPaid: true,
          isPartial: false,
          isUnpaid: false,
          isPaymentReview: false,
        });
      });

      it("resolves legacy standalone booking with missing price and ambiguous status to Payment Review", () => {
        const line = createMockLine({
          id: "b-legacy-missing",
          order_id: null,
          payment_status: "unknown",
          metadata: {},
        });
        const payment = { total: null, paid: 0, due: null, status: null };
        const display = getBookingPaymentDisplayState(payment, line);
        expect(display.isPaymentReview).toBe(true);
        expect(display.label).toBe("Payment Review");
      });
    });
  });
});

