import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));

import { getPrintableReceiptAction } from '@/lib/cash-flow/cash-flow-actions';

const validTxId = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
const branchId = '11111111-2222-4333-8444-555555555555';
const otherBranchId = '99999999-8888-4777-8666-555555555555';

type MockTx = {
  id: string;
  branch_id: string;
  transaction_type: string;
  status: string;
  business_date: string;
  occurred_at: string;
  created_at?: string;
  source_type: string;
  source_id: string;
  external_reference: string | null;
  notes: string | null;
  branches: { name: string };
  financial_account_movements: Array<{
    id: string;
    financial_account_id: string;
    amount: number;
    payment_method: string;
    external_reference: string | null;
  }>;
};

describe('getPrintableReceiptAction', () => {
  let authenticatedUser: { id: string } | null;
  let staffRecord: { id: string; branch_id: string; system_role: string; is_active: boolean } | null;
  let txRecord: MockTx | null;
  let siblingTxs: MockTx[];
  let orderRecord: Record<string, unknown> | null;
  let summaryRecord: Record<string, unknown> | null;
  let payableItemsRecord: Array<{ description: string; amount: number }>;
  let legacyBookingRecord: Record<string, unknown> | null;

  beforeEach(() => {
    vi.clearAllMocks();
    authenticatedUser = { id: 'auth-user-123' };
    staffRecord = {
      id: 'staff-1',
      branch_id: branchId,
      system_role: 'crm',
      is_active: true,
    };
    txRecord = {
      id: validTxId,
      branch_id: branchId,
      transaction_type: 'customer_payment',
      status: 'posted',
      business_date: '2026-10-31',
      occurred_at: '2026-10-31T14:30:00.000Z',
      created_at: '2026-10-31T14:30:00.000Z',
      source_type: 'booking_order',
      source_id: 'order-uuid-1',
      external_reference: 'ORD-2026-001',
      notes: null,
      branches: { name: 'Main Spa' },
      financial_account_movements: [
        {
          id: 'mov-1',
          financial_account_id: 'acc-1',
          amount: 1500,
          payment_method: 'cash',
          external_reference: null,
        },
      ],
    };
    siblingTxs = [];
    orderRecord = {
      id: 'order-uuid-1',
      order_number: 'ORD-2026-001',
      delivery_type: 'in_spa',
      customers: { full_name: 'Maria Santos', phone: '09171234567' },
    };
    summaryRecord = {
      total_payable: 1500,
      net_allocated: 1500,
      remaining_balance: 0,
    };
    payableItemsRecord = [
      { description: 'Swedish Massage 60m', amount: 1500 },
    ];
    legacyBookingRecord = null;

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: authenticatedUser } }),
      },
      from: (table: string) => {
        const createQuery = () => {
          const state: {
            filters: Record<string, unknown>;
            inFilters: Record<string, unknown[]>;
          } = {
            filters: {},
            inFilters: {},
          };

          const builder = {
            eq(col: string, val: unknown) {
              state.filters[col] = val;
              return builder;
            },
            in(col: string, vals: unknown[]) {
              state.inFilters[col] = vals;
              return builder;
            },
            order() {
              return builder;
            },
            async maybeSingle() {
              if (table === 'staff') return { data: staffRecord, error: null };
              if (table === 'financial_transactions') {
                const id = state.filters['id'];
                if (id === validTxId && txRecord) return { data: txRecord, error: null };
                const match = siblingTxs.find((t) => t.id === id);
                if (match) return { data: match, error: null };
                return { data: null, error: null };
              }
              if (table === 'booking_orders') return { data: orderRecord, error: null };
              if (table === 'v_booking_order_financial_summaries') return { data: summaryRecord, error: null };
              if (table === 'bookings') return { data: legacyBookingRecord, error: null };
              return { data: null, error: null };
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            then(resolve: (val: { data: any; error: null }) => void) {
              if (table === 'order_payable_items') {
                return Promise.resolve(resolve({ data: payableItemsRecord, error: null }));
              }
              if (table === 'financial_transactions') {
                const all = siblingTxs.length > 0 ? siblingTxs : (txRecord ? [txRecord] : []);
                return Promise.resolve(resolve({ data: all, error: null }));
              }
              return Promise.resolve(resolve({ data: [], error: null }));
            },
          };

          return builder;
        };

        return {
          select: () => createQuery(),
        };
      },
    });
  });

  it('rejects invalid or non-authoritative transaction IDs', async () => {
    const resEmpty = await getPrintableReceiptAction('');
    expect(resEmpty.ok).toBe(false);
    if (!resEmpty.ok) expect(resEmpty.code).toBe('VALIDATION_FAILED');

    const resPrefix = await getPrintableReceiptAction('TXN-12345678');
    expect(resPrefix.ok).toBe(false);
    if (!resPrefix.ok) expect(resPrefix.code).toBe('VALIDATION_FAILED');

    const resSentinel = await getPrintableReceiptAction('null');
    expect(resSentinel.ok).toBe(false);
    if (!resSentinel.ok) expect(resSentinel.code).toBe('VALIDATION_FAILED');

    const resZeroUuid = await getPrintableReceiptAction('00000000-0000-0000-0000-000000000000');
    expect(resZeroUuid.ok).toBe(false);
    if (!resZeroUuid.ok) expect(resZeroUuid.code).toBe('VALIDATION_FAILED');
  });

  it('requires authenticated session', async () => {
    authenticatedUser = null;
    const res = await getPrintableReceiptAction(validTxId);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('AUTH_REQUIRED');
  });

  it('requires active staff record', async () => {
    staffRecord = null;
    const res = await getPrintableReceiptAction(validTxId);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('STAFF_UNAUTHORIZED');

    staffRecord = {
      id: 'staff-1',
      branch_id: branchId,
      system_role: 'crm',
      is_active: false,
    };
    const resInactive = await getPrintableReceiptAction(validTxId);
    expect(resInactive.ok).toBe(false);
    if (!resInactive.ok) expect(resInactive.code).toBe('STAFF_UNAUTHORIZED');
  });

  it('rejects unauthorized system roles like therapist', async () => {
    staffRecord!.system_role = 'therapist';
    const res = await getPrintableReceiptAction(validTxId);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('PAYMENT_ROLE_UNAUTHORIZED');
  });

  it('returns TRANSACTION_NOT_FOUND when transaction is missing', async () => {
    txRecord = null;
    const res = await getPrintableReceiptAction(validTxId);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('TRANSACTION_NOT_FOUND');
  });

  it('enforces branch isolation for branch staff', async () => {
    txRecord!.branch_id = otherBranchId;
    const res = await getPrintableReceiptAction(validTxId);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('BRANCH_UNAUTHORIZED');
  });

  it('allows owner role to retrieve receipts across any branch', async () => {
    staffRecord!.system_role = 'owner';
    txRecord!.branch_id = otherBranchId;
    const res = await getPrintableReceiptAction(validTxId);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.transactionId).toBe(validTxId);
    }
  });

  it('rejects non-posted transactions (voided or reversed)', async () => {
    txRecord!.status = 'voided';
    const resVoided = await getPrintableReceiptAction(validTxId);
    expect(resVoided.ok).toBe(false);
    if (!resVoided.ok) expect(resVoided.code).toBe('TRANSACTION_NOT_POSTED');

    txRecord!.status = 'reversed';
    const resReversed = await getPrintableReceiptAction(validTxId);
    expect(resReversed.ok).toBe(false);
    if (!resReversed.ok) expect(resReversed.code).toBe('TRANSACTION_NOT_POSTED');
  });

  it('rejects non-customer-receipt transaction types', async () => {
    txRecord!.transaction_type = 'operational_expense';
    const resExpense = await getPrintableReceiptAction(validTxId);
    expect(resExpense.ok).toBe(false);
    if (!resExpense.ok) expect(resExpense.code).toBe('INVALID_TRANSACTION_TYPE');

    txRecord!.transaction_type = 'cash_adjustment';
    const resAdj = await getPrintableReceiptAction(validTxId);
    expect(resAdj.ok).toBe(false);
    if (!resAdj.ok) expect(resAdj.code).toBe('INVALID_TRANSACTION_TYPE');

    txRecord!.transaction_type = 'tip_disbursement';
    const resTip = await getPrintableReceiptAction(validTxId);
    expect(resTip.ok).toBe(false);
    if (!resTip.ok) expect(resTip.code).toBe('INVALID_TRANSACTION_TYPE');
  });

  it('rejects negative, zero, or missing financial movements without Math.abs conversion', async () => {
    // Negative movement (must NOT be flipped by Math.abs)
    txRecord!.financial_account_movements = [
      {
        id: 'mov-neg',
        financial_account_id: 'acc-1',
        amount: -500,
        payment_method: 'cash',
        external_reference: null,
      },
    ];
    const resNeg = await getPrintableReceiptAction(validTxId);
    expect(resNeg.ok).toBe(false);
    if (!resNeg.ok) expect(resNeg.code).toBe('INVALID_MOVEMENTS');

    // Zero movement
    txRecord!.financial_account_movements = [
      {
        id: 'mov-zero',
        financial_account_id: 'acc-1',
        amount: 0,
        payment_method: 'cash',
        external_reference: null,
      },
    ];
    const resZero = await getPrintableReceiptAction(validTxId);
    expect(resZero.ok).toBe(false);
    if (!resZero.ok) expect(resZero.code).toBe('INVALID_MOVEMENTS');

    // Empty movements
    txRecord!.financial_account_movements = [];
    const resEmpty = await getPrintableReceiptAction(validTxId);
    expect(resEmpty.ok).toBe(false);
    if (!resEmpty.ok) expect(resEmpty.code).toBe('INVALID_MOVEMENTS');
  });

  it('rejects invalid or missing transaction source', async () => {
    txRecord!.source_type = 'unknown_source';
    const resBadSource = await getPrintableReceiptAction(validTxId);
    expect(resBadSource.ok).toBe(false);
    if (!resBadSource.ok) expect(resBadSource.code).toBe('INVALID_TRANSACTION_SOURCE');

    txRecord!.source_type = 'booking_order';
    txRecord!.source_id = '';
    const resEmptyId = await getPrintableReceiptAction(validTxId);
    expect(resEmptyId.ok).toBe(false);
    if (!resEmptyId.ok) expect(resEmptyId.code).toBe('INVALID_TRANSACTION_SOURCE');
  });

  it('reconstructs authoritative receipt data for booking_order', async () => {
    const res = await getPrintableReceiptAction(validTxId);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.companyName).toBe('CRADLE WELLNESS LIVING INC.');
      expect(res.data.branchName).toBe('Main Spa');
      expect(res.data.transactionId).toBe(validTxId);
      expect(res.data.orderNumber).toBe('ORD-2026-001');
      expect(res.data.customerName).toBe('Maria Santos');
      expect(res.data.customerPhone).toBe('09171234567');
      expect(res.data.amountPaid).toBe(1500);
      expect(res.data.totalPayable).toBe(1500);
      expect(res.data.alreadyPaid).toBe(0);
      expect(res.data.remainingBalance).toBe(0);
      expect(res.data.isReprint).toBe(true);
      expect(res.data.receiptLabel).toBe('PAYMENT ACKNOWLEDGMENT');
      expect(res.data.items).toEqual([
        { description: 'Swedish Massage 60m', amount: 1500 },
      ]);
      expect(res.data.payments).toEqual([
        { method: 'cash', amount: 1500, reference: null },
      ]);
    }
  });

  it('reconstructs exact historical balances for partial payments: ₱400 paid first and ₱600 paid later on ₱1,000 bill', async () => {
    const orderId = 'order-split-1000';
    const tx1Id = '11111111-1111-4111-8111-111111111111';
    const tx2Id = '22222222-2222-4222-8222-222222222222';

    // Total bill: ₱1,000
    payableItemsRecord = [{ description: 'Body Scrub & Massage', amount: 1000 }];
    orderRecord = {
      id: orderId,
      order_number: 'ORD-SPLIT-1000',
      delivery_type: 'in_spa',
      customers: { full_name: 'Ana Ramos', phone: '09190001122' },
    };

    // First payment: ₱400 at 10:00 AM
    const tx1: MockTx = {
      id: tx1Id,
      branch_id: branchId,
      transaction_type: 'customer_payment',
      status: 'posted',
      business_date: '2026-10-31',
      occurred_at: '2026-10-31T10:00:00.000Z',
      created_at: '2026-10-31T10:00:00.000Z',
      source_type: 'booking_order',
      source_id: orderId,
      external_reference: 'ORD-SPLIT-1000',
      notes: null,
      branches: { name: 'Main Spa' },
      financial_account_movements: [
        {
          id: 'mov-split-1',
          financial_account_id: 'acc-1',
          amount: 400,
          payment_method: 'cash',
          external_reference: null,
        },
      ],
    };

    // Second payment: ₱600 at 2:00 PM
    const tx2: MockTx = {
      id: tx2Id,
      branch_id: branchId,
      transaction_type: 'customer_payment',
      status: 'posted',
      business_date: '2026-10-31',
      occurred_at: '2026-10-31T14:00:00.000Z',
      created_at: '2026-10-31T14:00:00.000Z',
      source_type: 'booking_order',
      source_id: orderId,
      external_reference: 'ORD-SPLIT-1000',
      notes: null,
      branches: { name: 'Main Spa' },
      financial_account_movements: [
        {
          id: 'mov-split-2',
          financial_account_id: 'acc-1',
          amount: 600,
          payment_method: 'gcash',
          external_reference: 'GCASH-REF-600',
        },
      ],
    };

    siblingTxs = [tx1, tx2];

    // 1. Reprint Tx 1 (₱400 paid first):
    // Should show: alreadyPaid = 0, amountPaid = 400, remainingBalance = 600
    txRecord = tx1;
    const res1 = await getPrintableReceiptAction(tx1Id);
    expect(res1.ok).toBe(true);
    if (res1.ok) {
      expect(res1.data.transactionId).toBe(tx1Id);
      expect(res1.data.totalPayable).toBe(1000);
      expect(res1.data.alreadyPaid).toBe(0);
      expect(res1.data.amountPaid).toBe(400);
      expect(res1.data.remainingBalance).toBe(600);
      expect(res1.data.payments).toEqual([
        { method: 'cash', amount: 400, reference: null },
      ]);
    }

    // 2. Reprint Tx 2 (₱600 paid later):
    // Should show: alreadyPaid = 400, amountPaid = 600, remainingBalance = 0
    txRecord = tx2;
    const res2 = await getPrintableReceiptAction(tx2Id);
    expect(res2.ok).toBe(true);
    if (res2.ok) {
      expect(res2.data.transactionId).toBe(tx2Id);
      expect(res2.data.totalPayable).toBe(1000);
      expect(res2.data.alreadyPaid).toBe(400);
      expect(res2.data.amountPaid).toBe(600);
      expect(res2.data.remainingBalance).toBe(0);
      expect(res2.data.payments).toEqual([
        { method: 'gcash', amount: 600, reference: 'GCASH-REF-600' },
      ]);
    }
  });

  it('fails closed when total payable cannot be established', async () => {
    payableItemsRecord = [];
    summaryRecord = { total_payable: 0 };
    const res = await getPrintableReceiptAction(validTxId);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('INVALID_PAYABLE_TOTAL');
  });

  it('reconstructs authoritative receipt data for legacy_booking with validated price', async () => {
    txRecord!.source_type = 'legacy_booking';
    txRecord!.source_id = 'booking-uuid-99';
    legacyBookingRecord = {
      id: 'booking-uuid-99',
      delivery_type: 'in_spa',
      metadata: { price_paid: 1200 },
      customers: { full_name: 'Juan Dela Cruz', phone: '09181112233' },
      services: { name: 'Deep Tissue Massage' },
    };
    txRecord!.financial_account_movements = [
      {
        id: 'mov-legacy-1',
        financial_account_id: 'acc-legacy',
        amount: 1200,
        payment_method: 'gcash',
        external_reference: 'GCASH-REF-888',
      },
    ];

    const res = await getPrintableReceiptAction(validTxId);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.customerName).toBe('Juan Dela Cruz');
      expect(res.data.customerPhone).toBe('09181112233');
      expect(res.data.orderNumber).toBe('BK-booking-');
      expect(res.data.amountPaid).toBe(1200);
      expect(res.data.totalPayable).toBe(1200);
      expect(res.data.remainingBalance).toBe(0);
      expect(res.data.payments).toEqual([
        { method: 'gcash', amount: 1200, reference: 'GCASH-REF-888' },
      ]);
      expect(res.data.items).toEqual([
        { description: 'Deep Tissue Massage', amount: 1200 },
      ]);
    }
  });
});
