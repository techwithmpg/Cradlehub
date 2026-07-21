-- Atomically recover one stale open Attendance record, create the current
-- shift check-in, and persist the QR audit result. This prevents a legitimate
-- new-day scan from becoming a multi-day clock-out.

create or replace function public.recover_stale_attendance_and_clock_in(
  p_stale_checkin_id uuid,
  p_staff_id uuid,
  p_current_branch_id uuid,
  p_qr_point_id uuid,
  p_is_test boolean,
  p_recovery_clock_out_at timestamptz,
  p_current_checkin jsonb,
  p_request_id text,
  p_device_id uuid,
  p_user_agent text default null,
  p_ip_address text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_public_result jsonb default '{}'::jsonb,
  p_exception jsonb default null
)
returns table (
  success boolean,
  code text,
  stale_checkin_id uuid,
  current_checkin_id uuid,
  scan_event_id uuid,
  operation_result jsonb,
  message text
)
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_stale public.staff_shift_checkins%rowtype;
  v_current public.staff_shift_checkins%rowtype;
  v_current_id uuid;
  v_shift_instance_key text := nullif(p_current_checkin->>'shift_instance_key', '');
  v_shift_date date := nullif(p_current_checkin->>'shift_date', '')::date;
  v_shift_type text := coalesce(nullif(p_current_checkin->>'shift_type', ''), 'single');
  v_worked_minutes integer;
  v_stale_was_open boolean := false;
  v_commit record;
begin
  if p_stale_checkin_id is null
     or p_staff_id is null
     or p_current_branch_id is null
     or p_qr_point_id is null
     or p_device_id is null
     or p_request_id is null
     or p_recovery_clock_out_at is null
     or v_shift_date is null then
    return query select false, 'invalid_request', p_stale_checkin_id, null::uuid,
      null::uuid, null::jsonb, 'Stale recovery is missing required fields.';
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtext('attendance_stale_recovery'),
    hashtext(concat_ws(':', p_staff_id::text, p_is_test::text))
  );

  if v_shift_instance_key is not null then
    select checkin.* into v_current
    from public.staff_shift_checkins as checkin
    where checkin.staff_id = p_staff_id
      and checkin.branch_id = p_current_branch_id
      and checkin.is_test = p_is_test
      and checkin.status <> 'voided'
      and checkin.shift_instance_key = v_shift_instance_key
    limit 1
    for update;
  else
    select checkin.* into v_current
    from public.staff_shift_checkins as checkin
    where checkin.staff_id = p_staff_id
      and checkin.branch_id = p_current_branch_id
      and checkin.is_test = p_is_test
      and checkin.status <> 'voided'
      and checkin.shift_date = v_shift_date
      and checkin.shift_type = v_shift_type
    limit 1
    for update;
  end if;
  if found then
    v_current_id := v_current.id;
  end if;

  select checkin.* into v_stale
  from public.staff_shift_checkins as checkin
  where checkin.id = p_stale_checkin_id
    and checkin.staff_id = p_staff_id
    and checkin.is_test = p_is_test
  for update;

  if found and v_stale.status = 'checked_in' and v_stale.checked_out_at is null then
    v_stale_was_open := true;
  elsif v_current_id is null then
    return query select false, 'stale_checkin_not_open', p_stale_checkin_id, null::uuid,
      null::uuid, null::jsonb, 'The stale Attendance record is no longer open.';
    return;
  end if;

  if v_stale_was_open then
    if p_recovery_clock_out_at <= v_stale.checked_in_at
       or p_recovery_clock_out_at > now() + interval '1 minute' then
      return query select false, 'invalid_recovery_time', p_stale_checkin_id, v_current_id,
        null::uuid, null::jsonb, 'The recovery time is outside the safe interval.';
      return;
    end if;

    v_worked_minutes := greatest(
      0,
      round(extract(epoch from (p_recovery_clock_out_at - v_stale.checked_in_at)) / 60.0)::integer
    );

    update public.staff_shift_checkins
       set checked_out_at = p_recovery_clock_out_at,
           status = 'checked_out',
           clock_out_method = 'system_auto_close',
           worked_minutes = v_worked_minutes,
           attendance_status = case
             when coalesce(v_stale.late_minutes, 0) > 0 then 'late'
             when coalesce(v_stale.early_leave_minutes, 0) > 0 then 'early_leave'
             when coalesce(v_stale.overtime_minutes, 0) > 0 then 'overtime'
             else 'present'
           end,
           exception_state = 'open',
           provisional_auto_closed_at = now(),
           clock_out_confirmation_required = true,
           notes = concat_ws(E'\n', nullif(v_stale.notes, ''), 'Recovered automatically before a valid later-shift clock-in.'),
           updated_at = now()
     where id = v_stale.id;
  end if;

  if v_current_id is null then
    insert into public.staff_shift_checkins (
      staff_id, branch_id, shift_date, shift_type, shift_instance_key,
      checked_in_at, status, source_qr_point_id, clock_in_method,
      scheduled_start_at, scheduled_end_at, schedule_source, schedule_source_id,
      branch_timezone, attendance_business_date, late_minutes,
      attendance_status, exception_state, is_test, notes
    ) values (
      p_staff_id, p_current_branch_id, v_shift_date, v_shift_type,
      v_shift_instance_key,
      coalesce(nullif(p_current_checkin->>'checked_in_at', '')::timestamptz, now()),
      'checked_in', p_qr_point_id, 'qr',
      nullif(p_current_checkin->>'scheduled_start_at', '')::timestamptz,
      nullif(p_current_checkin->>'scheduled_end_at', '')::timestamptz,
      nullif(p_current_checkin->>'schedule_source', ''),
      nullif(p_current_checkin->>'schedule_source_id', ''),
      coalesce(nullif(p_current_checkin->>'branch_timezone', ''), 'Asia/Manila'),
      nullif(p_current_checkin->>'attendance_business_date', '')::date,
      coalesce((p_current_checkin->>'late_minutes')::integer, 0),
      coalesce(nullif(p_current_checkin->>'attendance_status', ''), 'present'),
      coalesce(nullif(p_current_checkin->>'exception_state', ''), 'open'),
      p_is_test,
      'Created atomically while recovering a stale open Attendance record.'
    ) returning id into v_current_id;
  end if;

  select * into v_commit
  from public.commit_attendance_scan_transaction(
    p_request_id => p_request_id,
    p_branch_id => p_current_branch_id,
    p_qr_point_id => p_qr_point_id,
    p_staff_id => p_staff_id,
    p_device_id => p_device_id,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'success',
    p_reason_code => 'stale_checkin_recovered_and_clocked_in',
    p_message => 'Stale Attendance recovered and current clock-in recorded.',
    p_user_agent => p_user_agent,
    p_ip_address => p_ip_address,
    p_metadata => coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'staleCheckinId', p_stale_checkin_id,
      'staleRecoveredAt', p_recovery_clock_out_at
    ),
    p_is_test => p_is_test,
    p_public_result => p_public_result,
    p_checkin_id => v_current_id,
    p_exception => p_exception,
    p_device_scan_type => 'attendance'
  );

  if v_commit.success is distinct from true then
    raise exception 'Attendance stale recovery audit commit failed: %', coalesce(v_commit.code, 'unknown');
  end if;

  return query select true, v_commit.code, p_stale_checkin_id, v_current_id,
    v_commit.scan_event_id, v_commit.operation_result, v_commit.message;
end;
$$;

comment on function public.recover_stale_attendance_and_clock_in(
  uuid, uuid, uuid, uuid, boolean, timestamptz, jsonb, text, uuid, text, text, jsonb, jsonb, jsonb
) is
  'Atomically closes one stale Attendance record, opens the current shift, and commits its idempotent QR audit result.';

revoke all on function public.recover_stale_attendance_and_clock_in(
  uuid, uuid, uuid, uuid, boolean, timestamptz, jsonb, text, uuid, text, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.recover_stale_attendance_and_clock_in(
  uuid, uuid, uuid, uuid, boolean, timestamptz, jsonb, text, uuid, text, text, jsonb, jsonb, jsonb
) to service_role;
