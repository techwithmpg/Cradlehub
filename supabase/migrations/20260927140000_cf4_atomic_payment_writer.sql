-- =============================================================================
-- CF4: Atomic Payment Posting Engine
-- =============================================================================
-- Stage: CF4 — ATOMIC PAYMENT POSTING ENGINE
-- Program: CradleHub Web — CONTROLLED STABILIZATION
-- Authoritative Contract: CradleHub_CF1_Financial_Contract_Freeze.md
-- Depends On:
--   - 20260927120000_cf2_financial_foundation.sql
--   - 20260927130000_cf3_order_payables_allocations.sql
--
-- Entities / Functions Introduced:
--   1. public.post_order_payment_atomic(...)
--      Canonical, server-authoritative, atomic transaction writer for:
--      - Full customer payments
--      - Partial customer payments / deposits
--      - Split-tender payments across multiple rails (Cash, GCash, Maya, Bank, Card)
--      - Order-level default and explicit item-level financial allocations
--      - Atomic concurrency locking, replay suppression, and idempotency protection
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

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'order_payable_items'
  ) THEN
    RAISE EXCEPTION 'MIGRATION_HALT: public.order_payable_items does not exist.'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'financial_order_allocations'
  ) THEN
    RAISE EXCEPTION 'MIGRATION_HALT: public.financial_order_allocations does not exist.'
      USING ERRCODE = '55000';
  END IF;
END;
$preflight$;


-- ─── FUNCTION: post_order_payment_atomic ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_order_payment_atomic(
  p_order_id             UUID,
  p_idempotency_key      TEXT,
  p_payments             JSONB,
  p_allocations          JSONB DEFAULT NULL,
  p_business_date        DATE DEFAULT NULL,
  p_external_reference   TEXT DEFAULT NULL,
  p_notes                TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_auth_uid            UUID;
  v_staff               RECORD;
  v_order               RECORD;
  v_existing_tx         RECORD;
  v_existing_total      NUMERIC(12,2);
  v_total_payable       NUMERIC(12,2);
  v_net_allocated       NUMERIC(12,2);
  v_remaining_balance   NUMERIC(12,2);
  v_total_payment       NUMERIC(12,2) := 0.00;
  v_business_date       DATE;
  v_now                 TIMESTAMPTZ := clock_timestamp();
  v_transaction_id      UUID;
  
  -- Iteration variables
  v_part                JSONB;
  v_part_amount         NUMERIC(12,2);
  v_part_method         TEXT;
  v_part_account_id     UUID;
  v_part_ext_ref        TEXT;
  v_account             RECORD;
  v_movement_id         UUID;
  v_alloc_item          JSONB;
  v_alloc_amount        NUMERIC(12,2);
  v_alloc_item_id       UUID;
  v_alloc_sum           NUMERIC(12,2) := 0.00;
  v_payable_item        RECORD;
  
  -- Tracking arrays for movements and allocations
  v_movements_json      JSONB := '[]'::jsonb;
  v_allocations_json    JSONB := '[]'::jsonb;
  v_movement_ids        UUID[] := ARRAY[]::UUID[];
  v_movement_amounts    NUMERIC(12,2)[] := ARRAY[]::NUMERIC(12,2)[];
  v_movement_rem        NUMERIC(12,2)[] := ARRAY[]::NUMERIC(12,2)[];
  v_mov_idx             INT;
  v_alloc_take          NUMERIC(12,2);
  v_new_net_allocated   NUMERIC(12,2);
  v_new_remaining       NUMERIC(12,2);
  v_new_state           TEXT;
BEGIN
  -- 1. Input sanity validation
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_ID_REQUIRED: Booking order ID is required';
  END IF;

  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED: Idempotency key is required';
  END IF;

  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'PAYMENTS_REQUIRED: At least one payment part is required';
  END IF;

  -- 2. Concurrency serialization: Acquire advisory transaction lock for idempotency key
  PERFORM pg_advisory_xact_lock(hashtext('idem_cf4_' || p_idempotency_key));

  -- 3. Row lock on booking order
  SELECT id, branch_id, organizer_customer_id, booking_date, currency
  INTO v_order
  FROM public.booking_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: Booking order % does not exist', p_order_id;
  END IF;
  -- 4. Authenticated identity & staff resolution
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Unauthenticated caller cannot post payments';
  END IF;

  SELECT s.id, s.branch_id, s.system_role, s.is_active
  INTO v_staff
  FROM public.staff s
  WHERE s.auth_user_id = v_auth_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAFF_NOT_FOUND: Active staff record not found for authenticated user %', v_auth_uid;
  END IF;

  IF NOT v_staff.is_active THEN
    RAISE EXCEPTION 'STAFF_INACTIVE: Staff member % is inactive', v_staff.id;
  END IF;

  -- 5. Branch permission verification
  IF v_staff.system_role NOT IN ('owner', 'manager', 'assistant_manager', 'store_manager', 'crm') THEN
    RAISE EXCEPTION 'PAYMENT_ROLE_UNAUTHORIZED: Caller cannot record order payments';
  END IF;
  IF v_staff.system_role <> 'owner' AND v_staff.branch_id <> v_order.branch_id THEN
    RAISE EXCEPTION 'BRANCH_UNAUTHORIZED: Staff % (branch %) unauthorized for order in branch %',
      v_staff.id, v_staff.branch_id, v_order.branch_id;
  END IF;
  IF v_order.currency IS DISTINCT FROM 'PHP' THEN
    RAISE EXCEPTION 'UNSUPPORTED_ORDER_CURRENCY: Cash Flow currently supports PHP orders only';
  END IF;

  -- 6. Validate payment parts & rails
  FOR v_part IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    IF (v_part->>'amount') IS NULL THEN
      RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT: Payment part missing amount';
    END IF;

    v_part_amount := (v_part->>'amount')::numeric;
    IF v_part_amount <= 0 THEN
      RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT: Payment amount must be positive, got %', v_part_amount;
    END IF;

    v_part_method := (v_part->>'payment_method');
    IF v_part_method IS NULL OR v_part_method NOT IN ('cash', 'gcash', 'maya', 'bank_transfer', 'card') THEN
      RAISE EXCEPTION 'INVALID_PAYMENT_METHOD: Unsupported payment method %', v_part_method;
    END IF;

    IF (v_part->>'financial_account_id') IS NULL THEN
      RAISE EXCEPTION 'ACCOUNT_ID_REQUIRED: Financial account ID required for payment method %', v_part_method;
    END IF;

    v_part_account_id := (v_part->>'financial_account_id')::uuid;

    SELECT id, branch_id, account_type, is_active, currency
    INTO v_account
    FROM public.financial_accounts
    WHERE id = v_part_account_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: Financial account % does not exist', v_part_account_id;
    END IF;

    IF NOT v_account.is_active THEN
      RAISE EXCEPTION 'ACCOUNT_INACTIVE: Financial account % is inactive', v_part_account_id;
    END IF;

    IF v_account.branch_id IS NOT NULL AND v_account.branch_id <> v_order.branch_id THEN
      RAISE EXCEPTION 'ACCOUNT_BRANCH_MISMATCH: Financial account % belongs to branch %, not order branch %',
        v_part_account_id, v_account.branch_id, v_order.branch_id;
    END IF;

    -- Strict rail/account_type compatibility
    IF (v_part_method = 'cash' AND v_account.account_type <> 'cash_drawer') OR
       (v_part_method = 'gcash' AND v_account.account_type <> 'gcash') OR
       (v_part_method = 'maya' AND v_account.account_type <> 'maya') OR
       (v_part_method = 'bank_transfer' AND v_account.account_type <> 'bank_transfer') OR
       (v_part_method = 'card' AND v_account.account_type <> 'card_terminal') THEN
      RAISE EXCEPTION 'ACCOUNT_TYPE_MISMATCH: Payment method % is incompatible with account type %',
        v_part_method, v_account.account_type;
    END IF;

    IF v_account.currency <> 'PHP' THEN
      RAISE EXCEPTION 'INVALID_CURRENCY: Financial account currency must be PHP, got %', v_account.currency;
    END IF;

    v_total_payment := v_total_payment + v_part_amount;
  END LOOP;

  -- 7. Idempotency Check (Retry-safe replay suppression)
  SELECT id, branch_id, transaction_type, status, business_date, source_type, source_id
  INTO v_existing_tx
  FROM public.financial_transactions
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    -- Check for conflicting payload under same key
    SELECT COALESCE(SUM(amount), 0.00)
    INTO v_existing_total
    FROM public.financial_account_movements
    WHERE transaction_id = v_existing_tx.id;

    IF v_existing_tx.source_id <> p_order_id::text OR
       v_existing_tx.source_type <> 'booking_order' OR
       v_existing_total <> v_total_payment THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Key % already used for conflicting transaction %',
        p_idempotency_key, v_existing_tx.id;
    END IF;

    -- Return existing transaction details and summary
    SELECT
      jsonb_agg(jsonb_build_object(
        'id', fam.id,
        'financial_account_id', fam.financial_account_id,
        'amount', fam.amount,
        'payment_method', fam.payment_method,
        'external_reference', fam.external_reference
      ))
    INTO v_movements_json
    FROM public.financial_account_movements fam
    WHERE fam.transaction_id = v_existing_tx.id;

    SELECT
      jsonb_agg(jsonb_build_object(
        'id', foa.id,
        'payable_item_id', foa.payable_item_id,
        'amount', foa.amount
      ))
    INTO v_allocations_json
    FROM public.financial_order_allocations foa
    WHERE foa.order_id = p_order_id
      AND foa.financial_account_movement_id IN (
        SELECT id FROM public.financial_account_movements WHERE transaction_id = v_existing_tx.id
      );

    -- Current financial summary
    SELECT
      COALESCE(SUM(amount), 0.00) INTO v_total_payable
    FROM public.order_payable_items
    WHERE order_id = p_order_id;

    SELECT
      COALESCE(SUM(amount), 0.00) INTO v_net_allocated
    FROM public.financial_order_allocations
    WHERE order_id = p_order_id;

    v_remaining_balance := v_total_payable - v_net_allocated;
    v_new_state := public.derive_order_payment_state(v_total_payable, v_net_allocated);

    RETURN jsonb_build_object(
      'success', true,
      'is_idempotent_replay', true,
      'transaction_id', v_existing_tx.id,
      'order_id', p_order_id,
      'branch_id', v_existing_tx.branch_id,
      'business_date', v_existing_tx.business_date,
      'total_paid', v_existing_total,
      'total_payable', v_total_payable,
      'net_allocated', v_net_allocated,
      'remaining_balance', v_remaining_balance,
      'payment_state', v_new_state,
      'movements', COALESCE(v_movements_json, '[]'::jsonb),
      'allocations', COALESCE(v_allocations_json, '[]'::jsonb)
    );
  END IF;

  -- 8. Order Payable and Balance Validation
  SELECT COALESCE(SUM(amount), 0.00)
  INTO v_total_payable
  FROM public.order_payable_items
  WHERE order_id = p_order_id;

  SELECT COALESCE(SUM(amount), 0.00)
  INTO v_net_allocated
  FROM public.financial_order_allocations
  WHERE order_id = p_order_id;

  IF v_total_payable < 0 THEN
    RAISE EXCEPTION 'INVALID_NEGATIVE_PAYABLE: Total payable is negative (%)', v_total_payable;
  END IF;

  IF v_total_payable = 0 THEN
    RAISE EXCEPTION 'ZERO_PAYABLE_ORDER: Order has zero payable, no payment required';
  END IF;

  v_remaining_balance := v_total_payable - v_net_allocated;

  IF v_remaining_balance <= 0 THEN
    RAISE EXCEPTION 'ORDER_ALREADY_PAID: Order remaining balance is zero';
  END IF;

  -- Overpayment policy: Reject payments exceeding remaining balance in CF4
  IF v_total_payment > v_remaining_balance THEN
    RAISE EXCEPTION 'PAYMENT_EXCEEDS_REMAINING_BALANCE: Total payment % exceeds remaining balance %',
      v_total_payment, v_remaining_balance;
  END IF;

  -- 9. Explicit Allocations Validation (if provided)
  IF p_allocations IS NOT NULL AND jsonb_typeof(p_allocations) = 'array' AND jsonb_array_length(p_allocations) > 0 THEN
    FOR v_alloc_item IN SELECT * FROM jsonb_array_elements(p_allocations)
    LOOP
      IF (v_alloc_item->>'amount') IS NULL THEN
        RAISE EXCEPTION 'INVALID_ALLOCATION_AMOUNT: Allocation missing amount';
      END IF;

      v_alloc_amount := (v_alloc_item->>'amount')::numeric;
      IF v_alloc_amount <= 0 THEN
        RAISE EXCEPTION 'INVALID_ALLOCATION_AMOUNT: Allocation amount must be positive, got %', v_alloc_amount;
      END IF;

      IF (v_alloc_item->>'payable_item_id') IS NULL THEN
        RAISE EXCEPTION 'PAYABLE_ITEM_REQUIRED: Explicit allocation requires payable_item_id';
      END IF;

      v_alloc_item_id := (v_alloc_item->>'payable_item_id')::uuid;

      SELECT id, order_id
      INTO v_payable_item
      FROM public.order_payable_items
      WHERE id = v_alloc_item_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'PAYABLE_ITEM_NOT_FOUND: Payable item % does not exist', v_alloc_item_id;
      END IF;

      IF v_payable_item.order_id <> p_order_id THEN
        RAISE EXCEPTION 'CROSS_ORDER_ITEM_MISMATCH: Payable item % belongs to order %, not order %',
          v_alloc_item_id, v_payable_item.order_id, p_order_id;
      END IF;

      v_alloc_sum := v_alloc_sum + v_alloc_amount;
    END LOOP;

    IF v_alloc_sum <> v_total_payment THEN
      RAISE EXCEPTION 'ALLOCATION_TOTAL_MISMATCH: Sum of allocations % does not equal total payment %',
        v_alloc_sum, v_total_payment;
    END IF;
  END IF;

  -- 10. Atomic Execution: Insert Transaction Header
  v_business_date := COALESCE(p_business_date, CURRENT_DATE);

  INSERT INTO public.financial_transactions (
    id,
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
    gen_random_uuid(),
    v_order.branch_id,
    'customer_payment',
    v_business_date,
    v_now,
    v_now,
    v_staff.id,
    'PHP',
    'posted',
    p_idempotency_key,
    'booking_order',
    p_order_id::text,
    p_external_reference,
    p_notes
  ) RETURNING id INTO v_transaction_id;

  -- 11. Atomic Execution: Insert Movements
  FOR v_part IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_part_amount := (v_part->>'amount')::numeric;
    v_part_method := (v_part->>'payment_method');
    v_part_account_id := (v_part->>'financial_account_id')::uuid;
    v_part_ext_ref := (v_part->>'external_reference');

    INSERT INTO public.financial_account_movements (
      id,
      transaction_id,
      financial_account_id,
      amount,
      payment_method,
      external_reference
    ) VALUES (
      gen_random_uuid(),
      v_transaction_id,
      v_part_account_id,
      v_part_amount,
      v_part_method,
      v_part_ext_ref
    ) RETURNING id INTO v_movement_id;

    v_movement_ids := array_append(v_movement_ids, v_movement_id);
    v_movement_amounts := array_append(v_movement_amounts, v_part_amount);
    v_movement_rem := array_append(v_movement_rem, v_part_amount);

    v_movements_json := v_movements_json || jsonb_build_object(
      'id', v_movement_id,
      'financial_account_id', v_part_account_id,
      'amount', v_part_amount,
      'payment_method', v_part_method,
      'external_reference', v_part_ext_ref
    );
  END LOOP;

  -- 12. Atomic Execution: Insert Allocations
  IF p_allocations IS NULL OR jsonb_typeof(p_allocations) <> 'array' OR jsonb_array_length(p_allocations) = 0 THEN
    -- A. Default Order-Level Allocations: 1 allocation per movement for full movement amount
    FOR i IN 1..array_length(v_movement_ids, 1)
    LOOP
      DECLARE
        v_alloc_id UUID;
      BEGIN
        INSERT INTO public.financial_order_allocations (
          id,
          financial_account_movement_id,
          order_id,
          payable_item_id,
          amount,
          created_by
        ) VALUES (
          gen_random_uuid(),
          v_movement_ids[i],
          p_order_id,
          NULL,
          v_movement_amounts[i],
          v_staff.id
        ) RETURNING id INTO v_alloc_id;

        v_allocations_json := v_allocations_json || jsonb_build_object(
          'id', v_alloc_id,
          'financial_account_movement_id', v_movement_ids[i],
          'payable_item_id', NULL,
          'amount', v_movement_amounts[i]
        );
      END;
    END LOOP;
  ELSE
    -- B. Explicit Item-Level Allocations
    -- Distribute items against movements deterministically without exceeding any movement
    v_mov_idx := 1;
    FOR v_alloc_item IN SELECT * FROM jsonb_array_elements(p_allocations)
    LOOP
      v_alloc_amount := (v_alloc_item->>'amount')::numeric;
      v_alloc_item_id := (v_alloc_item->>'payable_item_id')::uuid;

      WHILE v_alloc_amount > 0 AND v_mov_idx <= array_length(v_movement_ids, 1)
      LOOP
        IF v_movement_rem[v_mov_idx] <= 0 THEN
          v_mov_idx := v_mov_idx + 1;
          CONTINUE;
        END IF;

        v_alloc_take := LEAST(v_alloc_amount, v_movement_rem[v_mov_idx]);

        DECLARE
          v_alloc_id UUID;
        BEGIN
          INSERT INTO public.financial_order_allocations (
            id,
            financial_account_movement_id,
            order_id,
            payable_item_id,
            amount,
            created_by
          ) VALUES (
            gen_random_uuid(),
            v_movement_ids[v_mov_idx],
            p_order_id,
            v_alloc_item_id,
            v_alloc_take,
            v_staff.id
          ) RETURNING id INTO v_alloc_id;

          v_allocations_json := v_allocations_json || jsonb_build_object(
            'id', v_alloc_id,
            'financial_account_movement_id', v_movement_ids[v_mov_idx],
            'payable_item_id', v_alloc_item_id,
            'amount', v_alloc_take
          );
        END;

        v_movement_rem[v_mov_idx] := v_movement_rem[v_mov_idx] - v_alloc_take;
        v_alloc_amount := v_alloc_amount - v_alloc_take;

        IF v_movement_rem[v_mov_idx] <= 0 THEN
          v_mov_idx := v_mov_idx + 1;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  -- 13. Derive Final State
  v_new_net_allocated := v_net_allocated + v_total_payment;
  v_new_remaining := v_total_payable - v_new_net_allocated;
  v_new_state := public.derive_order_payment_state(v_total_payable, v_new_net_allocated);

  RETURN jsonb_build_object(
    'success', true,
    'is_idempotent_replay', false,
    'transaction_id', v_transaction_id,
    'order_id', p_order_id,
    'branch_id', v_order.branch_id,
    'business_date', v_business_date,
    'total_paid', v_total_payment,
    'total_payable', v_total_payable,
    'net_allocated', v_new_net_allocated,
    'remaining_balance', v_new_remaining,
    'payment_state', v_new_state,
    'movements', v_movements_json,
    'allocations', v_allocations_json
  );
END;
$func$;

COMMENT ON FUNCTION public.post_order_payment_atomic(UUID, TEXT, JSONB, JSONB, DATE, TEXT, TEXT) IS
  'Canonical atomic payment writer for booking orders. Secures transaction header, movements, allocations, idempotency replay, and derived payment balance state.';


-- ─── PERMISSIONS & SECURITY GRANTS ──────────────────────────────────────────
-- Revoke execution from public and anon
REVOKE ALL ON FUNCTION public.post_order_payment_atomic(UUID, TEXT, JSONB, JSONB, DATE, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.post_order_payment_atomic(UUID, TEXT, JSONB, JSONB, DATE, TEXT, TEXT) FROM anon;

-- Grant execution to authenticated users and service_role
GRANT EXECUTE ON FUNCTION public.post_order_payment_atomic(UUID, TEXT, JSONB, JSONB, DATE, TEXT, TEXT) TO authenticated, service_role;

COMMIT;
