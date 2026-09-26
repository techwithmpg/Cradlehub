import { describe, expect, it } from "vitest";
import {
  getBookingPaymentGate,
  isBookingPaymentSufficientForPaid,
  readBookingPayableFromMetadata,
  validateBookingPaymentStatusTransition,
} from "@/lib/bookings/payment-gate";

const base = {
  bookingStatus: "confirmed",
  bookingProgressStatus: "not_started",
  sessionCompletedAt: null,
  previousAmountPaid: 0,
  nextAmountPaid: 850,
  nextPaymentStatus: "paid",
};

describe("booking payment gate", () => {
  it("blocks final settlement before the service is complete", () => {
    const result = getBookingPaymentGate({
      ...base,
      paymentPurpose: "final_settlement",
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.error).toContain("after service completion");
  });

  it("allows authorized pre-service advances with a reason", () => {
    expect(
      getBookingPaymentGate({
        ...base,
        paymentPurpose: "advance",
        reason: "Customer requested a fully prepaid gift visit.",
      })
    ).toEqual({ allowed: true });
  });

  it("requires an audit reason for pre-service partials", () => {
    const result = getBookingPaymentGate({
      ...base,
      nextAmountPaid: 200,
      nextPaymentStatus: "pending",
      paymentPurpose: "partial",
    });
    expect(result.allowed).toBe(false);
  });

  it("allows settlement after the service is completed", () => {
    expect(
      getBookingPaymentGate({
        ...base,
        bookingStatus: "completed",
        bookingProgressStatus: "completed",
        paymentPurpose: "final_settlement",
      })
    ).toEqual({ allowed: true });
  });
});

describe("readBookingPayableFromMetadata", () => {
  it("frozen booking snapshot = ₱1,000 → payable remains ₱1,000 regardless of external prices", () => {
    expect(readBookingPayableFromMetadata({ price_paid: 1000 })).toBe(1000);
  });

  it("frozen booking snapshot = ₱800 → payable remains ₱800 regardless of external prices", () => {
    expect(readBookingPayableFromMetadata({ price_paid: 800 })).toBe(800);
  });

  it("recovers frozen payable from historical pricing_breakdown if price_paid is omitted", () => {
    expect(
      readBookingPayableFromMetadata({
        pricing_breakdown: { total: 1450, service_line_price: 1200 },
      })
    ).toBe(1450);
  });

  it("recovers frozen payable from alternate snapshot key metadata.price", () => {
    expect(readBookingPayableFromMetadata({ price: 950 })).toBe(950);
  });

  it("explicit frozen payable = ₱0 returns 0 for complimentary/zero-price bookings", () => {
    expect(readBookingPayableFromMetadata({ price_paid: 0 })).toBe(0);
    expect(readBookingPayableFromMetadata({ price_paid: "0" })).toBe(0);
  });

  it("missing frozen payable snapshot returns null (does NOT assume zero or infer catalog price)", () => {
    expect(readBookingPayableFromMetadata(null)).toBeNull();
    expect(readBookingPayableFromMetadata(undefined)).toBeNull();
    expect(readBookingPayableFromMetadata({})).toBeNull();
    expect(readBookingPayableFromMetadata({ some_other_key: 123 })).toBeNull();
  });

  it("clamps negative snapshot values to 0", () => {
    expect(readBookingPayableFromMetadata({ price_paid: -100 })).toBe(0);
  });
});

describe("isBookingPaymentSufficientForPaid", () => {
  it("missing frozen payable snapshot is NEVER sufficient for paid", () => {
    expect(isBookingPaymentSufficientForPaid(null, 1500)).toBe(false);
    expect(isBookingPaymentSufficientForPaid(undefined, 1500)).toBe(false);
  });

  it("positive payable + zero amount paid is NOT sufficient", () => {
    expect(isBookingPaymentSufficientForPaid(1000, 0)).toBe(false);
  });

  it("positive payable + short amount paid is NOT sufficient", () => {
    expect(isBookingPaymentSufficientForPaid(1000, 400)).toBe(false);
  });

  it("positive payable + sufficient amount paid IS sufficient", () => {
    expect(isBookingPaymentSufficientForPaid(1000, 1000)).toBe(true);
    expect(isBookingPaymentSufficientForPaid(1000, 1200)).toBe(true);
  });

  it("explicit zero payable booking is always sufficient for paid", () => {
    expect(isBookingPaymentSufficientForPaid(0, 0)).toBe(true);
    expect(isBookingPaymentSufficientForPaid(0, 50)).toBe(true);
  });
});

describe("validateBookingPaymentStatusTransition", () => {
  it("blocks target status paid when historical payable snapshot is missing", () => {
    const res = validateBookingPaymentStatusTransition({
      payableAmount: null,
      amountPaid: 1500,
      targetPaymentStatus: "paid",
    });
    expect(res.allowed).toBe(false);
    if (!res.allowed) {
      expect(res.error).toContain("historical payable price snapshot is missing");
      expect(res.error).toContain("Authorized review required");
    }
  });

  it("blocks target status paid when cumulative amount is short", () => {
    const res = validateBookingPaymentStatusTransition({
      payableAmount: 1500,
      amountPaid: 500,
      targetPaymentStatus: "paid",
    });
    expect(res.allowed).toBe(false);
    if (!res.allowed) {
      expect(res.error).toContain("less than payable amount");
    }
  });

  it("allows target status paid when cumulative amount equals or exceeds payable", () => {
    expect(
      validateBookingPaymentStatusTransition({
        payableAmount: 1500,
        amountPaid: 1500,
        targetPaymentStatus: "paid",
      })
    ).toEqual({ allowed: true });
  });

  it("allows target status pending for partial / deposit payment with known payable", () => {
    expect(
      validateBookingPaymentStatusTransition({
        payableAmount: 1500,
        amountPaid: 500,
        targetPaymentStatus: "pending",
      })
    ).toEqual({ allowed: true });
  });

  it("allows explicit zero payable booking to transition to paid with 0 amount", () => {
    expect(
      validateBookingPaymentStatusTransition({
        payableAmount: 0,
        amountPaid: 0,
        targetPaymentStatus: "paid",
      })
    ).toEqual({ allowed: true });
  });
});
