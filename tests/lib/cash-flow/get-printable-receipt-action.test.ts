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
  reversal_of_transaction_id?: string | null;
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

type MockPayableItem = {
  id?: string;
  description: string;
  amount: number;
  sequence?: number;
  created_at?: string;
};

type MockAllocation = {
  id: string;
  financial_account_movement_id: string;
  amount: number;
};

describe('getPrintableReceiptAction', () => {
  let authenticatedUser: { id: string } | null;
  let staffRecord: { id: string; branch_id: string; system_role: string; is_active: boolean } | null;
  let txRecord: MockTx | null;
  let siblingTxs: MockTx[];
  let orderRecord: Record<string, unknown> | null;
  let summaryRecord: Record<string, unknown> | null;
  let payableItemsRecord: MockPayableItem[];
  let allocationsRecord: MockAllocation[];
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
      { id: 'item-1', description: 'Swedish Massage 60m', amount: 1500, sequence: 1, created_at: '2026-10-31T14:00:00.000Z' },
    ];
    allocationsRecord = [];
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
                if (txRecord && txRecord.id === id) return { data: txRecord, error: null };
                return { data: null, error: null };
              }
              if (table === 'booking_orders') return { data: orderRecord, error: null };
              if (table === 'v_booking_order_financial_summaries') return { data: summaryRecord, error: null };
              if (table === 'bookings') return { data: legacyBookingRecord, error: null };
              return { data: null, error: null };
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            then(resolve: (val: { data: any; error: null }) => void) {
              if (table === 'financial_order_allocations') {
                return Promise.resolve(resolve({ data: allocationsRecord, error: null }));
              }
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
    // Negative movement
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

  // ─── REGRESSION TEST SUITE FOR CORRECTION A & B ───────────────────────────

  it('Regression A1: reconstructs exact historical balances for ₱400 + ₱600 partial payments', async () => {
    const orderId = 'order-split-1000';
    const tx1Id = '11111111-1111-4111-8111-111111111111';
    const tx2Id = '22222222-2222-4222-8222-222222222222';

    // Total bill: ₱1,000 (created at 10:00 AM)
    payableItemsRecord = [
      { id: 'item-1000', description: 'Body Scrub & Massage', amount: 1000, sequence: 1, created_at: '2026-10-31T10:00:00.000Z' },
    ];
    orderRecord = {
      id: orderId,
      order_number: 'ORD-SPLIT-1000',
      delivery_type: 'in_spa',
      customers: { full_name: 'Ana Ramos', phone: '09190001122' },
    };

    // First payment: ₱400 at 10:05 AM
    const tx1: MockTx = {
      id: tx1Id,
      branch_id: branchId,
      transaction_type: 'customer_payment',
      status: 'posted',
      business_date: '2026-10-31',
      occurred_at: '2026-10-31T10:05:00.000Z',
      created_at: '2026-10-31T10:05:00.000Z',
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

  it('Regression A2: accounts for posted refunds: ₱400 payment, ₱100 refund, then ₱700 payment', async () => {
    const orderId = 'order-refund-flow';
    const tx1Id = '11111111-1111-4111-8111-aaaaaaaaaaaa';
    const tx2Id = '22222222-2222-4222-8222-bbbbbbbbbbbb';
    const tx3Id = '33333333-3333-4333-8333-cccccccccccc';

    // Total payable: ₱1,000
    payableItemsRecord = [
      { id: 'item-ref', description: 'Spa Package', amount: 1000, sequence: 1, created_at: '2026-10-31T09:00:00.000Z' },
    ];
    orderRecord = {
      id: orderId,
      order_number: 'ORD-REF-1000',
      delivery_type: 'in_spa',
      customers: { full_name: 'Carlos Diaz', phone: '09175554321' },
    };

    // Tx 1: ₱400 payment at 10:00 AM
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
      external_reference: 'ORD-REF-1000',
      notes: null,
      branches: { name: 'Main Spa' },
      financial_account_movements: [
        { id: 'mov-p1', financial_account_id: 'acc-1', amount: 400, payment_method: 'cash', external_reference: null },
      ],
    };

    // Tx 2: ₱100 refund at 11:00 AM (signed movement -100)
    const tx2: MockTx = {
      id: tx2Id,
      branch_id: branchId,
      transaction_type: 'customer_refund',
      status: 'posted',
      business_date: '2026-10-31',
      occurred_at: '2026-10-31T11:00:00.000Z',
      created_at: '2026-10-31T11:00:00.000Z',
      source_type: 'booking_order',
      source_id: orderId,
      external_reference: 'ORD-REF-1000',
      notes: 'Customer changed mind on add-on',
      branches: { name: 'Main Spa' },
      financial_account_movements: [
        { id: 'mov-r1', financial_account_id: 'acc-1', amount: -100, payment_method: 'cash', external_reference: null },
      ],
    };

    // Tx 3: ₱700 payment at 2:00 PM
    const tx3: MockTx = {
      id: tx3Id,
      branch_id: branchId,
      transaction_type: 'customer_payment',
      status: 'posted',
      business_date: '2026-10-31',
      occurred_at: '2026-10-31T14:00:00.000Z',
      created_at: '2026-10-31T14:00:00.000Z',
      source_type: 'booking_order',
      source_id: orderId,
      external_reference: 'ORD-REF-1000',
      notes: null,
      branches: { name: 'Main Spa' },
      financial_account_movements: [
        { id: 'mov-p2', financial_account_id: 'acc-1', amount: 700, payment_method: 'card', external_reference: 'CARD-700' },
      ],
    };

    siblingTxs = [tx1, tx2, tx3];

    // Check Tx 1 reprint:
    txRecord = tx1;
    const res1 = await getPrintableReceiptAction(tx1Id);
    expect(res1.ok).toBe(true);
    if (res1.ok) {
      expect(res1.data.alreadyPaid).toBe(0);
      expect(res1.data.amountPaid).toBe(400);
      expect(res1.data.remainingBalance).toBe(600);
    }

    // Check Tx 3 reprint:
    // Prior net paid must be ₱400 (Tx 1) - ₱100 (Tx 2 refund) = ₱300.
    // Tx 3 pays ₱700, so remaining balance is ₱1000 - ₱300 - ₱700 = ₱0.
    txRecord = tx3;
    const res3 = await getPrintableReceiptAction(tx3Id);
    expect(res3.ok).toBe(true);
    if (res3.ok) {
      expect(res3.data.alreadyPaid).toBe(300);
      expect(res3.data.amountPaid).toBe(700);
      expect(res3.data.totalPayable).toBe(1000);
      expect(res3.data.remainingBalance).toBe(0);
      expect(res3.data.payments).toEqual([
        { method: 'card', amount: 700, reference: 'CARD-700' },
      ]);
    }
  });

  it('Regression A3: ignores voided or reversed payments when calculating alreadyPaid', async () => {
    const orderId = 'order-voided-flow';
    const txVoidedId = '11111111-1111-4111-8111-aaaaaaaaaa01';
    const txActiveId = '22222222-2222-4222-8222-bbbbbbbbbb02';

    payableItemsRecord = [
      { id: 'item-v', description: 'Deep Tissue', amount: 1000, sequence: 1, created_at: '2026-10-31T09:00:00.000Z' },
    ];
    orderRecord = {
      id: orderId,
      order_number: 'ORD-VOID-1000',
      delivery_type: 'in_spa',
      customers: { full_name: 'Elena Cruz', phone: '09171113333' },
    };

    // Tx 1: ₱400 was voided
    const txVoided: MockTx = {
      id: txVoidedId,
      branch_id: branchId,
      transaction_type: 'customer_payment',
      status: 'voided',
      business_date: '2026-10-31',
      occurred_at: '2026-10-31T10:00:00.000Z',
      created_at: '2026-10-31T10:00:00.000Z',
      source_type: 'booking_order',
      source_id: orderId,
      external_reference: 'ORD-VOID-1000',
      notes: 'Entry mistake, voided',
      branches: { name: 'Main Spa' },
      financial_account_movements: [
        { id: 'mov-v1', financial_account_id: 'acc-1', amount: 400, payment_method: 'cash', external_reference: null },
      ],
    };

    // Tx 2: ₱1,000 paid later
    const txActive: MockTx = {
      id: txActiveId,
      branch_id: branchId,
      transaction_type: 'customer_payment',
      status: 'posted',
      business_date: '2026-10-31',
      occurred_at: '2026-10-31T14:00:00.000Z',
      created_at: '2026-10-31T14:00:00.000Z',
      source_type: 'booking_order',
      source_id: orderId,
      external_reference: 'ORD-VOID-1000',
      notes: null,
      branches: { name: 'Main Spa' },
      financial_account_movements: [
        { id: 'mov-act1', financial_account_id: 'acc-1', amount: 1000, payment_method: 'cash', external_reference: null },
      ],
    };

    siblingTxs = [txVoided, txActive];

    // Tx 2 reprint should see alreadyPaid = 0 because Tx 1 is voided
    txRecord = txActive;
    const res = await getPrintableReceiptAction(txActiveId);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.alreadyPaid).toBe(0);
      expect(res.data.amountPaid).toBe(1000);
      expect(res.data.remainingBalance).toBe(0);
    }

    // Direct reprint of Tx Voided should fail with TRANSACTION_NOT_POSTED
    txRecord = txVoided;
    const resVoid = await getPrintableReceiptAction(txVoidedId);
    expect(resVoid.ok).toBe(false);
    if (!resVoid.ok) expect(resVoid.code).toBe('TRANSACTION_NOT_POSTED');
  });

  it('Regression A4: supports split-tender payments accurately across history', async () => {
    const orderId = 'order-split-tender';
    const tx1Id = '11111111-1111-4111-8111-aaaaaaaaaa03';
    const tx2Id = '22222222-2222-4222-8222-bbbbbbbbbb04';

    payableItemsRecord = [
      { id: 'item-st', description: 'Package Service', amount: 1000, sequence: 1, created_at: '2026-10-31T09:00:00.000Z' },
    ];
    orderRecord = {
      id: orderId,
      order_number: 'ORD-SPLIT-TENDER',
      delivery_type: 'in_spa',
      customers: { full_name: 'Mark Reyes', phone: '09172224444' },
    };

    // Tx 1: Split tender: ₱200 cash + ₱200 maya = ₱400
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
      external_reference: 'ORD-SPLIT-TENDER',
      notes: null,
      branches: { name: 'Main Spa' },
      financial_account_movements: [
        { id: 'mov-st1', financial_account_id: 'acc-1', amount: 200, payment_method: 'cash', external_reference: null },
        { id: 'mov-st2', financial_account_id: 'acc-2', amount: 200, payment_method: 'maya', external_reference: 'MAYA-200' },
      ],
    };

    // Tx 2: ₱600 card
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
      external_reference: 'ORD-SPLIT-TENDER',
      notes: null,
      branches: { name: 'Main Spa' },
      financial_account_movements: [
        { id: 'mov-st3', financial_account_id: 'acc-3', amount: 600, payment_method: 'card', external_reference: 'CARD-600' },
      ],
    };

    siblingTxs = [tx1, tx2];

    // Tx 1 reprint: shows both tenders in breakdown
    txRecord = tx1;
    const res1 = await getPrintableReceiptAction(tx1Id);
    expect(res1.ok).toBe(true);
    if (res1.ok) {
      expect(res1.data.amountPaid).toBe(400);
      expect(res1.data.payments).toHaveLength(2);
      expect(res1.data.alreadyPaid).toBe(0);
      expect(res1.data.remainingBalance).toBe(600);
    }

    // Tx 2 reprint: recognizes prior split tender sum of ₱400
    txRecord = tx2;
    const res2 = await getPrintableReceiptAction(tx2Id);
    expect(res2.ok).toBe(true);
    if (res2.ok) {
      expect(res2.data.alreadyPaid).toBe(400);
      expect(res2.data.amountPaid).toBe(600);
      expect(res2.data.remainingBalance).toBe(0);
    }
  });

  it('Regression A5: rejects incomplete, zero, or malformed previous movements rather than silently skipping them', async () => {
    const orderId = 'order-corrupt-flow';
    const txBadId = '11111111-1111-4111-8111-aaaaaaaaaa05';
    const txGoodId = '22222222-2222-4222-8222-bbbbbbbbbb06';

    payableItemsRecord = [
      { id: 'item-corrupt', description: 'Massage', amount: 1000, sequence: 1, created_at: '2026-10-31T09:00:00.000Z' },
    ];
    orderRecord = {
      id: orderId,
      order_number: 'ORD-CORRUPT',
      delivery_type: 'in_spa',
      customers: { full_name: 'Corrupt Client', phone: '09170000000' },
    };

    // Prior transaction has movement with amount 0 (strictly invalid per ledger rules)
    const txBad: MockTx = {
      id: txBadId,
      branch_id: branchId,
      transaction_type: 'customer_payment',
      status: 'posted',
      business_date: '2026-10-31',
      occurred_at: '2026-10-31T10:00:00.000Z',
      created_at: '2026-10-31T10:00:00.000Z',
      source_type: 'booking_order',
      source_id: orderId,
      external_reference: 'ORD-CORRUPT',
      notes: null,
      branches: { name: 'Main Spa' },
      financial_account_movements: [
        { id: 'mov-zero-prior', financial_account_id: 'acc-1', amount: 0, payment_method: 'cash', external_reference: null },
      ],
    };

    const txGood: MockTx = {
      id: txGoodId,
      branch_id: branchId,
      transaction_type: 'customer_payment',
      status: 'posted',
      business_date: '2026-10-31',
      occurred_at: '2026-10-31T14:00:00.000Z',
      created_at: '2026-10-31T14:00:00.000Z',
      source_type: 'booking_order',
      source_id: orderId,
      external_reference: 'ORD-CORRUPT',
      notes: null,
      branches: { name: 'Main Spa' },
      financial_account_movements: [
        { id: 'mov-good', financial_account_id: 'acc-1', amount: 1000, payment_method: 'cash', external_reference: null },
      ],
    };

    siblingTxs = [txBad, txGood];
    txRecord = txGood;

    // Must fail closed with MALFORMED_FINANCIAL_EVIDENCE
    const res = await getPrintableReceiptAction(txGoodId);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('MALFORMED_FINANCIAL_EVIDENCE');
      expect(res.error).toContain('MALFORMED_FINANCIAL_EVIDENCE');
    }
  });

  it('Regression B1: does not present today’s changed order total as an immutable historical receipt total', async () => {
    const orderId = 'order-items-added-later';
    const tx1Id = '11111111-1111-4111-8111-aaaaaaaaaa07';
    const tx2Id = '22222222-2222-4222-8222-bbbbbbbbbb08';

    // Order initially had 1 item (₱1,000 at 10:00 AM).
    // Later at 3:00 PM, an add-on item of ₱500 was added.
    payableItemsRecord = [
      { id: 'item-orig', description: 'Original Massage', amount: 1000, sequence: 1, created_at: '2026-10-31T10:00:00.000Z' },
      { id: 'item-later', description: 'Add-on Scrub', amount: 500, sequence: 2, created_at: '2026-10-31T15:00:00.000Z' },
    ];
    orderRecord = {
      id: orderId,
      order_number: 'ORD-CHANGED-TOTAL',
      delivery_type: 'in_spa',
      customers: { full_name: 'Lita Gomez', phone: '09173335555' },
    };

    // Tx 1: ₱400 paid at 10:05 AM (when total was only ₱1,000)
    const tx1: MockTx = {
      id: tx1Id,
      branch_id: branchId,
      transaction_type: 'customer_payment',
      status: 'posted',
      business_date: '2026-10-31',
      occurred_at: '2026-10-31T10:05:00.000Z',
      created_at: '2026-10-31T10:05:00.000Z',
      source_type: 'booking_order',
      source_id: orderId,
      external_reference: 'ORD-CHANGED-TOTAL',
      notes: null,
      branches: { name: 'Main Spa' },
      financial_account_movements: [
        { id: 'mov-t1', financial_account_id: 'acc-1', amount: 400, payment_method: 'cash', external_reference: null },
      ],
    };

    // Tx 2: ₱1,100 paid at 3:05 PM (after total became ₱1,500)
    const tx2: MockTx = {
      id: tx2Id,
      branch_id: branchId,
      transaction_type: 'customer_payment',
      status: 'posted',
      business_date: '2026-10-31',
      occurred_at: '2026-10-31T15:05:00.000Z',
      created_at: '2026-10-31T15:05:00.000Z',
      source_type: 'booking_order',
      source_id: orderId,
      external_reference: 'ORD-CHANGED-TOTAL',
      notes: null,
      branches: { name: 'Main Spa' },
      financial_account_movements: [
        { id: 'mov-t2', financial_account_id: 'acc-1', amount: 1100, payment_method: 'card', external_reference: 'CARD-1100' },
      ],
    };

    siblingTxs = [tx1, tx2];

    // 1. When reprinting Tx 1 (at 10:05 AM):
    // Total payable must be ₱1,000 (NOT today's ₱1,500!).
    // Items should only contain the 1 item that existed at 10:05 AM.
    // alreadyPaid = 0, amountPaid = 400, remainingBalance = 600.
    txRecord = tx1;
    const res1 = await getPrintableReceiptAction(tx1Id);
    expect(res1.ok).toBe(true);
    if (res1.ok) {
      expect(res1.data.totalPayable).toBe(1000);
      expect(res1.data.amountPaid).toBe(400);
      expect(res1.data.alreadyPaid).toBe(0);
      expect(res1.data.remainingBalance).toBe(600);
      expect(res1.data.items).toEqual([
        { description: 'Original Massage', amount: 1000 },
      ]);
    }

    // 2. When reprinting Tx 2 (at 3:05 PM):
    // Total payable includes both items: ₱1,500.
    // alreadyPaid = 400, amountPaid = 1,100, remainingBalance = 0.
    txRecord = tx2;
    const res2 = await getPrintableReceiptAction(tx2Id);
    expect(res2.ok).toBe(true);
    if (res2.ok) {
      expect(res2.data.totalPayable).toBe(1500);
      expect(res2.data.amountPaid).toBe(1100);
      expect(res2.data.alreadyPaid).toBe(400);
      expect(res2.data.remainingBalance).toBe(0);
      expect(res2.data.items).toHaveLength(2);
    }
  });

  it('Regression B2: fails closed with actionable warning when historical payable total cannot be verified', async () => {
    // All payable items were created in the future after the transaction
    payableItemsRecord = [
      { id: 'item-future', description: 'Future Item', amount: 1000, sequence: 1, created_at: '2026-10-31T20:00:00.000Z' },
    ];
    txRecord!.created_at = '2026-10-31T10:00:00.000Z';
    txRecord!.occurred_at = '2026-10-31T10:00:00.000Z';

    const res = await getPrintableReceiptAction(validTxId);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('UNVERIFIED_HISTORICAL_PAYABLE');
      expect(res.error).toContain('UNVERIFIED_HISTORICAL_PAYABLE');
    }
  });

  it('Regression A6: uses financial_order_allocations when present to determine exact order payment amount', async () => {
    const orderId = 'order-allocated-1';
    const txId = '11111111-1111-4111-8111-aaaaaaaaaa09';

    payableItemsRecord = [
      { id: 'item-aloc', description: 'Group Service', amount: 600, sequence: 1, created_at: '2026-10-31T10:00:00.000Z' },
    ];
    orderRecord = {
      id: orderId,
      order_number: 'ORD-ALLOC-600',
      delivery_type: 'in_spa',
      customers: { full_name: 'Group Client', phone: '09174446666' },
    };

    // Movement was ₱1,000 (split across orders), but only ₱600 is allocated to this order
    const tx: MockTx = {
      id: txId,
      branch_id: branchId,
      transaction_type: 'customer_payment',
      status: 'posted',
      business_date: '2026-10-31',
      occurred_at: '2026-10-31T10:05:00.000Z',
      created_at: '2026-10-31T10:05:00.000Z',
      source_type: 'booking_order',
      source_id: orderId,
      external_reference: 'ORD-ALLOC-600',
      notes: null,
      branches: { name: 'Main Spa' },
      financial_account_movements: [
        { id: 'mov-multi', financial_account_id: 'acc-1', amount: 1000, payment_method: 'cash', external_reference: null },
      ],
    };

    // Allocation specifically for this order: ₱600
    allocationsRecord = [
      { id: 'alloc-1', financial_account_movement_id: 'mov-multi', amount: 600 },
    ];

    siblingTxs = [tx];
    txRecord = tx;

    const res = await getPrintableReceiptAction(txId);
    expect(res.ok).toBe(true);
    if (res.ok) {
      // Amount paid should be the allocated ₱600, not the full ₱1,000 movement!
      expect(res.data.amountPaid).toBe(600);
      expect(res.data.totalPayable).toBe(600);
      expect(res.data.alreadyPaid).toBe(0);
      expect(res.data.remainingBalance).toBe(0);
      expect(res.data.payments).toEqual([
        { method: 'cash', amount: 600, reference: null },
      ]);
    }
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
