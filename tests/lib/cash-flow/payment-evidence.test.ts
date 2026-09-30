import { describe, expect, it } from 'vitest';
import { findUnmatchedBookingPayments, isCashFlowReceiptTransactionType, type CanonicalPaymentSource } from '@/lib/cash-flow/payment-evidence';

const branchId = 'branch-a';

function payment(sourceType: 'booking_order' | 'legacy_booking', sourceId: string, amounts: number[], branch = branchId): CanonicalPaymentSource {
  return {
    branch_id: branch,
    source_type: sourceType,
    source_id: sourceId,
    status: 'posted',
    transaction_type: 'customer_payment',
    financial_account_movements: amounts.map((amount) => ({ amount })),
  };
}

describe('Cash Flow booking payment evidence', () => {
  it('counts actual customer and other income receipts without transfers, adjustments, or staff tips', () => {
    expect(['customer_payment', 'customer_deposit', 'other_income', 'retail_sale', 'voucher_sale']
      .every(isCashFlowReceiptTransactionType)).toBe(true);
    expect(['cash_adjustment', 'tip_collection', 'tip_disbursement', 'operational_expense']
      .some(isCashFlowReceiptTransactionType)).toBe(false);
  });
  it('keeps a canonical payment and an unmatched legacy booking distinct', () => {
    const gaps = findUnmatchedBookingPayments(branchId, [
      { id: 'booking-a', order_id: null, amount_paid: 500, payment_method: 'cash' },
      { id: 'booking-b', order_id: null, amount_paid: 300, payment_method: 'gcash' },
    ], [payment('legacy_booking', 'booking-a', [500])]);

    expect(gaps).toEqual([{
      reason: 'unmatched_amount',
      sourceType: 'legacy_booking', sourceId: 'booking-b', bookingIds: ['booking-b'],
      snapshotAmount: 300, canonicalAmount: 0, unmatchedAmount: 300,
    }]);
  });

  it('does not double count a fully backed booking or a split tender', () => {
    const gaps = findUnmatchedBookingPayments(branchId, [
      { id: 'booking-a', order_id: 'order-a', amount_paid: 1000, payment_method: 'cash' },
    ], [payment('booking_order', 'order-a', [600, 400])]);
    expect(gaps).toEqual([]);
  });

  it('flags only the unbacked part of a second partial payment', () => {
    const booking = { id: 'booking-a', order_id: null, amount_paid: 1000, payment_method: 'cash' };
    const first = findUnmatchedBookingPayments(branchId, [booking], [payment('legacy_booking', 'booking-a', [500])]);
    expect(first[0]?.unmatchedAmount).toBe(500);

    const second = findUnmatchedBookingPayments(branchId, [booking], [
      payment('legacy_booking', 'booking-a', [500]),
      payment('legacy_booking', 'booking-a', [500]),
    ]);
    expect(second).toEqual([]);
  });

  it('groups an order snapshot gap without assigning unallocated money to a booking line', () => {
    const gaps = findUnmatchedBookingPayments(branchId, [
      { id: 'booking-a', order_id: 'order-a', amount_paid: 500, payment_method: 'cash' },
      { id: 'booking-b', order_id: 'order-a', amount_paid: 500, payment_method: 'gcash' },
    ], [payment('booking_order', 'order-a', [500])]);

    expect(gaps).toEqual([{
      reason: 'unmatched_amount',
      sourceType: 'booking_order', sourceId: 'order-a', bookingIds: ['booking-a', 'booking-b'],
      snapshotAmount: 1000, canonicalAmount: 500, unmatchedAmount: 500,
    }]);
  });

  it('flags an aggregate match in a multi-booking order when booking-level allocation is unknown', () => {
    const gaps = findUnmatchedBookingPayments(branchId, [
      { id: 'booking-a', order_id: 'order-a', amount_paid: 0, payment_method: 'pay_on_site' },
      { id: 'booking-b', order_id: 'order-a', amount_paid: 500, payment_method: 'cash' },
    ], [payment('booking_order', 'order-a', [500])]);

    expect(gaps).toEqual([{
      reason: 'ambiguous_order', sourceType: 'booking_order', sourceId: 'order-a',
      bookingIds: ['booking-b'], snapshotAmount: 500, canonicalAmount: 500, unmatchedAmount: 0,
    }]);
  });

  it('does not treat unpaid completion or pay-on-site intent as collection', () => {
    const gaps = findUnmatchedBookingPayments(branchId, [
      { id: 'completed-unpaid', order_id: null, amount_paid: 0, payment_method: 'cash' },
      { id: 'pay-on-site', order_id: null, amount_paid: 0, payment_method: 'pay_on_site' },
    ], []);
    expect(gaps).toEqual([]);
  });

  it('ignores other-branch, unposted, and non-payment transactions when matching a booking', () => {
    const gaps = findUnmatchedBookingPayments(branchId, [
      { id: 'booking-a', order_id: null, amount_paid: 400, payment_method: 'cash' },
    ], [
      payment('legacy_booking', 'booking-a', [400], 'branch-b'),
      { ...payment('legacy_booking', 'booking-a', [400]), status: 'voided' },
      { ...payment('legacy_booking', 'booking-a', [400]), transaction_type: 'cash_adjustment' },
    ]);
    expect(gaps[0]?.unmatchedAmount).toBe(400);
  });

  it('does not turn a negative refund movement into a receipt', () => {
    const gaps = findUnmatchedBookingPayments(branchId, [
      { id: 'booking-a', order_id: null, amount_paid: 300, payment_method: 'cash' },
    ], [{ ...payment('legacy_booking', 'booking-a', [-200]), transaction_type: 'customer_refund' }]);
    expect(gaps[0]?.canonicalAmount).toBe(0);
    expect(gaps[0]?.unmatchedAmount).toBe(300);
  });
});
