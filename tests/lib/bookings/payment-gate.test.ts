import { describe, expect, it } from "vitest";
import { getBookingPaymentGate } from "@/lib/bookings/payment-gate";

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
