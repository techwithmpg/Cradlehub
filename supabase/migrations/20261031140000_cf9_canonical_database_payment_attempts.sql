-- =============================================================================
-- Migration: 20261031140000_cf9_canonical_database_payment_attempts.sql
-- Module: Cash Flow & Financial Ledger (CF9)
-- Purpose: Canonical database-enforced payment attempt tracking and concurrency.
-- Baseline: 82406113ffa750ca75d5f0d500ef6f558b66ad5a
-- Authority: Approved P0 Payment Architecture Contract (2026-10-31)
-- =============================================================================
-- Invariants:
-- 1. No JSONB metadata pollution on booking_orders or bookings.
-- 2. At most ONE active (in_flight) attempt per order or booking enforced by
--    PostgreSQL partial unique indexes.
-- 3. Automatic expiration-based unlocking is REJECTED. In-flight attempts remain
--    locked until committed (posted) or explicitly reconciled and abandoned.
-- 4. Reconcile & abandon requires:
--    a) Verified absence in public.financial_transactions (committed rows cannot be abandoned).
--    b) Authenticated staff identity check (initiating staff, branch manager, or owner).
--    c) Mandatory audit explanation (reason).
-- 5. Canonical payment RPCs (post_order_payment_atomic and post_booking_payment_atomic)
--    natively enforce attempt registration, concurrency, and completion.
-- =============================================================================

-- ─── 1. TABLE DEFINITION ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NULL REFERENCES public.booking_orders(id) ON DELETE RESTRICT,
  booking_id UUID NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'in_flight' 
    CHECK (status IN ('in_flight', 'posted', 'reconciled_abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  transaction_id UUID NULL REFERENCES public.financial_transactions(id) ON DELETE RESTRICT,
  abandoned_at TIMESTAMPTZ NULL,
  abandoned_by UUID NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  abandoned_reason TEXT NULL,
  CONSTRAINT chk_payment_target CHECK (
    (order_id IS NOT NULL AND booking_id IS NULL) OR
    (order_id IS NULL AND booking_id IS NOT NULL)
  ),
  CONSTRAINT uq_payment_attempts_key UNIQUE (idempotency_key)
);

COMMENT ON TABLE public.payment_attempts IS
  'Authoritative server-side tracking of in-flight, posted, and abandoned customer payment attempts.';

-- Partial Unique Indexes: Enforces at most ONE active attempt per order or booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_in_flight_order_attempt
  ON public.payment_attempts (order_id)
  WHERE status = 'in_flight';

CREATE UNIQUE INDEX IF NOT EXISTS idx_in_flight_booking_attempt
  ON public.payment_attempts (booking_id)
  WHERE status = 'in_flight';

CREATE INDEX IF NOT EXISTS idx_payment_attempts_branch_lookup
  ON public.payment_attempts (branch_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_order_lookup
  ON public.payment_attempts (order_id, status);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_booking_lookup
  ON public.payment_attempts (booking_id, status);

-- ─── 2. ROW LEVEL SECURITY ───────────────────────────────────────────────────

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

-- Owner: Cross-branch SELECT visibility
DROP POLICY IF EXISTS "payment_attempts_owner_read_all" ON public.payment_attempts;
CREATE POLICY "payment_attempts_owner_read_all"
  ON public.payment_attempts FOR SELECT
  TO authenticated
  USING (public.get_auth_role() = 'owner');

-- Branch Staff (CRM / Managers): SELECT visibility strictly for own branch
DROP POLICY IF EXISTS "payment_attempts_branch_read" ON public.payment_attempts;
CREATE POLICY "payment_attempts_branch_read"
  ON public.payment_attempts FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('manager', 'assistant_manager', 'store_manager', 'crm', 'csr', 'csr_head', 'csr_staff')
    AND branch_id = public.get_auth_branch_id()
  );

-- Service Role: Full access for server-side maintenance
DROP POLICY IF EXISTS "payment_attempts_service_role_all" ON public.payment_attempts;
CREATE POLICY "payment_attempts_service_role_all"
  ON public.payment_attempts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Fail-closed table permissions
REVOKE ALL ON TABLE public.payment_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.payment_attempts TO authenticated;
GRANT ALL ON TABLE public.payment_attempts TO service_role;

-- ─── 3. RECONCILE & ABANDON FUNCTION ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reconcile_abandon_payment_attempt(
  p_idempotency_key TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_uid UUID := auth.uid();
  v_staff RECORD;
  v_attempt RECORD;
  v_existing_tx RECORD;
BEGIN
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Authentication required to reconcile payment attempts';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'REASON_REQUIRED: A valid audit explanation is required to abandon an attempt';
  END IF;

  SELECT s.id, s.branch_id, s.system_role, s.is_active INTO v_staff
  FROM public.staff s WHERE s.auth_user_id = v_auth_uid;

  IF NOT FOUND OR NOT v_staff.is_active THEN
    RAISE EXCEPTION 'STAFF_UNAUTHORIZED: Caller is not an active staff member';
  END IF;

  SELECT * INTO v_attempt
  FROM public.payment_attempts
  WHERE idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATTEMPT_NOT_FOUND: No payment attempt found for key %', p_idempotency_key;
  END IF;

  IF v_attempt.status = 'posted' THEN
    RAISE EXCEPTION 'CANNOT_ABANDON_COMMITTED_TRANSACTION: Attempt has already posted to ledger';
  END IF;

  IF v_attempt.status = 'reconciled_abandoned' THEN
    RETURN jsonb_build_object('success', true, 'status', 'already_abandoned');
  END IF;

  -- Branch scoping check
  IF v_staff.system_role <> 'owner' AND v_staff.branch_id <> v_attempt.branch_id THEN
    RAISE EXCEPTION 'BRANCH_UNAUTHORIZED: Caller cannot manage attempts in branch %', v_attempt.branch_id;
  END IF;

  -- Identity authorization check (Owner, Manager, or Initiating Staff)
  IF v_staff.system_role NOT IN ('owner', 'manager', 'assistant_manager', 'store_manager')
     AND v_staff.id <> v_attempt.staff_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED_ATTEMPT_ABANDON: Only the initiating cashier or a manager may abandon an attempt';
  END IF;

  -- Verify financial_transactions: Guarantee no ledger record exists!
  SELECT id INTO v_existing_tx
  FROM public.financial_transactions
  WHERE idempotency_key = p_idempotency_key
     OR idempotency_key = 'cf8:' || COALESCE(v_attempt.order_id::text, v_attempt.booking_id::text) || ':' || p_idempotency_key;

  IF FOUND THEN
    UPDATE public.payment_attempts
    SET status = 'posted', transaction_id = v_existing_tx.id, updated_at = clock_timestamp()
    WHERE id = v_attempt.id;

    RAISE EXCEPTION 'CANNOT_ABANDON_COMMITTED_TRANSACTION: Transaction % already committed in financial ledger', v_existing_tx.id;
  END IF;

  -- Transition to reconciled_abandoned
  UPDATE public.payment_attempts
  SET status = 'reconciled_abandoned',
      abandoned_at = clock_timestamp(),
      abandoned_by = v_staff.id,
      abandoned_reason = trim(p_reason),
      updated_at = clock_timestamp()
  WHERE id = v_attempt.id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'reconciled_abandoned',
    'idempotency_key', p_idempotency_key,
    'abandoned_at', clock_timestamp()
  );
END;
$$;

COMMENT ON FUNCTION public.reconcile_abandon_payment_attempt(TEXT, TEXT) IS
  'Securely marks an uncommitted in-flight payment attempt as reconciled_abandoned after verifying ledger absence and caller authorization.';

REVOKE ALL ON FUNCTION public.reconcile_abandon_payment_attempt(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_abandon_payment_attempt(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.reconcile_abandon_payment_attempt(TEXT, TEXT) TO authenticated, service_role;

-- ─── 4. CANONICAL PAYMENT RPC: post_order_payment_atomic INTEGRATION ──────────

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
  v_existing_parts      JSONB;
  v_requested_parts     JSONB;
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
  v_mirror_booking_id   UUID;
  v_mirror_method       TEXT;
  v_mirror_method_count INT;
  v_cash_session_id     UUID;

  -- Attempt tracking variable
  v_active_attempt      RECORD;
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
  SELECT id, branch_id, organizer_customer_id, booking_date, metadata, currency
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
  IF v_staff.system_role NOT IN ('owner', 'manager', 'assistant_manager', 'store_manager', 'crm', 'csr', 'csr_head', 'csr_staff') THEN
    RAISE EXCEPTION 'PAYMENT_ROLE_UNAUTHORIZED: Caller cannot record order payments';
  END IF;
  IF v_staff.system_role <> 'owner' AND v_staff.branch_id <> v_order.branch_id THEN
    RAISE EXCEPTION 'BRANCH_UNAUTHORIZED: Staff % (branch %) unauthorized for order in branch %',
      v_staff.id, v_staff.branch_id, v_order.branch_id;
  END IF;
  IF v_order.currency IS DISTINCT FROM 'PHP' THEN
    RAISE EXCEPTION 'UNSUPPORTED_ORDER_CURRENCY: Cash Flow currently supports PHP orders only';
  END IF;

  -- 5b. Authoritative In-Flight Attempt Mutual Exclusion Gate
  SELECT id, staff_id, idempotency_key, created_at INTO v_active_attempt
  FROM public.payment_attempts
  WHERE order_id = p_order_id AND status = 'in_flight'
  FOR UPDATE;

  IF FOUND THEN
    IF v_active_attempt.idempotency_key <> p_idempotency_key THEN
      RAISE EXCEPTION 'CONCURRENT_PAYMENT_IN_PROGRESS: Order % is currently locked by active payment attempt %',
        p_order_id, v_active_attempt.idempotency_key;
    END IF;
  END IF;

  -- Build forward payable evidence only when an explicit payment is posted.
  IF NOT EXISTS (SELECT 1 FROM public.order_payable_items WHERE order_id = p_order_id) THEN
    IF EXISTS (
      SELECT 1 FROM public.bookings b WHERE b.order_id = p_order_id
        AND b.status NOT IN ('cancelled', 'no_show', 'expired')
        AND COALESCE((b.metadata->>'price_paid') ~ '^[0-9]+([.][0-9]{1,2})?$', FALSE) = FALSE
    ) THEN
      RAISE EXCEPTION 'BOOKING_PRICE_SNAPSHOT_REQUIRED: Cannot derive order payable safely';
    END IF;
    IF v_order.metadata ? 'home_service_fee'
       AND COALESCE((v_order.metadata->>'home_service_fee') ~ '^[0-9]+([.][0-9]{1,2})?$', FALSE) = FALSE THEN
      RAISE EXCEPTION 'ORDER_FEE_SNAPSHOT_INVALID: Cannot derive Home Service fee safely';
    END IF;
    INSERT INTO public.order_payable_items (
      order_id, booking_id, charge_type, description, amount,
      currency, sequence, source_type, source_id, created_by
    )
    SELECT p_order_id, b.id, 'service', 'Booking ' || left(b.id::text, 8),
           (b.metadata->>'price_paid')::numeric, 'PHP', row_number() OVER (ORDER BY b.id),
           'booking', b.id, v_staff.id
    FROM public.bookings b
    WHERE b.order_id = p_order_id
      AND b.status NOT IN ('cancelled', 'no_show', 'expired')
      AND (b.metadata->>'price_paid') ~ '^[0-9]+([.][0-9]{1,2})?$'
      AND (b.metadata->>'price_paid')::numeric > 0;
    IF (v_order.metadata->>'home_service_fee') ~ '^[0-9]+([.][0-9]{1,2})?$'
       AND (v_order.metadata->>'home_service_fee')::numeric > 0 THEN
      INSERT INTO public.order_payable_items (
        order_id, booking_id, charge_type, description, amount,
        currency, sequence, source_type, created_by
      ) VALUES (
        p_order_id, NULL, 'home_service_fee', 'Home Service travel',
        (v_order.metadata->>'home_service_fee')::numeric, 'PHP',
        (SELECT COALESCE(MAX(sequence), 0) + 1 FROM public.order_payable_items WHERE order_id = p_order_id),
        'booking_order', v_staff.id
      );
    END IF;
    IF NOT EXISTS (
         SELECT 1
         FROM public.bookings b
         WHERE b.order_id = p_order_id
           AND b.status IN ('cancelled', 'no_show', 'expired')
       )
       AND (v_order.metadata->>'total_amount') ~ '^[0-9]+([.][0-9]{1,2})?$'
       AND (SELECT COALESCE(SUM(amount), 0)
            FROM public.order_payable_items
            WHERE order_id = p_order_id)
           <> (v_order.metadata->>'total_amount')::numeric THEN
      RAISE EXCEPTION 'ORDER_PAYABLE_SNAPSHOT_MISMATCH: Order charge snapshot needs review';
    END IF;
  END IF;

  -- 6. Validate payment parts & rails
  FOR v_part IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    IF (v_part->>'amount') IS NULL THEN
      RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT: Payment part missing amount';
    END IF;

    IF (v_part->>'amount')::numeric <> round((v_part->>'amount')::numeric, 2) THEN
      RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT: Payment parts require cent precision';
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

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'account', part->>'financial_account_id',
      'method', part->>'payment_method',
      'amount', (part->>'amount')::numeric,
      'reference', part->>'external_reference'
    ) ORDER BY part->>'financial_account_id', part->>'payment_method',
      (part->>'amount')::numeric, part->>'external_reference'), '[]'::jsonb)
  INTO v_requested_parts
  FROM jsonb_array_elements(p_payments) part;

  -- 6b. Register In-Flight Attempt if not already present
  IF v_active_attempt.id IS NULL THEN
    INSERT INTO public.payment_attempts (
      order_id, branch_id, staff_id, idempotency_key, amount, status
    ) VALUES (
      p_order_id, v_order.branch_id, v_staff.id, p_idempotency_key, v_total_payment, 'in_flight'
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  -- 7. Idempotency Check (Retry-safe replay suppression)
  SELECT id, branch_id, transaction_type, status, business_date, source_type, source_id, external_reference
  INTO v_existing_tx
  FROM public.financial_transactions
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    SELECT COALESCE(SUM(amount), 0.00)
    INTO v_existing_total
    FROM public.financial_account_movements
    WHERE transaction_id = v_existing_tx.id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'account', fam.financial_account_id::text,
        'method', fam.payment_method,
        'amount', fam.amount,
        'reference', fam.external_reference
      ) ORDER BY fam.financial_account_id::text, fam.payment_method,
        fam.amount, fam.external_reference), '[]'::jsonb)
    INTO v_existing_parts
    FROM public.financial_account_movements fam
    WHERE fam.transaction_id = v_existing_tx.id;

    IF v_existing_tx.branch_id <> v_order.branch_id OR
       v_existing_tx.transaction_type <> 'customer_payment' OR
       v_existing_tx.status <> 'posted' OR
       (p_business_date IS NOT NULL AND v_existing_tx.business_date <> p_business_date) OR
       v_existing_tx.external_reference IS DISTINCT FROM p_external_reference OR
       v_existing_tx.source_id <> p_order_id::text OR
       v_existing_tx.source_type <> 'booking_order' OR
       v_existing_total <> v_total_payment OR
       v_existing_parts <> v_requested_parts THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Key % already used for conflicting transaction %',
        p_idempotency_key, v_existing_tx.id;
    END IF;

    -- Update attempt status to posted
    UPDATE public.payment_attempts
    SET status = 'posted', transaction_id = v_existing_tx.id, updated_at = clock_timestamp()
    WHERE idempotency_key = p_idempotency_key;

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

    SELECT COALESCE(SUM(amount), 0.00) INTO v_total_payable
    FROM public.order_payable_items WHERE order_id = p_order_id;

    SELECT COALESCE(SUM(amount), 0.00) INTO v_net_allocated
    FROM public.financial_order_allocations WHERE order_id = p_order_id;

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

  -- P1-A authoritative stale-collection protection.
  FOR v_mirror_booking_id IN
    SELECT b.id
    FROM public.bookings b
    WHERE b.order_id = p_order_id
      AND b.status IN ('cancelled', 'no_show', 'expired')
      AND EXISTS (
        SELECT 1
        FROM public.order_payable_items opi
        WHERE opi.order_id = p_order_id
          AND opi.booking_id = b.id
          AND opi.charge_type = 'service'
          AND opi.amount > 0
      )
    ORDER BY b.id
  LOOP
    PERFORM public.reconcile_closed_booking_service_charge(
      v_mirror_booking_id,
      v_staff.id
    );
  END LOOP;

  -- 8. Order Payable and Balance Validation
  SELECT COALESCE(SUM(amount), 0.00) INTO v_total_payable
  FROM public.order_payable_items WHERE order_id = p_order_id;

  SELECT COALESCE(SUM(amount), 0.00) INTO v_net_allocated
  FROM public.financial_order_allocations WHERE order_id = p_order_id;

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

  IF v_total_payment > v_remaining_balance THEN
    RAISE EXCEPTION 'PAYMENT_EXCEEDS_REMAINING_BALANCE: Total payment % exceeds remaining balance %',
      v_total_payment, v_remaining_balance;
  END IF;

  -- Enforce active cash session for physical cash
  FOR v_part IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    IF (v_part->>'payment_method') = 'cash' THEN
      v_part_account_id := (v_part->>'financial_account_id')::uuid;
      SELECT cs.id INTO v_cash_session_id
      FROM public.cash_sessions cs
      WHERE cs.branch_id = v_order.branch_id
        AND cs.cash_drawer_account_id = v_part_account_id
        AND cs.status = 'open'
      LIMIT 1;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'CASH_DRAWER_SESSION_REQUIRED: Open the selected cash drawer before recording a cash payment.';
      END IF;
    END IF;
  END LOOP;

  -- Insert Transaction Header
  v_business_date := COALESCE(p_business_date, CURRENT_DATE);

  INSERT INTO public.financial_transactions (
    id, branch_id, transaction_type, business_date, occurred_at, recorded_at,
    recorded_by, currency, status, idempotency_key, source_type, source_id,
    external_reference, notes
  ) VALUES (
    gen_random_uuid(), v_order.branch_id, 'customer_payment', v_business_date,
    v_now, v_now, v_staff.id, 'PHP', 'posted', p_idempotency_key, 'booking_order',
    p_order_id::text, p_external_reference, p_notes
  ) RETURNING id INTO v_transaction_id;

  -- Insert Movements
  FOR v_part IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_part_amount := (v_part->>'amount')::numeric;
    v_part_method := (v_part->>'payment_method');
    v_part_account_id := (v_part->>'financial_account_id')::uuid;
    v_part_ext_ref := (v_part->>'external_reference');

    INSERT INTO public.financial_account_movements (
      id, transaction_id, financial_account_id, movement_type, amount,
      currency, payment_method, external_reference, created_by
    ) VALUES (
      gen_random_uuid(), v_transaction_id, v_part_account_id, 'debit',
      v_part_amount, 'PHP', v_part_method, v_part_ext_ref, v_staff.id
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

  -- Allocations
  IF p_allocations IS NULL OR jsonb_array_length(p_allocations) = 0 THEN
    FOR i IN 1..array_length(v_movement_ids, 1)
    LOOP
      DECLARE
        v_alloc_id UUID;
      BEGIN
        INSERT INTO public.financial_order_allocations (
          id, financial_account_movement_id, order_id, payable_item_id, amount, created_by
        ) VALUES (
          gen_random_uuid(), v_movement_ids[i], p_order_id, NULL, v_movement_amounts[i], v_staff.id
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
            id, financial_account_movement_id, order_id, payable_item_id, amount, created_by
          ) VALUES (
            gen_random_uuid(), v_movement_ids[v_mov_idx], p_order_id, v_alloc_item_id, v_alloc_take, v_staff.id
          ) RETURNING id INTO v_alloc_id;

          v_allocations_json := v_allocations_json || jsonb_build_object(
            'id', v_alloc_id,
            'financial_account_movement_id', v_movement_ids[v_mov_idx],
            'payable_item_id', v_alloc_item_id,
            'amount', v_alloc_take
          );
        END;

        v_alloc_amount := v_alloc_amount - v_alloc_take;
        v_movement_rem[v_mov_idx] := v_movement_rem[v_mov_idx] - v_alloc_take;
      END LOOP;
    END LOOP;
  END IF;

  v_new_net_allocated := v_net_allocated + v_total_payment;
  v_new_remaining := v_total_payable - v_new_net_allocated;
  v_new_state := public.derive_order_payment_state(v_total_payable, v_new_net_allocated);

  -- Mirror legacy single booking if applicable
  SELECT b.id INTO v_mirror_booking_id
  FROM public.bookings b
  WHERE b.order_id = p_order_id
    AND b.status NOT IN ('cancelled', 'no_show', 'expired')
    AND b.amount_paid = v_net_allocated
    AND (SELECT count(*) FROM public.bookings other WHERE other.order_id = p_order_id) = 1
    AND NOT EXISTS (
       SELECT 1 FROM public.order_payable_items opi
       WHERE opi.order_id = p_order_id
         AND (opi.charge_type <> 'service' OR opi.booking_id IS DISTINCT FROM b.id)
     );

  IF v_mirror_booking_id IS NOT NULL THEN
    SELECT count(DISTINCT fam.payment_method), min(fam.payment_method)
      INTO v_mirror_method_count, v_mirror_method
    FROM public.financial_order_allocations foa
    JOIN public.financial_account_movements fam
      ON fam.id = foa.financial_account_movement_id
    WHERE foa.order_id = p_order_id;
    IF v_mirror_method_count <> 1 THEN v_mirror_method := 'other'; END IF;
    UPDATE public.bookings
    SET amount_paid = v_new_net_allocated,
        payment_status = CASE WHEN v_new_state = 'paid' THEN 'paid' ELSE 'pending' END,
        payment_method = v_mirror_method,
        payment_reference = COALESCE(p_external_reference, payment_reference)
    WHERE id = v_mirror_booking_id;
  END IF;

  -- 11. Finalize Attempt Status in Same Transaction
  INSERT INTO public.payment_attempts (
    order_id, branch_id, staff_id, idempotency_key, amount, status, transaction_id
  ) VALUES (
    p_order_id, v_order.branch_id, v_staff.id, p_idempotency_key, v_total_payment, 'posted', v_transaction_id
  )
  ON CONFLICT (idempotency_key) DO UPDATE
  SET status = 'posted', transaction_id = v_transaction_id, updated_at = clock_timestamp();

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

REVOKE ALL ON FUNCTION public.post_order_payment_atomic(UUID, TEXT, JSONB, JSONB, DATE, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.post_order_payment_atomic(UUID, TEXT, JSONB, JSONB, DATE, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.post_order_payment_atomic(UUID, TEXT, JSONB, JSONB, DATE, TEXT, TEXT) TO authenticated, service_role;

-- ─── 5. CANONICAL PAYMENT RPC: post_booking_payment_atomic INTEGRATION ────────

CREATE OR REPLACE FUNCTION public.post_booking_payment_atomic(
  p_booking_id UUID,
  p_payment_method TEXT,
  p_payment_status TEXT,
  p_amount_paid NUMERIC,
  p_payment_reference TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_next_status TEXT DEFAULT NULL,
  p_clear_hold BOOLEAN DEFAULT FALSE,
  p_idempotency_key TEXT DEFAULT NULL,
  p_payments JSONB DEFAULT NULL,
  p_business_date DATE DEFAULT NULL,
  p_financial_account_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $booking$
DECLARE
  v_staff RECORD;
  v_booking RECORD;
  v_existing RECORD;
  v_delta NUMERIC(12,2);
  v_total NUMERIC(12,2) := 0;
  v_parts JSONB;
  v_parts_normalized JSONB := '[]'::jsonb;
  v_part JSONB;
  v_rail TEXT;
  v_account_type TEXT;
  v_account_id UUID;
  v_account RECORD;
  v_account_count INTEGER;
  v_amount NUMERIC(12,2);
  v_transaction_id UUID;
  v_order_result JSONB;
  v_warning TEXT;
  v_key TEXT;
  v_order_branch_id UUID;
  v_order_metadata JSONB;
  v_order_currency TEXT;
  v_expected_source_type TEXT;
  v_expected_source_id TEXT;
  v_cash_session_id UUID;
  v_active_attempt RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Payment posting requires an authenticated user';
  END IF;
  SELECT s.id, s.branch_id, s.system_role, s.is_active INTO v_staff
  FROM public.staff s WHERE s.auth_user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_NOT_FOUND: No staff record for caller'; END IF;
  IF NOT v_staff.is_active THEN RAISE EXCEPTION 'STAFF_INACTIVE: Caller is inactive'; END IF;
  IF v_staff.system_role NOT IN (
    'owner', 'manager', 'assistant_manager', 'store_manager', 'crm', 'csr', 'csr_head', 'csr_staff'
  ) THEN
    RAISE EXCEPTION 'PAYMENT_ROLE_UNAUTHORIZED: Caller cannot record booking payments';
  END IF;

  SELECT b.id, b.branch_id, b.order_id, b.amount_paid,
         b.payment_method, b.payment_reference, b.payment_status, b.status
    INTO v_booking
  FROM public.bookings b WHERE b.id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND: Booking does not exist'; END IF;
  IF p_branch_id IS NOT NULL AND p_branch_id <> v_booking.branch_id THEN
    RAISE EXCEPTION 'BRANCH_UNAUTHORIZED: Requested branch does not match booking';
  END IF;
  IF v_staff.system_role <> 'owner' AND v_staff.branch_id <> v_booking.branch_id THEN
    RAISE EXCEPTION 'BRANCH_UNAUTHORIZED: Caller cannot update this branch';
  END IF;
  IF v_booking.order_id IS NOT NULL THEN
    SELECT bo.branch_id, bo.metadata, bo.currency
      INTO v_order_branch_id, v_order_metadata, v_order_currency
    FROM public.booking_orders bo WHERE bo.id = v_booking.order_id FOR UPDATE;
    IF NOT FOUND OR v_order_branch_id <> v_booking.branch_id THEN
      RAISE EXCEPTION 'BOOKING_ORDER_BRANCH_MISMATCH: Booking and order branches differ';
    END IF;
    IF v_order_currency IS DISTINCT FROM 'PHP' THEN
      RAISE EXCEPTION 'UNSUPPORTED_ORDER_CURRENCY: Cash Flow currently supports PHP orders only';
    END IF;
    -- This command's cumulative amount is a booking-level input. For a
    -- multi-line or order-only-charge order, it cannot represent order money.
    -- Those payments remain available through CF4 Record Payment.
    IF (SELECT count(*) FROM public.bookings b WHERE b.order_id = v_booking.order_id) <> 1
       OR EXISTS (
         SELECT 1 FROM public.order_payable_items opi
         WHERE opi.order_id = v_booking.order_id
           AND (opi.charge_type <> 'service' OR opi.booking_id <> v_booking.id)
       )
       OR COALESCE((v_order_metadata->>'home_service_fee')::numeric, 0) <> 0 THEN
      RAISE EXCEPTION 'ORDER_LEVEL_PAYMENT_REQUIRED: Use order payment for multi-line or order-only charges';
    END IF;
  END IF;
  IF p_next_status IS NOT NULL AND (
    p_next_status <> 'confirmed' OR
    v_booking.status NOT IN ('pending_payment', 'pending_crm_confirmation', 'pending', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'BOOKING_STATUS_UNAUTHORIZED: Payment cannot change booking to requested status';
  END IF;
  IF p_clear_hold AND p_next_status IS DISTINCT FROM 'confirmed' THEN
    RAISE EXCEPTION 'BOOKING_HOLD_UNAUTHORIZED: Hold may only clear on confirmation';
  END IF;
  IF p_payment_status IS NULL OR p_payment_status NOT IN ('unpaid', 'pending', 'paid', 'refunded') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATUS: Unsupported booking payment status';
  END IF;
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('cash', 'gcash', 'maya', 'card', 'bank_transfer', 'pay_on_site', 'other') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD: Unsupported booking payment method';
  END IF;
  IF p_amount_paid IS NULL OR p_amount_paid < 0 OR round(p_amount_paid, 2) <> p_amount_paid THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT: Cumulative amount must be nonnegative PHP cents';
  END IF;
  v_delta := p_amount_paid - COALESCE(v_booking.amount_paid, 0);

  -- P1-A: a cancelled/no-show/expired booking may retain historical received money,
  -- but it cannot accept additional ordinary collection.
  IF v_booking.status IN ('cancelled', 'no_show', 'expired') AND v_delta > 0 THEN
    RAISE EXCEPTION
      'CLOSED_BOOKING_PAYMENT_NOT_COLLECTIBLE: Booking % is % and cannot accept additional payment',
      v_booking.id,
      v_booking.status;
  END IF;
  IF p_idempotency_key IS NOT NULL
     AND (NULLIF(trim(p_idempotency_key), '') IS NULL OR length(p_idempotency_key) > 255) THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY: Key must contain 1 to 255 characters';
  END IF;

  IF v_booking.order_id IS NULL THEN
    v_expected_source_type := 'legacy_booking';
    v_expected_source_id := v_booking.id::text;
  ELSE
    v_expected_source_type := 'booking_order';
    v_expected_source_id := v_booking.order_id::text;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    v_key := 'cf8:' || p_booking_id::text || ':' || p_idempotency_key;
    PERFORM pg_advisory_xact_lock(hashtext('idem_cf4_' || v_key));

    -- For legacy non-order bookings, check in-flight payment attempt
    IF v_booking.order_id IS NULL AND v_delta > 0 THEN
      SELECT id, staff_id, idempotency_key, created_at INTO v_active_attempt
      FROM public.payment_attempts
      WHERE booking_id = p_booking_id AND status = 'in_flight'
      FOR UPDATE;

      IF FOUND THEN
        IF v_active_attempt.idempotency_key <> v_key THEN
          RAISE EXCEPTION 'CONCURRENT_PAYMENT_IN_PROGRESS: Booking % is currently locked by active payment attempt %',
            p_booking_id, v_active_attempt.idempotency_key;
        END IF;
      ELSE
        INSERT INTO public.payment_attempts (
          booking_id, branch_id, staff_id, idempotency_key, amount, status
        ) VALUES (
          p_booking_id, v_booking.branch_id, v_staff.id, v_key, v_delta, 'in_flight'
        )
        ON CONFLICT (idempotency_key) DO NOTHING;
      END IF;
    END IF;

    SELECT tx.id, tx.source_type, tx.source_id INTO v_existing
    FROM public.financial_transactions tx WHERE tx.idempotency_key = v_key;
    IF FOUND THEN
      IF v_existing.source_type IS DISTINCT FROM v_expected_source_type
         OR v_existing.source_id IS DISTINCT FROM v_expected_source_id
         OR v_delta IS DISTINCT FROM 0
         OR v_booking.payment_method IS DISTINCT FROM p_payment_method
         OR v_booking.payment_status IS DISTINCT FROM p_payment_status
         OR v_booking.payment_reference IS DISTINCT FROM p_payment_reference THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Key already belongs to a different payment';
      END IF;

      -- Finalize attempt status on idempotent replay
      UPDATE public.payment_attempts
      SET status = 'posted', transaction_id = v_existing.id, updated_at = clock_timestamp()
      WHERE idempotency_key = v_key;

      RETURN jsonb_build_object(
        'booking_id', v_booking.id, 'branch_id', v_booking.branch_id,
        'transaction_id', v_existing.id, 'payment_delta', 0,
        'is_idempotent_replay', true, 'reconciliation_warning', NULL
      );
    END IF;
  END IF;

  IF v_delta < 0 OR (v_booking.payment_status = 'paid' AND p_payment_status <> 'paid') THEN
    IF NULLIF(trim(COALESCE(p_reason, '')), '') IS NULL THEN
      RAISE EXCEPTION 'PAYMENT_CORRECTION_REASON_REQUIRED: State decrease needs a reason';
    END IF;
    v_warning := 'PAYMENT_CORRECTION_REQUIRES_FINANCIAL_RECONCILIATION';
  END IF;

  IF v_delta <= 0 AND p_payments IS NOT NULL THEN
    RAISE EXCEPTION 'PAYMENT_DELTA_MISMATCH: Tenders cannot be ignored when no new money is recorded';
  END IF;

  IF v_delta > 0 THEN
    IF NULLIF(trim(COALESCE(p_idempotency_key, '')), '') IS NULL THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED: Positive payment needs a key';
    END IF;
    IF p_payment_method = 'pay_on_site' OR p_payment_status IN ('unpaid', 'refunded') THEN
      RAISE EXCEPTION 'PAYMENT_COLLECTION_REQUIRED: Intent or refund state cannot post a receipt';
    END IF;
    IF p_payments IS NOT NULL AND p_financial_account_id IS NOT NULL THEN
      RAISE EXCEPTION 'ACCOUNT_INPUT_CONFLICT: Use tender accounts or a single account, not both';
    END IF;
    IF p_payments IS NULL THEN
      v_parts := jsonb_build_array(jsonb_build_object(
        'amount', v_delta, 'payment_method', p_payment_method,
        'financial_account_id', p_financial_account_id,
        'external_reference', p_payment_reference
      ));
    ELSE
      v_parts := p_payments;
    END IF;
    IF jsonb_typeof(v_parts) <> 'array' OR jsonb_array_length(v_parts) = 0 THEN
      RAISE EXCEPTION 'PAYMENTS_REQUIRED: Provide at least one collected tender';
    END IF;
    IF jsonb_array_length(v_parts) > 1 AND p_payment_method <> 'other' THEN
      RAISE EXCEPTION 'SPLIT_TENDER_METHOD_REQUIRED: Use other for the booking display mirror';
    END IF;

    FOR v_part IN SELECT value FROM jsonb_array_elements(v_parts)
    LOOP
      IF jsonb_typeof(v_part) <> 'object' THEN
        RAISE EXCEPTION 'INVALID_TENDER: Payment tender must be an object';
      END IF;
      v_amount := (v_part->>'amount')::numeric;
      IF v_amount IS NULL OR v_amount <= 0 OR round(v_amount, 2) <> v_amount THEN
        RAISE EXCEPTION 'INVALID_TENDER_AMOUNT: Tender must be positive PHP cents';
      END IF;
      v_rail := v_part->>'payment_method';
      IF v_rail NOT IN ('cash', 'gcash', 'maya', 'bank_transfer', 'card') OR v_rail IS NULL THEN
        RAISE EXCEPTION 'INVALID_PAYMENT_RAIL: Unsupported collected tender';
      END IF;
      IF jsonb_array_length(v_parts) = 1 AND p_payment_method <> v_rail THEN
        RAISE EXCEPTION 'PAYMENT_RAIL_MISMATCH: Booking method and tender differ';
      END IF;
      v_account_type := CASE v_rail
        WHEN 'cash' THEN 'cash_drawer'
        WHEN 'card' THEN 'card_terminal'
        ELSE v_rail END;
      IF NULLIF(v_part->>'financial_account_id', '') IS NULL THEN
        SELECT COUNT(*), MIN(fa.id) INTO v_account_count, v_account_id
        FROM public.financial_accounts fa
        WHERE fa.is_active AND fa.currency = 'PHP'
          AND (fa.branch_id = v_booking.branch_id OR fa.branch_id IS NULL)
          AND fa.account_type = v_account_type;
        IF v_account_count = 0 THEN
          RAISE EXCEPTION 'ACCOUNT_NOT_CONFIGURED: No compatible active PHP account';
        ELSIF v_account_count > 1 THEN
          RAISE EXCEPTION 'ACCOUNT_SELECTION_REQUIRED: Select the payment account explicitly';
        END IF;
      ELSE
        v_account_id := (v_part->>'financial_account_id')::uuid;
      END IF;
      SELECT fa.id, fa.branch_id, fa.account_type, fa.currency, fa.is_active INTO v_account
      FROM public.financial_accounts fa WHERE fa.id = v_account_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: Account does not exist'; END IF;
      IF NOT v_account.is_active THEN RAISE EXCEPTION 'ACCOUNT_INACTIVE: Account is inactive'; END IF;
      IF v_account.branch_id IS NOT NULL AND v_account.branch_id <> v_booking.branch_id THEN
        RAISE EXCEPTION 'ACCOUNT_BRANCH_MISMATCH: Account belongs to another branch';
      END IF;
      IF v_account.currency <> 'PHP' THEN
        RAISE EXCEPTION 'INVALID_CURRENCY: Payment account must use PHP';
      END IF;
      IF v_account.account_type <> v_account_type THEN
        RAISE EXCEPTION 'ACCOUNT_TYPE_MISMATCH: Account is incompatible with payment rail';
      END IF;
      IF v_rail = 'cash' THEN
        v_cash_session_id := NULL;
        SELECT cs.id INTO v_cash_session_id
        FROM public.cash_sessions cs
        WHERE cs.cash_drawer_account_id = v_account_id
          AND cs.branch_id = v_booking.branch_id
          AND cs.status = 'open'
        FOR SHARE;
        IF v_cash_session_id IS NULL THEN
          RAISE EXCEPTION 'CASH_DRAWER_SESSION_REQUIRED: Open the selected cash drawer before recording a cash payment.';
        END IF;
      END IF;
      v_total := v_total + v_amount;
      v_parts_normalized := v_parts_normalized || jsonb_build_object(
        'amount', v_amount, 'payment_method', v_rail,
        'financial_account_id', v_account_id,
        'external_reference', v_part->>'external_reference'
      );
    END LOOP;
    IF v_total <> v_delta THEN
      RAISE EXCEPTION 'PAYMENT_DELTA_MISMATCH: Tenders must equal the new collected delta';
    END IF;

    IF v_booking.order_id IS NOT NULL THEN
      v_order_result := public.post_order_payment_atomic(
        v_booking.order_id, v_key, v_parts_normalized,
        NULL, COALESCE(p_business_date, CURRENT_DATE), p_payment_reference, p_reason
      );
      v_transaction_id := (v_order_result->>'transaction_id')::uuid;
    ELSE
      INSERT INTO public.financial_transactions (
        branch_id, transaction_type, business_date, occurred_at, recorded_at,
        recorded_by, currency, status, idempotency_key, source_type, source_id,
        external_reference, notes
      ) VALUES (
        v_booking.branch_id, 'customer_payment', COALESCE(p_business_date, CURRENT_DATE),
        clock_timestamp(), clock_timestamp(), v_staff.id, 'PHP', 'posted',
        v_key, 'legacy_booking', v_booking.id::text,
        p_payment_reference, p_reason
      ) RETURNING id INTO v_transaction_id;
      FOR v_part IN SELECT value FROM jsonb_array_elements(v_parts_normalized)
      LOOP
        INSERT INTO public.financial_account_movements (
          transaction_id, financial_account_id, amount, payment_method, external_reference
        ) VALUES (
          v_transaction_id, (v_part->>'financial_account_id')::uuid,
          (v_part->>'amount')::numeric, v_part->>'payment_method',
          v_part->>'external_reference'
        );
      END LOOP;

      -- Finalize legacy booking attempt status in same transaction
      INSERT INTO public.payment_attempts (
        booking_id, branch_id, staff_id, idempotency_key, amount, status, transaction_id
      ) VALUES (
        p_booking_id, v_booking.branch_id, v_staff.id, v_key, v_delta, 'posted', v_transaction_id
      )
      ON CONFLICT (idempotency_key) DO UPDATE
      SET status = 'posted', transaction_id = v_transaction_id, updated_at = clock_timestamp();
    END IF;
  END IF;

  PERFORM public.record_booking_payment_change(
    p_booking_id, p_payment_method, p_payment_status, p_amount_paid,
    p_payment_reference, p_reason, v_staff.id, v_booking.branch_id,
    p_next_status, p_clear_hold
  );
  RETURN jsonb_build_object(
    'booking_id', v_booking.id, 'branch_id', v_booking.branch_id,
    'transaction_id', v_transaction_id, 'payment_delta', v_delta,
    'is_idempotent_replay', false, 'reconciliation_warning', v_warning
  );
END;
$booking$;

REVOKE ALL ON FUNCTION public.post_booking_payment_atomic(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, UUID, TEXT, BOOLEAN, TEXT, JSONB, DATE, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.post_booking_payment_atomic(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, UUID, TEXT, BOOLEAN, TEXT, JSONB, DATE, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.post_booking_payment_atomic(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, UUID, TEXT, BOOLEAN, TEXT, JSONB, DATE, UUID) TO authenticated, service_role;
