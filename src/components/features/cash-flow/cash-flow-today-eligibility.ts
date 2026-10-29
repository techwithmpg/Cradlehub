import type { PayableOrderOption } from "@/lib/cash-flow/cash-flow-types";

/**
 * Strict eligibility for the "Completed — awaiting collection" KPI card.
 * Counts ONLY booking orders where services have completed and payment remains outstanding.
 * An in-progress booking may appear in the wider payment list without increasing this KPI.
 */
export function isCompletedAndPayable(order: PayableOrderOption): boolean {
  return (
    order.sourceKind === "booking_order" &&
    order.paymentEligible !== false &&
    order.readyForCheckout === true &&
    Number.isFinite(order.remainingBalance) &&
    order.remainingBalance > 0
  );
}

/**
 * Authoritative payment eligibility shared between Cash Flow Today and the Record Payment modal.
 * Every legitimately payable order with an outstanding balance is eligible for collection:
 * - Completed unpaid orders
 * - In-progress orders with outstanding balances (e.g. Home Service, walk-ins, advance checkout)
 * - Partially paid orders
 * - Multi-guest booking orders
 * - Legacy bookings subject to payment authorization
 * Excludes cancelled, expired, closed, or fully paid orders.
 */
export function isQuickPaymentEligible(order: PayableOrderOption): boolean {
  return (
    Number.isFinite(order.remainingBalance) &&
    order.remainingBalance > 0 &&
    (order.sourceKind !== "booking_order" || order.paymentEligible !== false)
  );
}

export type BookingPaymentOperationalStatus = "ready_to_pay" | "in_progress" | "partially_paid";

/**
 * Derives the operational status for an eligible payable order:
 * - Partially Paid: Order has a positive amount paid and an outstanding balance.
 * - Ready to Pay: Service is completed (ready for checkout) with zero amount paid.
 * - In Progress: Service is currently ongoing / not yet marked completed.
 */
export function getBookingPaymentOperationalStatus(order: PayableOrderOption): {
  status: BookingPaymentOperationalStatus;
  label: "Ready to Pay" | "In Progress" | "Partially Paid";
} {
  if (order.amountPaid > 0) {
    return { status: "partially_paid", label: "Partially Paid" };
  }
  if (order.readyForCheckout) {
    return { status: "ready_to_pay", label: "Ready to Pay" };
  }
  return { status: "in_progress", label: "In Progress" };
}
