import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { recordLegacyBookingPaymentDomain } from './legacy-payment-writer';
import { recordBookingPaymentChange } from '@/lib/bookings/payment-transaction';

vi.mock('@/lib/bookings/payment-transaction', () => ({
  recordBookingPaymentChange: vi.fn(),
}));

vi.mock('@/lib/bookings/revalidate-booking-surfaces', () => ({
  revalidateOperationalBookingSurfaces: vi.fn().mockResolvedValue(undefined),
}));

const mockedRecordBookingPaymentChange = vi.mocked(recordBookingPaymentChange);

const BRANCH_A = '11111111-1111-4111-8111-111111111111';
const BRANCH_B = '22222222-2222-4222-8222-222222222222';
const BOOKING_ID = '33333333-3333-4333-8333-333333333333';
const ACCOUNT_ID = '44444444-4444-4444-8444-444444444444';

function createMockSupabase(bookingRow: Record<string, unknown> | null = null) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'bookings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: bookingRow,
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  } as unknown as Parameters<typeof recordLegacyBookingPaymentDomain>[0];
}

describe('recordLegacyBookingPaymentDomain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRecordBookingPaymentChange.mockReset();
  });

  it('records payment successfully for authorized crm front-desk staff', async () => {
    const supabase = createMockSupabase({
      id: BOOKING_ID,
      branch_id: BRANCH_A,
      order_id: null,
      amount_paid: 0,
      payment_status: 'unpaid',
      status: 'confirmed',
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
        userId: 'user-crm-1',
        role: 'crm',
        staffId: 'staff-crm-1',
        branchId: BRANCH_A,
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
  });

  it.each([
    ['crm'],
    ['csr'],
    ['manager'],
    ['assistant_manager'],
    ['store_manager'],
    ['owner'],
  ])('authorizes payment recording for valid role: %s', async (role) => {
    const supabase = createMockSupabase({
      id: BOOKING_ID,
      branch_id: BRANCH_A,
      order_id: null,
      amount_paid: 0,
      payment_status: 'unpaid',
      status: 'confirmed',
      metadata: { price_paid: 500 },
    });

    mockedRecordBookingPaymentChange.mockResolvedValueOnce({
      ok: true,
      booking: { id: BOOKING_ID, branch_id: BRANCH_A },
      transactionId: `tx-${role}`,
      paymentDelta: 500,
      isIdempotentReplay: false,
      reconciliationWarning: null,
    });

    const result = await recordLegacyBookingPaymentDomain(
      supabase,
      {
        bookingId: BOOKING_ID,
        branchId: BRANCH_A,
        expectedAmountPaid: 0,
        idempotencyKey: `idem-${role}`,
        payments: [{ amount: 500, paymentMethod: 'cash', financialAccountId: ACCOUNT_ID }],
        businessDate: '2026-10-23',
      },
      {
        userId: `user-${role}`,
        role,
        staffId: `staff-${role}`,
        branchId: BRANCH_A,
      }
    );

    expect(result.ok).toBe(true);
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

  it('rejects missing staff record with STAFF_REQUIRED', async () => {
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
      {
        userId: 'user-no-staff',
        role: 'crm',
        staffId: undefined,
      }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('STAFF_REQUIRED');
    }
  });

  it('rejects missing or unresolved role with ROLE_REQUIRED', async () => {
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
      {
        userId: 'user-no-role',
        staffId: 'staff-no-role',
        role: '',
      }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('ROLE_REQUIRED');
    }
  });

  it.each([
    ['therapist'],
    ['driver'],
    ['cleaner'],
    ['inventory'],
    ['unauthorized_role'],
  ])('rejects unauthorized role (%s) with FORBIDDEN', async (role) => {
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
        staffId: 'staff-1',
        role,
        branchId: BRANCH_A,
      }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('FORBIDDEN');
    }
  });

  it('rejects cross-branch access for non-owner staff with BRANCH_MISMATCH', async () => {
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
        branchId: BRANCH_A, // Request target branch
        expectedAmountPaid: 0,
        idempotencyKey: 'idem-1',
        payments: [{ amount: 500, paymentMethod: 'cash', financialAccountId: ACCOUNT_ID }],
        businessDate: '2026-10-23',
      },
      {
        userId: 'user-1',
        staffId: 'staff-1',
        role: 'crm',
        branchId: BRANCH_B, // Staff belongs to branch B
      }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('BRANCH_MISMATCH');
    }
  });

  it('allows cross-branch access for owner role', async () => {
    const supabase = createMockSupabase({
      id: BOOKING_ID,
      branch_id: BRANCH_A,
      order_id: null,
      amount_paid: 0,
      payment_status: 'unpaid',
      status: 'confirmed',
      metadata: { price_paid: 1000 },
    });

    mockedRecordBookingPaymentChange.mockResolvedValueOnce({
      ok: true,
      booking: { id: BOOKING_ID, branch_id: BRANCH_A },
      transactionId: 'tx-owner',
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
        idempotencyKey: 'idem-owner-cross',
        payments: [{ amount: 1000, paymentMethod: 'cash', financialAccountId: ACCOUNT_ID }],
        businessDate: '2026-10-23',
      },
      {
        userId: 'user-owner',
        staffId: 'staff-owner',
        role: 'owner',
        branchId: BRANCH_B, // Owner assigned to Branch B can operate on Branch A
      }
    );

    expect(result.ok).toBe(true);
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
        staffId: 'staff-1',
        role: 'crm',
        branchId: BRANCH_A,
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
        staffId: 'staff-1',
        role: 'crm',
        branchId: BRANCH_A,
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

    const result = await recordLegacyBookingPaymentDomain(
      supabase,
      {
        bookingId: BOOKING_ID,
        branchId: BRANCH_A,
        expectedAmountPaid: 0,
        idempotencyKey: 'idem-replay-1',
        payments: [{ amount: 1000, paymentMethod: 'cash', financialAccountId: ACCOUNT_ID }],
        businessDate: '2026-10-23',
      },
      {
        userId: 'user-1',
        staffId: 'staff-1',
        role: 'crm',
        branchId: BRANCH_A,
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
        staffId: 'staff-1',
        role: 'crm',
        branchId: BRANCH_A,
      }
    );

    expect(result.ok).toBe(true);
    expect(mockedRecordBookingPaymentChange).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        amountPaid: 400,
        paymentStatus: 'pending',
        nextStatus: null,
        clearHold: false,
      })
    );
  });
});
