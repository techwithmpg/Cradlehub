-- CF8 explicit booking payment command. Repository draft only; NOT APPLIED.
-- Refactors CF4 to use staff.system_role and strictly pinned search_path.
BEGIN;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_method_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_payment_method_check
  CHECK (payment_method IN ('cash', 'gcash', 'maya', 'card', 'bank_transfer', 'pay_on_site', 'other'));

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

  -- Build forward payable evidence only when an explicit payment is posted.
  -- This does not convert or replay any historical payment snapshot.
  IF NOT EXISTS (SELECT 1 FROM public.order_payable_items WHERE order_id = p_order_id) THEN
    IF EXISTS (
      SELECT 1 FROM public.bookings b WHERE b.order_id = p_order_id
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
    IF (v_order.metadata->>'total_amount') ~ '^[0-9]+([.][0-9]{1,2})?$'
       AND (SELECT COALESCE(SUM(amount), 0) FROM public.order_payable_items WHERE order_id = p_order_id)
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

  -- 7. Idempotency Check (Retry-safe replay suppression)
  SELECT id, branch_id, transaction_type, status, business_date, source_type, source_id, external_reference
  INTO v_existing_tx
  FROM public.financial_transactions
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    -- Check for conflicting payload under same key
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

  -- Only a single service booking with no order-only payable can inherit the
  -- cumulative order amount. Multi-line and fee/discount orders retain their
  -- order-level truth; an order-level allocation has no booking attribution.
  SELECT b.id
    INTO v_mirror_booking_id
  FROM public.bookings b
  WHERE b.order_id = p_order_id
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

-- The payment command owns the booking snapshot update in the same transaction.
-- A booking field update alone is never a receipt.
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Payment posting requires an authenticated user';
  END IF;
  SELECT s.id, s.branch_id, s.system_role, s.is_active INTO v_staff
  FROM public.staff s WHERE s.auth_user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_NOT_FOUND: No staff record for caller'; END IF;
  IF NOT v_staff.is_active THEN RAISE EXCEPTION 'STAFF_INACTIVE: Caller is inactive'; END IF;
  IF v_staff.system_role NOT IN (
    'owner', 'manager', 'assistant_manager', 'store_manager', 'crm'
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

COMMENT ON FUNCTION public.post_booking_payment_atomic(
  UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, UUID, TEXT, BOOLEAN, TEXT, JSONB, DATE, UUID
) IS 'Explicit authenticated booking payment command; posts only new money and updates the booking snapshot atomically.';

REVOKE ALL ON FUNCTION public.post_booking_payment_atomic(
  UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, UUID, TEXT, BOOLEAN, TEXT, JSONB, DATE, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_booking_payment_atomic(
  UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, UUID, TEXT, BOOLEAN, TEXT, JSONB, DATE, UUID
) TO authenticated, service_role;

-- Callers must use the explicit command; the old snapshot writer is internal.
REVOKE EXECUTE ON FUNCTION public.record_booking_payment_change(
  UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, UUID, UUID, TEXT, BOOLEAN
) FROM authenticated, service_role;

-- Server-only composition: BKG3, payables, and CF4 share this RPC transaction.
-- p_actor_auth_user_id comes only from a verified server session/bearer token.
CREATE OR REPLACE FUNCTION public.create_inhouse_order_with_payment_atomic(
  p_actor_auth_user_id UUID, p_idempotency_key TEXT, p_order JSONB,
  p_attendees JSONB, p_service_lines JSONB, p_options JSONB
)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $create$
DECLARE
  v_staff RECORD;
  v_branch UUID;
  v_order JSONB;
  v_result JSONB;
  v_order_id UUID;
  v_booking_id UUID;
  v_line JSONB;
  v_index INT := 0;
  v_price NUMERIC(12,2);
  v_fee NUMERIC(12,2);
  v_total NUMERIC(12,2) := 0;
  v_paid BOOLEAN;
  v_parts JSONB;
  v_normalized JSONB := '[]'::jsonb;
  v_part JSONB;
  v_method TEXT;
  v_account_type TEXT;
  v_account_id UUID;
  v_count INT;
  v_amount NUMERIC(12,2);
  v_tender_total NUMERIC(12,2) := 0;
  v_account RECORD;
  v_payment JSONB;
  v_existing UUID;
  v_order_currency TEXT;
  v_ordered_ids JSONB;
BEGIN
  IF p_actor_auth_user_id IS NULL OR p_idempotency_key IS NULL
     OR length(trim(p_idempotency_key)) < 1 OR length(p_idempotency_key) > 240
     OR jsonb_typeof(p_options) <> 'object'
     OR jsonb_typeof(p_service_lines) <> 'array'
     OR jsonb_array_length(p_service_lines) < 1 THEN
    RAISE EXCEPTION 'INVALID_CREATION_PAYLOAD: Actor, key, options and lines required';
  END IF;
  v_branch := (p_order->>'branch_id')::uuid;
  SELECT s.id, s.branch_id, s.system_role, s.is_active INTO v_staff
  FROM public.staff s WHERE s.auth_user_id = p_actor_auth_user_id;
  IF NOT FOUND OR NOT v_staff.is_active OR v_staff.system_role NOT IN (
    'owner', 'manager', 'assistant_manager', 'store_manager', 'crm'
  ) THEN RAISE EXCEPTION 'CREATION_ROLE_UNAUTHORIZED: Active staff actor required'; END IF;
  IF v_staff.system_role <> 'owner' AND v_staff.branch_id IS DISTINCT FROM v_branch THEN
    RAISE EXCEPTION 'BRANCH_UNAUTHORIZED: Actor cannot create for this branch';
  END IF;
  IF p_options->>'type' NOT IN ('walkin', 'home_service')
     OR (p_options->>'type' = 'home_service') IS DISTINCT FROM
        (p_order->>'delivery_type' = 'home_service') THEN
    RAISE EXCEPTION 'DELIVERY_TYPE_MISMATCH: In-house type and delivery must agree';
  END IF;
  v_paid := COALESCE((p_options->>'payment_received')::boolean, false);
  v_fee := COALESCE((p_order->'metadata'->>'home_service_fee')::numeric, 0);
  IF v_fee < 0 OR round(v_fee, 2) <> v_fee OR
     (v_fee > 0 AND p_order->>'delivery_type' <> 'home_service') THEN
    RAISE EXCEPTION 'INVALID_HOME_SERVICE_FEE';
  END IF;
  -- Resolve account ambiguity before BKG3 makes any booking/order write.
  IF v_paid THEN
    IF NULLIF(p_options->'payments', 'null'::jsonb) IS NULL THEN
      v_parts := jsonb_build_array(jsonb_build_object(
        'payment_method', p_options->>'payment_method',
        'financial_account_id', p_options->>'financial_account_id'
      ));
    ELSE
      v_parts := p_options->'payments';
    END IF;
    IF jsonb_typeof(v_parts) <> 'array' OR jsonb_array_length(v_parts) < 1 THEN
      RAISE EXCEPTION 'INVALID_TENDER';
    END IF;
    FOR v_part IN SELECT value FROM jsonb_array_elements(v_parts) LOOP
      v_method := v_part->>'payment_method';
      IF v_method IS NULL OR v_method NOT IN (
        'cash', 'gcash', 'maya', 'card', 'bank_transfer') THEN
        RAISE EXCEPTION 'INVALID_PAYMENT_RAIL';
      END IF;
      v_account_type := CASE v_method
        WHEN 'cash' THEN 'cash_drawer' WHEN 'card' THEN 'card_terminal'
        ELSE v_method END;
      v_account_id := NULLIF(v_part->>'financial_account_id', '')::uuid;
      IF v_account_id IS NULL THEN
        SELECT count(*), min(fa.id) INTO v_count, v_account_id
        FROM public.financial_accounts fa
        WHERE fa.is_active AND fa.currency = 'PHP'
          AND (fa.branch_id = v_branch OR fa.branch_id IS NULL)
          AND fa.account_type = v_account_type;
        IF v_count = 0 THEN RAISE EXCEPTION 'ACCOUNT_NOT_CONFIGURED'; END IF;
        IF v_count > 1 THEN RAISE EXCEPTION 'ACCOUNT_SELECTION_REQUIRED'; END IF;
      ELSE
        SELECT fa.id, fa.branch_id, fa.account_type, fa.currency, fa.is_active
          INTO v_account FROM public.financial_accounts fa WHERE fa.id = v_account_id;
        IF NOT FOUND OR NOT v_account.is_active OR v_account.currency <> 'PHP'
           OR v_account.account_type <> v_account_type
           OR (v_account.branch_id IS NOT NULL AND v_account.branch_id <> v_branch) THEN
          RAISE EXCEPTION 'ACCOUNT_BRANCH_OR_RAIL_MISMATCH';
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- BKG3 hashes the order payload, including the payment/operational intent
  -- digest. A replay cannot change collection details under the same key.
  v_order := jsonb_set(p_order, '{metadata}',
    COALESCE(p_order->'metadata', '{}'::jsonb) || jsonb_build_object(
      'cf8_inhouse', true,
      'cf8_creation_options_hash',
      pg_catalog.encode(extensions.digest(p_options::text::bytea, 'sha256'), 'hex')
    ));
  v_result := public.create_booking_order_atomic(
    p_idempotency_key, v_order, p_attendees, p_service_lines);
  v_order_id := (v_result->>'order_id')::uuid;
  SELECT bo.currency INTO v_order_currency
  FROM public.booking_orders bo WHERE bo.id = v_order_id;
  IF v_paid AND v_order_currency IS DISTINCT FROM 'PHP' THEN
    RAISE EXCEPTION 'UNSUPPORTED_ORDER_CURRENCY: Cash Flow currently supports PHP orders only';
  END IF;
  IF v_result->>'idempotency_status' = 'replayed' THEN
    IF v_paid THEN
      SELECT tx.id INTO v_existing FROM public.financial_transactions tx
      WHERE tx.idempotency_key = 'cf8create:' || p_idempotency_key
        AND tx.source_type = 'booking_order' AND tx.source_id = v_order_id::text;
      IF v_existing IS NULL THEN RAISE EXCEPTION 'PAID_CREATION_RECEIPT_MISSING'; END IF;
    END IF;
    RETURN v_result || jsonb_build_object('transaction_id', v_existing);
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_service_lines) LOOP
    v_index := v_index + 1;
    SELECT b.id INTO STRICT v_booking_id FROM public.bookings b
    WHERE b.order_id = v_order_id AND b.line_sequence = v_index;
    v_price := (v_line->'metadata'->>'price_paid')::numeric;
    IF v_price IS NULL OR v_price < 0 OR round(v_price, 2) <> v_price THEN
      RAISE EXCEPTION 'INVALID_SERVICE_PRICE';
    END IF;
    v_total := v_total + v_price;
    UPDATE public.bookings b SET
      type = p_options->>'type',
      payment_status = 'pending',
      resource_id = NULLIF(p_options->>'resource_id', '')::uuid,
      booking_progress_status = CASE
        WHEN COALESCE((p_options->>'mark_arrived')::boolean, false)
          AND p_order->>'delivery_type' <> 'home_service'
        THEN 'checked_in' ELSE 'not_started' END,
      checked_in_at = CASE
        WHEN COALESCE((p_options->>'mark_arrived')::boolean, false)
          AND p_order->>'delivery_type' <> 'home_service'
        THEN clock_timestamp() ELSE NULL END,
      session_duration_minutes_snapshot =
        NULLIF(v_line->'metadata'->>'duration_minutes', '')::int
    WHERE b.id = v_booking_id AND b.order_id = v_order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_LINE_MISSING'; END IF;
    IF v_price > 0 THEN
      INSERT INTO public.order_payable_items (
        order_id, booking_id, charge_type, description, amount,
        currency, sequence, source_type, source_id, created_by
      ) VALUES (
        v_order_id, v_booking_id, 'service',
        COALESCE(v_line->'metadata'->>'service_name', 'Service'),
        v_price, 'PHP', v_index, 'booking', v_booking_id, v_staff.id
      );
    END IF;
  END LOOP;
  IF jsonb_array_length(v_result->'service_line_ids') <> v_index THEN
    RAISE EXCEPTION 'BOOKING_LINE_COUNT_MISMATCH';
  END IF;
  SELECT jsonb_agg(b.id ORDER BY b.line_sequence) INTO v_ordered_ids
  FROM public.bookings b WHERE b.order_id = v_order_id;
  v_result := v_result || jsonb_build_object('service_line_ids', v_ordered_ids);
  IF v_fee > 0 THEN
    INSERT INTO public.order_payable_items (
      order_id, booking_id, charge_type, description, amount,
      currency, sequence, source_type, created_by
    ) VALUES (
      v_order_id, NULL, 'home_service_fee', 'Home Service travel',
      v_fee, 'PHP', v_index + 1, 'booking_order', v_staff.id
    );
  END IF;
  v_total := v_total + v_fee;
  IF (v_order->'metadata'->>'total_amount')::numeric IS DISTINCT FROM v_total THEN
    RAISE EXCEPTION 'ORDER_PAYABLE_SNAPSHOT_MISMATCH';
  END IF;
  IF NOT v_paid THEN
    IF NULLIF(p_options->'payments', 'null'::jsonb) IS NOT NULL THEN
      RAISE EXCEPTION 'PAYMENT_INTENT_MISMATCH: Unpaid creation has tenders';
    END IF;
    RETURN v_result || jsonb_build_object(
      'total_payable', v_total, 'transaction_id', NULL);
  END IF;
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'ZERO_PAYABLE_ORDER: No positive amount can be collected';
  END IF;

  IF NULLIF(p_options->'payments', 'null'::jsonb) IS NULL THEN
    IF p_options->>'payment_method' NOT IN (
      'cash', 'gcash', 'maya', 'card', 'bank_transfer') THEN
      RAISE EXCEPTION 'INVALID_PAYMENT_RAIL';
    END IF;
    v_parts := jsonb_build_array(jsonb_build_object(
      'amount', v_total, 'payment_method', p_options->>'payment_method',
      'financial_account_id', p_options->>'financial_account_id',
      'external_reference', p_options->>'payment_reference'
    ));
  ELSE
    v_parts := p_options->'payments';
    IF jsonb_typeof(v_parts) <> 'array' OR jsonb_array_length(v_parts) < 1
       OR (jsonb_array_length(v_parts) > 1
           AND p_options->>'payment_method' <> 'other') THEN
      RAISE EXCEPTION 'INVALID_SPLIT_TENDER';
    END IF;
  END IF;
  FOR v_part IN SELECT value FROM jsonb_array_elements(v_parts) LOOP
    v_amount := (v_part->>'amount')::numeric;
    v_method := v_part->>'payment_method';
    IF v_amount IS NULL OR v_amount <= 0 OR round(v_amount, 2) <> v_amount
       OR v_method NOT IN ('cash', 'gcash', 'maya', 'card', 'bank_transfer') THEN
      RAISE EXCEPTION 'INVALID_TENDER';
    END IF;
    v_account_type := CASE v_method
      WHEN 'cash' THEN 'cash_drawer' WHEN 'card' THEN 'card_terminal'
      ELSE v_method END;
    v_account_id := NULLIF(v_part->>'financial_account_id', '')::uuid;
    IF v_account_id IS NULL THEN
      SELECT count(*), min(fa.id) INTO v_count, v_account_id
      FROM public.financial_accounts fa
      WHERE fa.is_active AND fa.currency = 'PHP'
        AND (fa.branch_id = v_branch OR fa.branch_id IS NULL)
        AND fa.account_type = v_account_type;
      IF v_count = 0 THEN RAISE EXCEPTION 'ACCOUNT_NOT_CONFIGURED'; END IF;
      IF v_count > 1 THEN RAISE EXCEPTION 'ACCOUNT_SELECTION_REQUIRED'; END IF;
    END IF;
    SELECT fa.id, fa.branch_id, fa.account_type, fa.currency, fa.is_active
      INTO v_account FROM public.financial_accounts fa WHERE fa.id = v_account_id;
    IF NOT FOUND OR NOT v_account.is_active OR v_account.currency <> 'PHP'
       OR v_account.account_type <> v_account_type
       OR (v_account.branch_id IS NOT NULL AND v_account.branch_id <> v_branch) THEN
      RAISE EXCEPTION 'ACCOUNT_BRANCH_OR_RAIL_MISMATCH';
    END IF;
    v_tender_total := v_tender_total + v_amount;
    v_normalized := v_normalized || jsonb_build_object(
      'amount', v_amount, 'payment_method', v_method,
      'financial_account_id', v_account_id,
      'external_reference', v_part->>'external_reference'
    );
  END LOOP;
  IF v_tender_total <> v_total THEN RAISE EXCEPTION 'PAYMENT_DELTA_MISMATCH'; END IF;

  -- Only service_role can enter this function. The server authenticated the
  -- actor before calling; CF4 still verifies staff and branch using auth.uid().
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', p_actor_auth_user_id::text, true);
  v_payment := public.post_order_payment_atomic(
    v_order_id, 'cf8create:' || p_idempotency_key, v_normalized, NULL,
    CURRENT_DATE, p_options->>'payment_reference', p_options->>'payment_note'
  );
  RETURN v_result || jsonb_build_object(
    'total_payable', v_total,
    'transaction_id', v_payment->>'transaction_id',
    'payment_state', v_payment->>'payment_state'
  );
END;
$create$;

REVOKE ALL ON FUNCTION public.create_inhouse_order_with_payment_atomic(
  UUID, TEXT, JSONB, JSONB, JSONB, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_inhouse_order_with_payment_atomic(
  UUID, TEXT, JSONB, JSONB, JSONB, JSONB
) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;


