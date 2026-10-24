import { describe, expect, it, vi, beforeEach } from 'vitest';
import { recordLegacyBookingPaymentDomain } from './legacy-payment-writer';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/bookings/revalidate-booking-surfaces', () => ({
  revalidateOperationalBookingSurfaces: vi.fn(),
}));

vi.mock('@/lib/bookings/payment-transaction', () => ({
  recordBookingPaymentChange: vi.fn(),
}));

import { recordBookingPaymentChange } from '@/lib/bookings/payment-transaction';
const mockedRecordBookingPaymentChange = vi.mocked(recordBookingPaymentChange);

const BRANCH_A = '11111111-1111-4111-a111-111111111111';
const BRANCH_B = '22222222-2222-4222-a222-222222222222';
const BOOKING_ID = '33333333-3333-4333-a333-333333333333';
const ACCOUNT_ID = '44444444-4444-4444-a444-444444444444';

function createMockSupabase(bookingRow: Record<string, unknown> | null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: bookingRow,
            error: null,
          })),
        })),
      })),
    })),
  };
}

describe('recordLegacyBookingPaymentDomain (Bearer Authenticated)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('proves a valid Desktop bearer token client works without browser cookies', async () => {
    const supabase = createMockSupabase({
      id: BOOKING_ID,
      branch_id: BRANCH_A,
      order_id: null,
      amount_paid: 0,
      payment_status: 'unpaid',
      status: 'pending_payment',
      metadata: { price_paid: 1000 },
    });

    mockedRecordBookingPaymentChange.mockResolvedValueOnce({
      ok: true,
      booking: { id: BOOKING_ID, branch_id: BRANCH_A },
      transactionId: 'tx-123',
      paymentDelta: 1000,
      isIdempotentReplay: false,
      reconciliationWarning: null,
    });

    const result = await recordLegacyBookingPaymentDomain(
      supabase,
      {
        bookingId: BOOKING_ID,
        branchId: BRANCH_A,
        expectedAmountPaid: 0,
        idempotencyKey: 'idem-valid-1',
        payments: [
          {
            amount: 1000,
            paymentMethod: 'cash',
            financialAccountId: ACCOUNT_ID,
          },
        ],
        businessDate: '2026-10-23',
        notes: 'Full payment via desktop',
      },
      {
        userId: 'user-cashier-1',
        role: 'cashier',
        staffId: 'staff-cashier-1',
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.success).toBe(true);
      expect(result.data.transactionId).toBe('tx-123');
      expect(result.data.paymentDelta).toBe(1000);
      expect(result.data.isIdempotentReplay).toBe(false);
      expect(result.data.branchId).toBe(BRANCH_A);
    }
    expect(mockedRecordBookingPaymentChange).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        bookingId: BOOKING_ID,
        branchId: BRANCH_A,
        amountPaid: 1000,
        nextStatus: 'confirmed',
        clearHold: true,
      })
    );
  });

  it('rejects unauthenticated requests (missing actor userId)', async () => {
    const supabase = createMockSupabase(null);

    const result = await recordLegacyBookingPaymentDomain(
      supabase,
      {
        bookingId: BOOKING_ID,
        branchId: BRANCH_A,
        expectedAmountPaid: 0,
        idempotencyKey: 'idem-1',
        payments: [{ amount: 500, paymentMethod: 'cash', financialAccountId: ACCOUNT_ID }],
        businessDate: '2026-10-23',
      },
      { userId: '' }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('AUTH_REQUIRED');
    }
  });

  it('rejects cross-branch bookings with BRANCH_MISMATCH', async () => {
    const supabase = createMockSupabase({
      id: BOOKING_ID,
      branch_id: BRANCH_B, // Belongs to branch B
      order_id: null,
      amount_paid: 0,
      payment_status: 'unpaid',
      status: 'confirmed',
      metadata: { price_paid: 1000 },
    });

    const result = await recordLegacyBookingPaymentDomain(
      supabase,
      {
        bookingId: BOOKING_ID,
        branchId: BRANCH_A, // Cashier is on branch A
        expectedAmountPaid: 0,
        idempotencyKey: 'idem-1',
        payments: [{ amount: 500, paymentMethod: 'cash', financialAccountId: ACCOUNT_ID }],
        businessDate: '2026-10-23',
      },
      {
        userId: 'user-1',
        role: 'cashier',
      }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('BRANCH_MISMATCH');
    }
  });

  it('rejects ineligible staff roles with FORBIDDEN', async () => {
    const supabase = createMockSupabase({
      id: BOOKING_ID,
      branch_id: BRANCH_A,
      order_id: null,
      amount_paid: 0,
      payment_status: 'unpaid',
      status: 'confirmed',
      metadata: { price_paid: 1000 },
    });

    const result = await recordLegacyBookingPaymentDomain(
      supabase,
      {
        bookingId: BOOKING_ID,
        branchId: BRANCH_A,
        expectedAmountPaid: 0,
        idempotencyKey: 'idem-1',
        payments: [{ amount: 500, paymentMethod: 'cash', financialAccountId: ACCOUNT_ID }],
        businessDate: '2026-10-23',
      },
      {
        userId: 'user-1',
        role: 'therapist', // Therapists cannot record payments
      }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('FORBIDDEN');
    }
  });

  it('rejects bookings backed by booking_orders with SOURCE_MISMATCH', async () => {
    const supabase = createMockSupabase({
      id: BOOKING_ID,
      branch_id: BRANCH_A,
      order_id: 'order-123', // Has an order_id!
      amount_paid: 0,
      payment_status: 'unpaid',
      status: 'confirmed',
      metadata: { price_paid: 1000 },
    });

    const result = await recordLegacyBookingPaymentDomain(
      supabase,
      {
        bookingId: BOOKING_ID,
        branchId: BRANCH_A,
        expectedAmountPaid: 0,
        idempotencyKey: 'idem-1',
        payments: [{ amount: 500, paymentMethod: 'cash', financialAccountId: ACCOUNT_ID }],
        businessDate: '2026-10-23',
      },
      {
        userId: 'user-1',
        role: 'cashier',
      }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('SOURCE_MISMATCH');
    }
  });

  it('rejects closed/cancelled bookings with BOOKING_NOT_PAYABLE', async () => {
    const supabase = createMockSupabase({
      id: BOOKING_ID,
      branch_id: BRANCH_A,
      order_id: null,
      amount_paid: 0,
      payment_status: 'unpaid',
      status: 'cancelled',
      metadata: { price_paid: 1000 },
    });

    const result = await recordLegacyBookingPaymentDomain(
      supabase,
      {
        bookingId: BOOKING_ID,
        branchId: BRANCH_A,
        expectedAmountPaid: 0,
        idempotencyKey: 'idem-1',
        payments: [{ amount: 500, paymentMethod: 'cash', financialAccountId: ACCOUNT_ID }],
        businessDate: '2026-10-23',
      },
      {
        userId: 'user-1',
        role: 'cashier',
      }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('BOOKING_NOT_PAYABLE');
    }
  });

  it('detects duplicate idempotency submissions and returns isIdempotentReplay without double charge', async () => {
    const supabase = createMockSupabase({
      id: BOOKING_ID,
      branch_id: BRANCH_A,
      order_id: null,
      amount_paid: 1000,
      payment_status: 'paid',
      status: 'confirmed',
      metadata: { price_paid: 1000 },
    });

    mockedRecordBookingPaymentChange.mockResolvedValueOnce({
      ok: true,
      booking: { id: BOOKING_ID, branch_id: BRANCH_A },
      transactionId: 'tx-existing',
      paymentDelta: 0,
      isIdempotentReplay: true,
      reconciliationWarning: null,
    });

    // Replay of same payment
    const result = await recordLegacyBookingPaymentDomain(
      supabase,
      {
        bookingId: BOOKING_ID,
        branchId: BRANCH_A,
        expectedAmountPaid: 0, // original expected amount
        idempotencyKey: 'idem-replay-1',
        payments: [{ amount: 1000, paymentMethod: 'cash', financialAccountId: ACCOUNT_ID }],
        businessDate: '2026-10-23',
      },
      {
        userId: 'user-1',
        role: 'cashier',
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.isIdempotentReplay).toBe(true);
      expect(result.data.paymentDelta).toBe(0);
    }
  });

  it('supports partial payment without confirming pending booking prematurely', async () => {
    const supabase = createMockSupabase({
      id: BOOKING_ID,
      branch_id: BRANCH_A,
      order_id: null,
      amount_paid: 0,
      payment_status: 'unpaid',
      status: 'pending_payment',
      metadata: { price_paid: 1000 },
    });

    mockedRecordBookingPaymentChange.mockResolvedValueOnce({
      ok: true,
      booking: { id: BOOKING_ID, branch_id: BRANCH_A },
      transactionId: 'tx-partial',
      paymentDelta: 400,
      isIdempotentReplay: false,
      reconciliationWarning: null,
    });

    const result = await recordLegacyBookingPaymentDomain(
      supabase,
      {
        bookingId: BOOKING_ID,
        branchId: BRANCH_A,
        expectedAmountPaid: 0,
        idempotencyKey: 'idem-partial',
        payments: [{ amount: 400, paymentMethod: 'cash', financialAccountId: ACCOUNT_ID }],
        businessDate: '2026-10-23',
      },
      {
        userId: 'user-1',
        role: 'cashier',
      }
    );

    expect(result.ok).toBe(true);
    expect(mockedRecordBookingPaymentChange).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        amountPaid: 400,
        paymentStatus: 'pending',
        nextStatus: null, // Should not confirm on partial payment
        clearHold: false,
      })
    );
  });
});
