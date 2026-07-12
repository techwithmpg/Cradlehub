-- Attendance transactional scan persistence
--
-- The TypeScript scan engine still resolves QR, identity, branch authorization,
-- schedule, and scan intent. This RPC owns the final persistence boundary so an
-- interpreted attendance mutation, scan audit event, Recovery issue, device
-- seen update, and idempotent public result commit succeed or roll back
-- together.

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
           checkin_id = coalesce(v_checkin_id, p_checkin_id, checkin_id),
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

      update public.attendance_exceptions
         set checkin_id = coalesce(v_checkin_id, checkin_id),
             scan_event_id = v_scan_event_id,
             latest_scan_event_id = v_scan_event_id,
             severity = coalesce(nullif(p_exception->>'severity', ''), severity),
             message = coalesce(nullif(p_exception->>'message', ''), message),
             metadata = coalesce(metadata, '{}'::jsonb) || v_exception_metadata,
             occurrence_count = greatest(1, occurrence_count) + 1,
             detected_at = v_now,
             last_detected_at = v_now,
             related_checkin_ids = coalesce(v_exception_related_checkins, related_checkin_ids),
             recommended_action = coalesce(nullif(p_exception->>'recommended_action', ''), recommended_action),
             priority = coalesce(nullif(p_exception->>'priority', ''), priority),
             updated_at = v_now
       where id = v_recovery_issue_id;
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

comment on function public.commit_attendance_scan_transaction(
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  boolean,
  jsonb,
  uuid,
  jsonb,
  jsonb,
  jsonb,
  text
) is
  'Atomic Attendance scan persistence boundary. Called by the server scan engine after QR/device/branch/schedule intent resolution.';

revoke all on function public.commit_attendance_scan_transaction(
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  boolean,
  jsonb,
  uuid,
  jsonb,
  jsonb,
  jsonb,
  text
) from public;

revoke all on function public.commit_attendance_scan_transaction(
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  boolean,
  jsonb,
  uuid,
  jsonb,
  jsonb,
  jsonb,
  text
) from anon;

revoke all on function public.commit_attendance_scan_transaction(
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  boolean,
  jsonb,
  uuid,
  jsonb,
  jsonb,
  jsonb,
  text
) from authenticated;

grant execute on function public.commit_attendance_scan_transaction(
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  boolean,
  jsonb,
  uuid,
  jsonb,
  jsonb,
  jsonb,
  text
) to service_role;
