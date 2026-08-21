-- Read-only preflight for the consolidated live schema reconciliation.
-- Every counter identifies rows that a repair would touch or constraints that
-- would fail. This file intentionally makes no schema or data changes.

select jsonb_build_object(
  'pending_legacy_branch_requests', (
    select count(*)
    from public.staff_branch_change_requests
    where status = 'pending'
  ),
  'recent_wrong_branch_scans_30d', (
    select count(*)
    from public.qr_scan_events event
    join public.staff staff on staff.id = event.staff_id
    where event.reason_code = 'wrong_branch'
      and event.created_at >= now() - interval '30 days'
      and event.staff_id is not null
      and event.branch_id is not null
      and staff.branch_id is distinct from event.branch_id
  ),
  'bookings_needing_timing_snapshot_backfill', (
    select count(*)
    from public.bookings
    where status not in ('completed', 'cancelled', 'no_show')
      and (
        session_duration_minutes_snapshot is null
        or session_duration_minutes_snapshot <= 0
        or booking_buffer_before_minutes_snapshot is null
        or booking_buffer_after_minutes_snapshot is null
      )
  ),
  'bookings_invalid_buffer_before', (
    select count(*)
    from public.bookings
    where booking_buffer_before_minutes_snapshot is not null
      and booking_buffer_before_minutes_snapshot not between 0 and 240
  ),
  'bookings_invalid_buffer_after', (
    select count(*)
    from public.bookings
    where booking_buffer_after_minutes_snapshot is not null
      and booking_buffer_after_minutes_snapshot not between 0 and 240
  ),
  'bookings_invalid_extension_total', (
    select count(*)
    from public.bookings
    where session_extension_minutes_total not between 0 and 720
  ),
  'bookings_invalid_session_start_source', (
    select count(*)
    from public.bookings
    where session_start_source is not null
      and session_start_source not in (
        'crm', 'staff_portal', 'room_qr', 'manager', 'system_recovery'
      )
  ),
  'branches_invalid_latitude', (
    select count(*)
    from public.branches
    where latitude is not null
      and (latitude < -90 or latitude > 90)
  ),
  'branch_rules_has_free_km_columns', (
    select count(*) = 2
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'branch_booking_rules'
      and column_name in (
        'home_service_free_km',
        'home_service_extra_km_fee'
      )
  ),
  'active_group_rules_invalid_window', (
    select count(*)
    from public.staff_group_schedule_rules
    where is_active = true
      and is_day_off is not true
      and (
        start_time is null
        or end_time is null
        or start_time = end_time
      )
  ),
  'active_group_rule_conflicts', (
    select count(*)
    from public.staff_group_schedule_rules first_rule
    join public.staff_group_schedule_rules second_rule
      on second_rule.group_id = first_rule.group_id
      and second_rule.day_of_week = first_rule.day_of_week
      and second_rule.id > first_rule.id
      and second_rule.is_active = true
    where first_rule.is_active = true
      and (
        first_rule.is_day_off = true
        or second_rule.is_day_off = true
        or (
          first_rule.start_time is not null
          and first_rule.end_time is not null
          and second_rule.start_time is not null
          and second_rule.end_time is not null
          and public.schedule_time_ranges_overlap(
            first_rule.start_time,
            first_rule.end_time,
            second_rule.start_time,
            second_rule.end_time
          )
        )
      )
  ),
  'public_tables_without_rls', (
    select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  ),
  'missing_required_functions', (
    select coalesce(jsonb_agg(required.signature order by required.signature), '[]'::jsonb)
    from (
      values
        ('public.recover_stale_attendance_and_clock_in(uuid,uuid,uuid,uuid,boolean,timestamptz,jsonb,text,uuid,text,text,jsonb,jsonb,jsonb)'),
        ('public.correct_attendance_times_transaction(uuid,uuid,text,text,uuid,timestamptz,timestamptz,uuid,jsonb,boolean)'),
        ('public.resolve_attendance_scan_review_transaction(uuid,uuid,uuid,text,text,date,text,timestamptz,timestamptz,text,boolean)'),
        ('public.resolve_staff_branch_assignment_issue(uuid,text,uuid,uuid,text,date,timestamptz,timestamptz,jsonb,jsonb)'),
        ('public.prepare_booking_timing_snapshots()'),
        ('public.replace_group_weekly_schedule(uuid,jsonb)'),
        ('public.validate_group_schedule_rule_window()')
    ) as required(signature)
    where to_regprocedure(required.signature) is null
  )
) as preflight;
