import { readFileSync } from 'node:fs';
import { describe, expect, it, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/bookings/revalidate-booking-surfaces', () => ({
  revalidateOperationalBookingSurfaces: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));

import { recordExpenseAction } from '@/lib/cash-flow/cash-flow-actions';
import { validateExpenseReceipt } from '@/lib/cash-flow/expense-receipt';
import type { RecordExpenseInput } from '@/lib/cash-flow/cash-flow-types';

const branchId = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';
const input: RecordExpenseInput = {
  branchId,
  financialAccountId: accountId,
  categoryId: '33333333-3333-4333-8333-333333333333',
  amount: 125,
  payee: 'Vendor',
  description: 'Receipt test',
  businessDate: '2026-09-29',
  idempotencyKey: 'expense-test-key',
};

function receipt(bytes = [0xff, 0xd8, 0xff, 0x00], name = 'receipt.jpg', type = 'image/jpeg') {
  const form = new FormData();
  form.set('receipt', new File([new Uint8Array(bytes)], name, { type }));
  return form;
}

function createQuery(data: unknown) {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data, error: null }),
  };
  return query;
}

function mockSession(options: { user?: boolean; active?: boolean; role?: string; staffBranch?: string } = {}) {
  const { user = true, active = true, role = 'manager', staffBranch = branchId } = options;
  mocks.createClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: user ? { id: 'user-a' } : null } }) },
    from: (table: string) => {
      if (table === 'staff') return createQuery({
        id: 'staff-a', branch_id: staffBranch, system_role: role, is_active: active,
      });
      if (table === 'branches') return createQuery({ id: branchId });
      if (table === 'financial_accounts') return createQuery({
        id: accountId, branch_id: branchId, is_active: true,
      });
      throw new Error(`Unexpected table: ${table}`);
    },
    rpc: mocks.rpc,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession();
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({
    data: { transactionId: 'tx-a', idempotentReplay: false }, error: null,
  });
  mocks.createAdminClient.mockReturnValue({
    storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) },
  });
});

describe('CF7 receipt correction', () => {
  it('keeps managed Storage DDL out of the pending migration and server secrets out of the client', () => {
    const migration = readFileSync('supabase/migrations/20260929120000_cf7_expense_receipt_storage.sql', 'utf8');
    const client = readFileSync('src/components/features/cash-flow/record-financial-entry-modal.tsx', 'utf8');
    const admin = readFileSync('src/lib/supabase/admin.ts', 'utf8');
    expect(migration).not.toMatch(/ALTER TABLE\s+storage\.objects/i);
    expect(migration).not.toMatch(/(?:CREATE|DROP) POLICY[\s\S]*?ON\s+storage\.objects/i);
    expect(admin).toMatch(/^import ['"]server-only['"]/);
    expect(admin).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(client).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(client).not.toMatch(/\.storage\s*\.from\(/);
  });

  it('requires an authenticated caller and active staff before privileged upload', async () => {
    mockSession({ user: false });
    expect(await recordExpenseAction(input, receipt())).toMatchObject({ ok: false, code: 'AUTH_REQUIRED' });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    mockSession({ active: false });
    expect(await recordExpenseAction(input, receipt())).toMatchObject({ ok: false, code: 'STAFF_INACTIVE' });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('enforces role and branch authority before privileged upload', async () => {
    mockSession({ role: 'therapist' });
    expect(await recordExpenseAction(input, receipt())).toMatchObject({ ok: false, code: 'EXPENSE_ROLE_UNAUTHORIZED' });
    mockSession({ staffBranch: '44444444-4444-4444-8444-444444444444' });
    expect(await recordExpenseAction(input, receipt())).toMatchObject({ ok: false, code: 'BRANCH_MISMATCH' });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('generates a server path and sends it to post_expense_atomic', async () => {
    const result = await recordExpenseAction(input, receipt());
    expect(result).toMatchObject({ ok: true, transactionId: 'tx-a' });
    const path = mocks.upload.mock.calls[0]?.[0] as string;
    expect(path).toMatch(/^11111111-1111-4111-8111-111111111111\/2026\/09\/rec_2026-09-29_[a-f0-9]{32}\.jpg$/);
    expect(mocks.rpc).toHaveBeenCalledWith('post_expense_atomic',
      expect.objectContaining({ p_receipt_image_path: path, p_idempotency_key: 'expense-test-key' }));
    expect(mocks.upload.mock.calls[0]?.[2]).toMatchObject({ contentType: 'image/jpeg', upsert: false });
  });

  it('rejects oversized, unsupported, mismatched, and forged receipt types', async () => {
    const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' });
    expect(await validateExpenseReceipt(oversized)).toMatchObject({ ok: false, code: 'RECEIPT_SIZE_INVALID' });
    expect(await validateExpenseReceipt(new File(['x'], 'note.txt', { type: 'text/plain' })))
      .toMatchObject({ ok: false, code: 'RECEIPT_TYPE_INVALID' });
    expect(await validateExpenseReceipt(new File(['x'], 'fake.pdf', { type: 'image/jpeg' })))
      .toMatchObject({ ok: false, code: 'RECEIPT_TYPE_INVALID' });
    expect(await validateExpenseReceipt(new File(['x'], 'fake.jpg', { type: 'image/jpeg' })))
      .toMatchObject({ ok: false, code: 'RECEIPT_CONTENT_INVALID' });
  });

  it('does not post an expense when upload fails', async () => {
    mocks.upload.mockResolvedValue({ error: { message: 'Storage unavailable' } });
    expect(await recordExpenseAction(input, receipt())).toMatchObject({ ok: false, code: 'RECEIPT_UPLOAD_FAILED' });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('attempts orphan cleanup after RPC failure and reports cleanup failure distinctly', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'DB rejected expense', code: 'P0001' } });
    expect(await recordExpenseAction(input, receipt())).toMatchObject({ ok: false, code: 'P0001' });
    expect(mocks.remove).toHaveBeenCalledWith([mocks.upload.mock.calls[0]?.[0]]);
    mocks.remove.mockResolvedValue({ error: { message: 'Removal denied' } });
    expect(await recordExpenseAction(input, receipt())).toMatchObject({
      ok: false, code: 'EXPENSE_FAILED_RECEIPT_CLEANUP_FAILED',
    });
  });

  it('removes a newly uploaded receipt on idempotent replay', async () => {
    mocks.rpc.mockResolvedValue({ data: { transactionId: 'tx-original', idempotentReplay: true }, error: null });
    expect(await recordExpenseAction(input, receipt())).toMatchObject({
      ok: true, transactionId: 'tx-original', idempotentReplay: true,
    });
    expect(mocks.remove).toHaveBeenCalledWith([mocks.upload.mock.calls[0]?.[0]]);
  });

  it('preserves negative movement and database idempotency in the CF7 RPC', () => {
    const migration = readFileSync('supabase/migrations/20260929120000_cf7_expense_receipt_storage.sql', 'utf8');
    expect(migration).toMatch(/INSERT INTO public\.financial_account_movements[\s\S]*?-v_amount/);
    expect(migration).toMatch(/v_existing_tx[\s\S]*?'idempotentReplay', true/);
  });
});
