import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

const modal = readFileSync(
  join(root, 'src/components/features/cash-flow/record-financial-entry-modal.tsx'),
  'utf8'
);

const queries = readFileSync(
  join(root, 'src/lib/cash-flow/cash-flow-queries.ts'),
  'utf8'
);

const forwardMigration = readFileSync(
  join(
    root,
    'supabase/migrations/20260930100000_cf8c_cash_operations_review_corrections.sql'
  ),
  'utf8'
);

const appliedMigration = readFileSync(
  join(
    root,
    'supabase/migrations/20260930083000_cf8c_cash_operations_integrity.sql'
  ),
  'utf8'
);

describe('CF8-C independent-review corrections', () => {
  it('labels canonical cash operations distinctly in the ledger', () => {
    expect(queries).toContain('const isCanonicalTransfer =');
    expect(queries).toContain("movements.length === 2");
    expect(queries).toContain("? 'Transfer'");
    expect(queries).toContain("? 'Cash Addition'");
    expect(queries).toContain(": 'Cash Removal'");
    expect(queries).toContain(": 'Adjustment'");
  });

  it('fails explicitly when the authoritative cash-session read fails', () => {
    expect(queries).toContain("throw new CashFlowRequiredDataError('cash_sessions')");
    expect(queries).not.toContain(
      `} catch {
    rawSessions = [];
  }`
    );
  });

  it('does not advertise generic transfers as Safe Drops', () => {
    expect(modal).not.toContain('Transfer / Safe Drop');
    expect(modal).toContain('Transfer is unavailable until a real');
    expect(modal).toContain(
      'Cash Removal as a substitute for a safe drop.'
    );
  });

  it('adds transaction-scoped serialization before keyed adjustment replay lookup', () => {
    const adjustment = forwardMigration.slice(
      forwardMigration.indexOf(
        'CREATE OR REPLACE FUNCTION public.post_cash_adjustment_atomic('
      ),
      forwardMigration.indexOf(
        'CREATE OR REPLACE FUNCTION public.post_transfer_atomic('
      )
    );

    const lock = adjustment.indexOf(
      "pg_advisory_xact_lock("
    );

    const lookup = adjustment.indexOf(
      'WHERE idempotency_key = TRIM(p_idempotency_key)'
    );

    expect(lock).toBeGreaterThan(-1);
    expect(lookup).toBeGreaterThan(lock);
    expect(adjustment).toContain(
      "idem_cf8c_cash_operation_"
    );
  });

  it('adds transaction-scoped serialization before keyed transfer replay lookup', () => {
    const transfer = forwardMigration.slice(
      forwardMigration.indexOf(
        'CREATE OR REPLACE FUNCTION public.post_transfer_atomic('
      )
    );

    const lock = transfer.indexOf(
      "pg_advisory_xact_lock("
    );

    const lookup = transfer.indexOf(
      'WHERE idempotency_key = TRIM(p_idempotency_key)'
    );

    expect(lock).toBeGreaterThan(-1);
    expect(lookup).toBeGreaterThan(lock);
    expect(transfer).toContain(
      "idem_cf8c_cash_operation_"
    );
  });

  it('serializes the global cash-operation idempotency domain with one shared lock namespace', () => {
    expect(
      forwardMigration.match(/idem_cf8c_cash_operation_/g)?.length
    ).toBe(2);

    expect(forwardMigration).not.toContain(
      'idem_cf8c_cash_adjustment_'
    );

    expect(forwardMigration).not.toContain(
      'idem_cf8c_transfer_'
    );
  });

  it('rejects sub-cent adjustment and transfer values rather than silently rounding', () => {
    expect(
      forwardMigration.match(/AMOUNT_PRECISION_INVALID/g)?.length
    ).toBe(2);

    expect(forwardMigration).toContain(
      'Cash adjustment amount must use at most two decimal places'
    );

    expect(forwardMigration).toContain(
      'Transfer amount must use at most two decimal places'
    );
  });

  it('preserves the security-definer and pinned-search-path boundary', () => {
    expect(
      forwardMigration.match(/SECURITY DEFINER/g)?.length
    ).toBe(2);

    expect(
      forwardMigration.match(/SET search_path = ''/g)?.length
    ).toBe(2);

    expect(forwardMigration).toContain(
      'FROM PUBLIC, anon'
    );

    expect(forwardMigration).toContain(
      'TO authenticated, service_role'
    );
  });

  it('keeps the already-applied CF8-C migration as historical repository authority', () => {
    expect(appliedMigration).not.toContain(
      'idem_cf8c_cash_adjustment_'
    );

    expect(appliedMigration).not.toContain(
      'idem_cf8c_transfer_'
    );

    expect(appliedMigration).not.toContain(
      'AMOUNT_PRECISION_INVALID'
    );
  });

  it('does not introduce day-close or historical financial rewrites', () => {
    expect(forwardMigration).not.toContain(
      'ALTER TABLE public.daily_cash_reconciliations'
    );

    expect(forwardMigration).not.toContain(
      'DELETE FROM public.financial_transactions'
    );

    expect(forwardMigration).not.toContain(
      'UPDATE public.financial_transactions'
    );
  });
});
