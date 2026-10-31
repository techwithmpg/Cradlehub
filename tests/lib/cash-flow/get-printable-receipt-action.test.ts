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
        return {
          select: () => ({
            eq: (_col: string, val: unknown) => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
              maybeSingle: async () => {
                if (table === 'staff') return { data: staffRecord, error: null };
                if (table === 'financial_transactions') {
                  if (val === validTxId) return { data: txRecord, error: null };
                  return { data: null, error: null };
                }
                if (table === 'booking_orders') return { data: orderRecord, error: null };
                if (table === 'v_booking_order_financial_summaries') return { data: summaryRecord, error: null };
                if (table === 'bookings') return { data: legacyBookingRecord, error: null };
                return { data: null, error: null };
              },
              order: () => ({
                data: table === 'order_payable_items' ? payableItemsRecord : [],
                error: null,
              }),
            }),
          }),
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

