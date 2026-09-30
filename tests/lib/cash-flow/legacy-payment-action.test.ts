import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateBookingSurfaces: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/bookings/revalidate-booking-surfaces', () => ({
  revalidateOperationalBookingSurfaces: mocks.revalidateBookingSurfaces,
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));

import { recordLegacyBookingPaymentAction } from '@/lib/cash-flow/cash-flow-actions';
import type { LegacyBookingPaymentPayload } from '@/lib/cash-flow/cash-flow-actions';

const bookingId = '11111111-1111-4111-8111-111111111111';
const branchId = '22222222-2222-4222-8222-222222222222';
const cashAccountId = '33333333-3333-4333-8333-333333333333';
const gcashAccountId = '44444444-4444-4444-8444-444444444444';
const baseInput: LegacyBookingPaymentPayload = {
  bookingId,
  branchId,
  expectedAmountPaid: 0,
  idempotencyKey: 'cash-flow-legacy-1',
  payments: [{ amount: 900, paymentMethod: 'cash', financialAccountId: cashAccountId }],
  businessDate: '2026-09-29',
};

let booking: Record<string, unknown>;
let authenticated: boolean;

beforeEach(() => {
  vi.clearAllMocks();
  authenticated = true;
  booking = {
    id: bookingId,
    branch_id: branchId,
    order_id: null,
    amount_paid: 0,
    payment_status: 'pending',
    status: 'pending_payment',
    metadata: { price_paid: 900 },
  };
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: booking, error: null }),
  };
  mocks.createClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'user-a' } : null } }) },
    from: (table: string) => {
      expect(table).toBe('bookings');
      return query;
    },
    rpc: mocks.rpc,
  });
  mocks.rpc.mockResolvedValue({
    data: {
      booking_id: bookingId, branch_id: branchId, transaction_id: 'tx-legacy-1',
      payment_delta: 900, is_idempotent_replay: false, reconciliation_warning: null,
    },
    error: null,
  });
});

describe('Cash Flow legacy booking payment action', () => {
  it('posts only the new tender delta and leaves a partial booking pending', async () => {
    booking.amount_paid = 100;
    const result = await recordLegacyBookingPaymentAction({
      ...baseInput,
      expectedAmountPaid: 100,
      payments: [{ amount: 300, paymentMethod: 'cash', financialAccountId: cashAccountId }],
    });
    expect(result.ok).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith('post_booking_payment_atomic', expect.objectContaining({
      p_booking_id: bookingId,
      p_branch_id: branchId,
      p_amount_paid: 400,
      p_payment_status: 'pending',
      p_next_status: null,
      p_clear_hold: false,
      p_payments: [{
        amount: 300, payment_method: 'cash',
        financial_account_id: cashAccountId, external_reference: null,
      }],
    }));
  });

  it('fully paid pending_payment booking uses accepted confirmation semantics and canonical RPC', async () => {
    const result = await recordLegacyBookingPaymentAction(baseInput);
    expect(result).toMatchObject({ ok: true, data: { transactionId: 'tx-legacy-1', paymentDelta: 900 } });
    expect(mocks.rpc).toHaveBeenCalledWith('post_booking_payment_atomic', expect.objectContaining({
      p_amount_paid: 900,
      p_payment_method: 'cash',
      p_payment_status: 'paid',
      p_next_status: 'confirmed',
      p_clear_hold: true,
      p_idempotency_key: 'cash-flow-legacy-1',
      p_business_date: '2026-09-29',
    }));
    expect(mocks.revalidateBookingSurfaces).toHaveBeenCalledWith(branchId);
  });

  it('uses other for split tender and forwards exact parts', async () => {
    const result = await recordLegacyBookingPaymentAction({
      ...baseInput,
      payments: [
        { amount: 300, paymentMethod: 'cash', financialAccountId: cashAccountId, externalReference: 'cash-ref' },
        { amount: 600, paymentMethod: 'gcash', financialAccountId: gcashAccountId, externalReference: 'gcash-ref' },
      ],
    });
    expect(result.ok).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith('post_booking_payment_atomic', expect.objectContaining({
      p_payment_method: 'other',
      p_payment_reference: null,
      p_payments: [
        { amount: 300, payment_method: 'cash', financial_account_id: cashAccountId, external_reference: 'cash-ref' },
        { amount: 600, payment_method: 'gcash', financial_account_id: gcashAccountId, external_reference: 'gcash-ref' },
      ],
    }));
  });

  it('retries the same cumulative target and key after the first response is lost', async () => {
    mocks.rpc.mockImplementation(async () => {
      if (booking.amount_paid === 0) {
        booking.amount_paid = 900;
        booking.payment_status = 'paid';
        booking.status = 'confirmed';
        booking.payment_method = 'cash';
        return {
          data: {
            booking_id: bookingId, branch_id: branchId, transaction_id: 'tx-legacy-1',
            payment_delta: 900, is_idempotent_replay: false, reconciliation_warning: null,
          },
          error: null,
        };
      }
      return {
        data: {
          booking_id: bookingId, branch_id: branchId, transaction_id: 'tx-legacy-1',
          payment_delta: 0, is_idempotent_replay: true, reconciliation_warning: null,
        },
        error: null,
      };
    });
    await recordLegacyBookingPaymentAction(baseInput);
    const replay = await recordLegacyBookingPaymentAction(baseInput);
    expect(replay).toMatchObject({ ok: true, data: { isIdempotentReplay: true, paymentDelta: 0 } });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc.mock.calls.map((call) => call[1].p_amount_paid)).toEqual([900, 900]);
    expect(mocks.rpc.mock.calls.map((call) => call[1].p_idempotency_key))
      .toEqual(['cash-flow-legacy-1', 'cash-flow-legacy-1']);
  });

  it('rejects unauthenticated, order-backed, invalid-price, and stale requests before RPC', async () => {
    authenticated = false;
    expect(await recordLegacyBookingPaymentAction(baseInput)).toMatchObject({ ok: false, code: 'AUTH_REQUIRED' });
    authenticated = true;
    booking.order_id = '55555555-5555-4555-8555-555555555555';
    expect(await recordLegacyBookingPaymentAction(baseInput)).toMatchObject({ ok: false, code: 'SOURCE_MISMATCH' });
    booking.order_id = null;
    booking.metadata = { price_paid: 'bad' };
    expect(await recordLegacyBookingPaymentAction(baseInput)).toMatchObject({ ok: false, code: 'BOOKING_PRICE_INVALID' });
    booking.metadata = { price_paid: 900 };
    booking.amount_paid = 200;
    expect(await recordLegacyBookingPaymentAction(baseInput)).toMatchObject({ ok: false, code: 'PAYMENT_STATE_CHANGED' });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
