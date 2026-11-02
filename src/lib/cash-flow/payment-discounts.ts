/** Display choices only. These rates are not authority to change an order or receipt. */
export const PAYMENT_DISCOUNTS = {
  senior: { label: "Senior −20%", description: "Senior Citizen — 20%" },
  pwd: { label: "PWD −20%", description: "PWD — 20%" },
  vip: { label: "VIP −10%", description: "VIP — 10%" },
} as const;

export type PaymentDiscountType = keyof typeof PAYMENT_DISCOUNTS;
export const PAYMENT_DISCOUNT_KEYS = Object.keys(PAYMENT_DISCOUNTS) as PaymentDiscountType[];

// The current post_order_payment_atomic contract accepts tenders/allocations, not
// a verified discount command. Enable only after its replacement is reviewed and tested.
export const DISCOUNT_POSTING_AVAILABLE = false;

export function getSuggestedCustomerDiscount(loyaltyTier?: string | null): "vip" | null {
  return loyaltyTier === "vip" ? "vip" : null;
}
