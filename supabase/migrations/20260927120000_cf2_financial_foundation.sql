-- =============================================================================
-- CF2: Financial Accounts + Canonical Transaction & Movement Foundation
-- =============================================================================
-- Stage: CF2 — FINANCIAL ACCOUNTS + CANONICAL TRANSACTION FOUNDATION
-- Program: CradleHub Web — CONTROLLED STABILIZATION
-- Authoritative Contract: CradleHub_CF1_Financial_Contract_Freeze.md
--
-- Entities Introduced:
--   1. public.financial_accounts (Relational physical & digital account catalog)
--   2. public.financial_transactions (Single canonical event identity header)
--   3. public.financial_account_movements (Authoritative signed monetary movements)
--   4. public.v_financial_accounts (Safe masked front-desk read view, security_invoker = true)
--
-- Security & Operational Architecture:
--   - Strict signed amount convention: + enters account, - leaves account, 0 prohibited.
--   - Transaction header is business context/identity; movement rows are monetary truth.
--   - Immutability: Committed transactions and movements are append-only.
--   - RLS enabled: Deny-by-default direct write access for authenticated users;
--     writes will be handled via dedicated atomic transactional RPCs in later stages.
--   - Branch isolation: CSRs and Managers access only branch-scoped accounts/transactions;
--     Owners and Finance hold cross-branch read visibility.
-- =============================================================================

BEGIN;

-- ─── 0. EXTENSIONS & PREFLIGHT CHECKS ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $preflight$
BEGIN
  -- Verify core prerequisite tables exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'branches'
  ) THEN
    RAISE EXCEPTION 'MIGRATION_HALT: public.branches does not exist.'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'staff'
  ) THEN
    RAISE EXCEPTION 'MIGRATION_HALT: public.staff does not exist.'
      USING ERRCODE = '55000';
  END IF;
END;
$preflight$;


-- ─── 1. TABLE: financial_accounts ─────────────────────────────────────────────
-- Relational catalog representing physical drawers, digital wallets, bank accounts,
-- and card terminals.
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id           UUID          REFERENCES public.branches(id) ON DELETE RESTRICT,
  name                TEXT          NOT NULL,
  account_type        TEXT          NOT NULL
                                    CHECK (account_type IN (
                                      'cash_drawer',
                                      'gcash',
                                      'maya',
                                      'bank_transfer',
                                      'card_terminal'
                                    )),
  identifier_mask     TEXT          NOT NULL,
  currency            TEXT          NOT NULL DEFAULT 'PHP'
                                    CHECK (currency = 'PHP'),
  is_active           BOOLEAN       NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.financial_accounts IS
  'Catalog of physical and digital accounts (cash drawers, GCash, Maya, Bank, Card terminals).';
COMMENT ON COLUMN public.financial_accounts.branch_id IS
  'Branch ownership; NULL denotes corporate/HQ level financial account.';
COMMENT ON COLUMN public.financial_accounts.identifier_mask IS
  'Safe display identifier for front-desk staff (e.g. *1234 or 0917-***-5678).';


-- ─── 2. TABLE: financial_transactions ─────────────────────────────────────────
-- Single canonical financial event identity header.
-- Contains business metadata, operating business date, and idempotency key.
-- Contains NO independent mutable monetary amount.
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id                          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id                   UUID          NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  transaction_type            TEXT          NOT NULL
                                            CHECK (transaction_type IN (
                                              'customer_payment',
                                              'customer_refund',
                                              'customer_deposit',
                                              'operational_expense',
                                              'cash_adjustment',
                                              'tip_collection',
                                              'tip_disbursement',
                                              'payroll_disbursement',
                                              'voucher_sale',
                                              'voucher_redemption',
                                              'retail_sale',
                                              'other_income'
                                            )),
  business_date               DATE          NOT NULL,
  occurred_at                 TIMESTAMPTZ   NOT NULL,
  recorded_at                 TIMESTAMPTZ   NOT NULL DEFAULT now(),
  recorded_by                 UUID          NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  currency                    TEXT          NOT NULL DEFAULT 'PHP'
                                            CHECK (currency = 'PHP'),
  status                      TEXT          NOT NULL DEFAULT 'posted'
                                            CHECK (status IN ('posted', 'reversed', 'voided')),
  idempotency_key             TEXT          NOT NULL UNIQUE,
  source_type                 TEXT          CHECK (source_type IS NULL OR source_type IN (
                                              'booking_order',
                                              'cash_session',
                                              'payroll_run',
                                              'retail_sale',
                                              'legacy_booking'
                                            )),
  source_id                   TEXT          NULL,
  external_reference          TEXT          NULL,
  reversal_of_transaction_id  UUID          NULL REFERENCES public.financial_transactions(id) ON DELETE RESTRICT,
  notes                       TEXT          NULL,
  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT check_financial_transaction_no_self_reversal
    CHECK (reversal_of_transaction_id IS NULL OR reversal_of_transaction_id <> id)
);

COMMENT ON TABLE public.financial_transactions IS
  'Single canonical financial transaction event identity header.';
COMMENT ON COLUMN public.financial_transactions.idempotency_key IS
  'Unique idempotency key ensuring replay suppression and retry safety.';
COMMENT ON COLUMN public.financial_transactions.reversal_of_transaction_id IS
  'Self-referencing link to the original transaction if this record is a corrective reversal or refund.';


-- ─── 3. TABLE: financial_account_movements ────────────────────────────────────
-- Sole monetary authority in CF2. Records individual signed inflows/outflows
-- on specific financial accounts.
CREATE TABLE IF NOT EXISTS public.financial_account_movements (
  id                    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id        UUID            NOT NULL REFERENCES public.financial_transactions(id) ON DELETE RESTRICT,
  financial_account_id  UUID            NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
  amount                NUMERIC(12,2)   NOT NULL,
  payment_method        TEXT            NOT NULL
                                        CHECK (payment_method IN (
                                          'cash',
                                          'gcash',
                                          'maya',
                                          'bank_transfer',
                                          'card'
                                        )),
  external_reference    TEXT            NULL,
  created_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),
  CONSTRAINT check_financial_account_movement_non_zero
    CHECK (amount <> 0)
);

COMMENT ON TABLE public.financial_account_movements IS
  'Authoritative signed monetary movements on financial accounts (+ = enters account, - = leaves account).';
COMMENT ON COLUMN public.financial_account_movements.amount IS
  'Signed monetary value (+ = inflow, - = outflow). Zero is strictly prohibited.';


-- ─── 4. SAFE MASKED FRONT-DESK VIEW ───────────────────────────────────────────
-- Caller-RLS respecting view for front desk and CRM interfaces.
CREATE OR REPLACE VIEW public.v_financial_accounts
WITH (security_invoker = true)
AS
SELECT
  fa.id,
  fa.branch_id,
  fa.name,
  fa.account_type,
  fa.identifier_mask,
  fa.currency,
  fa.is_active,
  fa.created_at
FROM public.financial_accounts fa;

COMMENT ON VIEW public.v_financial_accounts IS
  'Safe view of financial accounts exposing masked identifiers with caller security (security_invoker = true).';


-- ─── 5. IMMUTABILITY SAFEGUARDS (APPEND-ONLY ENFORCEMENT) ─────────────────────
-- Trigger function prohibiting updates or deletions of committed financial history.
CREATE OR REPLACE FUNCTION public.enforce_financial_ledger_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Allow bypass only if explicitly authorized via a session-local config (e.g. for emergency maintenance by superusers)
  IF current_setting('cradlehub.allow_financial_mutation', true) = 'true' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'FINANCIAL_IMMUTABILITY_VIOLATION: Committed financial transactions and movements are append-only. Destructive % is prohibited.', TG_OP
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_financial_transactions_immutability ON public.financial_transactions;
CREATE TRIGGER trg_protect_financial_transactions_immutability
  BEFORE UPDATE OR DELETE ON public.financial_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_financial_ledger_immutability();

DROP TRIGGER IF EXISTS trg_protect_financial_account_movements_immutability ON public.financial_account_movements;
CREATE TRIGGER trg_protect_financial_account_movements_immutability
  BEFORE UPDATE OR DELETE ON public.financial_account_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_financial_ledger_immutability();


-- ─── 6. PERFORMANCE & INTEGRITY INDEXES ───────────────────────────────────────
-- Indexes on financial_accounts
CREATE INDEX IF NOT EXISTS idx_financial_accounts_branch_id
  ON public.financial_accounts (branch_id);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_type
  ON public.financial_accounts (account_type);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_branch_active
  ON public.financial_accounts (branch_id, is_active);

-- Indexes on financial_transactions
CREATE INDEX IF NOT EXISTS idx_financial_transactions_branch_business_date
  ON public.financial_transactions (branch_id, business_date);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_occurred_at
  ON public.financial_transactions (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_recorded_at
  ON public.financial_transactions (recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_type
  ON public.financial_transactions (transaction_type);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_reversal
  ON public.financial_transactions (reversal_of_transaction_id)
  WHERE reversal_of_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_source
  ON public.financial_transactions (source_type, source_id)
  WHERE source_type IS NOT NULL;

-- Indexes on financial_account_movements
CREATE INDEX IF NOT EXISTS idx_financial_movements_transaction_id
  ON public.financial_account_movements (transaction_id);

CREATE INDEX IF NOT EXISTS idx_financial_movements_account_id
  ON public.financial_account_movements (financial_account_id);

CREATE INDEX IF NOT EXISTS idx_financial_movements_payment_method
  ON public.financial_account_movements (payment_method);

CREATE INDEX IF NOT EXISTS idx_financial_movements_created_at
  ON public.financial_account_movements (created_at DESC);


-- ─── 7. ROW LEVEL SECURITY (RLS) POLICIES ─────────────────────────────────────
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_account_movements ENABLE ROW LEVEL SECURITY;

-- ─── A. financial_accounts Policies ───
-- Owner & Finance: Full read access to all accounts
DROP POLICY IF EXISTS "financial_accounts_owner_read_all" ON public.financial_accounts;
CREATE POLICY "financial_accounts_owner_read_all"
  ON public.financial_accounts FOR SELECT
  TO authenticated
  USING (public.get_auth_role() = 'owner');

-- Branch Management & Front Desk: Read accounts assigned to own branch or corporate accounts (branch_id IS NULL)
DROP POLICY IF EXISTS "financial_accounts_branch_read" ON public.financial_accounts;
CREATE POLICY "financial_accounts_branch_read"
  ON public.financial_accounts FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('manager', 'assistant_manager', 'store_manager', 'crm')
    AND (branch_id = public.get_auth_branch_id() OR branch_id IS NULL)
  );

-- Owner: Management of financial accounts
DROP POLICY IF EXISTS "financial_accounts_owner_manage" ON public.financial_accounts;
CREATE POLICY "financial_accounts_owner_manage"
  ON public.financial_accounts FOR ALL
  TO authenticated
  USING (public.get_auth_role() = 'owner')
  WITH CHECK (public.get_auth_role() = 'owner');

-- Service Role: Full access
DROP POLICY IF EXISTS "financial_accounts_service_role_all" ON public.financial_accounts;
CREATE POLICY "financial_accounts_service_role_all"
  ON public.financial_accounts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ─── B. financial_transactions Policies ───
-- Owner & Finance: Full cross-branch read access
DROP POLICY IF EXISTS "financial_transactions_owner_read_all" ON public.financial_transactions;
CREATE POLICY "financial_transactions_owner_read_all"
  ON public.financial_transactions FOR SELECT
  TO authenticated
  USING (public.get_auth_role() = 'owner');

-- Branch Staff & Management: Read transactions strictly for own branch
DROP POLICY IF EXISTS "financial_transactions_branch_read" ON public.financial_transactions;
CREATE POLICY "financial_transactions_branch_read"
  ON public.financial_transactions FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('manager', 'assistant_manager', 'store_manager', 'crm')
    AND branch_id = public.get_auth_branch_id()
  );

-- Service Role: Full access for trusted server actions and RPCs
DROP POLICY IF EXISTS "financial_transactions_service_role_all" ON public.financial_transactions;
CREATE POLICY "financial_transactions_service_role_all"
  ON public.financial_transactions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ─── C. financial_account_movements Policies ───
-- Owner & Finance: Full cross-branch read access
DROP POLICY IF EXISTS "financial_movements_owner_read_all" ON public.financial_account_movements;
CREATE POLICY "financial_movements_owner_read_all"
  ON public.financial_account_movements FOR SELECT
  TO authenticated
  USING (public.get_auth_role() = 'owner');

-- Branch Staff & Management: Read movements belonging to transactions in own branch
DROP POLICY IF EXISTS "financial_movements_branch_read" ON public.financial_account_movements;
CREATE POLICY "financial_movements_branch_read"
  ON public.financial_account_movements FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('manager', 'assistant_manager', 'store_manager', 'crm')
    AND EXISTS (
      SELECT 1 FROM public.financial_transactions ft
      WHERE ft.id = financial_account_movements.transaction_id
        AND ft.branch_id = public.get_auth_branch_id()
    )
  );

-- Service Role: Full access for trusted server actions and RPCs
DROP POLICY IF EXISTS "financial_movements_service_role_all" ON public.financial_account_movements;
CREATE POLICY "financial_movements_service_role_all"
  ON public.financial_account_movements FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ─── 8. EXPLICIT GRANTS & REVOKES ─────────────────────────────────────────────
REVOKE ALL ON TABLE public.financial_accounts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.financial_accounts TO authenticated;
GRANT ALL ON TABLE public.financial_accounts TO service_role;

REVOKE ALL ON TABLE public.financial_transactions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.financial_transactions TO authenticated;
GRANT ALL ON TABLE public.financial_transactions TO service_role;

REVOKE ALL ON TABLE public.financial_account_movements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.financial_account_movements TO authenticated;
GRANT ALL ON TABLE public.financial_account_movements TO service_role;

REVOKE ALL ON TABLE public.v_financial_accounts FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.v_financial_accounts TO authenticated, service_role;

COMMIT;
