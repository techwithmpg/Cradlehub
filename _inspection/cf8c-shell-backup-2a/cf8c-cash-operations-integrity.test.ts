import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

const modal = readFileSync(
  join(root, 'src/components/features/cash-flow/record-financial-entry-modal.tsx'),
  'utf8'
);

const workspace = readFileSync(
  join(root, 'src/components/features/cash-flow/cash-flow-workspace.tsx'),
  'utf8'
);

const actions = readFileSync(
  join(root, 'src/lib/cash-flow/cash-flow-actions.ts'),
  'utf8'
);

const migration = readFileSync(
  join(
    root,
    'supabase/migrations/20260930083000_cf8c_cash_operations_integrity.sql'
  ),
  'utf8'
);

describe('CF8-C cash operations integrity', () => {
  it('passes active cash sessions into the financial entry modal', () => {
    expect(workspace).toContain(
      'activeCashSessions={initialData.cashSessions?.activeSessions ?? []}'
    );

    expect(modal).toContain('activeCashSessions?: CashSessionSummary[]');
    expect(modal).toContain('activeCashSessionsForDate');
    expect(modal).toContain('openCashDrawerIds');
  });

  it('requires an open drawer for physical cash adjustments in UI state', () => {
    expect(modal).toContain(
      'Open the cash drawer before recording physical cash operations.'
    );

    expect(modal).toContain(
      "!openCashDrawerIds.has(cashDrawerId)"
    );

    expect(modal).toContain('cashAdjustmentBlocked');
  });

  it('requires an adjustment reason', () => {
    expect(modal).toContain(
      'A reason is required for every cash adjustment.'
    );

    expect(modal).toContain('!cashAdjustmentReason.trim()');
  });

  it('does not describe safe drop as cash removal', () => {
    expect(modal).not.toContain('Mid-day safe drop deposit');

    expect(modal).toContain(
      'Cash Removal as a substitute for a safe drop.'
    );
  });

  it('shows expected drawer cash before and after a cash adjustment', () => {
    expect(modal).toContain('selectedCashSession.expectedCash');
    expect(modal).toContain('expectedCashAfterAdjustment');
    expect(modal).toContain('Expected drawer cash now');
    expect(modal).toContain('Expected after operation');
  });

  it('blocks transfer when no real destination account exists', () => {
    expect(modal).toContain('transferDestinationOptions.length === 0');

    expect(modal).toContain(
      'Transfer / Safe Drop is unavailable until a real'
    );

    expect(modal).toContain('transferBlocked');
  });

  it('does not allow transfer source and destination to be identical', () => {
    expect(modal).toContain(
      'transferSourceAccountId === transferDestAccountId'
    );

    expect(modal).toContain(
      'Source and destination accounts must be different.'
    );
  });

  it('passes branch context to the cash operation server action', () => {
    expect(modal).toMatch(
      /recordOtherEntryAction\(\{\s*branchId,\s*entryType: otherEntryType/
    );
  });

  it('uses stable retry idempotency for other entries', () => {
    expect(modal).toContain('otherEntryAttemptRef');
    expect(modal).toContain('otherEntrySignature');
    expect(modal).toContain('idempotencyKey: otherEntryIdempotencyKey');

    expect(modal).not.toContain(
      'idempotencyKey: `cf6_other_${Date.now()}_'
    );
  });

  it('server action verifies an open cash session before cash adjustment', () => {
    expect(actions).toContain('requireOpenCashSessionForDrawer');

    expect(actions).toContain(
      "error: 'CASH_SESSION_REQUIRED: Open the cash drawer before recording physical cash operations.'"
    );

    const adjustmentCallIndex = actions.indexOf(
      "rpc('post_cash_adjustment_atomic'"
    );

    const adjustmentGuardIndex = actions.lastIndexOf(
      'requireOpenCashSessionForDrawer',
      adjustmentCallIndex
    );

    expect(adjustmentGuardIndex).toBeGreaterThan(-1);
    expect(adjustmentGuardIndex).toBeLessThan(adjustmentCallIndex);
  });

  it('server action checks drawer sessions for transfers touching a drawer', () => {
    expect(actions).toContain(
      "account.account_type !== 'cash_drawer'"
    );

    expect(actions).toContain(
      'requireOpenCashSessionForDrawer'
    );

    expect(actions).toContain(
      "rpc('post_transfer_atomic'"
    );
  });

  it('database cash adjustment RPC requires an open matching cash session', () => {
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.post_cash_adjustment_atomic'
    );

    expect(migration).toContain(
      'FROM public.cash_sessions cs'
    );

    expect(migration).toContain(
      'cs.cash_drawer_account_id = v_account.id'
    );

    expect(migration).toContain(
      "cs.status = 'open'"
    );

    expect(migration).toContain(
      'CASH_SESSION_REQUIRED: Open the cash drawer before recording physical cash operations'
    );
  });

  it('database transfer RPC requires open sessions for any drawer it touches', () => {
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.post_transfer_atomic'
    );

    expect(migration).toContain(
      "v_src_account.account_type = 'cash_drawer'"
    );

    expect(migration).toContain(
      "v_dst_account.account_type = 'cash_drawer'"
    );

    expect(migration).toContain(
      'cs.cash_drawer_account_id = v_src_account.id'
    );

    expect(migration).toContain(
      'cs.cash_drawer_account_id = v_dst_account.id'
    );
  });

  it('enforces PHP-only cash operations', () => {
    expect(migration).toContain(
      "v_account.currency IS DISTINCT FROM 'PHP'"
    );

    expect(migration).toContain(
      "v_src_account.currency IS DISTINCT FROM 'PHP'"
    );

    expect(migration).toContain(
      "v_dst_account.currency IS DISTINCT FROM 'PHP'"
    );

    expect(migration).toContain('UNSUPPORTED_CURRENCY');
  });

  it('detects changed-payload reuse of an idempotency key', () => {
    expect(migration).toContain('IDEMPOTENCY_CONFLICT');

    expect(migration).toContain(
      'Key was already used for a different cash adjustment'
    );

    expect(migration).toContain(
      'Key was already used for a different transfer'
    );
  });

  it('keeps transfers net-zero and separate from revenue/expense semantics', () => {
    expect(migration).toContain(
      'v_src_account.id,\n    -v_amount'
    );

    expect(migration).toContain(
      'v_dst_account.id,\n    v_amount'
    );

    expect(migration).toContain(
      "'netEffect', 0.00"
    );
  });

  it('preserves the security-definer boundary', () => {
    const securityDefinerCount =
      migration.match(/SECURITY DEFINER/g)?.length ?? 0;

    const pinnedSearchPathCount =
      migration.match(/SET search_path = ''/g)?.length ?? 0;

    expect(securityDefinerCount).toBe(2);
    expect(pinnedSearchPathCount).toBe(2);

    expect(migration).toContain(
      'FROM PUBLIC, anon'
    );

    expect(migration).toContain(
      'TO authenticated, service_role'
    );
  });

  it('does not rewrite historical authority or day-close tables', () => {
    expect(migration).not.toContain(
      'ALTER TABLE public.daily_cash_reconciliations'
    );

    expect(migration).not.toContain(
      'DROP TABLE public.daily_cash_reconciliations'
    );

    expect(migration).not.toContain(
      'DELETE FROM public.financial_transactions'
    );

    expect(migration).not.toContain(
      'UPDATE public.financial_transactions'
    );
  });
});