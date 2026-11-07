-- ============================================================================
-- DISPOSABLE ISOLATED POSTGRESQL 17 SCHEMA FIXTURE FOR P0-01 V3 VERIFICATION
-- Target DB ONLY: cradlehub_p0_v3_test (inside air-gapped NetworkMode=none PG17)
-- ============================================================================
\set ON_ERROR_STOP on

DO $gate$
BEGIN
  IF current_database() <> 'cradlehub_p0_v3_test' THEN
    RAISE EXCEPTION 'STOP: Refusing to initialize fixture outside cradlehub_p0_v3_test (got %)', current_database();
  END IF;
END
$gate$;

CREATE SCHEMA IF NOT EXISTS extensions;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$roles$;

GRANT USAGE ON SCHEMA public, extensions TO anon, authenticated, service_role;

CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Test Branch',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  full_name text NOT NULL DEFAULT 'Test Staff',
  nickname text,
  staff_type text NOT NULL DEFAULT 'therapist',
  system_role text NOT NULL DEFAULT 'staff',
  is_cross_branch boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  merged_into_staff_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.attendance_settings (
  branch_id uuid PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'Asia/Manila',
  attendance_day_boundary time NOT NULL DEFAULT '06:00:00'::time,
  early_clock_in_allowed_minutes integer NOT NULL DEFAULT 30,
  late_grace_minutes integer NOT NULL DEFAULT 10,
  clock_in_window_before_shift_minutes integer NOT NULL DEFAULT 30,
  clock_in_window_after_shift_start_minutes integer NOT NULL DEFAULT 120,
  clock_out_window_before_shift_end_minutes integer NOT NULL DEFAULT 120,
  clock_out_window_after_shift_end_minutes integer NOT NULL DEFAULT 120,
  duplicate_scan_window_seconds integer NOT NULL DEFAULT 90,
  test_mode_enabled boolean NOT NULL DEFAULT false
);

CREATE TABLE public.qr_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  public_code text NOT NULL DEFAULT gen_random_uuid()::text,
  point_type text NOT NULL DEFAULT 'attendance',
  is_active boolean NOT NULL DEFAULT true,
  label text NOT NULL DEFAULT 'Attendance QR'
);

CREATE TABLE public.staff_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  security_state text NOT NULL DEFAULT 'clear',
  last_seen_at timestamptz,
  last_service_scan_at timestamptz,
  last_attendance_scan_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.staff_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  shift_type text NOT NULL DEFAULT 'single',
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  window_order smallint NOT NULL DEFAULT 1,
  ends_next_day boolean NOT NULL DEFAULT false
);

CREATE TABLE public.schedule_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  override_date date NOT NULL,
  is_day_off boolean NOT NULL DEFAULT false,
  shift_type text,
  start_time time,
  end_time time,
  ends_next_day boolean
);

CREATE TABLE public.staff_duty_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.staff_permanent_branch_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  previous_branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  new_branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  effective_date date NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'effective', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.staff_attendance_branch_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  home_branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  assignment_date date NOT NULL,
  attendance_business_date date,
  assignment_type text NOT NULL DEFAULT 'temporary'
    CHECK (assignment_type IN ('temporary', 'approved_cross_branch')),
  scope text CHECK (scope IS NULL OR scope IN ('shift', 'business_day')),
  status text NOT NULL DEFAULT 'approved'
    CHECK (status IN ('approved', 'revoked')),
  valid_from timestamptz,
  valid_until timestamptz,
  revoked_at timestamptz,
  revocation_reason text,
  consumed_checkin_id uuid,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_attendance_branch_assignments_validity_check
    CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_until > valid_from)
);

CREATE TABLE public.staff_shift_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  home_branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  branch_authorization_id uuid REFERENCES public.staff_attendance_branch_assignments(id) ON DELETE SET NULL,
  shift_date date NOT NULL,
  shift_type text NOT NULL DEFAULT 'single',
  shift_instance_key text,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  checked_out_at timestamptz,
  status text NOT NULL DEFAULT 'checked_in'
    CHECK (status IN ('checked_in', 'checked_out', 'voided')),
  source_qr_point_id uuid REFERENCES public.qr_points(id) ON DELETE SET NULL,
  clock_in_method text NOT NULL DEFAULT 'qr',
  clock_out_method text,
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  schedule_source text,
  schedule_source_id text,
  branch_timezone text NOT NULL DEFAULT 'Asia/Manila',
  attendance_business_date date,
  worked_minutes integer NOT NULL DEFAULT 0,
  late_minutes integer NOT NULL DEFAULT 0,
  early_leave_minutes integer NOT NULL DEFAULT 0,
  overtime_minutes integer NOT NULL DEFAULT 0,
  attendance_status text NOT NULL DEFAULT 'present',
  exception_state text NOT NULL DEFAULT 'none',
  clock_in_scan_event_id uuid,
  clock_out_scan_event_id uuid,
  is_test boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_shift_checkins_schedule_source_check
    CHECK (schedule_source IS NULL OR schedule_source IN ('weekly', 'override', 'recovery', 'none'))
);

CREATE UNIQUE INDEX staff_shift_checkins_unique_shift_instance
  ON public.staff_shift_checkins (staff_id, branch_id, shift_instance_key, is_test)
  WHERE status <> 'voided' AND shift_instance_key IS NOT NULL;

CREATE UNIQUE INDEX staff_shift_checkins_unique_legacy_day_shift
  ON public.staff_shift_checkins (staff_id, branch_id, shift_date, shift_type, is_test)
  WHERE status <> 'voided' AND shift_instance_key IS NULL;

CREATE TABLE public.qr_scan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  qr_point_id uuid REFERENCES public.qr_points(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  device_id uuid REFERENCES public.staff_devices(id) ON DELETE SET NULL,
  checkin_id uuid REFERENCES public.staff_shift_checkins(id) ON DELETE SET NULL,
  scan_type text NOT NULL,
  action text NOT NULL,
  outcome text NOT NULL,
  reason_code text,
  message text,
  request_id text,
  user_agent text,
  ip_address inet,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_test boolean NOT NULL DEFAULT false,
  operation_id text,
  operation_result jsonb,
  operation_result_recorded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX qr_scan_events_request_id_uidx
  ON public.qr_scan_events (request_id)
  WHERE request_id IS NOT NULL;

CREATE TABLE public.attendance_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  checkin_id uuid REFERENCES public.staff_shift_checkins(id) ON DELETE SET NULL,
  scan_event_id uuid REFERENCES public.qr_scan_events(id) ON DELETE SET NULL,
  latest_scan_event_id uuid REFERENCES public.qr_scan_events(id) ON DELETE SET NULL,
  exception_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  status text NOT NULL DEFAULT 'open',
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text,
  occurrence_count integer NOT NULL DEFAULT 1,
  detected_at timestamptz NOT NULL DEFAULT now(),
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_detected_at timestamptz NOT NULL DEFAULT now(),
  related_checkin_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  recommended_action text,
  priority text NOT NULL DEFAULT 'normal',
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

-- Canonical single-open-attendance trigger (from 20260714143000_attendance_fluid_operations.sql)
CREATE OR REPLACE FUNCTION public.enforce_single_open_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF new.status = 'checked_in' AND new.checked_out_at IS NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtext('attendance_open_staff'),
      hashtext(concat_ws(':', new.staff_id::text, new.is_test::text))
    );

    IF EXISTS (
      SELECT 1
      FROM public.staff_shift_checkins AS existing
      WHERE existing.staff_id = new.staff_id
        AND existing.is_test = new.is_test
        AND existing.status = 'checked_in'
        AND existing.checked_out_at IS NULL
        AND existing.id <> new.id
    ) THEN
      RAISE EXCEPTION USING
        errcode = '23505',
        message = 'attendance_single_open_violation',
        detail = 'A staff member can have only one live open Attendance record.';
    END IF;
  END IF;
  RETURN new;
END;
$$;

CREATE TRIGGER staff_shift_checkins_single_open_guard
  BEFORE INSERT OR UPDATE OF staff_id, is_test, status, checked_out_at
  ON public.staff_shift_checkins
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_open_attendance();

-- Canonical shift-scoped temporary authorization expiry trigger (from 20260715113000)
CREATE OR REPLACE FUNCTION public.expire_shift_branch_authorization_on_clock_out()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF new.checked_out_at IS NOT NULL AND new.branch_authorization_id IS NOT NULL THEN
    UPDATE public.staff_attendance_branch_assignments
       SET status = 'revoked',
           revoked_at = coalesce(revoked_at, now()),
           revocation_reason = coalesce(revocation_reason, 'Attendance shift closed.'),
           consumed_checkin_id = coalesce(consumed_checkin_id, new.id),
           updated_at = now()
     WHERE id = new.branch_authorization_id
       AND scope = 'shift'
       AND status = 'approved';
  END IF;
  RETURN new;
END;
$$;

CREATE TRIGGER staff_shift_checkins_expire_branch_authorization
  AFTER UPDATE OF checked_out_at, status ON public.staff_shift_checkins
  FOR EACH ROW
  WHEN (new.checked_out_at IS NOT NULL)
  EXECUTE FUNCTION public.expire_shift_branch_authorization_on_clock_out();

-- Canonical inter-branch attendance authority resolver (from 20260821034409)
CREATE OR REPLACE FUNCTION public.resolve_effective_attendance_branch(
  p_staff_id uuid,
  p_qr_branch_id uuid,
  p_attendance_date date,
  p_is_test boolean
)
RETURNS TABLE (
  allowed boolean,
  effective_branch_id uuid,
  source text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff public.staff%rowtype;
  v_effective_branch_id uuid;
  v_source text;
  v_duty_branch_count integer := 0;
BEGIN
  IF p_staff_id IS NULL OR p_qr_branch_id IS NULL OR p_attendance_date IS NULL THEN
    RETURN QUERY SELECT false, null::uuid, 'review'::text;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branches AS branch_row
    WHERE branch_row.id = p_qr_branch_id AND branch_row.is_active = true
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

  IF v_effective_branch_id IS NULL THEN
    SELECT count(DISTINCT duty.branch_id)::integer
      INTO v_duty_branch_count
    FROM public.staff_duty_assignments AS duty
    WHERE duty.staff_id = p_staff_id
      AND duty.day_of_week = extract(dow FROM p_attendance_date)::integer
      AND duty.is_active = true;

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
      AND duty.is_active = true
    ORDER BY duty.created_at DESC, duty.id
    LIMIT 1;

    IF v_effective_branch_id IS NULL AND v_duty_branch_count = 1 THEN
      SELECT duty.branch_id, 'schedule_assignment'
        INTO v_effective_branch_id, v_source
      FROM public.staff_duty_assignments AS duty
      WHERE duty.staff_id = p_staff_id
        AND duty.day_of_week = extract(dow FROM p_attendance_date)::integer
        AND duty.is_active = true
      ORDER BY duty.created_at DESC, duty.id
      LIMIT 1;
    END IF;
  END IF;

  IF v_effective_branch_id IS NULL THEN
    SELECT assignment.branch_id, assignment.assignment_type
      INTO v_effective_branch_id, v_source
    FROM public.staff_attendance_branch_assignments AS assignment
    WHERE assignment.staff_id = p_staff_id
      AND assignment.branch_id = p_qr_branch_id
      AND assignment.assignment_date = p_attendance_date
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

CREATE OR REPLACE FUNCTION public.resolve_effective_attendance_branch(
  p_staff_id uuid,
  p_qr_branch_id uuid,
  p_attendance_date date
)
RETURNS TABLE (
  allowed boolean,
  effective_branch_id uuid,
  source text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.resolve_effective_attendance_branch(
    p_staff_id,
    p_qr_branch_id,
    p_attendance_date,
    false
  );
$$;

REVOKE ALL ON FUNCTION public.resolve_effective_attendance_branch(uuid, uuid, date, boolean)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_effective_attendance_branch(uuid, uuid, date, boolean)
  TO service_role;

REVOKE ALL ON FUNCTION public.resolve_effective_attendance_branch(uuid, uuid, date)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_effective_attendance_branch(uuid, uuid, date)
  TO service_role;

SELECT 'P0-01 V3 ISOLATED POSTGRESQL 17 SCHEMA FIXTURE READY' AS status;

