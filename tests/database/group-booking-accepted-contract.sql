\set ON_ERROR_STOP on
-- Run only against the disposable LOCAL TEST database group_booking_test on
-- 127.0.0.1:55434. Never point this fixture at a Supabase project.
DO $$ BEGIN
  IF current_database() <> 'group_booking_test'
    OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
    OR inet_server_port() IS DISTINCT FROM 55434 THEN
    RAISE EXCEPTION 'LOCAL TEST target guard failed';
  END IF;
END $$;

CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;

CREATE TABLE public.branches (id uuid PRIMARY KEY);
CREATE TABLE public.customers (id uuid PRIMARY KEY);
CREATE TABLE public.services (id uuid PRIMARY KEY, is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.staff (
  id uuid PRIMARY KEY,
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  is_active boolean NOT NULL DEFAULT true,
  system_role text NOT NULL DEFAULT 'staff',
  archived_at timestamptz,
  merged_into_staff_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.branch_services (
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  service_id uuid NOT NULL REFERENCES public.services(id),
  is_active boolean NOT NULL DEFAULT true,
  available_in_spa boolean NOT NULL DEFAULT true,
  available_home_service boolean NOT NULL DEFAULT false,
  PRIMARY KEY (branch_id, service_id)
);
CREATE TABLE public.branch_resources (
  id uuid PRIMARY KEY,
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  is_active boolean NOT NULL DEFAULT true,
  capacity integer NOT NULL CHECK (capacity > 0),
  sort_order integer NOT NULL DEFAULT 0,
  name text NOT NULL
);

-- These order/attendee constraints match the accepted BKG3 table contract.
CREATE TABLE public.booking_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  organizer_customer_id uuid NOT NULL REFERENCES public.customers(id),
  delivery_type text NOT NULL DEFAULT 'in_spa' CHECK (delivery_type IN ('in_spa', 'home_service')),
  booking_date date NOT NULL,
  currency text NOT NULL DEFAULT 'PHP',
  payment_preference text NOT NULL DEFAULT 'pay_at_spa' CHECK (payment_preference = 'pay_at_spa'),
  idempotency_key text NOT NULL UNIQUE,
  payload_hash text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.booking_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_order_id uuid NOT NULL REFERENCES public.booking_orders(id) ON DELETE CASCADE,
  sequence integer NOT NULL CHECK (sequence >= 1),
  display_name text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_attendees_order_seq_unique UNIQUE (booking_order_id, sequence)
);
-- Relevant canonical booking columns and foreign keys from the accepted schema.
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  service_id uuid NOT NULL REFERENCES public.services(id),
  staff_id uuid NOT NULL REFERENCES public.staff(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  booking_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  type text NOT NULL,
  delivery_type text NOT NULL,
  status text NOT NULL,
  payment_method text,
  payment_status text,
  amount_paid numeric NOT NULL DEFAULT 0,
  travel_buffer_mins integer,
  order_id uuid REFERENCES public.booking_orders(id),
  attendee_id uuid REFERENCES public.booking_attendees(id),
  line_sequence integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resource_id uuid REFERENCES public.branch_resources(id),
  hold_expires_at timestamptz,
  booking_progress_status text NOT NULL DEFAULT 'not_started',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_line_order_attendee_sequence_unique UNIQUE (order_id, attendee_id, line_sequence)
);

\i .tmp/group-booking-accepted-functions.sql
REVOKE ALL ON FUNCTION public.create_booking_order_atomic(text, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_order_atomic(text, jsonb, jsonb, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.confirm_online_booking_order_atomic(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_online_booking_order_atomic(uuid, uuid) TO service_role;

INSERT INTO public.branches VALUES ('00000000-0000-4000-8000-000000000001');
INSERT INTO public.customers VALUES ('00000000-0000-4000-8000-000000000002');
INSERT INTO public.services VALUES ('00000000-0000-4000-8000-000000000003');
INSERT INTO public.branch_services (branch_id, service_id)
VALUES ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003');
INSERT INTO public.staff (id, branch_id)
SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-000000000001'::uuid
FROM generate_series(1, 100) AS n;
INSERT INTO public.branch_resources (id, branch_id, capacity, sort_order, name)
SELECT ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-000000000001'::uuid, 1, n, 'Room ' || n
FROM generate_series(1, 5) AS n;

CREATE FUNCTION public.test_make_order(
  p_key text, p_guests integer, p_staff_offset integer, p_date date,
  p_services integer DEFAULT 1, p_bad_service_guest integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_attendees jsonb;
  v_lines jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'sequence', n, 'display_name', 'Guest ' || n,
    'customer_id', CASE WHEN n = 1 THEN '00000000-0000-4000-8000-000000000002' ELSE NULL END
  ) ORDER BY n) INTO v_attendees FROM generate_series(1, p_guests) AS n;
  SELECT jsonb_agg(jsonb_build_object(
    'attendee_sequence', n, 'line_sequence', s,
    'service_id', CASE WHEN n = p_bad_service_guest THEN '00000000-0000-4000-8000-000000000099' ELSE '00000000-0000-4000-8000-000000000003' END,
    'staff_id', '00000000-0000-4000-8000-' || lpad((n + p_staff_offset)::text, 12, '0'),
    'start_time', CASE WHEN s = 1 THEN '10:00' ELSE '11:00' END,
    'end_time', CASE WHEN s = 1 THEN '11:00' ELSE '12:00' END,
    'metadata', jsonb_build_object('price_paid', s * 100, 'commercial_snapshot', jsonb_build_object('price', s * 100))
  ) ORDER BY n, s) INTO v_lines
  FROM generate_series(1, p_guests) AS n CROSS JOIN generate_series(1, p_services) AS s;
  RETURN public.create_booking_order_atomic(p_key,
    jsonb_build_object('branch_id', '00000000-0000-4000-8000-000000000001',
      'organizer_customer_id', '00000000-0000-4000-8000-000000000002',
      'delivery_type', 'in_spa', 'booking_date', p_date, 'payment_preference', 'pay_at_spa',
      'metadata', jsonb_build_object('subtotal_amount', p_guests * 100 * p_services * (p_services + 1) / 2,
        'total_amount', p_guests * 100 * p_services * (p_services + 1) / 2)),
    v_attendees, v_lines);
END;
$$;

DO $$
DECLARE
  v_result jsonb;
  v_replay jsonb;
  v_count integer;
  v_total numeric;
  n integer;
BEGIN
  FOREACH n IN ARRAY ARRAY[5, 10, 20, 50] LOOP
    v_result := public.test_make_order('group-' || n, n, 0, current_date + n, 2);
    IF jsonb_array_length(v_result->'attendee_ids') <> n OR
       jsonb_array_length(v_result->'service_line_ids') <> n * 2 THEN
      RAISE EXCEPTION 'Group % count mismatch', n;
    END IF;
    SELECT count(*), sum((b.metadata->>'price_paid')::numeric) INTO v_count, v_total
    FROM public.bookings b WHERE b.order_id = (v_result->>'order_id')::uuid;
    IF v_count <> n * 2 OR v_total <> n * 300
      OR (SELECT (o.metadata->>'total_amount')::numeric FROM public.booking_orders o
          WHERE o.id = (v_result->>'order_id')::uuid) <> v_total THEN
      RAISE EXCEPTION 'Group % service/price mismatch: %, %', n, v_count, v_total;
    END IF;
    IF EXISTS (SELECT 1 FROM public.bookings b
      WHERE b.order_id = (v_result->>'order_id')::uuid
        AND (b.metadata->>'price_paid')::numeric
          <> (b.metadata->'commercial_snapshot'->>'price')::numeric) THEN
      RAISE EXCEPTION 'Group % individual service price snapshot mismatch', n;
    END IF;
    v_replay := public.test_make_order('group-' || n, n, 0, current_date + n, 2);
    IF v_replay->>'idempotency_status' <> 'replayed' OR v_replay->>'order_id' <> v_result->>'order_id' THEN
      RAISE EXCEPTION 'Group % idempotent replay failed', n;
    END IF;
  END LOOP;

  BEGIN
    PERFORM public.test_make_order('bad-fifth-line', 5, 0, current_date + 90, 1, 5);
    RAISE EXCEPTION 'Expected group creation failure did not occur';
  EXCEPTION WHEN foreign_key_violation OR raise_exception THEN
    IF SQLERRM = 'Expected group creation failure did not occur' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.booking_orders WHERE idempotency_key = 'bad-fifth-line') THEN
    RAISE EXCEPTION 'Failed group left a partial order';
  END IF;

  IF has_function_privilege('anon', 'public.confirm_online_booking_order_atomic(uuid,uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.confirm_online_booking_order_atomic(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Confirmation RPC exposed to a client role';
  END IF;
END;
$$;

-- Two pending groups each fit the five rooms in isolation. Distinct therapists
-- let both groups reserve staff; the accepted confirmation RPC then confirms
-- ten simultaneous sessions with no room assignment.
SELECT public.test_make_order('capacity-a', 5, 50, current_date + 100)->>'idempotency_status';
SELECT public.test_make_order('capacity-b', 5, 60, current_date + 100)->>'idempotency_status';
SELECT public.confirm_online_booking_order_atomic(
  (SELECT b.id FROM public.bookings b JOIN public.booking_orders o ON o.id = b.order_id
   WHERE o.idempotency_key = 'capacity-a' LIMIT 1),
  '00000000-0000-4000-8000-000000000001')->>'idempotency_status';
SELECT public.confirm_online_booking_order_atomic(
  (SELECT b.id FROM public.bookings b JOIN public.booking_orders o ON o.id = b.order_id
   WHERE o.idempotency_key = 'capacity-b' LIMIT 1),
  '00000000-0000-4000-8000-000000000001')->>'idempotency_status';
DO $$
DECLARE v_confirmed integer; v_with_room integer;
BEGIN
  SELECT count(*), count(resource_id) INTO v_confirmed, v_with_room FROM public.bookings
  WHERE booking_date = current_date + 100 AND status = 'confirmed';
  IF v_confirmed <> 10 OR v_with_room <> 0 THEN
    RAISE EXCEPTION 'Accepted room gap reproduction changed: %, %', v_confirmed, v_with_room;
  END IF;
END;
$$;
SELECT 'ACCEPTED_CONTRACT_ROOM_GAP_REPRODUCED' AS result;
