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
  reconcileAbandonPaymentAttemptAction,
} from '@/lib/cash-flow/cash-flow-actions';

describe('Payment Reconciliation Actions', () => {
  const orderId = '11111111-1111-4111-8111-111111111111';
  const branchId = '22222222-2222-4222-8222-222222222222';
  const staffId = '33333333-3333-4333-8333-333333333333';
  const idempotencyKey = 'idem-reconciliation-key-1';

  let mockFinancialTxns: Array<Record<string, unknown>>;
  let mockMovements: Array<Record<string, unknown>>;
  let mockOrderSummaries: Array<Record<string, unknown>>;
  let mockPaymentAttempts: Array<Record<string, unknown>>;
  let mockBookingOrders: Record<string, unknown>;
  let mockBookings: Record<string, unknown>;
  let mockAdminUpdate: ReturnType<typeof vi.fn>;
  let mockRpc: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFinancialTxns = [];
    mockMovements = [];
    mockOrderSummaries = [];
    mockPaymentAttempts = [];
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

    mockRpc = vi.fn().mockResolvedValue({
      data: { success: true, status: 'reconciled_abandoned' },
      error: null,
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
        if (table === 'payment_attempts') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockImplementation((col: string, vals: string[]) => {
                const found = mockPaymentAttempts.filter((a) => vals.includes(String(a[col])));
                return {
                  data: found,
                  error: null,
                  maybeSingle: async () => ({ data: found[0] ?? null, error: null }),
                };
              }),
            }),
            update: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: null, error: null }),
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
      rpc: mockRpc,
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

    it('queries authoritative payment_attempts table and returns in_flight when under 30s', async () => {
      mockPaymentAttempts.push({
        id: 'att-1',
        order_id: orderId,
        idempotency_key: idempotencyKey,
        amount: 400,
        status: 'in_flight',
        created_at: new Date(Date.now() - 5_000).toISOString(),
      });

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

    it('queries authoritative payment_attempts table and returns needs_investigation when >= 30s', async () => {
      mockPaymentAttempts.push({
        id: 'att-2',
        order_id: orderId,
        idempotency_key: idempotencyKey,
        amount: 400,
        status: 'in_flight',
        created_at: new Date(Date.now() - 35_000).toISOString(),
      });

      const res = await verifyPaymentAttemptAction({
        orderId,
        sourceKind: 'booking_order',
        branchId,
        idempotencyKey,
        expectedAmount: 400,
      });

      expect(res.ok).toBe(true);
      if (!res.ok || res.status !== 'needs_investigation') throw new Error('Expected needs_investigation status');
      expect(res.status).toBe('needs_investigation');
      expect(res.message).toContain('unresolved after 30 seconds');
    });

    it('queries authoritative payment_attempts table and returns abandoned when attempt was reconciled', async () => {
      mockPaymentAttempts.push({
        id: 'att-3',
        order_id: orderId,
        idempotency_key: idempotencyKey,
        amount: 400,
        status: 'reconciled_abandoned',
        created_at: new Date(Date.now() - 60_000).toISOString(),
      });

      const res = await verifyPaymentAttemptAction({
        orderId,
        sourceKind: 'booking_order',
        branchId,
        idempotencyKey,
        expectedAmount: 400,
      });

      expect(res.ok).toBe(true);
      if (!res.ok || res.status !== 'abandoned') throw new Error('Expected abandoned status');
      expect(res.status).toBe('abandoned');
      expect(res.message).toContain('reconciled and abandoned');
    });
  });

  describe('clearPaymentAttemptAction', () => {
    it('safely clears active_payment_attempt and calls reconcile_abandon_payment_attempt RPC', async () => {
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
        reason: 'Customer cancelled transaction',
      });

      expect(res.ok).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('reconcile_abandon_payment_attempt', {
        p_idempotency_key: idempotencyKey,
        p_reason: 'Customer cancelled transaction',
      });
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

  describe('reconcileAbandonPaymentAttemptAction', () => {
    it('invokes reconcile_abandon_payment_attempt RPC with validated reason and key', async () => {
      const res = await reconcileAbandonPaymentAttemptAction({
        idempotencyKey,
        reason: 'Physical card terminal declined payment',
        branchId,
        orderId,
      });

      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error('Expected success');
      expect(res.status).toBe('reconciled_abandoned');
      expect(mockRpc).toHaveBeenCalledWith('reconcile_abandon_payment_attempt', {
        p_idempotency_key: idempotencyKey,
        p_reason: 'Physical card terminal declined payment',
      });
      expect(mocks.revalidateBookingSurfaces).toHaveBeenCalledWith(branchId);
    });

    it('rejects blank or missing reason with VALIDATION_FAILED', async () => {
      const res = await reconcileAbandonPaymentAttemptAction({
        idempotencyKey,
        reason: '   ',
        branchId,
        orderId,
      });

      expect(res.ok).toBe(false);
      if (res.ok) throw new Error('Expected failure');
      expect(res.code).toBe('VALIDATION_FAILED');
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('handles RPC database errors cleanly', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'CANNOT_ABANDON_COMMITTED_TRANSACTION', code: 'P0001' },
      });

      const res = await reconcileAbandonPaymentAttemptAction({
        idempotencyKey,
        reason: 'Attempted abandonment after commit',
        branchId,
        orderId,
      });

      expect(res.ok).toBe(false);
      if (res.ok) throw new Error('Expected failure');
      expect(res.error).toContain('CANNOT_ABANDON_COMMITTED_TRANSACTION');
    });
  });
});
