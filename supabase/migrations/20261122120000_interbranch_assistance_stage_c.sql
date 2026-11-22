-- Stage C: Inter-branch Staff Assistance Duty Lifecycle, QR Clock-In Integration,
-- and Booking/Availability Eligibility.
-- Preserves permanent staff.branch_id, isolates borrowed duty windows in
-- staff_assistance_assignments, requires receiving-branch QR arrival before
-- bookability, and enforces cross-branch open-checkin & double-book protection.

BEGIN;

-- 1. PER-STAFF ASSISTANCE ASSIGNMENTS & APPEND-ONLY AUDIT TRAIL
CREATE TABLE IF NOT EXISTS public.staff_assistance_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.staff_assistance_requests(id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  home_branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  receiving_branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  requested_role text NOT NULL CHECK (requested_role IN ('therapist', 'nail_tech', 'aesthetician')),
  visit_type text NOT NULL DEFAULT 'in_spa' CHECK (visit_type IN ('in_spa', 'home_service')),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  assistance_date date NOT NULL,
  status text NOT NULL DEFAULT 'approved'
    CHECK (status IN (
      'approved',
      'home_clocked_out',
      'arrived_clocked_in',
      'completed',
      'cancelled',
      'expired',
      'failed_arrival',
      'exception'
    )),
  home_clocked_out_at timestamptz,
  receiving_checkin_id uuid REFERENCES public.staff_shift_checkins(id) ON DELETE SET NULL,
  arrived_clocked_in_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by_auth_user_id uuid,
  cancellation_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assistance_assignment_unique_request_staff UNIQUE (request_id, staff_id),
  CONSTRAINT assistance_assignment_different_branches CHECK (home_branch_id <> receiving_branch_id),
  CONSTRAINT assistance_assignment_window_valid CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS staff_assistance_assignments_staff_date_idx
  ON public.staff_assistance_assignments (staff_id, assistance_date, status);
CREATE INDEX IF NOT EXISTS staff_assistance_assignments_receiving_date_idx
  ON public.staff_assistance_assignments (receiving_branch_id, assistance_date, status);
CREATE INDEX IF NOT EXISTS staff_assistance_assignments_home_date_idx
  ON public.staff_assistance_assignments (home_branch_id, assistance_date, status);

CREATE TABLE IF NOT EXISTS public.staff_assistance_assignment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.staff_assistance_assignments(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL REFERENCES public.staff_assistance_requests(id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL,
  actor_auth_user_id uuid,
  reason text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_assistance_assignment_events_assignment_idx
  ON public.staff_assistance_assignment_events (assignment_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_staff_assistance_assignment_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    INSERT INTO public.staff_assistance_assignment_events (
      assignment_id, request_id, staff_id, from_status, to_status, reason
    ) VALUES (
      new.id, new.request_id, new.staff_id, NULL, new.status, 'seeded_on_approval'
    );
  ELSIF tg_op = 'UPDATE' THEN
    IF new.status IS DISTINCT FROM old.status THEN
      INSERT INTO public.staff_assistance_assignment_events (
        assignment_id, request_id, staff_id, from_status, to_status, actor_auth_user_id, reason
      ) VALUES (
        new.id, new.request_id, new.staff_id, old.status, new.status, new.cancelled_by_auth_user_id, coalesce(new.cancellation_reason, '')
      );
    END IF;
    new.updated_at := now();
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_assistance_assignment_audit ON public.staff_assistance_assignments;
CREATE TRIGGER trg_staff_assistance_assignment_audit
AFTER INSERT ON public.staff_assistance_assignments
FOR EACH ROW EXECUTE FUNCTION public.log_staff_assistance_assignment_event();

CREATE OR REPLACE FUNCTION public.touch_staff_assistance_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF new.status IS DISTINCT FROM old.status THEN
    INSERT INTO public.staff_assistance_assignment_events (
      assignment_id, request_id, staff_id, from_status, to_status, actor_auth_user_id, reason
    ) VALUES (
      new.id, new.request_id, new.staff_id, old.status, new.status, new.cancelled_by_auth_user_id, coalesce(new.cancellation_reason, '')
    );
  END IF;
  new.updated_at := now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_assistance_assignment_before_update ON public.staff_assistance_assignments;
CREATE TRIGGER trg_staff_assistance_assignment_before_update
BEFORE UPDATE ON public.staff_assistance_assignments
FOR EACH ROW EXECUTE FUNCTION public.touch_staff_assistance_assignment();

-- 2. SEED PER-STAFF ASSIGNMENTS AUTOMATICALLY ON APPROVAL
CREATE OR REPLACE FUNCTION public.seed_assistance_assignments_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_staff_id uuid;
  v_manila_date date;
BEGIN
  IF new.status = 'approved_pending_arrival' AND (tg_op = 'INSERT' OR old.status IS DISTINCT FROM 'approved_pending_arrival') THEN
    v_manila_date := (new.start_at AT TIME ZONE 'Asia/Manila')::date;
    FOREACH v_staff_id IN ARRAY new.selected_staff_ids LOOP
      INSERT INTO public.staff_assistance_assignments (
        request_id,
        staff_id,
        home_branch_id,
        receiving_branch_id,
        requested_role,
        visit_type,
        start_at,
        end_at,
        assistance_date,
        status
      ) VALUES (
        new.id,
        v_staff_id,
        new.lending_branch_id,
        new.requesting_branch_id,
        new.requested_role,
        new.visit_type,
        new.start_at,
        new.end_at,
        v_manila_date,
        'approved'
      )
      ON CONFLICT (request_id, staff_id) DO NOTHING;
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_assistance_assignments_on_approval ON public.staff_assistance_requests;
CREATE TRIGGER trg_seed_assistance_assignments_on_approval
AFTER INSERT OR UPDATE OF status ON public.staff_assistance_requests
FOR EACH ROW EXECUTE FUNCTION public.seed_assistance_assignments_on_approval();

-- Backfill any pre-existing approved_pending_arrival requests
INSERT INTO public.staff_assistance_assignments (
  request_id,
  staff_id,
  home_branch_id,
  receiving_branch_id,
  requested_role,
  visit_type,
  start_at,
  end_at,
  assistance_date,
  status
)
SELECT
  r.id,
  selected.staff_id,
  r.lending_branch_id,
  r.requesting_branch_id,
  r.requested_role,
  r.visit_type,
  r.start_at,
  r.end_at,
  (r.start_at AT TIME ZONE 'Asia/Manila')::date,
  'approved'
FROM public.staff_assistance_requests r
CROSS JOIN LATERAL unnest(r.selected_staff_ids) AS selected(staff_id)
WHERE r.status = 'approved_pending_arrival'
ON CONFLICT (request_id, staff_id) DO NOTHING;

-- RLS & Grants
ALTER TABLE public.staff_assistance_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_assistance_assignment_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.staff_assistance_assignments FROM public, anon, authenticated, service_role;
REVOKE ALL ON public.staff_assistance_assignment_events FROM public, anon, authenticated, service_role;
GRANT SELECT ON public.staff_assistance_assignments TO authenticated;
GRANT SELECT ON public.staff_assistance_assignment_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.staff_assistance_assignments TO service_role;
GRANT SELECT, INSERT ON public.staff_assistance_assignment_events TO service_role;

REVOKE EXECUTE ON FUNCTION public.log_staff_assistance_assignment_event() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_staff_assistance_assignment() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_assistance_assignments_on_approval() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_staff_assistance_assignment_event() TO service_role;
GRANT EXECUTE ON FUNCTION public.touch_staff_assistance_assignment() TO service_role;
GRANT EXECUTE ON FUNCTION public.seed_assistance_assignments_on_approval() TO service_role;

DROP POLICY IF EXISTS "assistance_assignments_read" ON public.staff_assistance_assignments;
CREATE POLICY "assistance_assignments_read" ON public.staff_assistance_assignments
  FOR SELECT TO authenticated
  USING (
    ((SELECT public.get_auth_role()) = 'owner'::text)
    OR (staff_id = (SELECT public.get_auth_staff_id()))
    OR (
      ((SELECT public.get_auth_role()) = ANY (ARRAY[
        'manager'::text, 'assistant_manager'::text, 'store_manager'::text,
        'crm'::text, 'csr'::text, 'csr_head'::text, 'csr_staff'::text
      ]))
      AND (
        home_branch_id = (SELECT public.get_auth_branch_id())
        OR receiving_branch_id = (SELECT public.get_auth_branch_id())
      )
    )
  );

DROP POLICY IF EXISTS "assistance_assignment_events_read" ON public.staff_assistance_assignment_events;
CREATE POLICY "assistance_assignment_events_read" ON public.staff_assistance_assignment_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_assistance_assignments a
      WHERE a.id = assignment_id
    )
  );

-- 3. QR ATTENDANCE BRANCH AUTHORIZATION: integrate Stage C approved assistance windows
CREATE OR REPLACE FUNCTION public.resolve_effective_attendance_branch(
  p_staff_id uuid,
  p_qr_branch_id uuid,
  p_attendance_date date,
  p_is_test boolean
)
RETURNS TABLE(allowed boolean, effective_branch_id uuid, source text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_staff public.staff%rowtype;
  v_effective_branch_id uuid;
  v_source text;
  v_duty_branch_count integer := 0;
  v_open_other_branch_id uuid;
BEGIN
  IF p_staff_id IS NULL OR p_qr_branch_id IS NULL OR p_attendance_date IS NULL THEN
    RETURN QUERY SELECT false, null::uuid, 'review'::text;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branches AS branch_row
    WHERE branch_row.id = p_qr_branch_id AND branch_row.is_active IS true
  ) THEN
    RETURN QUERY SELECT false, null::uuid, 'inactive_branch'::text;
    RETURN;
  END IF;

  SELECT staff_row.* INTO v_staff
  FROM public.staff AS staff_row
  WHERE staff_row.id = p_staff_id
  FOR SHARE;

  IF NOT FOUND
     OR v_staff.is_active IS NOT true
     OR v_staff.archived_at IS NOT NULL
     OR v_staff.merged_into_staff_id IS NOT NULL THEN
    RETURN QUERY SELECT false, null::uuid, 'inactive_staff'::text;
    RETURN;
  END IF;

  -- Priority 1: Approved temporary attendance branch access
  SELECT assignment.branch_id,
         CASE
           WHEN assignment.scope = 'shift' THEN 'temporary_branch_access_shift'
           WHEN assignment.scope = 'business_day' THEN 'temporary_branch_access_day'
           ELSE assignment.assignment_type
         END
    INTO v_effective_branch_id, v_source
  FROM public.staff_attendance_branch_assignments AS assignment
  WHERE assignment.staff_id = p_staff_id
    AND assignment.branch_id = p_qr_branch_id
    AND assignment.status = 'approved'
    AND assignment.assignment_type = 'temporary'
    AND assignment.is_test = coalesce(p_is_test, false)
    AND (assignment.valid_from IS NULL OR assignment.valid_from <= now())
    AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
    AND (
      (
        coalesce(assignment.scope, 'business_day') = 'business_day'
        AND coalesce(assignment.attendance_business_date, assignment.assignment_date)
          = p_attendance_date
      )
      OR (
        assignment.scope = 'shift'
        AND (
          coalesce(assignment.attendance_business_date, assignment.assignment_date)
            = p_attendance_date
          OR EXISTS (
            SELECT 1
            FROM public.staff_shift_checkins AS checkin_row
            WHERE checkin_row.branch_authorization_id = assignment.id
              AND checkin_row.staff_id = assignment.staff_id
              AND checkin_row.branch_id = assignment.branch_id
              AND checkin_row.is_test = assignment.is_test
              AND checkin_row.status = 'checked_in'
              AND checkin_row.checked_out_at IS NULL
          )
        )
      )
    )
  ORDER BY
    CASE assignment.scope WHEN 'shift' THEN 0 WHEN 'business_day' THEN 1 ELSE 2 END,
    assignment.created_at DESC,
    assignment.id
  LIMIT 1;

  -- Priority 2: Approved Stage C inter-branch assistance assignment for the scanned receiving branch
  IF v_effective_branch_id IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.staff_assistance_assignments AS aa
      WHERE aa.staff_id = p_staff_id
        AND aa.receiving_branch_id = p_qr_branch_id
        AND aa.status IN ('approved', 'home_clocked_out', 'arrived_clocked_in')
        AND (
          (now() >= aa.start_at - interval '120 minutes' AND now() <= aa.end_at)
          OR EXISTS (
            SELECT 1
            FROM public.staff_shift_checkins AS sc
            WHERE sc.id = aa.receiving_checkin_id
              AND sc.status = 'checked_in'
              AND sc.checked_out_at IS NULL
              AND sc.is_test = coalesce(p_is_test, false)
          )
        )
    ) THEN
      SELECT sc.branch_id INTO v_open_other_branch_id
      FROM public.staff_shift_checkins AS sc
      WHERE sc.staff_id = p_staff_id
        AND sc.branch_id <> p_qr_branch_id
        AND sc.is_test = coalesce(p_is_test, false)
        AND sc.status = 'checked_in'
        AND sc.checked_out_at IS NULL
      ORDER BY sc.checked_in_at DESC
      LIMIT 1;

      IF v_open_other_branch_id IS NOT NULL THEN
        RETURN QUERY SELECT false, v_open_other_branch_id, 'assistance_home_clock_out_required'::text;
        RETURN;
      END IF;

      RETURN QUERY SELECT true, p_qr_branch_id, 'interbranch_assistance'::text;
      RETURN;
    END IF;
  END IF;

  -- Priority 3: Scheduled duty assignments
  IF v_effective_branch_id IS NULL THEN
    SELECT count(DISTINCT duty.branch_id)::integer
      INTO v_duty_branch_count
    FROM public.staff_duty_assignments AS duty
    WHERE duty.staff_id = p_staff_id
      AND duty.day_of_week = extract(dow FROM p_attendance_date)::integer
      AND duty.is_active IS true;

    IF v_duty_branch_count > 1 THEN
      RETURN QUERY SELECT false, null::uuid, 'duty_assignment_conflict'::text;
      RETURN;
    END IF;

    SELECT duty.branch_id, 'schedule_assignment'
      INTO v_effective_branch_id, v_source
    FROM public.staff_duty_assignments AS duty
    WHERE duty.staff_id = p_staff_id
      AND duty.branch_id = p_qr_branch_id
      AND duty.day_of_week = extract(dow FROM p_attendance_date)::integer
      AND duty.is_active IS true
    ORDER BY duty.created_at DESC, duty.id
    LIMIT 1;

    IF v_effective_branch_id IS NULL AND v_duty_branch_count = 1 THEN
      SELECT duty.branch_id, 'schedule_assignment'
        INTO v_effective_branch_id, v_source
      FROM public.staff_duty_assignments AS duty
      WHERE duty.staff_id = p_staff_id
        AND duty.day_of_week = extract(dow FROM p_attendance_date)::integer
        AND duty.is_active IS true
      ORDER BY duty.created_at DESC, duty.id
      LIMIT 1;
    END IF;
  END IF;

  IF v_effective_branch_id IS NULL THEN
    SELECT assignment.branch_id, 'approved_cross_branch'
      INTO v_effective_branch_id, v_source
    FROM public.staff_attendance_branch_assignments AS assignment
    WHERE assignment.staff_id = p_staff_id
      AND assignment.branch_id = p_qr_branch_id
      AND assignment.status = 'approved'
      AND assignment.assignment_type = 'approved_cross_branch'
      AND assignment.is_test = coalesce(p_is_test, false)
      AND (assignment.valid_from IS NULL OR assignment.valid_from <= now())
      AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
    ORDER BY assignment.created_at DESC, assignment.id
    LIMIT 1;
  END IF;

  IF v_effective_branch_id IS NULL AND v_staff.is_cross_branch IS true THEN
    v_effective_branch_id := p_qr_branch_id;
    v_source := 'approved_cross_branch';
  END IF;

  IF v_effective_branch_id IS NULL THEN
    SELECT transfer_row.new_branch_id, 'effective_permanent_transfer'
      INTO v_effective_branch_id, v_source
    FROM public.staff_permanent_branch_transfers AS transfer_row
    WHERE transfer_row.staff_id = p_staff_id
      AND transfer_row.status IN ('scheduled', 'effective')
      AND transfer_row.effective_date <= p_attendance_date
    ORDER BY transfer_row.effective_date DESC, transfer_row.created_at DESC
    LIMIT 1;
  END IF;

  IF v_effective_branch_id IS NULL THEN
    v_effective_branch_id := v_staff.branch_id;
    v_source := 'home_branch';
  END IF;

  RETURN QUERY SELECT
    v_effective_branch_id = p_qr_branch_id,
    v_effective_branch_id,
    coalesce(v_source, 'review');
END;
$$;

-- 4. BOOKING SLOTS RPC: include arrived (QR clocked-in) inter-branch borrowed staff
--    for their approved Manila shift window while still blocking cross-branch bookings.
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_branch_id uuid,
  p_service_id uuid,
  p_staff_id uuid DEFAULT NULL::uuid,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE(staff_id uuid, staff_name text, staff_tier text, slot_time time without time zone, available boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_buffer_before       INT;
  v_duration_minutes    INT;
  v_buffer_after        INT;
  v_total_block_minutes INT;
  v_slot_interval_mins  INT;
  v_day_of_week         SMALLINT;
BEGIN
  SELECT s.buffer_before, s.duration_minutes, s.buffer_after
  INTO v_buffer_before, v_duration_minutes, v_buffer_after
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
  home_staff_pool AS (
    SELECT
      s.id AS staff_id,
      s.full_name AS staff_name,
      s.tier AS staff_tier
    FROM public.staff s
    WHERE s.branch_id = p_branch_id
      AND s.is_active = TRUE
      AND s.archived_at IS NULL
      AND s.merged_into_staff_id IS NULL
      AND (p_staff_id IS NULL OR s.id = p_staff_id)
  ),
  borrowed_staff_hours AS (
    SELECT
      s.id AS staff_id,
      s.full_name AS staff_name,
      s.tier AS staff_tier,
      (aa.start_at AT TIME ZONE 'Asia/Manila')::time AS work_start,
      (aa.end_at AT TIME ZONE 'Asia/Manila')::time AS work_end
    FROM public.staff_assistance_assignments aa
    JOIN public.staff s ON s.id = aa.staff_id
    WHERE aa.receiving_branch_id = p_branch_id
      AND aa.assistance_date = p_date
      AND aa.status = 'arrived_clocked_in'
      AND s.is_active = TRUE
      AND s.archived_at IS NULL
      AND s.merged_into_staff_id IS NULL
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
    FROM home_staff_pool sp
    LEFT JOIN public.schedule_overrides so
      ON so.staff_id = sp.staff_id
     AND so.override_date = p_date
    LEFT JOIN public.staff_schedules ss
      ON ss.staff_id = sp.staff_id
     AND ss.day_of_week = v_day_of_week
     AND ss.is_active = TRUE
    UNION
    SELECT
      bs.staff_id,
      bs.staff_name,
      bs.staff_tier,
      bs.work_start,
      bs.work_end
    FROM borrowed_staff_hours bs
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

-- 5. REALTIME PUBLICATION
DO $pub$
DECLARE
  v_tbl text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH v_tbl IN ARRAY ARRAY['staff_assistance_requests', 'staff_assistance_assignments'] LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = v_tbl
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_tbl);
      END IF;
    END LOOP;
  END IF;
END;
$pub$;

COMMIT;
