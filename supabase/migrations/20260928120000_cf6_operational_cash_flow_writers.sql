-- =============================================================================
-- CF6: Operational Cash Flow Writers & Child Schemas
-- =============================================================================
-- Stage: CF6 — OPERATIONAL CASH FLOW WIRING
-- Program: CradleHub Web — CONTROLLED STABILIZATION
-- Authoritative Contract: CradleHub_CF1_Financial_Contract_Freeze.md
-- Depends On:
--   - 20260927120000_cf2_financial_foundation.sql
--   - 20260927130000_cf3_order_payables_allocations.sql
--   - 20260927140000_cf4_atomic_payment_writer.sql
--
-- Entities / Functions Introduced:
--   1. public.financial_expense_categories (Taxonomy catalog for business expenses)
--   2. public.financial_expense_details (Child explanation of expense transactions)
--   3. public.financial_tip_details (Direct cash vs. company-custodied tip ledger)
--   4. public.financial_commercial_details (Commercial income: misc income, retail sale)
--   5. public.post_expense_atomic(...)
--   6. public.post_tip_atomic(...)
--   7. public.post_misc_income_atomic(...)
--   8. public.post_cash_adjustment_atomic(...)
--   9. public.post_transfer_atomic(...)
-- =============================================================================

BEGIN;

-- ─── PREFLIGHT CHECKS ────────────────────────────────────────────────────────
DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'financial_transactions'
  ) THEN
    RAISE EXCEPTION 'MIGRATION_HALT: public.financial_transactions does not exist.'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'financial_account_movements'
  ) THEN
    RAISE EXCEPTION 'MIGRATION_HALT: public.financial_account_movements does not exist.'
      USING ERRCODE = '55000';
  END IF;
END;
$preflight$;


-- ─── 1. EXPENSE CATEGORIES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financial_expense_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.financial_expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated staff to read expense categories"
  ON public.financial_expense_categories
  FOR SELECT
  TO authenticated
  USING (true);

-- Seed initial standard operating categories (CF1-D08)
INSERT INTO public.financial_expense_categories (code, name, description, display_order)
VALUES
  ('fuel', 'Fuel & Transportation', 'Driver fare, gas, delivery and travel operating expenses', 10),
  ('supplies', 'Spa Supplies & Materials', 'Massage oils, linens, consumables, hygiene supplies', 20),
  ('laundry', 'Laundry Services', 'Linen and towel cleaning services', 30),
  ('utilities', 'Water & Utilities', 'Electricity, mineral water, office utilities', 40),
  ('staff_allowance', 'Staff Allowance & Meals', 'Duty allowances, overtime meals, pantry items', 50),
  ('maintenance', 'Repairs & Maintenance', 'Facility repairs, equipment maintenance, sanitation', 60),
  ('telecom', 'Telecom & Internet', 'Mobile loads, broadband connectivity', 70),
  ('services', 'Business Services', 'Professional services, garbage collection, permits', 80),
  ('other', 'Other Operating Expense', 'Miscellaneous verified operational expenses', 99)
ON CONFLICT (code) DO NOTHING;


-- ─── 2. EXPENSE DETAILS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financial_expense_details (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id          UUID NOT NULL REFERENCES public.financial_transactions(id) ON DELETE RESTRICT,
  category_id             UUID NOT NULL REFERENCES public.financial_expense_categories(id) ON DELETE RESTRICT,
  payee                   TEXT NOT NULL,
  description             TEXT NOT NULL,
  receipt_reference       TEXT,
  receipt_image_url       TEXT,
  approval_status         TEXT NOT NULL DEFAULT 'approved_instant' CHECK (approval_status IN ('approved_instant', 'pending_approval', 'approved', 'rejected')),
  approved_by             UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  related_booking_order_id UUID REFERENCES public.booking_orders(id) ON DELETE SET NULL,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.financial_expense_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated staff to read expense details"
  ON public.financial_expense_details
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.financial_transactions ft
    JOIN public.staff s ON s.auth_user_id = (SELECT auth.uid()) AND s.is_active = true
    WHERE ft.id = transaction_id
      AND (s.system_role = 'owner' OR s.branch_id = ft.branch_id)
  ));

CREATE INDEX IF NOT EXISTS idx_cf_expense_details_tx ON public.financial_expense_details(transaction_id);
CREATE INDEX IF NOT EXISTS idx_cf_expense_details_category ON public.financial_expense_details(category_id);
CREATE INDEX IF NOT EXISTS idx_cf_expense_details_created ON public.financial_expense_details(created_at);


-- ─── 3. TIP DETAILS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financial_tip_details (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id          UUID NOT NULL REFERENCES public.financial_transactions(id) ON DELETE RESTRICT,
  beneficiary_staff_id    UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  tip_amount              NUMERIC(12,2) NOT NULL CHECK (tip_amount > 0),
  custody_type            TEXT NOT NULL CHECK (custody_type IN ('direct_cash', 'company_custodied')),
  payout_status           TEXT NOT NULL DEFAULT 'pending_disbursement' CHECK (payout_status IN ('not_applicable', 'pending_disbursement', 'disbursed')),
  payout_transaction_id   UUID REFERENCES public.financial_transactions(id) ON DELETE RESTRICT,
  related_booking_order_id UUID REFERENCES public.booking_orders(id) ON DELETE SET NULL,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.financial_tip_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated staff to read tip details"
  ON public.financial_tip_details
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.financial_transactions ft
    JOIN public.staff s ON s.auth_user_id = (SELECT auth.uid()) AND s.is_active = true
    WHERE ft.id = transaction_id
      AND (s.system_role = 'owner' OR s.branch_id = ft.branch_id)
  ));

CREATE INDEX IF NOT EXISTS idx_cf_tip_details_tx ON public.financial_tip_details(transaction_id);
CREATE INDEX IF NOT EXISTS idx_cf_tip_details_staff ON public.financial_tip_details(beneficiary_staff_id);
CREATE INDEX IF NOT EXISTS idx_cf_tip_details_custody ON public.financial_tip_details(custody_type);


-- ─── 4. COMMERCIAL DETAILS (NON-BOOKING COMMERCIAL REVENUE: CF1-D15) ─────────
CREATE TABLE IF NOT EXISTS public.financial_commercial_details (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID NOT NULL REFERENCES public.financial_transactions(id) ON DELETE RESTRICT,
  commercial_type TEXT NOT NULL CHECK (commercial_type IN ('misc_income', 'retail_sale')),
  description     TEXT NOT NULL,
  payee_source    TEXT,
  reference       TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.financial_commercial_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated staff to read commercial details"
  ON public.financial_commercial_details
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.financial_transactions ft
    JOIN public.staff s ON s.auth_user_id = (SELECT auth.uid()) AND s.is_active = true
    WHERE ft.id = transaction_id
      AND (s.system_role = 'owner' OR s.branch_id = ft.branch_id)
  ));

CREATE INDEX IF NOT EXISTS idx_cf_commercial_details_tx ON public.financial_commercial_details(transaction_id);


-- ─── 5. RPC: post_expense_atomic ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_expense_atomic(
  p_branch_id            UUID,
  p_idempotency_key      TEXT,
  p_amount               NUMERIC,
  p_category_id          UUID,
  p_financial_account_id UUID,
  p_payee                TEXT,
  p_description          TEXT,
  p_receipt_reference    TEXT DEFAULT NULL,
  p_business_date        DATE DEFAULT NULL,
  p_notes                TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_auth_uid        UUID;
  v_staff           RECORD;
  v_account         RECORD;
  v_category        RECORD;
  v_existing_tx     RECORD;
  v_business_date   DATE;
  v_now             TIMESTAMPTZ := clock_timestamp();
  v_transaction_id  UUID;
  v_movement_id     UUID;
  v_expense_id      UUID;
  v_amount          NUMERIC(12,2);
BEGIN
  -- 1. Input sanity
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Expense amount must be greater than zero';
  END IF;
  v_amount := ROUND(p_amount::numeric, 2);

  IF p_category_id IS NULL THEN
    RAISE EXCEPTION 'CATEGORY_REQUIRED: Expense category is required';
  END IF;

  IF p_financial_account_id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNT_REQUIRED: Financial payment account is required';
  END IF;

  IF p_description IS NULL OR TRIM(p_description) = '' THEN
    RAISE EXCEPTION 'DESCRIPTION_REQUIRED: Expense description is required';
  END IF;

  -- 2. Actor authentication & authorization
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Authentication required to post expense';
  ELSE
    SELECT * INTO v_staff FROM public.staff WHERE auth_user_id = v_auth_uid AND is_active = true LIMIT 1;
    IF v_staff IS NULL THEN
      RAISE EXCEPTION 'STAFF_NOT_FOUND: Active staff record not found for authenticated user';
    END IF;
  END IF;

  -- Determine effective branch
  IF p_branch_id IS NULL THEN
    p_branch_id := v_staff.branch_id;
  END IF;

  IF p_branch_id IS NULL THEN
    RAISE EXCEPTION 'BRANCH_REQUIRED: Branch ID is required';
  END IF;

  IF v_staff.system_role NOT IN ('owner', 'manager', 'assistant_manager', 'store_manager', 'crm') THEN
    RAISE EXCEPTION 'EXPENSE_ROLE_UNAUTHORIZED: Caller cannot post expenses';
  END IF;
  IF v_staff.system_role <> 'owner' AND v_staff.branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH: Staff member is not authorized for branch %', p_branch_id;
  END IF;

  -- 3. Idempotency Check
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_tx FROM public.financial_transactions
    WHERE idempotency_key = TRIM(p_idempotency_key);
    
    IF v_existing_tx.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'transactionId', v_existing_tx.id,
        'idempotentReplay', true,
        'amount', v_amount
      );
    END IF;
  END IF;

  -- 4. Validate category
  SELECT * INTO v_category FROM public.financial_expense_categories
  WHERE id = p_category_id AND is_active = true;
  IF v_category.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_CATEGORY: Expense category does not exist or is inactive';
  END IF;

  -- 5. Validate financial account
  SELECT * INTO v_account FROM public.financial_accounts
  WHERE id = p_financial_account_id;
  IF v_account.id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: Financial account does not exist';
  END IF;
  IF NOT v_account.is_active THEN
    RAISE EXCEPTION 'ACCOUNT_INACTIVE: Financial account is inactive';
  END IF;
  IF v_account.branch_id IS NOT NULL AND v_account.branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'ACCOUNT_BRANCH_MISMATCH: Financial account does not belong to branch %', p_branch_id;
  END IF;

  -- 6. Business date
  v_business_date := COALESCE(p_business_date, CURRENT_DATE);

  -- 7. Insert Canonical Financial Transaction Header
  INSERT INTO public.financial_transactions (
    branch_id,
    transaction_type,
    business_date,
    occurred_at,
    recorded_at,
    recorded_by,
    currency,
    status,
    idempotency_key,
    source_type,
    source_id,
    external_reference,
    notes
  ) VALUES (
    p_branch_id,
    'operational_expense',
    v_business_date,
    v_now,
    v_now,
    v_staff.id,
    'PHP',
    'posted',
    p_idempotency_key,
    NULL, -- operating expense is independent of payroll and customer charges
    NULL,
    p_receipt_reference,
    p_notes
  ) RETURNING id INTO v_transaction_id;

  -- 8. Insert Negative Account Movement (Outflow = -amount per CF1-D08)
  INSERT INTO public.financial_account_movements (
    transaction_id,
    financial_account_id,
    amount,
    payment_method,
    external_reference,
    created_at
  ) VALUES (
    v_transaction_id,
    v_account.id,
    -v_amount, -- NEGATIVE SIGNED OUTFLOW
    CASE v_account.account_type
      WHEN 'cash_drawer' THEN 'cash'
      WHEN 'card_terminal' THEN 'card'
      ELSE v_account.account_type
    END,
    p_receipt_reference,
    v_now
  ) RETURNING id INTO v_movement_id;

  -- 9. Insert Expense Detail
  INSERT INTO public.financial_expense_details (
    transaction_id,
    category_id,
    payee,
    description,
    receipt_reference,
    approval_status,
    approved_by,
    notes,
    created_at
  ) VALUES (
    v_transaction_id,
    v_category.id,
    COALESCE(TRIM(p_payee), 'Direct Vendor'),
    TRIM(p_description),
    p_receipt_reference,
    'approved_instant',
    v_staff.id,
    p_notes,
    v_now
  ) RETURNING id INTO v_expense_id;

  -- 10. Return canonical result
  RETURN jsonb_build_object(
    'success', true,
    'transactionId', v_transaction_id,
    'movementId', v_movement_id,
    'expenseDetailId', v_expense_id,
    'amount', v_amount,
    'category', v_category.name,
    'account', v_account.name,
    'businessDate', v_business_date,
    'idempotentReplay', false
  );
END;
$func$;


-- ─── 6. RPC: post_tip_atomic ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_tip_atomic(
  p_branch_id            UUID,
  p_beneficiary_staff_id  UUID,
  p_custody_type         TEXT,
  p_amount               NUMERIC,
  p_financial_account_id UUID DEFAULT NULL,
  p_payment_method       TEXT DEFAULT 'cash',
  p_business_date        DATE DEFAULT NULL,
  p_notes                TEXT DEFAULT NULL,
  p_idempotency_key      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_auth_uid        UUID;
  v_staff           RECORD;
  v_beneficiary     RECORD;
  v_account         RECORD;
  v_existing_tx     RECORD;
  v_business_date   DATE;
  v_now             TIMESTAMPTZ := clock_timestamp();
  v_transaction_id  UUID;
  v_movement_id     UUID := NULL;
  v_tip_id          UUID;
  v_amount          NUMERIC(12,2);
BEGIN
  -- 1. Input sanity
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Tip amount must be greater than zero';
  END IF;
  v_amount := ROUND(p_amount::numeric, 2);

  IF p_beneficiary_staff_id IS NULL THEN
    RAISE EXCEPTION 'BENEFICIARY_REQUIRED: Beneficiary staff member is required';
  END IF;

  IF p_custody_type NOT IN ('direct_cash', 'company_custodied') THEN
    RAISE EXCEPTION 'INVALID_CUSTODY: Custody type must be direct_cash or company_custodied';
  END IF;

  -- 2. Actor authentication & authorization
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Authentication required to record tip';
  ELSE
    SELECT * INTO v_staff FROM public.staff WHERE auth_user_id = v_auth_uid AND is_active = true LIMIT 1;
    IF v_staff IS NULL THEN
      RAISE EXCEPTION 'STAFF_NOT_FOUND: Active staff record not found for authenticated user';
    END IF;
  END IF;

  -- Effective branch
  IF p_branch_id IS NULL THEN
    p_branch_id := v_staff.branch_id;
  END IF;

  IF v_staff.system_role NOT IN ('owner', 'manager', 'assistant_manager', 'store_manager', 'crm') THEN
    RAISE EXCEPTION 'TIP_ROLE_UNAUTHORIZED: Caller cannot record tips';
  END IF;
  IF v_staff.system_role <> 'owner' AND v_staff.branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH: Staff member is not authorized for branch %', p_branch_id;
  END IF;

  -- Validate beneficiary staff
  SELECT * INTO v_beneficiary FROM public.staff WHERE id = p_beneficiary_staff_id AND is_active = true;
  IF v_beneficiary.id IS NULL THEN
    RAISE EXCEPTION 'BENEFICIARY_NOT_FOUND: Active staff member not found for ID %', p_beneficiary_staff_id;
  END IF;

  IF v_beneficiary.branch_id IS NOT NULL AND p_branch_id IS NOT NULL AND v_beneficiary.branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'BENEFICIARY_BRANCH_MISMATCH: Beneficiary staff belongs to branch %, not %', v_beneficiary.branch_id, p_branch_id;
  END IF;

  -- 3. Idempotency Check
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_tx FROM public.financial_transactions
    WHERE idempotency_key = TRIM(p_idempotency_key);
    
    IF v_existing_tx.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'transactionId', v_existing_tx.id,
        'idempotentReplay', true,
        'amount', v_amount
      );
    END IF;
  END IF;

  v_business_date := COALESCE(p_business_date, CURRENT_DATE);

  -- 4. Insert Canonical Financial Transaction Header
  INSERT INTO public.financial_transactions (
    branch_id,
    transaction_type,
    business_date,
    occurred_at,
    recorded_at,
    recorded_by,
    currency,
    status,
    idempotency_key,
    notes
  ) VALUES (
    p_branch_id,
    'tip_collection',
    v_business_date,
    v_now,
    v_now,
    v_staff.id,
    'PHP',
    'posted',
    p_idempotency_key,
    p_notes
  ) RETURNING id INTO v_transaction_id;

  -- 5. Custody-dependent Money Movement (CF1-D09)
  IF p_custody_type = 'company_custodied' THEN
    IF p_financial_account_id IS NULL THEN
      RAISE EXCEPTION 'ACCOUNT_REQUIRED: Financial account is required for company-custodied tips';
    END IF;

    SELECT * INTO v_account FROM public.financial_accounts WHERE id = p_financial_account_id;
    IF v_account.id IS NULL THEN
      RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: Financial account does not exist';
    END IF;
    IF NOT v_account.is_active THEN
      RAISE EXCEPTION 'ACCOUNT_INACTIVE: Financial account is inactive';
    END IF;
    IF v_account.branch_id IS NOT NULL AND p_branch_id IS NOT NULL AND v_account.branch_id <> p_branch_id THEN
      RAISE EXCEPTION 'ACCOUNT_BRANCH_MISMATCH: Financial account belongs to branch %, not %', v_account.branch_id, p_branch_id;
    END IF;

    -- Positive inflow: company drawer/wallet holds the tip liability
    INSERT INTO public.financial_account_movements (
      transaction_id,
      financial_account_id,
      amount,
      payment_method,
      created_at
    ) VALUES (
      v_transaction_id,
      v_account.id,
      v_amount, -- POSITIVE INFLOW
      CASE 
        WHEN p_payment_method IN ('cash', 'gcash', 'maya', 'bank_transfer', 'card') THEN p_payment_method
        WHEN v_account.account_type = 'cash_drawer' THEN 'cash'
        WHEN v_account.account_type = 'card_terminal' THEN 'card'
        ELSE v_account.account_type
      END,
      v_now
    ) RETURNING id INTO v_movement_id;

    -- Tip detail: pending disbursement to staff
    INSERT INTO public.financial_tip_details (
      transaction_id,
      beneficiary_staff_id,
      tip_amount,
      custody_type,
      payout_status,
      notes,
      created_at
    ) VALUES (
      v_transaction_id,
      v_beneficiary.id,
      v_amount,
      'company_custodied',
      'pending_disbursement',
      p_notes,
      v_now
    ) RETURNING id INTO v_tip_id;
  ELSE
    -- Direct Cash Tip: zero company custody, zero account movement (CF1-D09)
    INSERT INTO public.financial_tip_details (
      transaction_id,
      beneficiary_staff_id,
      tip_amount,
      custody_type,
      payout_status,
      notes,
      created_at
    ) VALUES (
      v_transaction_id,
      v_beneficiary.id,
      v_amount,
      'direct_cash',
      'not_applicable',
      p_notes,
      v_now
    ) RETURNING id INTO v_tip_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'transactionId', v_transaction_id,
    'movementId', v_movement_id,
    'tipDetailId', v_tip_id,
    'amount', v_amount,
    'beneficiary', v_beneficiary.full_name,
    'custodyType', p_custody_type,
    'idempotentReplay', false
  );
END;
$func$;


-- ─── 7. RPC: post_misc_income_atomic ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_misc_income_atomic(
  p_branch_id            UUID,
  p_financial_account_id UUID,
  p_amount               NUMERIC,
  p_description          TEXT,
  p_payee_source         TEXT DEFAULT NULL,
  p_payment_method       TEXT DEFAULT 'cash',
  p_business_date        DATE DEFAULT NULL,
  p_notes                TEXT DEFAULT NULL,
  p_idempotency_key      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_auth_uid        UUID;
  v_staff           RECORD;
  v_account         RECORD;
  v_existing_tx     RECORD;
  v_business_date   DATE;
  v_now             TIMESTAMPTZ := clock_timestamp();
  v_transaction_id  UUID;
  v_movement_id     UUID;
  v_commercial_id   UUID;
  v_amount          NUMERIC(12,2);
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Income amount must be greater than zero';
  END IF;
  v_amount := ROUND(p_amount::numeric, 2);

  IF p_financial_account_id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNT_REQUIRED: Financial receiving account is required';
  END IF;

  IF p_description IS NULL OR TRIM(p_description) = '' THEN
    RAISE EXCEPTION 'DESCRIPTION_REQUIRED: Income description is required';
  END IF;

  -- Actor auth
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Authentication required to record misc income';
  ELSE
    SELECT * INTO v_staff FROM public.staff WHERE auth_user_id = v_auth_uid AND is_active = true LIMIT 1;
    IF v_staff IS NULL THEN
      RAISE EXCEPTION 'STAFF_NOT_FOUND: Active staff record not found for authenticated user';
    END IF;
  END IF;

  IF p_branch_id IS NULL THEN
    p_branch_id := v_staff.branch_id;
  END IF;

  IF v_staff.system_role NOT IN ('owner', 'manager', 'assistant_manager', 'store_manager', 'crm') THEN
    RAISE EXCEPTION 'INCOME_ROLE_UNAUTHORIZED: Caller cannot record income';
  END IF;
  IF v_staff.system_role <> 'owner' AND v_staff.branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH: Staff member is not authorized for branch %', p_branch_id;
  END IF;

  -- Idempotency
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_tx FROM public.financial_transactions
    WHERE idempotency_key = TRIM(p_idempotency_key);
    IF v_existing_tx.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'transactionId', v_existing_tx.id,
        'idempotentReplay', true,
        'amount', v_amount
      );
    END IF;
  END IF;

  SELECT * INTO v_account FROM public.financial_accounts WHERE id = p_financial_account_id;
  IF v_account.id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: Financial account does not exist';
  END IF;
  IF NOT v_account.is_active THEN
    RAISE EXCEPTION 'ACCOUNT_INACTIVE: Financial account is inactive';
  END IF;
  IF v_account.branch_id IS NOT NULL AND p_branch_id IS NOT NULL AND v_account.branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'ACCOUNT_BRANCH_MISMATCH: Financial account belongs to branch %, not %', v_account.branch_id, p_branch_id;
  END IF;

  v_business_date := COALESCE(p_business_date, CURRENT_DATE);

  -- Header: other_income
  INSERT INTO public.financial_transactions (
    branch_id,
    transaction_type,
    business_date,
    occurred_at,
    recorded_at,
    recorded_by,
    currency,
    status,
    idempotency_key,
    notes
  ) VALUES (
    p_branch_id,
    'other_income',
    v_business_date,
    v_now,
    v_now,
    v_staff.id,
    'PHP',
    'posted',
    p_idempotency_key,
    p_notes
  ) RETURNING id INTO v_transaction_id;

  -- Positive Inflow Movement
  INSERT INTO public.financial_account_movements (
    transaction_id,
    financial_account_id,
    amount,
    payment_method,
    created_at
  ) VALUES (
    v_transaction_id,
    v_account.id,
    v_amount, -- POSITIVE INFLOW
    CASE 
      WHEN p_payment_method IN ('cash', 'gcash', 'maya', 'bank_transfer', 'card') THEN p_payment_method
      WHEN v_account.account_type = 'cash_drawer' THEN 'cash'
      WHEN v_account.account_type = 'card_terminal' THEN 'card'
      ELSE v_account.account_type
    END,
    v_now
  ) RETURNING id INTO v_movement_id;

  -- Commercial Detail: misc_income (CF1-D15, no fake booking)
  INSERT INTO public.financial_commercial_details (
    transaction_id,
    commercial_type,
    description,
    payee_source,
    notes,
    created_at
  ) VALUES (
    v_transaction_id,
    'misc_income',
    TRIM(p_description),
    p_payee_source,
    p_notes,
    v_now
  ) RETURNING id INTO v_commercial_id;

  RETURN jsonb_build_object(
    'success', true,
    'transactionId', v_transaction_id,
    'movementId', v_movement_id,
    'amount', v_amount,
    'account', v_account.name,
    'idempotentReplay', false
  );
END;
$func$;


-- ─── 8. RPC: post_cash_adjustment_atomic ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_cash_adjustment_atomic(
  p_branch_id            UUID,
  p_financial_account_id UUID,
  p_adjustment_type      TEXT, -- 'addition' or 'removal'
  p_amount               NUMERIC,
  p_reason               TEXT,
  p_business_date        DATE DEFAULT NULL,
  p_notes                TEXT DEFAULT NULL,
  p_idempotency_key      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_auth_uid        UUID;
  v_staff           RECORD;
  v_account         RECORD;
  v_existing_tx     RECORD;
  v_business_date   DATE;
  v_now             TIMESTAMPTZ := clock_timestamp();
  v_transaction_id  UUID;
  v_movement_id     UUID;
  v_amount          NUMERIC(12,2);
  v_signed_amount   NUMERIC(12,2);
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Adjustment amount must be greater than zero';
  END IF;
  v_amount := ROUND(p_amount::numeric, 2);

  IF p_adjustment_type NOT IN ('addition', 'removal') THEN
    RAISE EXCEPTION 'INVALID_ADJUSTMENT_TYPE: Type must be addition or removal';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'REASON_REQUIRED: Reason for cash adjustment is required';
  END IF;

  -- Signed amount: addition is positive, removal is negative
  IF p_adjustment_type = 'addition' THEN
    v_signed_amount := v_amount;
  ELSE
    v_signed_amount := -v_amount;
  END IF;

  -- Actor auth
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Authentication required to adjust cash';
  ELSE
    SELECT * INTO v_staff FROM public.staff WHERE auth_user_id = v_auth_uid AND is_active = true LIMIT 1;
    IF v_staff IS NULL THEN
      RAISE EXCEPTION 'STAFF_NOT_FOUND: Active staff record not found for authenticated user';
    END IF;
  END IF;

  IF p_branch_id IS NULL THEN
    p_branch_id := v_staff.branch_id;
  END IF;

  IF v_staff.system_role NOT IN ('owner', 'manager', 'assistant_manager', 'store_manager', 'crm') THEN
    RAISE EXCEPTION 'CASH_ROLE_UNAUTHORIZED: Caller cannot adjust cash';
  END IF;
  IF v_staff.system_role <> 'owner' AND v_staff.branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH: Staff member is not authorized for branch %', p_branch_id;
  END IF;

  -- Idempotency
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_tx FROM public.financial_transactions
    WHERE idempotency_key = TRIM(p_idempotency_key);
    IF v_existing_tx.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'transactionId', v_existing_tx.id,
        'idempotentReplay', true,
        'amount', v_signed_amount
      );
    END IF;
  END IF;

  -- Account check: must be cash_drawer
  SELECT * INTO v_account FROM public.financial_accounts WHERE id = p_financial_account_id;
  IF v_account.id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: Financial account does not exist';
  END IF;
  IF NOT v_account.is_active THEN
    RAISE EXCEPTION 'ACCOUNT_INACTIVE: Financial account is inactive';
  END IF;
  IF v_account.account_type <> 'cash_drawer' THEN
    RAISE EXCEPTION 'CASH_DRAWER_REQUIRED: Cash adjustments can only be performed on cash_drawer accounts';
  END IF;
  IF v_account.branch_id IS NOT NULL AND p_branch_id IS NOT NULL AND v_account.branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'ACCOUNT_BRANCH_MISMATCH: Financial account belongs to branch %, not %', v_account.branch_id, p_branch_id;
  END IF;

  v_business_date := COALESCE(p_business_date, CURRENT_DATE);

  -- Header: cash_adjustment
  INSERT INTO public.financial_transactions (
    branch_id,
    transaction_type,
    business_date,
    occurred_at,
    recorded_at,
    recorded_by,
    currency,
    status,
    idempotency_key,
    notes
  ) VALUES (
    p_branch_id,
    'cash_adjustment',
    v_business_date,
    v_now,
    v_now,
    v_staff.id,
    'PHP',
    'posted',
    p_idempotency_key,
    TRIM(p_reason) || CASE WHEN p_notes IS NOT NULL AND TRIM(p_notes) <> '' THEN ' — ' || TRIM(p_notes) ELSE '' END
  ) RETURNING id INTO v_transaction_id;

  -- Signed Movement
  INSERT INTO public.financial_account_movements (
    transaction_id,
    financial_account_id,
    amount,
    payment_method,
    created_at
  ) VALUES (
    v_transaction_id,
    v_account.id,
    v_signed_amount,
    'cash',
    v_now
  ) RETURNING id INTO v_movement_id;

  RETURN jsonb_build_object(
    'success', true,
    'transactionId', v_transaction_id,
    'movementId', v_movement_id,
    'amount', v_signed_amount,
    'adjustmentType', p_adjustment_type,
    'idempotentReplay', false
  );
END;
$func$;


-- ─── 9. RPC: post_transfer_atomic ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_transfer_atomic(
  p_branch_id                UUID,
  p_source_account_id        UUID,
  p_destination_account_id   UUID,
  p_amount                   NUMERIC,
  p_business_date            DATE DEFAULT NULL,
  p_notes                    TEXT DEFAULT NULL,
  p_idempotency_key          TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_auth_uid        UUID;
  v_staff           RECORD;
  v_src_account     RECORD;
  v_dst_account     RECORD;
  v_existing_tx     RECORD;
  v_business_date   DATE;
  v_now             TIMESTAMPTZ := clock_timestamp();
  v_transaction_id  UUID;
  v_outflow_id      UUID;
  v_inflow_id       UUID;
  v_amount          NUMERIC(12,2);
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Transfer amount must be greater than zero';
  END IF;
  v_amount := ROUND(p_amount::numeric, 2);

  IF p_source_account_id IS NULL OR p_destination_account_id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNTS_REQUIRED: Both source and destination accounts are required';
  END IF;

  IF p_source_account_id = p_destination_account_id THEN
    RAISE EXCEPTION 'IDENTICAL_ACCOUNTS: Source and destination accounts cannot be identical';
  END IF;

  -- Actor auth
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Authentication required to perform transfer';
  ELSE
    SELECT * INTO v_staff FROM public.staff WHERE auth_user_id = v_auth_uid AND is_active = true LIMIT 1;
    IF v_staff IS NULL THEN
      RAISE EXCEPTION 'STAFF_NOT_FOUND: Active staff record not found for authenticated user';
    END IF;
  END IF;

  IF p_branch_id IS NULL THEN
    p_branch_id := v_staff.branch_id;
  END IF;

  IF v_staff.system_role NOT IN ('owner', 'manager', 'assistant_manager', 'store_manager', 'crm') THEN
    RAISE EXCEPTION 'TRANSFER_ROLE_UNAUTHORIZED: Caller cannot transfer funds';
  END IF;
  IF v_staff.system_role <> 'owner' AND v_staff.branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH: Staff member is not authorized for branch %', p_branch_id;
  END IF;

  -- Idempotency
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_tx FROM public.financial_transactions
    WHERE idempotency_key = TRIM(p_idempotency_key);
    IF v_existing_tx.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'transactionId', v_existing_tx.id,
        'idempotentReplay', true,
        'amount', v_amount
      );
    END IF;
  END IF;

  SELECT * INTO v_src_account FROM public.financial_accounts WHERE id = p_source_account_id;
  IF v_src_account.id IS NULL OR NOT v_src_account.is_active THEN
    RAISE EXCEPTION 'SOURCE_ACCOUNT_INVALID: Source account is invalid or inactive';
  END IF;
  IF v_src_account.branch_id IS NOT NULL AND p_branch_id IS NOT NULL AND v_src_account.branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'ACCOUNT_BRANCH_MISMATCH: Source account belongs to branch %, not %', v_src_account.branch_id, p_branch_id;
  END IF;

  SELECT * INTO v_dst_account FROM public.financial_accounts WHERE id = p_destination_account_id;
  IF v_dst_account.id IS NULL OR NOT v_dst_account.is_active THEN
    RAISE EXCEPTION 'DESTINATION_ACCOUNT_INVALID: Destination account is invalid or inactive';
  END IF;
  IF v_dst_account.branch_id IS NOT NULL AND p_branch_id IS NOT NULL AND v_dst_account.branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'ACCOUNT_BRANCH_MISMATCH: Destination account belongs to branch %, not %', v_dst_account.branch_id, p_branch_id;
  END IF;

  v_business_date := COALESCE(p_business_date, CURRENT_DATE);

  -- Header: cash_adjustment (transfer context)
  INSERT INTO public.financial_transactions (
    branch_id,
    transaction_type,
    business_date,
    occurred_at,
    recorded_at,
    recorded_by,
    currency,
    status,
    idempotency_key,
    notes
  ) VALUES (
    p_branch_id,
    'cash_adjustment',
    v_business_date,
    v_now,
    v_now,
    v_staff.id,
    'PHP',
    'posted',
    p_idempotency_key,
    'Transfer: ' || v_src_account.name || ' -> ' || v_dst_account.name || CASE WHEN p_notes IS NOT NULL AND TRIM(p_notes) <> '' THEN ' — ' || TRIM(p_notes) ELSE '' END
  ) RETURNING id INTO v_transaction_id;

  -- Outflow Movement (-amount)
  INSERT INTO public.financial_account_movements (
    transaction_id,
    financial_account_id,
    amount,
    payment_method,
    created_at
  ) VALUES (
    v_transaction_id,
    v_src_account.id,
    -v_amount,
    CASE v_src_account.account_type
      WHEN 'cash_drawer' THEN 'cash'
      WHEN 'card_terminal' THEN 'card'
      ELSE v_src_account.account_type
    END,
    v_now
  ) RETURNING id INTO v_outflow_id;

  -- Inflow Movement (+amount)
  INSERT INTO public.financial_account_movements (
    transaction_id,
    financial_account_id,
    amount,
    payment_method,
    created_at
  ) VALUES (
    v_transaction_id,
    v_dst_account.id,
    v_amount,
    CASE v_dst_account.account_type
      WHEN 'cash_drawer' THEN 'cash'
      WHEN 'card_terminal' THEN 'card'
      ELSE v_dst_account.account_type
    END,
    v_now
  ) RETURNING id INTO v_inflow_id;

  RETURN jsonb_build_object(
    'success', true,
    'transactionId', v_transaction_id,
    'outflowMovementId', v_outflow_id,
    'inflowMovementId', v_inflow_id,
    'amount', v_amount,
    'sourceAccount', v_src_account.name,
    'destinationAccount', v_dst_account.name,
    'netEffect', 0.00,
    'idempotentReplay', false
  );
END;
$func$;

REVOKE ALL ON TABLE public.financial_expense_categories, public.financial_expense_details,
  public.financial_tip_details, public.financial_commercial_details FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.financial_expense_categories, public.financial_expense_details,
  public.financial_tip_details, public.financial_commercial_details TO authenticated;
GRANT ALL ON TABLE public.financial_expense_categories, public.financial_expense_details,
  public.financial_tip_details, public.financial_commercial_details TO service_role;

REVOKE ALL ON FUNCTION public.post_expense_atomic(UUID, TEXT, NUMERIC, UUID, UUID, TEXT, TEXT, TEXT, DATE, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_expense_atomic(UUID, TEXT, NUMERIC, UUID, UUID, TEXT, TEXT, TEXT, DATE, TEXT)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.post_tip_atomic(UUID, UUID, TEXT, NUMERIC, UUID, TEXT, DATE, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_tip_atomic(UUID, UUID, TEXT, NUMERIC, UUID, TEXT, DATE, TEXT, TEXT)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.post_misc_income_atomic(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, DATE, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_misc_income_atomic(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, DATE, TEXT, TEXT)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.post_cash_adjustment_atomic(UUID, UUID, TEXT, NUMERIC, TEXT, DATE, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_cash_adjustment_atomic(UUID, UUID, TEXT, NUMERIC, TEXT, DATE, TEXT, TEXT)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.post_transfer_atomic(UUID, UUID, UUID, NUMERIC, DATE, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_transfer_atomic(UUID, UUID, UUID, NUMERIC, DATE, TEXT, TEXT)
  TO authenticated, service_role;

COMMIT;
