-- ============================================================================
-- REVIEW-ONLY CONSOLIDATED SQL DRAFT — REVISION V3.1 (DO NOT AUTO-APPLY TO PRODUCTION)
-- ============================================================================
-- Proposed future migration filename (for owner-authorized activation ONLY):
--   supabase/migrations/20261107140000_p0_01_atomic_completed_shift_transaction_v3_1.sql
--
-- Previous review draft preserved intact for comparison:
--   docs/reviews/attendance/20261107_atomic_completed_shift_transaction.V3.DRAFT.sql
--
-- Baseline replaced when activated:
--   supabase/migrations/20260821023717_fix_attendance_function_ambiguity.sql
--   (lines 844-1282: public.commit_attendance_scan_transaction, 20 parameters,
--    RETURNS TABLE, LANGUAGE plpgsql, SECURITY INVOKER)
--
-- Consolidated sources:
--   1. Canonical baseline: 20260821023717_fix_attendance_function_ambiguity.sql
--   2. Workstream A:       20261106153000_prevent_completed_shift_reclock_in.sql
--   3. Workstream B (V2):  20261106_atomic_completed_shift_transaction.V2.DRAFT.sql
--   4. V3 Draft:           20261107_atomic_completed_shift_transaction.V3.DRAFT.sql
--
-- Targeted V3.1 clock-out integrity corrections (p_checkin_update IS NOT NULL):
--   - P0-01-H1/H3: Independently validates p_checkin_update->>'checked_out_at'
--                  against server transaction time ([-5 minutes, +60 seconds])
--                  or verified qr_scan_events sourceScanEventId provenance;
--                  explicitly rejects future or unverified historical clock-out
--                  timestamps ('invalid_checkout_timestamp').
--   - P0-01-H2:    Enforces checked_out_at >= v_existing_checkin.checked_in_at
--                  ('checkout_before_checkin').
--   - P0-01-H4:    Preserves established attendance_business_date immutably and
--                  derives missing legacy NULL business dates from the locked
--                  attendance row's authoritative shift_date rather than
--                  request JSON; rejects mismatched attendance_business_date
--                  overrides ('invalid_business_date'). Preserves established
--                  shift_instance_key, schedule_source, schedule_source_id, and
--                  validated branch_timezone.
--   - P0-01-H5:    Computes worked_minutes, early_leave_minutes, overtime_minutes,
--                  late_minutes, attendance_status, and exception_state
--                  authoritatively on the server from locked shift context and
--                  validated checked_out_at (matching computeAttendanceMetrics,
--                  commit_attendance_portal_clock_out, and
--                  reconcile_provisional_attendance_clock_out); rejects negative
--                  or malformed metric inputs and records audit metadata when
--                  caller-supplied metrics are normalized.
--   - P0-01-H6:    Requires non-null p_staff_id on p_checkin_update (ensuring
--                  attendance_scan_staff advisory lock + staff FOR UPDATE lock)
--                  and enforces exact (id, branch_id, staff_id, is_test) match
--                  plus status='checked_out' and clock_out_method='qr', and
--                  scopes post-event scan-link updates on staff_shift_checkins.
-- ============================================================================

begin;

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
  v_request_id text := nullif(btrim(coalesce(p_request_id, '')), '');
  v_existing_event public.qr_scan_events%rowtype;
  v_existing_checkin public.staff_shift_checkins%rowtype;
  v_existing_checkin_json jsonb;
  v_settings_json jsonb;
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
  v_supplied_business_date date;
  v_supplied_update_business_date date;
  v_checkin_business_date date;
  v_checkin_timezone text;
  v_branch_timezone text := 'Asia/Manila';
  v_day_boundary time := '06:00:00'::time;
  v_earliest_clock_in_before_mins integer := 30;
  v_latest_clock_in_after_mins integer := 120;
  v_clock_out_before_mins integer := 120;
  v_clock_out_after_mins integer := 120;
  v_early_leave_grace_mins integer := 5;
  v_requested_scan_at timestamptz;
  v_requested_checkout_at timestamptz;
  v_effective_checkout_at timestamptz;
  v_source_scan_event_text text;
  v_source_scan_created_at timestamptz;
  v_checkout_source_created_at timestamptz;
  v_timestamp_trusted boolean := true;
  v_effective_scan_at timestamptz;
  v_local_scan_ts timestamp;
  v_authoritative_business_date date;
  v_unverified_req_local_ts timestamp;
  v_unverified_req_business_date date;
  v_eval_scan_at timestamptz;
  v_eval_business_date date;
  v_update_status text;
  v_clock_out_method text;
  v_earliest_normal_checkout_at timestamptz;
  v_latest_normal_checkout_at timestamptz;
  v_supplied_worked_mins integer;
  v_supplied_late_mins integer;
  v_supplied_early_mins integer;
  v_supplied_overtime_mins integer;
  v_worked_minutes integer;
  v_late_minutes integer;
  v_early_leave_minutes integer;
  v_overtime_minutes integer;
  v_attendance_status text;
  v_exception_state text;
  v_internal_exception_type text;
  v_has_open_checkin boolean := false;
  v_has_eligible_uncompleted_split boolean := false;
  v_exception_dedupe_key text;
  v_exception_metadata jsonb;
  v_exception_related_checkins uuid[];
begin
  if p_branch_id is null or p_scan_type is null or p_action is null or p_outcome is null or p_public_result is null then
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

  if v_request_id is not null then
    perform pg_advisory_xact_lock(hashtext('attendance_scan_request'), hashtext(v_request_id));

    select event_row.*
      into v_existing_event
    from public.qr_scan_events as event_row
    where event_row.request_id = v_request_id
    order by event_row.created_at
    limit 1
    for update;

    if found and v_existing_event.operation_result is not null then
      if v_existing_event.qr_point_id is distinct from p_qr_point_id then
        return query select false, 'scan_request_mismatch', v_existing_event.id, v_existing_event.checkin_id, null::uuid, null::jsonb, 'Operation ID belongs to a different QR point.';
        return;
      end if;

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

  -- Load authoritative branch attendance settings for timezone, day boundary,
  -- grace thresholds, and clock-in/clock-out windows.
  select to_jsonb(settings)
    into v_settings_json
  from public.attendance_settings as settings
  where settings.branch_id = p_branch_id
  limit 1;

  if v_settings_json is not null then
    v_branch_timezone := coalesce(nullif(btrim(v_settings_json->>'timezone'), ''), 'Asia/Manila');
    v_day_boundary := coalesce(nullif(v_settings_json->>'attendance_day_boundary', '')::time, '06:00:00'::time);
    v_earliest_clock_in_before_mins := greatest(
      coalesce((v_settings_json->>'clock_in_window_before_shift_minutes')::integer, 30),
      coalesce((v_settings_json->>'early_clock_in_allowed_minutes')::integer, 30),
      0
    );
    v_latest_clock_in_after_mins := greatest(
      coalesce((v_settings_json->>'clock_in_window_after_shift_start_minutes')::integer, 120),
      0
    );
    v_clock_out_before_mins := greatest(
      coalesce((v_settings_json->>'clock_out_window_before_shift_end_minutes')::integer, 120),
      0
    );
    v_clock_out_after_mins := greatest(
      coalesce((v_settings_json->>'clock_out_window_after_shift_end_minutes')::integer, 120),
      0
    );
    v_early_leave_grace_mins := greatest(
      coalesce((v_settings_json->>'early_leave_threshold_minutes')::integer, 5),
      0
    );
  end if;

  if not exists (
    select 1
    from pg_timezone_names as tz
    where tz.name = v_branch_timezone
  ) then
    v_branch_timezone := 'Asia/Manila';
  end if;

  -- Validate scan timestamp provenance rather than blindly trusting JSON timestamps.
  begin
    v_requested_scan_at := coalesce(
      nullif(p_checkin_insert->>'checked_in_at', '')::timestamptz,
      nullif(v_metadata->>'scannedAt', '')::timestamptz
    );
  exception
    when others then
      return query select false, 'invalid_checkin_timestamp', null::uuid, null::uuid, null::uuid, null::jsonb, 'Invalid attendance scan timestamp format.';
      return;
  end;

  v_source_scan_event_text := nullif(btrim(coalesce(v_metadata->>'sourceScanEventId', '')), '');
  if v_source_scan_event_text is not null
     and v_source_scan_event_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and p_staff_id is not null then
    select src.created_at
      into v_source_scan_created_at
    from public.qr_scan_events as src
    where src.id = v_source_scan_event_text::uuid
      and src.staff_id = p_staff_id
      and src.branch_id = p_branch_id
      and src.is_test = p_is_test
      and src.scan_type = 'attendance'
    limit 1;

    select src.created_at
      into v_checkout_source_created_at
    from public.qr_scan_events as src
    where src.id = v_source_scan_event_text::uuid
      and src.staff_id = p_staff_id
      and src.is_test = p_is_test
      and src.scan_type = 'attendance'
      and (
        src.branch_id = p_branch_id
        or (p_qr_point_id is not null and src.qr_point_id = p_qr_point_id)
      )
    limit 1;
  end if;

  if v_requested_scan_at is null then
    v_timestamp_trusted := true;
    v_effective_scan_at := v_now;
  elsif v_requested_scan_at between (v_now - interval '5 minutes') and (v_now + interval '60 seconds') then
    v_timestamp_trusted := true;
    v_effective_scan_at := v_requested_scan_at;
  elsif v_source_scan_created_at is not null
        and v_source_scan_created_at <= (v_now + interval '60 seconds')
        and v_requested_scan_at between (v_source_scan_created_at - interval '60 seconds')
                                    and (v_source_scan_created_at + interval '5 minutes') then
    v_timestamp_trusted := true;
    v_effective_scan_at := v_requested_scan_at;
  else
    v_timestamp_trusted := false;
    v_effective_scan_at := v_now;
    v_metadata := v_metadata || jsonb_build_object(
      'untrustedScanTimestampNormalizedFrom', v_requested_scan_at,
      'serverTransactionNow', v_now
    );
    if v_requested_scan_at <= (v_now + interval '60 seconds') then
      v_unverified_req_local_ts := v_requested_scan_at at time zone v_branch_timezone;
      v_unverified_req_business_date := v_unverified_req_local_ts::date
        - case when v_unverified_req_local_ts::time < v_day_boundary then 1 else 0 end;
    end if;
  end if;

  v_local_scan_ts := v_effective_scan_at at time zone v_branch_timezone;
  v_authoritative_business_date := v_local_scan_ts::date
    - case when v_local_scan_ts::time < v_day_boundary then 1 else 0 end;

  if p_checkin_update is not null then
    if p_checkin_id is null then
      return query select false, 'checkin_required', null::uuid, null::uuid, null::uuid, null::jsonb, 'Attendance update requires a selected check-in.';
      return;
    end if;

    if p_staff_id is null then
      return query select false, 'invalid_checkin_update', null::uuid, p_checkin_id, null::uuid, null::jsonb, 'Attendance clock-out requires staff identity.';
      return;
    end if;

    select checkin_row.*
      into v_existing_checkin
    from public.staff_shift_checkins as checkin_row
    where checkin_row.id = p_checkin_id
      and checkin_row.branch_id = p_branch_id
      and checkin_row.staff_id = p_staff_id
      and checkin_row.is_test = p_is_test
    for update;

    if not found or v_existing_checkin.status <> 'checked_in' or v_existing_checkin.checked_out_at is not null then
      return query select false, 'checkin_not_open', null::uuid, p_checkin_id, null::uuid, null::jsonb, 'Attendance record is no longer open.';
      return;
    end if;

    v_update_status := coalesce(nullif(btrim(p_checkin_update->>'status'), ''), 'checked_out');
    v_clock_out_method := coalesce(nullif(btrim(p_checkin_update->>'clock_out_method'), ''), 'qr');
    if v_update_status <> 'checked_out' or v_clock_out_method <> 'qr' then
      return query select false, 'invalid_checkin_update', null::uuid, p_checkin_id, null::uuid, null::jsonb, 'Normal scan clock-out must set status=checked_out and clock_out_method=qr.';
      return;
    end if;

    -- Independently validate supplied clock-out timestamp against server time
    -- or verified qr_scan_events provenance.
    begin
      v_requested_checkout_at := nullif(btrim(coalesce(p_checkin_update->>'checked_out_at', '')), '')::timestamptz;
    exception
      when others then
        return query select false, 'invalid_checkout_timestamp', null::uuid, p_checkin_id, null::uuid, null::jsonb, 'Invalid attendance clock-out timestamp format.';
        return;
    end;

    if v_requested_checkout_at is null then
      v_effective_checkout_at := v_now;
    elsif v_requested_checkout_at > (v_now + interval '60 seconds') then
      return query select false, 'invalid_checkout_timestamp', null::uuid, p_checkin_id, null::uuid, null::jsonb, 'Attendance clock-out timestamp cannot be in the future.';
      return;
    elsif v_requested_checkout_at >= (v_now - interval '5 minutes') then
      v_effective_checkout_at := v_requested_checkout_at;
    elsif v_checkout_source_created_at is not null
          and v_checkout_source_created_at <= (v_now + interval '60 seconds')
          and v_requested_checkout_at between (v_checkout_source_created_at - interval '60 seconds')
                                          and (v_checkout_source_created_at + interval '5 minutes') then
      v_effective_checkout_at := v_requested_checkout_at;
    else
      return query select false, 'invalid_checkout_timestamp', null::uuid, p_checkin_id, null::uuid, null::jsonb, 'Attendance clock-out timestamp is outside the allowed server window without verified scan provenance.';
      return;
    end if;

    if v_effective_checkout_at < v_existing_checkin.checked_in_at then
      return query select false, 'checkout_before_checkin', null::uuid, p_checkin_id, null::uuid, null::jsonb, 'Attendance clock-out timestamp cannot be earlier than check-in.';
      return;
    end if;

    -- Preserve established attendance_business_date immutably; derive missing
    -- legacy NULL business dates from authoritative shift_date on the locked row.
    begin
      v_supplied_update_business_date := nullif(btrim(coalesce(p_checkin_update->>'attendance_business_date', '')), '')::date;
    exception
      when others then
        return query select false, 'invalid_business_date', null::uuid, p_checkin_id, null::uuid, null::jsonb, 'Invalid attendance_business_date format on clock-out.';
        return;
    end;

    v_checkin_business_date := coalesce(v_existing_checkin.attendance_business_date, v_existing_checkin.shift_date);
    if v_supplied_update_business_date is not null and v_supplied_update_business_date <> v_checkin_business_date then
      return query select false, 'invalid_business_date', null::uuid, p_checkin_id, null::uuid, null::jsonb, 'Supplied attendance_business_date cannot modify the shift business date.';
      return;
    end if;

    -- Validate numeric syntax/bounds on any caller-supplied metrics, then
    -- compute authoritative worked/early/overtime/late/status metrics server-side.
    begin
      v_supplied_worked_mins := nullif(btrim(coalesce(p_checkin_update->>'worked_minutes', '')), '')::integer;
      v_supplied_late_mins := nullif(btrim(coalesce(p_checkin_update->>'late_minutes', '')), '')::integer;
      v_supplied_early_mins := nullif(btrim(coalesce(p_checkin_update->>'early_leave_minutes', '')), '')::integer;
      v_supplied_overtime_mins := nullif(btrim(coalesce(p_checkin_update->>'overtime_minutes', '')), '')::integer;
    exception
      when others then
        return query select false, 'invalid_checkin_update', null::uuid, p_checkin_id, null::uuid, null::jsonb, 'Invalid attendance minute metrics format.';
        return;
    end;

    if coalesce(v_supplied_worked_mins, 0) < 0
       or coalesce(v_supplied_late_mins, 0) < 0
       or coalesce(v_supplied_early_mins, 0) < 0
       or coalesce(v_supplied_overtime_mins, 0) < 0 then
      return query select false, 'invalid_checkin_update', null::uuid, p_checkin_id, null::uuid, null::jsonb, 'Attendance minute metrics cannot be negative.';
      return;
    end if;

    v_existing_checkin_json := to_jsonb(v_existing_checkin);
    v_earliest_normal_checkout_at := nullif(v_existing_checkin_json->>'earliest_normal_clock_out_at', '')::timestamptz;
    v_latest_normal_checkout_at := nullif(v_existing_checkin_json->>'latest_normal_clock_out_at', '')::timestamptz;
    if coalesce(v_existing_checkin_json->'attendance_policy_snapshot'->>'earlyLeaveThresholdMinutes', '') ~ '^[0-9]+$' then
      v_early_leave_grace_mins := greatest(
        (v_existing_checkin_json->'attendance_policy_snapshot'->>'earlyLeaveThresholdMinutes')::integer,
        0
      );
    end if;

    v_worked_minutes := greatest(
      0,
      round(extract(epoch from (v_effective_checkout_at - v_existing_checkin.checked_in_at)) / 60.0)::integer
    );
    v_late_minutes := greatest(0, coalesce(v_existing_checkin.late_minutes, 0));

    if v_earliest_normal_checkout_at is not null then
      v_early_leave_minutes := case
        when v_effective_checkout_at < v_earliest_normal_checkout_at
          then greatest(0, round(extract(epoch from (v_earliest_normal_checkout_at - v_effective_checkout_at)) / 60.0)::integer)
        else 0
      end;
    elsif v_existing_checkin.scheduled_end_at is not null
          and v_effective_checkout_at < (v_existing_checkin.scheduled_end_at - make_interval(mins => v_early_leave_grace_mins)) then
      v_early_leave_minutes := greatest(
        0,
        round(extract(epoch from (v_existing_checkin.scheduled_end_at - v_effective_checkout_at)) / 60.0)::integer
      );
    else
      v_early_leave_minutes := 0;
    end if;

    if v_latest_normal_checkout_at is not null then
      v_overtime_minutes := case
        when v_effective_checkout_at > v_latest_normal_checkout_at
          then greatest(0, round(extract(epoch from (v_effective_checkout_at - v_latest_normal_checkout_at)) / 60.0)::integer)
        else 0
      end;
    elsif v_existing_checkin.scheduled_end_at is not null
          and v_effective_checkout_at > v_existing_checkin.scheduled_end_at then
      v_overtime_minutes := greatest(
        0,
        round(extract(epoch from (v_effective_checkout_at - v_existing_checkin.scheduled_end_at)) / 60.0)::integer
      );
    else
      v_overtime_minutes := 0;
    end if;

    v_attendance_status := case
      when v_late_minutes > 0 then 'late'
      when v_early_leave_minutes > 0 then 'early_leave'
      when v_overtime_minutes > 0 then 'overtime'
      else 'present'
    end;

    v_exception_state := case
      when p_exception is not null
           or v_existing_checkin.exception_state = 'open'
           or v_late_minutes > 0
           or v_early_leave_minutes > 0
           or v_overtime_minutes > 0
        then 'open'
      else 'none'
    end;

    if (v_supplied_worked_mins is not null and v_supplied_worked_mins <> v_worked_minutes)
       or (v_supplied_late_mins is not null and v_supplied_late_mins <> v_late_minutes)
       or (v_supplied_early_mins is not null and v_supplied_early_mins <> v_early_leave_minutes)
       or (v_supplied_overtime_mins is not null and v_supplied_overtime_mins <> v_overtime_minutes) then
      v_metadata := v_metadata || jsonb_build_object(
        'normalizedClockOutMetrics', jsonb_build_object(
          'suppliedWorkedMinutes', v_supplied_worked_mins,
          'authoritativeWorkedMinutes', v_worked_minutes,
          'suppliedLateMinutes', v_supplied_late_mins,
          'authoritativeLateMinutes', v_late_minutes,
          'suppliedEarlyLeaveMinutes', v_supplied_early_mins,
          'authoritativeEarlyLeaveMinutes', v_early_leave_minutes,
          'suppliedOvertimeMinutes', v_supplied_overtime_mins,
          'authoritativeOvertimeMinutes', v_overtime_minutes
        )
      );
    end if;

    v_checkin_timezone := coalesce(nullif(btrim(v_existing_checkin.branch_timezone), ''), v_branch_timezone);
    if not exists (
      select 1
      from pg_timezone_names as tz
      where tz.name = v_checkin_timezone
    ) then
      v_checkin_timezone := v_branch_timezone;
    end if;

    update public.staff_shift_checkins
       set shift_instance_key = coalesce(shift_instance_key, nullif(p_checkin_update->>'shift_instance_key', '')),
           schedule_source = coalesce(schedule_source, nullif(p_checkin_update->>'schedule_source', '')),
           schedule_source_id = coalesce(schedule_source_id, nullif(p_checkin_update->>'schedule_source_id', '')),
           branch_timezone = v_checkin_timezone,
           attendance_business_date = v_checkin_business_date,
           checked_out_at = v_effective_checkout_at,
           status = v_update_status,
           clock_out_method = v_clock_out_method,
           worked_minutes = v_worked_minutes,
           late_minutes = v_late_minutes,
           early_leave_minutes = v_early_leave_minutes,
           overtime_minutes = v_overtime_minutes,
           attendance_status = v_attendance_status,
           exception_state = v_exception_state,
           notes = coalesce(nullif(p_checkin_update->>'notes', ''), notes),
           updated_at = v_now
     where id = p_checkin_id
       and branch_id = p_branch_id
       and staff_id = p_staff_id
       and is_test = p_is_test
       and status = 'checked_in'
       and checked_out_at is null
     returning id into v_checkin_id;

    if not found then
      return query select false, 'checkin_not_open', null::uuid, p_checkin_id, null::uuid, null::jsonb, 'Attendance record is no longer open.';
      return;
    end if;

    if jsonb_typeof(v_operation_result->'attendance') = 'object' then
      v_operation_result := jsonb_set(v_operation_result, '{attendance,workedMinutes}', to_jsonb(v_worked_minutes), true);
      v_operation_result := jsonb_set(v_operation_result, '{attendance,occurredAt}', to_jsonb(v_effective_checkout_at), true);
    end if;
  end if;

  if p_checkin_insert is not null then
    v_shift_instance_key := nullif(p_checkin_insert->>'shift_instance_key', '');
    v_shift_type := coalesce(nullif(p_checkin_insert->>'shift_type', ''), 'single');

    begin
      v_shift_date := nullif(p_checkin_insert->>'shift_date', '')::date;
      v_supplied_business_date := nullif(p_checkin_insert->>'attendance_business_date', '')::date;
    exception
      when others then
        return query select false, 'invalid_business_date', null::uuid, null::uuid, null::uuid, null::jsonb, 'Invalid shift_date or attendance_business_date format.';
        return;
    end;

    if p_staff_id is null or v_shift_date is null then
      return query select false, 'invalid_checkin_insert', null::uuid, null::uuid, null::uuid, null::jsonb, 'Attendance insert is missing staff or shift date.';
      return;
    end if;

    -- Determine evaluation instant/business date for completed-shift checks:
    -- For trusted scans, always use v_effective_scan_at / v_authoritative_business_date.
    -- For unverified historical timestamps, check v_authoritative_business_date first
    -- and also v_unverified_req_business_date so completed-shift rescans cleanly
    -- convert to already_checked_out noop, while any non-noop insert with an
    -- untrusted timestamp is rejected below.
    v_eval_scan_at := case
      when v_timestamp_trusted then v_effective_scan_at
      when v_unverified_req_business_date is not null then v_requested_scan_at
      else v_effective_scan_at
    end;
    v_eval_business_date := case
      when v_timestamp_trusted then v_authoritative_business_date
      when v_unverified_req_business_date is not null then v_unverified_req_business_date
      else v_authoritative_business_date
    end;

    if v_supplied_business_date is not null and v_supplied_business_date <> v_eval_business_date then
      v_metadata := v_metadata || jsonb_build_object(
        'normalizedBusinessDateFrom', v_supplied_business_date,
        'authoritativeBusinessDate', v_eval_business_date
      );
    end if;

    -- 1. Exact shift_instance_key or legacy (shift_date, shift_type) lookup.
    if v_shift_instance_key is not null then
      select checkin_row.*
        into v_existing_checkin
      from public.staff_shift_checkins as checkin_row
      where checkin_row.staff_id = p_staff_id
        and checkin_row.branch_id = p_branch_id
        and checkin_row.is_test = p_is_test
        and checkin_row.status <> 'voided'
        and checkin_row.shift_instance_key = v_shift_instance_key
      order by
        case when checkin_row.status = 'checked_in' and checkin_row.checked_out_at is null then 0 else 1 end,
        checkin_row.checked_out_at desc nulls last,
        checkin_row.checked_in_at desc nulls last
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
        and coalesce(checkin_row.attendance_business_date, checkin_row.shift_date) = v_eval_business_date
        and checkin_row.shift_type = v_shift_type
      order by
        case when checkin_row.status = 'checked_in' and checkin_row.checked_out_at is null then 0 else 1 end,
        checkin_row.checked_out_at desc nulls last,
        checkin_row.checked_in_at desc nulls last
      limit 1
      for update;
    end if;

    -- 2. Same-business-day completed/open shift guard across changed keys,
    --    forged business dates, premature second windows, and fabricated splits.
    if not found and coalesce(nullif(p_checkin_insert->>'status', ''), 'checked_in') = 'checked_in' then
      select checkin_row.*
        into v_existing_checkin
      from public.staff_shift_checkins as checkin_row
      where checkin_row.staff_id = p_staff_id
        and checkin_row.branch_id = p_branch_id
        and checkin_row.is_test = p_is_test
        and checkin_row.status <> 'voided'
        and (
          (checkin_row.status = 'checked_in' and checkin_row.checked_out_at is null)
          or (
            (checkin_row.status = 'checked_out' or checkin_row.checked_out_at is not null)
            and checkin_row.checked_out_at is not null
            and (
              coalesce(checkin_row.attendance_business_date, checkin_row.shift_date) = v_eval_business_date
              or (
                not v_timestamp_trusted
                and coalesce(checkin_row.attendance_business_date, checkin_row.shift_date) = v_authoritative_business_date
              )
            )
            and not coalesce((
              -- A second session on the same business date is allowed ONLY when
              -- backed by two distinct, active, non-adjacent weekly schedule rows
              -- with no schedule override/day-off on that date, starting strictly
              -- after the completed shift's checkout, AND scanned inside the
              -- branch's authorized clock-in window.
              v_timestamp_trusted
              and v_shift_instance_key is not null
              and checkin_row.shift_instance_key is not null
              and v_shift_date = v_eval_business_date
              and coalesce(checkin_row.attendance_business_date, checkin_row.shift_date) = v_eval_business_date
              and split_part(v_shift_instance_key, '|', 5) ~ '^window:[0-9]+$'
              and split_part(checkin_row.shift_instance_key, '|', 5) ~ '^window:[0-9]+$'
              and split_part(v_shift_instance_key, '|', 5) <> split_part(checkin_row.shift_instance_key, '|', 5)
              and split_part(v_shift_instance_key, '|', 8) in ('weekly', 'override')
              and split_part(checkin_row.shift_instance_key, '|', 8) in ('weekly', 'override')
              and nullif(p_checkin_insert->>'schedule_source', '') = split_part(v_shift_instance_key, '|', 8)
              and split_part(v_shift_instance_key, '|', 1) = p_staff_id::text
              and split_part(v_shift_instance_key, '|', 2) = p_branch_id::text
              and split_part(v_shift_instance_key, '|', 3) = v_eval_business_date::text
              and split_part(v_shift_instance_key, '|', 4) = v_shift_type
              and split_part(checkin_row.shift_instance_key, '|', 1) = p_staff_id::text
              and split_part(checkin_row.shift_instance_key, '|', 2) = p_branch_id::text
              and split_part(checkin_row.shift_instance_key, '|', 3) = checkin_row.shift_date::text
              and split_part(checkin_row.shift_instance_key, '|', 4) = checkin_row.shift_type
              and exists (
                select 1
                from public.staff_schedules as next_window
                join public.staff_schedules as prior_window
                  on prior_window.staff_id = next_window.staff_id
                 and prior_window.id::text = split_part(checkin_row.shift_instance_key, '|', 9)
                where next_window.staff_id = p_staff_id
                  and next_window.id::text = split_part(v_shift_instance_key, '|', 9)
                  and next_window.is_active is true
                  and prior_window.is_active is true
                  and next_window.day_of_week = extract(dow from v_eval_business_date)::smallint
                  and prior_window.day_of_week = next_window.day_of_week
                  and coalesce(next_window.window_order, 1) > coalesce(prior_window.window_order, 1)
                  and split_part(v_shift_instance_key, '|', 5) = 'window:' || coalesce(next_window.window_order, 1)::text
                  and split_part(checkin_row.shift_instance_key, '|', 5) = 'window:' || coalesce(prior_window.window_order, 1)::text
                  and split_part(v_shift_instance_key, '|', 6) = to_char(next_window.start_time, 'HH24:MI:SS')
                  and split_part(v_shift_instance_key, '|', 7) = to_char(next_window.end_time, 'HH24:MI:SS')
                  and split_part(checkin_row.shift_instance_key, '|', 6) = to_char(prior_window.start_time, 'HH24:MI:SS')
                  and split_part(checkin_row.shift_instance_key, '|', 7) = to_char(prior_window.end_time, 'HH24:MI:SS')
                  and coalesce(next_window.shift_type, 'single') = v_shift_type
                  and coalesce(prior_window.shift_type, 'single') = checkin_row.shift_type
                  and nullif(p_checkin_insert->>'schedule_source_id', '') = next_window.id::text
                  -- Strict split-shift separation: prior window cannot cross midnight
                  -- and must end strictly before next_window begins (adjacent continuous
                  -- opening+closing coverage is NOT a split shift).
                  and coalesce(prior_window.ends_next_day, false) is false
                  and prior_window.start_time < prior_window.end_time
                  and prior_window.end_time < next_window.start_time
                  and next_window.start_time <> next_window.end_time
                  -- Authoritative scheduled start must match branch timezone and
                  -- occur strictly after the prior shift's actual checkout.
                  and coalesce(
                        nullif(p_checkin_insert->>'scheduled_start_at', '')::timestamptz,
                        ((v_eval_business_date + next_window.start_time) at time zone v_branch_timezone)
                      ) = ((v_eval_business_date + next_window.start_time) at time zone v_branch_timezone)
                  and ((v_eval_business_date + next_window.start_time) at time zone v_branch_timezone) > checkin_row.checked_out_at
                  and v_eval_scan_at > checkin_row.checked_out_at
                  -- Authorized clock-in window check (blocks premature scans such as
                  -- 11:01 AM for an 18:00 second window while permitting valid early
                  -- and late arrivals within configured branch thresholds).
                  and v_eval_scan_at >= ((v_eval_business_date + next_window.start_time) at time zone v_branch_timezone)
                                        - make_interval(mins => v_earliest_clock_in_before_mins)
                  and v_eval_scan_at <= least(
                        (((v_eval_business_date + case
                            when coalesce(next_window.ends_next_day, next_window.end_time <= next_window.start_time)
                            then 1 else 0
                          end) + next_window.end_time) at time zone v_branch_timezone),
                        ((v_eval_business_date + next_window.start_time) at time zone v_branch_timezone)
                          + make_interval(mins => v_latest_clock_in_after_mins)
                      )
                  and not exists (
                    select 1
                    from public.schedule_overrides as override_row
                    where override_row.staff_id = p_staff_id
                      and override_row.override_date = v_eval_business_date
                  )
              )
            ), false)
          )
        )
      order by
        case when checkin_row.status = 'checked_in' and checkin_row.checked_out_at is null then 0 else 1 end,
        checkin_row.checked_out_at desc nulls last,
        checkin_row.checked_in_at desc nulls last
      limit 1
      for update;
    end if;

    if found then
      v_checkin_id := v_existing_checkin.id;
      p_action := 'duplicate_scan';
      p_outcome := 'noop';
      p_reason_code := case
        when v_existing_checkin.status = 'checked_out' or v_existing_checkin.checked_out_at is not null
          then 'already_checked_out'
        else 'already_checked_in'
      end;
      p_message := case
        when v_existing_checkin.status = 'checked_out' or v_existing_checkin.checked_out_at is not null
          then 'A completed shift received another scan.'
        else coalesce(p_message, 'Attendance already exists for this shift.')
      end;
      -- Suppress any false recovery exception when converting a duplicate or
      -- post-checkout scan into an atomic no-op.
      p_exception := null;
      v_operation_result := jsonb_build_object(
        'ok', true,
        'outcome', 'noop',
        'severity', 'info',
        'title', case
          when v_existing_checkin.status = 'checked_out' or v_existing_checkin.checked_out_at is not null
            then 'Attendance is already complete'
          else 'Already clocked in'
        end,
        'message', case
          when v_existing_checkin.status = 'checked_out' or v_existing_checkin.checked_out_at is not null
            then 'A clock-out is already recorded for this shift. No new attendance record was created.'
          else 'Attendance is already open for this scheduled shift.'
        end,
        'reasonCode', case
          when v_existing_checkin.status = 'checked_out' or v_existing_checkin.checked_out_at is not null
            then 'already_checked_out'
          else 'already_checked_in'
        end,
        'securityNote', case
          when v_existing_checkin.status = 'checked_out' or v_existing_checkin.checked_out_at is not null
            then 'The completed attendance record was not changed.'
          else 'No new attendance record was created.'
        end
      );
    else
      -- Before inserting a brand-new attendance session, enforce server-side
      -- timestamp provenance and authoritative business-date integrity.
      if not v_timestamp_trusted then
        return query select false, 'invalid_checkin_timestamp', null::uuid, null::uuid, null::uuid, null::jsonb, 'Attendance check-in timestamp is outside the allowed server window without verified scan provenance.';
        return;
      end if;

      if v_supplied_business_date is not null and v_supplied_business_date <> v_authoritative_business_date then
        return query select false, 'invalid_business_date', null::uuid, null::uuid, null::uuid, null::jsonb, 'Supplied attendance_business_date does not match the authoritative branch business date.';
        return;
      end if;

      -- Normalize post-midnight pre-boundary local calendar shift_date if an
      -- unscheduled caller sent local calendar date; reject any forged future
      -- or mismatched shift_date.
      if v_shift_date <> v_authoritative_business_date then
        if v_local_scan_ts::time < v_day_boundary and v_shift_date = v_local_scan_ts::date and v_shift_instance_key is null then
          v_shift_date := v_authoritative_business_date;
        else
          return query select false, 'invalid_business_date', null::uuid, null::uuid, null::uuid, null::jsonb, 'Supplied shift_date does not match the authoritative branch business date.';
          return;
        end if;
      end if;

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
        v_effective_scan_at,
        coalesce(nullif(p_checkin_insert->>'status', ''), 'checked_in'),
        p_qr_point_id,
        coalesce(nullif(p_checkin_insert->>'clock_in_method', ''), 'qr'),
        nullif(p_checkin_insert->>'scheduled_start_at', '')::timestamptz,
        nullif(p_checkin_insert->>'scheduled_end_at', '')::timestamptz,
        nullif(p_checkin_insert->>'schedule_source', ''),
        nullif(p_checkin_insert->>'schedule_source_id', ''),
        v_branch_timezone,
        v_authoritative_business_date,
        coalesce((p_checkin_insert->>'late_minutes')::integer, 0),
        coalesce(nullif(p_checkin_insert->>'attendance_status', ''), 'present'),
        coalesce(nullif(p_checkin_insert->>'exception_state', ''), 'none'),
        p_is_test,
        nullif(p_checkin_insert->>'notes', '')
      )
      returning id into v_checkin_id;
    end if;
  end if;

  -- P0-01-E: Suppress false post-completion recovery exceptions on standalone
  -- recovery paths (p_checkin_insert IS NULL AND p_checkin_update IS NULL),
  -- while preserving genuine missing-attendance recovery and security/branch
  -- exceptions.
  if p_checkin_insert is null
     and p_checkin_update is null
     and p_scan_type = 'attendance'
     and p_staff_id is not null
     and p_exception is not null then
    v_internal_exception_type := coalesce(
      nullif(p_exception->'metadata'->>'internalExceptionType', ''),
      nullif(p_reason_code, ''),
      nullif(p_exception->>'exception_type', '')
    );

    if v_internal_exception_type in (
      'already_checked_out',
      'likely_closing_scan_without_clock_in',
      'ambiguous_scan',
      'missing_schedule',
      'off_day_exception',
      'duplicate_scan'
    ) then
      v_eval_scan_at := case
        when v_timestamp_trusted then v_effective_scan_at
        when v_unverified_req_business_date is not null then v_requested_scan_at
        else v_effective_scan_at
      end;
      v_eval_business_date := case
        when v_timestamp_trusted then v_authoritative_business_date
        when v_unverified_req_business_date is not null then v_unverified_req_business_date
        else v_authoritative_business_date
      end;

      select exists (
        select 1
        from public.staff_shift_checkins as open_row
        where open_row.staff_id = p_staff_id
          and open_row.branch_id = p_branch_id
          and open_row.is_test = p_is_test
          and open_row.status = 'checked_in'
          and open_row.checked_out_at is null
      ) into v_has_open_checkin;

      if not v_has_open_checkin then
        select checkin_row.*
          into v_existing_checkin
        from public.staff_shift_checkins as checkin_row
        where checkin_row.staff_id = p_staff_id
          and checkin_row.branch_id = p_branch_id
          and checkin_row.is_test = p_is_test
          and checkin_row.status <> 'voided'
          and (checkin_row.status = 'checked_out' or checkin_row.checked_out_at is not null)
          and checkin_row.checked_out_at is not null
          and (
            coalesce(checkin_row.attendance_business_date, checkin_row.shift_date) = v_eval_business_date
            or (
              not v_timestamp_trusted
              and coalesce(checkin_row.attendance_business_date, checkin_row.shift_date) = v_authoritative_business_date
            )
          )
        order by checkin_row.checked_out_at desc nulls last
        limit 1
        for update;

        if found then
          -- Preserve genuine closing-scan recovery ONLY if there is an active,
          -- non-adjacent later weekly split-shift window on this business date
          -- that has NOT been completed and whose clock-in or clock-out window
          -- covers v_eval_scan_at.
          select exists (
            select 1
            from public.staff_schedules as next_window
            where next_window.staff_id = p_staff_id
              and next_window.is_active is true
              and next_window.day_of_week = extract(dow from v_eval_business_date)::smallint
              and next_window.start_time <> next_window.end_time
              and not exists (
                select 1
                from public.schedule_overrides as override_row
                where override_row.staff_id = p_staff_id
                  and override_row.override_date = v_eval_business_date
              )
              and exists (
                select 1
                from public.staff_schedules as prior_window
                where prior_window.staff_id = p_staff_id
                  and prior_window.is_active is true
                  and prior_window.day_of_week = next_window.day_of_week
                  and coalesce(prior_window.window_order, 1) < coalesce(next_window.window_order, 1)
                  and coalesce(prior_window.ends_next_day, false) is false
                  and prior_window.start_time < prior_window.end_time
                  and prior_window.end_time < next_window.start_time
              )
              and not exists (
                select 1
                from public.staff_shift_checkins as done_row
                where done_row.staff_id = p_staff_id
                  and done_row.branch_id = p_branch_id
                  and done_row.is_test = p_is_test
                  and done_row.status <> 'voided'
                  and (done_row.status = 'checked_out' or done_row.checked_out_at is not null)
                  and coalesce(done_row.attendance_business_date, done_row.shift_date) = v_eval_business_date
                  and (
                    done_row.shift_instance_key like '%|window:' || coalesce(next_window.window_order, 1)::text || '|%'
                    or done_row.checked_out_at >= ((v_eval_business_date + next_window.start_time) at time zone v_branch_timezone)
                  )
              )
              and v_eval_scan_at >= ((v_eval_business_date + next_window.start_time) at time zone v_branch_timezone)
                                    - make_interval(mins => v_earliest_clock_in_before_mins)
              and v_eval_scan_at <= (((v_eval_business_date + case
                    when coalesce(next_window.ends_next_day, next_window.end_time <= next_window.start_time)
                    then 1 else 0
                  end) + next_window.end_time) at time zone v_branch_timezone)
                    + make_interval(mins => v_clock_out_after_mins)
          ) into v_has_eligible_uncompleted_split;

          if not v_has_eligible_uncompleted_split then
            v_checkin_id := v_existing_checkin.id;
            p_action := 'duplicate_scan';
            p_outcome := 'noop';
            p_reason_code := 'already_checked_out';
            p_message := 'A completed shift received another scan.';
            p_exception := null;
            v_operation_result := jsonb_build_object(
              'ok', true,
              'outcome', 'noop',
              'severity', 'info',
              'title', 'Attendance is already complete',
              'message', 'A clock-out is already recorded for this shift. No new attendance record was created.',
              'reasonCode', 'already_checked_out',
              'securityNote', 'The completed attendance record was not changed.'
            );
          end if;
        end if;
      end if;
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
           operation_id = v_request_id
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
      v_request_id,
      p_user_agent,
      v_ip_address,
      v_metadata,
      p_is_test,
      v_request_id
    )
    returning id into v_scan_event_id;
  end if;

  if v_checkin_id is not null and p_staff_id is not null then
    if p_action = 'clock_in' then
      update public.staff_shift_checkins
         set clock_in_scan_event_id = coalesce(clock_in_scan_event_id, v_scan_event_id),
             updated_at = v_now
       where id = v_checkin_id
         and staff_id = p_staff_id
         and branch_id = p_branch_id
         and is_test = p_is_test
         and status = 'checked_in';
    elsif p_action = 'clock_out' and p_checkin_update is not null then
      update public.staff_shift_checkins
         set clock_out_scan_event_id = coalesce(clock_out_scan_event_id, v_scan_event_id),
             updated_at = v_now
       where id = v_checkin_id
         and staff_id = p_staff_id
         and branch_id = p_branch_id
         and is_test = p_is_test;
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
     set operation_id = coalesce(v_request_id, operation_id),
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
) is 'Atomically commits an attendance or QR scan, enforcing completed-shift no-op protection, server-authoritative business-date and split-shift clock-in window validation, verified clock-out timestamp and worked-minute integrity, false-recovery suppression, and scan event idempotency.';

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
) from public, anon, authenticated;

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

notify pgrst, 'reload schema';

commit;

