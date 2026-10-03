import { isBookingClosedForCrm } from '@/lib/bookings/crm-booking-status';
import { validatedLegacyBookingPrice } from './legacy-booking-price';

export type OrderPaymentChild = {
  id: string;
  status: string | null;
  metadata: Record<string, unknown> | null;
};

export type OrderPaymentItem = {
  id: string;
  booking_id: string | null;
  amount: number;
  charge_type: string;
  source_type: string | null;
  source_id: string | null;
  sequence: number;
};

export type OrderPaymentEligibility = {
  eligible: boolean;
  total: number;
  paid: number;
  remaining: number;
  projectedWaivers: Array<{ bookingId: string; amount: number }>;
};

/** Mirrors the P1-A order-level waiver cap before the writer posts new money. */
export function deriveOrderPaymentEligibility(input: {
  children: OrderPaymentChild[];
  items: OrderPaymentItem[];
  totalPayable: number;
  netAllocated: number;
  quotedTotal: number | null;
  homeServiceFee: unknown;
}): OrderPaymentEligibility | null {
  if (input.children.length === 0) return null;
  const active = input.children.filter((child) => !isBookingClosedForCrm(child.status ?? ''));

  const paid = input.netAllocated;
  if (!Number.isFinite(paid) || paid < 0) return null;

  let total = input.totalPayable;
  const projectedWaivers: OrderPaymentEligibility['projectedWaivers'] = [];

  if (input.items.length === 0) {
    if (active.length === 0) {
      total = 0;
    } else if (active.length === input.children.length) {
      total = input.quotedTotal ?? 0;
    } else {
      // The writer materializes only active service snapshots plus the order fee.
      const prices = active.map((child) => validatedLegacyBookingPrice(child.metadata));
      if (prices.some((price) => price === null)) return null;
      const rawFee = input.homeServiceFee;
      const fee = rawFee === undefined || rawFee === null ? 0 : Number(rawFee);
      if (!Number.isFinite(fee) || fee < 0 || Number(fee.toFixed(2)) !== fee) return null;
      total = prices.reduce<number>((sum, price) => sum + price!, 0) + fee;
    }
  } else {
    let remaining = Math.max(0, total - paid);
    const closed = input.children
      .filter((child) => isBookingClosedForCrm(child.status ?? ''))
      .sort((a, b) => a.id.localeCompare(b.id));
    for (const child of closed) {
      const serviceItem = input.items
        .filter((item) => item.booking_id === child.id && item.charge_type === 'service' && item.amount > 0)
        .sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id))[0];
      if (!serviceItem) continue;
      const existingAdjustment = input.items
        .filter((item) => item.charge_type === 'manual_adjustment' &&
          item.source_type === 'closed_service_adjustment' && item.source_id === serviceItem.id)
        .reduce((sum, item) => sum + item.amount, 0);
      const waiver = Math.min(Math.max(serviceItem.amount + existingAdjustment, 0), remaining);
      if (waiver <= 0) continue;
      total -= waiver;
      remaining -= waiver;
      projectedWaivers.push({ bookingId: child.id, amount: waiver });
    }
  }

  if (!Number.isFinite(total) || total < 0) return null;
  const remaining = Math.max(0, Math.round((total - paid) * 100) / 100);
  return { eligible: active.length > 0 && remaining > 0, total, paid, remaining, projectedWaivers };
}
