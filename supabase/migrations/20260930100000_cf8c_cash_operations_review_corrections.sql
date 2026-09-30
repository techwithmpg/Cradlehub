-- =============================================================================
-- CF8-C Review Corrections — Cash Operations
--
-- Forward-only correction following independent review of checkpoint f968522.
--
-- This migration:
--   - serializes keyed cash-operation retries before idempotency lookup
--   - rejects monetary inputs with precision beyond two decimal places
--   - preserves the existing open-cash-session, PHP, branch and role boundaries
--
-- This migration does NOT:
--   - replay or mark any historical migration
--   - mutate existing financial transactions or movements
--   - modify existing cash session rows
--   - create financial accounts
--   - create a Safe/Vault account
--   - touch daily_cash_reconciliations
-- =============================================================================

BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure(
    'public.post_cash_adjustment_atomic(uuid,uuid,text,numeric,text,date,text,text)'
  ) IS NULL THEN
    RAISE EXCEPTION
      'MIGRATION_HALT: post_cash_adjustment_atomic signature is missing'
      USING ERRCODE = '55000';
  END IF;

  IF to_regprocedure(
    'public.post_transfer_atomic(uuid,uuid,uuid,numeric,date,text,text)'
  ) IS NULL THEN
    RAISE EXCEPTION
      'MIGRATION_HALT: post_transfer_atomic signature is missing'
      USING ERRCODE = '55000';
  END IF;
END;
$preflight$;
CREATE OR REPLACE FUNCTION public.post_cash_adjustment_atomic(
  p_branch_id            UUID,
  p_financial_account_id UUID,
  p_adjustment_type      TEXT,
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
  v_auth_uid          UUID;
  v_staff             RECORD;
  v_account           RECORD;
  v_existing_tx       RECORD;
  v_business_date     DATE;
  v_now               TIMESTAMPTZ := clock_timestamp();
  v_transaction_id    UUID;
  v_movement_id       UUID;
  v_amount            NUMERIC(12,2);
  v_signed_amount     NUMERIC(12,2);
  v_expected_notes    TEXT;
  v_existing_count    INTEGER;
  v_existing_amount   NUMERIC(12,2);
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION
      'INVALID_AMOUNT: Adjustment amount must be greater than zero';
  END IF;

  IF ROUND(p_amount::numeric, 2) IS DISTINCT FROM p_amount::numeric THEN
    RAISE EXCEPTION
      'AMOUNT_PRECISION_INVALID: Cash adjustment amount must use at most two decimal places';
  END IF;

  v_amount := ROUND(p_amount::numeric, 2);

  IF p_adjustment_type NOT IN ('addition', 'removal') THEN
    RAISE EXCEPTION
      'INVALID_ADJUSTMENT_TYPE: Type must be addition or removal';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION
      'REASON_REQUIRED: Reason for cash adjustment is required';
  END IF;

  IF p_adjustment_type = 'addition' THEN
    v_signed_amount := v_amount;
  ELSE
    v_signed_amount := -v_amount;
  END IF;

  -- Actor authority.
  v_auth_uid := auth.uid();

  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION
      'AUTH_REQUIRED: Authentication required to adjust cash';
  END IF;

  SELECT *
  INTO v_staff
  FROM public.staff
  WHERE auth_user_id = v_auth_uid
    AND is_active = true
  LIMIT 1;

  IF v_staff IS NULL THEN
    RAISE EXCEPTION
      'STAFF_NOT_FOUND: Active staff record not found for authenticated user';
  END IF;

  IF p_branch_id IS NULL THEN
    p_branch_id := v_staff.branch_id;
  END IF;

  IF p_branch_id IS NULL THEN
    RAISE EXCEPTION
      'BRANCH_REQUIRED: Branch context is required for cash adjustment';
  END IF;

  IF v_staff.system_role NOT IN (
    'owner',
    'manager',
    'assistant_manager',
    'store_manager',
    'crm'
  ) THEN
    RAISE EXCEPTION
      'CASH_ROLE_UNAUTHORIZED: Caller cannot adjust cash';
  END IF;

  IF v_staff.system_role <> 'owner'
     AND v_staff.branch_id <> p_branch_id THEN
    RAISE EXCEPTION
      'BRANCH_MISMATCH: Staff member is not authorized for branch %',
      p_branch_id;
  END IF;

  v_business_date := COALESCE(p_business_date, CURRENT_DATE);

  v_expected_notes :=
    TRIM(p_reason) ||
    CASE
      WHEN p_notes IS NOT NULL AND TRIM(p_notes) <> ''
        THEN ' — ' || TRIM(p_notes)
      ELSE ''
    END;

  -- -------------------------------------------------------------------------
  -- IDEMPOTENCY
  --
  -- Replay is allowed only when the stored canonical transaction matches the
  -- same adjustment payload.
  -- -------------------------------------------------------------------------

  IF p_idempotency_key IS NOT NULL
     AND TRIM(p_idempotency_key) <> '' THEN

    PERFORM pg_advisory_xact_lock(
      hashtext('idem_cf8c_cash_operation_' || TRIM(p_idempotency_key))
    );

    SELECT *
    INTO v_existing_tx
    FROM public.financial_transactions
    WHERE idempotency_key = TRIM(p_idempotency_key);

    IF v_existing_tx.id IS NOT NULL THEN

      SELECT
        COUNT(*)::INTEGER,
        COALESCE(SUM(m.amount), 0)::NUMERIC(12,2)
      INTO
        v_existing_count,
        v_existing_amount
      FROM public.financial_account_movements m
      WHERE m.transaction_id = v_existing_tx.id
        AND m.financial_account_id = p_financial_account_id
        AND m.payment_method = 'cash';

      IF v_existing_tx.transaction_type <> 'cash_adjustment'
         OR v_existing_tx.branch_id IS DISTINCT FROM p_branch_id
         OR v_existing_tx.business_date IS DISTINCT FROM v_business_date
         OR v_existing_tx.currency IS DISTINCT FROM 'PHP'
         OR v_existing_tx.status IS DISTINCT FROM 'posted'
         OR COALESCE(v_existing_tx.notes, '') IS DISTINCT FROM v_expected_notes
         OR v_existing_count <> 1
         OR v_existing_amount IS DISTINCT FROM v_signed_amount THEN

        RAISE EXCEPTION
          'IDEMPOTENCY_CONFLICT: Key was already used for a different cash adjustment';
      END IF;

      RETURN jsonb_build_object(
        'success', true,
        'transactionId', v_existing_tx.id,
        'idempotentReplay', true,
        'amount', v_signed_amount
      );
    END IF;
  END IF;

  -- Account authority.
  SELECT *
  INTO v_account
  FROM public.financial_accounts
  WHERE id = p_financial_account_id;

  IF v_account.id IS NULL THEN
    RAISE EXCEPTION
      'ACCOUNT_NOT_FOUND: Financial account does not exist';
  END IF;

  IF NOT v_account.is_active THEN
    RAISE EXCEPTION
      'ACCOUNT_INACTIVE: Financial account is inactive';
  END IF;

  IF v_account.account_type <> 'cash_drawer' THEN
    RAISE EXCEPTION
      'CASH_DRAWER_REQUIRED: Cash adjustments can only be performed on cash_drawer accounts';
  END IF;

  IF v_account.currency IS DISTINCT FROM 'PHP' THEN
    RAISE EXCEPTION
      'UNSUPPORTED_CURRENCY: Cash operations currently require PHP accounts';
  END IF;

  IF v_account.branch_id IS NOT NULL
     AND v_account.branch_id <> p_branch_id THEN
    RAISE EXCEPTION
      'ACCOUNT_BRANCH_MISMATCH: Financial account belongs to branch %, not %',
      v_account.branch_id,
      p_branch_id;
  END IF;

  -- -------------------------------------------------------------------------
  -- PHYSICAL CASH AUTHORITY
  --
  -- An open cash session represents physical drawer custody.
  -- Calendar/business-date rollover does not silently close custody.
  -- Explicit Day Close / Shift Handover will own closure later.
  -- -------------------------------------------------------------------------

  IF NOT EXISTS (
    SELECT 1
    FROM public.cash_sessions cs
    WHERE cs.branch_id = p_branch_id
      AND cs.cash_drawer_account_id = v_account.id
      AND cs.status = 'open'
  ) THEN
    RAISE EXCEPTION
      'CASH_SESSION_REQUIRED: Open the cash drawer before recording physical cash operations';
  END IF;

  -- Canonical transaction.
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
  )
  VALUES (
    p_branch_id,
    'cash_adjustment',
    v_business_date,
    v_now,
    v_now,
    v_staff.id,
    'PHP',
    'posted',
    p_idempotency_key,
    v_expected_notes
  )
  RETURNING id INTO v_transaction_id;

  INSERT INTO public.financial_account_movements (
    transaction_id,
    financial_account_id,
    amount,
    payment_method,
    created_at
  )
  VALUES (
    v_transaction_id,
    v_account.id,
    v_signed_amount,
    'cash',
    v_now
  )
  RETURNING id INTO v_movement_id;

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

CREATE OR REPLACE FUNCTION public.post_transfer_atomic(
  p_branch_id              UUID,
  p_source_account_id      UUID,
  p_destination_account_id UUID,
  p_amount                 NUMERIC,
  p_business_date          DATE DEFAULT NULL,
  p_notes                  TEXT DEFAULT NULL,
  p_idempotency_key        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_auth_uid            UUID;
  v_staff               RECORD;
  v_src_account         RECORD;
  v_dst_account         RECORD;
  v_existing_tx         RECORD;
  v_business_date       DATE;
  v_now                 TIMESTAMPTZ := clock_timestamp();
  v_transaction_id      UUID;
  v_outflow_id          UUID;
  v_inflow_id           UUID;
  v_amount              NUMERIC(12,2);
  v_expected_notes      TEXT;
  v_source_count        INTEGER;
  v_destination_count   INTEGER;
  v_source_amount       NUMERIC(12,2);
  v_destination_amount  NUMERIC(12,2);
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION
      'INVALID_AMOUNT: Transfer amount must be greater than zero';
  END IF;

  IF ROUND(p_amount::numeric, 2) IS DISTINCT FROM p_amount::numeric THEN
    RAISE EXCEPTION
      'AMOUNT_PRECISION_INVALID: Transfer amount must use at most two decimal places';
  END IF;

  v_amount := ROUND(p_amount::numeric, 2);

  IF p_source_account_id IS NULL
     OR p_destination_account_id IS NULL THEN
    RAISE EXCEPTION
      'ACCOUNTS_REQUIRED: Both source and destination accounts are required';
  END IF;

  IF p_source_account_id = p_destination_account_id THEN
    RAISE EXCEPTION
      'IDENTICAL_ACCOUNTS: Source and destination accounts cannot be identical';
  END IF;

  -- Actor authority.
  v_auth_uid := auth.uid();

  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION
      'AUTH_REQUIRED: Authentication required to perform transfer';
  END IF;

  SELECT *
  INTO v_staff
  FROM public.staff
  WHERE auth_user_id = v_auth_uid
    AND is_active = true
  LIMIT 1;

  IF v_staff IS NULL THEN
    RAISE EXCEPTION
      'STAFF_NOT_FOUND: Active staff record not found for authenticated user';
  END IF;

  IF p_branch_id IS NULL THEN
    p_branch_id := v_staff.branch_id;
  END IF;

  IF p_branch_id IS NULL THEN
    RAISE EXCEPTION
      'BRANCH_REQUIRED: Branch context is required for transfer';
  END IF;

  IF v_staff.system_role NOT IN (
    'owner',
    'manager',
    'assistant_manager',
    'store_manager',
    'crm'
  ) THEN
    RAISE EXCEPTION
      'TRANSFER_ROLE_UNAUTHORIZED: Caller cannot transfer funds';
  END IF;

  IF v_staff.system_role <> 'owner'
     AND v_staff.branch_id <> p_branch_id THEN
    RAISE EXCEPTION
      'BRANCH_MISMATCH: Staff member is not authorized for branch %',
      p_branch_id;
  END IF;

  v_business_date := COALESCE(p_business_date, CURRENT_DATE);

  -- Resolve accounts early so replay can validate exact payload.
  SELECT *
  INTO v_src_account
  FROM public.financial_accounts
  WHERE id = p_source_account_id;

  SELECT *
  INTO v_dst_account
  FROM public.financial_accounts
  WHERE id = p_destination_account_id;

  v_expected_notes :=
    'Transfer: ' ||
    COALESCE(v_src_account.name, p_source_account_id::text) ||
    ' -> ' ||
    COALESCE(v_dst_account.name, p_destination_account_id::text) ||
    CASE
      WHEN p_notes IS NOT NULL AND TRIM(p_notes) <> ''
        THEN ' — ' || TRIM(p_notes)
      ELSE ''
    END;

  -- -------------------------------------------------------------------------
  -- IDEMPOTENCY
  -- -------------------------------------------------------------------------

  IF p_idempotency_key IS NOT NULL
     AND TRIM(p_idempotency_key) <> '' THEN

    PERFORM pg_advisory_xact_lock(
      hashtext('idem_cf8c_cash_operation_' || TRIM(p_idempotency_key))
    );

    SELECT *
    INTO v_existing_tx
    FROM public.financial_transactions
    WHERE idempotency_key = TRIM(p_idempotency_key);

    IF v_existing_tx.id IS NOT NULL THEN

      SELECT
        COUNT(*)::INTEGER,
        COALESCE(SUM(m.amount), 0)::NUMERIC(12,2)
      INTO
        v_source_count,
        v_source_amount
      FROM public.financial_account_movements m
      WHERE m.transaction_id = v_existing_tx.id
        AND m.financial_account_id = p_source_account_id;

      SELECT
        COUNT(*)::INTEGER,
        COALESCE(SUM(m.amount), 0)::NUMERIC(12,2)
      INTO
        v_destination_count,
        v_destination_amount
      FROM public.financial_account_movements m
      WHERE m.transaction_id = v_existing_tx.id
        AND m.financial_account_id = p_destination_account_id;

      IF v_existing_tx.transaction_type <> 'cash_adjustment'
         OR v_existing_tx.branch_id IS DISTINCT FROM p_branch_id
         OR v_existing_tx.business_date IS DISTINCT FROM v_business_date
         OR v_existing_tx.currency IS DISTINCT FROM 'PHP'
         OR v_existing_tx.status IS DISTINCT FROM 'posted'
         OR COALESCE(v_existing_tx.notes, '') IS DISTINCT FROM v_expected_notes
         OR v_source_count <> 1
         OR v_destination_count <> 1
         OR v_source_amount IS DISTINCT FROM -v_amount
         OR v_destination_amount IS DISTINCT FROM v_amount THEN

        RAISE EXCEPTION
          'IDEMPOTENCY_CONFLICT: Key was already used for a different transfer';
      END IF;

      RETURN jsonb_build_object(
        'success', true,
        'transactionId', v_existing_tx.id,
        'idempotentReplay', true,
        'amount', v_amount
      );
    END IF;
  END IF;

  -- New writes require valid active accounts.
  IF v_src_account.id IS NULL OR NOT v_src_account.is_active THEN
    RAISE EXCEPTION
      'SOURCE_ACCOUNT_INVALID: Source account is invalid or inactive';
  END IF;

  IF v_dst_account.id IS NULL OR NOT v_dst_account.is_active THEN
    RAISE EXCEPTION
      'DESTINATION_ACCOUNT_INVALID: Destination account is invalid or inactive';
  END IF;

  IF v_src_account.currency IS DISTINCT FROM 'PHP'
     OR v_dst_account.currency IS DISTINCT FROM 'PHP' THEN
    RAISE EXCEPTION
      'UNSUPPORTED_CURRENCY: Transfers currently require PHP accounts';
  END IF;

  IF v_src_account.branch_id IS NOT NULL
     AND v_src_account.branch_id <> p_branch_id THEN
    RAISE EXCEPTION
      'ACCOUNT_BRANCH_MISMATCH: Source account belongs to branch %, not %',
      v_src_account.branch_id,
      p_branch_id;
  END IF;

  IF v_dst_account.branch_id IS NOT NULL
     AND v_dst_account.branch_id <> p_branch_id THEN
    RAISE EXCEPTION
      'ACCOUNT_BRANCH_MISMATCH: Destination account belongs to branch %, not %',
      v_dst_account.branch_id,
      p_branch_id;
  END IF;

  -- -------------------------------------------------------------------------
  -- CASH DRAWER AUTHORITY
  --
  -- Digital-to-digital transfers do not require a cash session.
  -- Any transfer touching physical drawer custody does.
  -- -------------------------------------------------------------------------

  IF v_src_account.account_type = 'cash_drawer'
     AND NOT EXISTS (
       SELECT 1
       FROM public.cash_sessions cs
       WHERE cs.branch_id = p_branch_id
         AND cs.cash_drawer_account_id = v_src_account.id
            AND cs.status = 'open'
     ) THEN

    RAISE EXCEPTION
      'CASH_SESSION_REQUIRED: Open the source cash drawer before transferring physical cash';
  END IF;

  IF v_dst_account.account_type = 'cash_drawer'
     AND NOT EXISTS (
       SELECT 1
       FROM public.cash_sessions cs
       WHERE cs.branch_id = p_branch_id
         AND cs.cash_drawer_account_id = v_dst_account.id
            AND cs.status = 'open'
     ) THEN

    RAISE EXCEPTION
      'CASH_SESSION_REQUIRED: Open the destination cash drawer before transferring physical cash';
  END IF;

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
  )
  VALUES (
    p_branch_id,
    'cash_adjustment',
    v_business_date,
    v_now,
    v_now,
    v_staff.id,
    'PHP',
    'posted',
    p_idempotency_key,
    v_expected_notes
  )
  RETURNING id INTO v_transaction_id;

  INSERT INTO public.financial_account_movements (
    transaction_id,
    financial_account_id,
    amount,
    payment_method,
    created_at
  )
  VALUES (
    v_transaction_id,
    v_src_account.id,
    -v_amount,
    CASE v_src_account.account_type
      WHEN 'cash_drawer' THEN 'cash'
      WHEN 'card_terminal' THEN 'card'
      ELSE v_src_account.account_type
    END,
    v_now
  )
  RETURNING id INTO v_outflow_id;

  INSERT INTO public.financial_account_movements (
    transaction_id,
    financial_account_id,
    amount,
    payment_method,
    created_at
  )
  VALUES (
    v_transaction_id,
    v_dst_account.id,
    v_amount,
    CASE v_dst_account.account_type
      WHEN 'cash_drawer' THEN 'cash'
      WHEN 'card_terminal' THEN 'card'
      ELSE v_dst_account.account_type
    END,
    v_now
  )
  RETURNING id INTO v_inflow_id;

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
-- Preserve the accepted execution boundary.
REVOKE ALL ON FUNCTION public.post_cash_adjustment_atomic(
  UUID, UUID, TEXT, NUMERIC, TEXT, DATE, TEXT, TEXT
)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.post_cash_adjustment_atomic(
  UUID, UUID, TEXT, NUMERIC, TEXT, DATE, TEXT, TEXT
)
TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.post_transfer_atomic(
  UUID, UUID, UUID, NUMERIC, DATE, TEXT, TEXT
)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.post_transfer_atomic(
  UUID, UUID, UUID, NUMERIC, DATE, TEXT, TEXT
)
TO authenticated, service_role;

COMMIT;
