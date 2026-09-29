import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  recordBookingPaymentChange: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/bookings/payment-transaction', () => ({ recordBookingPaymentChange: mocks.recordBookingPaymentChange }));
vi.mock('@/lib/bookings/payment-gate', () => ({ getBookingPaymentGate: () => ({ allowed: true }) }));
vi.mock('@/lib/bookings/revalidate-booking-surfaces', () => ({ revalidateOperationalBookingSurfaces: mocks.revalidate }));
vi.mock('@/lib/notifications/create', () => ({ createNotification: vi.fn(), resolveNotificationsForEntity: vi.fn() }));
vi.mock('@/lib/cache/cache-tags', () => ({ cacheTags: { ownerWorkspace: () => 'owner', crmWorkspace: () => 'crm' }, invalidateTag: vi.fn() }));
vi.mock('@/lib/dev-bypass', () => ({ isDevAuthBypassEnabled: () => false, getDevBypassLayoutStaff: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { confirmBookingPaymentAction } from '@/app/(dashboard)/crm/bookings/actions';
import { updateBookingPaymentAction } from '@/app/(dashboard)/manager/bookings/actions';
import { ownerUpdateBookingPaymentAction } from '@/app/(dashboard)/owner/bookings/actions';

const bookingId = '11111111-1111-1111-1111-111111111111';
const branchId = '22222222-2222-2222-2222-222222222222';
const accountId = '33333333-3333-3333-3333-333333333333';

function clientFor(role: string) {
  const staff = { id: 'staff-1', branch_id: branchId, system_role: role };
  const booking = {
    id: bookingId, branch_id: branchId, status: 'pending', booking_progress_status: 'not_started',
    session_completed_at: null, hold_expires_at: '2099-01-01T00:00:00Z',
    staff_id: null, driver_id: null, customer_id: null, booking_date: '2026-09-29',
    start_time: '10:00:00', end_time: '11:00:00', delivery_type: 'in_spa', type: 'walkin',
    payment_method: 'cash', payment_status: 'pending', amount_paid: 500, payment_reference: null,
  };
  const query = (row: unknown) => {
    const q = {
      select: () => q,
      eq: () => q,
      neq: () => q,
      maybeSingle: async () => ({ data: row, error: null }),
      single: async () => ({ data: row, error: null }),
    };
    return q;
  };
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'auth-1' } } }) },
    from: (table: string) => query(table === 'staff' ? staff : booking),
  };
}

describe('booking payment action convergence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordBookingPaymentChange.mockResolvedValue({
      ok: true, booking: { id: bookingId, branch_id: branchId },
      transactionId: 'tx-1', paymentDelta: 500, reconciliationWarning: null,
      isIdempotentReplay: false,
    });
  });

  it('CRM confirmation sends the cumulative target and account to the canonical command', async () => {
    mocks.createClient.mockResolvedValue(clientFor('crm'));
    const result = await confirmBookingPaymentAction({
      bookingId, paymentMethod: 'cash', amountPaid: 1000, financialAccountId: accountId,
    });
    expect(result.success).toBe(true);
    expect(mocks.recordBookingPaymentChange).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      bookingId, branchId, amountPaid: 1000, financialAccountId: accountId, nextStatus: 'confirmed',
    }));
  });

  it('Manager payment forwards the target and explicit tender without a direct booking update', async () => {
    mocks.createClient.mockResolvedValue(clientFor('manager'));
    const result = await updateBookingPaymentAction({
      bookingId, paymentMethod: 'cash', paymentStatus: 'paid', amountPaid: 1000,
      financialAccountId: accountId, idempotencyKey: 'manager-1',
    });
    expect(result.success).toBe(true);
    expect(mocks.recordBookingPaymentChange).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      bookingId, amountPaid: 1000, financialAccountId: accountId, idempotencyKey: 'manager-1',
    }));
  });

  it('Owner cross-branch payment forwards to the same command', async () => {
    mocks.createClient.mockResolvedValue(clientFor('owner'));
    const result = await ownerUpdateBookingPaymentAction({
      bookingId, paymentMethod: 'cash', paymentStatus: 'paid', amountPaid: 1000,
      financialAccountId: accountId,
    });
    expect(result.success).toBe(true);
    expect(mocks.recordBookingPaymentChange).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      bookingId, branchId: null, amountPaid: 1000, financialAccountId: accountId,
    }));
  });
});
