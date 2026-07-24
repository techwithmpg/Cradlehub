-- Attendance Review: resolve a durable saved scan without fabricating a time.
--
-- CRM may apply only the timestamp already stored in qr_scan_events. The
-- function is idempotent, resolves related open incidents, and writes one
-- attendance_corrections audit row in the same transaction.

create or replace function public.resolve_attendance_scan_review_transaction(
  p_branch_id uuid,
  p_actor_staff_id uuid,
  p_exception_id uuid,
  p_resolution text,
  p_reason text,
  p_attendance_date date,
  p_shift_type text default 'single',
  p_scheduled_start_at timestamptz default null,
  p_scheduled_end_at timestamptz default null,
  p_timezone text default 'Asia/Manila',
  p_is_test boolean default false
)
returns table (
  success boolean,
  code text,
  message text,
  checkin_id uuid,
  correction_id uuid
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_exception public.attendance_exceptions%rowtype;
  v_scan public.qr_scan_events%rowtype;
  v_checkin public.staff_shift_checkins%rowtype;
  v_settings public.attendance_settings%rowtype;
  v_scan_event_id uuid;
  v_checkin_id uuid;
  v_correction_id uuid;
  v_home_branch_id uuid;
  v_worked_minutes integer := 0;
  v_late_minutes integer := 0;
  v_early_leave_minutes integer := 0;
  v_overtime_minutes integer := 0;
  v_attendance_status text := 'present';
  v_resolved_count integer := 0;
begin
  if p_branch_id is null
    or p_actor_staff_id is null
    or p_exception_id is null
    or p_attendance_date is null
  then
    return query
      select false, 'invalid_request', 'Branch, CRM actor, issue, and attendance date are required.', null::uuid, null::uuid;
    return;
  end if;

  if p_resolution not in ('clock_in', 'clock_out') then
    return query
      select false, 'invalid_resolution', 'Choose whether the saved scan is clock-in or clock-out.', null::uuid, null::uuid;
    return;
  end if;

  if p_shift_type not in ('single', 'opening', 'closing') then
    return query
      select false, 'invalid_shift_type', 'Choose a valid shift type.', null::uuid, null::uuid;
    return;
  end if;

  if v_reason is null then
    return query
      select false, 'reason_required', 'Enter a reason before applying the saved scan.', null::uuid, null::uuid;
    return;
  end if;

  select exception_row.*
    into v_exception
  from public.attendance_exceptions as exception_row
  where exception_row.id = p_exception_id
    and exception_row.branch_id = p_branch_id
  for update;

  if not found then
    return query
      select false, 'issue_not_found', 'Attendance issue was not found for this branch.', null::uuid, null::uuid;
    return;
  end if;

  if v_exception.status <> 'open' then
    select correction_row.checkin_id, correction_row.id
      into v_checkin_id, v_correction_id
    from public.attendance_corrections as correction_row
    where correction_row.exception_id = v_exception.id
      and correction_row.status = 'applied'
    order by correction_row.created_at desc
    limit 1;

    return query
      select true, 'already_resolved', 'This Attendance issue was already resolved.', v_checkin_id, v_correction_id;
    return;
  end if;

  if v_exception.staff_id is null then
    return query
      select false, 'staff_missing', 'The saved scan is not linked to a staff member.', null::uuid, null::uuid;
    return;
  end if;

  v_scan_event_id := coalesce(v_exception.scan_event_id, v_exception.latest_scan_event_id);
  if v_scan_event_id is null then
    return query
      select false, 'scan_missing', 'No durable scan event is linked to this issue.', null::uuid, null::uuid;
    return;
  end if;

  select scan_row.*
    into v_scan
  from public.qr_scan_events as scan_row
  where scan_row.id = v_scan_event_id
  for update;

  if not found
    or v_scan.scan_type <> 'attendance'
    or v_scan.staff_id is distinct from v_exception.staff_id
    or (v_scan.branch_id is not null and v_scan.branch_id <> p_branch_id)
  then
    return query
      select false, 'scan_mismatch', 'The saved scan does not match this staff member and branch.', null::uuid, null::uuid;
    return;
  end if;

  select checkin_row.*
    into v_checkin
  from public.staff_shift_checkins as checkin_row
  where checkin_row.branch_id = p_branch_id
    and checkin_row.staff_id = v_exception.staff_id
    and checkin_row.is_test = p_is_test
    and checkin_row.status <> 'voided'
    and (
      checkin_row.clock_in_scan_event_id = v_scan.id
      or checkin_row.clock_out_scan_event_id = v_scan.id
    )
  order by checkin_row.created_at desc
  limit 1
  for update;

  if found then
    update public.attendance_exceptions
       set status = 'resolved',
           resolution_status = 'resolved',
           resolution_action = 'accept_recorded_attendance',
           resolution_note = v_reason,
           resolved_at = v_now,
           resolved_by = p_actor_staff_id,
           updated_at = v_now
     where id = v_exception.id;

    return query
      select true, 'already_applied', 'This saved scan was already applied to Attendance.', v_checkin.id, null::uuid;
    return;
  end if;

  select staff_row.branch_id
    into v_home_branch_id
  from public.staff as staff_row
  where staff_row.id = v_exception.staff_id;

  select settings_row.*
    into v_settings
  from public.attendance_settings as settings_row
  where settings_row.branch_id = p_branch_id;

  if p_resolution = 'clock_in' then
    select checkin_row.*
      into v_checkin
    from public.staff_shift_checkins as checkin_row
    where checkin_row.branch_id = p_branch_id
      and checkin_row.staff_id = v_exception.staff_id
      and checkin_row.attendance_business_date = p_attendance_date
      and checkin_row.is_test = p_is_test
      and checkin_row.status <> 'voided'
    order by checkin_row.created_at desc
    limit 1
    for update;

    if found then
      return query
        select false, 'record_exists', 'Attendance already exists for this staff member and date. Use Correct attendance instead.', v_checkin.id, null::uuid;
      return;
    end if;

    insert into public.staff_shift_checkins (
      staff_id,
      branch_id,
      shift_date,
      shift_type,
      checked_in_at,
      checked_out_at,
      status,
      recorded_by,
      notes,
      scheduled_start_at,
      scheduled_end_at,
      clock_in_method,
      clock_in_scan_event_id,
      source_qr_point_id,
      attendance_status,
      exception_state,
      worked_minutes,
      late_minutes,
      early_leave_minutes,
      overtime_minutes,
      is_test,
      shift_instance_key,
      schedule_source,
      branch_timezone,
      attendance_business_date,
      attendance_policy_source,
      attendance_policy_snapshot,
      home_branch_id
    )
    values (
      v_exception.staff_id,
      p_branch_id,
      p_attendance_date,
      p_shift_type,
      v_scan.created_at,
      null,
      'checked_in',
      p_actor_staff_id,
      v_reason,
      p_scheduled_start_at,
      p_scheduled_end_at,
      'manual_review',
      v_scan.id,
      v_scan.qr_point_id,
      case
        when p_scheduled_start_at is not null
          and v_scan.created_at > p_scheduled_start_at
            + make_interval(mins => coalesce(v_settings.late_grace_minutes, 0))
          then 'late'
        else 'present'
      end,
      'none',
      0,
      case
        when p_scheduled_start_at is not null
          then greatest(
            0,
            floor(
              extract(epoch from (
                v_scan.created_at
                - p_scheduled_start_at
                - make_interval(mins => coalesce(v_settings.late_grace_minutes, 0))
              )) / 60
            )::integer
          )
        else 0
      end,
      0,
      0,
      p_is_test,
      concat_ws(
        '|',
        'review',
        v_exception.staff_id::text,
        p_branch_id::text,
        p_attendance_date::text,
        v_scan.id::text
      ),
      'recovery',
      coalesce(nullif(p_timezone, ''), 'Asia/Manila'),
      p_attendance_date,
      'schedule',
      jsonb_build_object(
        'source', 'crm_review_saved_scan',
        'exceptionId', v_exception.id,
        'scanEventId', v_scan.id
      ),
      v_home_branch_id
    )
    returning id into v_checkin_id;
  else
    select checkin_row.*
      into v_checkin
    from public.staff_shift_checkins as checkin_row
    where checkin_row.branch_id = p_branch_id
      and checkin_row.staff_id = v_exception.staff_id
      and checkin_row.is_test = p_is_test
      and checkin_row.status = 'checked_in'
      and checkin_row.checked_out_at is null
    order by checkin_row.checked_in_at desc
    limit 1
    for update;

    if not found then
      return query
        select false, 'open_record_missing', 'No open attendance record exists. Choose clock-in or create today’s schedule first.', null::uuid, null::uuid;
      return;
    end if;

    if v_scan.created_at <= v_checkin.checked_in_at then
      return query
        select false, 'invalid_clock_out', 'The saved scan happened before the current clock-in and cannot be used as clock-out.', v_checkin.id, null::uuid;
      return;
    end if;

    v_worked_minutes := greatest(
      0,
      floor(extract(epoch from (v_scan.created_at - v_checkin.checked_in_at)) / 60)::integer
    );

    if v_checkin.scheduled_start_at is not null then
      v_late_minutes := greatest(
        0,
        floor(
          extract(epoch from (
            v_checkin.checked_in_at
            - v_checkin.scheduled_start_at
            - make_interval(mins => coalesce(v_settings.late_grace_minutes, 0))
          )) / 60
        )::integer
      );
    end if;

    if v_checkin.scheduled_end_at is not null then
      v_early_leave_minutes := greatest(
        0,
        floor(
          extract(epoch from (
            v_checkin.scheduled_end_at
            - v_scan.created_at
            - make_interval(mins => coalesce(v_settings.early_leave_threshold_minutes, 0))
          )) / 60
        )::integer
      );
      v_overtime_minutes := greatest(
        0,
        floor(
          extract(epoch from (
            v_scan.created_at
            - v_checkin.scheduled_end_at
            - make_interval(mins => coalesce(v_settings.overtime_threshold_minutes, 0))
          )) / 60
        )::integer
      );
    end if;

    v_attendance_status := case
      when v_early_leave_minutes > 0 then 'early_leave'
      when v_overtime_minutes > 0 then 'overtime'
      when v_late_minutes > 0 then 'late'
      else 'present'
    end;

    update public.staff_shift_checkins
       set checked_out_at = v_scan.created_at,
           status = 'checked_out',
           clock_out_method = 'manual_review',
           clock_out_scan_event_id = v_scan.id,
           worked_minutes = v_worked_minutes,
           late_minutes = v_late_minutes,
           early_leave_minutes = v_early_leave_minutes,
           overtime_minutes = v_overtime_minutes,
           attendance_status = v_attendance_status,
           exception_state = 'none',
           actual_clock_out_reconciled_at = v_now,
           updated_at = v_now
     where id = v_checkin.id
     returning id into v_checkin_id;
  end if;

  with resolved as (
    update public.attendance_exceptions
       set status = 'resolved',
           resolution_status = 'resolved',
           resolution_action = case
             when p_resolution = 'clock_in' then 'set_manual_clock_in'
             else 'set_manual_clock_out'
           end,
           resolution_note = v_reason,
           resolved_at = v_now,
           resolved_by = p_actor_staff_id,
           updated_at = v_now
     where branch_id = p_branch_id
       and status = 'open'
       and staff_id = v_exception.staff_id
       and (
         id = v_exception.id
         or scan_event_id = v_scan.id
         or latest_scan_event_id = v_scan.id
         or checkin_id = v_checkin_id
       )
     returning id
  )
  select count(*)::integer
    into v_resolved_count
  from resolved;

  insert into public.attendance_corrections (
    branch_id,
    staff_id,
    checkin_id,
    exception_id,
    attendance_date,
    correction_type,
    action_type,
    scan_event_ids,
    previous_values,
    new_values,
    reason,
    status,
    requested_by,
    approved_by,
    corrected_by,
    applied_at,
    corrected_at,
    is_test
  )
  values (
    p_branch_id,
    v_exception.staff_id,
    v_checkin_id,
    v_exception.id,
    p_attendance_date,
    case
      when p_resolution = 'clock_in' then 'set_manual_clock_in'
      else 'set_manual_clock_out'
    end,
    case
      when p_resolution = 'clock_in' then 'set_manual_clock_in'
      else 'set_manual_clock_out'
    end,
    jsonb_build_array(v_scan.id),
    jsonb_build_object(
      'exception', to_jsonb(v_exception),
      'scanEvent', to_jsonb(v_scan)
    ),
    jsonb_build_object(
      'resolution', p_resolution,
      'checkinId', v_checkin_id,
      'scanTime', v_scan.created_at,
      'resolvedOpenIncidentCount', v_resolved_count
    ),
    v_reason,
    'applied',
    p_actor_staff_id,
    p_actor_staff_id,
    p_actor_staff_id,
    v_now,
    v_now,
    p_is_test
  )
  returning id into v_correction_id;

  return query
    select
      true,
      'committed',
      case
        when p_resolution = 'clock_in' then 'Saved scan recorded as clock-in.'
        else 'Saved scan recorded as clock-out.'
      end,
      v_checkin_id,
      v_correction_id;
end;
$$;

revoke all on function public.resolve_attendance_scan_review_transaction(
  uuid, uuid, uuid, text, text, date, text, timestamptz, timestamptz, text, boolean
) from public, anon, authenticated;

grant execute on function public.resolve_attendance_scan_review_transaction(
  uuid, uuid, uuid, text, text, date, text, timestamptz, timestamptz, text, boolean
) to service_role;

comment on function public.resolve_attendance_scan_review_transaction(
  uuid, uuid, uuid, text, text, date, text, timestamptz, timestamptz, text, boolean
) is
  'CRM-only atomic resolution of a durable Attendance scan into clock-in or clock-out, with linked incident resolution and correction audit.';
