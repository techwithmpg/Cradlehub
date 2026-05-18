-- =============================================================================
-- CradleHub — Pending Payment Holds for Public Online Bookings
-- =============================================================================
-- Adds the minimal schema and availability wiring needed for Phase 4:
--   - public online bookings can be pending_payment instead of confirmed/final
--   - pending payment rows carry a temporary hold_expires_at timestamp
--   - active holds block availability
--   - expired holds stop blocking availability
-- =============================================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.bookings.hold_expires_at IS
  'Temporary slot hold expiry for public online bookings waiting for payment/CRM confirmation.';

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (
    status IN (
      'pending',
      'pending_payment',
      'pending_crm_confirmation',
      'confirmed',
      'in_progress',
      'completed',
      'cancelled',
      'no_show',
      'expired'
    )
  );

ALTER TABLE public.booking_events
  DROP CONSTRAINT IF EXISTS booking_events_from_status_check;

ALTER TABLE public.booking_events
  ADD CONSTRAINT booking_events_from_status_check
  CHECK (
    from_status IN (
      'pending',
      'pending_payment',
      'pending_crm_confirmation',
      'confirmed',
      'in_progress',
      'completed',
      'cancelled',
      'no_show',
      'expired'
    )
  );

ALTER TABLE public.booking_events
  DROP CONSTRAINT IF EXISTS booking_events_to_status_check;

ALTER TABLE public.booking_events
  ADD CONSTRAINT booking_events_to_status_check
  CHECK (
    to_status IN (
      'pending',
      'pending_payment',
      'pending_crm_confirmation',
      'confirmed',
      'in_progress',
      'completed',
      'cancelled',
      'no_show',
      'expired'
    )
  );

CREATE INDEX IF NOT EXISTS idx_bookings_active_hold_lookup
  ON public.bookings (staff_id, booking_date, status, hold_expires_at);

CREATE INDEX IF NOT EXISTS idx_bookings_pending_hold_expiry
  ON public.bookings (hold_expires_at)
  WHERE status IN ('pending_payment', 'pending_crm_confirmation');

-- =============================================================================
-- Availability RPC: active holds block, expired holds do not
-- =============================================================================

CREATE OR REPLACE FUNCTION get_available_slots(
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
AS $get_available_slots$
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
  FROM services s
  WHERE s.id = p_service_id
    AND s.is_active = TRUE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_total_block_minutes := v_buffer_before + v_duration_minutes + v_buffer_after;

  SELECT b.slot_interval_minutes
  INTO v_slot_interval_mins
  FROM branches b
  WHERE b.id = p_branch_id
    AND b.is_active = TRUE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_day_of_week := EXTRACT(DOW FROM p_date)::SMALLINT;

  RETURN QUERY
  WITH staff_pool AS (
    SELECT
      s.id        AS v_staff_id,
      s.full_name AS v_staff_name,
      s.tier      AS v_staff_tier
    FROM staff s
    WHERE s.branch_id = p_branch_id
      AND s.is_active = TRUE
      AND (p_staff_id IS NULL OR s.id = p_staff_id)
  ),
  working_hours AS (
    SELECT
      sp.v_staff_id,
      sp.v_staff_name,
      sp.v_staff_tier,
      CASE
        WHEN so.is_day_off = TRUE                             THEN NULL
        WHEN so.id IS NOT NULL AND so.start_time IS NOT NULL  THEN so.start_time
        WHEN ss.id IS NOT NULL                                THEN ss.start_time
        ELSE NULL
      END AS v_work_start,
      CASE
        WHEN so.is_day_off = TRUE                           THEN NULL
        WHEN so.id IS NOT NULL AND so.end_time IS NOT NULL  THEN so.end_time
        WHEN ss.id IS NOT NULL                              THEN ss.end_time
        ELSE NULL
      END AS v_work_end
    FROM staff_pool sp
    LEFT JOIN schedule_overrides so
      ON  so.staff_id      = sp.v_staff_id
      AND so.override_date = p_date
    LEFT JOIN staff_schedules ss
      ON  ss.staff_id      = sp.v_staff_id
      AND ss.day_of_week   = v_day_of_week
      AND ss.is_active     = TRUE
  ),
  active_hours AS (
    SELECT *
    FROM working_hours wh
    WHERE wh.v_work_start IS NOT NULL
      AND wh.v_work_end   IS NOT NULL
      AND wh.v_work_end   > wh.v_work_start
  ),
  slot_grid AS (
    SELECT
      ah.v_staff_id,
      ah.v_staff_name,
      ah.v_staff_tier,
      (
        ah.v_work_start
        + (gs.n * v_slot_interval_mins * INTERVAL '1 minute')
      )::TIME AS v_slot_time,
      (
        ah.v_work_start
        + (gs.n * v_slot_interval_mins * INTERVAL '1 minute')
        + (v_total_block_minutes * INTERVAL '1 minute')
      )::TIME AS v_slot_end
    FROM active_hours ah
    CROSS JOIN generate_series(0, 287) AS gs(n)
    WHERE
      (ah.v_work_start + (gs.n * v_slot_interval_mins * INTERVAL '1 minute'))
        < ah.v_work_end
      AND (
        ah.v_work_start
        + (gs.n * v_slot_interval_mins * INTERVAL '1 minute')
        + (v_total_block_minutes * INTERVAL '1 minute')
      ) <= ah.v_work_end
  ),
  busy_from_bookings AS (
    SELECT
      b.staff_id   AS v_staff_id,
      b.start_time AS v_busy_start,
      b.end_time   AS v_busy_end
    FROM bookings b
    WHERE b.booking_date = p_date
      AND b.staff_id IN (
        SELECT ah.v_staff_id
        FROM active_hours ah
      )
      AND (
        b.status IN ('pending', 'confirmed', 'in_progress', 'completed')
        OR (
          b.status IN ('pending_payment', 'pending_crm_confirmation')
          AND b.hold_expires_at > NOW()
        )
      )
  ),
  busy_from_blocks AS (
    SELECT
      bt.staff_id   AS v_staff_id,
      bt.start_time AS v_busy_start,
      bt.end_time   AS v_busy_end
    FROM blocked_times bt
    WHERE bt.block_date = p_date
      AND bt.staff_id IN (
        SELECT ah.v_staff_id
        FROM active_hours ah
      )
  )
  SELECT
    sg.v_staff_id   AS staff_id,
    sg.v_staff_name AS staff_name,
    sg.v_staff_tier AS staff_tier,
    sg.v_slot_time  AS slot_time,
    NOT (
      EXISTS (
        SELECT 1
        FROM busy_from_bookings bb
        WHERE bb.v_staff_id  = sg.v_staff_id
          AND sg.v_slot_time < bb.v_busy_end
          AND sg.v_slot_end  > bb.v_busy_start
      )
      OR
      EXISTS (
        SELECT 1
        FROM busy_from_blocks bk
        WHERE bk.v_staff_id  = sg.v_staff_id
          AND sg.v_slot_time < bk.v_busy_end
          AND sg.v_slot_end  > bk.v_busy_start
      )
    ) AS available
  FROM slot_grid sg
  ORDER BY sg.v_staff_name, sg.v_slot_time;
END;
$get_available_slots$
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION get_available_slots(UUID, UUID, UUID, DATE) IS
  'Availability engine with pending-payment hold support. Confirmed/in-progress/pending rows block; active pending-payment holds block until hold_expires_at; expired holds do not block.';

-- =============================================================================
-- Legacy public booking RPC: keep behavior aligned with the app action
-- =============================================================================

CREATE OR REPLACE FUNCTION create_online_booking(
  p_branch_id    UUID,
  p_service_id   UUID,
  p_staff_id     UUID,
  p_date         DATE,
  p_start_time   TIME,
  p_full_name    TEXT,
  p_phone        TEXT,
  p_email        TEXT     DEFAULT NULL,
  p_notes        TEXT     DEFAULT NULL
)
RETURNS UUID
AS $create_online_booking$
DECLARE
  v_customer_id     UUID;
  v_end_time        TIME;
  v_slot_available  BOOLEAN;
  v_booking_id      UUID;
BEGIN
  SELECT upsert_customer(p_phone, p_full_name, p_email) INTO v_customer_id;

  SELECT compute_booking_end_time(p_start_time, p_service_id) INTO v_end_time;

  IF v_end_time IS NULL THEN
    RAISE EXCEPTION 'Service % not found or inactive', p_service_id;
  END IF;

  SELECT NOT EXISTS (
    SELECT 1
    FROM bookings b
    WHERE b.staff_id     = p_staff_id
      AND b.booking_date = p_date
      AND (
        b.status IN ('pending', 'confirmed', 'in_progress', 'completed')
        OR (
          b.status IN ('pending_payment', 'pending_crm_confirmation')
          AND b.hold_expires_at > NOW()
        )
      )
      AND p_start_time    < b.end_time
      AND v_end_time      > b.start_time
  )
  INTO v_slot_available;

  IF NOT v_slot_available THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE: The selected time slot is no longer available.';
  END IF;

  INSERT INTO bookings (
    branch_id,
    service_id,
    staff_id,
    customer_id,
    booking_date,
    start_time,
    end_time,
    type,
    status,
    payment_status,
    hold_expires_at,
    metadata
  ) VALUES (
    p_branch_id,
    p_service_id,
    p_staff_id,
    v_customer_id,
    p_date,
    p_start_time,
    v_end_time,
    'online',
    'pending_payment',
    'pending',
    NOW() + INTERVAL '2 hours',
    CASE
      WHEN p_notes IS NOT NULL
      THEN jsonb_build_object('customer_notes', p_notes)
      ELSE '{}'::JSONB
    END
  )
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$create_online_booking$
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION create_online_booking(UUID, UUID, UUID, DATE, TIME, TEXT, TEXT, TEXT, TEXT) IS
  'Atomic public booking creation. Creates a pending_payment booking with payment_status=pending and a two-hour hold_expires_at, then relies on CRM confirmation in the later workflow.';
