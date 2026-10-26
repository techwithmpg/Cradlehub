import { describe, expect, it } from "vitest";
import type { PayableOrderOption } from "../../../src/lib/cash-flow/cash-flow-types";
import { isCompletedAndPayable } from "../../../src/components/features/cash-flow/cash-flow-today-eligibility";

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

describe("Cash Flow Today rapid-collection eligibility", () => {
  it("includes completed, outstanding, eligible booking orders", () => {
    expect(isCompletedAndPayable(order())).toBe(true);
  });

  it("includes partially paid completed orders with an outstanding balance", () => {
    expect(isCompletedAndPayable(order({ amountPaid: 300, remainingBalance: 300 }))).toBe(true);
  });

  it("uses the query mapper's checkout flag rather than its display status", () => {
    expect(isCompletedAndPayable(order({ bookingStatus: "Mixed services" }))).toBe(true);
    expect(isCompletedAndPayable(order({ bookingStatus: "completed", readyForCheckout: false }))).toBe(false);
    expect(isCompletedAndPayable(order({ readyForCheckout: undefined }))).toBe(false);
  });

  it("excludes paid or explicitly ineligible booking orders", () => {
    expect(isCompletedAndPayable(order({ remainingBalance: 0 }))).toBe(false);
    expect(isCompletedAndPayable(order({ paymentEligible: false }))).toBe(false);
  });

  it("keeps legacy bookings in the existing full payment flow", () => {
    expect(isCompletedAndPayable(order({ sourceKind: "legacy_booking" }))).toBe(false);
  });
});
