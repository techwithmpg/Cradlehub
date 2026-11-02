-- LOCAL/TEST review only. No remote execution or historical migration replay.
-- Owner policy: non-VAT charges; button selection is staff eligibility attestation.
BEGIN;

-- Latest owner rule: Senior/PWD covers every canonical service charge at checkout,
-- including home service. Transportation, retail and other non-service items are excluded.

CREATE TABLE public.order_discount_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.booking_orders(id),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  actor_staff_id uuid NOT NULL REFERENCES public.staff(id),
  idempotency_key text NOT NULL UNIQUE,
  quote_version text NOT NULL,
  selections jsonb NOT NULL,
  calculation jsonb NOT NULL,
  payment_transaction_id uuid NOT NULL UNIQUE REFERENCES public.financial_transactions(id),
  committed_receipt jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX order_discount_audits_order_idx ON public.order_discount_audits(order_id);
ALTER TABLE public.order_discount_audits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_discount_audits FROM PUBLIC, anon, authenticated;

-- Internal helpers are never callable through the public Data API.
CREATE SCHEMA IF NOT EXISTS discount_private;
REVOKE ALL ON SCHEMA discount_private FROM PUBLIC, anon, authenticated;

CREATE FUNCTION discount_private.authorized_actor(p_order_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_staff public.staff; v_branch uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_staff FROM public.staff WHERE auth_user_id = auth.uid();
  IF NOT FOUND OR v_staff.is_active IS DISTINCT FROM true OR
     v_staff.system_role NOT IN ('owner','manager','assistant_manager','store_manager','crm') THEN
    RAISE EXCEPTION 'PAYMENT_ROLE_UNAUTHORIZED';
  END IF;
  SELECT branch_id INTO v_branch FROM public.booking_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_staff.system_role <> 'owner' AND v_staff.branch_id IS DISTINCT FROM v_branch THEN
    RAISE EXCEPTION 'BRANCH_UNAUTHORIZED';
  END IF;
  RETURN v_staff.id;
END $$;
REVOKE ALL ON FUNCTION discount_private.authorized_actor(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.quote_order_discounts(p_order_id uuid, p_selections jsonb DEFAULT '[]')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid; v_order public.booking_orders; v_selection jsonb; v_booking record;
  v_items jsonb; v_recipients jsonb; v_lines jsonb := '[]'; v_selections jsonb;
  v_total numeric; v_paid numeric; v_discount numeric := 0; v_amount numeric; v_rate numeric;
  v_category text; v_version text; v_facts jsonb;
BEGIN
  v_actor := discount_private.authorized_actor(p_order_id);
  SELECT * INTO v_order FROM public.booking_orders WHERE id = p_order_id;
  IF v_order.currency IS DISTINCT FROM 'PHP' THEN RAISE EXCEPTION 'UNSUPPORTED_ORDER_CURRENCY'; END IF;
  IF p_selections IS NULL OR jsonb_typeof(p_selections) <> 'array' OR jsonb_array_length(p_selections) > 100 THEN
    RAISE EXCEPTION 'INVALID_DISCOUNT_SELECTIONS';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_selections) x
    WHERE x->>'category' NOT IN ('senior','pwd','vip') OR x->>'category' IS NULL
       OR x->>'bookingId' IS NULL OR x->'attested' IS DISTINCT FROM 'true'::jsonb) THEN
    RAISE EXCEPTION 'ELIGIBILITY_ATTESTATION_REQUIRED';
  END IF;
  IF (SELECT count(DISTINCT x->>'bookingId') FROM jsonb_array_elements(p_selections) x)
      <> jsonb_array_length(p_selections) THEN RAISE EXCEPTION 'DISCOUNT_STACKING_NOT_ALLOWED'; END IF;
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'bookingId'),'[]') INTO v_selections
    FROM jsonb_array_elements(p_selections) x;

  SELECT coalesce(sum(amount),0), coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'bookingId',booking_id,'description',description,'amount',amount,'itemType',charge_type)
    ORDER BY sequence NULLS LAST,id),'[]')
    INTO v_total,v_items FROM public.order_payable_items WHERE order_id=p_order_id;
  IF v_items='[]' THEN
    IF EXISTS(SELECT 1 FROM public.bookings WHERE order_id=p_order_id AND status NOT IN ('cancelled','no_show','expired')
      AND coalesce((metadata->>'price_paid') ~ '^[0-9]+([.][0-9]{1,2})?$',false)=false) THEN
      RAISE EXCEPTION 'BOOKING_PRICE_SNAPSHOT_REQUIRED';
    END IF;
    IF v_order.metadata ? 'home_service_fee' AND coalesce((v_order.metadata->>'home_service_fee') ~ '^[0-9]+([.][0-9]{1,2})?$',false)=false THEN
      RAISE EXCEPTION 'ORDER_FEE_SNAPSHOT_INVALID';
    END IF;
    SELECT coalesce(sum((b.metadata->>'price_paid')::numeric),0),coalesce(jsonb_agg(jsonb_build_object(
      'id',b.id,'bookingId',b.id,'description','Booking '||left(b.id::text,8),
      'amount',(b.metadata->>'price_paid')::numeric,'itemType','service') ORDER BY b.id),'[]')
      INTO v_total,v_items FROM public.bookings b WHERE b.order_id=p_order_id
      AND b.status NOT IN ('cancelled','no_show','expired') AND (b.metadata->>'price_paid')::numeric>0;
    IF coalesce((v_order.metadata->>'home_service_fee')::numeric,0)>0 THEN
      v_total:=v_total+(v_order.metadata->>'home_service_fee')::numeric;
      v_items:=v_items||jsonb_build_object('id',p_order_id,'bookingId',null,'description','Home Service travel',
        'amount',(v_order.metadata->>'home_service_fee')::numeric,'itemType','home_service_fee');
    END IF;
    IF (v_order.metadata->>'total_amount') ~ '^[0-9]+([.][0-9]{1,2})?$' AND
       v_total<>(v_order.metadata->>'total_amount')::numeric THEN RAISE EXCEPTION 'ORDER_PAYABLE_SNAPSHOT_MISMATCH'; END IF;
    IF v_items='[]' THEN RAISE EXCEPTION 'NO_ELIGIBLE_SERVICE_CHARGES'; END IF;
  END IF;
  SELECT coalesce(sum(amount),0) INTO v_paid FROM public.financial_order_allocations WHERE order_id=p_order_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'bookingId',b.id,'customerId',CASE WHEN b.attendee_id IS NULL THEN b.customer_id ELSE a.customer_id END,
    'recipientName',coalesce(nullif(btrim(a.display_name),''),CASE WHEN b.attendee_id IS NULL THEN c.full_name ELSE rc.full_name END,'Service recipient'),
    'serviceName',s.name,'status',b.status,'serviceId',b.service_id,
    'deliveryType',b.delivery_type,'attendeeId',b.attendee_id,
    'loyaltyTier',CASE WHEN b.attendee_id IS NULL THEN c.loyalty_tier ELSE rc.loyalty_tier END,
    'coverage','all_service_charges_at_checkout')
    ORDER BY b.id),'[]') INTO v_recipients
    FROM public.bookings b LEFT JOIN public.booking_attendees a ON a.id=b.attendee_id AND a.booking_order_id=b.order_id
    LEFT JOIN public.customers rc ON rc.id=a.customer_id
    LEFT JOIN public.customers c ON c.id=b.customer_id LEFT JOIN public.services s ON s.id=b.service_id
    WHERE b.order_id=p_order_id;

  FOR v_selection IN SELECT * FROM jsonb_array_elements(v_selections) LOOP
    v_category := v_selection->>'category';
    SELECT b.*, CASE WHEN b.attendee_id IS NULL THEN b.customer_id ELSE a.customer_id END AS recipient_customer_id,
      coalesce(nullif(btrim(a.display_name),''),CASE WHEN b.attendee_id IS NULL THEN c.full_name ELSE rc.full_name END,'Service recipient') AS recipient_name
      INTO v_booking FROM public.bookings b
      LEFT JOIN public.booking_attendees a ON a.id=b.attendee_id AND a.booking_order_id=b.order_id
      LEFT JOIN public.customers c ON c.id=b.customer_id
      LEFT JOIN public.customers rc ON rc.id=a.customer_id
      WHERE b.id=(v_selection->>'bookingId')::uuid AND b.order_id=p_order_id;
    IF NOT FOUND OR v_booking.status IN ('cancelled','no_show','expired') THEN RAISE EXCEPTION 'DISCOUNT_RECIPIENT_NOT_ELIGIBLE'; END IF;
    IF v_booking.attendee_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.booking_attendees
       WHERE id=v_booking.attendee_id AND booking_order_id=p_order_id) THEN
      RAISE EXCEPTION 'DISCOUNT_RECIPIENT_NOT_ELIGIBLE: Invalid group recipient relationship';
    END IF;
    -- Senior/PWD coverage is the explicit owner rule above; eligibility is staff attestation.
    -- VIP covers canonical in-spa service charges, never travel, tips or retail.
    IF v_category='vip' AND v_booking.delivery_type IS DISTINCT FROM 'in_spa' THEN
      RAISE EXCEPTION 'VIP_SERVICE_NOT_ELIGIBLE: VIP applies to in-spa services only';
    END IF;
    IF v_category='vip' AND NOT EXISTS(SELECT 1 FROM public.customers
       WHERE id=v_booking.recipient_customer_id AND loyalty_tier='vip') THEN
      RAISE EXCEPTION 'VIP_MEMBERSHIP_REQUIRED: This service recipient has no VIP status on file';
    END IF;
    IF EXISTS (SELECT 1 FROM public.order_payable_items WHERE order_id=p_order_id AND amount<0) THEN
      RAISE EXCEPTION 'EXISTING_ADJUSTMENT_REQUIRES_REVIEW: Additional discounts cannot stack with existing adjustments';
    END IF;
    v_rate := CASE WHEN v_category='vip' THEN 0.10 ELSE 0.20 END;
    v_amount := 0;
    -- Round each real service charge once; unrelated items are never discounted.
    SELECT coalesce(sum(round((x->>'amount')::numeric*v_rate,2)),0) INTO v_amount
      FROM jsonb_array_elements(v_items) x WHERE x->>'bookingId'=v_booking.id::text AND x->>'itemType'='service' AND (x->>'amount')::numeric>0;
    IF v_amount<=0 THEN RAISE EXCEPTION 'NO_ELIGIBLE_SERVICE_CHARGES'; END IF;
    v_discount := v_discount+v_amount;
    v_lines := v_lines || jsonb_build_object('bookingId',v_booking.id,'customerId',v_booking.recipient_customer_id,
      'attendeeId',v_booking.attendee_id,'recipientName',v_booking.recipient_name,'category',v_category,
      'rate',v_rate,'amount',v_amount,'attested',true);
  END LOOP;
  IF v_total-v_discount<v_paid OR v_total-v_discount<0 THEN
    RAISE EXCEPTION 'DISCOUNT_EXCEEDS_OUTSTANDING: Existing payments require reconciliation';
  END IF;
  -- Include every fact that affects coverage, eligibility, totals and allocation in the quote version.
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'amount',amount,'item',payable_item_id) ORDER BY id),'[]')
    INTO v_facts FROM public.financial_order_allocations WHERE order_id=p_order_id;
  v_version := md5(jsonb_build_object('order',p_order_id,'items',v_items,'allocations',v_facts,
    'recipients',v_recipients,'selections',v_selections,'currency',v_order.currency)::text);
  RETURN jsonb_build_object('version',v_version,'orderId',p_order_id,'subtotal',v_total,
    'discountAmount',v_discount,'totalPayable',v_total-v_discount,'alreadyPaid',v_paid,
    'remainingBalance',v_total-v_discount-v_paid,'selections',v_selections,
    'discounts',v_lines,'recipients',v_recipients,'items',v_items);
END $$;
REVOKE ALL ON FUNCTION public.quote_order_discounts(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quote_order_discounts(uuid,jsonb) TO authenticated;

-- A transactional extension of the existing writer, not a replacement payment engine.
CREATE FUNCTION public.post_order_payment_with_discounts_atomic(
  p_order_id uuid, p_idempotency_key text, p_payments jsonb, p_selections jsonb, p_quote_version text,
  p_allocations jsonb DEFAULT NULL, p_business_date date DEFAULT NULL,
  p_external_reference text DEFAULT NULL, p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid; v_quote jsonb; v_result jsonb; v_saved public.order_discount_audits;
  v_line jsonb; v_items jsonb; v_branch uuid; v_receipt jsonb;
BEGIN
  IF p_idempotency_key IS NULL OR trim(p_idempotency_key)='' THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED'; END IF;
  -- Match canonical writer lock order. Reentrant advisory locks are safe in this transaction.
  PERFORM pg_advisory_xact_lock(hashtext('idem_cf4_' || p_idempotency_key));
  v_actor := discount_private.authorized_actor(p_order_id);
  SELECT branch_id INTO v_branch FROM public.booking_orders WHERE id=p_order_id FOR UPDATE;
  SELECT * INTO v_saved FROM public.order_discount_audits WHERE idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_saved.order_id IS DISTINCT FROM p_order_id OR v_saved.quote_version IS DISTINCT FROM p_quote_version
       OR v_saved.selections IS DISTINCT FROM (SELECT jsonb_agg(x ORDER BY x->>'bookingId') FROM jsonb_array_elements(p_selections) x) THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';
    END IF;
    -- Canonical writer also checks original amounts, accounts, references and business date.
    v_result := public.post_order_payment_atomic(p_order_id,p_idempotency_key,p_payments,p_allocations,p_business_date,p_external_reference,p_notes);
    RETURN v_saved.committed_receipt || jsonb_build_object('is_idempotent_replay',true);
  END IF;
  IF EXISTS (SELECT 1 FROM public.financial_transactions WHERE idempotency_key=p_idempotency_key) THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  IF p_allocations IS NOT NULL AND p_allocations<>'[]'::jsonb THEN
    RAISE EXCEPTION 'DISCOUNT_EXPLICIT_ALLOCATION_UNSUPPORTED: Use the existing order-level split/partial allocation path';
  END IF;
  -- Block changes to recipient/status/coverage facts while validating and posting.
  PERFORM 1 FROM public.bookings WHERE order_id=p_order_id ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.order_payable_items WHERE order_id=p_order_id ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.booking_attendees WHERE booking_order_id=p_order_id ORDER BY id FOR SHARE;
  PERFORM 1 FROM public.customers WHERE id IN (
    SELECT customer_id FROM public.bookings WHERE order_id=p_order_id
    UNION SELECT customer_id FROM public.booking_attendees WHERE booking_order_id=p_order_id
  ) ORDER BY id FOR SHARE;
  v_quote := public.quote_order_discounts(p_order_id,p_selections);
  IF v_quote->>'version' IS DISTINCT FROM p_quote_version THEN RAISE EXCEPTION 'STALE_DISCOUNT_QUOTE: Recalculate before payment'; END IF;
  IF jsonb_array_length(v_quote->'discounts')=0 THEN RAISE EXCEPTION 'DISCOUNT_SELECTION_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM public.bookings WHERE order_id=p_order_id AND status IN ('cancelled','no_show','expired')) THEN
    RAISE EXCEPTION 'CLOSED_GROUP_REQUIRES_REVIEW: Reconcile closed group charges before applying a discount';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.order_payable_items WHERE order_id=p_order_id) THEN
    INSERT INTO public.order_payable_items(order_id,booking_id,charge_type,description,amount,currency,sequence,source_type,source_id,created_by)
      SELECT p_order_id,(x->>'bookingId')::uuid,x->>'itemType',x->>'description',(x->>'amount')::numeric,'PHP',
        ordinality::int,CASE WHEN x->>'bookingId' IS NULL THEN 'booking_order' ELSE 'booking' END,
        (x->>'bookingId')::uuid,v_actor FROM jsonb_array_elements(v_quote->'items') WITH ORDINALITY AS q(x,ordinality);
  END IF;
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_quote->'discounts') LOOP
    INSERT INTO public.order_payable_items(order_id,booking_id,charge_type,description,amount,currency,sequence,source_type,source_id,created_by)
      VALUES(p_order_id,(v_line->>'bookingId')::uuid,'discount',
        (CASE v_line->>'category' WHEN 'senior' THEN 'Senior Citizen 20%' WHEN 'pwd' THEN 'PWD 20%' ELSE 'VIP 10%' END)
        || ' — ' || (v_line->>'recipientName'), -(v_line->>'amount')::numeric,'PHP',
        (SELECT coalesce(max(sequence),0)+1 FROM public.order_payable_items WHERE order_id=p_order_id),
        'attested_service_discount',(v_line->>'bookingId')::uuid,v_actor);
  END LOOP;
  -- Any exception rolls back discount rows, audit and every canonical payment side effect together.
  v_result := public.post_order_payment_atomic(p_order_id,p_idempotency_key,p_payments,p_allocations,p_business_date,p_external_reference,p_notes);
  IF (v_result->>'success')::boolean IS DISTINCT FROM true OR v_result->>'transaction_id' IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_CONFIRMATION_REQUIRED';
  END IF;
  SELECT jsonb_agg(jsonb_build_object('description',description,'amount',amount) ORDER BY sequence NULLS LAST,id)
    INTO v_items FROM public.order_payable_items WHERE order_id=p_order_id;
  v_receipt := v_result || jsonb_build_object('discount_receipt',jsonb_build_object(
    'items',v_items,'discounts',v_quote->'discounts','subtotal',v_quote->'subtotal',
    'discountAmount',v_quote->'discountAmount','alreadyPaid',v_quote->'alreadyPaid'));
  INSERT INTO public.order_discount_audits(order_id,branch_id,actor_staff_id,idempotency_key,quote_version,
    selections,calculation,payment_transaction_id,committed_receipt)
    VALUES(p_order_id,v_branch,v_actor,p_idempotency_key,p_quote_version,v_quote->'selections',v_quote,
      (v_result->>'transaction_id')::uuid,v_receipt);
  RETURN v_receipt;
END $$;
REVOKE ALL ON FUNCTION public.post_order_payment_with_discounts_atomic(uuid,text,jsonb,jsonb,text,jsonb,date,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_order_payment_with_discounts_atomic(uuid,text,jsonb,jsonb,text,jsonb,date,text,text) TO authenticated;

CREATE FUNCTION public.customer_discount_history(p_customer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb; v_staff public.staff;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_staff FROM public.staff WHERE auth_user_id=auth.uid();
  IF NOT FOUND OR v_staff.is_active IS DISTINCT FROM true OR
     v_staff.system_role NOT IN ('owner','manager','assistant_manager','store_manager','crm') THEN RAISE EXCEPTION 'PAYMENT_ROLE_UNAUTHORIZED'; END IF;
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'appliedAt' DESC),'[]') INTO v_result FROM (
    SELECT jsonb_build_object('category',d->>'category','amount',d->'amount','appliedAt',a.created_at,
      'transactionId',a.payment_transaction_id,'bookingId',d->>'bookingId') x
      FROM public.order_discount_audits a CROSS JOIN LATERAL jsonb_array_elements(a.calculation->'discounts') d
      WHERE d->>'customerId'=p_customer_id::text AND
        (v_staff.system_role='owner' OR a.branch_id=v_staff.branch_id)
      ORDER BY a.created_at DESC LIMIT 20
  ) history;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.customer_discount_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_discount_history(uuid) TO authenticated;

CREATE FUNCTION public.discount_payment_receipt(p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_saved public.order_discount_audits;
BEGIN
  SELECT * INTO v_saved FROM public.order_discount_audits WHERE idempotency_key=p_idempotency_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'DISCOUNT_RECEIPT_NOT_FOUND'; END IF;
  PERFORM discount_private.authorized_actor(v_saved.order_id);
  RETURN v_saved.committed_receipt;
END $$;
REVOKE ALL ON FUNCTION public.discount_payment_receipt(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discount_payment_receipt(text) TO authenticated;
COMMIT;
