-- Read-only Attendance scan connection diagnostics.
-- This file does not modify schema or data.

select
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'qr_scan_events'
  ) as qr_scan_events_in_realtime_publication,
  has_table_privilege('authenticated', 'public.qr_scan_events', 'select')
    as authenticated_can_select;

select
  branch_id,
  timezone,
  test_mode_enabled,
  test_mode_reason,
  test_mode_enabled_at,
  test_mode_disabled_at
from public.attendance_settings
order by branch_id;

select
  created_at,
  branch_id,
  staff_id,
  scan_type,
  action,
  outcome,
  reason_code,
  is_test,
  request_id,
  operation_id,
  checkin_id
from public.qr_scan_events
where created_at >= now() - interval '4 hours'
order by created_at desc
limit 100;

select
  split_part(coalesce(operation_id, request_id, id::text), ':', 1) as root_operation,
  count(*) as raw_event_count,
  min(created_at) as first_event,
  max(created_at) as last_event,
  array_agg(action order by created_at) as actions,
  array_agg(outcome order by created_at) as outcomes,
  array_agg(reason_code order by created_at) as reasons
from public.qr_scan_events
where created_at >= now() - interval '1 day'
  and scan_type = 'attendance'
group by split_part(coalesce(operation_id, request_id, id::text), ':', 1)
having count(*) > 1
order by last_event desc;

select
  branch_id,
  staff_id,
  exception_type,
  status,
  dedupe_key,
  occurrence_count,
  first_detected_at,
  last_detected_at,
  scan_event_id
from public.attendance_exceptions
where status = 'open'
  and exception_type = 'unknown_device'
order by last_detected_at desc;
