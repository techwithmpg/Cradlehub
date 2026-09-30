import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { recordBookingPaymentChange } from '@/lib/bookings/payment-transaction';
import { confirmBookingPaymentSchema, updateBookingPaymentSchema } from '@/lib/validations/booking';

const bookingId = '11111111-1111-1111-1111-111111111111';
const branchId = '22222222-2222-2222-2222-222222222222';
const cashAccount = '33333333-3333-3333-3333-333333333333';
const gcashAccount = '44444444-4444-4444-4444-444444444444';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260929140000_cf8_booking_payment_command.sql'), 'utf8');

describe('CF8 explicit booking payment command', () => {
  it('routes a booking payment to the atomic canonical command with an idempotency key', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {
      booking_id: bookingId, branch_id: branchId, transaction_id: 'tx-1',
      payment_delta: 500, is_idempotent_replay: false, reconciliation_warning: null,
    }, error: null });
    const result = await recordBookingPaymentChange({ rpc }, {
      bookingId, branchId, paymentMethod: 'cash', paymentStatus: 'paid',
      amountPaid: 1000, financialAccountId: cashAccount,
    });
    expect(result).toMatchObject({ ok: true, transactionId: 'tx-1', paymentDelta: 500 });
    expect(rpc).toHaveBeenCalledWith('post_booking_payment_atomic', expect.objectContaining({
      p_booking_id: bookingId, p_amount_paid: 1000,
      p_financial_account_id: cashAccount, p_payments: null,
      p_idempotency_key: expect.any(String),
    }));
  });

  it('passes exact split tenders and stable caller idempotency key', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {
      booking_id: bookingId, branch_id: branchId, transaction_id: 'tx-2',
      payment_delta: 1500, is_idempotent_replay: false, reconciliation_warning: null,
    }, error: null });
    await recordBookingPaymentChange({ rpc }, {
      bookingId, branchId, paymentMethod: 'other', paymentStatus: 'paid',
      amountPaid: 1500, idempotencyKey: 'checkout-123', payments: [
        { amount: 500, paymentMethod: 'cash', financialAccountId: cashAccount },
        { amount: 1000, paymentMethod: 'gcash', financialAccountId: gcashAccount },
      ],
    });
    expect(rpc).toHaveBeenCalledWith('post_booking_payment_atomic', expect.objectContaining({
      p_idempotency_key: 'checkout-123',
      p_payments: [
        { amount: 500, payment_method: 'cash', financial_account_id: cashAccount, external_reference: null },
        { amount: 1000, payment_method: 'gcash', financial_account_id: gcashAccount, external_reference: null },
      ],
    }));
  });

  it('preserves account selection failure as a failed payment command', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: {
      message: 'ACCOUNT_SELECTION_REQUIRED: Select the payment account explicitly',
    } });
    const result = await recordBookingPaymentChange({ rpc }, {
      bookingId, branchId, paymentMethod: 'gcash', paymentStatus: 'paid', amountPaid: 500,
    });
    expect(result).toEqual({ ok: false, error: expect.stringContaining('ACCOUNT_SELECTION_REQUIRED') });
  });

  it('accepts explicit accounts and split tenders in the existing action schemas', () => {
    expect(confirmBookingPaymentSchema.safeParse({
      bookingId, paymentMethod: 'cash', amountPaid: 500, financialAccountId: cashAccount,
    }).success).toBe(true);
    expect(updateBookingPaymentSchema.safeParse({
      bookingId, paymentMethod: 'other', paymentStatus: 'paid', amountPaid: 1500,
      payments: [
        { amount: 500, paymentMethod: 'cash', financialAccountId: cashAccount },
        { amount: 1000, paymentMethod: 'gcash', financialAccountId: gcashAccount },
      ],
    }).success).toBe(true);
  });

  it('keeps ledger posting explicit, source-linked, locked, and authenticated in the migration draft', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.post_booking_payment_atomic(');
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain('auth.uid()');
    expect(migration).toContain('s.system_role');
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain('v_delta := p_amount_paid - COALESCE(v_booking.amount_paid, 0)');
    expect(migration).toContain('public.post_order_payment_atomic(');
    expect(migration).toContain("'legacy_booking', v_booking.id::text");
    expect(migration).toContain('INSERT INTO public.financial_account_movements');
    expect(migration).toContain('ACCOUNT_SELECTION_REQUIRED');
    expect(migration).toContain('ACCOUNT_BRANCH_MISMATCH');
    expect(migration).toContain('ACCOUNT_TYPE_MISMATCH');
    expect(migration).toContain('INVALID_CURRENCY');
    expect(migration).toContain('PAYMENT_DELTA_MISMATCH');
    expect(migration).toContain('IDEMPOTENCY_CONFLICT');
    expect(migration).toContain('REVOKE EXECUTE ON FUNCTION public.record_booking_payment_change');
    expect(migration).not.toMatch(/CREATE\s+TRIGGER/i);
  });
});
