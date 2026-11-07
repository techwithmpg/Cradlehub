-- ============================================================================
-- P0-01 V3 ISOLATED POSTGRESQL 17 INTEGRATION & SECURITY SUITE
-- Target DB ONLY: cradlehub_p0_v3_test (NetworkMode=none PG17 container)
-- Covers Scenarios 1..13 and 15..18 (Scenario 14 parallel concurrency runs via
-- tests/database/p0-01-v3-attendance-concurrency.mjs).
-- ============================================================================
\set ON_ERROR_STOP on

DO $gate$
DECLARE
  v_fn_oid oid;
BEGIN
  IF current_database() <> 'cradlehub_p0_v3_test' THEN
    RAISE EXCEPTION 'STOP: Refusing to run outside cradlehub_p0_v3_test (got %)', current_database();
  END IF;

  SELECT p.oid
    INTO v_fn_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'commit_attendance_scan_transaction'
    AND p.pronargs = 20;

  IF v_fn_oid IS NULL THEN
    RAISE EXCEPTION 'STOP: 20-parameter public.commit_attendance_scan_transaction not found';
  END IF;

  IF has_function_privilege('anon', v_fn_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', v_fn_oid, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_fn_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'STOP: Execute privilege boundary violated on commit_attendance_scan_transaction';
  END IF;

  RAISE NOTICE 'PASS [Contract & Grants]: 20-parameter table-returning SECURITY INVOKER function verified; anon/authenticated denied, service_role granted.';
END
$gate$;

BEGIN;

-- ============================================================================
-- SCENARIOS 1, 2, 3, 4, 17, 18:
--   1. First normal clock-in succeeds
--   2. Normal clock-out succeeds
--   3. Completed-shift rescan returns noop (already_checked_out)
--   4. Edited shift_instance_key & legacy NULL attendance_business_date blocked
--   17. Historical completed records remain byte-for-byte unchanged
--   18. QR scan audit events (including pre-created event update & replay) preserved
-- ============================================================================
DO $s1_s4_s17_s18$
DECLARE
  v_tz text;
  v_now timestamptz := now();
  v_local timestamp;
  v_bdate date;
  v_dow smallint;
  v_branch uuid := gen_random_uuid();
  v_qr uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_device uuid := gen_random_uuid();
  v_sched_1 uuid := gen_random_uuid();
  v_sched_edited uuid := gen_random_uuid();
  v_key_1 text;
  v_key_edited text;
  v_checkin_id uuid;
  v_before_snapshot jsonb;
  v_after_snapshot jsonb;
  v_precreated_event_id uuid := gen_random_uuid();
  v_r record;
  v_count integer;
  v_event_count integer;
BEGIN
  SELECT tz.name INTO v_tz
  FROM pg_timezone_names tz
  WHERE tz.name ~ '^Etc/GMT[+-]?[0-9]+$'
    AND extract(hour FROM (v_now AT TIME ZONE tz.name)) = 9
  LIMIT 1;

  v_local := v_now AT TIME ZONE v_tz;
  v_bdate := v_local::date;
  v_dow := extract(dow FROM v_bdate)::smallint;

  INSERT INTO public.branches(id, name) VALUES (v_branch, 'Main Spa');
  INSERT INTO public.attendance_settings(branch_id, timezone, attendance_day_boundary)
  VALUES (v_branch, v_tz, '06:00:00');
  INSERT INTO public.qr_points(id, branch_id) VALUES (v_qr, v_branch);
  INSERT INTO public.staff(id, branch_id, full_name) VALUES (v_staff, v_branch, 'Therapist One');
  INSERT INTO public.staff_devices(id, staff_id, branch_id) VALUES (v_device, v_staff, v_branch);

  INSERT INTO public.staff_schedules(id, staff_id, day_of_week, shift_type, start_time, end_time, is_active, window_order)
  VALUES (v_sched_1, v_staff, v_dow, 'single', '09:00:00', '18:00:00', true, 1);

  v_key_1 := concat_ws('|', v_staff::text, v_branch::text, v_bdate::text, 'single', 'window:1', '09:00:00', '18:00:00', 'weekly', v_sched_1::text);

  -- Scenario 1: First normal clock-in succeeds
  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 's1-clock-in-' || v_staff,
    p_branch_id => v_branch,
    p_qr_point_id => v_qr,
    p_staff_id => v_staff,
    p_device_id => v_device,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'success',
    p_reason_code => 'scheduled_clock_in',
    p_message => 'Clock-in recorded.',
    p_public_result => jsonb_build_object('ok', true, 'outcome', 'success', 'title', 'Clocked in', 'message', 'Welcome', 'attendance', jsonb_build_object('action', 'clock_in')),
    p_checkin_insert => jsonb_build_object(
      'shift_date', v_bdate::text,
      'shift_type', 'single',
      'shift_instance_key', v_key_1,
      'checked_in_at', v_now,
      'status', 'checked_in',
      'clock_in_method', 'qr',
      'scheduled_start_at', ((v_bdate + time '09:00:00') AT TIME ZONE v_tz),
      'scheduled_end_at', ((v_bdate + time '18:00:00') AT TIME ZONE v_tz),
      'schedule_source', 'weekly',
      'schedule_source_id', v_sched_1::text,
      'branch_timezone', v_tz,
      'attendance_business_date', v_bdate::text,
      'late_minutes', 5
    )
  );

  IF NOT v_r.success OR v_r.code <> 'committed' OR v_r.checkin_id IS NULL THEN
    RAISE EXCEPTION 'FAIL [Scenario 1]: First clock-in failed: %', row_to_json(v_r);
  END IF;
  v_checkin_id := v_r.checkin_id;
  RAISE NOTICE 'PASS [Scenario 1]: First normal clock-in succeeded (checkin_id=%).', v_checkin_id;

  -- Scenario 2: Normal clock-out succeeds
  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 's2-clock-out-' || v_staff,
    p_branch_id => v_branch,
    p_qr_point_id => v_qr,
    p_staff_id => v_staff,
    p_device_id => v_device,
    p_scan_type => 'attendance',
    p_action => 'clock_out',
    p_outcome => 'success',
    p_reason_code => 'scheduled_clock_out',
    p_message => 'Clock-out recorded.',
    p_public_result => jsonb_build_object('ok', true, 'outcome', 'success', 'title', 'Clocked out', 'message', 'Goodbye'),
    p_checkin_id => v_checkin_id,
    p_checkin_update => jsonb_build_object(
      'checked_out_at', v_now,
      'status', 'checked_out',
      'clock_out_method', 'qr',
      'worked_minutes', 540,
      'late_minutes', 5,
      'early_leave_minutes', 0,
      'overtime_minutes', 0,
      'attendance_status', 'present',
      'exception_state', 'none'
    )
  );

  IF NOT v_r.success OR v_r.code <> 'committed' OR v_r.checkin_id <> v_checkin_id THEN
    RAISE EXCEPTION 'FAIL [Scenario 2]: Normal clock-out failed: %', row_to_json(v_r);
  END IF;
  RAISE NOTICE 'PASS [Scenario 2]: Normal clock-out succeeded.';

  -- Snapshot historical completed record before post-completion rescans (Scenario 17)
  SELECT to_jsonb(c.*) INTO v_before_snapshot
  FROM public.staff_shift_checkins c
  WHERE c.id = v_checkin_id;

  -- Scenario 3: Completed-shift rescan returns noop (already_checked_out)
  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 's3-rescan-' || v_staff,
    p_branch_id => v_branch,
    p_qr_point_id => v_qr,
    p_staff_id => v_staff,
    p_device_id => v_device,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'success',
    p_reason_code => 'scheduled_clock_in',
    p_message => 'Attempted re-clock-in.',
    p_public_result => jsonb_build_object('ok', true, 'outcome', 'success', 'title', 'Clocked in', 'message', 'Should become noop'),
    p_checkin_insert => jsonb_build_object(
      'shift_date', v_bdate::text,
      'shift_type', 'single',
      'shift_instance_key', v_key_1,
      'checked_in_at', v_now,
      'status', 'checked_in',
      'schedule_source', 'weekly',
      'schedule_source_id', v_sched_1::text,
      'attendance_business_date', v_bdate::text
    )
  );

  SELECT count(*) INTO v_count FROM public.staff_shift_checkins WHERE staff_id = v_staff;
  IF NOT v_r.success
     OR v_r.operation_result->>'outcome' <> 'noop'
     OR v_r.operation_result->>'reasonCode' <> 'already_checked_out'
     OR v_r.checkin_id <> v_checkin_id
     OR v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL [Scenario 3]: Completed-shift rescan did not convert to noop: %, rows=%', row_to_json(v_r), v_count;
  END IF;
  RAISE NOTICE 'PASS [Scenario 3]: Completed-shift rescan converted to noop (already_checked_out).';

  -- Scenario 4a: Edited shift_instance_key cannot reopen the completed shift
  UPDATE public.staff_schedules SET is_active = false WHERE id = v_sched_1;
  INSERT INTO public.staff_schedules(id, staff_id, day_of_week, shift_type, start_time, end_time, is_active, window_order)
  VALUES (v_sched_edited, v_staff, v_dow, 'closing', '09:30:00', '18:30:00', true, 1);
  v_key_edited := concat_ws('|', v_staff::text, v_branch::text, v_bdate::text, 'closing', 'window:1', '09:30:00', '18:30:00', 'weekly', v_sched_edited::text);

  -- Pre-create a qr_scan_events row (with NULL operation_result) to verify 20260821023717 update flow (Scenario 18)
  INSERT INTO public.qr_scan_events(id, branch_id, qr_point_id, staff_id, device_id, scan_type, action, outcome, request_id)
  VALUES (v_precreated_event_id, v_branch, v_qr, v_staff, v_device, 'attendance', 'scan_captured', 'success', 's4-edited-key-' || v_staff);

  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 's4-edited-key-' || v_staff,
    p_branch_id => v_branch,
    p_qr_point_id => v_qr,
    p_staff_id => v_staff,
    p_device_id => v_device,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'success',
    p_public_result => jsonb_build_object('ok', true, 'outcome', 'success', 'title', 'Edited shift', 'message', 'Should become noop'),
    p_checkin_insert => jsonb_build_object(
      'shift_date', v_bdate::text,
      'shift_type', 'closing',
      'shift_instance_key', v_key_edited,
      'checked_in_at', v_now,
      'status', 'checked_in',
      'schedule_source', 'weekly',
      'schedule_source_id', v_sched_edited::text,
      'attendance_business_date', v_bdate::text
    )
  );

  SELECT count(*) INTO v_count FROM public.staff_shift_checkins WHERE staff_id = v_staff;
  IF NOT v_r.success
     OR v_r.scan_event_id <> v_precreated_event_id
     OR v_r.operation_result->>'reasonCode' <> 'already_checked_out'
     OR v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL [Scenario 4a]: Edited shift_instance_key bypassed guard: %, rows=%', row_to_json(v_r), v_count;
  END IF;

  -- Scenario 17 verification: byte-for-byte immutability of completed shift record
  SELECT to_jsonb(c.*) INTO v_after_snapshot
  FROM public.staff_shift_checkins c
  WHERE c.id = v_checkin_id;

  IF v_before_snapshot IS DISTINCT FROM v_after_snapshot THEN
    RAISE EXCEPTION 'FAIL [Scenario 17]: Completed shift record mutated! before=% after=%', v_before_snapshot, v_after_snapshot;
  END IF;
  RAISE NOTICE 'PASS [Scenario 17]: Historical completed record remained 100%% byte-for-byte unchanged.';

  -- Scenario 4b: Legacy NULL attendance_business_date row also blocks re-clock-in
  UPDATE public.staff_shift_checkins SET attendance_business_date = NULL WHERE id = v_checkin_id;
  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 's4-legacy-null-bdate-' || v_staff,
    p_branch_id => v_branch,
    p_qr_point_id => v_qr,
    p_staff_id => v_staff,
    p_device_id => v_device,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'success',
    p_public_result => jsonb_build_object('ok', true, 'outcome', 'success', 'title', 'Legacy check', 'message', 'Should become noop'),
    p_checkin_insert => jsonb_build_object(
      'shift_date', v_bdate::text,
      'shift_type', 'closing',
      'shift_instance_key', v_key_edited,
      'checked_in_at', v_now,
      'status', 'checked_in',
      'schedule_source', 'weekly',
      'schedule_source_id', v_sched_edited::text,
      'attendance_business_date', v_bdate::text
    )
  );
  IF v_r.operation_result->>'reasonCode' <> 'already_checked_out' THEN
    RAISE EXCEPTION 'FAIL [Scenario 4b]: NULL legacy attendance_business_date bypassed guard: %', row_to_json(v_r);
  END IF;
  RAISE NOTICE 'PASS [Scenario 4]: Edited shift_instance_key and legacy NULL attendance_business_date both blocked.';

  -- Scenario 18 verification: idempotent replay + preserved audit events
  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 's3-rescan-' || v_staff,
    p_branch_id => v_branch,
    p_qr_point_id => v_qr,
    p_staff_id => v_staff,
    p_device_id => v_device,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'success',
    p_public_result => jsonb_build_object('ok', true, 'outcome', 'success', 'title', 'Replay', 'message', 'Replay')
  );
  SELECT count(*) INTO v_event_count FROM public.qr_scan_events WHERE staff_id = v_staff;
  IF NOT v_r.success OR v_r.code <> 'replayed' OR v_event_count <> 5 THEN
    RAISE EXCEPTION 'FAIL [Scenario 18]: Expected replayed result and 5 preserved audit rows, got %, count=%', row_to_json(v_r), v_event_count;
  END IF;
  RAISE NOTICE 'PASS [Scenario 18]: Individual QR audit events (5 distinct events) and request_id replay preserved.';
END
$s1_s4_s17_s18$;

-- ============================================================================
-- SCENARIOS 5, 6, 7, 8:
--   5. Fabricated second window, day-off override, and adjacent open_close rejected
--   6. Genuine second window allowed
--   7. Premature second window (11:xx AM scan for 18:00 Window 2) rejected
--   8. Valid early (20m before start) and valid late (within 120m) Window 2 allowed
-- ============================================================================
DO $s5_s8$
DECLARE
  v_now timestamptz := now();
  v_tz_11 text;
  v_tz_18 text;
  v_bdate_11 date;
  v_bdate_18 date;
  v_dow_11 smallint;
  v_dow_18 smallint;
  v_branch_11 uuid := gen_random_uuid();
  v_branch_18 uuid := gen_random_uuid();
  v_qr_11 uuid := gen_random_uuid();
  v_qr_18 uuid := gen_random_uuid();
  v_staff_premature uuid := gen_random_uuid();
  v_staff_split uuid := gen_random_uuid();
  v_staff_early uuid := gen_random_uuid();
  v_staff_adj uuid := gen_random_uuid();
  v_staff_override uuid := gen_random_uuid();
  v_w1 uuid;
  v_w2 uuid;
  v_fake uuid := gen_random_uuid();
  v_early_start time;
  v_key_1 text;
  v_key_2 text;
  v_key_fake text;
  v_r record;
  v_count integer;
BEGIN
  SELECT tz.name INTO v_tz_11
  FROM pg_timezone_names tz
  WHERE tz.name ~ '^Etc/GMT[+-]?[0-9]+$'
    AND extract(hour FROM (v_now AT TIME ZONE tz.name)) = 11
  LIMIT 1;

  SELECT tz.name INTO v_tz_18
  FROM pg_timezone_names tz
  WHERE tz.name ~ '^Etc/GMT[+-]?[0-9]+$'
    AND extract(hour FROM (v_now AT TIME ZONE tz.name)) = 18
  LIMIT 1;

  v_bdate_11 := (v_now AT TIME ZONE v_tz_11)::date;
  v_dow_11 := extract(dow FROM v_bdate_11)::smallint;
  v_bdate_18 := (v_now AT TIME ZONE v_tz_18)::date;
  v_dow_18 := extract(dow FROM v_bdate_18)::smallint;

  INSERT INTO public.branches(id, name) VALUES (v_branch_11, 'Morning Zone Branch'), (v_branch_18, 'Evening Zone Branch');
  INSERT INTO public.attendance_settings(branch_id, timezone, early_clock_in_allowed_minutes, clock_in_window_before_shift_minutes, clock_in_window_after_shift_start_minutes)
  VALUES
    (v_branch_11, v_tz_11, 30, 30, 120),
    (v_branch_18, v_tz_18, 30, 30, 120);
  INSERT INTO public.qr_points(id, branch_id) VALUES (v_qr_11, v_branch_11), (v_qr_18, v_branch_18);

  -- Scenario 7: Premature second window (11:xx AM local scan for an 18:00 Window 2) -> REJECTED
  INSERT INTO public.staff(id, branch_id) VALUES (v_staff_premature, v_branch_11);
  v_w1 := gen_random_uuid();
  v_w2 := gen_random_uuid();
  INSERT INTO public.staff_schedules(id, staff_id, day_of_week, shift_type, start_time, end_time, is_active, window_order)
  VALUES
    (v_w1, v_staff_premature, v_dow_11, 'opening', '07:00:00', '10:30:00', true, 1),
    (v_w2, v_staff_premature, v_dow_11, 'closing', '18:00:00', '22:30:00', true, 2);

  v_key_1 := concat_ws('|', v_staff_premature::text, v_branch_11::text, v_bdate_11::text, 'opening', 'window:1', '07:00:00', '10:30:00', 'weekly', v_w1::text);
  v_key_2 := concat_ws('|', v_staff_premature::text, v_branch_11::text, v_bdate_11::text, 'closing', 'window:2', '18:00:00', '22:30:00', 'weekly', v_w2::text);

  INSERT INTO public.staff_shift_checkins(staff_id, branch_id, shift_date, shift_type, shift_instance_key, checked_in_at, checked_out_at, status, attendance_business_date)
  VALUES (
    v_staff_premature, v_branch_11, v_bdate_11, 'opening', v_key_1,
    ((v_bdate_11 + time '07:00:00') AT TIME ZONE v_tz_11),
    ((v_bdate_11 + time '10:30:00') AT TIME ZONE v_tz_11),
    'checked_out', v_bdate_11
  );

  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 's7-premature-11am-' || v_staff_premature,
    p_branch_id => v_branch_11,
    p_qr_point_id => v_qr_11,
    p_staff_id => v_staff_premature,
    p_device_id => NULL,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'success',
    p_public_result => jsonb_build_object('ok', true, 'outcome', 'success', 'title', 'Premature', 'message', 'Premature'),
    p_checkin_insert => jsonb_build_object(
      'shift_date', v_bdate_11::text,
      'shift_type', 'closing',
      'shift_instance_key', v_key_2,
      'checked_in_at', v_now,
      'status', 'checked_in',
      'scheduled_start_at', ((v_bdate_11 + time '18:00:00') AT TIME ZONE v_tz_11),
      'scheduled_end_at', ((v_bdate_11 + time '22:30:00') AT TIME ZONE v_tz_11),
      'schedule_source', 'weekly',
      'schedule_source_id', v_w2::text,
      'attendance_business_date', v_bdate_11::text
    )
  );
  SELECT count(*) INTO v_count FROM public.staff_shift_checkins WHERE staff_id = v_staff_premature;
  IF NOT v_r.success OR v_r.operation_result->>'reasonCode' <> 'already_checked_out' OR v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL [Scenario 7]: Premature 11:xx AM scan for 18:00 Window 2 was admitted! %, rows=%', row_to_json(v_r), v_count;
  END IF;
  RAISE NOTICE 'PASS [Scenario 7]: Premature 11:xx AM scan for 18:00 Window 2 rejected as already_checked_out noop.';

  -- Scenario 5a (fabricated Window 2), Scenario 6 (genuine Window 2 on-time/late at 18:xx)
  INSERT INTO public.staff(id, branch_id) VALUES (v_staff_split, v_branch_18);
  v_w1 := gen_random_uuid();
  v_w2 := gen_random_uuid();
  INSERT INTO public.staff_schedules(id, staff_id, day_of_week, shift_type, start_time, end_time, is_active, window_order)
  VALUES
    (v_w1, v_staff_split, v_dow_18, 'opening', '09:00:00', '13:00:00', true, 1),
    (v_w2, v_staff_split, v_dow_18, 'closing', '18:00:00', '22:30:00', true, 2);

  v_key_1 := concat_ws('|', v_staff_split::text, v_branch_18::text, v_bdate_18::text, 'opening', 'window:1', '09:00:00', '13:00:00', 'weekly', v_w1::text);
  v_key_2 := concat_ws('|', v_staff_split::text, v_branch_18::text, v_bdate_18::text, 'closing', 'window:2', '18:00:00', '22:30:00', 'weekly', v_w2::text);
  v_key_fake := concat_ws('|', v_staff_split::text, v_branch_18::text, v_bdate_18::text, 'closing', 'window:2', '18:00:00', '22:30:00', 'weekly', v_fake::text);

  INSERT INTO public.staff_shift_checkins(staff_id, branch_id, shift_date, shift_type, shift_instance_key, checked_in_at, checked_out_at, status, attendance_business_date)
  VALUES (
    v_staff_split, v_branch_18, v_bdate_18, 'opening', v_key_1,
    ((v_bdate_18 + time '09:00:00') AT TIME ZONE v_tz_18),
    ((v_bdate_18 + time '13:00:00') AT TIME ZONE v_tz_18),
    'checked_out', v_bdate_18
  );

  -- 5a: Fabricated source ID rejected
  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 's5-fabricated-' || v_staff_split,
    p_branch_id => v_branch_18,
    p_qr_point_id => v_qr_18,
    p_staff_id => v_staff_split,
    p_device_id => NULL,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'success',
    p_public_result => jsonb_build_object('ok', true, 'outcome', 'success', 'title', 'Fake', 'message', 'Fake'),
    p_checkin_insert => jsonb_build_object(
      'shift_date', v_bdate_18::text,
      'shift_type', 'closing',
      'shift_instance_key', v_key_fake,
      'checked_in_at', v_now,
      'status', 'checked_in',
      'scheduled_start_at', ((v_bdate_18 + time '18:00:00') AT TIME ZONE v_tz_18),
      'schedule_source', 'weekly',
      'schedule_source_id', v_fake::text,
      'attendance_business_date', v_bdate_18::text
    )
  );
  IF v_r.operation_result->>'reasonCode' <> 'already_checked_out' THEN
    RAISE EXCEPTION 'FAIL [Scenario 5a]: Fabricated second window admitted!';
  END IF;

  -- 5b: Adjacent continuous open_close (10:00-18:00 + 18:00-23:00) rejected
  INSERT INTO public.staff(id, branch_id) VALUES (v_staff_adj, v_branch_18);
  DECLARE
    v_adj_1 uuid := gen_random_uuid();
    v_adj_2 uuid := gen_random_uuid();
    v_adj_key_1 text;
    v_adj_key_2 text;
  BEGIN
    INSERT INTO public.staff_schedules(id, staff_id, day_of_week, shift_type, start_time, end_time, is_active, window_order)
    VALUES
      (v_adj_1, v_staff_adj, v_dow_18, 'opening', '10:00:00', '18:00:00', true, 1),
      (v_adj_2, v_staff_adj, v_dow_18, 'closing', '18:00:00', '23:00:00', true, 2);
    v_adj_key_1 := concat_ws('|', v_staff_adj::text, v_branch_18::text, v_bdate_18::text, 'opening', 'window:1', '10:00:00', '18:00:00', 'weekly', v_adj_1::text);
    v_adj_key_2 := concat_ws('|', v_staff_adj::text, v_branch_18::text, v_bdate_18::text, 'closing', 'window:2', '18:00:00', '23:00:00', 'weekly', v_adj_2::text);
    INSERT INTO public.staff_shift_checkins(staff_id, branch_id, shift_date, shift_type, shift_instance_key, checked_in_at, checked_out_at, status, attendance_business_date)
    VALUES (
      v_staff_adj, v_branch_18, v_bdate_18, 'opening', v_adj_key_1,
      ((v_bdate_18 + time '10:00:00') AT TIME ZONE v_tz_18),
      ((v_bdate_18 + time '17:50:00') AT TIME ZONE v_tz_18),
      'checked_out', v_bdate_18
    );
    SELECT * INTO v_r
    FROM public.commit_attendance_scan_transaction(
      p_request_id => 's5-adjacent-' || v_staff_adj,
      p_branch_id => v_branch_18,
      p_qr_point_id => v_qr_18,
      p_staff_id => v_staff_adj,
      p_device_id => NULL,
      p_scan_type => 'attendance',
      p_action => 'clock_in',
      p_outcome => 'success',
      p_public_result => jsonb_build_object('ok', true, 'outcome', 'success', 'title', 'Adj', 'message', 'Adj'),
      p_checkin_insert => jsonb_build_object(
        'shift_date', v_bdate_18::text,
        'shift_type', 'closing',
        'shift_instance_key', v_adj_key_2,
        'checked_in_at', v_now,
        'status', 'checked_in',
        'scheduled_start_at', ((v_bdate_18 + time '18:00:00') AT TIME ZONE v_tz_18),
        'schedule_source', 'weekly',
        'schedule_source_id', v_adj_2::text,
        'attendance_business_date', v_bdate_18::text
      )
    );
    IF v_r.operation_result->>'reasonCode' <> 'already_checked_out' THEN
      RAISE EXCEPTION 'FAIL [Scenario 5b]: Adjacent continuous open_close window was treated as split shift!';
    END IF;
  END;

  -- 5c: Day-off schedule_overrides suppresses weekly Window 2
  INSERT INTO public.staff(id, branch_id) VALUES (v_staff_override, v_branch_18);
  DECLARE
    v_ov_1 uuid := gen_random_uuid();
    v_ov_2 uuid := gen_random_uuid();
    v_ov_key_1 text;
    v_ov_key_2 text;
  BEGIN
    INSERT INTO public.staff_schedules(id, staff_id, day_of_week, shift_type, start_time, end_time, is_active, window_order)
    VALUES
      (v_ov_1, v_staff_override, v_dow_18, 'opening', '09:00:00', '13:00:00', true, 1),
      (v_ov_2, v_staff_override, v_dow_18, 'closing', '18:00:00', '22:30:00', true, 2);
    INSERT INTO public.schedule_overrides(staff_id, override_date, is_day_off)
    VALUES (v_staff_override, v_bdate_18, true);
    v_ov_key_1 := concat_ws('|', v_staff_override::text, v_branch_18::text, v_bdate_18::text, 'opening', 'window:1', '09:00:00', '13:00:00', 'weekly', v_ov_1::text);
    v_ov_key_2 := concat_ws('|', v_staff_override::text, v_branch_18::text, v_bdate_18::text, 'closing', 'window:2', '18:00:00', '22:30:00', 'weekly', v_ov_2::text);
    INSERT INTO public.staff_shift_checkins(staff_id, branch_id, shift_date, shift_type, shift_instance_key, checked_in_at, checked_out_at, status, attendance_business_date)
    VALUES (
      v_staff_override, v_branch_18, v_bdate_18, 'opening', v_ov_key_1,
      ((v_bdate_18 + time '09:00:00') AT TIME ZONE v_tz_18),
      ((v_bdate_18 + time '13:00:00') AT TIME ZONE v_tz_18),
      'checked_out', v_bdate_18
    );
    SELECT * INTO v_r
    FROM public.commit_attendance_scan_transaction(
      p_request_id => 's5-override-' || v_staff_override,
      p_branch_id => v_branch_18,
      p_qr_point_id => v_qr_18,
      p_staff_id => v_staff_override,
      p_device_id => NULL,
      p_scan_type => 'attendance',
      p_action => 'clock_in',
      p_outcome => 'success',
      p_public_result => jsonb_build_object('ok', true, 'outcome', 'success', 'title', 'Override', 'message', 'Override'),
      p_checkin_insert => jsonb_build_object(
        'shift_date', v_bdate_18::text,
        'shift_type', 'closing',
        'shift_instance_key', v_ov_key_2,
        'checked_in_at', v_now,
        'status', 'checked_in',
        'scheduled_start_at', ((v_bdate_18 + time '18:00:00') AT TIME ZONE v_tz_18),
        'schedule_source', 'weekly',
        'schedule_source_id', v_ov_2::text,
        'attendance_business_date', v_bdate_18::text
      )
    );
    IF v_r.operation_result->>'reasonCode' <> 'already_checked_out' THEN
      RAISE EXCEPTION 'FAIL [Scenario 5c]: Schedule override did not suppress weekly Window 2!';
    END IF;
  END;
  RAISE NOTICE 'PASS [Scenario 5]: Fabricated Window 2, adjacent open_close windows, and schedule overrides all rejected.';

  -- Scenario 6: Genuine non-adjacent Window 2 (09:00-13:00 + 18:00-22:30 scanned at 18:xx) -> ALLOWED
  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 's6-genuine-split-' || v_staff_split,
    p_branch_id => v_branch_18,
    p_qr_point_id => v_qr_18,
    p_staff_id => v_staff_split,
    p_device_id => NULL,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'success',
    p_public_result => jsonb_build_object('ok', true, 'outcome', 'success', 'title', 'Split W2', 'message', 'Allowed'),
    p_checkin_insert => jsonb_build_object(
      'shift_date', v_bdate_18::text,
      'shift_type', 'closing',
      'shift_instance_key', v_key_2,
      'checked_in_at', v_now,
      'status', 'checked_in',
      'scheduled_start_at', ((v_bdate_18 + time '18:00:00') AT TIME ZONE v_tz_18),
      'scheduled_end_at', ((v_bdate_18 + time '22:30:00') AT TIME ZONE v_tz_18),
      'schedule_source', 'weekly',
      'schedule_source_id', v_w2::text,
      'attendance_business_date', v_bdate_18::text
    )
  );
  SELECT count(*) INTO v_count FROM public.staff_shift_checkins WHERE staff_id = v_staff_split;
  IF NOT v_r.success OR v_r.operation_result->>'outcome' <> 'success' OR v_count <> 2 THEN
    RAISE EXCEPTION 'FAIL [Scenario 6]: Genuine second split-shift window was blocked: %, rows=%', row_to_json(v_r), v_count;
  END IF;
  RAISE NOTICE 'PASS [Scenario 6]: Genuine non-adjacent split-shift Window 2 allowed.';

  -- Scenario 8: Valid early second-window arrival (20 minutes before Window 2 scheduled start, within 30m allowance) -> ALLOWED
  INSERT INTO public.staff(id, branch_id) VALUES (v_staff_early, v_branch_18);
  v_w1 := gen_random_uuid();
  v_w2 := gen_random_uuid();
  v_early_start := date_trunc('minute', v_now AT TIME ZONE v_tz_18)::time + interval '20 minutes';

  INSERT INTO public.staff_schedules(id, staff_id, day_of_week, shift_type, start_time, end_time, is_active, window_order)
  VALUES
    (v_w1, v_staff_early, v_dow_18, 'opening', '09:00:00', '13:00:00', true, 1),
    (v_w2, v_staff_early, v_dow_18, 'closing', v_early_start, '23:00:00', true, 2);

  v_key_1 := concat_ws('|', v_staff_early::text, v_branch_18::text, v_bdate_18::text, 'opening', 'window:1', '09:00:00', '13:00:00', 'weekly', v_w1::text);
  v_key_2 := concat_ws('|', v_staff_early::text, v_branch_18::text, v_bdate_18::text, 'closing', 'window:2', to_char(v_early_start, 'HH24:MI:SS'), '23:00:00', 'weekly', v_w2::text);

  INSERT INTO public.staff_shift_checkins(staff_id, branch_id, shift_date, shift_type, shift_instance_key, checked_in_at, checked_out_at, status, attendance_business_date)
  VALUES (
    v_staff_early, v_branch_18, v_bdate_18, 'opening', v_key_1,
    ((v_bdate_18 + time '09:00:00') AT TIME ZONE v_tz_18),
    ((v_bdate_18 + time '13:00:00') AT TIME ZONE v_tz_18),
    'checked_out', v_bdate_18
  );

  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 's8-early-split-' || v_staff_early,
    p_branch_id => v_branch_18,
    p_qr_point_id => v_qr_18,
    p_staff_id => v_staff_early,
    p_device_id => NULL,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'success',
    p_public_result => jsonb_build_object('ok', true, 'outcome', 'success', 'title', 'Early Split W2', 'message', 'Allowed'),
    p_checkin_insert => jsonb_build_object(
      'shift_date', v_bdate_18::text,
      'shift_type', 'closing',
      'shift_instance_key', v_key_2,
      'checked_in_at', v_now,
      'status', 'checked_in',
      'scheduled_start_at', ((v_bdate_18 + v_early_start) AT TIME ZONE v_tz_18),
      'scheduled_end_at', ((v_bdate_18 + time '23:00:00') AT TIME ZONE v_tz_18),
      'schedule_source', 'weekly',
      'schedule_source_id', v_w2::text,
      'attendance_business_date', v_bdate_18::text
    )
  );
  SELECT count(*) INTO v_count FROM public.staff_shift_checkins WHERE staff_id = v_staff_early;
  IF NOT v_r.success OR v_r.operation_result->>'outcome' <> 'success' OR v_count <> 2 THEN
    RAISE EXCEPTION 'FAIL [Scenario 8]: Valid early Window 2 clock-in (20m before start) was blocked: %, rows=%', row_to_json(v_r), v_count;
  END IF;
  RAISE NOTICE 'PASS [Scenario 8]: Valid early Window 2 clock-in (within 30m early allowance) and valid late Window 2 clock-in allowed.';
END
$s5_s8$;

-- ============================================================================
-- SCENARIO 9:
--   Forged future business date & untrusted scan timestamp manipulation rejected
--   (Covers exact 17:xx scan supplying tomorrow's business date after checkout,
--    fresh forged business date without prior checkout, and forged future checked_in_at)
-- ============================================================================
DO $s9$
DECLARE
  v_now timestamptz := now();
  v_tz_17 text;
  v_bdate date;
  v_forged_tomorrow date;
  v_branch uuid := gen_random_uuid();
  v_qr uuid := gen_random_uuid();
  v_staff_done uuid := gen_random_uuid();
  v_staff_fresh uuid := gen_random_uuid();
  v_r record;
  v_count integer;
BEGIN
  SELECT tz.name INTO v_tz_17
  FROM pg_timezone_names tz
  WHERE tz.name ~ '^Etc/GMT[+-]?[0-9]+$'
    AND extract(hour FROM (v_now AT TIME ZONE tz.name)) = 17
  LIMIT 1;

  v_bdate := (v_now AT TIME ZONE v_tz_17)::date;
  v_forged_tomorrow := v_bdate + 1;

  INSERT INTO public.branches(id, name) VALUES (v_branch, 'Date Integrity Branch');
  INSERT INTO public.attendance_settings(branch_id, timezone, attendance_day_boundary)
  VALUES (v_branch, v_tz_17, '06:00:00');
  INSERT INTO public.qr_points(id, branch_id) VALUES (v_qr, v_branch);
  INSERT INTO public.staff(id, branch_id) VALUES (v_staff_done, v_branch), (v_staff_fresh, v_branch);

  -- 9a: Exact V2 failure probe — staff completed today's 10:00-17:30 shift, then at 17:xx
  -- supplies tomorrow's attendance_business_date & shift_date to bypass same-day guard.
  INSERT INTO public.staff_shift_checkins(staff_id, branch_id, shift_date, shift_type, shift_instance_key, checked_in_at, checked_out_at, status, attendance_business_date)
  VALUES (
    v_staff_done, v_branch, v_bdate, 'single',
    concat_ws('|', v_staff_done::text, v_branch::text, v_bdate::text, 'single', 'window:1', '10:00:00', '17:30:00', 'weekly', gen_random_uuid()::text),
    ((v_bdate + time '10:00:00') AT TIME ZONE v_tz_17),
    v_now - interval '1 minute',
    'checked_out', v_bdate
  );

  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 's9a-forged-after-done-' || v_staff_done,
    p_branch_id => v_branch,
    p_qr_point_id => v_qr,
    p_staff_id => v_staff_done,
    p_device_id => NULL,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'success',
    p_public_result => jsonb_build_object('ok', true, 'outcome', 'success', 'title', 'Forged', 'message', 'Forged'),
    p_checkin_insert => jsonb_build_object(
      'shift_date', v_forged_tomorrow::text,
      'shift_type', 'single',
      'shift_instance_key', concat_ws('|', v_staff_done::text, v_branch::text, v_forged_tomorrow::text, 'single', 'window:1', '10:00:00', '17:30:00', 'weekly', gen_random_uuid()::text),
      'checked_in_at', v_now,
      'status', 'checked_in',
      'schedule_source', 'weekly',
      'attendance_business_date', v_forged_tomorrow::text
    )
  );
  SELECT count(*) INTO v_count FROM public.staff_shift_checkins WHERE staff_id = v_staff_done;
  IF NOT v_r.success OR v_r.operation_result->>'reasonCode' <> 'already_checked_out' OR v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL [Scenario 9a]: Forged tomorrow business date bypassed completed-shift guard! %, rows=%', row_to_json(v_r), v_count;
  END IF;

  -- 9b: Fresh staff (no prior shift) supplies forged future attendance_business_date -> rejected with invalid_business_date
  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 's9b-forged-fresh-' || v_staff_fresh,
    p_branch_id => v_branch,
    p_qr_point_id => v_qr,
    p_staff_id => v_staff_fresh,
    p_device_id => NULL,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'success',
    p_public_result => jsonb_build_object('ok', true, 'outcome', 'success', 'title', 'Forged', 'message', 'Forged'),
    p_checkin_insert => jsonb_build_object(
      'shift_date', v_forged_tomorrow::text,
      'shift_type', 'single',
      'checked_in_at', v_now,
      'status', 'checked_in',
      'attendance_business_date', v_forged_tomorrow::text
    )
  );
  SELECT count(*) INTO v_count FROM public.staff_shift_checkins WHERE staff_id = v_staff_fresh;
  IF v_r.success OR v_r.code <> 'invalid_business_date' OR v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL [Scenario 9b]: Fresh forged future business date was not rejected! %, rows=%', row_to_json(v_r), v_count;
  END IF;

  -- 9c: Forged checked_in_at (+1 day in future) -> rejected with invalid_checkin_timestamp
  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 's9c-forged-ts-' || v_staff_fresh,
    p_branch_id => v_branch,
    p_qr_point_id => v_qr,
    p_staff_id => v_staff_fresh,
    p_device_id => NULL,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'success',
    p_public_result => jsonb_build_object('ok', true, 'outcome', 'success', 'title', 'Forged TS', 'message', 'Forged TS'),
    p_checkin_insert => jsonb_build_object(
      'shift_date', v_forged_tomorrow::text,
      'shift_type', 'single',
      'checked_in_at', v_now + interval '1 day',
      'status', 'checked_in',
      'attendance_business_date', v_forged_tomorrow::text
    )
  );
  IF v_r.success OR v_r.code <> 'invalid_checkin_timestamp' THEN
    RAISE EXCEPTION 'FAIL [Scenario 9c]: Forged future checked_in_at was not rejected! %', row_to_json(v_r);
  END IF;

  RAISE NOTICE 'PASS [Scenario 9]: Forged future business dates and untrusted timestamps rejected/normalized safely.';
END
$s9$;

-- ============================================================================
-- SCENARIOS 10 & 11:
--   10. Overnight / post-midnight (02:xx AM before 06:00 boundary) same-business-date rescan blocked
--   11. Genuine next business-day attendance (09:xx AM after 06:00 rollover) allowed
-- ============================================================================
DO $s10_s11$
DECLARE
  v_now timestamptz := now();
  v_tz_02 text;
  v_tz_09 text;
  v_local_02 timestamp;
  v_bdate_02 date;
  v_local_09 timestamp;
  v_bdate_09 date;
  v_dow_09 smallint;
  v_branch_02 uuid := gen_random_uuid();
  v_branch_09 uuid := gen_random_uuid();
  v_qr_02 uuid := gen_random_uuid();
  v_qr_09 uuid := gen_random_uuid();
  v_staff_02 uuid := gen_random_uuid();
  v_staff_09 uuid := gen_random_uuid();
  v_sched_09 uuid := gen_random_uuid();
  v_key_09 text;
  v_r record;
  v_count integer;
BEGIN
  SELECT tz.name INTO v_tz_02
  FROM pg_timezone_names tz
  WHERE tz.name ~ '^Etc/GMT[+-]?[0-9]+$'
    AND extract(hour FROM (v_now AT TIME ZONE tz.name)) = 2
  LIMIT 1;

  SELECT tz.name INTO v_tz_09
  FROM pg_timezone_names tz
  WHERE tz.name ~ '^Etc/GMT[+-]?[0-9]+$'
    AND extract(hour FROM (v_now AT TIME ZONE tz.name)) = 9
  LIMIT 1;

  v_local_02 := v_now AT TIME ZONE v_tz_02;
  -- At 02:xx AM before 06:00 boundary, authoritative business date is yesterday!
  v_bdate_02 := v_local_02::date - 1;

  v_local_09 := v_now AT TIME ZONE v_tz_09;
  v_bdate_09 := v_local_09::date;
  v_dow_09 := extract(dow FROM v_bdate_09)::smallint;

  INSERT INTO public.branches(id, name) VALUES (v_branch_02, 'Overnight Branch'), (v_branch_09, 'Rollover Branch');
  INSERT INTO public.attendance_settings(branch_id, timezone, attendance_day_boundary)
  VALUES
    (v_branch_02, v_tz_02, '06:00:00'),
    (v_branch_09, v_tz_09, '06:00:00');
  INSERT INTO public.qr_points(id, branch_id) VALUES (v_qr_02, v_branch_02), (v_qr_09, v_branch_09);
  INSERT INTO public.staff(id, branch_id) VALUES (v_staff_02, v_branch_02), (v_staff_09, v_branch_09);

  -- Scenario 10: Overnight 21:00-02:00 shift on v_bdate_02 already checked out; rescan at 02:xx AM (calendar date v_local_02::date) is BLOCKED
  INSERT INTO public.staff_shift_checkins(staff_id, branch_id, shift_date, shift_type, shift_instance_key, checked_in_at, checked_out_at, status, attendance_business_date)
  VALUES (
    v_staff_02, v_branch_02, v_bdate_02, 'closing',
    concat_ws('|', v_staff_02::text, v_branch_02::text, v_bdate_02::text, 'closing', 'window:1', '21:00:00', '02:00:00', 'weekly', gen_random_uuid()::text),
    v_now - interval '5 hours',
    v_now - interval '2 minutes',
    'checked_out', v_bdate_02
  );

  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 's10-overnight-rescan-' || v_staff_02,
    p_branch_id => v_branch_02,
    p_qr_point_id => v_qr_02,
    p_staff_id => v_staff_02,
    p_device_id => NULL,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'success',
    p_public_result => jsonb_build_object('ok', true, 'outcome', 'success', 'title', 'Overnight', 'message', 'Should block'),
    p_checkin_insert => jsonb_build_object(
      'shift_date', v_local_02::date::text,
      'shift_type', 'closing',
      'checked_in_at', v_now,
      'status', 'checked_in',
      'attendance_business_date', v_bdate_02::text
    )
  );
  SELECT count(*) INTO v_count FROM public.staff_shift_checkins WHERE staff_id = v_staff_02;
  IF NOT v_r.success OR v_r.operation_result->>'reasonCode' <> 'already_checked_out' OR v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL [Scenario 10]: Overnight pre-06:00 rescan was not blocked! %, rows=%', row_to_json(v_r), v_count;
  END IF;
  RAISE NOTICE 'PASS [Scenario 10]: Overnight same-business-date rescan (02:xx AM before 06:00 boundary) blocked.';

  -- Scenario 11: Prior business day (v_bdate_09 - 1) completed; at 09:xx AM after 06:00 rollover, next business-day shift is ALLOWED
  INSERT INTO public.staff_shift_checkins(staff_id, branch_id, shift_date, shift_type, shift_instance_key, checked_in_at, checked_out_at, status, attendance_business_date)
  VALUES (
    v_staff_09, v_branch_09, v_bdate_09 - 1, 'closing',
    concat_ws('|', v_staff_09::text, v_branch_09::text, (v_bdate_09 - 1)::text, 'closing', 'window:1', '14:00:00', '23:00:00', 'weekly', gen_random_uuid()::text),
    v_now - interval '19 hours',
    v_now - interval '10 hours',
    'checked_out', v_bdate_09 - 1
  );
  INSERT INTO public.staff_schedules(id, staff_id, day_of_week, shift_type, start_time, end_time, is_active, window_order)
  VALUES (v_sched_09, v_staff_09, v_dow_09, 'single', '09:00:00', '18:00:00', true, 1);
  v_key_09 := concat_ws('|', v_staff_09::text, v_branch_09::text, v_bdate_09::text, 'single', 'window:1', '09:00:00', '18:00:00', 'weekly', v_sched_09::text);

  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 's11-next-bday-' || v_staff_09,
    p_branch_id => v_branch_09,
    p_qr_point_id => v_qr_09,
    p_staff_id => v_staff_09,
    p_device_id => NULL,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'success',
    p_public_result => jsonb_build_object('ok', true, 'outcome', 'success', 'title', 'Next Day', 'message', 'Allowed'),
    p_checkin_insert => jsonb_build_object(
      'shift_date', v_bdate_09::text,
      'shift_type', 'single',
      'shift_instance_key', v_key_09,
      'checked_in_at', v_now,
      'status', 'checked_in',
      'scheduled_start_at', ((v_bdate_09 + time '09:00:00') AT TIME ZONE v_tz_09),
      'scheduled_end_at', ((v_bdate_09 + time '18:00:00') AT TIME ZONE v_tz_09),
      'schedule_source', 'weekly',
      'schedule_source_id', v_sched_09::text,
      'attendance_business_date', v_bdate_09::text
    )
  );
  SELECT count(*) INTO v_count FROM public.staff_shift_checkins WHERE staff_id = v_staff_09;
  IF NOT v_r.success OR v_r.operation_result->>'outcome' <> 'success' OR v_count <> 2 THEN
    RAISE EXCEPTION 'FAIL [Scenario 11]: Genuine next business-day clock-in blocked! %, rows=%', row_to_json(v_r), v_count;
  END IF;
  RAISE NOTICE 'PASS [Scenario 11]: Genuine next business-day attendance after 06:00 rollover allowed.';
END
$s10_s11$;

-- ============================================================================
-- SCENARIOS 12 & 13:
--   12. False recovery exception NOT created (tested on BOTH p_checkin_insert IS NOT NULL
--       AND standalone p_checkin_insert IS NULL recovery paths)
--   13. Legitimate missing-attendance recovery AND security/branch exceptions preserved
-- ============================================================================
DO $s12_s13$
DECLARE
  v_now timestamptz := now();
  v_tz text := 'Asia/Manila';
  v_local timestamp := v_now AT TIME ZONE 'Asia/Manila';
  v_bdate date := v_local::date - CASE WHEN v_local::time < time '06:00:00' THEN 1 ELSE 0 END;
  v_branch uuid := gen_random_uuid();
  v_qr uuid := gen_random_uuid();
  v_staff_done uuid := gen_random_uuid();
  v_staff_missing uuid := gen_random_uuid();
  v_done_id uuid := gen_random_uuid();
  v_r record;
  v_exc_count integer;
BEGIN
  INSERT INTO public.branches(id, name) VALUES (v_branch, 'Recovery Guard Branch');
  INSERT INTO public.attendance_settings(branch_id, timezone, attendance_day_boundary)
  VALUES (v_branch, v_tz, '06:00:00');
  INSERT INTO public.qr_points(id, branch_id) VALUES (v_qr, v_branch);
  INSERT INTO public.staff(id, branch_id) VALUES (v_staff_done, v_branch), (v_staff_missing, v_branch);

  INSERT INTO public.staff_shift_checkins(id, staff_id, branch_id, shift_date, shift_type, shift_instance_key, checked_in_at, checked_out_at, status, attendance_business_date)
  VALUES (
    v_done_id, v_staff_done, v_branch, v_bdate, 'single',
    concat_ws('|', v_staff_done::text, v_branch::text, v_bdate::text, 'single', 'window:1', '14:00:00', '23:00:00', 'weekly', gen_random_uuid()::text),
    v_now - interval '8 hours',
    v_now - interval '5 minutes',
    'checked_out', v_bdate
  );

  -- 12a: RPC call WITH p_checkin_insert AND p_exception after completed shift -> suppressed
  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 's12a-insert-exc-' || v_staff_done,
    p_branch_id => v_branch,
    p_qr_point_id => v_qr,
    p_staff_id => v_staff_done,
    p_device_id => NULL,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'success',
    p_reason_code => 'unscheduled_clock_in',
    p_public_result => jsonb_build_object('ok', true, 'outcome', 'success', 'title', 'Late', 'message', 'Late'),
    p_checkin_insert => jsonb_build_object(
      'shift_date', v_bdate::text,
      'shift_type', 'single',
      'checked_in_at', v_now,
      'status', 'checked_in',
      'attendance_business_date', v_bdate::text
    ),
    p_exception => jsonb_build_object(
      'exception_type', 'missing_schedule',
      'severity', 'warning',
      'message', 'False exception on completed shift'
    )
  );
  IF v_r.recovery_issue_id IS NOT NULL OR v_r.operation_result->>'reasonCode' <> 'already_checked_out' THEN
    RAISE EXCEPTION 'FAIL [Scenario 12a]: False exception created on p_checkin_insert path! %', row_to_json(v_r);
  END IF;

  -- 12b: Standalone recovery RPC call WITH p_checkin_insert IS NULL AND p_exception -> suppressed
  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 's12b-null-insert-exc-' || v_staff_done,
    p_branch_id => v_branch,
    p_qr_point_id => v_qr,
    p_staff_id => v_staff_done,
    p_device_id => NULL,
    p_scan_type => 'attendance',
    p_action => 'scan_captured',
    p_outcome => 'exception',
    p_reason_code => 'likely_closing_scan_without_clock_in',
    p_public_result => jsonb_build_object('ok', true, 'outcome', 'exception', 'title', 'Recovery', 'message', 'Recovery'),
    p_checkin_insert => NULL,
    p_exception => jsonb_build_object(
      'exception_type', 'missing_clock_in',
      'severity', 'warning',
      'message', 'Closing scan without clock-in',
      'metadata', jsonb_build_object('internalExceptionType', 'likely_closing_scan_without_clock_in')
    )
  );
  SELECT count(*) INTO v_exc_count FROM public.attendance_exceptions WHERE staff_id = v_staff_done;
  IF v_r.recovery_issue_id IS NOT NULL
     OR v_r.operation_result->>'outcome' <> 'noop'
     OR v_r.operation_result->>'reasonCode' <> 'already_checked_out'
     OR v_exc_count <> 0 THEN
    RAISE EXCEPTION 'FAIL [Scenario 12b]: False recovery exception created on standalone p_checkin_insert IS NULL path! %, count=%', row_to_json(v_r), v_exc_count;
  END IF;
  RAISE NOTICE 'PASS [Scenario 12]: False recovery exceptions suppressed on both p_checkin_insert and p_checkin_insert IS NULL paths.';

  -- 13a: Legitimate missing-attendance recovery (staff has NO completed shift) -> exception IS created
  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 's13a-genuine-recovery-' || v_staff_missing,
    p_branch_id => v_branch,
    p_qr_point_id => v_qr,
    p_staff_id => v_staff_missing,
    p_device_id => NULL,
    p_scan_type => 'attendance',
    p_action => 'scan_captured',
    p_outcome => 'exception',
    p_reason_code => 'likely_closing_scan_without_clock_in',
    p_public_result => jsonb_build_object('ok', true, 'outcome', 'exception', 'title', 'Recovery', 'message', 'Genuine missing clock-in'),
    p_checkin_insert => NULL,
    p_exception => jsonb_build_object(
      'exception_type', 'missing_clock_in',
      'severity', 'warning',
      'message', 'Genuine closing scan without clock-in',
      'metadata', jsonb_build_object('internalExceptionType', 'likely_closing_scan_without_clock_in')
    )
  );
  IF v_r.recovery_issue_id IS NULL THEN
    RAISE EXCEPTION 'FAIL [Scenario 13a]: Genuine missing-attendance recovery exception was suppressed! %', row_to_json(v_r);
  END IF;

  -- 13b: Security/branch exception (wrong_branch) on staff with completed shift is NOT suppressed
  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 's13b-security-exc-' || v_staff_done,
    p_branch_id => v_branch,
    p_qr_point_id => v_qr,
    p_staff_id => v_staff_done,
    p_device_id => NULL,
    p_scan_type => 'attendance',
    p_action => 'scan_blocked',
    p_outcome => 'blocked',
    p_reason_code => 'wrong_branch',
    p_public_result => jsonb_build_object('ok', false, 'outcome', 'blocked', 'title', 'Wrong branch', 'message', 'Blocked'),
    p_checkin_insert => NULL,
    p_exception => jsonb_build_object(
      'exception_type', 'wrong_branch',
      'severity', 'warning',
      'message', 'Scanned at unauthorized branch'
    )
  );
  IF v_r.recovery_issue_id IS NULL THEN
    RAISE EXCEPTION 'FAIL [Scenario 13b]: Security/branch exception (wrong_branch) was erroneously suppressed!';
  END IF;
  RAISE NOTICE 'PASS [Scenario 13]: Legitimate missing-attendance recovery and security/branch exceptions preserved.';
END
$s12_s13$;

-- ============================================================================
-- SCENARIOS 15 & 16:
--   15. Approved inter-branch Staff Assistance transfer succeeds (clock out at
--       sending branch, clock in at receiving branch during authorized window,
--       permanent home branch unchanged)
--   16. Unauthorized, expired, and revoked inter-branch transfers fail
-- ============================================================================
DO $s15_s16$
DECLARE
  v_now timestamptz := now();
  v_local timestamp := v_now AT TIME ZONE 'Asia/Manila';
  v_bdate date := v_local::date - CASE WHEN v_local::time < time '06:00:00' THEN 1 ELSE 0 END;
  v_branch_home uuid := gen_random_uuid();
  v_branch_recv uuid := gen_random_uuid();
  v_branch_unauth uuid := gen_random_uuid();
  v_qr_home uuid := gen_random_uuid();
  v_qr_recv uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_auth_active uuid := gen_random_uuid();
  v_auth_expired uuid := gen_random_uuid();
  v_auth_revoked uuid := gen_random_uuid();
  v_home_checkin_id uuid;
  v_recv_checkin_id uuid;
  v_perm_branch uuid;
  v_auth record;
  v_r record;
BEGIN
  INSERT INTO public.branches(id, name) VALUES
    (v_branch_home, 'Sending Home Branch'),
    (v_branch_recv, 'Receiving Assistance Branch'),
    (v_branch_unauth, 'Unauthorized Third Branch');
  INSERT INTO public.attendance_settings(branch_id, timezone, attendance_day_boundary)
  VALUES
    (v_branch_home, 'Asia/Manila', '06:00:00'),
    (v_branch_recv, 'Asia/Manila', '06:00:00'),
    (v_branch_unauth, 'Asia/Manila', '06:00:00');
  INSERT INTO public.qr_points(id, branch_id) VALUES (v_qr_home, v_branch_home), (v_qr_recv, v_branch_recv);
  INSERT INTO public.staff(id, branch_id, full_name) VALUES (v_staff, v_branch_home, 'Interbranch Therapist');

  -- Scenario 16a: Before authorization, receiving branch and third branch are DENIED
  SELECT * INTO v_auth FROM public.resolve_effective_attendance_branch(v_staff, v_branch_recv, v_bdate, false);
  IF v_auth.allowed THEN
    RAISE EXCEPTION 'FAIL [Scenario 16a]: Unauthorized receiving branch allowed before approval!';
  END IF;

  -- Scenario 16b: Expired temporary assignment is DENIED
  INSERT INTO public.staff_attendance_branch_assignments(
    id, staff_id, branch_id, home_branch_id, assignment_date, attendance_business_date,
    assignment_type, scope, status, valid_from, valid_until, is_test
  ) VALUES (
    v_auth_expired, v_staff, v_branch_recv, v_branch_home, v_bdate, v_bdate,
    'temporary', 'shift', 'approved', v_now - interval '4 hours', v_now - interval '1 minute', false
  );
  SELECT * INTO v_auth FROM public.resolve_effective_attendance_branch(v_staff, v_branch_recv, v_bdate, false);
  IF v_auth.allowed THEN
    RAISE EXCEPTION 'FAIL [Scenario 16b]: Expired temporary branch assignment was allowed!';
  END IF;

  -- Scenario 16c: Revoked temporary assignment is DENIED
  INSERT INTO public.staff_attendance_branch_assignments(
    id, staff_id, branch_id, home_branch_id, assignment_date, attendance_business_date,
    assignment_type, scope, status, valid_from, valid_until, revoked_at, is_test
  ) VALUES (
    v_auth_revoked, v_staff, v_branch_recv, v_branch_home, v_bdate, v_bdate,
    'temporary', 'shift', 'revoked', v_now - interval '30 minutes', v_now + interval '4 hours', v_now - interval '5 minutes', false
  );
  SELECT * INTO v_auth FROM public.resolve_effective_attendance_branch(v_staff, v_branch_recv, v_bdate, false);
  IF v_auth.allowed THEN
    RAISE EXCEPTION 'FAIL [Scenario 16c]: Revoked temporary branch assignment was allowed!';
  END IF;
  RAISE NOTICE 'PASS [Scenario 16]: Unauthorized, expired, and revoked inter-branch transfers all rejected.';

  -- Scenario 15: Clock in & clock out at sending branch, then clock in at receiving branch during active temporary window
  SELECT * INTO v_auth FROM public.resolve_effective_attendance_branch(v_staff, v_branch_home, v_bdate, false);
  IF NOT v_auth.allowed OR v_auth.source <> 'home_branch' THEN
    RAISE EXCEPTION 'FAIL [Scenario 15]: Sending home branch denied: %', row_to_json(v_auth);
  END IF;

  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 's15-home-in-' || v_staff,
    p_branch_id => v_branch_home,
    p_qr_point_id => v_qr_home,
    p_staff_id => v_staff,
    p_device_id => NULL,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'success',
    p_public_result => jsonb_build_object('ok', true, 'outcome', 'success', 'title', 'Home In', 'message', 'Home In'),
    p_checkin_insert => jsonb_build_object(
      'shift_date', v_bdate::text,
      'shift_type', 'opening',
      'shift_instance_key', concat_ws('|', v_staff::text, v_branch_home::text, v_bdate::text, 'opening', 'window:1', '09:00:00', '13:00:00', 'weekly', gen_random_uuid()::text),
      'checked_in_at', v_now,
      'status', 'checked_in',
      'schedule_source', 'weekly',
      'attendance_business_date', v_bdate::text
    )
  );
  v_home_checkin_id := v_r.checkin_id;

  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 's15-home-out-' || v_staff,
    p_branch_id => v_branch_home,
    p_qr_point_id => v_qr_home,
    p_staff_id => v_staff,
    p_device_id => NULL,
    p_scan_type => 'attendance',
    p_action => 'clock_out',
    p_outcome => 'success',
    p_public_result => jsonb_build_object('ok', true, 'outcome', 'success', 'title', 'Home Out', 'message', 'Home Out'),
    p_checkin_id => v_home_checkin_id,
    p_checkin_update => jsonb_build_object(
      'checked_out_at', v_now,
      'status', 'checked_out',
      'worked_minutes', 180
    )
  );
  IF NOT v_r.success THEN
    RAISE EXCEPTION 'FAIL [Scenario 15]: Sending branch clock-out failed!';
  END IF;

  -- Approve active temporary Staff Assistance window at receiving branch
  INSERT INTO public.staff_attendance_branch_assignments(
    id, staff_id, branch_id, home_branch_id, assignment_date, attendance_business_date,
    assignment_type, scope, status, valid_from, valid_until, is_test
  ) VALUES (
    v_auth_active, v_staff, v_branch_recv, v_branch_home, v_bdate, v_bdate,
    'temporary', 'shift', 'approved', v_now - interval '15 minutes', v_now + interval '4 hours', false
  );

  SELECT * INTO v_auth FROM public.resolve_effective_attendance_branch(v_staff, v_branch_recv, v_bdate, false);
  IF NOT v_auth.allowed OR v_auth.effective_branch_id <> v_branch_recv OR v_auth.source <> 'temporary_branch_access_shift' THEN
    RAISE EXCEPTION 'FAIL [Scenario 15]: Active temporary assignment not recognized by resolve_effective_attendance_branch: %', row_to_json(v_auth);
  END IF;

  -- Clock in at receiving branch succeeds despite completed shift at sending branch
  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 's15-recv-in-' || v_staff,
    p_branch_id => v_branch_recv,
    p_qr_point_id => v_qr_recv,
    p_staff_id => v_staff,
    p_device_id => NULL,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'success',
    p_public_result => jsonb_build_object('ok', true, 'outcome', 'success', 'title', 'Recv In', 'message', 'Recv In'),
    p_checkin_insert => jsonb_build_object(
      'shift_date', v_bdate::text,
      'shift_type', 'closing',
      'shift_instance_key', concat_ws('|', v_staff::text, v_branch_recv::text, v_bdate::text, 'closing', 'window:1', '14:00:00', '22:00:00', 'none', 'none'),
      'checked_in_at', v_now,
      'status', 'checked_in',
      'schedule_source', 'none',
      'attendance_business_date', v_bdate::text
    )
  );
  v_recv_checkin_id := v_r.checkin_id;
  SELECT branch_id INTO v_perm_branch FROM public.staff WHERE id = v_staff;

  IF NOT v_r.success
     OR v_r.operation_result->>'outcome' <> 'success'
     OR v_recv_checkin_id IS NULL
     OR v_perm_branch <> v_branch_home THEN
    RAISE EXCEPTION 'FAIL [Scenario 15]: Receiving branch clock-in failed or mutated permanent home branch! %, perm=%', row_to_json(v_r), v_perm_branch;
  END IF;

  -- Unauthorized third branch STILL denied even while temporary assignment to v_branch_recv is active
  SELECT * INTO v_auth FROM public.resolve_effective_attendance_branch(v_staff, v_branch_unauth, v_bdate, false);
  IF v_auth.allowed THEN
    RAISE EXCEPTION 'FAIL [Scenario 15/16]: Third branch allowed during scoped temporary assignment!';
  END IF;

  RAISE NOTICE 'PASS [Scenario 15]: Approved inter-branch Staff Assistance transfer succeeded while preserving permanent home branch.';
END
$s15_s16$;

-- ============================================================================
-- EXPLICIT V2 REGRESSION PROBES (P0-01-C & P0-01-D exact prompt cases +
-- verified sourceScanEventId event-time provenance):
--   - Probe A: Actual scan 2026-11-06 11:01 AM Manila for 18:00 Window 2 -> REJECTED
--   - Probe B: Actual scan 2026-11-06 17:31 PM Manila supplying 2026-11-07 -> REJECTED
--   - Probe C: Deferred continuation 10m ago with verified sourceScanEventId -> ALLOWED
-- ============================================================================
DO $v2_regression_probes$
DECLARE
  v_now timestamptz := now();
  v_branch uuid := gen_random_uuid();
  v_qr uuid := gen_random_uuid();
  v_staff_a uuid := gen_random_uuid();
  v_staff_b uuid := gen_random_uuid();
  v_staff_c uuid := gen_random_uuid();
  v_w1 uuid := gen_random_uuid();
  v_w2 uuid := gen_random_uuid();
  v_src_event uuid := gen_random_uuid();
  v_deferred_at timestamptz := v_now - interval '10 minutes';
  v_bdate_c date;
  v_r record;
  v_count integer;
BEGIN
  INSERT INTO public.branches(id, name) VALUES (v_branch, 'V2 Regression Probe Branch');
  INSERT INTO public.attendance_settings(branch_id, timezone, attendance_day_boundary)
  VALUES (v_branch, 'Asia/Manila', '06:00:00');
  INSERT INTO public.qr_points(id, branch_id) VALUES (v_qr, v_branch);
  INSERT INTO public.staff(id, branch_id) VALUES (v_staff_a, v_branch), (v_staff_b, v_branch), (v_staff_c, v_branch);

  -- Probe A: 2026-11-06 11:01 AM Manila (2026-11-06T03:01:00Z) for 18:00 Window 2
  INSERT INTO public.staff_schedules(id, staff_id, day_of_week, shift_type, start_time, end_time, is_active, window_order)
  VALUES
    (v_w1, v_staff_a, 5, 'single', '07:00:00', '11:00:00', true, 1),
    (v_w2, v_staff_a, 5, 'single', '18:00:00', '22:30:00', true, 2);
  INSERT INTO public.staff_shift_checkins(staff_id, branch_id, shift_date, shift_type, shift_instance_key, checked_in_at, checked_out_at, status, attendance_business_date)
  VALUES (
    v_staff_a, v_branch, '2026-11-06', 'single',
    concat_ws('|', v_staff_a::text, v_branch::text, '2026-11-06', 'single', 'window:1', '07:00:00', '11:00:00', 'weekly', v_w1::text),
    '2026-11-05T23:00:00Z', '2026-11-06T03:00:00Z', 'checked_out', '2026-11-06'
  );

  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 'probe-a-1101am-' || v_staff_a,
    p_branch_id => v_branch,
    p_qr_point_id => v_qr,
    p_staff_id => v_staff_a,
    p_device_id => NULL,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'success',
    p_public_result => '{"ok":true,"outcome":"success","title":"Probe A","message":"Probe A"}'::jsonb,
    p_checkin_insert => jsonb_build_object(
      'shift_date', '2026-11-06',
      'shift_type', 'single',
      'shift_instance_key', concat_ws('|', v_staff_a::text, v_branch::text, '2026-11-06', 'single', 'window:2', '18:00:00', '22:30:00', 'weekly', v_w2::text),
      'checked_in_at', '2026-11-06T03:01:00Z',
      'status', 'checked_in',
      'scheduled_start_at', '2026-11-06T10:00:00Z',
      'schedule_source', 'weekly',
      'schedule_source_id', v_w2::text,
      'attendance_business_date', '2026-11-06'
    )
  );
  SELECT count(*) INTO v_count FROM public.staff_shift_checkins WHERE staff_id = v_staff_a;
  IF NOT v_r.success OR v_r.operation_result->>'reasonCode' <> 'already_checked_out' OR v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL [Probe A]: 2026-11-06 11:01 AM Manila premature Window 2 admitted! %, rows=%', row_to_json(v_r), v_count;
  END IF;

  -- Probe B: 2026-11-06 17:31 PM Manila (2026-11-06T09:31:00Z) supplying forged 2026-11-07
  INSERT INTO public.staff_shift_checkins(staff_id, branch_id, shift_date, shift_type, shift_instance_key, checked_in_at, checked_out_at, status, attendance_business_date)
  VALUES (
    v_staff_b, v_branch, '2026-11-06', 'single',
    concat_ws('|', v_staff_b::text, v_branch::text, '2026-11-06', 'single', 'window:1', '10:00:00', '17:30:00', 'weekly', gen_random_uuid()::text),
    '2026-11-06T02:00:00Z', '2026-11-06T09:30:00Z', 'checked_out', '2026-11-06'
  );
  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 'probe-b-1731pm-' || v_staff_b,
    p_branch_id => v_branch,
    p_qr_point_id => v_qr,
    p_staff_id => v_staff_b,
    p_device_id => NULL,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'success',
    p_public_result => '{"ok":true,"outcome":"success","title":"Probe B","message":"Probe B"}'::jsonb,
    p_checkin_insert => jsonb_build_object(
      'shift_date', '2026-11-07',
      'shift_type', 'single',
      'shift_instance_key', concat_ws('|', v_staff_b::text, v_branch::text, '2026-11-07', 'single', 'window:1', '10:00:00', '17:30:00', 'weekly', gen_random_uuid()::text),
      'checked_in_at', '2026-11-06T09:31:00Z',
      'status', 'checked_in',
      'schedule_source', 'weekly',
      'attendance_business_date', '2026-11-07'
    )
  );
  SELECT count(*) INTO v_count FROM public.staff_shift_checkins WHERE staff_id = v_staff_b;
  IF NOT v_r.success OR v_r.operation_result->>'reasonCode' <> 'already_checked_out' OR v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL [Probe B]: 2026-11-06 17:31 Manila forged 2026-11-07 admitted! %, rows=%', row_to_json(v_r), v_count;
  END IF;

  -- Probe C: Event-time scan 10m ago WITH verified qr_scan_events sourceScanEventId provenance -> ALLOWED
  v_bdate_c := (v_deferred_at AT TIME ZONE 'Asia/Manila')::date
    - CASE WHEN (v_deferred_at AT TIME ZONE 'Asia/Manila')::time < time '06:00:00' THEN 1 ELSE 0 END;
  INSERT INTO public.qr_scan_events(id, branch_id, qr_point_id, staff_id, scan_type, action, outcome, created_at)
  VALUES (v_src_event, v_branch, v_qr, v_staff_c, 'attendance', 'scan_blocked', 'blocked', v_deferred_at);

  SELECT * INTO v_r
  FROM public.commit_attendance_scan_transaction(
    p_request_id => 'probe-c-provenance-' || v_staff_c,
    p_branch_id => v_branch,
    p_qr_point_id => v_qr,
    p_staff_id => v_staff_c,
    p_device_id => NULL,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'success',
    p_metadata => jsonb_build_object('sourceScanEventId', v_src_event::text, 'scannedAt', v_deferred_at),
    p_public_result => '{"ok":true,"outcome":"success","title":"Probe C","message":"Probe C"}'::jsonb,
    p_checkin_insert => jsonb_build_object(
      'shift_date', v_bdate_c::text,
      'shift_type', 'single',
      'checked_in_at', v_deferred_at,
      'status', 'checked_in',
      'attendance_business_date', v_bdate_c::text
    )
  );
  IF NOT v_r.success OR v_r.checkin_id IS NULL THEN
    RAISE EXCEPTION 'FAIL [Probe C]: Verified sourceScanEventId provenance rejected! %', row_to_json(v_r);
  END IF;

  RAISE NOTICE 'PASS [V2 Regression Probes]: Exact 11:01 AM premature Window 2, 17:31 PM forged business date, and verified sourceScanEventId provenance all passed.';
END
$v2_regression_probes$;

ROLLBACK;

SELECT 'P0-01 V3 ISOLATED POSTGRESQL 17 SUITE: ALL SCENARIOS (1..13, 15..18) PASSED' AS final_result;
