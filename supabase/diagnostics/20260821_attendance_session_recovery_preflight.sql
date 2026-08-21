-- Read-only, sanitized Attendance launch preflight.
-- Returns aggregate counts, branch names, and cron metadata only.
-- It does not expose staff rows, device credentials, QR public codes, or secrets.

select jsonb_build_object(
  'realtime_qr_scan_events', exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'qr_scan_events'
  ),
  'authenticated_can_select_qr_scan_events',
    has_table_privilege('authenticated', 'public.qr_scan_events', 'select'),
  'test_mode_enabled_branches', (
    select count(*)
    from public.attendance_settings
    where test_mode_enabled
  ),
  'settings_runtime_mismatches', (
    select count(*)
    from public.attendance_settings
    where clock_in_window_before_shift_minutes <> early_clock_in_allowed_minutes
       or duplicate_scan_window_seconds <> duplicate_scan_debounce_minutes * 60
       or clock_in_late_grace_minutes <> late_grace_minutes
  ),
  'settings_runtime_mismatch_details', (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'branch', b.name,
          'clock_in_window_before_shift_minutes', s.clock_in_window_before_shift_minutes,
          'early_clock_in_allowed_minutes', s.early_clock_in_allowed_minutes,
          'duplicate_scan_window_seconds', s.duplicate_scan_window_seconds,
          'duplicate_scan_debounce_minutes', s.duplicate_scan_debounce_minutes,
          'clock_in_late_grace_minutes', s.clock_in_late_grace_minutes,
          'late_grace_minutes', s.late_grace_minutes
        )
        order by b.name
      ),
      '[]'::jsonb
    )
    from public.attendance_settings s
    join public.branches b on b.id = s.branch_id
    where s.clock_in_window_before_shift_minutes <> s.early_clock_in_allowed_minutes
       or s.duplicate_scan_window_seconds <> s.duplicate_scan_debounce_minutes * 60
       or s.clock_in_late_grace_minutes <> s.late_grace_minutes
  ),
  'active_branches_missing_active_attendance_qr', (
    select count(*)
    from public.branches b
    where b.is_active
      and not exists (
        select 1
        from public.qr_points q
        where q.branch_id = b.id
          and q.point_type = 'attendance'
          and q.is_active
      )
  ),
  'branches_with_duplicate_active_attendance_qr', (
    select count(*)
    from (
      select branch_id
      from public.qr_points
      where point_type = 'attendance'
        and is_active
      group by branch_id
      having count(*) > 1
    ) duplicates
  ),
  'active_attendance_qr_by_branch', (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'branch', grouped.branch_name,
          'active_qr_count', grouped.active_qr_count
        )
        order by grouped.branch_name
      ),
      '[]'::jsonb
    )
    from (
      select b.name as branch_name, count(q.id) as active_qr_count
      from public.branches b
      left join public.qr_points q
        on q.branch_id = b.id
       and q.point_type = 'attendance'
       and q.is_active
      where b.is_active
      group by b.id, b.name
    ) grouped
  ),
  'staff_exceeding_two_active_devices', (
    select count(*)
    from (
      select staff_id
      from public.staff_devices
      where status = 'active'
      group by staff_id
      having count(*) > 2
    ) over_limit
  ),
  'active_devices_with_non_clear_security_state', (
    select count(*)
    from public.staff_devices
    where status = 'active'
      and security_state <> 'clear'
  ),
  'stale_open_live_attendance_over_20h', (
    select count(*)
    from public.staff_shift_checkins
    where checked_out_at is null
      and not is_test
      and checked_in_at < now() - interval '20 hours'
  ),
  'stale_open_live_attendance_by_branch', (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'branch', grouped.branch_name,
          'issue_count', grouped.issue_count,
          'oldest_checked_in_at', grouped.oldest_checked_in_at
        )
        order by grouped.branch_name
      ),
      '[]'::jsonb
    )
    from (
      select b.name as branch_name,
             count(*) as issue_count,
             min(c.checked_in_at) as oldest_checked_in_at
      from public.staff_shift_checkins c
      join public.branches b on b.id = c.branch_id
      where c.checked_out_at is null
        and not c.is_test
        and c.checked_in_at < now() - interval '20 hours'
      group by b.id, b.name
    ) grouped
  ),
  'open_branch_assignment_issues', (
    select count(*)
    from public.staff_branch_assignment_issues
    where status in ('open', 'pending', 'needs_review')
  ),
  'open_branch_assignment_issues_by_branch', (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'branch', grouped.branch_name,
          'status', grouped.status,
          'issue_count', grouped.issue_count
        )
        order by grouped.branch_name, grouped.status
      ),
      '[]'::jsonb
    )
    from (
      select coalesce(b.name, 'Unassigned') as branch_name,
             i.status,
             count(*) as issue_count
      from public.staff_branch_assignment_issues i
      left join public.branches b on b.id = i.affected_branch_id
      where i.status in ('open', 'pending', 'needs_review')
      group by b.id, b.name, i.status
    ) grouped
  ),
  'attendance_closing_cron_jobs', (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'jobname', jobname,
          'schedule', schedule,
          'active', active
        )
        order by jobname
      ),
      '[]'::jsonb
    )
    from cron.job
    where jobname like 'attendance-closing-%'
  )
) as attendance_preflight;
