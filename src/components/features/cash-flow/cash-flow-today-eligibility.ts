import type { PayableOrderOption } from "@/lib/cash-flow/cash-flow-types";

/**
 * Keep today's rapid-collection queue narrower than the general payment modal.
 * Completion must be known, the order must be eligible, and money must remain.
 * Legacy bookings remain accessible through the established Record Payment flow.
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
