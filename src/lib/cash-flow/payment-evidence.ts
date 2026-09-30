export interface BookingPaymentSnapshot {
  id: string;
  order_id: string | null;
  amount_paid: number | null;
  payment_method: string | null;
}

export interface CanonicalPaymentSource {
  branch_id: string;
  source_type: string | null;
  source_id: string | null;
  status: string;
  transaction_type: string;
  financial_account_movements?: Array<{ amount: number | string }>;
}

export interface UnmatchedBookingPayment {
  reason: 'unmatched_amount' | 'ambiguous_order';
  sourceType: 'booking_order' | 'legacy_booking';
  sourceId: string;
  bookingIds: string[];
  snapshotAmount: number;
  canonicalAmount: number;
  unmatchedAmount: number;
}

/** Cash Flow receipts exclude transfers, drawer adjustments, and staff tips. */
export function isCashFlowReceiptTransactionType(type: string): boolean {
  return type === 'customer_payment' || type === 'customer_deposit'
    || type === 'other_income' || type === 'voucher_sale' || type === 'retail_sale';
}

/** Booking amounts are compatibility snapshots; only signed movements are receipts. */
export function findUnmatchedBookingPayments(
  branchId: string,
  bookings: BookingPaymentSnapshot[],
  transactions: CanonicalPaymentSource[]
): UnmatchedBookingPayment[] {
  const snapshots = new Map<string, { sourceType: UnmatchedBookingPayment['sourceType']; sourceId: string; bookingIds: string[]; amount: number }>();
  const orderBookingCounts = new Map<string, number>();

  for (const booking of bookings) {
    if (booking.order_id) {
      orderBookingCounts.set(booking.order_id, (orderBookingCounts.get(booking.order_id) || 0) + 1);
    }
    const paid = Number(booking.amount_paid) || 0;
    if (paid <= 0) continue;
    const sourceType = booking.order_id ? 'booking_order' : 'legacy_booking';
    const sourceId = booking.order_id || booking.id;
    const key = `${sourceType}:${sourceId}`;
    const entry = snapshots.get(key) || { sourceType, sourceId, bookingIds: [], amount: 0 };
    entry.bookingIds.push(booking.id);
    entry.amount += paid;
    snapshots.set(key, entry);
  }

  const canonicalBySource = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.branch_id !== branchId || transaction.status !== 'posted') continue;
    if (transaction.transaction_type !== 'customer_payment' && transaction.transaction_type !== 'customer_deposit') continue;
    if (transaction.source_type !== 'booking_order' && transaction.source_type !== 'legacy_booking') continue;
    if (!transaction.source_id) continue;
    const key = `${transaction.source_type}:${transaction.source_id}`;
    const inflow = (transaction.financial_account_movements || []).reduce(
      (sum, movement) => sum + Math.max(0, Number(movement.amount) || 0),
      0
    );
    canonicalBySource.set(key, (canonicalBySource.get(key) || 0) + inflow);
  }

  return Array.from(snapshots.entries()).flatMap(([key, entry]) => {
    const canonicalAmount = canonicalBySource.get(key) || 0;
    const unmatchedAmount = Math.max(0, entry.amount - canonicalAmount);
    const ambiguousOrder = entry.sourceType === 'booking_order'
      && (orderBookingCounts.get(entry.sourceId) || 0) > 1
      && canonicalAmount > 0;
    return unmatchedAmount > 0 || ambiguousOrder
      ? [{
          reason: unmatchedAmount > 0 ? 'unmatched_amount' as const : 'ambiguous_order' as const,
          sourceType: entry.sourceType,
          sourceId: entry.sourceId,
          bookingIds: entry.bookingIds,
          snapshotAmount: entry.amount,
          canonicalAmount,
          unmatchedAmount,
        }]
      : [];
  });
}
