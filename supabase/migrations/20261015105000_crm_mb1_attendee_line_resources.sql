BEGIN;

-- CRM-MB1: preserve payment and authority behavior while resolving each inserted line by its BKG3 return ID.
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
  v_cash_session_id UUID;
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
      -- Validate before BKG3 writes bookings or the order.
      IF v_method = 'cash' THEN
        v_cash_session_id := NULL;
        SELECT cs.id INTO v_cash_session_id
        FROM public.cash_sessions cs
        WHERE cs.cash_drawer_account_id = v_account_id
          AND cs.branch_id = v_branch
          AND cs.status = 'open'
        FOR SHARE;
        IF v_cash_session_id IS NULL THEN
          RAISE EXCEPTION 'CASH_DRAWER_SESSION_REQUIRED: Open the selected cash drawer before recording a cash payment.';
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
    SELECT b.id INTO STRICT v_booking_id
    FROM public.bookings b
    JOIN public.booking_attendees ba ON ba.id = b.attendee_id
    WHERE b.order_id = v_order_id
      AND ba.sequence = COALESCE((v_line->>'attendee_sequence')::int, 1)
      AND b.line_sequence = COALESCE((v_line->>'line_sequence')::int, 1);
    v_price := (v_line->'metadata'->>'price_paid')::numeric;
    IF v_price IS NULL OR v_price < 0 OR round(v_price, 2) <> v_price THEN
      RAISE EXCEPTION 'INVALID_SERVICE_PRICE';
    END IF;
    v_total := v_total + v_price;
    UPDATE public.bookings b SET
      type = p_options->>'type',
      payment_status = 'pending',
      resource_id = COALESCE(NULLIF(v_line->>'resource_id', '')::uuid, NULLIF(p_options->>'resource_id', '')::uuid),
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
  SELECT jsonb_agg(b.id ORDER BY ba.sequence, b.line_sequence) INTO v_ordered_ids
  FROM public.bookings b
  JOIN public.booking_attendees ba ON ba.id = b.attendee_id
  WHERE b.order_id = v_order_id;
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

REVOKE ALL ON FUNCTION public.create_inhouse_order_with_payment_atomic(UUID, TEXT, JSONB, JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_inhouse_order_with_payment_atomic(UUID, TEXT, JSONB, JSONB, JSONB, JSONB) TO service_role;

COMMIT;
