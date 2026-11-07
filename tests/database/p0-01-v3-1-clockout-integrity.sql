-- ============================================================================
-- ISOLATED POSTGRESQL 17 REGRESSION SUITE FOR P0-01 V3.1 CLOCK-OUT INTEGRITY
-- Target DB ONLY: cradlehub_p0_v3_test (inside air-gapped NetworkMode=none PG17)
-- Covers Section 4 Hypotheses 1-7 and Section 7 Required Workflows
-- ============================================================================
\set ON_ERROR_STOP on

DO $gate$
BEGIN
  IF current_database() <> 'cradlehub_p0_v3_test' THEN
    RAISE EXCEPTION 'STOP: Refusing to run V3.1 clock-out integrity tests outside cradlehub_p0_v3_test (got %)', current_database();
  END IF;
END
$gate$;

BEGIN;

-- Extend disposable schema inside this rollback-scoped transaction with the
-- canonical dynamic clock-out policy columns so V3.1 is verified against full
-- production column parity while leaving p0-01-v3-schema-fixture.sql untouched.
ALTER TABLE public.attendance_settings
  ADD COLUMN IF NOT EXISTS early_leave_threshold_minutes integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS overtime_threshold_minutes integer NOT NULL DEFAULT 15;

ALTER TABLE public.staff_shift_checkins
  ADD COLUMN IF NOT EXISTS attendance_expected_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS earliest_normal_clock_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS latest_normal_clock_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS attendance_policy_source text NOT NULL DEFAULT 'schedule',
  ADD COLUMN IF NOT EXISTS attendance_policy_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ============================================================================
-- PART 1: SECTION 4 HYPOTHESES 1, 2, 3, 4, 5, 6, 7
-- ============================================================================
DO $hypotheses$
DECLARE
  v_now timestamptz := now();
  v_bdate date := ((now() AT TIME ZONE 'Asia/Manila')::date
    - CASE WHEN (now() AT TIME ZONE 'Asia/Manila')::time < time '06:00:00' THEN 1 ELSE 0 END);
  v_branch_1 uuid := gen_random_uuid();
  v_branch_2 uuid := gen_random_uuid();
  v_qr_1 uuid := gen_random_uuid();
  v_qr_2 uuid := gen_random_uuid();
  v_staff_a uuid := gen_random_uuid();
  v_staff_b uuid := gen_random_uuid();
  v_device_a uuid := gen_random_uuid();
  v_device_b uuid := gen_random_uuid();
  v_src_event_a uuid := gen_random_uuid();
  v_src_event_b uuid := gen_random_uuid();
  v_c_open uuid;
  v_c_legacy uuid;
  v_c_metrics uuid;
  v_c_early uuid;
  v_c_overtime uuid;
  v_c_done uuid;
  v_c_void uuid;
  v_snap_before jsonb;
  v_snap_after jsonb;
  v_row public.staff_shift_checkins%rowtype;
  v_evt public.qr_scan_events%rowtype;
  v_r record;
BEGIN
  INSERT INTO public.branches (id, name, is_active) VALUES
    (v_branch_1, 'V3.1 Primary Branch', true),
    (v_branch_2, 'V3.1 Secondary Branch', true);

  INSERT INTO public.attendance_settings (
    branch_id, timezone, attendance_day_boundary, early_leave_threshold_minutes, overtime_threshold_minutes
  ) VALUES
    (v_branch_1, 'Asia/Manila', '06:00:00', 10, 15),
    (v_branch_2, 'Asia/Manila', '06:00:00', 10, 15);

  INSERT INTO public.qr_points (id, branch_id, point_type, is_active) VALUES
    (v_qr_1, v_branch_1, 'attendance', true),
    (v_qr_2, v_branch_2, 'attendance', true);

  INSERT INTO public.staff (id, branch_id, full_name, is_active) VALUES
    (v_staff_a, v_branch_1, 'Therapist Alpha', true),
    (v_staff_b, v_branch_1, 'Therapist Bravo', true);

  INSERT INTO public.staff_devices (id, staff_id, branch_id, status, security_state) VALUES
    (v_device_a, v_staff_a, v_branch_1, 'active', 'clear'),
    (v_device_b, v_staff_b, v_branch_1, 'active', 'clear');

  -- Open shift for Staff A (checked in 1 minute ago so H2 can test v_now - 2m inside [-5m, +60s]!)
  INSERT INTO public.staff_shift_checkins (
    staff_id, branch_id, shift_date, shift_type, shift_instance_key,
    checked_in_at, status, attendance_business_date, is_test
  ) VALUES (
    v_staff_a, v_branch_1, v_bdate, 'single', 'v31-open-a',
    v_now - interval '1 minute', 'checked_in', v_bdate, false
  ) RETURNING id INTO v_c_open;

  -- H1a: Future checked_out_at (+7 days) rejected EVEN when metadata.scannedAt is current
  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-h1-future', v_branch_1, v_qr_1, v_staff_a, v_device_a,
    'attendance', 'clock_out', 'success', 'clock_out', 'Clock out',
    null, null, jsonb_build_object('scannedAt', v_now), false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    v_c_open, null,
    jsonb_build_object('checked_out_at', v_now + interval '7 days', 'status', 'checked_out', 'clock_out_method', 'qr'),
    null, 'attendance'
  );
  IF v_r.success OR v_r.code <> 'invalid_checkout_timestamp' THEN
    RAISE EXCEPTION 'FAIL [H1a]: Future checked_out_at was not rejected: %', row_to_json(v_r);
  END IF;

  -- H1b: Malformed checked_out_at rejected cleanly without unhandled SQL exception
  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-h1-malformed', v_branch_1, v_qr_1, v_staff_a, v_device_a,
    'attendance', 'clock_out', 'success', 'clock_out', 'Clock out',
    null, null, '{}'::jsonb, false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    v_c_open, null,
    jsonb_build_object('checked_out_at', 'not-a-valid-timestamp', 'status', 'checked_out', 'clock_out_method', 'qr'),
    null, 'attendance'
  );
  IF v_r.success OR v_r.code <> 'invalid_checkout_timestamp' THEN
    RAISE EXCEPTION 'FAIL [H1b]: Malformed checked_out_at was not rejected cleanly: %', row_to_json(v_r);
  END IF;
  RAISE NOTICE 'PASS [H1]: Future and malformed checked_out_at timestamps rejected.';

  -- H2: checked_out_at earlier than checked_in_at (even when within 5-minute server window!) rejected
  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-h2-before-checkin', v_branch_1, v_qr_1, v_staff_a, v_device_a,
    'attendance', 'clock_out', 'success', 'clock_out', 'Clock out',
    null, null, jsonb_build_object('scannedAt', v_now), false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    v_c_open, null,
    jsonb_build_object('checked_out_at', v_now - interval '2 minutes', 'status', 'checked_out', 'clock_out_method', 'qr'),
    null, 'attendance'
  );
  IF v_r.success OR v_r.code <> 'checkout_before_checkin' THEN
    RAISE EXCEPTION 'FAIL [H2]: checked_out_at earlier than checked_in_at was not rejected: %', row_to_json(v_r);
  END IF;
  RAISE NOTICE 'PASS [H2]: Clock-out earlier than check-in rejected (checkout_before_checkin).';

  -- Move v_c_open checked_in_at back to -4 hours to test H3 historical timestamps & H6 scope checks
  UPDATE public.staff_shift_checkins SET checked_in_at = v_now - interval '4 hours' WHERE id = v_c_open;

  -- H3a: Unrelated historical checked_out_at (-2 hours) without sourceScanEventId rejected
  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-h3-unverified-hist', v_branch_1, v_qr_1, v_staff_a, v_device_a,
    'attendance', 'clock_out', 'success', 'clock_out', 'Clock out',
    null, null, jsonb_build_object('scannedAt', v_now), false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    v_c_open, null,
    jsonb_build_object('checked_out_at', v_now - interval '2 hours', 'status', 'checked_out', 'clock_out_method', 'qr'),
    null, 'attendance'
  );
  IF v_r.success OR v_r.code <> 'invalid_checkout_timestamp' THEN
    RAISE EXCEPTION 'FAIL [H3a]: Unverified historical checked_out_at was not rejected: %', row_to_json(v_r);
  END IF;

  -- H3b: Historical checked_out_at with ANOTHER staff member's sourceScanEventId rejected
  INSERT INTO public.qr_scan_events (
    id, branch_id, qr_point_id, staff_id, device_id, scan_type, action, outcome, is_test, created_at
  ) VALUES
    (v_src_event_b, v_branch_1, v_qr_1, v_staff_b, v_device_b, 'attendance', 'scan_blocked', 'blocked', false, v_now - interval '30 minutes'),
    (v_src_event_a, v_branch_1, v_qr_1, v_staff_a, v_device_a, 'attendance', 'scan_blocked', 'blocked', false, v_now - interval '30 minutes');

  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-h3-wrong-staff-prov', v_branch_1, v_qr_1, v_staff_a, v_device_a,
    'attendance', 'clock_out', 'success', 'clock_out', 'Clock out',
    null, null, jsonb_build_object('sourceScanEventId', v_src_event_b::text), false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    v_c_open, null,
    jsonb_build_object('checked_out_at', v_now - interval '30 minutes', 'status', 'checked_out', 'clock_out_method', 'qr'),
    null, 'attendance'
  );
  IF v_r.success OR v_r.code <> 'invalid_checkout_timestamp' THEN
    RAISE EXCEPTION 'FAIL [H3b]: Cross-staff sourceScanEventId provenance was accepted: %', row_to_json(v_r);
  END IF;

  -- H6: Cross-staff, NULL p_staff_id, cross-branch, cross-test-mode, and side-channel link checks while v_c_open is still open
  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-h6-wrong-staff', v_branch_1, v_qr_1, v_staff_b, v_device_b,
    'attendance', 'clock_out', 'success', 'clock_out', 'Clock out',
    null, null, '{}'::jsonb, false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    v_c_open, null,
    jsonb_build_object('checked_out_at', v_now, 'status', 'checked_out', 'clock_out_method', 'qr'),
    null, 'attendance'
  );
  IF v_r.success OR v_r.code <> 'checkin_not_open' THEN
    RAISE EXCEPTION 'FAIL [H6a]: Wrong staff update was not blocked: %', row_to_json(v_r);
  END IF;

  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-h6-null-staff', v_branch_1, v_qr_1, null, null,
    'attendance', 'clock_out', 'success', 'clock_out', 'Clock out',
    null, null, '{}'::jsonb, false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    v_c_open, null,
    jsonb_build_object('checked_out_at', v_now, 'status', 'checked_out', 'clock_out_method', 'qr'),
    null, 'attendance'
  );
  IF v_r.success OR v_r.code <> 'invalid_checkin_update' THEN
    RAISE EXCEPTION 'FAIL [H6b]: NULL p_staff_id update was not blocked: %', row_to_json(v_r);
  END IF;

  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-h6-wrong-branch', v_branch_2, v_qr_2, v_staff_a, v_device_a,
    'attendance', 'clock_out', 'success', 'clock_out', 'Clock out',
    null, null, '{}'::jsonb, false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    v_c_open, null,
    jsonb_build_object('checked_out_at', v_now, 'status', 'checked_out', 'clock_out_method', 'qr'),
    null, 'attendance'
  );
  IF v_r.success OR v_r.code <> 'checkin_not_open' THEN
    RAISE EXCEPTION 'FAIL [H6c]: Wrong branch update was not blocked: %', row_to_json(v_r);
  END IF;

  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-h6-test-closes-live', v_branch_1, v_qr_1, v_staff_a, v_device_a,
    'attendance', 'clock_out', 'success', 'clock_out', 'Clock out',
    null, null, '{}'::jsonb, true,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    v_c_open, null,
    jsonb_build_object('checked_out_at', v_now, 'status', 'checked_out', 'clock_out_method', 'qr'),
    null, 'attendance'
  );
  IF v_r.success OR v_r.code <> 'checkin_not_open' THEN
    RAISE EXCEPTION 'FAIL [H6d]: Test-mode scan closing live check-in was not blocked: %', row_to_json(v_r);
  END IF;
  RAISE NOTICE 'PASS [H6]: Cross-staff, NULL staff, cross-branch, and cross-test-mode clock-outs all blocked.';

  -- H3c: Legitimate delayed continuation WITH verified sourceScanEventId for Staff A (-30m) SUCCEEDS
  -- and computes worked_minutes = 210 (from -4h to -30m)!
  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-h3-verified-prov', v_branch_1, v_qr_1, v_staff_a, v_device_a,
    'attendance', 'clock_out', 'success', 'clock_out', 'Clock out',
    null, null, jsonb_build_object('sourceScanEventId', v_src_event_a::text), false,
    jsonb_build_object('ok', true, 'outcome', 'success', 'attendance', jsonb_build_object('action', 'clock_out', 'workedMinutes', 0)),
    v_c_open, null,
    jsonb_build_object('checked_out_at', v_now - interval '30 minutes', 'status', 'checked_out', 'clock_out_method', 'qr'),
    null, 'attendance'
  );
  SELECT * INTO v_row FROM public.staff_shift_checkins WHERE id = v_c_open;
  IF NOT v_r.success OR v_r.code <> 'committed' OR v_row.worked_minutes <> 210
     OR (v_r.operation_result->'attendance'->>'workedMinutes')::integer <> 210 THEN
    RAISE EXCEPTION 'FAIL [H3c]: Verified sourceScanEventId clock-out failed or miscalculated worked_minutes: %, row=%',
      row_to_json(v_r), row_to_json(v_row);
  END IF;
  RAISE NOTICE 'PASS [H3]: Unverified historical clock-out blocked; verified sourceScanEventId provenance allowed (worked_minutes=210).';

  -- H4: Established and legacy NULL attendance_business_date protection
  INSERT INTO public.staff_shift_checkins (
    staff_id, branch_id, shift_date, shift_type, shift_instance_key,
    checked_in_at, status, attendance_business_date, is_test
  ) VALUES (
    v_staff_b, v_branch_1, v_bdate, 'single', 'v31-legacy-null-bdate',
    v_now - interval '6 hours', 'checked_in', null, false
  ) RETURNING id INTO v_c_legacy;

  -- H4a: Forged future business date on legacy NULL row is REJECTED
  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-h4-forged-bdate', v_branch_1, v_qr_1, v_staff_b, v_device_b,
    'attendance', 'clock_out', 'success', 'clock_out', 'Clock out',
    null, null, jsonb_build_object('scannedAt', v_now), false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    v_c_legacy, null,
    jsonb_build_object(
      'attendance_business_date', (v_bdate + 30)::text,
      'checked_out_at', v_now,
      'status', 'checked_out',
      'clock_out_method', 'qr'
    ),
    null, 'attendance'
  );
  IF v_r.success OR v_r.code <> 'invalid_business_date' THEN
    RAISE EXCEPTION 'FAIL [H4a]: Forged attendance_business_date on legacy NULL row was not rejected: %', row_to_json(v_r);
  END IF;

  -- H4b: Valid clock-out on legacy NULL row derives attendance_business_date = shift_date (v_bdate)
  -- and preserves immutable shift_instance_key even if p_checkin_update tries to override it!
  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-h4-valid-close', v_branch_1, v_qr_1, v_staff_b, v_device_b,
    'attendance', 'clock_out', 'success', 'clock_out', 'Clock out',
    null, null, jsonb_build_object('scannedAt', v_now), false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    v_c_legacy, null,
    jsonb_build_object(
      'shift_instance_key', 'attempted-key-overwrite',
      'branch_timezone', 'Invalid/Zone_Name',
      'checked_out_at', v_now,
      'status', 'checked_out',
      'clock_out_method', 'qr'
    ),
    null, 'attendance'
  );
  SELECT * INTO v_row FROM public.staff_shift_checkins WHERE id = v_c_legacy;
  IF NOT v_r.success
     OR v_row.attendance_business_date <> v_bdate
     OR v_row.shift_instance_key <> 'v31-legacy-null-bdate'
     OR v_row.branch_timezone <> 'Asia/Manila'
     OR v_row.worked_minutes <> 360 THEN
    RAISE EXCEPTION 'FAIL [H4b]: Legacy row business date / shift_instance_key / timezone integrity failed: %', row_to_json(v_row);
  END IF;

  -- H4c: Subsequent rescan with drifted key on v_bdate is now cleanly blocked as already_checked_out noop!
  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-h4-rescan-noop', v_branch_1, v_qr_1, v_staff_b, v_device_b,
    'attendance', 'clock_in', 'success', 'clock_in', 'Clock in',
    null, null, jsonb_build_object('scannedAt', v_now), false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    null,
    jsonb_build_object(
      'shift_date', v_bdate::text,
      'shift_type', 'closing',
      'shift_instance_key', 'v31-drifted-after-legacy',
      'checked_in_at', v_now,
      'status', 'checked_in',
      'attendance_business_date', v_bdate::text
    ),
    null, null, 'attendance'
  );
  IF NOT v_r.success OR v_r.operation_result->>'outcome' <> 'noop' OR v_r.operation_result->>'reasonCode' <> 'already_checked_out' THEN
    RAISE EXCEPTION 'FAIL [H4c]: Rescan after legacy NULL business-date close reopened shift: %', row_to_json(v_r);
  END IF;
  RAISE NOTICE 'PASS [H4]: Established and legacy NULL attendance_business_date protected; post-close rescan blocked.';

  -- H5: Worked-time, late, early-leave, overtime, status, and method validation
  DELETE FROM public.staff_shift_checkins WHERE staff_id = v_staff_a;

  INSERT INTO public.staff_shift_checkins (
    staff_id, branch_id, shift_date, shift_type, shift_instance_key,
    checked_in_at, status, attendance_business_date, late_minutes,
    scheduled_start_at, scheduled_end_at, is_test
  ) VALUES (
    v_staff_a, v_branch_1, v_bdate, 'single', 'v31-h5-metrics',
    v_now - interval '8 hours', 'checked_in', v_bdate, 25,
    v_now - interval '8 hours 25 minutes', v_now, false
  ) RETURNING id INTO v_c_metrics;

  -- H5a: Negative metrics and forged status/clock_out_method rejected
  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-h5-neg', v_branch_1, v_qr_1, v_staff_a, v_device_a,
    'attendance', 'clock_out', 'success', 'clock_out', 'Clock out',
    null, null, '{}'::jsonb, false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    v_c_metrics, null,
    jsonb_build_object('checked_out_at', v_now, 'status', 'checked_out', 'clock_out_method', 'qr', 'worked_minutes', -10),
    null, 'attendance'
  );
  IF v_r.success OR v_r.code <> 'invalid_checkin_update' THEN
    RAISE EXCEPTION 'FAIL [H5a-neg]: Negative worked_minutes was not rejected: %', row_to_json(v_r);
  END IF;

  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-h5-bad-method', v_branch_1, v_qr_1, v_staff_a, v_device_a,
    'attendance', 'clock_out', 'success', 'clock_out', 'Clock out',
    null, null, '{}'::jsonb, false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    v_c_metrics, null,
    jsonb_build_object('checked_out_at', v_now, 'status', 'checked_out', 'clock_out_method', 'system_auto_close'),
    null, 'attendance'
  );
  IF v_r.success OR v_r.code <> 'invalid_checkin_update' THEN
    RAISE EXCEPTION 'FAIL [H5a-method]: Forged clock_out_method=system_auto_close was not rejected: %', row_to_json(v_r);
  END IF;

  -- H5b: Inflated worked_minutes=99999 and zeroed late_minutes=0 are normalized to server truth (480m, late=25, status=late)
  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-h5-normalize', v_branch_1, v_qr_1, v_staff_a, v_device_a,
    'attendance', 'clock_out', 'success', 'clock_out', 'Clock out',
    null, null, jsonb_build_object('scannedAt', v_now), false,
    jsonb_build_object('ok', true, 'outcome', 'success', 'attendance', jsonb_build_object('action', 'clock_out', 'workedMinutes', 99999)),
    v_c_metrics, null,
    jsonb_build_object(
      'checked_out_at', v_now,
      'status', 'checked_out',
      'clock_out_method', 'qr',
      'worked_minutes', 99999,
      'late_minutes', 0,
      'early_leave_minutes', 0,
      'overtime_minutes', 88888
    ),
    null, 'attendance'
  );
  SELECT * INTO v_row FROM public.staff_shift_checkins WHERE id = v_c_metrics;
  SELECT * INTO v_evt FROM public.qr_scan_events WHERE id = v_r.scan_event_id;
  IF NOT v_r.success
     OR v_row.worked_minutes <> 480
     OR v_row.late_minutes <> 25
     OR v_row.early_leave_minutes <> 0
     OR v_row.overtime_minutes <> 0
     OR v_row.attendance_status <> 'late'
     OR v_row.exception_state <> 'open'
     OR (v_r.operation_result->'attendance'->>'workedMinutes')::integer <> 480
     OR (v_evt.metadata->'normalizedClockOutMetrics'->>'authoritativeWorkedMinutes')::integer <> 480 THEN
    RAISE EXCEPTION 'FAIL [H5b]: Server-authoritative payroll metric normalization failed: row=%, evt=%',
      row_to_json(v_row), v_evt.metadata;
  END IF;

  -- H5c: Dynamic policy earliest_normal_clock_out_at (+45m from now) and latest_normal_clock_out_at (-35m from now)
  DELETE FROM public.staff_shift_checkins WHERE staff_id = v_staff_a;
  INSERT INTO public.staff_shift_checkins (
    staff_id, branch_id, shift_date, shift_type, shift_instance_key,
    checked_in_at, status, attendance_business_date, late_minutes,
    earliest_normal_clock_out_at, latest_normal_clock_out_at, is_test
  ) VALUES (
    v_staff_a, v_branch_1, v_bdate, 'single', 'v31-h5-early',
    v_now - interval '6 hours', 'checked_in', v_bdate, 0,
    v_now + interval '45 minutes', v_now + interval '90 minutes', false
  ) RETURNING id INTO v_c_early;

  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-h5-early-out', v_branch_1, v_qr_1, v_staff_a, v_device_a,
    'attendance', 'clock_out', 'success', 'early_clock_out', 'Clock out',
    null, null, jsonb_build_object('scannedAt', v_now), false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    v_c_early, null,
    jsonb_build_object('checked_out_at', v_now, 'status', 'checked_out', 'clock_out_method', 'qr'),
    null, 'attendance'
  );
  SELECT * INTO v_row FROM public.staff_shift_checkins WHERE id = v_c_early;
  IF v_row.worked_minutes <> 360 OR v_row.early_leave_minutes <> 45 OR v_row.overtime_minutes <> 0 OR v_row.attendance_status <> 'early_leave' THEN
    RAISE EXCEPTION 'FAIL [H5c-early]: Dynamic early_leave calculation mismatch: %', row_to_json(v_row);
  END IF;

  DELETE FROM public.staff_shift_checkins WHERE staff_id = v_staff_a;
  INSERT INTO public.staff_shift_checkins (
    staff_id, branch_id, shift_date, shift_type, shift_instance_key,
    checked_in_at, status, attendance_business_date, late_minutes,
    earliest_normal_clock_out_at, latest_normal_clock_out_at, is_test
  ) VALUES (
    v_staff_a, v_branch_1, v_bdate, 'single', 'v31-h5-ot',
    v_now - interval '9 hours', 'checked_in', v_bdate, 0,
    v_now - interval '60 minutes', v_now - interval '35 minutes', false
  ) RETURNING id INTO v_c_overtime;

  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-h5-ot-out', v_branch_1, v_qr_1, v_staff_a, v_device_a,
    'attendance', 'clock_out', 'success', 'overtime_clock_out', 'Clock out',
    null, null, jsonb_build_object('scannedAt', v_now), false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    v_c_overtime, null,
    jsonb_build_object('checked_out_at', v_now, 'status', 'checked_out', 'clock_out_method', 'qr'),
    null, 'attendance'
  );
  SELECT * INTO v_row FROM public.staff_shift_checkins WHERE id = v_c_overtime;
  IF v_row.worked_minutes <> 540 OR v_row.early_leave_minutes <> 0 OR v_row.overtime_minutes <> 35 OR v_row.attendance_status <> 'overtime' THEN
    RAISE EXCEPTION 'FAIL [H5c-ot]: Dynamic overtime calculation mismatch: %', row_to_json(v_row);
  END IF;
  RAISE NOTICE 'PASS [H5]: Worked-time, late, early-leave, overtime, and status metrics enforced authoritatively on server.';

  -- H7: Already-completed and voided attendance records cannot be mutated (including side-channel p_checkin_update IS NULL)
  v_c_done := v_c_overtime;
  SELECT to_jsonb(c.*) INTO v_snap_before FROM public.staff_shift_checkins c WHERE id = v_c_done;

  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-h7-done', v_branch_1, v_qr_1, v_staff_a, v_device_a,
    'attendance', 'clock_out', 'success', 'clock_out', 'Clock out',
    null, null, '{}'::jsonb, false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    v_c_done, null,
    jsonb_build_object('checked_out_at', v_now, 'status', 'checked_out', 'clock_out_method', 'qr'),
    null, 'attendance'
  );
  IF v_r.success OR v_r.code <> 'checkin_not_open' THEN
    RAISE EXCEPTION 'FAIL [H7a]: Completed attendance record update did not return checkin_not_open: %', row_to_json(v_r);
  END IF;

  -- Side-channel check: p_action='clock_out' with p_checkin_update IS NULL must NOT mutate updated_at or clock_out_scan_event_id
  UPDATE public.staff_shift_checkins SET clock_out_scan_event_id = NULL WHERE id = v_c_done;
  SELECT to_jsonb(c.*) INTO v_snap_before FROM public.staff_shift_checkins c WHERE id = v_c_done;

  PERFORM * FROM public.commit_attendance_scan_transaction(
    'v31-h7-sidechannel', v_branch_1, v_qr_1, v_staff_a, v_device_a,
    'attendance', 'clock_out', 'noop', 'already_checked_out', 'Noop',
    null, null, '{}'::jsonb, false,
    jsonb_build_object('ok', true, 'outcome', 'noop'),
    v_c_done, null, null, null, 'attendance'
  );
  SELECT to_jsonb(c.*) INTO v_snap_after FROM public.staff_shift_checkins c WHERE id = v_c_done;
  IF v_snap_before IS DISTINCT FROM v_snap_after THEN
    RAISE EXCEPTION 'FAIL [H7-sidechannel]: Completed record mutated when p_checkin_update IS NULL! before=% after=%',
      v_snap_before, v_snap_after;
  END IF;

  INSERT INTO public.staff_shift_checkins (
    staff_id, branch_id, shift_date, shift_type, shift_instance_key,
    checked_in_at, checked_out_at, status, attendance_business_date, is_test
  ) VALUES (
    v_staff_a, v_branch_1, v_bdate, 'single', 'v31-h7-void',
    v_now - interval '5 hours', null, 'voided', v_bdate, false
  ) RETURNING id INTO v_c_void;

  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-h7-void-call', v_branch_1, v_qr_1, v_staff_a, v_device_a,
    'attendance', 'clock_out', 'success', 'clock_out', 'Clock out',
    null, null, '{}'::jsonb, false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    v_c_void, null,
    jsonb_build_object('checked_out_at', v_now, 'status', 'checked_out', 'clock_out_method', 'qr'),
    null, 'attendance'
  );
  IF v_r.success OR v_r.code <> 'checkin_not_open' THEN
    RAISE EXCEPTION 'FAIL [H7b]: Voided attendance record update was not rejected: %', row_to_json(v_r);
  END IF;
  RAISE NOTICE 'PASS [H7]: Already-completed and voided records remained 100%% immutable.';
END
$hypotheses$;

-- ============================================================================
-- PART 2: SECTION 7 WORKFLOW PRESERVATION
--   - Overnight clock-out after midnight before 06:00 boundary AND past 06:00
--   - Staff Portal clock-out coexistence
--   - Stale open check-in recovery audit-link coexistence
--   - Full inter-branch temporary Staff Assistance sending + receiving clock-outs
-- ============================================================================
DO $workflows$
DECLARE
  v_now timestamptz := now();
  v_tz_02 text;
  v_bdate_02 date;
  v_bdate_manila date := ((now() AT TIME ZONE 'Asia/Manila')::date
    - CASE WHEN (now() AT TIME ZONE 'Asia/Manila')::time < time '06:00:00' THEN 1 ELSE 0 END);
  v_branch_02 uuid := gen_random_uuid();
  v_branch_home uuid := gen_random_uuid();
  v_branch_recv uuid := gen_random_uuid();
  v_qr_02 uuid := gen_random_uuid();
  v_qr_home uuid := gen_random_uuid();
  v_qr_recv uuid := gen_random_uuid();
  v_staff_overnight uuid := gen_random_uuid();
  v_staff_long_on uuid := gen_random_uuid();
  v_staff_portal uuid := gen_random_uuid();
  v_staff_stale uuid := gen_random_uuid();
  v_staff_ib uuid := gen_random_uuid();
  v_c_on uuid;
  v_c_long_on uuid;
  v_c_portal uuid;
  v_c_stale_new uuid;
  v_c_ib_home uuid;
  v_c_ib_recv uuid;
  v_auth_id uuid := gen_random_uuid();
  v_auth_status text;
  v_row public.staff_shift_checkins%rowtype;
  v_r record;
BEGIN
  -- Find an Etc/GMT timezone where current local hour is 02:xx AM (after midnight, before 06:00 boundary!)
  SELECT tz.name INTO v_tz_02
  FROM pg_timezone_names tz
  WHERE tz.name ~ '^Etc/GMT[+-]?[0-9]+$'
    AND extract(hour FROM (v_now AT TIME ZONE tz.name)) = 2
  LIMIT 1;
  v_bdate_02 := (v_now AT TIME ZONE v_tz_02)::date - 1;

  INSERT INTO public.branches (id, name, is_active) VALUES
    (v_branch_02, 'After-Midnight Branch', true),
    (v_branch_home, 'Interbranch Home', true),
    (v_branch_recv, 'Interbranch Receiving', true);

  INSERT INTO public.attendance_settings (branch_id, timezone, attendance_day_boundary) VALUES
    (v_branch_02, v_tz_02, '06:00:00'),
    (v_branch_home, 'Asia/Manila', '06:00:00'),
    (v_branch_recv, 'Asia/Manila', '06:00:00');

  INSERT INTO public.qr_points (id, branch_id, point_type, is_active) VALUES
    (v_qr_02, v_branch_02, 'attendance', true),
    (v_qr_home, v_branch_home, 'attendance', true),
    (v_qr_recv, v_branch_recv, 'attendance', true);

  INSERT INTO public.staff (id, branch_id, full_name, is_active) VALUES
    (v_staff_overnight, v_branch_02, 'Overnight Pre-06 Worker', true),
    (v_staff_long_on, v_branch_home, 'Overnight Past-06 Worker', true),
    (v_staff_portal, v_branch_home, 'Home Service Portal Worker', true),
    (v_staff_stale, v_branch_home, 'Stale Recovery Worker', true),
    (v_staff_ib, v_branch_home, 'Interbranch Worker', true);

  -- W1: After-midnight clock-out at 02:xx AM before 06:00 boundary preserves prior-evening business date
  INSERT INTO public.staff_shift_checkins (
    staff_id, branch_id, shift_date, shift_type, shift_instance_key,
    checked_in_at, status, branch_timezone, attendance_business_date, is_test
  ) VALUES (
    v_staff_overnight, v_branch_02, v_bdate_02, 'closing', 'v31-overnight-02am',
    v_now - interval '5 hours', 'checked_in', v_tz_02, v_bdate_02, false
  ) RETURNING id INTO v_c_on;

  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-w1-overnight-out', v_branch_02, v_qr_02, v_staff_overnight, null,
    'attendance', 'clock_out', 'success', 'clock_out', 'Clock out',
    null, null, jsonb_build_object('scannedAt', v_now), false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    v_c_on, null,
    jsonb_build_object('checked_out_at', v_now, 'status', 'checked_out', 'clock_out_method', 'qr'),
    null, 'attendance'
  );
  SELECT * INTO v_row FROM public.staff_shift_checkins WHERE id = v_c_on;
  IF NOT v_r.success OR v_row.attendance_business_date <> v_bdate_02 OR v_row.worked_minutes <> 300 THEN
    RAISE EXCEPTION 'FAIL [W1]: After-midnight pre-06:00 clock-out failed: %', row_to_json(v_row);
  END IF;

  -- W2: Long overnight shift clocking out PAST 06:00 boundary (10 hours worked from v_bdate_manila - 1)
  -- preserves v_bdate_manila - 1 AND still permits today's new shift on v_bdate_manila!
  INSERT INTO public.staff_shift_checkins (
    staff_id, branch_id, shift_date, shift_type, shift_instance_key,
    checked_in_at, status, branch_timezone, attendance_business_date, is_test
  ) VALUES (
    v_staff_long_on, v_branch_home, v_bdate_manila - 1, 'closing', 'v31-long-overnight',
    v_now - interval '10 hours', 'checked_in', 'Asia/Manila', v_bdate_manila - 1, false
  ) RETURNING id INTO v_c_long_on;

  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-w2-long-overnight-out', v_branch_home, v_qr_home, v_staff_long_on, null,
    'attendance', 'clock_out', 'success', 'overtime_clock_out', 'Clock out',
    null, null, jsonb_build_object('scannedAt', v_now), false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    v_c_long_on, null,
    jsonb_build_object('checked_out_at', v_now, 'status', 'checked_out', 'clock_out_method', 'qr'),
    null, 'attendance'
  );
  SELECT * INTO v_row FROM public.staff_shift_checkins WHERE id = v_c_long_on;
  IF NOT v_r.success OR v_row.attendance_business_date <> (v_bdate_manila - 1) OR v_row.worked_minutes <> 600 THEN
    RAISE EXCEPTION 'FAIL [W2a]: Past-06:00 overnight clock-out failed or altered prior business date: %', row_to_json(v_row);
  END IF;

  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-w2-nextday-in', v_branch_home, v_qr_home, v_staff_long_on, null,
    'attendance', 'clock_in', 'success', 'clock_in', 'Clock in',
    null, null, jsonb_build_object('scannedAt', v_now), false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    null,
    jsonb_build_object(
      'shift_date', v_bdate_manila::text,
      'shift_type', 'single',
      'shift_instance_key', 'v31-nextday-shift',
      'checked_in_at', v_now,
      'status', 'checked_in',
      'attendance_business_date', v_bdate_manila::text
    ),
    null, null, 'attendance'
  );
  IF NOT v_r.success OR v_r.operation_result->>'outcome' <> 'success' THEN
    RAISE EXCEPTION 'FAIL [W2b]: Next-day clock-in after overnight shift blocked: %', row_to_json(v_r);
  END IF;
  RAISE NOTICE 'PASS [W1/W2]: After-midnight pre-06:00 and past-06:00 overnight shifts preserved.';

  -- W3: Staff Portal clock-out record respected by subsequent QR rescan (noop, immutable)
  INSERT INTO public.staff_shift_checkins (
    staff_id, branch_id, shift_date, shift_type, shift_instance_key,
    checked_in_at, checked_out_at, status, clock_out_method,
    attendance_business_date, worked_minutes, is_test
  ) VALUES (
    v_staff_portal, v_branch_home, v_bdate_manila, 'single', 'v31-portal-done',
    v_now - interval '7 hours', v_now - interval '5 minutes', 'checked_out', 'staff_portal_home_service',
    v_bdate_manila, 415, false
  ) RETURNING id INTO v_c_portal;

  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-w3-portal-rescan', v_branch_home, v_qr_home, v_staff_portal, null,
    'attendance', 'clock_in', 'success', 'clock_in', 'Clock in',
    null, null, jsonb_build_object('scannedAt', v_now), false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    null,
    jsonb_build_object(
      'shift_date', v_bdate_manila::text,
      'shift_type', 'single',
      'shift_instance_key', 'v31-portal-done',
      'checked_in_at', v_now,
      'status', 'checked_in',
      'attendance_business_date', v_bdate_manila::text
    ),
    null, null, 'attendance'
  );
  SELECT * INTO v_row FROM public.staff_shift_checkins WHERE id = v_c_portal;
  IF NOT v_r.success OR v_r.operation_result->>'reasonCode' <> 'already_checked_out'
     OR v_row.clock_out_method <> 'staff_portal_home_service' OR v_row.worked_minutes <> 415 THEN
    RAISE EXCEPTION 'FAIL [W3]: Staff Portal completed shift was not preserved on QR rescan: %, row=%',
      row_to_json(v_r), row_to_json(v_row);
  END IF;
  RAISE NOTICE 'PASS [W3]: Staff Portal clock-out preserved and subsequent QR rescan converted to already_checked_out noop.';

  -- W4: Missing clock-out stale recovery audit commit pattern (p_action='clock_in', p_checkin_id=open_row, p_checkin_insert=NULL)
  INSERT INTO public.staff_shift_checkins (
    staff_id, branch_id, shift_date, shift_type, shift_instance_key,
    checked_in_at, status, attendance_business_date, is_test
  ) VALUES (
    v_staff_stale, v_branch_home, v_bdate_manila, 'single', 'v31-stale-recovered-new',
    v_now, 'checked_in', v_bdate_manila, false
  ) RETURNING id INTO v_c_stale_new;

  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-w4-stale-audit', v_branch_home, v_qr_home, v_staff_stale, null,
    'attendance', 'clock_in', 'success', 'stale_checkin_recovered_and_clocked_in', 'Recovered',
    null, null, jsonb_build_object('scannedAt', v_now), false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    v_c_stale_new, null, null,
    jsonb_build_object('exception_type', 'stale_open_checkin', 'severity', 'warning', 'message', 'Recovered prior shift'),
    'attendance'
  );
  SELECT * INTO v_row FROM public.staff_shift_checkins WHERE id = v_c_stale_new;
  IF NOT v_r.success OR v_row.clock_in_scan_event_id IS DISTINCT FROM v_r.scan_event_id OR v_r.recovery_issue_id IS NULL THEN
    RAISE EXCEPTION 'FAIL [W4]: Stale recovery audit commit did not link clock_in_scan_event_id + recovery issue: %, row=%',
      row_to_json(v_r), row_to_json(v_row);
  END IF;
  RAISE NOTICE 'PASS [W4]: Missing clock-out stale recovery audit commit and exception linkage preserved.';

  -- W5: Full inter-branch temporary Staff Assistance cycle (home in -> home out -> recv in -> recv out -> shift grant auto-revoked!)
  INSERT INTO public.staff_shift_checkins (
    staff_id, branch_id, home_branch_id, shift_date, shift_type, shift_instance_key,
    checked_in_at, status, attendance_business_date, is_test
  ) VALUES (
    v_staff_ib, v_branch_home, v_branch_home, v_bdate_manila, 'opening', 'v31-ib-home',
    v_now - interval '6 hours', 'checked_in', v_bdate_manila, false
  ) RETURNING id INTO v_c_ib_home;

  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-w5-ib-home-out', v_branch_home, v_qr_home, v_staff_ib, null,
    'attendance', 'clock_out', 'success', 'clock_out', 'Home out',
    null, null, jsonb_build_object('scannedAt', v_now - interval '3 hours', 'sourceScanEventId', null), false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    v_c_ib_home, null,
    jsonb_build_object('checked_out_at', v_now, 'status', 'checked_out', 'clock_out_method', 'qr'),
    null, 'attendance'
  );
  IF NOT v_r.success THEN
    RAISE EXCEPTION 'FAIL [W5a]: Sending branch clock-out failed: %', row_to_json(v_r);
  END IF;

  INSERT INTO public.staff_attendance_branch_assignments (
    id, staff_id, branch_id, home_branch_id, assignment_date, attendance_business_date,
    assignment_type, scope, status, valid_from, valid_until, is_test
  ) VALUES (
    v_auth_id, v_staff_ib, v_branch_recv, v_branch_home, v_bdate_manila, v_bdate_manila,
    'temporary', 'shift', 'approved', v_now - interval '2 hours', v_now + interval '4 hours', false
  );

  INSERT INTO public.staff_shift_checkins (
    staff_id, branch_id, home_branch_id, branch_authorization_id,
    shift_date, shift_type, shift_instance_key,
    checked_in_at, status, attendance_business_date, is_test
  ) VALUES (
    v_staff_ib, v_branch_recv, v_branch_home, v_auth_id,
    v_bdate_manila, 'closing', 'v31-ib-recv',
    v_now - interval '2 hours', 'checked_in', v_bdate_manila, false
  ) RETURNING id INTO v_c_ib_recv;

  SELECT * INTO v_r FROM public.commit_attendance_scan_transaction(
    'v31-w5-ib-recv-out', v_branch_recv, v_qr_recv, v_staff_ib, null,
    'attendance', 'clock_out', 'success', 'clock_out', 'Receiving out',
    null, null, jsonb_build_object('scannedAt', v_now), false,
    jsonb_build_object('ok', true, 'outcome', 'success'),
    v_c_ib_recv, null,
    jsonb_build_object('checked_out_at', v_now, 'status', 'checked_out', 'clock_out_method', 'qr'),
    null, 'attendance'
  );
  SELECT * INTO v_row FROM public.staff_shift_checkins WHERE id = v_c_ib_recv;
  SELECT status INTO v_auth_status FROM public.staff_attendance_branch_assignments WHERE id = v_auth_id;
  IF NOT v_r.success OR v_row.worked_minutes <> 120 OR v_auth_status <> 'revoked' THEN
    RAISE EXCEPTION 'FAIL [W5b]: Receiving branch clock-out or shift-grant auto-expiry trigger failed: row=%, auth_status=%',
      row_to_json(v_row), v_auth_status;
  END IF;
  RAISE NOTICE 'PASS [W5]: Inter-branch sending & receiving clock-outs succeeded (worked_minutes=120) and shift grant auto-expired.';
END
$workflows$;

ROLLBACK;

SELECT 'P0-01 V3.1 CLOCK-OUT INTEGRITY SUITE: ALL HYPOTHESES & WORKFLOWS PASSED' AS final_result;

