import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateBookingSurfaces: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/bookings/revalidate-booking-surfaces', () => ({
  revalidateOperationalBookingSurfaces: mocks.revalidateBookingSurfaces,
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));

import {
  verifyPaymentAttemptAction,
  clearPaymentAttemptAction,
} from '@/lib/cash-flow/cash-flow-actions';

describe('Payment Reconciliation Actions', () => {
  const orderId = '11111111-1111-4111-8111-111111111111';
  const branchId = '22222222-2222-4222-8222-222222222222';
  const staffId = '33333333-3333-4333-8333-333333333333';
  const idempotencyKey = 'idem-reconciliation-key-1';

  let mockFinancialTxns: Array<Record<string, unknown>>;
  let mockMovements: Array<Record<string, unknown>>;
  let mockOrderSummaries: Array<Record<string, unknown>>;
  let mockBookingOrders: Record<string, unknown>;
  let mockBookings: Record<string, unknown>;
  let mockAdminUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFinancialTxns = [];
    mockMovements = [];
    mockOrderSummaries = [];
    mockBookingOrders = {
      id: orderId,
      branch_id: branchId,
      metadata: {},
    };
    mockBookings = {
      id: orderId,
      branch_id: branchId,
      order_id: null,
      amount_paid: 0,
      payment_status: 'pending',
      status: 'pending_payment',
      metadata: { price_paid: 1000 },
    };

    mockAdminUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    mocks.createAdminClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'booking_orders') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: async () => ({ data: mockBookingOrders, error: null }),
              }),
            }),
            update: mockAdminUpdate,
          };
        }
        if (table === 'bookings') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: async () => ({ data: mockBookings, error: null }),
              }),
            }),
            update: mockAdminUpdate,
          };
        }
        throw new Error(`Unexpected admin table: ${table}`);
      }),
    });

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: staffId } } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'financial_transactions') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockImplementation((col: string, vals: string[]) => {
                const found = mockFinancialTxns.filter((t) => vals.includes(String(t[col])));
                return {
                  data: found,
                  error: null,
                  maybeSingle: async () => ({ data: found[0] ?? null, error: null }),
                };
              }),
              eq: vi.fn().mockImplementation((col: string, val: string) => {
                const matching = mockFinancialTxns.filter((t) => String(t[col]) === val);
                return {
                  eq: vi.fn().mockImplementation((c2: string, v2: string) => {
                    const m2 = matching.filter((t) => String(t[c2]) === v2);
                    return {
                      order: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue({ data: m2, error: null }),
                      }),
                    };
                  }),
                };
              }),
            }),
          };
        }
        if (table === 'financial_account_movements') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((col: string, val: string) => {
                const found = mockMovements.filter((m) => String(m[col]) === val);
                return Promise.resolve({ data: found, error: null });
              }),
            }),
          };
        }
        if (table === 'v_booking_order_financial_summaries') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: async () => ({
                  data: mockOrderSummaries[0] ?? {
                    total_payable: 1000,
                    net_allocated: 400,
                    remaining_balance: 600,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'booking_orders') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: async () => ({ data: mockBookingOrders, error: null }),
              }),
            }),
          };
        }
        if (table === 'bookings') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: async () => ({ data: mockBookings, error: null }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected client table: ${table}`);
      }),
    });
  });

  describe('verifyPaymentAttemptAction', () => {
    it('returns confirmed status with authoritative movements and balance details when matching transaction exists in ledger', async () => {
      mockFinancialTxns.push({
        id: 'tx-confirmed-uuid-1',
        branch_id: branchId,
        business_date: '2026-10-31',
        transaction_type: 'customer_payment',
        source_type: 'booking_order',
        source_id: orderId,
        status: 'posted',
        idempotency_key: idempotencyKey,
      });

      mockMovements.push({
        id: 'mov-1',
        transaction_id: 'tx-confirmed-uuid-1',
        amount: 400,
        payment_method: 'cash',
        external_reference: null,
      });

      mockOrderSummaries.push({
        total_payable: 1000,
        net_allocated: 1000,
        remaining_balance: 0,
      });

      const res = await verifyPaymentAttemptAction({
        orderId,
        sourceKind: 'booking_order',
        branchId,
        idempotencyKey,
        expectedAmount: 400,
      });

      expect(res.ok).toBe(true);
      if (!res.ok || res.status !== 'confirmed') throw new Error('Expected confirmed status');
      expect(res.status).toBe('confirmed');
      expect(res.transactionId).toBe('tx-confirmed-uuid-1');
      expect(res.amountPaid).toBe(400);
      expect(res.totalPayable).toBe(1000);
      expect(res.alreadyPaid).toBe(600);
      expect(res.remainingBalance).toBe(0);
      expect(res.movements).toHaveLength(1);
    });

    it('rejects verification if authoritative movement amount does not match attempted amount', async () => {
      mockFinancialTxns.push({
        id: 'tx-mismatch-1',
        branch_id: branchId,
        business_date: '2026-10-31',
        transaction_type: 'customer_payment',
        source_type: 'booking_order',
        source_id: orderId,
        status: 'posted',
        idempotency_key: idempotencyKey,
      });

      mockMovements.push({
        id: 'mov-1',
        transaction_id: 'tx-mismatch-1',
        amount: 300, // Attempt was 400!
        payment_method: 'cash',
        external_reference: null,
      });

      const res = await verifyPaymentAttemptAction({
        orderId,
        sourceKind: 'booking_order',
        branchId,
        idempotencyKey,
        expectedAmount: 400,
      });

      expect(res.ok).toBe(false);
      if (res.ok) throw new Error('Expected failure');
      expect(res.code).toBe('TRANSACTION_AMOUNT_MISMATCH');
    });

    it('returns in_flight when transaction is not yet in ledger and attempt timestamp is recent (<15s)', async () => {
      // No transaction in mockFinancialTxns, but metadata has recent active_payment_attempt
      mockBookingOrders.metadata = {
        active_payment_attempt: {
          idempotency_key: idempotencyKey,
          amount: 400,
          initiated_at: new Date().toISOString(), // Just initiated!
        },
      };

      const res = await verifyPaymentAttemptAction({
        orderId,
        sourceKind: 'booking_order',
        branchId,
        idempotencyKey,
        expectedAmount: 400,
      });

      expect(res.ok).toBe(true);
      if (!res.ok || res.status !== 'in_flight') throw new Error('Expected in_flight status');
      expect(res.status).toBe('in_flight');
      expect(res.message).toContain('still in-flight');
    });

    it('returns unrelated_payment when transaction not found but another transaction settled the order under a different key', async () => {
      // Attempt timestamp older than 15s
      mockBookingOrders.metadata = {
        active_payment_attempt: {
          idempotency_key: idempotencyKey,
          amount: 400,
          initiated_at: new Date(Date.now() - 20_000).toISOString(),
        },
      };

      // Unrelated transaction posted by another cashier
      mockFinancialTxns.push({
        id: 'tx-unrelated-999',
        branch_id: branchId,
        source_id: orderId,
        source_type: 'booking_order',
        status: 'posted',
        idempotency_key: 'idem-other-cashier-key',
        recorded_at: new Date().toISOString(),
      });

      const res = await verifyPaymentAttemptAction({
        orderId,
        sourceKind: 'booking_order',
        branchId,
        idempotencyKey,
        expectedAmount: 400,
      });

      expect(res.ok).toBe(true);
      if (!res.ok || res.status !== 'unrelated_payment') throw new Error('Expected unrelated_payment status');
      expect(res.status).toBe('unrelated_payment');
      expect(res.message).toContain('unrelated transaction');
      expect(res.unrelatedTransactionId).toBe('tx-unrelated-999');
    });

    it('returns not_posted when transaction not found and attempt window has safely elapsed', async () => {
      mockBookingOrders.metadata = {
        active_payment_attempt: {
          idempotency_key: idempotencyKey,
          amount: 400,
          initiated_at: new Date(Date.now() - 30_000).toISOString(),
        },
      };

      const res = await verifyPaymentAttemptAction({
        orderId,
        sourceKind: 'booking_order',
        branchId,
        idempotencyKey,
        expectedAmount: 400,
      });

      expect(res.ok).toBe(true);
      if (!res.ok || res.status !== 'not_posted') throw new Error('Expected not_posted status');
      expect(res.status).toBe('not_posted');
      expect(res.message).toContain('No transaction was recorded');
    });
  });

  describe('clearPaymentAttemptAction', () => {
    it('safely clears active_payment_attempt when transaction has not committed', async () => {
      mockBookingOrders.metadata = {
        active_payment_attempt: {
          idempotency_key: idempotencyKey,
          amount: 400,
        },
      };

      const res = await clearPaymentAttemptAction({
        orderId,
        sourceKind: 'booking_order',
        branchId,
        idempotencyKey,
      });

      expect(res.ok).toBe(true);
      expect(mockAdminUpdate).toHaveBeenCalled();
    });

    it('refuses to clear if transaction actually posted to financial_transactions', async () => {
      mockFinancialTxns.push({
        id: 'tx-already-committed',
        idempotency_key: idempotencyKey,
      });

      const res = await clearPaymentAttemptAction({
        orderId,
        sourceKind: 'booking_order',
        branchId,
        idempotencyKey,
      });

      expect(res.ok).toBe(false);
      if (res.ok) throw new Error('Expected failure');
      expect(res.code).toBe('ATTEMPT_ALREADY_COMMITTED');
    });
  });
});
