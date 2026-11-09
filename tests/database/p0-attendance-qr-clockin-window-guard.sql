-- TEST DATABASE ONLY. Never run against PRODUCTION.
-- Run after installing supabase/migrations/
-- 20261109120000_attendance_qr_clockin_window_guard.sql in an isolated TEST DB.
-- Rollback ensures zero persistent test rows/schema.
BEGIN;

CREATE TEMP TABLE p0_attendance_qr_probe
(LIKE public.staff_shift_checkins INCLUDING DEFAULTS);

CREATE TRIGGER p0_attendance_qr_probe_guard
BEFORE INSERT ON p0_attendance_qr_probe
FOR EACH ROW
WHEN (NEW.clock_in_method = 'qr' AND NEW.status = 'checked_in')
EXECUTE FUNCTION public.enforce_qr_clock_in_shift_window();

DO $test$
DECLARE
  v_staff UUID := '00000000-0000-0000-0000-0000000000a1';
  v_branch UUID := '00000000-0000-0000-0000-0000000000b1';
  v_date DATE := '2026-11-09';
  v_start TIMESTAMPTZ := '2026-11-09T01:00:00Z'; -- 09:00 Manila
  v_end TIMESTAMPTZ := '2026-11-09T13:30:00Z'; -- 21:30 Manila
BEGIN
  -- 08:00 Manila is exactly one hour early: allowed.
  INSERT INTO p0_attendance_qr_probe
    (staff_id, branch_id, shift_date, shift_type, checked_in_at,
     scheduled_start_at, scheduled_end_at, schedule_source,
     schedule_source_id, clock_in_method, status, is_test)
  VALUES
    (v_staff, v_branch, v_date, 'opening', v_start - INTERVAL '60 minutes',
     v_start, v_end, 'weekly', 'synthetic-weekly-id', 'qr', 'checked_in', TRUE);

  IF (SELECT COUNT(*) FROM p0_attendance_qr_probe) <> 1 THEN
    RAISE EXCEPTION 'P0 test failed: exactly 60 minutes early must be accepted';
  END IF;

  -- 07:59:59 Manila: rejected with no inserted attendance row.
  BEGIN
    INSERT INTO p0_attendance_qr_probe
      (staff_id, branch_id, shift_date, checked_in_at,
       scheduled_start_at, scheduled_end_at, schedule_source,
       schedule_source_id, clock_in_method, status)
    VALUES
      (v_staff, v_branch, v_date, v_start - INTERVAL '60 minutes 1 second',
       v_start, v_end, 'weekly', 'synthetic-weekly-id', 'qr', 'checked_in');
    RAISE EXCEPTION 'P0 test failed: earlier than one hour was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  -- Reproduce real incident timestamp: 00:00 for a 09:00 opening shift.
  BEGIN
    INSERT INTO p0_attendance_qr_probe
      (staff_id, branch_id, shift_date, shift_type, checked_in_at,
       scheduled_start_at, scheduled_end_at, schedule_source,
       schedule_source_id, clock_in_method, status)
    VALUES
      (v_staff, v_branch, v_date, 'opening',
       '2026-11-08T16:00:34.862Z', v_start, v_end,
       'weekly', 'synthetic-weekly-id', 'qr', 'checked_in');
    RAISE EXCEPTION 'P0 test failed: midnight opening-shift scan accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  -- Valid late arrival during the shift retains existing late-review flow.
  INSERT INTO p0_attendance_qr_probe
    (staff_id, branch_id, shift_date, shift_type, checked_in_at,
     scheduled_start_at, scheduled_end_at, schedule_source,
     schedule_source_id, clock_in_method, status)
  VALUES
    (v_staff, v_branch, v_date, 'opening', v_start + INTERVAL '4 hours',
     v_start, v_end, 'weekly', 'synthetic-weekly-id', 'qr', 'checked_in');

  -- At the scheduled end, clock-IN is rejected. It does not limit clock-OUT.
  BEGIN
    INSERT INTO p0_attendance_qr_probe
      (staff_id, branch_id, shift_date, checked_in_at,
       scheduled_start_at, scheduled_end_at, schedule_source,
       schedule_source_id, clock_in_method, status)
    VALUES
      (v_staff, v_branch, v_date, v_end,
       v_start, v_end, 'weekly', 'synthetic-weekly-id', 'qr', 'checked_in');
    RAISE EXCEPTION 'P0 test failed: shift-end new clock-in accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  -- Missing/unscheduled QR cannot silently create a shift.
  BEGIN
    INSERT INTO p0_attendance_qr_probe
      (staff_id, branch_id, shift_date, checked_in_at,
       clock_in_method, schedule_source, status)
    VALUES
      (v_staff, v_branch, v_date, v_start, 'qr', 'recovery', 'checked_in');
    RAISE EXCEPTION 'P0 test failed: missing schedule accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  -- Genuine overnight shift: after-midnight clock-IN remains valid if within
  -- its OWN authorized start/end interval.
  INSERT INTO p0_attendance_qr_probe
    (staff_id, branch_id, shift_date, shift_type, checked_in_at,
     scheduled_start_at, scheduled_end_at, schedule_source,
     schedule_source_id, clock_in_method, status)
  VALUES
    (v_staff, v_branch, '2026-11-08', 'closing', '2026-11-08T16:00:00Z',
     '2026-11-08T09:00:00Z', '2026-11-08T17:30:00Z',
     'weekly', 'synthetic-overnight-id', 'qr', 'checked_in');

  -- Approved second split-shift window: exactly 60 minutes early is valid.
  INSERT INTO p0_attendance_qr_probe
    (staff_id, branch_id, shift_date, shift_type, checked_in_at,
     scheduled_start_at, scheduled_end_at, schedule_source,
     schedule_source_id, clock_in_method, status)
  VALUES
    (v_staff, v_branch, v_date, 'closing', '2026-11-09T05:00:00Z',
     '2026-11-09T06:00:00Z', v_end, 'weekly',
     'synthetic-split-id', 'qr', 'checked_in');

  -- Manual review corrections do not use the new QR guard.
  INSERT INTO p0_attendance_qr_probe
    (staff_id, branch_id, shift_date, checked_in_at,
     clock_in_method, schedule_source, status)
  VALUES
    (v_staff, v_branch, v_date, v_start,
     'manual_review', 'recovery', 'checked_in');

  IF (SELECT COUNT(*) FROM p0_attendance_qr_probe) <> 5 THEN
    RAISE EXCEPTION
      'P0 test failed: expected exactly 5 accepted rows, found %',
      (SELECT COUNT(*) FROM p0_attendance_qr_probe);
  END IF;

  RAISE NOTICE
    'P0 QR clock-in guard: all synthetic trigger cases passed; rolling back';
END;
$test$;

ROLLBACK;
