\set ON_ERROR_STOP on
-- Only run after group-booking-accepted-contract.sql and the forward migration
-- in the disposable LOCAL TEST database.
DO $$ BEGIN
  IF current_database() <> 'group_booking_test'
    OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
    OR inet_server_port() IS DISTINCT FROM 55434 THEN
    RAISE EXCEPTION 'LOCAL TEST target guard failed';
  END IF;
END $$;

CREATE TABLE public.staff_services (
  staff_id uuid NOT NULL REFERENCES public.staff(id),
  service_id uuid NOT NULL REFERENCES public.services(id),
  PRIMARY KEY (staff_id, service_id)
);
CREATE TABLE public.staff_schedules (
  staff_id uuid NOT NULL REFERENCES public.staff(id),
  day_of_week smallint NOT NULL,
  shift_type text NOT NULL DEFAULT 'single'
    CHECK (shift_type IN ('single', 'opening', 'closing')),
  start_time time NOT NULL,
  end_time time NOT NULL,
  ends_next_day boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (staff_id, day_of_week, shift_type)
);
CREATE TABLE public.schedule_overrides (
  staff_id uuid NOT NULL REFERENCES public.staff(id),
  override_date date NOT NULL,
  start_time time,
  end_time time,
  ends_next_day boolean NOT NULL DEFAULT false,
  is_day_off boolean NOT NULL DEFAULT false,
  PRIMARY KEY (staff_id, override_date)
);
CREATE TABLE public.blocked_times (
  staff_id uuid NOT NULL REFERENCES public.staff(id),
  block_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL
);
INSERT INTO public.staff_services
SELECT s.id, '00000000-0000-4000-8000-000000000003'::uuid FROM public.staff s;
INSERT INTO public.staff_schedules
SELECT s.id, d, 'single', '09:00', '18:00', false, true
FROM public.staff s CROSS JOIN generate_series(0, 6) AS d;
GRANT USAGE ON SCHEMA public, extensions TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- A capacity failure after the fifth attendee must roll back all statuses and
-- room assignments, while leaving the public request pending for another time.
SELECT public.test_make_order('rooms-fail', 10, 0, current_date + 101, 2)->>'idempotency_status';
DO $$
DECLARE v_booking_id uuid; v_message text; v_detail text;
BEGIN
  SELECT b.id INTO v_booking_id FROM public.bookings b
  JOIN public.booking_orders o ON o.id = b.order_id
  WHERE o.idempotency_key = 'rooms-fail' LIMIT 1;
  BEGIN
    PERFORM public.confirm_online_booking_order_atomic(
      v_booking_id, '00000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Expected room failure';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT, v_detail = PG_EXCEPTION_DETAIL;
    IF v_message <> 'BOOKING_ROOM_CAPACITY_UNAVAILABLE'
      OR v_detail <> 'available=5;required=10' THEN
      RAISE EXCEPTION 'Wrong capacity result: %, %', v_message, v_detail;
    END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.bookings b
    JOIN public.booking_orders o ON o.id = b.order_id
    WHERE o.idempotency_key = 'rooms-fail'
      AND (b.status <> 'pending_crm_confirmation' OR b.resource_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'Capacity failure partially confirmed a group';
  END IF;
END $$;

INSERT INTO public.branch_resources (id, branch_id, capacity, sort_order, name)
SELECT ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-000000000001'::uuid, 1, n, 'Room ' || n
FROM generate_series(6, 50) AS n;

DO $$
DECLARE v_result jsonb; v_confirm jsonb; v_replay jsonb; n integer;
  v_count integer; v_rooms integer; v_total numeric;
BEGIN
  FOREACH n IN ARRAY ARRAY[5, 10, 20, 50] LOOP
    v_result := public.test_make_order('confirmed-' || n, n, 0, current_date + n + 200, 2);
    SELECT public.confirm_online_booking_order_atomic(b.id,
      '00000000-0000-4000-8000-000000000001') INTO v_confirm
    FROM public.bookings b WHERE b.order_id = (v_result->>'order_id')::uuid LIMIT 1;
    IF v_confirm->>'idempotency_status' <> 'confirmed'
      OR jsonb_array_length(v_confirm->'changed_ids') <> n * 2 THEN
      RAISE EXCEPTION 'Group % confirmation count mismatch', n;
    END IF;
    SELECT count(*), count(b.resource_id), sum((b.metadata->>'price_paid')::numeric)
    INTO v_count, v_rooms, v_total
    FROM public.bookings b WHERE b.order_id = (v_result->>'order_id')::uuid
      AND b.status = 'confirmed';
    IF v_count <> n * 2 OR v_rooms <> n * 2 OR v_total <> n * 300
      OR (SELECT (o.metadata->>'total_amount')::numeric FROM public.booking_orders o
          WHERE o.id = (v_result->>'order_id')::uuid) <> v_total THEN
      RAISE EXCEPTION 'Group % confirmation/price mismatch: %, %, %', n, v_count, v_rooms, v_total;
    END IF;
    SELECT public.confirm_online_booking_order_atomic(b.id,
      '00000000-0000-4000-8000-000000000001') INTO v_replay
    FROM public.bookings b WHERE b.order_id = (v_result->>'order_id')::uuid LIMIT 1;
    IF v_replay->>'idempotency_status' <> 'replayed'
      OR jsonb_array_length(v_replay->'changed_ids') <> 0 THEN
      RAISE EXCEPTION 'Group % confirmation replay mismatch', n;
    END IF;
  END LOOP;
END $$;

-- Current service capability and schedule are checked at confirmation.
SELECT public.test_make_order('qualification-fail', 5, 0, current_date + 401)->>'idempotency_status';
DELETE FROM public.staff_services WHERE staff_id = '00000000-0000-4000-8000-000000000001';
DO $$
DECLARE v_id uuid; v_message text;
BEGIN
  SELECT b.id INTO v_id FROM public.bookings b JOIN public.booking_orders o ON o.id = b.order_id
  WHERE o.idempotency_key = 'qualification-fail' LIMIT 1;
  BEGIN
    PERFORM public.confirm_online_booking_order_atomic(v_id, '00000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Expected qualification failure';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'BOOKING_STAFF_NOT_QUALIFIED' THEN RAISE; END IF;
  END;
END $$;
INSERT INTO public.staff_services VALUES
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003');
INSERT INTO public.schedule_overrides VALUES
  ('00000000-0000-4000-8000-000000000001', current_date + 401, null, null, false, true);
DO $$
DECLARE v_id uuid; v_message text;
BEGIN
  SELECT b.id INTO v_id FROM public.bookings b JOIN public.booking_orders o ON o.id = b.order_id
  WHERE o.idempotency_key = 'qualification-fail' LIMIT 1;
  BEGIN
    PERFORM public.confirm_online_booking_order_atomic(v_id, '00000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Expected schedule failure';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'BOOKING_STAFF_SCHEDULE_UNAVAILABLE' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.bookings b JOIN public.booking_orders o ON o.id = b.order_id
    WHERE o.idempotency_key = 'qualification-fail' AND b.status <> 'pending_crm_confirmation') THEN
    RAISE EXCEPTION 'Qualification/schedule failure partially confirmed a group';
  END IF;
END $$;

-- An archived or hard-excluded provider cannot be confirmed after request.
UPDATE public.staff SET archived_at = now()
WHERE id = '00000000-0000-4000-8000-000000000001';
DO $$
DECLARE v_id uuid; v_message text;
BEGIN
  SELECT b.id INTO v_id FROM public.bookings b JOIN public.booking_orders o ON o.id = b.order_id
  WHERE o.idempotency_key = 'qualification-fail' LIMIT 1;
  BEGIN
    PERFORM public.confirm_online_booking_order_atomic(v_id, '00000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Expected archived staff rejection';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'BOOKING_PROVIDER_OR_SERVICE_UNAVAILABLE' THEN RAISE; END IF;
  END;
END $$;
UPDATE public.staff SET archived_at = NULL, system_role = 'driver'
WHERE id = '00000000-0000-4000-8000-000000000001';
DO $$
DECLARE v_id uuid; v_message text;
BEGIN
  SELECT b.id INTO v_id FROM public.bookings b JOIN public.booking_orders o ON o.id = b.order_id
  WHERE o.idempotency_key = 'qualification-fail' LIMIT 1;
  BEGIN
    PERFORM public.confirm_online_booking_order_atomic(v_id, '00000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Expected excluded role rejection';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'BOOKING_PROVIDER_OR_SERVICE_UNAVAILABLE' THEN RAISE; END IF;
  END;
END $$;
UPDATE public.staff SET system_role = 'staff'
WHERE id = '00000000-0000-4000-8000-000000000001';

-- Accepted schedule schema allows multiple shifts per staff/day. A line in
-- the closing shift must not depend on which row a SELECT happens to return.
SELECT public.test_make_order('multi-shift-valid', 5, 50, current_date + 402)->>'idempotency_status';
UPDATE public.staff_schedules
SET start_time = '07:00', end_time = '09:00', shift_type = 'opening'
WHERE staff_id = '00000000-0000-4000-8000-000000000051'
  AND day_of_week = extract(dow FROM current_date + 402)::smallint;
INSERT INTO public.staff_schedules (staff_id, day_of_week, shift_type, start_time, end_time)
VALUES ('00000000-0000-4000-8000-000000000051',
  extract(dow FROM current_date + 402)::smallint, 'closing', '09:00', '18:00');
DO $$
DECLARE v_result jsonb;
BEGIN
  SELECT public.confirm_online_booking_order_atomic(b.id,
    '00000000-0000-4000-8000-000000000001') INTO v_result
  FROM public.bookings b JOIN public.booking_orders o ON o.id = b.order_id
  WHERE o.idempotency_key = 'multi-shift-valid' LIMIT 1;
  IF v_result->>'idempotency_status' <> 'confirmed' THEN
    RAISE EXCEPTION 'Multi-shift confirmation failed';
  END IF;
END $$;

-- The SQL function remains invokable by service_role under the new table locks.
SELECT public.test_make_order('service-role-confirm', 5, 55, current_date + 404)->>'idempotency_status';
SET ROLE service_role;
SELECT public.confirm_online_booking_order_atomic(
  (SELECT b.id FROM public.bookings b JOIN public.booking_orders o ON o.id = b.order_id
   WHERE o.idempotency_key = 'service-role-confirm' LIMIT 1),
  '00000000-0000-4000-8000-000000000001')->>'idempotency_status';
RESET ROLE;

SELECT 'FORWARD_CONFIRMATION_LOCAL_TEST_PASS' AS result;
