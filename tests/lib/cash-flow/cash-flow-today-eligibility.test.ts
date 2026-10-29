import { describe, expect, it } from "vitest";
import type { PayableOrderOption } from "../../../src/lib/cash-flow/cash-flow-types";
import {
  isCompletedAndPayable,
  isQuickPaymentEligible,
  getBookingPaymentOperationalStatus,
} from "../../../src/components/features/cash-flow/cash-flow-today-eligibility";

const order = (overrides: Partial<PayableOrderOption> = {}): PayableOrderOption => ({
  id: "order-1",
  sourceKind: "booking_order",
  paymentEligible: true,
  orderNumber: "ORD-1",
  customerName: "Sample customer",
  serviceDescription: "Massage",
  totalAmount: 600,
  amountPaid: 0,
  remainingBalance: 600,
  bookingDate: "2026-10-26",
  bookingStatus: "Active",
  readyForCheckout: true,
  ...overrides,
});

describe("Cash Flow Today rapid-collection eligibility (Completed-only KPI)", () => {
  it("includes completed, outstanding, eligible booking orders", () => {
    expect(isCompletedAndPayable(order())).toBe(true);
  });

  it("includes partially paid completed orders with an outstanding balance", () => {
    expect(isCompletedAndPayable(order({ amountPaid: 300, remainingBalance: 300 }))).toBe(true);
  });

  it("uses the query mapper's checkout flag rather than its display status", () => {
    expect(isCompletedAndPayable(order({ bookingStatus: "Mixed services" }))).toBe(true);
    expect(
      isCompletedAndPayable(order({ bookingStatus: "completed", readyForCheckout: false }))
    ).toBe(false);
    expect(isCompletedAndPayable(order({ readyForCheckout: undefined }))).toBe(false);
  });

  it("excludes paid or explicitly ineligible booking orders", () => {
    expect(isCompletedAndPayable(order({ remainingBalance: 0 }))).toBe(false);
    expect(isCompletedAndPayable(order({ paymentEligible: false }))).toBe(false);
  });

  it("keeps legacy bookings out of the completed-only KPI", () => {
    expect(isCompletedAndPayable(order({ sourceKind: "legacy_booking" }))).toBe(false);
  });
});

describe("Authoritative Quick Payment Eligibility (Modal & Today List Parity)", () => {
  const dawnNavarroHomeService: PayableOrderOption = {
    id: "order-c5cc08fd",
    sourceKind: "booking_order",
    orderNumber: "ORDER-c5cc08fd",
    customerName: "DAWN NAVARRO",
    customerPhone: "09171234567",
    serviceDescription: "Post Natal Massage",
    totalAmount: 1086,
    amountPaid: 0,
    remainingBalance: 1086,
    bookingDate: "2026-10-30",
    serviceTime: "3:00 PM",
    visitType: "home_service",
    bookingStatus: "in_progress",
    paymentEligible: true,
    readyForCheckout: false, // in-progress service
  };

  it("includes in-progress home service orders with outstanding balance in quick payment", () => {
    expect(isQuickPaymentEligible(dawnNavarroHomeService)).toBe(true);
    // But strictly excludes from the completed-only KPI:
    expect(isCompletedAndPayable(dawnNavarroHomeService)).toBe(false);
  });

  it("includes partially paid orders with remaining balance", () => {
    const partialOrder = order({
      readyForCheckout: false,
      amountPaid: 400,
      remainingBalance: 200,
    });
    expect(isQuickPaymentEligible(partialOrder)).toBe(true);
  });

  it("includes completed unpaid orders", () => {
    expect(isQuickPaymentEligible(order({ readyForCheckout: true }))).toBe(true);
  });

  it("includes eligible legacy bookings with outstanding balances", () => {
    const legacy = order({
      sourceKind: "legacy_booking",
      paymentEligible: undefined,
      remainingBalance: 500,
    });
    expect(isQuickPaymentEligible(legacy)).toBe(true);
  });

  it("excludes fully paid orders", () => {
    expect(isQuickPaymentEligible(order({ remainingBalance: 0 }))).toBe(false);
    expect(isQuickPaymentEligible(order({ remainingBalance: -50 }))).toBe(false);
  });

  it("excludes explicitly ineligible booking orders", () => {
    expect(isQuickPaymentEligible(order({ paymentEligible: false }))).toBe(false);
  });
});

describe("Booking Operational Status Derivation", () => {
  it("derives Partially Paid when amountPaid > 0", () => {
    const res = getBookingPaymentOperationalStatus(
      order({ amountPaid: 300, remainingBalance: 300, readyForCheckout: false })
    );
    expect(res).toEqual({ status: "partially_paid", label: "Partially Paid" });
  });

  it("derives Ready to Pay when readyForCheckout is true and amountPaid is 0", () => {
    const res = getBookingPaymentOperationalStatus(
      order({ amountPaid: 0, remainingBalance: 600, readyForCheckout: true })
    );
    expect(res).toEqual({ status: "ready_to_pay", label: "Ready to Pay" });
  });

  it("derives In Progress when service is ongoing (readyForCheckout is false and amountPaid is 0)", () => {
    const res = getBookingPaymentOperationalStatus(
      order({ amountPaid: 0, remainingBalance: 1086, readyForCheckout: false })
    );
    expect(res).toEqual({ status: "in_progress", label: "In Progress" });
  });
});
