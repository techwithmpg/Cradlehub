-- READ-ONLY PRODUCTION DIAGNOSTIC
-- Task: ATTENDANCE-PRODUCTION-AUDIT-20260722
-- Business timezone: Asia/Manila
-- Business date: 2026-07-22
-- Main branch: c1000000-0000-0000-0000-000000000001
--
-- The supplied prompt omitted its pasted staff table. The authenticated CRM
-- Attendance page showed 55 active, unarchived, unmerged Main Spa profiles, so
-- this report uses that exact visible roster as the provisional target set.
-- This script does not insert, update, delete, call a mutating RPC, or create
-- database objects. The transaction is explicitly read-only.

begin transaction read only;
set local timezone = 'UTC';

-- Staff-by-staff evidence and diagnosis.
with
params as (
  select
    'c1000000-0000-0000-0000-000000000001'::uuid as branch_id,
    date '2026-07-22' as business_date,
    'Asia/Manila'::text as business_timezone,
    timestamptz '2026-07-22 06:00:00+08' as business_start,
    timestamptz '2026-07-23 06:00:00+08' as business_end
),
branch_context as (
  select
    b.id,
    b.name,
    b.is_active,
    coalesce(a.timezone, p.business_timezone) as timezone,
    coalesce(a.attendance_day_boundary, time '06:00:00') as attendance_day_boundary,
    coalesce(a.late_grace_minutes, a.clock_in_late_grace_minutes, 0) as late_grace_minutes,
    a.clock_in_window_before_shift_minutes,
    a.clock_in_window_after_shift_start_minutes,
    a.clock_out_window_before_shift_end_minutes,
    a.clock_out_window_after_shift_end_minutes,
    a.early_leave_threshold_minutes,
    a.overtime_threshold_minutes,
    a.active_service_blocks_clock_out
  from params p
  join public.branches b on b.id = p.branch_id
  left join public.attendance_settings a on a.branch_id = b.id
),
target_staff as (
  select
    s.*,
    regexp_replace(lower(s.full_name), '[^a-z0-9]+', '', 'g') as normalized_name
  from public.staff s
  join params p on p.branch_id = s.branch_id
  where s.is_active = true
    and s.archived_at is null
    and s.merged_into_staff_id is null
),
duplicate_names as (
  select normalized_name, count(*) as profile_count
  from target_staff
  group by normalized_name
  having count(*) > 1
),
canonical_branch as (
  select
    ts.id as staff_id,
    coalesce(
      temporary_assignment.branch_id,
      duty_assignment.branch_id,
      cross_branch_assignment.branch_id,
      case when ts.is_cross_branch then p.branch_id end,
      ts.branch_id
    ) = p.branch_id as allowed,
    coalesce(
      temporary_assignment.branch_id,
      duty_assignment.branch_id,
      cross_branch_assignment.branch_id,
      case when ts.is_cross_branch then p.branch_id end,
      ts.branch_id
    ) as effective_branch_id,
    coalesce(
      temporary_assignment.source,
      duty_assignment.source,
      cross_branch_assignment.source,
      case when ts.is_cross_branch then 'approved_cross_branch' end,
      'home_branch'
    ) as source
  from target_staff ts
  cross join params p
  left join lateral (
    select
      assignment.branch_id,
      case
        when assignment.scope = 'shift' then 'temporary_branch_access_shift'
        when assignment.scope = 'business_day' then 'temporary_branch_access_day'
        else assignment.assignment_type
      end as source
    from public.staff_attendance_branch_assignments assignment
    where assignment.staff_id = ts.id
      and assignment.branch_id = p.branch_id
      and assignment.status = 'approved'
      and assignment.assignment_type = 'temporary'
      and assignment.is_test = false
      and (assignment.valid_from is null or assignment.valid_from <= now())
      and (assignment.valid_until is null or assignment.valid_until > now())
      and (
        (
          coalesce(assignment.scope, 'business_day') = 'business_day'
          and coalesce(assignment.attendance_business_date, assignment.assignment_date) = p.business_date
        )
        or (
          assignment.scope = 'shift'
          and (
            coalesce(assignment.attendance_business_date, assignment.assignment_date) = p.business_date
            or exists (
              select 1
              from public.staff_shift_checkins checkin
              where checkin.branch_authorization_id = assignment.id
                and checkin.staff_id = assignment.staff_id
                and checkin.branch_id = assignment.branch_id
                and checkin.is_test = assignment.is_test
                and checkin.status = 'checked_in'
                and checkin.checked_out_at is null
            )
          )
        )
      )
    order by assignment.created_at desc
    limit 1
  ) temporary_assignment on true
  left join lateral (
    select duty.branch_id, 'schedule_assignment'::text as source
    from public.staff_duty_assignments duty
    where duty.staff_id = ts.id
      and duty.day_of_week = extract(dow from p.business_date)::integer
      and duty.is_active = true
    order by duty.created_at desc, duty.id
    limit 1
  ) duty_assignment on temporary_assignment.branch_id is null
  left join lateral (
    select assignment.branch_id, assignment.assignment_type as source
    from public.staff_attendance_branch_assignments assignment
    where assignment.staff_id = ts.id
      and assignment.assignment_date = p.business_date
      and assignment.status = 'approved'
      and assignment.assignment_type = 'approved_cross_branch'
      and assignment.is_test = false
    order by assignment.created_at desc
    limit 1
  ) cross_branch_assignment
    on temporary_assignment.branch_id is null
   and duty_assignment.branch_id is null
),
weekly_rows as (
  select
    ss.id,
    ss.staff_id,
    ss.shift_type,
    ss.start_time,
    ss.end_time,
    ss.is_active,
    ss.window_order,
    ss.ends_next_day
  from public.staff_schedules ss
  join target_staff ts on ts.id = ss.staff_id
  cross join params p
  where ss.day_of_week = extract(dow from p.business_date)::integer
),
date_overrides as (
  select so.*
  from public.schedule_overrides so
  join target_staff ts on ts.id = so.staff_id
  cross join params p
  where so.override_date = p.business_date
),
schedule_state as (
  select
    ts.id as staff_id,
    case
      when ov.id is not null then 'override'
      when count(wr.id) > 0 then 'individual'
      else 'none'
    end as schedule_source,
    case
      when ov.id is not null and ov.is_day_off then 'day_off'
      when ov.id is not null and (ov.start_time is null or ov.end_time is null or ov.start_time = ov.end_time) then 'conflict'
      when ov.id is not null then 'resolved'
      when count(wr.id) = 0 then 'missing'
      when count(wr.id) filter (where wr.is_active) = 0 then 'day_off'
      when count(wr.id) filter (
        where wr.is_active
          and (wr.start_time is null or wr.end_time is null or wr.start_time = wr.end_time)
      ) > 0 then 'conflict'
      else 'resolved'
    end as schedule_status,
    case when ov.id is not null then jsonb_build_object(
      'id', ov.id,
      'staffId', ov.staff_id,
      'overrideDate', ov.override_date,
      'isDayOff', ov.is_day_off,
      'shiftType', ov.shift_type,
      'startTime', ov.start_time,
      'endTime', ov.end_time,
      'endsNextDay', ov.ends_next_day,
      'reason', ov.reason,
      'createdBy', ov.created_by,
      'createdAt', ov.created_at
    ) else null end as schedule_override,
    jsonb_agg(
      jsonb_build_object(
        'id', wr.id,
        'shiftType', wr.shift_type,
        'startTime', wr.start_time,
        'endTime', wr.end_time,
        'isActive', wr.is_active,
        'windowOrder', wr.window_order,
        'endsNextDay', wr.ends_next_day
      ) order by wr.window_order, wr.start_time
    ) filter (where wr.id is not null) as weekly_schedule_rows
  from target_staff ts
  left join date_overrides ov on ov.staff_id = ts.id
  left join weekly_rows wr on wr.staff_id = ts.id
  group by ts.id, ov.id, ov.staff_id, ov.override_date, ov.is_day_off,
    ov.shift_type, ov.start_time, ov.end_time, ov.ends_next_day,
    ov.reason, ov.created_by, ov.created_at
),
effective_windows as (
  select
    ov.staff_id,
    ov.id::text as source_id,
    coalesce(ov.shift_type, 'single') as shift_type,
    ov.start_time,
    ov.end_time,
    1::integer as window_order,
    coalesce(ov.ends_next_day, ov.end_time <= ov.start_time) as ends_next_day
  from date_overrides ov
  where ov.is_day_off = false
    and ov.start_time is not null
    and ov.end_time is not null
    and ov.start_time <> ov.end_time

  union all

  select
    wr.staff_id,
    wr.id::text,
    coalesce(wr.shift_type, 'single'),
    wr.start_time,
    wr.end_time,
    coalesce(wr.window_order, 1)::integer,
    coalesce(wr.ends_next_day, wr.end_time <= wr.start_time)
  from weekly_rows wr
  where wr.is_active = true
    and wr.start_time is not null
    and wr.end_time is not null
    and wr.start_time <> wr.end_time
    and not exists (select 1 from date_overrides ov where ov.staff_id = wr.staff_id)
),
window_instants as (
  select
    ew.*,
    ((p.business_date + ew.start_time)::timestamp at time zone p.business_timezone) as scheduled_start_at,
    (
      (p.business_date + case when ew.ends_next_day then 1 else 0 end + ew.end_time)::timestamp
      at time zone p.business_timezone
    ) as scheduled_end_at
  from effective_windows ew
  cross join params p
),
schedule_summary as (
  select
    wi.staff_id,
    min(wi.scheduled_start_at) as first_scheduled_start_at,
    max(wi.scheduled_end_at) as last_scheduled_end_at,
    min(wi.start_time) as first_start_time,
    (array_agg(wi.end_time order by wi.scheduled_end_at desc))[1] as last_end_time,
    bool_or(wi.ends_next_day) as overnight,
    count(*) as window_count,
    case
      when count(*) = 2
        and count(*) filter (where wi.shift_type = 'opening') = 1
        and count(*) filter (where wi.shift_type = 'closing') = 1
        and ts.system_role = 'crm'
      then 'open_close'
      when count(*) > 1 then 'split_shift'
      when bool_or(wi.ends_next_day) then 'overnight'
      else 'single'
    end as coverage_kind,
    jsonb_agg(
      jsonb_build_object(
        'sourceId', wi.source_id,
        'shiftType', wi.shift_type,
        'windowOrder', wi.window_order,
        'startTime', wi.start_time,
        'endTime', wi.end_time,
        'scheduledStartAt', wi.scheduled_start_at,
        'scheduledEndAt', wi.scheduled_end_at,
        'endsNextDay', wi.ends_next_day
      ) order by wi.scheduled_start_at
    ) as effective_windows
  from window_instants wi
  join target_staff ts on ts.id = wi.staff_id
  group by wi.staff_id, ts.system_role
),
today_records as (
  select distinct on (c.staff_id)
    c.*
  from public.staff_shift_checkins c
  join target_staff ts on ts.id = c.staff_id
  cross join params p
  where c.branch_id = p.branch_id
    and c.shift_date = p.business_date
    and c.is_test = false
  order by c.staff_id,
    (c.status = 'checked_in' and c.checked_out_at is null) desc,
    c.checked_in_at desc
),
day_scans as (
  select q.*
  from public.qr_scan_events q
  cross join params p
  where q.branch_id = p.branch_id
    and q.created_at >= p.business_start
    and q.created_at < p.business_end
    and q.is_test = false
),
scan_summary as (
  select
    q.staff_id,
    max(q.created_at) as last_scan_at,
    max(q.created_at) filter (where q.outcome = 'success') as last_valid_scan_at,
    (array_agg(q.action order by q.created_at desc))[1] as last_scan_action,
    (array_agg(q.outcome order by q.created_at desc))[1] as last_scan_outcome,
    (array_agg(q.reason_code order by q.created_at desc))[1] as last_scan_reason,
    jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'at', q.created_at,
        'action', q.action,
        'outcome', q.outcome,
        'reasonCode', q.reason_code,
        'checkinId', q.checkin_id,
        'qrPointId', q.qr_point_id,
        'deviceId', q.device_id,
        'message', q.message
      ) order by q.created_at
    ) as all_scan_attempts
  from day_scans q
  where q.staff_id is not null
  group by q.staff_id
),
exception_evidence as (
  select
    e.*,
    coalesce(
      nullif(e.metadata ->> 'internalExceptionType', ''),
      nullif(e.safe_error_code, ''),
      e.exception_type
    ) as effective_exception_type,
    (
      c.shift_date = p.business_date
      or (q.created_at >= p.business_start and q.created_at < p.business_end)
      or (e.detected_at >= p.business_start and e.detected_at < p.business_end)
    ) as relevant_to_business_date,
    not (
      lower(coalesce(
        nullif(e.metadata ->> 'internalExceptionType', ''),
        nullif(e.safe_error_code, ''),
        e.exception_type
      )) like any (array['%late%', '%early_leave%', '%early_clock%', '%overtime%', '%late_clock%'])
    ) as actionable
  from public.attendance_exceptions e
  cross join params p
  left join public.staff_shift_checkins c on c.id = e.checkin_id
  left join public.qr_scan_events q on q.id = coalesce(e.latest_scan_event_id, e.scan_event_id)
  where e.branch_id = p.branch_id
    and e.status = 'open'
    and e.is_test = false
),
exception_summary as (
  select
    e.staff_id,
    count(*) as all_open_exception_count,
    count(*) filter (where e.actionable) as all_actionable_count,
    count(*) filter (where e.relevant_to_business_date) as current_open_exception_count,
    count(*) filter (where e.relevant_to_business_date and e.actionable) as current_actionable_count,
    count(*) filter (where e.relevant_to_business_date and not e.actionable) as current_timing_only_count,
    string_agg(distinct e.exception_type, ', ' order by e.exception_type) as stored_exception_types,
    string_agg(distinct e.effective_exception_type, ', ' order by e.effective_exception_type) as effective_exception_types,
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'storedType', e.exception_type,
        'effectiveType', e.effective_exception_type,
        'detectedAt', e.detected_at,
        'checkinId', e.checkin_id,
        'scanEventId', e.scan_event_id,
        'resolutionStatus', e.resolution_status,
        'message', e.message,
        'relevantToBusinessDate', e.relevant_to_business_date,
        'actionable', e.actionable
      ) order by e.detected_at desc
    ) as open_exception_evidence
  from exception_evidence e
  where e.staff_id is not null
  group by e.staff_id
),
correction_summary as (
  select
    ac.staff_id,
    count(*) as correction_count,
    jsonb_agg(
      jsonb_build_object(
        'id', ac.id,
        'checkinId', ac.checkin_id,
        'exceptionId', ac.exception_id,
        'actionType', ac.action_type,
        'correctionType', ac.correction_type,
        'status', ac.status,
        'reason', ac.reason,
        'previousValues', ac.previous_values,
        'newValues', ac.new_values,
        'createdAt', ac.created_at,
        'appliedAt', ac.applied_at
      ) order by ac.created_at desc
    ) as corrections
  from public.attendance_corrections ac
  join target_staff ts on ts.id = ac.staff_id
  cross join params p
  where ac.branch_id = p.branch_id
    and ac.is_test = false
    and (ac.attendance_date = p.business_date or ac.checkin_id in (select id from today_records))
  group by ac.staff_id
),
device_summary as (
  select
    sd.staff_id,
    count(*) as device_count,
    count(*) filter (where sd.status = 'active') as active_device_count,
    max(sd.last_attendance_scan_at) as last_device_attendance_scan_at,
    jsonb_agg(
      jsonb_build_object(
        'id', sd.id,
        'status', sd.status,
        'deviceLabel', sd.device_label,
        'branchId', sd.branch_id,
        'lastSeenAt', sd.last_seen_at,
        'lastAttendanceScanAt', sd.last_attendance_scan_at,
        'securityState', sd.security_state
      ) order by sd.created_at desc
    ) as devices
  from public.staff_devices sd
  join target_staff ts on ts.id = sd.staff_id
  group by sd.staff_id
),
service_state as (
  select
    b.staff_id,
    count(*) filter (
      where b.booking_progress_status = 'session_started'
        and b.session_completed_at is null
    ) as active_service_count,
    jsonb_agg(
      jsonb_build_object(
        'bookingId', b.id,
        'progressStatus', b.booking_progress_status,
        'sessionStartedAt', b.session_started_at,
        'sessionCompletedAt', b.session_completed_at
      ) order by b.session_started_at desc
    ) filter (
      where b.booking_progress_status = 'session_started'
        and b.session_completed_at is null
    ) as active_services
  from public.bookings b
  join target_staff ts on ts.id = b.staff_id
  cross join params p
  where b.branch_id = p.branch_id
    and b.booking_date = p.business_date
  group by b.staff_id
),
diagnosis as (
  select
    ts.id as staff_id,
    ts.normalized_name,
    ts.full_name,
    u.email,
    ts.phone,
    ts.auth_user_id,
    coalesce(ts.metadata ->> 'staff_code', ts.metadata ->> 'employee_code') as staff_code,
    ts.is_active,
    ts.staff_type,
    ts.system_role,
    ts.created_at as profile_created_at,
    ts.branch_id as profile_branch_id,
    profile_branch.name as profile_branch_name,
    cb.effective_branch_id,
    effective_branch.name as effective_branch_name,
    cb.source as effective_branch_source,
    cb.allowed as expected_at_selected_branch,
    ss.schedule_source,
    ss.schedule_status,
    'not_used_by_canonical_runtime'::text as group_schedule_source,
    ss.schedule_override,
    sch.effective_windows,
    sch.coverage_kind,
    sch.first_scheduled_start_at,
    sch.last_scheduled_end_at,
    sch.overnight,
    bc.late_grace_minutes,
    jsonb_build_object(
      'timezone', bc.timezone,
      'attendanceDayBoundary', bc.attendance_day_boundary,
      'clockInBeforeMinutes', bc.clock_in_window_before_shift_minutes,
      'clockInAfterMinutes', bc.clock_in_window_after_shift_start_minutes,
      'clockOutBeforeMinutes', bc.clock_out_window_before_shift_end_minutes,
      'clockOutAfterMinutes', bc.clock_out_window_after_shift_end_minutes,
      'earlyLeaveThresholdMinutes', bc.early_leave_threshold_minutes,
      'overtimeThresholdMinutes', bc.overtime_threshold_minutes,
      'activeServiceBlocksClockOut', bc.active_service_blocks_clock_out
    ) as timing_rules,
    tr.id as attendance_record_id,
    tr.status as attendance_record_status,
    tr.attendance_status,
    tr.exception_state as attendance_exception_state,
    tr.checked_in_at as clock_in_at,
    tr.checked_out_at as clock_out_at,
    tr.scheduled_start_at as stored_scheduled_start_at,
    tr.scheduled_end_at as stored_scheduled_end_at,
    tr.schedule_source as stored_schedule_source,
    tr.schedule_source_id as stored_schedule_source_id,
    tr.clock_in_scan_event_id,
    tr.clock_out_scan_event_id,
    tr.worked_minutes,
    tr.late_minutes,
    tr.early_leave_minutes,
    tr.overtime_minutes,
    scans.last_valid_scan_at,
    scans.last_scan_at,
    scans.last_scan_action,
    scans.last_scan_outcome,
    scans.last_scan_reason,
    scans.all_scan_attempts,
    ex.all_open_exception_count,
    ex.all_actionable_count,
    ex.current_open_exception_count,
    ex.current_actionable_count,
    ex.current_timing_only_count,
    ex.stored_exception_types,
    ex.effective_exception_types,
    ex.open_exception_evidence,
    corr.correction_count,
    corr.corrections,
    dev.device_count,
    dev.active_device_count,
    dev.last_device_attendance_scan_at,
    dev.devices,
    svc.active_service_count,
    svc.active_services,
    coalesce(dupe.profile_count, 1) as normalized_name_profile_count,
    case
      -- Current UI: any all-time exception whose stored type is not timing-only
      -- makes the staff member Needs review, even when it belongs to another day.
      when exists (
        select 1 from exception_evidence old_e
        where old_e.staff_id = ts.id
          and not (
            lower(old_e.exception_type) like any (
              array['%late%', '%early_leave%', '%early_clock%', '%overtime%', '%late_clock%']
            )
          )
      ) then 'Needs review'
      when tr.id is not null and tr.checked_out_at is null and tr.status = 'checked_in' then 'Working'
      when tr.id is not null and (tr.checked_out_at is not null or tr.status = 'checked_out') then 'Completed'
      when ss.schedule_status = 'resolved'
        and now() between sch.first_scheduled_start_at and sch.last_scheduled_end_at
        and now() > sch.first_scheduled_start_at + make_interval(mins => bc.late_grace_minutes)
      then 'Late'
      when ss.schedule_status = 'resolved'
        and now() < sch.first_scheduled_start_at
      then 'Not in yet'
      else 'Not expected today'
    end as current_crm_status,
    case
      when exists (
        select 1 from exception_evidence current_e
        where current_e.staff_id = ts.id
          and current_e.relevant_to_business_date
          and current_e.actionable
          and lower(current_e.effective_exception_type) like '%wrong_branch%'
      ) then 'Wrong branch'
      when coalesce(ex.current_actionable_count, 0) > 0 then 'Needs review'
      when tr.id is not null and tr.checked_out_at is null and tr.status = 'checked_in' then 'Working'
      when tr.id is not null and (tr.checked_out_at is not null or tr.status = 'checked_out') then 'Completed'
      when ss.schedule_status = 'resolved'
        and cb.allowed
        and now() > sch.first_scheduled_start_at + make_interval(mins => bc.late_grace_minutes)
      then 'Late'
      when ss.schedule_status = 'resolved'
        and cb.allowed
        and now() <= sch.first_scheduled_start_at + make_interval(mins => bc.late_grace_minutes)
      then 'Not in yet'
      else 'Not expected today'
    end as expected_correct_status,
    case
      when coalesce(dupe.profile_count, 1) > 1 then 'possible_duplicate_profile'
      when ts.full_name = 'Codex QA Work Queue'
        and u.email like '%@example.test' then 'confirmed_test_profile_in_monitoring'
      when coalesce(ex.current_actionable_count, 0) > 0 then 'current_actionable_exception'
      when tr.id is not null
        and sch.coverage_kind = 'open_close'
        and tr.scheduled_start_at = sch.first_scheduled_start_at
        and tr.scheduled_end_at = sch.last_scheduled_end_at
      then 'open_close_ui_window_mismatch'
      when coalesce(ex.current_timing_only_count, 0) > 0
        and coalesce(ex.current_actionable_count, 0) = 0 then 'timing_only_exception_not_actionable'
      when coalesce(ex.all_actionable_count, 0) > 0
        and coalesce(ex.current_actionable_count, 0) = 0 then 'historical_exception_leaks_into_today'
      when ss.schedule_status = 'resolved'
        and cb.allowed
        and tr.id is null
        and now() > sch.last_scheduled_end_at then 'completed_shift_without_scan_misclassified'
      when ss.schedule_status in ('missing', 'day_off')
        and tr.id is null
        and scans.last_scan_at is null then 'no_attendance_activity_not_a_system_error'
      else 'no_proven_system_error'
    end as root_cause_category,
    case
      when ts.full_name = 'Codex QA Work Queue'
        and u.email like '%@example.test' then 'yes_code_and_targeted_metadata'
      when tr.id is not null and sch.coverage_kind = 'open_close' then 'yes_code_only'
      when coalesce(ex.current_timing_only_count, 0) > 0
        and coalesce(ex.current_actionable_count, 0) = 0 then 'yes_code_only'
      when coalesce(ex.all_actionable_count, 0) > 0
        and coalesce(ex.current_actionable_count, 0) = 0 then 'yes_code_only'
      when ss.schedule_status = 'resolved'
        and cb.allowed
        and tr.id is null
        and now() > sch.last_scheduled_end_at then 'yes_code_only'
      else 'no'
    end as safe_automatic_fix_available,
    case
      when coalesce(dupe.profile_count, 1) > 1 then 'Confirm identity before any merge or deactivation.'
      when coalesce(ex.current_actionable_count, 0) > 0 then 'Review the linked scan/check-in evidence; do not invent attendance.'
      when ts.full_name = 'Codex QA Work Queue'
        and u.email like '%@example.test' then 'Mark as test metadata after the idempotent backup migration is approved.'
      when ss.schedule_status in ('missing', 'day_off')
        and tr.id is null
        and scans.last_scan_at is null then 'No Attendance correction; confirm schedule only if the staff member was expected.'
      else 'No manual Attendance change required.'
    end as recommended_manual_action
  from target_staff ts
  cross join branch_context bc
  left join auth.users u on u.id = ts.auth_user_id
  left join public.branches profile_branch on profile_branch.id = ts.branch_id
  left join canonical_branch cb on cb.staff_id = ts.id
  left join public.branches effective_branch on effective_branch.id = cb.effective_branch_id
  left join schedule_state ss on ss.staff_id = ts.id
  left join schedule_summary sch on sch.staff_id = ts.id
  left join today_records tr on tr.staff_id = ts.id
  left join scan_summary scans on scans.staff_id = ts.id
  left join exception_summary ex on ex.staff_id = ts.id
  left join correction_summary corr on corr.staff_id = ts.id
  left join device_summary dev on dev.staff_id = ts.id
  left join service_state svc on svc.staff_id = ts.id
  left join duplicate_names dupe on dupe.normalized_name = ts.normalized_name
)
select *
from diagnosis
order by lower(full_name), profile_created_at;

-- Unknown-staff scan attempts cannot appear in a staff-keyed result.
with params as (
  select
    'c1000000-0000-0000-0000-000000000001'::uuid as branch_id,
    timestamptz '2026-07-22 06:00:00+08' as business_start,
    timestamptz '2026-07-23 06:00:00+08' as business_end
)
select
  q.id,
  q.created_at,
  q.action,
  q.outcome,
  q.reason_code,
  q.message,
  q.qr_point_id,
  q.device_id,
  q.operation_id
from public.qr_scan_events q
cross join params p
where q.branch_id = p.branch_id
  and q.created_at >= p.business_start
  and q.created_at < p.business_end
  and q.is_test = false
  and q.staff_id is null
order by q.created_at;

-- Exact database baseline counts. The CRM Review count is derived in code and
-- must be compared with the canonical deduplicated queue, not this raw count.
with params as (
  select
    'c1000000-0000-0000-0000-000000000001'::uuid as branch_id,
    date '2026-07-22' as business_date,
    timestamptz '2026-07-22 06:00:00+08' as business_start,
    timestamptz '2026-07-23 06:00:00+08' as business_end
)
select
  (select count(*) from public.staff s
    where s.branch_id = p.branch_id and s.is_active
      and s.archived_at is null and s.merged_into_staff_id is null) as visible_staff_profiles,
  (select count(*) from public.staff_shift_checkins c
    where c.branch_id = p.branch_id and c.shift_date = p.business_date and not c.is_test) as attendance_records,
  (select count(*) from public.qr_scan_events q
    where q.branch_id = p.branch_id and q.created_at >= p.business_start
      and q.created_at < p.business_end and not q.is_test) as scan_events,
  (select count(*) from public.attendance_exceptions e
    where e.branch_id = p.branch_id and e.status = 'open' and not e.is_test) as raw_open_exceptions,
  (select count(*) from public.attendance_corrections ac
    where ac.branch_id = p.branch_id and ac.attendance_date = p.business_date and not ac.is_test) as corrections
from params p;

rollback;
