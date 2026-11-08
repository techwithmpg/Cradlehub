import { describe, expect, it } from "vitest";
import { isOrderReadyForPayment, type PaymentReadyLine } from "@/lib/bookings/service-completion-payment-ready";

const completed = (payment_status = "unpaid"): PaymentReadyLine => ({
  status: "completed",
  booking_progress_status: "completed",
  session_completed_at: "2026-11-08T07:00:00.000Z",
  payment_status,
});
const active: PaymentReadyLine = {
  status: "in_progress",
  booking_progress_status: "session_started",
  session_completed_at: null,
  payment_status: "unpaid",
};

describe("CRM payment-ready gate", () => {
  it("prompts for a completed unpaid service", () => expect(isOrderReadyForPayment([completed()])).toBe(true));
  it("does not prompt for a fully paid service", () => expect(isOrderReadyForPayment([completed("paid")])).toBe(false));
  it("does not prompt while another group member is still in service", () => expect(isOrderReadyForPayment([completed(), active])).toBe(false));
  it("prompts after all group services finish", () => expect(isOrderReadyForPayment([completed(), completed("paid")])).toBe(true));
  it("does not prompt with an empty or incomplete group", () => {
    expect(isOrderReadyForPayment([])).toBe(false);
    expect(isOrderReadyForPayment([active])).toBe(false);
  });
  it("allows a completed unpaid line when another line was cancelled", () => {
    expect(isOrderReadyForPayment([completed(), { ...active, status: "cancelled" }])).toBe(true);
  });
});
