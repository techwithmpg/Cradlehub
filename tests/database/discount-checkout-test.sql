CREATE FUNCTION public.test_assert(ok boolean,msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'ASSERTION_FAILED: %',msg; END IF; END $$;
CREATE FUNCTION public.test_expect_error(command text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE command; EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%'||expected||'%' THEN RETURN; END IF; RAISE;
  END;
  RAISE EXCEPTION 'EXPECTED_ERROR_NOT_THROWN: %',expected;
END $$;
DO $$
DECLARE
  branch uuid:=gen_random_uuid(); actor uuid:=gen_random_uuid(); actor_user uuid:=gen_random_uuid();
  customer uuid:=gen_random_uuid(); regular uuid:=gen_random_uuid(); service uuid:=gen_random_uuid();
  ord uuid:=gen_random_uuid(); guest uuid:=gen_random_uuid(); other_guest uuid:=gen_random_uuid(); attendee uuid:=gen_random_uuid();
  cash uuid:=gen_random_uuid(); gcash uuid:=gen_random_uuid(); quote jsonb; selections jsonb; payments jsonb; result jsonb; replay jsonb;
  prior numeric; test_key text:='discount-fixture';
BEGIN
  INSERT INTO branches VALUES(branch);
  INSERT INTO staff VALUES(actor,actor_user,branch,'crm',true);
  INSERT INTO customers VALUES(customer,'Synthetic VIP','vip'),(regular,'Synthetic Regular','standard');
  INSERT INTO services VALUES(service,'Synthetic spa service');
  INSERT INTO booking_orders VALUES(ord,branch,customer,current_date,'{"total_amount":2200}','PHP');
  INSERT INTO booking_attendees VALUES(attendee,ord,regular,'Synthetic actual guest');
  INSERT INTO bookings(id,order_id,branch_id,customer_id,attendee_id,service_id,status,delivery_type,metadata)
    VALUES(guest,ord,branch,customer,null,service,'completed','in_spa','{"price_paid":1000}'),
      (other_guest,ord,branch,customer,attendee,service,'completed','in_spa','{"price_paid":1200}');
  INSERT INTO financial_accounts(id,branch_id,name,account_type,identifier_mask) VALUES(cash,branch,'Fixture Cash','cash_drawer','***'),(gcash,branch,'Fixture GCash','gcash','***');
  INSERT INTO cash_sessions VALUES(gen_random_uuid(),cash,branch,'open');
  PERFORM set_config('request.jwt.claim.sub',actor_user::text,true);
  selections:=jsonb_build_array(jsonb_build_object('bookingId',guest,'category','vip','attested',true));
  quote:=public.quote_order_discounts(ord,selections);
  PERFORM test_assert((quote->>'discountAmount')::numeric=100,'VIP only actual recipient service');
  PERFORM test_assert((quote->>'totalPayable')::numeric=2100,'authoritative initial purchased snapshot quote');
  PERFORM test_assert(NOT EXISTS(SELECT 1 FROM order_payable_items WHERE order_id=ord),'quote is read only');
  UPDATE booking_attendees SET display_name='' WHERE id=attendee;
  quote:=public.quote_order_discounts(ord,'[]');
  PERFORM test_assert(EXISTS(SELECT 1 FROM jsonb_array_elements(quote->'recipients') r WHERE r->>'bookingId'=other_guest::text AND r->>'recipientName'='Synthetic Regular'),'empty attendee name uses actual recipient profile, never organizer');
  quote:=public.quote_order_discounts(ord,selections);
  PERFORM test_expect_error(format('SELECT public.quote_order_discounts(%L,%L)',ord,
    jsonb_build_array(jsonb_build_object('bookingId',other_guest,'category','vip','attested',true))),'VIP_MEMBERSHIP_REQUIRED');
  PERFORM test_assert((public.quote_order_discounts(ord,
    jsonb_build_array(jsonb_build_object('bookingId',guest,'category','senior','attested',true)))->>'discountAmount')::numeric=200,'owner approved all service Senior coverage');
  PERFORM test_expect_error(format('SELECT public.quote_order_discounts(%L,%L)',ord,
    jsonb_build_array(jsonb_build_object('bookingId',guest,'category','vip','attested',false))),'ELIGIBILITY_ATTESTATION_REQUIRED');
  PERFORM test_expect_error(format('SELECT public.quote_order_discounts(%L,%L)',ord,selections||selections),'DISCOUNT_STACKING_NOT_ALLOWED');
  payments:=jsonb_build_array(jsonb_build_object('amount',300,'payment_method','cash','financial_account_id',cash),
    jsonb_build_object('amount',200,'payment_method','gcash','financial_account_id',gcash));
  PERFORM test_expect_error(format('SELECT public.post_order_payment_with_discounts_atomic(%L,%L,%L,%L,%L)',ord,test_key,payments,selections,'stale'),'STALE_DISCOUNT_QUOTE');
  -- Force failure inside canonical writer after discount rows were inserted.
  UPDATE cash_sessions SET status='closed';
  PERFORM test_expect_error(format('SELECT public.post_order_payment_with_discounts_atomic(%L,%L,%L,%L,%L)',ord,test_key,payments,selections,quote->>'version'),'CASH_DRAWER_SESSION_REQUIRED');
  PERFORM test_assert(NOT EXISTS(SELECT 1 FROM order_payable_items WHERE order_id=ord),'failed payment rolls back materialization and discount');
  PERFORM test_assert(NOT EXISTS(SELECT 1 FROM order_discount_audits),'failed payment has no audit');
  UPDATE cash_sessions SET status='open';
  result:=public.post_order_payment_with_discounts_atomic(ord,test_key,payments,selections,quote->>'version');
  PERFORM test_assert((result->>'total_paid')::numeric=500 AND (result->>'remaining_balance')::numeric=1600,'split partial payment reconciles');
  PERFORM test_assert((SELECT count(*) FROM order_discount_audits)=1,'one durable audit');
  PERFORM test_assert((SELECT sum((x->>'amount')::numeric) FROM jsonb_array_elements(result->'discount_receipt'->'items') x)=2100,'receipt matches ledger total');
  replay:=public.post_order_payment_with_discounts_atomic(ord,test_key,payments,selections,quote->>'version');
  PERFORM test_assert((replay->>'is_idempotent_replay')::boolean,'same-key replay');
  PERFORM test_assert((SELECT count(*) FROM financial_transactions)=1 AND (SELECT count(*) FROM order_payable_items WHERE charge_type='discount')=1,'no duplicate discount/payment');
  PERFORM test_assert(jsonb_array_length(public.customer_discount_history(customer))=1 AND public.customer_discount_history(regular)='[]','history belongs to actual recipient');
  PERFORM test_assert(public.discount_payment_receipt(test_key)=result,'timeout recovery uses immutable committed result');
  PERFORM test_expect_error(format('SELECT public.post_order_payment_with_discounts_atomic(%L,%L,%L,%L,%L)',ord,test_key,payments,selections,'different'),'IDEMPOTENCY_CONFLICT');
  PERFORM test_expect_error(format('SELECT public.quote_order_discounts(%L,%L)',ord,selections),'EXISTING_ADJUSTMENT_REQUIRES_REVIEW');
  PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  PERFORM test_expect_error(format('SELECT public.quote_order_discounts(%L,%L)',ord,selections),'PAYMENT_ROLE_UNAUTHORIZED');
  PERFORM test_assert(NOT has_function_privilege('anon','public.post_order_payment_with_discounts_atomic(uuid,text,jsonb,jsonb,text,jsonb,date,text,text)','EXECUTE'),'anonymous posting revoked');
  PERFORM test_assert(NOT has_table_privilege('authenticated','public.order_discount_audits','INSERT'),'direct audit writes revoked');
  RAISE NOTICE 'PASS: discount quote, actual attendee membership, all service Senior coverage, attestation, stacking, rollback, split/partial, replay, receipt recovery, history, auth and grant assertions';
END $$;

-- The latest owner all-service policy also covers home-service service charges.
DO $$
DECLARE actor_user uuid; branch uuid; customer uuid; service uuid; ord uuid:=gen_random_uuid(); guest uuid:=gen_random_uuid(); quote jsonb; selections jsonb;
BEGIN
 SELECT s.auth_user_id,s.branch_id INTO actor_user,branch FROM staff s LIMIT 1;
 SELECT id INTO customer FROM customers WHERE loyalty_tier='vip' LIMIT 1;
 SELECT id INTO service FROM services LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',actor_user::text,true);
 INSERT INTO booking_orders VALUES(ord,branch,customer,current_date,'{}','PHP');
 INSERT INTO bookings(id,order_id,branch_id,customer_id,service_id,status,delivery_type,metadata)
 VALUES(guest,ord,branch,customer,service,'completed','in_spa','{"price_paid":999.99}');
 INSERT INTO order_payable_items(order_id,booking_id,charge_type,description,amount) VALUES
 (ord,guest,'service','Fractional service',999.99),(ord,null,'home_service_fee','Transport',200),(ord,null,'retail_product','Retail',150);
 selections:=jsonb_build_array(jsonb_build_object('bookingId',guest,'category','senior','attested',true));
 quote:=public.quote_order_discounts(ord,selections);
 PERFORM test_assert((quote->>'discountAmount')::numeric=200 AND (quote->>'totalPayable')::numeric=1149.99,'owner all-service policy, rounding and ineligible fee/retail exclusion');
 quote:=public.quote_order_discounts(ord,replace(selections::text,'senior','pwd')::jsonb);
 PERFORM test_assert((quote->>'discountAmount')::numeric=200,'PWD uses same explicitly approved all-service coverage');
 UPDATE bookings SET delivery_type='home_service' WHERE id=guest;
 PERFORM test_assert((public.quote_order_discounts(ord,selections)->>'discountAmount')::numeric=200,'Senior covers home service charge while fee/retail remain excluded');
 PERFORM test_expect_error(format('SELECT public.quote_order_discounts(%L,%L)',ord,replace(selections::text,'senior','vip')::jsonb),'VIP_SERVICE_NOT_ELIGIBLE');
 UPDATE bookings SET delivery_type='in_spa' WHERE id=guest;
 UPDATE staff SET branch_id=gen_random_uuid();
 PERFORM test_expect_error(format('SELECT public.quote_order_discounts(%L,%L)',ord,selections),'BRANCH_UNAUTHORIZED');
 UPDATE staff SET branch_id=branch;
 RAISE NOTICE 'PASS: all-service and home-service policy, fractional rounding, transport/retail exclusion, VIP home-service and cross-branch guards';
END $$;
