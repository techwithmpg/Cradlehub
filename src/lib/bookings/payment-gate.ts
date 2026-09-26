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

export function readBookingPayableFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): number | null {
  if (metadata && typeof metadata === "object") {
    // 1. Primary canonical snapshot: metadata.price_paid
    const primary = metadata.price_paid;
    if (primary !== undefined && primary !== null) {
      const n = Number(primary);
      if (Number.isFinite(n)) return Math.max(0, n);
    }

    // 2. Historical pricing breakdown if recorded at booking creation
    const breakdown = metadata.pricing_breakdown;
    if (breakdown && typeof breakdown === "object") {
      const bTotal = (breakdown as Record<string, unknown>).total;
      if (bTotal !== undefined && bTotal !== null) {
        const n = Number(bTotal);
        if (Number.isFinite(n)) return Math.max(0, n);
      }
      const bLine = (breakdown as Record<string, unknown>).service_line_price;
      if (bLine !== undefined && bLine !== null) {
        const n = Number(bLine);
        if (Number.isFinite(n)) return Math.max(0, n);
      }
    }

    // 3. Alternate historical snapshot key: metadata.price
    const altPrice = metadata.price;
    if (altPrice !== undefined && altPrice !== null) {
      const n = Number(altPrice);
      if (Number.isFinite(n)) return Math.max(0, n);
    }
  }

  // No trustworthy frozen payable snapshot found — do NOT infer or fall back to catalog price
  return null;
}

export function isBookingPaymentSufficientForPaid(
  payableAmount: number | null | undefined,
  cumulativeAmountPaid: number
): boolean {
  if (payableAmount === null || payableAmount === undefined) return false;
  if (payableAmount <= 0) return true;
  return cumulativeAmountPaid >= payableAmount;
}

export function validateBookingPaymentStatusTransition(params: {
  payableAmount: number | null | undefined;
  amountPaid: number;
  targetPaymentStatus: string;
}): { allowed: true } | { allowed: false; error: string } {
  if (params.targetPaymentStatus === "paid") {
    if (params.payableAmount === null || params.payableAmount === undefined) {
      return {
        allowed: false,
        error:
          "Cannot mark booking as paid: historical payable price snapshot is missing from booking records. Authorized review required.",
      };
    }
    if (params.payableAmount > 0 && params.amountPaid < params.payableAmount) {
      return {
        allowed: false,
        error: `Cannot mark booking as paid: cumulative amount paid (₱${params.amountPaid}) is less than payable amount (₱${params.payableAmount}).`,
      };
    }
  }
  return { allowed: true };
}
