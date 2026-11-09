-- P0 Attendance integrity: guard all new QR attendance inserts atomically.
-- Authorised owner policy: check-in no earlier than 60 minutes before the
-- resolved shift start; the last service may extend CLOCK-OUT, never CLOCK-IN.
-- Target: the WEB repository's connected Supabase (NOT applied by this file).
-- Forward-only. Do not replay unrelated historical local-only migrations.
-- PR #89 already placed the corresponding server guard on accepted Web main.
--
-- This trigger operates on INSERT only and does not alter existing rows,
-- attendance recovery/correction methods other than 'qr', clock-outs, RLS,
-- booking/service completion, or privileged staff permissions.
--
-- The schedule snapshot on QR writes is produced by the server-controlled
-- schedule resolver (not by the browser). The database independently enforces
-- the 60-minute temporal invariant, including the stale-recovery insert path.
-- Server-side source-authorization and branch checks remain mandatory.

DO $attendance_p0_precheck$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.attendance_settings) THEN
    RAISE EXCEPTION 'P0 attendance guard: attendance settings do not exist';
  END IF;

  -- Prevent silent overwrite if a branch has acquired a different policy.
  IF EXISTS (
    SELECT 1
    FROM public.attendance_settings a
    WHERE a.early_clock_in_allowed_minutes IS NULL
       OR a.clock_in_window_before_shift_minutes IS NULL
       OR a.early_clock_in_allowed_minutes NOT IN (30, 60)
       OR a.clock_in_window_before_shift_minutes NOT IN (30, 60)
  ) THEN
    RAISE EXCEPTION
      'P0 attendance guard: unexpected early-clock-in configuration; stop for manual review';
  END IF;
END;
$attendance_p0_precheck$;

CREATE FUNCTION public.enforce_qr_clock_in_shift_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $attendance_p0_guard$
BEGIN
  IF NEW.clock_in_method IS DISTINCT FROM 'qr'
     OR NEW.status IS DISTINCT FROM 'checked_in' THEN
    RETURN NEW;
  END IF;

  -- A QR clock-in is not an authorized substitute for a missing, off-day,
  -- conflicting or recovery-only schedule. Manual correction remains separate.
  IF NEW.checked_in_at IS NULL
     OR NEW.schedule_source IS NULL
     OR NEW.schedule_source NOT IN ('weekly', 'override')
     OR NULLIF(NEW.schedule_source_id, '') IS NULL
     OR NEW.scheduled_start_at IS NULL
     OR NEW.scheduled_end_at IS NULL
     OR NEW.scheduled_end_at <= NEW.scheduled_start_at THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'attendance_qr_clock_in_requires_resolved_shift';
  END IF;

  -- Compare absolute timestamptz instants rather than wall-clock strings:
  -- this supports valid overnight and split shifts and never promotes a
  -- midnight scan to a new shift nine hours before its start.
  IF NEW.checked_in_at < NEW.scheduled_start_at - INTERVAL '60 minutes'
     OR NEW.checked_in_at >= NEW.scheduled_end_at THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'attendance_qr_clock_in_outside_shift_window';
  END IF;

  RETURN NEW;
END;
$attendance_p0_guard$;

-- The trigger function is internal only, not a public Data API/RPC endpoint.
REVOKE ALL ON FUNCTION public.enforce_qr_clock_in_shift_window()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_qr_clock_in_shift_window()
TO service_role;

-- A BEFORE INSERT guard is in the same transaction as BOTH existing writers:
-- commit_attendance_scan_transaction and recover_stale_attendance_and_clock_in.
-- An invalid stale-recovery insert therefore rolls back its stale close too.
CREATE TRIGGER staff_shift_checkins_qr_clock_in_window_guard
BEFORE INSERT ON public.staff_shift_checkins
FOR EACH ROW
WHEN (NEW.clock_in_method = 'qr' AND NEW.status = 'checked_in')
EXECUTE FUNCTION public.enforce_qr_clock_in_shift_window();

-- Align the persisted branch settings with the explicit owner-approved 60m
-- policy; no changes to clock-out windows, final-service behavior, or records.
UPDATE public.attendance_settings
SET early_clock_in_allowed_minutes = 60,
    clock_in_window_before_shift_minutes = 60,
    updated_at = NOW()
WHERE early_clock_in_allowed_minutes IS DISTINCT FROM 60
   OR clock_in_window_before_shift_minutes IS DISTINCT FROM 60;
