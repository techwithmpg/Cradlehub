-- =============================================================================
-- CradleHub — Migration: CF7 Operational Expense Register & Receipt Storage
-- Stage: CF7 (Operational Expense Register UI & Receipt Attachment)
-- Authority: CradleHub_CF1_Financial_Contract_Freeze.md
-- =============================================================================

-- ─── 1. STORAGE BUCKET: expense-receipts ─────────────────────────────────────
-- Provision private bucket for operational expense receipts.
-- Restrictions: private, 5 MB file size limit, allowed image/PDF MIME types.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expense-receipts',
  'expense-receipts',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[];


-- ─── 2. STORAGE POLICIES ─────────────────────────────────────────────────────
-- Private receipt storage requires authenticated, branch-isolated access.
-- Path format: {branchId}/{YYYY}/{MM}/rec_{businessDate}_{random}.{ext}
-- Folder token 1 represents the branchId.

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2.1. SELECT Policy (Authenticated staff read receipts for their branch or owner/admin/finance)
DROP POLICY IF EXISTS "expense_receipts_authenticated_select" ON storage.objects;
CREATE POLICY "expense_receipts_authenticated_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND (
      (storage.foldername(name))[1] = (SELECT public.get_auth_branch_id()::text)
      OR (SELECT public.get_auth_role()) = 'owner'
      OR EXISTS (
        SELECT 1 FROM public.staff
        WHERE auth_user_id = (SELECT auth.uid())
          AND is_active = true
          AND system_role = 'owner'
      )
    )
  );

-- 2.2. INSERT Policy (Authenticated staff upload to own branch folder; ownership via owner_id)
DROP POLICY IF EXISTS "expense_receipts_authenticated_insert" ON storage.objects;
CREATE POLICY "expense_receipts_authenticated_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'expense-receipts'
    AND (
      (storage.foldername(name))[1] = (SELECT public.get_auth_branch_id()::text)
      OR (SELECT public.get_auth_role()) = 'owner'
      OR EXISTS (
        SELECT 1 FROM public.staff
        WHERE auth_user_id = (SELECT auth.uid())
          AND is_active = true
          AND system_role = 'owner'
      )
    )
    AND (
      owner_id = (SELECT auth.uid()::text)
      OR owner_id IS NULL
    )
  );

-- 2.3. DELETE Policy (Orphan cleanup: staff can delete their own uploaded object in branch folder; owner/admin can delete)
DROP POLICY IF EXISTS "expense_receipts_authenticated_delete" ON storage.objects;
CREATE POLICY "expense_receipts_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND (
      (storage.foldername(name))[1] = (SELECT public.get_auth_branch_id()::text)
      OR (SELECT public.get_auth_role()) = 'owner'
      OR EXISTS (
        SELECT 1 FROM public.staff
        WHERE auth_user_id = (SELECT auth.uid())
          AND is_active = true
          AND system_role = 'owner'
      )
    )
    AND (
      owner_id = (SELECT auth.uid()::text)
      OR (SELECT public.get_auth_role()) = 'owner'
      OR EXISTS (
        SELECT 1 FROM public.staff
        WHERE auth_user_id = (SELECT auth.uid())
          AND is_active = true
          AND system_role = 'owner'
      )
    )
  );

-- 2.4. Service Role Policy (Full access for background maintenance)
DROP POLICY IF EXISTS "expense_receipts_service_role_all" ON storage.objects;
CREATE POLICY "expense_receipts_service_role_all"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'expense-receipts')
  WITH CHECK (bucket_id = 'expense-receipts');


-- ─── 3. RPC: post_expense_atomic (ADDITIVE RECEIPT PATH SUPPORT) ─────────────
-- Drop 10-argument function overload to ensure clean resolution for callers
-- using defaults, while 11-argument function maintains 100% backward compatibility.
DROP FUNCTION IF EXISTS public.post_expense_atomic(
  UUID, TEXT, NUMERIC, UUID, UUID, TEXT, TEXT, TEXT, DATE, TEXT
);

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
  p_notes                TEXT DEFAULT NULL,
  p_receipt_image_path   TEXT DEFAULT NULL
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
    NULL,
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

  -- 9. Insert Expense Detail with Receipt Image Path (Persisted to receipt_image_url)
  INSERT INTO public.financial_expense_details (
    transaction_id,
    category_id,
    payee,
    description,
    receipt_reference,
    receipt_image_url,
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
    p_receipt_image_path,
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
    'receiptImagePath', p_receipt_image_path,
    'idempotentReplay', false
  );
END;
$func$;

COMMENT ON FUNCTION public.post_expense_atomic(UUID, TEXT, NUMERIC, UUID, UUID, TEXT, TEXT, TEXT, DATE, TEXT, TEXT) IS
  'CF7: Posts an operational expense atomically with negative account movement and optional durable receipt image path.';

REVOKE ALL ON FUNCTION public.post_expense_atomic(UUID, TEXT, NUMERIC, UUID, UUID, TEXT, TEXT, TEXT, DATE, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_expense_atomic(UUID, TEXT, NUMERIC, UUID, UUID, TEXT, TEXT, TEXT, DATE, TEXT, TEXT)
  TO authenticated, service_role;
