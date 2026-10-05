-- P1: online requests await CRM review in the same transaction that creates
-- their order and service lines. The privileged in-house wrapper marks its
-- server-validated path with cf8_inhouse and an options digest.
CREATE OR REPLACE FUNCTION public.create_booking_order_atomic(
  p_idempotency_key       TEXT,
  p_order                 JSONB,
  p_attendees             JSONB,
  p_service_lines         JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_computed_payload_hash TEXT;
  v_canonical_payload_str TEXT;
  v_existing_order        RECORD;
  v_new_order_id          UUID;
  v_order_number          TEXT;
  v_candidate             TEXT;
  v_yymm                  TEXT;
  v_attempt               INT;

  v_branch_id             UUID;
  v_organizer_customer_id UUID;
  v_delivery_type         TEXT;
  v_booking_date          DATE;
  v_currency              TEXT;
  v_payment_preference    TEXT;
  v_order_metadata        JSONB;
  v_initial_status        TEXT;

  v_attendee_record       JSONB;
  v_seq                   INT;
  v_new_att_id            UUID;
  v_attendee_map          JSONB := '{}'::jsonb;

  v_line_record           JSONB;
  v_line_seq              INT;
  v_target_att_seq        INT;
  v_target_att_id         UUID;
  v_service_id            UUID;
  v_staff_id              UUID;
  v_start_time            TIME;
  v_end_time              TIME;
  v_travel_buffer         INT;
  v_line_metadata         JSONB;
  v_new_booking_id        UUID;

  v_inserted_line_ids     UUID[] := ARRAY[]::UUID[];
  v_inserted_att_ids      UUID[] := ARRAY[]::UUID[];
  v_ret_line_ids          JSONB;
  v_ret_att_ids           JSONB;
BEGIN
  -- A. Input sanity
  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE = '22023';
  END IF;

  -- B. Concurrency advisory lock scoped to the idempotency key
  PERFORM pg_advisory_xact_lock(
    hashtext('bkg_order_idempotency:' || p_idempotency_key)::bigint
  );

  -- C. Database-authoritative canonical payload hashing
  -- Deterministic concatenation of the JSONB payload structures
  v_canonical_payload_str := p_order::text || '||' || p_attendees::text || '||' || p_service_lines::text;
  v_computed_payload_hash := encode(
    extensions.digest(v_canonical_payload_str::bytea, 'sha256'),
    'hex'
  );

  -- D. Check existing order by idempotency key
  SELECT id, order_number, payload_hash
  INTO v_existing_order
  FROM public.booking_orders
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    -- Mismatch detection: same key with different payload is strictly rejected
    IF v_existing_order.payload_hash IS DISTINCT FROM v_computed_payload_hash THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'IDEMPOTENCY_CONFLICT',
        DETAIL = 'The idempotency key has already been used with a different payload.';
    END IF;

    -- Return the existing order details idempotently
    SELECT coalesce(jsonb_agg(b.id ORDER BY coalesce(b.line_sequence, 1), b.created_at), '[]'::jsonb)
    INTO v_ret_line_ids
    FROM public.bookings b
    WHERE b.order_id = v_existing_order.id;

    SELECT coalesce(jsonb_agg(ba.id ORDER BY ba.sequence), '[]'::jsonb)
    INTO v_ret_att_ids
    FROM public.booking_attendees ba
    WHERE ba.booking_order_id = v_existing_order.id;

    RETURN jsonb_build_object(
      'ok', true,
      'idempotency_status', 'replayed',
      'order_id', v_existing_order.id,
      'order_number', v_existing_order.order_number,
      'status', public.derive_booking_order_status(v_existing_order.id),
      'service_line_ids', v_ret_line_ids,
      'attendee_ids', v_ret_att_ids
    );
  END IF;

  -- E. Parse and validate order parameters
  v_branch_id             := (p_order->>'branch_id')::UUID;
  v_organizer_customer_id := (p_order->>'organizer_customer_id')::UUID;
  v_delivery_type         := coalesce(p_order->>'delivery_type', 'in_spa');
  v_booking_date          := (p_order->>'booking_date')::DATE;
  v_currency              := coalesce(p_order->>'currency', 'PHP');
  v_payment_preference    := coalesce(p_order->>'payment_preference', 'pay_at_spa');
  v_order_metadata        := coalesce(p_order->'metadata', '{}'::jsonb);
  -- This RPC is executable only by service_role. Public input is assembled by
  -- the online server action and cannot supply the in-house wrapper marker.
  v_initial_status := CASE
    WHEN v_order_metadata->>'cf8_inhouse' = 'true'
      AND coalesce(v_order_metadata->>'cf8_creation_options_hash', '') ~ '^[0-9a-f]{64}$'
    THEN 'confirmed'
    ELSE 'pending_crm_confirmation'
  END;

  IF v_branch_id IS NULL OR v_organizer_customer_id IS NULL OR v_booking_date IS NULL THEN
    RAISE EXCEPTION 'ORDER_PAYLOAD_INVALID: missing branch_id, organizer_customer_id, or booking_date'
      USING ERRCODE = '22023';
  END IF;

  IF v_payment_preference <> 'pay_at_spa' THEN
    RAISE EXCEPTION 'UNSUPPORTED_PAYMENT_PREFERENCE: only pay_at_spa is supported in this stage.'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_attendees) = 0 THEN
    RAISE EXCEPTION 'ATTENDEES_REQUIRED' USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_service_lines) = 0 THEN
    RAISE EXCEPTION 'SERVICE_LINES_REQUIRED' USING ERRCODE = '22023';
  END IF;

  -- Verify branch and organizer customer exist
  IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = v_branch_id) THEN
    RAISE EXCEPTION 'BRANCH_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = v_organizer_customer_id) THEN
    RAISE EXCEPTION 'CUSTOMER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- F. Random order_number generation with collision retry loop
  v_yymm := to_char(v_booking_date, 'YYMM');
  v_order_number := NULL;
  FOR v_attempt IN 1..20 LOOP
    v_candidate := 'CRD-' || v_yymm || '-' || upper(substr(encode(extensions.gen_random_bytes(3), 'hex'), 1, 4));
    IF NOT EXISTS (
      SELECT 1 FROM public.booking_orders WHERE order_number = v_candidate
    ) THEN
      v_order_number := v_candidate;
      EXIT;
    END IF;
  END LOOP;

  IF v_order_number IS NULL THEN
    RAISE EXCEPTION 'ORDER_NUMBER_GENERATION_FAILED: collision threshold reached, retry checkout.'
      USING ERRCODE = '54000';
  END IF;

  -- G. Insert parent booking_orders row (non-financial, no stored status)
  INSERT INTO public.booking_orders (
    order_number,
    branch_id,
    organizer_customer_id,
    delivery_type,
    booking_date,
    currency,
    payment_preference,
    idempotency_key,
    payload_hash,
    metadata
  ) VALUES (
    v_order_number,
    v_branch_id,
    v_organizer_customer_id,
    v_delivery_type,
    v_booking_date,
    v_currency,
    v_payment_preference,
    p_idempotency_key,
    v_computed_payload_hash,
    v_order_metadata
  )
  RETURNING id INTO v_new_order_id;

  -- H. Insert attendees
  FOR v_attendee_record IN SELECT * FROM jsonb_array_elements(p_attendees)
  LOOP
    v_seq := coalesce((v_attendee_record->>'sequence')::INT, 1);
    INSERT INTO public.booking_attendees (
      booking_order_id,
      sequence,
      display_name,
      customer_id,
      notes,
      metadata
    ) VALUES (
      v_new_order_id,
      v_seq,
      coalesce(v_attendee_record->>'display_name', 'Guest ' || v_seq::text),
      (v_attendee_record->>'customer_id')::UUID,
      v_attendee_record->>'notes',
      coalesce(v_attendee_record->'metadata', '{}'::jsonb)
    )
    RETURNING id INTO v_new_att_id;

    v_inserted_att_ids := array_append(v_inserted_att_ids, v_new_att_id);
    v_attendee_map := jsonb_set(
      v_attendee_map,
      ARRAY[v_seq::text],
      to_jsonb(v_new_att_id::text)
    );
  END LOOP;

  -- I. Insert service-line bookings
  FOR v_line_record IN SELECT * FROM jsonb_array_elements(p_service_lines)
  LOOP
    v_target_att_seq   := coalesce((v_line_record->>'attendee_sequence')::INT, 1);
    v_target_att_id    := (v_attendee_map->>v_target_att_seq::text)::UUID;
    v_line_seq         := coalesce((v_line_record->>'line_sequence')::INT, 1);
    v_service_id       := (v_line_record->>'service_id')::UUID;
    v_staff_id         := (v_line_record->>'staff_id')::UUID;
    v_start_time       := (v_line_record->>'start_time')::TIME;
    v_end_time         := (v_line_record->>'end_time')::TIME;
    v_travel_buffer    := (v_line_record->>'travel_buffer_mins')::INT;
    v_line_metadata    := coalesce(v_line_record->'metadata', '{}'::jsonb);

    IF v_target_att_id IS NULL THEN
      RAISE EXCEPTION 'ATTENDEE_SEQUENCE_UNRESOLVED: %', v_target_att_seq USING ERRCODE = '22023';
    END IF;

    IF v_service_id IS NULL OR v_staff_id IS NULL OR v_start_time IS NULL OR v_end_time IS NULL THEN
      RAISE EXCEPTION 'SERVICE_LINE_PAYLOAD_INVALID' USING ERRCODE = '22023';
    END IF;

    -- Augment line metadata with order and attendee linkages
    v_line_metadata := v_line_metadata || jsonb_build_object(
      'order_id', v_new_order_id,
      'order_number', v_order_number,
      'attendee_id', v_target_att_id
    );

    -- Insert into canonical bookings table.
    -- Critical Compatibility Rule:
    -- customer_id ALWAYS references organizer_customer_id (legacy non-null foreign key).
    -- attendee_id references the specific booking_attendees recipient.
    INSERT INTO public.bookings (
      branch_id,
      service_id,
      staff_id,
      customer_id,
      booking_date,
      start_time,
      end_time,
      type,
      delivery_type,
      status,
      payment_method,
      payment_status,
      amount_paid,
      travel_buffer_mins,
      order_id,
      attendee_id,
      line_sequence,
      metadata
    ) VALUES (
      v_branch_id,
      v_service_id,
      v_staff_id,
      v_organizer_customer_id,
      v_booking_date,
      v_start_time,
      v_end_time,
      'online',
      v_delivery_type,
      v_initial_status,
      'pay_on_site',
      'unpaid',
      0,
      v_travel_buffer,
      v_new_order_id,
      v_target_att_id,
      v_line_seq,
      v_line_metadata
    )
    RETURNING id INTO v_new_booking_id;

    v_inserted_line_ids := array_append(v_inserted_line_ids, v_new_booking_id);
  END LOOP;

  -- J. Return complete creation response
  SELECT coalesce(jsonb_agg(to_jsonb(id)), '[]'::jsonb)
  INTO v_ret_line_ids
  FROM unnest(v_inserted_line_ids) AS id;

  SELECT coalesce(jsonb_agg(to_jsonb(id)), '[]'::jsonb)
  INTO v_ret_att_ids
  FROM unnest(v_inserted_att_ids) AS id;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotency_status', 'created',
    'order_id', v_new_order_id,
    'order_number', v_order_number,
    'status', public.derive_booking_order_status(v_new_order_id),
    'service_line_ids', v_ret_line_ids,
    'attendee_ids', v_ret_att_ids
  );
END;
$$;

COMMENT ON FUNCTION public.create_booking_order_atomic(TEXT, JSONB, JSONB, JSONB) IS
  'Atomically creates an order, attendees, and service-line bookings. Online creation starts pending CRM confirmation; the privileged in-house wrapper starts confirmed. Service-role execution and idempotency are preserved.';

COMMENT ON COLUMN public.bookings.status IS
  'pending = legacy unconfirmed booking; pending_payment = legacy payment hold; pending_crm_confirmation = online request awaiting CRM review regardless of payment; confirmed = CRM-confirmed booking; in_progress = service started; completed = service finished; cancelled = cancelled booking; no_show = customer did not arrive';

REVOKE ALL ON FUNCTION public.create_booking_order_atomic(TEXT, JSONB, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_booking_order_atomic(TEXT, JSONB, JSONB, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.create_booking_order_atomic(TEXT, JSONB, JSONB, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_order_atomic(TEXT, JSONB, JSONB, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_branch_id  UUID,
  p_service_id UUID,
  p_staff_id   UUID  DEFAULT NULL,
  p_date       DATE  DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  staff_id   UUID,
  staff_name TEXT,
  staff_tier TEXT,
  slot_time  TIME,
  available  BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buffer_before       INT;
  v_duration_minutes    INT;
  v_buffer_after        INT;
  v_total_block_minutes INT;
  v_slot_interval_mins  INT;
  v_day_of_week         SMALLINT;
BEGIN
  SELECT
    s.buffer_before,
    s.duration_minutes,
    s.buffer_after
  INTO
    v_buffer_before,
    v_duration_minutes,
    v_buffer_after
  FROM public.services s
  WHERE s.id = p_service_id
    AND s.is_active = TRUE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_total_block_minutes := v_buffer_before + v_duration_minutes + v_buffer_after;

  SELECT b.slot_interval_minutes
  INTO v_slot_interval_mins
  FROM public.branches b
  WHERE b.id = p_branch_id
    AND b.is_active = TRUE;

  IF NOT FOUND OR v_slot_interval_mins IS NULL OR v_slot_interval_mins <= 0 THEN
    RETURN;
  END IF;

  v_day_of_week := EXTRACT(DOW FROM p_date)::SMALLINT;

  RETURN QUERY
  WITH
  staff_pool AS (
    SELECT
      s.id AS staff_id,
      s.full_name AS staff_name,
      s.tier AS staff_tier
    FROM public.staff s
    WHERE s.branch_id = p_branch_id
      AND s.is_active = TRUE
      AND (p_staff_id IS NULL OR s.id = p_staff_id)
  ),
  working_hours AS (
    SELECT DISTINCT
      sp.staff_id,
      sp.staff_name,
      sp.staff_tier,
      CASE
        WHEN so.is_day_off = TRUE THEN NULL
        WHEN so.id IS NOT NULL AND so.start_time IS NOT NULL THEN so.start_time
        WHEN ss.id IS NOT NULL THEN ss.start_time
        ELSE NULL
      END AS work_start,
      CASE
        WHEN so.is_day_off = TRUE THEN NULL
        WHEN so.id IS NOT NULL AND so.end_time IS NOT NULL THEN so.end_time
        WHEN ss.id IS NOT NULL THEN ss.end_time
        ELSE NULL
      END AS work_end
    FROM staff_pool sp
    LEFT JOIN public.schedule_overrides so
      ON so.staff_id = sp.staff_id
     AND so.override_date = p_date
    LEFT JOIN public.staff_schedules ss
      ON ss.staff_id = sp.staff_id
     AND ss.day_of_week = v_day_of_week
     AND ss.is_active = TRUE
  ),
  active_hours AS (
    SELECT
      wh.*,
      CASE
        WHEN work_end_raw_min <= work_start_raw_min THEN work_end_raw_min + 1440
        ELSE work_end_raw_min
      END AS work_end_min
    FROM (
      SELECT
        wh.*,
        (EXTRACT(HOUR FROM wh.work_start)::INT * 60
          + EXTRACT(MINUTE FROM wh.work_start)::INT) AS work_start_raw_min,
        (EXTRACT(HOUR FROM wh.work_end)::INT * 60
          + EXTRACT(MINUTE FROM wh.work_end)::INT) AS work_end_raw_min
      FROM working_hours wh
      WHERE wh.work_start IS NOT NULL
        AND wh.work_end IS NOT NULL
        AND wh.work_start <> wh.work_end
    ) wh
  ),
  slot_grid AS (
    SELECT
      ah.staff_id,
      ah.staff_name,
      ah.staff_tier,
      slot_abs.slot_start_min,
      slot_abs.slot_end_min,
      make_time(
        (((slot_abs.slot_start_min % 1440) / 60)::INT),
        ((slot_abs.slot_start_min % 1440) % 60)::INT,
        0
      ) AS slot_time
    FROM active_hours ah
    CROSS JOIN LATERAL generate_series(
      ah.work_start_raw_min,
      ah.work_end_min - v_total_block_minutes,
      v_slot_interval_mins
    ) AS gs(slot_start_min)
    CROSS JOIN LATERAL (
      SELECT
        gs.slot_start_min::INT AS slot_start_min,
        (gs.slot_start_min + v_total_block_minutes)::INT AS slot_end_min
    ) slot_abs
    WHERE ah.work_end_min - ah.work_start_raw_min >= v_total_block_minutes
  ),
  busy_from_bookings AS (
    SELECT
      b.staff_id,
      CASE
        WHEN ah.work_end_min > 1440 AND busy_raw.busy_start_min < ah.work_start_raw_min
          THEN busy_raw.busy_start_min + 1440
        ELSE busy_raw.busy_start_min
      END AS busy_start_min,
      CASE
        WHEN busy_raw.busy_end_min <= busy_raw.busy_start_min
          THEN busy_raw.busy_end_min + 1440
        WHEN ah.work_end_min > 1440 AND busy_raw.busy_start_min < ah.work_start_raw_min
          THEN busy_raw.busy_end_min + 1440
        ELSE busy_raw.busy_end_min
      END AS busy_end_min
    FROM public.bookings b
    JOIN active_hours ah ON ah.staff_id = b.staff_id
    CROSS JOIN LATERAL (
      SELECT
        (EXTRACT(HOUR FROM b.start_time)::INT * 60
          + EXTRACT(MINUTE FROM b.start_time)::INT) AS busy_start_min,
        (EXTRACT(HOUR FROM b.end_time)::INT * 60
          + EXTRACT(MINUTE FROM b.end_time)::INT) AS busy_end_min
    ) busy_raw
    WHERE b.booking_date = p_date
      AND (
        b.status IN ('pending', 'pending_crm_confirmation', 'confirmed', 'in_progress', 'completed')
        OR (
          b.status = 'pending_payment'
          AND b.hold_expires_at > NOW()
        )
      )
  ),
  busy_from_blocks AS (
    SELECT
      bt.staff_id,
      CASE
        WHEN ah.work_end_min > 1440 AND busy_raw.busy_start_min < ah.work_start_raw_min
          THEN busy_raw.busy_start_min + 1440
        ELSE busy_raw.busy_start_min
      END AS busy_start_min,
      CASE
        WHEN busy_raw.busy_end_min <= busy_raw.busy_start_min
          THEN busy_raw.busy_end_min + 1440
        WHEN ah.work_end_min > 1440 AND busy_raw.busy_start_min < ah.work_start_raw_min
          THEN busy_raw.busy_end_min + 1440
        ELSE busy_raw.busy_end_min
      END AS busy_end_min
    FROM public.blocked_times bt
    JOIN active_hours ah ON ah.staff_id = bt.staff_id
    CROSS JOIN LATERAL (
      SELECT
        (EXTRACT(HOUR FROM bt.start_time)::INT * 60
          + EXTRACT(MINUTE FROM bt.start_time)::INT) AS busy_start_min,
        (EXTRACT(HOUR FROM bt.end_time)::INT * 60
          + EXTRACT(MINUTE FROM bt.end_time)::INT) AS busy_end_min
    ) busy_raw
    WHERE bt.block_date = p_date
  )
  SELECT DISTINCT
    sg.staff_id,
    sg.staff_name,
    sg.staff_tier,
    sg.slot_time,
    NOT (
      EXISTS (
        SELECT 1
        FROM busy_from_bookings bb
        WHERE bb.staff_id = sg.staff_id
          AND sg.slot_start_min < bb.busy_end_min
          AND sg.slot_end_min > bb.busy_start_min
      )
      OR
      EXISTS (
        SELECT 1
        FROM busy_from_blocks bk
        WHERE bk.staff_id = sg.staff_id
          AND sg.slot_start_min < bk.busy_end_min
          AND sg.slot_end_min > bk.busy_start_min
      )
    ) AS available
  FROM slot_grid sg
  ORDER BY sg.staff_name, sg.slot_time;
END;
$$;


CREATE OR REPLACE FUNCTION public.get_daily_schedule(
  p_branch_id UUID,
  p_date      DATE
)
RETURNS TABLE (
  staff_id   UUID,
  staff_name TEXT,
  staff_tier TEXT,
  work_start TIME,
  work_end   TIME,
  bookings   JSONB,
  blocks     JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dow INT := EXTRACT(DOW FROM p_date);
BEGIN
  RETURN QUERY
  WITH active_staff AS (
    SELECT
      s.id AS sid,
      s.full_name AS sname,
      s.tier AS stier
    FROM public.staff s
    WHERE s.branch_id = p_branch_id
      AND s.is_active = TRUE
  ),
  work_window_rows AS (
    SELECT DISTINCT
      ast.sid,
      so.is_day_off AS override_day_off,
      CASE
        WHEN so.is_day_off = TRUE THEN NULL
        WHEN so.id IS NOT NULL AND so.start_time IS NOT NULL THEN so.start_time
        WHEN ss.id IS NOT NULL THEN ss.start_time
        ELSE NULL
      END AS work_start,
      CASE
        WHEN so.is_day_off = TRUE THEN NULL
        WHEN so.id IS NOT NULL AND so.end_time IS NOT NULL THEN so.end_time
        WHEN ss.id IS NOT NULL THEN ss.end_time
        ELSE NULL
      END AS work_end
    FROM active_staff ast
    LEFT JOIN public.schedule_overrides so
      ON so.staff_id = ast.sid
     AND so.override_date = p_date
    LEFT JOIN public.staff_schedules ss
      ON ss.staff_id = ast.sid
     AND ss.day_of_week = v_dow
     AND ss.is_active = TRUE
  ),
  work_window_minutes AS (
    SELECT
      wwr.*,
      CASE
        WHEN work_end_raw_min <= work_start_raw_min THEN work_end_raw_min + 1440
        ELSE work_end_raw_min
      END AS work_end_min
    FROM (
      SELECT
        wwr.*,
        (EXTRACT(HOUR FROM wwr.work_start)::INT * 60
          + EXTRACT(MINUTE FROM wwr.work_start)::INT) AS work_start_raw_min,
        (EXTRACT(HOUR FROM wwr.work_end)::INT * 60
          + EXTRACT(MINUTE FROM wwr.work_end)::INT) AS work_end_raw_min
      FROM work_window_rows wwr
      WHERE wwr.work_start IS NOT NULL
        AND wwr.work_end IS NOT NULL
        AND wwr.work_start <> wwr.work_end
    ) wwr
  ),
  work_hours AS (
    SELECT
      ast.sid,
      CASE
        WHEN COALESCE(BOOL_OR(wwr.override_day_off), FALSE) THEN NULL
        WHEN MIN(wwm.work_start_raw_min) IS NULL THEN NULL
        ELSE make_time(
          (((MIN(wwm.work_start_raw_min) % 1440) / 60)::INT),
          ((MIN(wwm.work_start_raw_min) % 1440) % 60)::INT,
          0
        )
      END AS wh_start,
      CASE
        WHEN COALESCE(BOOL_OR(wwr.override_day_off), FALSE) THEN NULL
        WHEN MAX(wwm.work_end_min) IS NULL THEN NULL
        ELSE make_time(
          (((MAX(wwm.work_end_min) % 1440) / 60)::INT),
          ((MAX(wwm.work_end_min) % 1440) % 60)::INT,
          0
        )
      END AS wh_end
    FROM active_staff ast
    LEFT JOIN work_window_rows wwr ON wwr.sid = ast.sid
    LEFT JOIN work_window_minutes wwm ON wwm.sid = ast.sid
    GROUP BY ast.sid
  ),
  staff_bookings AS (
    SELECT
      b.staff_id AS sid,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id',            b.id,
            'start_time',    b.start_time,
            'end_time',      b.end_time,
            'service',       COALESCE(srv.name, 'Service'),
            'customer',      COALESCE(c.full_name, '-'),
            'status',        b.status,
            'type',          b.type,
            'resource_id',   b.resource_id,
            'resource_name', res.name
          )
          ORDER BY b.start_time
        )
        FILTER (WHERE b.id IS NOT NULL),
        '[]'::JSONB
      ) AS booking_list
    FROM public.bookings b
    LEFT JOIN public.services srv ON srv.id = b.service_id
    LEFT JOIN public.customers c ON c.id = b.customer_id
    LEFT JOIN public.branch_resources res ON res.id = b.resource_id
    WHERE b.branch_id = p_branch_id
      AND b.booking_date = p_date
      AND (
        b.status IN ('pending', 'pending_crm_confirmation', 'confirmed', 'in_progress', 'completed')
        OR (
          b.status = 'pending_payment'
          AND b.hold_expires_at > NOW()
        )
      )
    GROUP BY b.staff_id
  ),
  staff_blocks AS (
    SELECT
      bt.staff_id AS sid,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'start_time', bt.start_time,
            'end_time',   bt.end_time,
            'reason',     bt.reason
          )
          ORDER BY bt.start_time
        )
        FILTER (WHERE bt.id IS NOT NULL),
        '[]'::JSONB
      ) AS block_list
    FROM public.blocked_times bt
    WHERE bt.block_date = p_date
    GROUP BY bt.staff_id
  )
  SELECT
    ast.sid::UUID AS staff_id,
    ast.sname::TEXT AS staff_name,
    ast.stier::TEXT AS staff_tier,
    wh.wh_start AS work_start,
    wh.wh_end AS work_end,
    COALESCE(sb.booking_list, '[]'::JSONB) AS bookings,
    COALESCE(stb.block_list, '[]'::JSONB) AS blocks
  FROM active_staff ast
  LEFT JOIN work_hours wh ON wh.sid = ast.sid
  LEFT JOIN staff_bookings sb ON sb.sid = ast.sid
  LEFT JOIN staff_blocks stb ON stb.sid = ast.sid
  ORDER BY ast.stier, ast.sname;
END;
$$;

-- CRM review is a durable reservation. Only the legacy payment hold expires.
CREATE OR REPLACE FUNCTION public.crm_booking_row_blocks_availability(
  p_status text,
  p_hold_expires_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_status IN ('pending', 'pending_crm_confirmation', 'confirmed', 'in_progress', 'completed') THEN true
    WHEN p_status = 'pending_payment'
      THEN p_hold_expires_at IS NOT NULL AND p_hold_expires_at > now()
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.crm_booking_row_blocks_availability(text, timestamptz) FROM PUBLIC;

-- One server-authoritative transition for every service line in an online
-- order. Row locks and a single UPDATE prevent client-loop partial confirmation.
CREATE OR REPLACE FUNCTION public.confirm_online_booking_order_atomic(
  p_booking_id uuid,
  p_branch_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_id uuid;
  v_pending_count integer;
  v_updated_count integer;
  v_changed_ids jsonb;
  v_now_manila timestamp := now() AT TIME ZONE 'Asia/Manila';
BEGIN
  SELECT b.order_id INTO v_order_id
  FROM public.bookings b
  WHERE b.id = p_booking_id AND b.branch_id = p_branch_id;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'BOOKING_ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- Serialize confirmation with any concurrent line-level status change.
  PERFORM 1 FROM public.booking_orders bo WHERE bo.id = v_order_id FOR UPDATE;
  PERFORM 1 FROM public.bookings b WHERE b.order_id = v_order_id ORDER BY b.id FOR UPDATE;

  SELECT count(*) INTO v_pending_count FROM public.bookings b
  WHERE b.order_id = v_order_id AND b.status = 'pending_crm_confirmation';

  IF v_pending_count = 0 THEN
    IF EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.order_id = v_order_id
        AND (b.branch_id <> p_branch_id OR b.type <> 'online'
             OR b.status NOT IN ('confirmed', 'in_progress', 'completed'))
    ) THEN
      RAISE EXCEPTION 'BOOKING_ORDER_STATE_CHANGED' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('ok', true, 'order_id', v_order_id,
      'changed_ids', '[]'::jsonb, 'idempotency_status', 'replayed');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.order_id = v_order_id
      AND (b.branch_id <> p_branch_id OR b.type <> 'online'
           OR b.status NOT IN ('pending_crm_confirmation', 'confirmed')
           OR b.booking_progress_status IS DISTINCT FROM 'not_started')
  ) THEN
    RAISE EXCEPTION 'BOOKING_ORDER_STATE_CHANGED' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.order_id = v_order_id
      AND b.status = 'pending_crm_confirmation'
      AND (b.booking_date < v_now_manila::date
           OR (b.booking_date = v_now_manila::date AND b.start_time <= v_now_manila::time)
           OR (b.hold_expires_at IS NOT NULL AND b.hold_expires_at <= now()))
  ) THEN
    RAISE EXCEPTION 'BOOKING_REQUEST_EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.order_id = v_order_id AND b.status = 'pending_crm_confirmation'
      AND (
        NOT EXISTS (
          SELECT 1 FROM public.branch_services bs
          WHERE bs.branch_id = b.branch_id AND bs.service_id = b.service_id
            AND bs.is_active = true
            AND CASE WHEN b.delivery_type = 'home_service'
              THEN bs.available_home_service ELSE bs.available_in_spa END = true
        )
        OR NOT EXISTS (
          SELECT 1 FROM public.staff s
          WHERE s.id = b.staff_id AND s.branch_id = b.branch_id AND s.is_active = true
        )
      )
  ) THEN
    RAISE EXCEPTION 'BOOKING_PROVIDER_OR_SERVICE_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;

  -- The existing booking assignment trigger checks current staff/resource
  -- overlap under advisory locks. An exception rolls back every line here.
  WITH changed AS (
    UPDATE public.bookings b
    SET status = 'confirmed', hold_expires_at = NULL
    WHERE b.order_id = v_order_id AND b.branch_id = p_branch_id
      AND b.status = 'pending_crm_confirmation'
    RETURNING b.id
  )
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb), count(*)
    INTO v_changed_ids, v_updated_count FROM changed;

  IF v_updated_count <> v_pending_count THEN
    RAISE EXCEPTION 'BOOKING_ORDER_STATE_CHANGED' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id,
    'changed_ids', v_changed_ids, 'idempotency_status', 'confirmed');
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_online_booking_order_atomic(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_online_booking_order_atomic(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_online_booking_order_atomic(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_online_booking_order_atomic(uuid, uuid) TO service_role;


CREATE OR REPLACE FUNCTION public.update_booking_progress(
  p_booking_id UUID,
  p_next_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery_type    TEXT;
  v_booking_status   TEXT;
  v_current_progress TEXT;
  v_staff_id         UUID;
  v_driver_id        UUID;
  v_metadata         JSONB;
  v_lat_text         TEXT;
  v_lng_text         TEXT;
BEGIN
  -- Lock row and read current state
  SELECT delivery_type,
         status,
         booking_progress_status,
         staff_id,
         driver_id,
         metadata
    INTO v_delivery_type,
         v_booking_status,
         v_current_progress,
         v_staff_id,
         v_driver_id,
         v_metadata
    FROM bookings
   WHERE id = p_booking_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking_status NOT IN ('confirmed', 'in_progress') THEN
    RAISE EXCEPTION 'BOOKING_NOT_CONFIRMED';
  END IF;

  IF v_delivery_type = 'home_service' AND p_next_status = 'travel_started' THEN
    v_lat_text := v_metadata #>> '{home_service_address,lat}';
    v_lng_text := v_metadata #>> '{home_service_address,lng}';
    IF v_staff_id IS NULL OR v_driver_id IS NULL
      OR coalesce(v_lat_text, '') !~ '^[-]?[0-9]+([.][0-9]+)?$'
      OR coalesce(v_lng_text, '') !~ '^[-]?[0-9]+([.][0-9]+)?$'
    THEN
      RAISE EXCEPTION 'HOME_SERVICE_TRAVEL_NOT_READY';
    END IF;
    IF abs(v_lat_text::numeric) > 90 OR abs(v_lng_text::numeric) > 180 THEN
      RAISE EXCEPTION 'HOME_SERVICE_TRAVEL_NOT_READY';
    END IF;
  END IF;

  -- ── Validate transition by delivery type ──────────────────────────────────

  IF v_delivery_type = 'home_service' THEN
    -- Home-service: full travel chain required
    IF NOT (
      (v_current_progress = 'not_started'     AND p_next_status = 'travel_started') OR
      (v_current_progress = 'travel_started'  AND p_next_status = 'arrived') OR
      (v_current_progress = 'arrived'         AND p_next_status = 'session_started') OR
      (v_current_progress = 'session_started' AND p_next_status = 'completed')
    ) THEN
      RAISE EXCEPTION 'Invalid progress transition for home service: % -> %',
        v_current_progress, p_next_status;
    END IF;

  ELSIF v_delivery_type = 'in_spa' THEN
    -- In-spa: check-in optional; staff may go directly to session_started.
    IF NOT (
      (v_current_progress = 'not_started'     AND p_next_status = 'checked_in') OR
      (v_current_progress = 'not_started'     AND p_next_status = 'session_started') OR
      (v_current_progress = 'checked_in'      AND p_next_status = 'session_started') OR
      (v_current_progress = 'session_started' AND p_next_status = 'completed') OR
      (v_current_progress = 'not_started'     AND p_next_status = 'no_show') OR
      (v_current_progress = 'checked_in'      AND p_next_status = 'no_show')
    ) THEN
      RAISE EXCEPTION 'Invalid progress transition for in-spa: % -> %',
        v_current_progress, p_next_status;
    END IF;

  ELSE
    RAISE EXCEPTION 'Unsupported delivery type for progress tracking: %', v_delivery_type;
  END IF;

  -- ── Apply update ──────────────────────────────────────────────────────────

  IF p_next_status = 'checked_in' THEN
    UPDATE bookings
       SET booking_progress_status = 'checked_in',
           checked_in_at           = NOW()
     WHERE id = p_booking_id;

  ELSIF p_next_status = 'travel_started' THEN
    UPDATE bookings
       SET booking_progress_status = 'travel_started',
           travel_started_at       = NOW()
     WHERE id = p_booking_id;

  ELSIF p_next_status = 'arrived' THEN
    UPDATE bookings
       SET booking_progress_status = 'arrived',
           arrived_at              = NOW()
     WHERE id = p_booking_id;

  ELSIF p_next_status = 'session_started' THEN
    UPDATE bookings
       SET booking_progress_status = 'session_started',
           session_started_at      = NOW(),
           status                  = 'in_progress',
           updated_at              = NOW()
     WHERE id = p_booking_id;

  ELSIF p_next_status = 'completed' THEN
    UPDATE bookings
       SET booking_progress_status = 'completed',
           session_completed_at    = NOW(),
           status                  = 'completed',
           updated_at              = NOW()
     WHERE id = p_booking_id;

  ELSIF p_next_status = 'no_show' THEN
    UPDATE bookings
       SET booking_progress_status = 'no_show',
           no_show_at              = NOW(),
           status                  = 'no_show',
           updated_at              = NOW()
     WHERE id = p_booking_id;

  ELSE
    RAISE EXCEPTION 'Invalid progress status: %', p_next_status;
  END IF;
END;
$$;
