-- READ-ONLY post-install verification. Run on TEST first; PRODUCTION only
-- during a separately approved release-verification window.
-- No DDL, DML, migration-history edits or fixture writes.
SELECT
  b.name AS branch_name,
  a.timezone,
  a.early_clock_in_allowed_minutes,
  a.clock_in_window_before_shift_minutes,
  a.attendance_day_boundary
FROM public.attendance_settings AS a
JOIN public.branches AS b ON b.id = a.branch_id
ORDER BY b.name;

SELECT
  t.tgname AS trigger_name,
  t.tgenabled AS enabled,
  pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger AS t
WHERE t.tgrelid = 'public.staff_shift_checkins'::regclass
  AND NOT t.tgisinternal
  AND t.tgname = 'staff_shift_checkins_qr_clock_in_window_guard';

SELECT
  p.proname AS function_name,
  p.prosecdef AS security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'enforce_qr_clock_in_shift_window',
    'commit_attendance_scan_transaction',
    'recover_stale_attendance_and_clock_in'
  )
ORDER BY p.proname;
