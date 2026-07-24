export type BookingPaymentPurpose = "final_settlement" | "deposit" | "advance" | "partial";

type PaymentGateInput = {
  bookingStatus: string;
  bookingProgressStatus?: string | null;
  sessionCompletedAt?: string | null;
  previousAmountPaid: number;
  nextAmountPaid: number;
  nextPaymentStatus: string;
  paymentPurpose?: BookingPaymentPurpose | null;
  reason?: string | null;
};

export type PaymentGateResult = { allowed: true } | { allowed: false; error: string };

export function isBookingServiceComplete(input: {
  bookingStatus: string;
  bookingProgressStatus?: string | null;
  sessionCompletedAt?: string | null;
}): boolean {
  return (
    input.bookingStatus === "completed" ||
    input.bookingProgressStatus === "completed" ||
    Boolean(input.sessionCompletedAt)
  );
}

export function getBookingPaymentGate(input: PaymentGateInput): PaymentGateResult {
  const isCollecting =
    input.nextPaymentStatus === "paid" || input.nextAmountPaid > input.previousAmountPaid;
  if (!isCollecting || isBookingServiceComplete(input)) {
    return { allowed: true };
  }

  const exceptionPurpose =
    input.paymentPurpose === "deposit" ||
    input.paymentPurpose === "advance" ||
    input.paymentPurpose === "partial";
  if (!exceptionPurpose) {
    return {
      allowed: false,
      error:
        "Final payment is available after service completion. Record an authorized deposit, advance, or partial payment with a reason.",
    };
  }
  if (!input.reason?.trim()) {
    return {
      allowed: false,
      error: "A reason is required for a pre-service deposit, advance, or partial payment.",
    };
  }
  return { allowed: true };
}
