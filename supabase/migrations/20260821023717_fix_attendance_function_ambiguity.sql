-- Qualify attendance table columns that collide with PL/pgSQL output variables.
-- This preserves function signatures and behavior while making resolution deterministic.

begin;

create or replace function public.reconcile_provisional_attendance_clock_out(
  p_request_id text,
  p_checkin_id uuid,
  p_branch_id uuid,
  p_staff_id uuid,
  p_qr_point_id uuid,
  p_device_id uuid,
  p_actual_clock_out_at timestamptz,
  p_public_result jsonb,
  p_user_agent text default null,
  p_ip_address text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_is_test boolean default false
)
returns table (
  success boolean,
  code text,
  scan_event_id uuid,
  checkin_id uuid,
  operation_result jsonb,
  message text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_checkin public.staff_shift_checkins%rowtype;
  v_existing_event public.qr_scan_events%rowtype;
  v_event_id uuid;
  v_exception_id uuid;
  v_result jsonb := coalesce(p_public_result, '{}'::jsonb);
  v_worked integer;
  v_early integer := 0;
  v_overtime integer := 0;
  v_status text;
  v_ip inet;
  v_boundary time;
  v_actual_business_date date;
begin
  if p_request_id is null or p_checkin_id is null or p_actual_clock_out_at is null then
    return query select false, 'invalid_request', null::uuid, p_checkin_id, null::jsonb, 'Reconciliation identity and actual time are required.';
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('attendance_scan_request'), hashtext(p_request_id));
  perform pg_advisory_xact_lock(hashtext('attendance_scan_staff'), hashtext(concat_ws(':', p_branch_id, p_staff_id, p_is_test)));

  select * into v_existing_event
  from public.qr_scan_events where request_id = p_request_id
  order by created_at limit 1 for update;
  if found and v_existing_event.operation_result is not null then
    return query select true, 'replayed', v_existing_event.id, v_existing_event.checkin_id,
      v_existing_event.operation_result, 'Reconciled scan result replayed.';
    return;
  end if;

  select * into v_checkin
  from public.staff_shift_checkins
  where id = p_checkin_id and branch_id = p_branch_id and staff_id = p_staff_id
    and is_test = p_is_test
  for update;

  if not found or v_checkin.status <> 'checked_out'
     or v_checkin.clock_out_method <> 'system_auto_close'
     or v_checkin.clock_out_confirmation_required is not true then
    return query select false, 'provisional_checkin_not_found', null::uuid, p_checkin_id, null::jsonb,
      'The provisional Attendance record is no longer awaiting confirmation.';
    return;
  end if;

  v_boundary := coalesce(
    nullif(v_checkin.attendance_policy_snapshot->>'attendanceDayBoundary', '')::time,
    '06:00:00'::time
  );
  v_actual_business_date := (p_actual_clock_out_at at time zone coalesce(
    v_checkin.attendance_policy_snapshot->>'timezone',
    v_checkin.branch_timezone,
    'Asia/Manila'
  ))::date;
  if (p_actual_clock_out_at at time zone coalesce(
    v_checkin.attendance_policy_snapshot->>'timezone',
    v_checkin.branch_timezone,
    'Asia/Manila'
  ))::time < v_boundary then
    v_actual_business_date := v_actual_business_date - 1;
  end if;
  if v_actual_business_date <> coalesce(v_checkin.attendance_business_date, v_checkin.shift_date) then
    return query select false, 'outside_attendance_business_day', null::uuid, p_checkin_id, null::jsonb,
      'The real QR scan is outside the provisional Attendance business day and requires review.';
    return;
  end if;

  begin
    v_ip := nullif(trim(split_part(coalesce(p_ip_address, ''), ',', 1)), '')::inet;
  exception when others then
    v_ip := null;
  end;

  insert into public.qr_scan_events (
    branch_id, qr_point_id, staff_id, device_id, checkin_id, scan_type,
    action, outcome, reason_code, message, request_id, operation_id,
    user_agent, ip_address, metadata, is_test
  ) values (
    p_branch_id, p_qr_point_id, p_staff_id, p_device_id, p_checkin_id, 'attendance',
    'clock_out_reconciled', 'success', 'provisional_clock_out_reconciled',
    'Actual QR clock-out replaced the provisional system auto-close.',
    p_request_id, p_request_id, p_user_agent, v_ip,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'provisionalClockOutAt', v_checkin.checked_out_at,
      'actualClockOutAt', p_actual_clock_out_at
    ), p_is_test
  ) returning id into v_event_id;

  v_worked := greatest(0, round(extract(epoch from (p_actual_clock_out_at - v_checkin.checked_in_at)) / 60.0)::integer);
  if v_checkin.earliest_normal_clock_out_at is not null
     and p_actual_clock_out_at < v_checkin.earliest_normal_clock_out_at then
    v_early := round(extract(epoch from (v_checkin.earliest_normal_clock_out_at - p_actual_clock_out_at)) / 60.0)::integer;
  end if;
  if v_checkin.latest_normal_clock_out_at is not null
     and p_actual_clock_out_at > v_checkin.latest_normal_clock_out_at then
    v_overtime := round(extract(epoch from (p_actual_clock_out_at - v_checkin.latest_normal_clock_out_at)) / 60.0)::integer;
  end if;
  v_status := case
    when v_checkin.late_minutes > 0 then 'late'
    when v_early > 0 then 'early_leave'
    when v_overtime > 0 then 'overtime'
    else 'present'
  end;

  select attendance_exception.id into v_exception_id
  from public.attendance_exceptions as attendance_exception
  where attendance_exception.checkin_id = p_checkin_id
    and attendance_exception.status = 'open'
    and (
      attendance_exception.metadata->>'internalExceptionType' = 'missing_clock_out'
      or attendance_exception.exception_type = 'missed_checkout'
    )
  order by attendance_exception.created_at desc
  limit 1
  for update;

  update public.staff_shift_checkins
  set checked_out_at = p_actual_clock_out_at,
      clock_out_method = 'qr',
      clock_out_scan_event_id = v_event_id,
      worked_minutes = v_worked,
      early_leave_minutes = v_early,
      overtime_minutes = v_overtime,
      attendance_status = v_status,
      exception_state = case when late_minutes > 0 or v_early > 0 or v_overtime > 0 then 'open' else 'none' end,
      clock_out_confirmation_required = false,
      actual_clock_out_reconciled_at = v_now,
      notes = null,
      updated_at = v_now
  where id = p_checkin_id;

  if v_exception_id is not null then
    update public.attendance_exceptions
    set status = 'resolved', resolution_status = 'resolved',
        resolution_action = 'actual_qr_reconciliation',
        resolution_note = 'A real QR clock-out replaced the provisional system auto-close.',
        resolved_at = v_now, updated_at = v_now, latest_scan_event_id = v_event_id
    where id = v_exception_id;
  end if;

  if v_early > 0 or v_overtime > 0 then
    insert into public.attendance_exceptions (
      branch_id, staff_id, checkin_id, scan_event_id, latest_scan_event_id,
      exception_type, severity, message, metadata, dedupe_key,
      recommended_action, priority, related_checkin_ids
    ) values (
      p_branch_id, p_staff_id, p_checkin_id, v_event_id, v_event_id,
      case when v_early > 0 then 'early_leave' else 'overtime' end,
      'warning',
      case
        when v_early > 0 then format('Actual QR clock-out was %s minutes before the normal closing window.', v_early)
        else format('Actual QR clock-out was %s minutes after the normal closing window.', v_overtime)
      end,
      jsonb_build_object(
        'internalExceptionType', case when v_early > 0 then 'early_clock_out' else 'overtime_clock_out' end,
        'earlyLeaveMinutes', v_early,
        'overtimeMinutes', v_overtime,
        'reconciledFromProvisional', true
      ),
      concat_ws('|', p_staff_id, p_checkin_id,
        case when v_early > 0 then 'early_clock_out' else 'overtime_clock_out' end,
        case when p_is_test then 'test' else 'live' end),
      'review_clock_out', 'normal', array[p_checkin_id]
    );
  end if;

  insert into public.attendance_corrections (
    branch_id, staff_id, checkin_id, exception_id, attendance_date,
    correction_type, action_type, previous_values, new_values, reason,
    status, scan_event_ids, applied_at, corrected_at, is_test
  ) values (
    p_branch_id, p_staff_id, p_checkin_id, v_exception_id,
    coalesce(v_checkin.attendance_business_date, v_checkin.shift_date),
    'reconcile_provisional_clock_out', 'reconcile_provisional_clock_out',
    jsonb_build_object('checkedOutAt', v_checkin.checked_out_at, 'clockOutMethod', v_checkin.clock_out_method, 'confirmationRequired', true),
    jsonb_build_object('checkedOutAt', p_actual_clock_out_at, 'clockOutMethod', 'qr', 'scanEventId', v_event_id),
    'A real QR scan replaced the provisional system auto-close.', 'applied',
    jsonb_build_array(v_event_id), v_now, v_now, p_is_test
  );

  update public.staff_devices
  set last_seen_at = v_now, last_attendance_scan_at = v_now, updated_at = v_now
  where id = p_device_id;

  v_result := v_result || jsonb_build_object('scanEventId', v_event_id::text);
  if v_result ? 'attendance' then
    v_result := jsonb_set(v_result, '{attendance,attendanceId}', to_jsonb(p_checkin_id::text), true);
  end if;
  update public.qr_scan_events
  set operation_result = v_result, operation_result_recorded_at = v_now
  where id = v_event_id;

  return query select true, 'committed', v_event_id, p_checkin_id, v_result,
    'Provisional clock-out reconciled with the actual QR scan.';
end;
$$;

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
     where attendance_exceptions.branch_id = p_branch_id
       and attendance_exceptions.status = 'open'
       and attendance_exceptions.staff_id = v_exception.staff_id
       and (
         attendance_exceptions.id = v_exception.id
         or attendance_exceptions.scan_event_id = v_scan.id
         or attendance_exceptions.latest_scan_event_id = v_scan.id
         or attendance_exceptions.checkin_id = v_checkin_id
       )
     returning attendance_exceptions.id
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

create or replace function public.reset_attendance_state_transaction(
  p_branch_id uuid,
  p_checkin_id uuid,
  p_actor_staff_id uuid,
  p_reason text,
  p_reset_mode text default 'next_scan_state',
  p_is_test boolean default false
)
returns table (
  success boolean,
  code text,
  message text,
  staff_id uuid,
  checkin_id uuid,
  attendance_date date,
  next_expected_action text,
  resolved_exception_count integer,
  correction_id uuid
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_reset_mode text := coalesce(nullif(trim(p_reset_mode), ''), 'next_scan_state');
  v_checkin public.staff_shift_checkins%rowtype;
  v_next_expected_action text;
  v_resolved_count integer := 0;
  v_correction_id uuid;
  v_open_checkin_id uuid;
begin
  if p_branch_id is null or p_checkin_id is null then
    return query select false, 'invalid_request', 'Choose one attendance record before resetting state.', null::uuid, p_checkin_id, null::date, null::text, 0, null::uuid;
    return;
  end if;

  if v_reason is null then
    return query select false, 'reason_required', 'Enter a reason before resetting attendance state.', null::uuid, p_checkin_id, null::date, null::text, 0, null::uuid;
    return;
  end if;

  if v_reset_mode not in ('next_scan_state', 'void_incorrect_attendance') then
    return query select false, 'unsupported_reset_mode', 'Use the dedicated manual or rebuild action after reviewing raw scan evidence.', null::uuid, p_checkin_id, null::date, null::text, 0, null::uuid;
    return;
  end if;

  select checkin_row.*
    into v_checkin
  from public.staff_shift_checkins as checkin_row
  where checkin_row.id = p_checkin_id
    and checkin_row.branch_id = p_branch_id
    and checkin_row.is_test = p_is_test
  for update;

  if not found then
    return query select false, 'not_found', 'Attendance record was not found for this branch.', null::uuid, p_checkin_id, null::date, null::text, 0, null::uuid;
    return;
  end if;

  if v_checkin.status = 'voided' then
    return query select false, 'already_reset', 'Attendance record was already reset.', v_checkin.staff_id, v_checkin.id, v_checkin.shift_date, 'clock_in', 0, null::uuid;
    return;
  end if;

  update public.staff_shift_checkins
     set status = 'voided',
         exception_state = 'none',
         notes = v_reason,
         updated_at = v_now
   where id = v_checkin.id;

  with resolved as (
    update public.attendance_exceptions
       set status = 'resolved',
           resolved_at = v_now,
           resolved_by = p_actor_staff_id,
           resolution_note = v_reason,
           updated_at = v_now
     where attendance_exceptions.branch_id = p_branch_id
       and attendance_exceptions.checkin_id = v_checkin.id
       and attendance_exceptions.status = 'open'
     returning attendance_exceptions.id
  )
  select count(*)::integer
    into v_resolved_count
  from resolved;

  select open_checkin.id
    into v_open_checkin_id
  from public.staff_shift_checkins as open_checkin
  where open_checkin.branch_id = p_branch_id
    and open_checkin.staff_id = v_checkin.staff_id
    and open_checkin.is_test = p_is_test
    and open_checkin.status = 'checked_in'
    and open_checkin.checked_out_at is null
    and open_checkin.id <> v_checkin.id
  order by open_checkin.checked_in_at desc
  limit 1
  for update;

  v_next_expected_action := case when v_open_checkin_id is not null then 'clock_out' else 'clock_in' end;

  insert into public.attendance_corrections (
    branch_id,
    staff_id,
    checkin_id,
    attendance_date,
    correction_type,
    action_type,
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
    v_checkin.staff_id,
    v_checkin.id,
    v_checkin.shift_date,
    'reset_attendance_state',
    'reset_attendance_state',
    to_jsonb(v_checkin),
    jsonb_build_object(
      'resetMode', v_reset_mode,
      'status', 'voided',
      'nextExpectedAction', v_next_expected_action,
      'resolvedOpenExceptionCount', v_resolved_count
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

  return query select true, 'committed', 'Attendance state reset.', v_checkin.staff_id, v_checkin.id, v_checkin.shift_date, v_next_expected_action, v_resolved_count, v_correction_id;
end;
$$;

create or replace function public.commit_attendance_scan_transaction(
  p_request_id text,
  p_branch_id uuid,
  p_qr_point_id uuid,
  p_staff_id uuid,
  p_device_id uuid,
  p_scan_type text,
  p_action text,
  p_outcome text,
  p_reason_code text default null,
  p_message text default null,
  p_user_agent text default null,
  p_ip_address text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_is_test boolean default false,
  p_public_result jsonb default null,
  p_checkin_id uuid default null,
  p_checkin_insert jsonb default null,
  p_checkin_update jsonb default null,
  p_exception jsonb default null,
  p_device_scan_type text default 'attendance'
)
returns table (
  success boolean,
  code text,
  scan_event_id uuid,
  checkin_id uuid,
  recovery_issue_id uuid,
  operation_result jsonb,
  message text
)
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_now timestamptz := now();
  v_existing_event public.qr_scan_events%rowtype;
  v_existing_checkin public.staff_shift_checkins%rowtype;
  v_scan_event_id uuid;
  v_checkin_id uuid := p_checkin_id;
  v_recovery_issue_id uuid;
  v_operation_result jsonb := coalesce(p_public_result, '{}'::jsonb);
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_ip_address inet;
  v_ip_text text;
  v_shift_instance_key text;
  v_shift_date date;
  v_shift_type text;
  v_exception_dedupe_key text;
  v_exception_metadata jsonb;
  v_exception_related_checkins uuid[];
begin
  if p_branch_id is null or p_scan_type is null or p_action is null or p_outcome is null then
    return query select false, 'invalid_request', null::uuid, null::uuid, null::uuid, null::jsonb, 'Missing scan commit fields.';
    return;
  end if;

  if p_scan_type not in ('attendance', 'room', 'activation', 'unknown') then
    return query select false, 'invalid_scan_type', null::uuid, null::uuid, null::uuid, null::jsonb, 'Unsupported scan type.';
    return;
  end if;

  if p_outcome not in ('success', 'blocked', 'exception', 'error', 'noop') then
    return query select false, 'invalid_outcome', null::uuid, null::uuid, null::uuid, null::jsonb, 'Unsupported scan outcome.';
    return;
  end if;

  if p_checkin_insert is not null and p_checkin_update is not null then
    return query select false, 'invalid_checkin_operation', null::uuid, null::uuid, null::uuid, null::jsonb, 'A scan cannot insert and update attendance in one commit.';
    return;
  end if;

  if p_request_id is not null then
    perform pg_advisory_xact_lock(hashtext('attendance_scan_request'), hashtext(p_request_id));

    select event_row.*
      into v_existing_event
    from public.qr_scan_events as event_row
    where event_row.request_id = p_request_id
    order by event_row.created_at
    limit 1
    for update;

    if found and v_existing_event.operation_result is not null then
      return query select true, 'replayed', v_existing_event.id, v_existing_event.checkin_id, null::uuid, v_existing_event.operation_result, 'Committed scan result replayed.';
      return;
    end if;
  end if;

  if p_staff_id is not null then
    perform pg_advisory_xact_lock(
      hashtext('attendance_scan_staff'),
      hashtext(concat_ws(':', p_branch_id::text, p_staff_id::text, p_is_test::text))
    );

    perform 1
    from public.staff
    where id = p_staff_id
    for update;
  end if;

  v_ip_text := nullif(trim(split_part(coalesce(p_ip_address, ''), ',', 1)), '');
  if v_ip_text is not null and v_ip_text ~ '^[0-9a-fA-F:.]+$' then
    begin
      v_ip_address := v_ip_text::inet;
    exception
      when invalid_text_representation then
        v_ip_address := null;
    end;
  end if;

  if p_is_test then
    v_metadata := v_metadata || jsonb_build_object('isTest', true);
  end if;

  if p_checkin_update is not null then
    if p_checkin_id is null then
      return query select false, 'checkin_required', null::uuid, null::uuid, null::uuid, null::jsonb, 'Attendance update requires a selected check-in.';
      return;
    end if;

    select checkin_row.*
      into v_existing_checkin
    from public.staff_shift_checkins as checkin_row
    where checkin_row.id = p_checkin_id
      and checkin_row.branch_id = p_branch_id
      and (p_staff_id is null or checkin_row.staff_id = p_staff_id)
    for update;

    if not found or v_existing_checkin.status <> 'checked_in' or v_existing_checkin.checked_out_at is not null then
      return query select false, 'checkin_not_open', null::uuid, p_checkin_id, null::uuid, null::jsonb, 'Attendance record is no longer open.';
      return;
    end if;

    update public.staff_shift_checkins
       set shift_instance_key = coalesce(nullif(p_checkin_update->>'shift_instance_key', ''), shift_instance_key),
           schedule_source = coalesce(nullif(p_checkin_update->>'schedule_source', ''), schedule_source),
           schedule_source_id = coalesce(nullif(p_checkin_update->>'schedule_source_id', ''), schedule_source_id),
           branch_timezone = coalesce(nullif(p_checkin_update->>'branch_timezone', ''), branch_timezone),
           attendance_business_date = coalesce(nullif(p_checkin_update->>'attendance_business_date', '')::date, attendance_business_date),
           checked_out_at = coalesce(nullif(p_checkin_update->>'checked_out_at', '')::timestamptz, checked_out_at),
           status = coalesce(nullif(p_checkin_update->>'status', ''), status),
           clock_out_method = coalesce(nullif(p_checkin_update->>'clock_out_method', ''), clock_out_method),
           worked_minutes = coalesce((p_checkin_update->>'worked_minutes')::integer, worked_minutes),
           late_minutes = coalesce((p_checkin_update->>'late_minutes')::integer, late_minutes),
           early_leave_minutes = coalesce((p_checkin_update->>'early_leave_minutes')::integer, early_leave_minutes),
           overtime_minutes = coalesce((p_checkin_update->>'overtime_minutes')::integer, overtime_minutes),
           attendance_status = coalesce(nullif(p_checkin_update->>'attendance_status', ''), attendance_status),
           exception_state = coalesce(nullif(p_checkin_update->>'exception_state', ''), exception_state),
           notes = coalesce(nullif(p_checkin_update->>'notes', ''), notes),
           updated_at = v_now
     where id = p_checkin_id
     returning id into v_checkin_id;
  end if;

  if p_checkin_insert is not null then
    v_shift_instance_key := nullif(p_checkin_insert->>'shift_instance_key', '');
    v_shift_date := nullif(p_checkin_insert->>'shift_date', '')::date;
    v_shift_type := coalesce(nullif(p_checkin_insert->>'shift_type', ''), 'single');

    if p_staff_id is null or v_shift_date is null then
      return query select false, 'invalid_checkin_insert', null::uuid, null::uuid, null::uuid, null::jsonb, 'Attendance insert is missing staff or shift date.';
      return;
    end if;

    if v_shift_instance_key is not null then
      select checkin_row.*
        into v_existing_checkin
      from public.staff_shift_checkins as checkin_row
      where checkin_row.staff_id = p_staff_id
        and checkin_row.branch_id = p_branch_id
        and checkin_row.is_test = p_is_test
        and checkin_row.status <> 'voided'
        and checkin_row.shift_instance_key = v_shift_instance_key
      limit 1
      for update;
    else
      select checkin_row.*
        into v_existing_checkin
      from public.staff_shift_checkins as checkin_row
      where checkin_row.staff_id = p_staff_id
        and checkin_row.branch_id = p_branch_id
        and checkin_row.is_test = p_is_test
        and checkin_row.status <> 'voided'
        and checkin_row.shift_date = v_shift_date
        and checkin_row.shift_type = v_shift_type
      limit 1
      for update;
    end if;

    if found then
      v_checkin_id := v_existing_checkin.id;
      p_action := 'duplicate_scan';
      p_outcome := 'noop';
      p_reason_code := coalesce(p_reason_code, 'already_checked_in');
      p_message := coalesce(p_message, 'Attendance already exists for this shift.');
      v_operation_result := jsonb_build_object(
        'ok', true,
        'outcome', 'noop',
        'severity', 'info',
        'title', case when v_existing_checkin.status = 'checked_out' then 'Already checked out' else 'Already clocked in' end,
        'message', case when v_existing_checkin.status = 'checked_out' then 'Attendance is already completed for this scheduled shift.' else 'Attendance is already open for this scheduled shift.' end,
        'reasonCode', case when v_existing_checkin.status = 'checked_out' then 'already_checked_out' else 'already_checked_in' end
      );
    else
      insert into public.staff_shift_checkins (
        staff_id,
        branch_id,
        shift_date,
        shift_type,
        shift_instance_key,
        checked_in_at,
        status,
        source_qr_point_id,
        clock_in_method,
        scheduled_start_at,
        scheduled_end_at,
        schedule_source,
        schedule_source_id,
        branch_timezone,
        attendance_business_date,
        late_minutes,
        attendance_status,
        exception_state,
        is_test,
        notes
      )
      values (
        p_staff_id,
        p_branch_id,
        v_shift_date,
        v_shift_type,
        v_shift_instance_key,
        coalesce(nullif(p_checkin_insert->>'checked_in_at', '')::timestamptz, v_now),
        coalesce(nullif(p_checkin_insert->>'status', ''), 'checked_in'),
        p_qr_point_id,
        coalesce(nullif(p_checkin_insert->>'clock_in_method', ''), 'qr'),
        nullif(p_checkin_insert->>'scheduled_start_at', '')::timestamptz,
        nullif(p_checkin_insert->>'scheduled_end_at', '')::timestamptz,
        nullif(p_checkin_insert->>'schedule_source', ''),
        nullif(p_checkin_insert->>'schedule_source_id', ''),
        coalesce(nullif(p_checkin_insert->>'branch_timezone', ''), 'Asia/Manila'),
        nullif(p_checkin_insert->>'attendance_business_date', '')::date,
        coalesce((p_checkin_insert->>'late_minutes')::integer, 0),
        coalesce(nullif(p_checkin_insert->>'attendance_status', ''), 'present'),
        coalesce(nullif(p_checkin_insert->>'exception_state', ''), 'none'),
        p_is_test,
        nullif(p_checkin_insert->>'notes', '')
      )
      returning id into v_checkin_id;
    end if;
  end if;

  if v_existing_event.id is not null then
    update public.qr_scan_events
       set branch_id = p_branch_id,
           qr_point_id = p_qr_point_id,
           staff_id = p_staff_id,
           device_id = p_device_id,
           checkin_id = coalesce(v_checkin_id, p_checkin_id, qr_scan_events.checkin_id),
           scan_type = p_scan_type,
           action = p_action,
           outcome = p_outcome,
           reason_code = p_reason_code,
           message = p_message,
           user_agent = p_user_agent,
           ip_address = v_ip_address,
           metadata = v_metadata,
           is_test = p_is_test,
           operation_id = p_request_id
     where id = v_existing_event.id
     returning id into v_scan_event_id;
  else
    insert into public.qr_scan_events (
      branch_id,
      qr_point_id,
      staff_id,
      device_id,
      checkin_id,
      scan_type,
      action,
      outcome,
      reason_code,
      message,
      request_id,
      user_agent,
      ip_address,
      metadata,
      is_test,
      operation_id
    )
    values (
      p_branch_id,
      p_qr_point_id,
      p_staff_id,
      p_device_id,
      coalesce(v_checkin_id, p_checkin_id),
      p_scan_type,
      p_action,
      p_outcome,
      p_reason_code,
      p_message,
      p_request_id,
      p_user_agent,
      v_ip_address,
      v_metadata,
      p_is_test,
      p_request_id
    )
    returning id into v_scan_event_id;
  end if;

  if v_checkin_id is not null then
    if p_action = 'clock_in' then
      update public.staff_shift_checkins
         set clock_in_scan_event_id = coalesce(clock_in_scan_event_id, v_scan_event_id),
             updated_at = v_now
       where id = v_checkin_id;
    elsif p_action = 'clock_out' then
      update public.staff_shift_checkins
         set clock_out_scan_event_id = coalesce(clock_out_scan_event_id, v_scan_event_id),
             updated_at = v_now
       where id = v_checkin_id;
    end if;
  end if;

  if p_exception is not null then
    v_exception_dedupe_key := coalesce(
      nullif(p_exception->>'dedupe_key', ''),
      concat_ws('|', coalesce(p_staff_id::text, 'unknown_staff'), coalesce(v_checkin_id::text, 'no_checkin'), coalesce(nullif(p_exception->>'exception_type', ''), p_reason_code, 'manual'), case when p_is_test then 'test' else 'live' end)
    );
    v_exception_metadata := coalesce(p_exception->'metadata', '{}'::jsonb) || jsonb_build_object('dedupeKey', v_exception_dedupe_key);

    select exception_row.id,
           exception_row.related_checkin_ids
      into v_recovery_issue_id,
           v_exception_related_checkins
    from public.attendance_exceptions as exception_row
    where exception_row.branch_id = p_branch_id
      and exception_row.is_test = p_is_test
      and exception_row.status = 'open'
      and exception_row.dedupe_key = v_exception_dedupe_key
    limit 1
    for update;

    if v_recovery_issue_id is not null then
      if v_checkin_id is not null and not (v_checkin_id = any(coalesce(v_exception_related_checkins, '{}'::uuid[]))) then
        v_exception_related_checkins := array_append(coalesce(v_exception_related_checkins, '{}'::uuid[]), v_checkin_id);
      end if;

      update public.attendance_exceptions as attendance_exception
         set checkin_id = coalesce(v_checkin_id, attendance_exception.checkin_id),
             scan_event_id = v_scan_event_id,
             latest_scan_event_id = v_scan_event_id,
             severity = coalesce(nullif(p_exception->>'severity', ''), attendance_exception.severity),
             message = coalesce(nullif(p_exception->>'message', ''), attendance_exception.message),
             metadata = coalesce(attendance_exception.metadata, '{}'::jsonb) || v_exception_metadata,
             occurrence_count = greatest(1, attendance_exception.occurrence_count) + 1,
             detected_at = v_now,
             last_detected_at = v_now,
             related_checkin_ids = coalesce(v_exception_related_checkins, attendance_exception.related_checkin_ids),
             recommended_action = coalesce(nullif(p_exception->>'recommended_action', ''), attendance_exception.recommended_action),
             priority = coalesce(nullif(p_exception->>'priority', ''), attendance_exception.priority),
             updated_at = v_now
       where attendance_exception.id = v_recovery_issue_id;
    else
      insert into public.attendance_exceptions (
        branch_id,
        staff_id,
        checkin_id,
        scan_event_id,
        latest_scan_event_id,
        exception_type,
        severity,
        message,
        metadata,
        dedupe_key,
        occurrence_count,
        first_detected_at,
        last_detected_at,
        related_checkin_ids,
        recommended_action,
        priority,
        is_test
      )
      values (
        p_branch_id,
        p_staff_id,
        v_checkin_id,
        v_scan_event_id,
        v_scan_event_id,
        coalesce(nullif(p_exception->>'exception_type', ''), p_reason_code, 'manual'),
        coalesce(nullif(p_exception->>'severity', ''), 'warning'),
        coalesce(nullif(p_exception->>'message', ''), coalesce(p_message, 'Attendance scan needs review.')),
        v_exception_metadata,
        v_exception_dedupe_key,
        1,
        v_now,
        v_now,
        case when v_checkin_id is null then '{}'::uuid[] else array[v_checkin_id] end,
        nullif(p_exception->>'recommended_action', ''),
        coalesce(nullif(p_exception->>'priority', ''), 'normal'),
        p_is_test
      )
      returning id into v_recovery_issue_id;
    end if;
  end if;

  if p_device_id is not null then
    if p_device_scan_type = 'service' then
      update public.staff_devices
         set last_seen_at = v_now,
             last_service_scan_at = v_now,
             updated_at = v_now
       where id = p_device_id;
    elsif p_device_scan_type = 'attendance' then
      update public.staff_devices
         set last_seen_at = v_now,
             last_attendance_scan_at = v_now,
             updated_at = v_now
       where id = p_device_id;
    end if;
  end if;

  v_operation_result := v_operation_result || jsonb_build_object('scanEventId', v_scan_event_id::text);
  if v_checkin_id is not null and v_operation_result ? 'attendance' then
    v_operation_result := jsonb_set(v_operation_result, '{attendance,attendanceId}', to_jsonb(v_checkin_id::text), true);
  end if;

  update public.qr_scan_events
     set operation_id = coalesce(p_request_id, operation_id),
         operation_result = v_operation_result,
         operation_result_recorded_at = v_now
   where id = v_scan_event_id;

  return query select true, 'committed', v_scan_event_id, v_checkin_id, v_recovery_issue_id, v_operation_result, 'Attendance scan committed.';
end;
$$;

notify pgrst, 'reload schema';

commit;
