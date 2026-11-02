/** Display choices only. These rates are not authority to change an order or receipt. */
export const PAYMENT_DISCOUNTS = {
  senior: { label: "Senior −20%", description: "Senior Citizen — 20%" },
  pwd: { label: "PWD −20%", description: "PWD — 20%" },
  vip: { label: "VIP −10%", description: "VIP — 10%" },
} as const;

export type PaymentDiscountType = keyof typeof PAYMENT_DISCOUNTS;
export const PAYMENT_DISCOUNT_KEYS = Object.keys(PAYMENT_DISCOUNTS) as PaymentDiscountType[];

// Posting is controlled by the server-only CRADLEHUB_DISCOUNTS_ENABLED release gate.
// A successful authoritative quote is required; these labels never change money.

export function getSuggestedCustomerDiscount(loyaltyTier?: string | null): "vip" | null {
  return loyaltyTier === "vip" ? "vip" : null;
}
