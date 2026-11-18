-- Attendance Lifecycle Correction candidate. LOCAL/TEST only until independent review and owner release.
-- Reconciles:
--   1. Stale recovery exception attribution (attribute missed_checkout / stale_open_checkin to original stale session & business date, never today's active session).
--   2. Approved 120-minute one-scan arrival policy and dynamic effective shift end / early-release credit bounds.
--   3. Automatic actionable reminders: +20m after effective authorized shift end, +10m after verified final home-service completion + operational buffers.
--   4. Overnight shift protection (no premature midnight auto-close before shift end + reminder window).
--   5. Live pre-dispatch push revalidation + automatic cancellation/suppression on clock-out + deduplication & delivery evidence preservation.

begin;

do $$ begin
  if to_regprocedure('public.recalculate_attendance_clock_out_policy(uuid,timestamptz)') is null
     or to_regprocedure('public.commit_attendance_scan_transaction(text,uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,jsonb,boolean,jsonb,uuid,jsonb,jsonb,jsonb,text)') is null
     or to_regprocedure('public.process_due_attendance_v2(timestamptz,integer)') is null
     or to_regclass('attendance_v2_private.work') is null then
    raise exception 'Attendance lifecycle correction prerequisites missing. Ensure Attendance V2 migration 20261116094630 is applied.';
  end if;
end $$;

-- 1. Fix stale recovery exception attribution so yesterday's missed clock-out
-- never pollutes today's newly opened checkin row or attaches exception_state='open' to clean today arrivals.
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
  v_current_business_date date := coalesce(nullif(p_current_checkin->>'attendance_business_date', '')::date, nullif(p_current_checkin->>'shift_date', '')::date);
  v_worked_minutes integer;
  v_stale_was_open boolean := false;
  v_stale_business_date date;
  v_commit record;
  v_now timestamptz := now();
  v_exc_branch_id uuid;
  v_exc_dedupe_key text;
  v_exc_metadata jsonb;
  v_exc_id uuid;
  v_exc_related uuid[];
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

  v_stale_business_date := coalesce(v_stale.attendance_business_date, v_stale.shift_date);

  if v_stale_was_open then
    if p_recovery_clock_out_at <= v_stale.checked_in_at
       or p_recovery_clock_out_at > v_now + interval '1 minute' then
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
           provisional_auto_closed_at = v_now,
           clock_out_confirmation_required = true,
           notes = concat_ws(E'\n', nullif(v_stale.notes, ''), 'Recovered automatically before a valid later-shift clock-in.'),
           updated_at = v_now
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
      coalesce(nullif(p_current_checkin->>'checked_in_at', '')::timestamptz, v_now),
      'checked_in', p_qr_point_id, 'qr',
      nullif(p_current_checkin->>'scheduled_start_at', '')::timestamptz,
      nullif(p_current_checkin->>'scheduled_end_at', '')::timestamptz,
      nullif(p_current_checkin->>'schedule_source', ''),
      nullif(p_current_checkin->>'schedule_source_id', ''),
      coalesce(nullif(p_current_checkin->>'branch_timezone', ''), 'Asia/Manila'),
      v_current_business_date,
      coalesce((p_current_checkin->>'late_minutes')::integer, 0),
      coalesce(nullif(p_current_checkin->>'attendance_status', ''), 'present'),
      coalesce(nullif(p_current_checkin->>'exception_state', ''), 'none'),
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
      'staleShiftDate', v_stale.shift_date,
      'staleBusinessDate', v_stale_business_date,
      'staleRecoveredAt', p_recovery_clock_out_at
    ),
    p_is_test => p_is_test,
    p_public_result => p_public_result,
    p_checkin_id => v_current_id,
    p_exception => null::jsonb,
    p_device_scan_type => 'attendance'
  );

  if v_commit.success is distinct from true then
    raise exception 'Attendance stale recovery audit commit failed: %', coalesce(v_commit.code, 'unknown');
  end if;

  if p_exception is not null and v_stale.id is not null and coalesce(v_commit.code, '') <> 'replayed' then
    v_exc_branch_id := coalesce(v_stale.branch_id, p_current_branch_id);
    v_exc_dedupe_key := coalesce(
      nullif(p_exception->>'dedupe_key', ''),
      concat_ws('|', p_staff_id::text, p_stale_checkin_id::text, 'stale_open_checkin', case when p_is_test then 'test' else 'live' end)
    );
    v_exc_metadata := coalesce(p_exception->'metadata', '{}'::jsonb) || jsonb_build_object(
      'dedupeKey', v_exc_dedupe_key,
      'staleCheckinId', p_stale_checkin_id,
      'staleShiftDate', v_stale.shift_date,
      'staleBusinessDate', v_stale_business_date,
      'recoveredByCurrentCheckinId', v_current_id,
      'recoveredAtBusinessDate', v_current_business_date
    );

    select e.id, e.related_checkin_ids
      into v_exc_id, v_exc_related
    from public.attendance_exceptions as e
    where e.branch_id = v_exc_branch_id
      and e.is_test = p_is_test
      and e.status = 'open'
      and e.dedupe_key = v_exc_dedupe_key
    limit 1
    for update;

    if v_exc_id is not null then
      v_exc_related := coalesce(v_exc_related, '{}'::uuid[]);
      if not (p_stale_checkin_id = any(v_exc_related)) then
        v_exc_related := array_append(v_exc_related, p_stale_checkin_id);
      end if;

      update public.attendance_exceptions
         set checkin_id = p_stale_checkin_id,
             latest_scan_event_id = v_commit.scan_event_id,
             metadata = coalesce(metadata, '{}'::jsonb) || v_exc_metadata,
             last_detected_at = v_now,
             related_checkin_ids = v_exc_related,
             updated_at = v_now
       where id = v_exc_id;
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
        detected_at,
        first_detected_at,
        last_detected_at,
        related_checkin_ids,
        recommended_action,
        priority,
        is_test
      )
      values (
        v_exc_branch_id,
        p_staff_id,
        p_stale_checkin_id,
        coalesce(v_stale.clock_in_scan_event_id, v_commit.scan_event_id),
        v_commit.scan_event_id,
        coalesce(nullif(p_exception->>'exception_type', ''), 'missed_checkout'),
        coalesce(nullif(p_exception->>'severity', ''), 'warning'),
        coalesce(nullif(p_exception->>'message', ''), 'An earlier open Attendance record was recovered before clock-in.'),
        v_exc_metadata,
        v_exc_dedupe_key,
        1,
        coalesce(v_stale.scheduled_end_at, v_stale.checked_in_at, v_now),
        coalesce(v_stale.checked_in_at, v_now),
        v_now,
        array[p_stale_checkin_id],
        coalesce(nullif(p_exception->>'recommended_action', ''), 'review_recovered_clock_out'),
        coalesce(nullif(p_exception->>'priority', ''), 'high'),
        p_is_test
      );
    end if;
  end if;

  return query select true, v_commit.code, p_stale_checkin_id, v_current_id,
    v_commit.scan_event_id, v_commit.operation_result, v_commit.message;
end;
$$;

-- 2. Reconcile credit guard with verified home-service early release & exact arrival vs credited start.
create or replace function attendance_v2_private.guard_credit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_credit jsonb;
  v_start timestamptz;
  v_end timestamptz;
  v_schedule_bound timestamptz;
  v_actual timestamptz;
  v_state text;
  v_enabled timestamptz;
  v_service_end timestamptz;
  v_source uuid;
  v_buffer_mins integer;
  v_completion_bound timestamptz;
  v_cash_end timestamptz;
  v_source_kind text;
  v_has_active_work boolean;
begin
  select enabled_at into v_enabled from attendance_v2_private.control where id;
  if tg_op = 'INSERT' then
    if v_enabled is null or new.checked_in_at < v_enabled
       or new.clock_in_method <> 'qr' then return new; end if;
    -- Same global staff row used by the canonical scan RPC serializes branches.
    perform 1 from public.staff where id = new.staff_id for update;
    if exists(select 1 from public.staff_shift_checkins c
      where c.staff_id = new.staff_id and c.status = 'checked_in'
        and c.checked_out_at is null and c.is_test = new.is_test and c.id <> new.id) then
      raise exception using errcode='23514', message='attendance_conflicting_open_session';
    end if;
    v_credit := jsonb_build_object('version', 2);
  else
    v_credit := old.attendance_policy_snapshot->'v2';
    if v_credit->>'version' is distinct from '2' then return new; end if;
    -- Policy refreshes may replace the legacy snapshot; retain V2 evidence.
    v_credit := v_credit || coalesce(new.attendance_policy_snapshot->'v2', '{}');
  end if;

  v_start := greatest(new.checked_in_at, new.scheduled_start_at);
  v_schedule_bound := greatest(
    new.scheduled_end_at,
    nullif(new.attendance_policy_snapshot->>'resolvedScheduleEndAt', '')::timestamptz
  );
  v_end := coalesce(
    nullif(v_credit->>'authorizedEndAt', '')::timestamptz,
    v_schedule_bound,
    new.scheduled_end_at
  );
  v_end := greatest(v_end, v_schedule_bound);

  v_source := nullif(new.attendance_policy_snapshot->>'sourceBookingId', '')::uuid;
  v_source_kind := coalesce(
    nullif(new.attendance_policy_snapshot->>'kind', ''),
    new.attendance_policy_source,
    'schedule'
  );
  v_buffer_mins := least(360, greatest(0, coalesce((new.attendance_policy_snapshot->>'appliedBufferMinutes')::integer, 0)));
  v_has_active_work :=
    coalesce((new.attendance_policy_snapshot->>'hasActiveAssignment')::boolean, false) or
    coalesce((new.attendance_policy_snapshot->>'hasUpcomingAssignment')::boolean, false);

  if v_source is not null then
    select greatest(b.session_completed_at, b.completed_at)
    into v_service_end
    from public.bookings b
    where b.id = v_source and b.branch_id = new.branch_id
      and b.status not in ('cancelled', 'no_show')
      and coalesce(b.booking_progress_status, '') <> 'no_show'
      and (b.staff_id = new.staff_id or b.driver_id = new.staff_id or
        new.attendance_policy_snapshot->>'staffCategory' = 'crm_front_desk');
    if v_service_end is not null then
      v_completion_bound := v_service_end + make_interval(mins => v_buffer_mins);
      if v_source_kind in ('home_service', 'driver_trip')
         and not v_has_active_work
         and new.attendance_expected_end_at is not null
         and new.attendance_expected_end_at <= v_completion_bound + interval '1 second'
         and new.attendance_expected_end_at >= new.checked_in_at then
        v_end := v_completion_bound;
      else
        v_end := greatest(v_end, v_completion_bound);
      end if;
    end if;
  end if;

  if new.attendance_policy_snapshot->>'staffCategory' = 'crm_front_desk'
     and to_regclass('public.cash_sessions') is not null
     and to_regclass('public.cash_session_handovers') is not null then
    select greatest(
      (select max(cs.closed_at) from public.cash_sessions cs where cs.branch_id = new.branch_id
        and cs.closed_by = new.staff_id and cs.closed_at >= new.checked_in_at
        and cs.business_date = coalesce(new.attendance_business_date, new.shift_date)
        and cs.closed_at <= coalesce(new.checked_out_at, now())),
      (select max(h.created_at) from public.cash_session_handovers h join public.cash_sessions cs on cs.id = h.cash_session_id
        where h.branch_id = new.branch_id and cs.branch_id = new.branch_id
        and cs.business_date = coalesce(new.attendance_business_date, new.shift_date)
        and h.outgoing_custodian_id = new.staff_id and h.created_at >= new.checked_in_at
        and h.created_at <= coalesce(new.checked_out_at, now()))) into v_cash_end;
    v_end := greatest(v_end, v_cash_end);
  end if;

  if new.scheduled_start_at is null or new.scheduled_end_at is null then
    v_end := null;
  end if;

  v_actual := case when new.clock_out_method in (
    'qr', 'staff_portal_home_service', 'staff_portal_closing_shift', 'driver_portal_final_trip'
  ) then new.checked_out_at else null end;

  v_state := case
    when v_end is null then 'review'
    when new.checked_out_at is null and (new.clock_in_method = 'manual_review' or new.clock_out_method = 'manual_review') then 'review'
    when new.clock_out_method = 'system_auto_close' or new.checked_out_at is null then 'preliminary'
    when new.checked_out_at > v_end or new.exception_state = 'open' then 'review'
    else 'final' end;

  if tg_op = 'UPDATE' and new.clock_out_method = 'manual_review'
     and (new.checked_out_at is distinct from old.checked_out_at or old.clock_out_method = 'system_auto_close') then
    new.provisional_auto_closed_at := null;
    new.clock_out_confirmation_required := false;
  end if;

  new.worked_minutes := case when v_end is null or new.checked_out_at is null then 0
    else greatest(0, round(extract(epoch from (least(new.checked_out_at, v_end) - v_start)) / 60.0)::integer) end;

  new.attendance_policy_snapshot := coalesce(new.attendance_policy_snapshot, '{}') ||
    jsonb_build_object('v2', v_credit || jsonb_build_object(
      'version', 2,
      'actualArrivalAt', new.checked_in_at,
      'creditedStartAt', v_start,
      'revision', case when tg_op = 'INSERT' then 1 else coalesce((old.attendance_policy_snapshot->'v2'->>'revision')::integer, 0) + 1 end,
      'authorizedEndAt', v_end,
      'creditedEndAt', case when new.checked_out_at is null then null else least(new.checked_out_at, v_end) end,
      'actualClockOutAt', v_actual,
      'state', v_state,
      'reason', case when v_end is null then 'missing_schedule_end'
        when new.checked_out_at > v_end then 'unverified_overtime'
        when new.clock_out_method = 'system_auto_close' then 'system_provisional_closure'
        else 'scheduled_credit' end));

  return new;
end;
$$;

-- 3. Update due enrollment so standard shift reminders wake at +20m and
-- final home-service completions wake at +10m after completion + buffer.
create or replace function attendance_v2_private.track_work() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_delay interval;
  v_candidate_due timestamptz;
begin
  if new.is_test or new.attendance_policy_snapshot->'v2'->>'version' is distinct from '2' then return new; end if;

  if new.attendance_policy_snapshot->'v2'->>'state' = 'review' then
    insert into public.attendance_exceptions(branch_id,staff_id,checkin_id,exception_type,severity,
      message,metadata,dedupe_key,recommended_action,priority,is_test)
    select new.branch_id,new.staff_id,new.id,'manual','warning',
      'The credited working period requires authorized review. Actual attendance evidence is preserved.',
      jsonb_build_object('internalExceptionType','attendance_work_time_review','credit',new.attendance_policy_snapshot->'v2'),
      'attendance-v2-credit-review:'||new.id::text,'review_clock_out','high',new.is_test
    where not exists(select 1 from public.attendance_exceptions e
      where e.dedupe_key='attendance-v2-credit-review:'||new.id::text and e.status='open');
  elsif new.attendance_policy_snapshot->'v2'->>'state' = 'final' then
    update public.attendance_exceptions set status='resolved',resolved_at=now(),resolution_status='resolved',
      resolution_action='accept_recorded_attendance',
      resolution_note='Credited time reconciled through the canonical attendance writer.'
    where checkin_id=new.id and dedupe_key='attendance-v2-credit-review:'||new.id::text and status='open';
  end if;

  if new.status <> 'checked_in' or new.checked_out_at is not null
     or new.clock_in_method = 'manual_review' or new.clock_out_method = 'manual_review' then
    update public.workspace_notifications set status='resolved',resolved_at=now(),requires_action=false
    where entity_type='attendance_record' and entity_id=new.id
      and type='attendance_clock_out_reminder' and status in ('unread','read');
    update attendance_v2_private.delivery set state='suppressed',last_error='attendance_closed'
    where checkin_id=new.id and state in ('queued','attempted','failed');
    delete from attendance_v2_private.work where checkin_id=new.id;
  else
    if coalesce((new.attendance_policy_snapshot->>'hasActiveAssignment')::boolean, false)
       or coalesce((new.attendance_policy_snapshot->>'hasUpcomingAssignment')::boolean, false) then
      perform attendance_v2_private.suppress_reminders(new.id, now());
      update attendance_v2_private.work
         set generation = generation + 1,
             last_interval = 0
       where checkin_id = new.id
         and last_interval <> 0;
    end if;
    v_delay := case
      when coalesce(new.attendance_policy_snapshot->>'kind', new.attendance_policy_source, 'schedule') in ('home_service', 'driver_trip')
        and nullif(new.attendance_policy_snapshot->>'sourceCompletionAt', '') is not null
        then interval '10 minutes'
      else interval '20 minutes'
    end;
    v_candidate_due := coalesce(
      coalesce(
        nullif(new.attendance_policy_snapshot->'v2'->>'authorizedEndAt', '')::timestamptz,
        new.attendance_expected_end_at,
        new.scheduled_end_at
      ) + v_delay,
      now()
    );
    insert into attendance_v2_private.work(checkin_id, next_due_at)
    values(new.id, coalesce(new.scheduled_end_at + interval '20 minutes', now()))
    on conflict(checkin_id) do update
      set next_due_at = least(attendance_v2_private.work.next_due_at, v_candidate_due);
  end if;
  return new;
end;
$$;

-- 4. Canonical reminder schedule computation shared by process_due_attendance_v2 and validate_attendance_v2_push.
create or replace function attendance_v2_private.resolve_reminder_schedule(
  p_checkin public.staff_shift_checkins,
  p_policy jsonb,
  p_now timestamptz
) returns table (
  authorized_end_at timestamptz,
  reminder_kind text,
  delay_minutes integer,
  has_active_duty boolean,
  portal_eligible boolean,
  portal_method text,
  cash_end_at timestamptz,
  closing_shift boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_snapshot jsonb := coalesce(p_policy->'attendance_policy_snapshot', '{}'::jsonb);
  v_category text := coalesce(nullif(v_snapshot->>'staffCategory', ''), 'other');
  v_source text := coalesce(nullif(v_snapshot->>'kind', ''), p_policy->>'attendance_policy_source', p_checkin.attendance_policy_source, 'schedule');
  v_buffer integer := least(360, greatest(0, coalesce((v_snapshot->>'appliedBufferMinutes')::integer, 0)));
  v_schedule_bound timestamptz;
  v_policy_expected timestamptz := nullif(p_policy->>'attendance_expected_end_at', '')::timestamptz;
  v_source_booking_id uuid := nullif(v_snapshot->>'sourceBookingId', '')::uuid;
  v_verified_end timestamptz;
  v_completion_deadline timestamptz;
  v_cash_active boolean := false;
  v_cash_end timestamptz;
  v_closing boolean;
  v_active boolean;
  v_end timestamptz;
  v_kind text := 'shift_end';
  v_delay integer := 20;
begin
  v_closing := exists(
    select 1 from public.staff s
    where s.id = p_checkin.staff_id
      and public.resolve_attendance_staff_category(s) = 'crm_front_desk'
  ) and lower(coalesce(p_checkin.shift_type, '')) = 'closing';

  v_schedule_bound := greatest(
    p_checkin.scheduled_end_at,
    nullif(v_snapshot->>'resolvedScheduleEndAt', '')::timestamptz
  );
  v_active :=
    coalesce((p_policy->>'has_active_assignment')::boolean, false) or
    coalesce((p_policy->>'has_upcoming_assignment')::boolean, false);

  if v_closing then
    if to_regclass('public.cash_sessions') is null or to_regclass('public.cash_session_handovers') is null then
      raise exception 'Cash closing evidence unavailable';
    end if;
    perform 1 from public.cash_sessions cs where cs.branch_id = p_checkin.branch_id
      and cs.business_date = coalesce(p_checkin.attendance_business_date, p_checkin.shift_date)
      and coalesce(cs.current_custodian_id, cs.opened_by) = p_checkin.staff_id for share;
    select exists(select 1 from public.cash_sessions cs where cs.branch_id = p_checkin.branch_id
      and cs.status = 'open' and cs.business_date = coalesce(p_checkin.attendance_business_date, p_checkin.shift_date)
      and coalesce(cs.current_custodian_id, cs.opened_by) = p_checkin.staff_id)
      into v_cash_active;
    select greatest(
      (select max(cs.closed_at) from public.cash_sessions cs where cs.branch_id = p_checkin.branch_id and cs.closed_by = p_checkin.staff_id
        and cs.business_date = coalesce(p_checkin.attendance_business_date, p_checkin.shift_date)
        and cs.closed_at >= p_checkin.checked_in_at and cs.closed_at <= p_now),
      (select max(h.created_at) from public.cash_session_handovers h join public.cash_sessions cs on cs.id = h.cash_session_id
        where h.branch_id = p_checkin.branch_id and cs.branch_id = p_checkin.branch_id
        and cs.business_date = coalesce(p_checkin.attendance_business_date, p_checkin.shift_date)
        and h.outgoing_custodian_id = p_checkin.staff_id and h.created_at >= p_checkin.checked_in_at and h.created_at <= p_now))
      into v_cash_end;
    v_active := v_active or coalesce(v_cash_active, false);
  end if;

  if v_source_booking_id is not null then
    select greatest(b.session_completed_at, b.completed_at)
    into v_verified_end
    from public.bookings b
    where b.id = v_source_booking_id
      and b.branch_id = p_checkin.branch_id
      and b.status not in ('cancelled', 'no_show')
      and coalesce(b.booking_progress_status, '') <> 'no_show';
    if v_verified_end is not null then
      v_completion_deadline := v_verified_end + make_interval(mins => v_buffer);
    end if;
  end if;

  -- Reconcile authorized shift end:
  -- Final home-service assignments (verified completion + required operational buffers)
  -- unlock +10m reminders when released by policy (drivers, closing, final release, or completion >= scheduled end).
  if v_source in ('home_service', 'driver_trip') and v_completion_deadline is not null then
    if not v_active and (
      v_completion_deadline >= v_schedule_bound
      or (v_policy_expected is not null and v_policy_expected <= v_completion_deadline + interval '1 second')
    ) then
      v_end := v_completion_deadline;
      v_kind := 'final_home_service';
      v_delay := 10;
    else
      v_end := greatest(v_schedule_bound, v_completion_deadline, nullif(p_checkin.attendance_policy_snapshot->'v2'->>'authorizedEndAt', '')::timestamptz);
      v_kind := 'shift_end';
      v_delay := 20;
    end if;
  else
    v_end := greatest(
      v_schedule_bound,
      nullif(p_checkin.attendance_policy_snapshot->'v2'->>'authorizedEndAt', '')::timestamptz,
      v_completion_deadline,
      v_cash_end
    );
    v_kind := 'shift_end';
    v_delay := 20;
  end if;

  return query select
    v_end,
    v_kind,
    v_delay,
    v_active,
    coalesce((p_policy->>'portal_clock_out_eligible')::boolean, false),
    nullif(p_policy->>'portal_clock_out_method', ''),
    v_cash_end,
    v_closing;
end;
$$;
revoke all on function attendance_v2_private.resolve_reminder_schedule(public.staff_shift_checkins, jsonb, timestamptz) from public, anon, authenticated;

-- 5. Due processor: +20m standard / +10m final home service, overnight-safe closure,
-- actionable copy referencing commit_attendance_portal_clock_out, strict dedup.
create or replace function public.process_due_attendance_v2(
  p_processed_at timestamptz default now(), p_batch_size integer default 50
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  candidate record;
  c public.staff_shift_checkins%rowtype;
  w attendance_v2_private.work%rowtype;
  p jsonb;
  snapshot jsonb;
  v_plan record;
  v_settings_boundary time;
  v_end timestamptz;
  v_midnight timestamptz;
  v_business_day_end timestamptz;
  v_auto_close_at timestamptz;
  v_interval integer;
  v_elapsed_sec double precision;
  v_delay_sec double precision;
  v_repeat_sec double precision := 900.0;
  v_next_reminder_at timestamptz;
  v_key text;
  v_title text;
  v_body text;
  v_notice uuid;
  v_timezone text;
  v_workspace text;
  v_owns_closing boolean;
  v_examined integer := 0;
  v_reminded integer := 0;
  v_closed integer := 0;
  v_failed integer := 0;
  v_started timestamptz := clock_timestamp();
begin
  if p_processed_at is null or p_batch_size is null or p_batch_size not between 1 and 100 then
    raise exception 'Invalid Attendance V2 batch';
  end if;
  if not public.attendance_v2_enabled() then return jsonb_build_object('inactive', true); end if;
  select owns_closing into v_owns_closing from attendance_v2_private.control where id;

  for candidate in
    select q.checkin_id, a.branch_id, a.staff_id, a.is_test
    from attendance_v2_private.work q join public.staff_shift_checkins a on a.id = q.checkin_id
    where q.next_due_at <= p_processed_at
    order by q.next_due_at, q.checkin_id limit p_batch_size
  loop
    -- Match the canonical booking/scan lock order before taking the session row.
    if not pg_try_advisory_xact_lock(hashtext('attendance_scan_staff'),
      hashtext(concat_ws(':', candidate.branch_id, candidate.staff_id, candidate.is_test))) then continue; end if;
    select * into c from public.staff_shift_checkins where id = candidate.checkin_id for update skip locked;
    if not found then continue; end if;
    select * into w from attendance_v2_private.work where checkin_id = c.id for update;
    if not found or w.next_due_at > p_processed_at then continue; end if;
    v_examined := v_examined + 1;

    begin
      if c.checked_out_at is not null or c.status <> 'checked_in' or c.is_test then
        delete from attendance_v2_private.work where checkin_id = c.id;
        continue;
      end if;

      if exists(select 1 from public.staff s where s.id = c.staff_id
        and public.resolve_attendance_staff_category(s) = 'crm_front_desk')
         and lower(coalesce(c.shift_type, '')) = 'closing'
         and not v_owns_closing then
        update attendance_v2_private.work
           set next_due_at = p_processed_at + interval '5 minutes', last_reason = 'legacy_closing_owner'
         where checkin_id = c.id;
        continue;
      end if;

      if c.scheduled_end_at is null or c.scheduled_start_at is null then
        update attendance_v2_private.work
           set next_due_at = p_processed_at + interval '1 day', last_reason = 'missing_schedule_end'
         where checkin_id = c.id;
        continue;
      end if;

      if not exists(select 1 from public.staff s join public.branches b on b.id = c.branch_id
        where s.id = c.staff_id and s.is_active and s.archived_at is null and s.merged_into_staff_id is null
          and s.auth_user_id is not null and b.is_active)
         or not exists(select 1 from public.resolve_effective_attendance_branch(
           c.staff_id, c.branch_id, coalesce(c.attendance_business_date, c.shift_date), c.is_test) authority
           where authority.allowed and authority.effective_branch_id = c.branch_id) then
        update attendance_v2_private.work
           set next_due_at = p_processed_at + interval '1 day', last_reason = 'staff_branch_unverified'
         where checkin_id = c.id;
        continue;
      end if;

      p := public.recalculate_attendance_clock_out_policy(c.id, p_processed_at);
      if p->>'has_active_assignment' is null or p->>'has_upcoming_assignment' is null then
        raise exception 'Dynamic work evidence unavailable';
      end if;

      select * into c from public.staff_shift_checkins where id = c.id;
      snapshot := coalesce(p->'attendance_policy_snapshot', '{}'::jsonb);
      v_timezone := coalesce(nullif(snapshot->>'timezone', ''), c.branch_timezone);
      if v_timezone is null then raise exception 'Branch timezone unavailable'; end if;

      select * into v_plan
      from attendance_v2_private.resolve_reminder_schedule(c, p, p_processed_at);
      v_end := v_plan.authorized_end_at;

      -- A successful retry resolves only this processor's unreviewed transient issue.
      update public.attendance_exceptions
         set status = 'resolved', resolution_status = 'resolved',
             resolved_at = p_processed_at, resolution_action = 'accept_recorded_attendance',
             resolution_note = 'Work evidence revalidated by an automatic Attendance V2 retry.',
             metadata = metadata || jsonb_build_object('automaticResolution', 'work_evidence_revalidated', 'resolvedAt', p_processed_at)
       where checkin_id = c.id and dedupe_key = 'attendance-v2-processing:' || c.id::text
         and status = 'open' and reviewed_by is null;
      update attendance_v2_private.work set failures = 0 where checkin_id = c.id;

      if v_plan.has_active_duty then
        perform attendance_v2_private.suppress_reminders(c.id, p_processed_at);
        if coalesce((p->>'has_active_assignment')::boolean, false) or coalesce(v_plan.cash_end_at, '-infinity'::timestamptz) > p_processed_at - interval '1 minute' then
          v_end := greatest(v_end, p_processed_at);
        end if;
        update public.staff_shift_checkins
           set attendance_policy_snapshot = attendance_policy_snapshot ||
               jsonb_build_object('v2', coalesce(attendance_policy_snapshot->'v2', '{}'::jsonb) ||
                 jsonb_build_object('authorizedEndAt', v_end, 'activeWork', true))
         where id = c.id;
        update attendance_v2_private.work
           set next_due_at = p_processed_at + interval '5 minutes',
               generation = case when last_interval <> 0 then generation + 1 else generation end,
               last_interval = 0,
               last_reason = 'active_or_upcoming_work',
               updated_at = p_processed_at
         where checkin_id = c.id;
        continue;
      end if;

      update public.staff_shift_checkins
         set attendance_policy_snapshot = attendance_policy_snapshot ||
             jsonb_build_object('v2', coalesce(attendance_policy_snapshot->'v2', '{}'::jsonb) ||
               jsonb_build_object('authorizedEndAt', v_end, 'activeWork', false, 'reminderKind', v_plan.reminder_kind, 'reminderDelayMinutes', v_plan.delay_minutes))
       where id = c.id;

      if w.deadline is distinct from v_end then
        perform attendance_v2_private.suppress_reminders(c.id, p_processed_at);
        w.generation := w.generation + 1;
        w.last_interval := 0;
        update attendance_v2_private.work
           set deadline = v_end, generation = w.generation, last_interval = 0
         where checkin_id = c.id;
      end if;

      v_midnight := ((c.shift_date + 1)::timestamp at time zone v_timezone);
      select coalesce(attendance_day_boundary, '06:00:00'::time)
        into v_settings_boundary
      from public.attendance_settings where branch_id = c.branch_id;
      v_business_day_end := (((coalesce(c.attendance_business_date, c.shift_date) + 1)::timestamp + coalesce(v_settings_boundary, '06:00:00'::time)) at time zone v_timezone);

      -- Overnight shifts and day shifts extended near/across midnight must remain open past their
      -- first reminder + grace window (and past branch business-day end when crossing midnight).
      if c.scheduled_end_at >= v_midnight or v_end + make_interval(mins => v_plan.delay_minutes) >= v_midnight then
        v_auto_close_at := greatest(v_business_day_end, v_end + make_interval(mins => v_plan.delay_minutes + 40));
      else
        v_auto_close_at := greatest(v_midnight, v_end + make_interval(mins => v_plan.delay_minutes + 40));
      end if;

      if p_processed_at >= v_auto_close_at and p_processed_at >= v_end then
        update public.staff_shift_checkins
           set checked_out_at = v_end,
               status = 'checked_out',
               clock_out_method = 'system_auto_close',
               clock_out_scan_event_id = null,
               provisional_auto_closed_at = p_processed_at,
               clock_out_confirmation_required = true,
               exception_state = 'none',
               updated_at = p_processed_at
         where id = c.id;
        insert into public.attendance_corrections(branch_id,staff_id,checkin_id,attendance_date,
          correction_type,action_type,previous_values,new_values,reason,status,applied_at,corrected_at,is_test)
        values(c.branch_id,c.staff_id,c.id,coalesce(c.attendance_business_date, c.shift_date),'system_auto_close','system_auto_close',
          to_jsonb(c),jsonb_build_object('creditedEndAt',v_end,'actualClockOutAt',null,'version',2),
          'Attendance V2: expired shift provisionally reconciled; no employee clock-out recorded.',
          'applied',p_processed_at,p_processed_at,false);
        v_closed := v_closed + 1;
        continue;
      end if;

      v_elapsed_sec := extract(epoch from (p_processed_at - v_end));
      v_delay_sec := v_plan.delay_minutes * 60.0;
      if v_elapsed_sec >= v_delay_sec then
        v_interval := 1 + floor((v_elapsed_sec - v_delay_sec) / v_repeat_sec)::integer;
      else
        v_interval := 0;
      end if;

      if v_interval >= 1 and v_interval > w.last_interval then
        -- Retire any previous open reminder for this checkin before inserting the current interval.
        update public.workspace_notifications
           set status = 'resolved', resolved_at = p_processed_at, requires_action = false
         where entity_type = 'attendance_record'
           and entity_id = c.id
           and type = 'attendance_clock_out_reminder'
           and status in ('unread', 'read');

        v_key := concat_ws(':', 'staff-clock-out-reminder', 'v2', c.id, w.generation, v_plan.reminder_kind, v_interval);
        select case when s.system_role = 'driver' then 'driver'
                    when s.system_role = 'utility' then 'utility'
                    when s.system_role in ('crm', 'csr', 'csr_head', 'csr_staff') then 'crm'
                    else 'staff' end
          into v_workspace from public.staff s where s.id = c.staff_id;

        if v_plan.reminder_kind = 'final_home_service' then
          v_title := 'You forgot to clock out';
          if v_plan.portal_eligible then
            v_body := 'Your final home-service assignment and wrap-up buffer are complete with no remaining duty. Open My Attendance and tap "Clock out" if eligible, or use the branch QR.';
          else
            v_body := 'Your final home-service assignment and wrap-up buffer are complete with no remaining duty. Open My Attendance to scan the branch QR or contact CRM for help.';
          end if;
        else
          v_title := 'You forgot to clock out';
          if v_plan.portal_eligible then
            v_body := 'Your authorized shift has ended with no active duty remaining. Open My Attendance and tap "Clock out" if eligible, or use the branch QR.';
          else
            v_body := 'Your authorized shift has ended with no active duty remaining. Open My Attendance to scan the branch QR to clock out, or contact CRM for assistance.';
          end if;
        end if;

        insert into public.workspace_notifications(branch_id,target_workspace,recipient_staff_id,
          type,title,body,entity_type,entity_id,action_href,priority,status,requires_action,dedupe_key,metadata,created_at)
        values(
          c.branch_id, v_workspace, c.staff_id, 'attendance_clock_out_reminder',
          v_title, v_body, 'attendance_record', c.id, '/staff/attendance',
          'normal', 'unread', false, v_key,
          jsonb_build_object(
            'attendanceVersion', 2,
            'deadline', v_end,
            'interval', v_interval,
            'reminderKind', v_plan.reminder_kind,
            'delayMinutes', v_plan.delay_minutes,
            'portalClockOutEligible', v_plan.portal_eligible,
            'portalClockOutMethod', v_plan.portal_method
          ),
          p_processed_at
        )
        returning id into v_notice;

        insert into attendance_v2_private.delivery(notification_id,checkin_id,dedupe_key,next_attempt_at)
          values(v_notice, c.id, v_key, p_processed_at);

        update attendance_v2_private.work set last_interval = v_interval where checkin_id = c.id;
        v_reminded := v_reminded + 1;
      end if;

      v_next_reminder_at := case
        when v_interval < 1 then v_end + make_interval(mins => v_plan.delay_minutes)
        else v_end + make_interval(mins => v_plan.delay_minutes) + make_interval(secs => v_interval * v_repeat_sec)
      end;

      update attendance_v2_private.work
         set next_due_at = least(v_next_reminder_at, v_auto_close_at),
             last_reason = 'awaiting_clock_out',
             updated_at = p_processed_at
       where checkin_id = c.id;
    exception when others then
      v_failed := v_failed + 1;
      update attendance_v2_private.work
         set next_due_at = p_processed_at + interval '5 minutes',
             failures = failures + 1,
             last_reason = 'processing_failed:' || sqlstate,
             updated_at = p_processed_at
       where checkin_id = c.id;
      insert into public.attendance_exceptions(branch_id,staff_id,checkin_id,exception_type,severity,
        message,metadata,dedupe_key,recommended_action,priority,is_test)
      select c.branch_id,c.staff_id,c.id,'manual','warning',
        'Attendance work evidence could not be verified. This shift was left unchanged for review.',
        jsonb_build_object('internalExceptionType','attendance_work_evidence_unavailable','reasonCode',sqlstate),
        'attendance-v2-processing:'||c.id::text,'review_work_evidence','high',false
      where not exists(select 1 from public.attendance_exceptions e
        where e.dedupe_key='attendance-v2-processing:'||c.id::text and e.status='open');
    end;
  end loop;

  return jsonb_build_object(
    'examined', v_examined,
    'reminded', v_reminded,
    'provisionallyClosed', v_closed,
    'failed', v_failed,
    'durationMs', extract(epoch from (clock_timestamp() - v_started)) * 1000,
    'dueBacklog', (select count(*) from attendance_v2_private.work where next_due_at <= p_processed_at)
  );
end;
$$;
revoke all on function public.process_due_attendance_v2(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.process_due_attendance_v2(timestamptz, integer) to service_role;

-- 6. Revalidate live duty, active/upcoming assignments, and exact reminder delay right before push dispatch.
create or replace function public.validate_attendance_v2_push(p_notification_id uuid, p_lease_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  c public.staff_shift_checkins%rowtype;
  n public.workspace_notifications%rowtype;
  p jsonb;
  v_plan record;
  v_valid boolean := false;
  v_notice_kind text;
begin
  if not public.attendance_v2_enabled() then return false; end if;
  select a.* into c from public.staff_shift_checkins a
    join attendance_v2_private.delivery d on d.checkin_id = a.id
    where d.notification_id = p_notification_id;
  if not found then return false; end if;

  if not pg_try_advisory_xact_lock(hashtext('attendance_scan_staff'),
      hashtext(concat_ws(':', c.branch_id, c.staff_id, c.is_test))) then return false; end if;
  select * into c from public.staff_shift_checkins where id = c.id for update;
  select * into n from public.workspace_notifications where id = p_notification_id;

  if c.status = 'checked_in' and c.checked_out_at is null and not c.is_test
     and n.status = 'unread' and n.created_at > now() - interval '5 minutes'
     and exists(select 1 from attendance_v2_private.delivery d where d.notification_id = n.id
       and d.lease_token = p_lease_token and d.lease_until > now() and d.state = 'attempted')
     and exists(select 1 from public.staff s where s.id = c.staff_id and s.is_active
       and s.archived_at is null and s.merged_into_staff_id is null and s.auth_user_id is not null)
     and exists(select 1 from public.resolve_effective_attendance_branch(c.staff_id, c.branch_id,
       coalesce(c.attendance_business_date, c.shift_date), c.is_test) a where a.allowed and a.effective_branch_id = c.branch_id) then
    p := public.recalculate_attendance_clock_out_policy(c.id, now());
    select * into c from public.staff_shift_checkins where id = c.id;
    select * into v_plan from attendance_v2_private.resolve_reminder_schedule(c, p, now());
    v_notice_kind := coalesce(nullif(n.metadata->>'reminderKind', ''), v_plan.reminder_kind);
    v_valid :=
      not v_plan.has_active_duty
      and v_plan.authorized_end_at = nullif(n.metadata->>'deadline', '')::timestamptz
      and v_plan.reminder_kind = v_notice_kind
      and now() >= v_plan.authorized_end_at + make_interval(mins => v_plan.delay_minutes);
  end if;

  if coalesce(v_valid, false) then return true; end if;
  perform attendance_v2_private.suppress_reminders(c.id, now());
  return false;
end;
$$;
revoke all on function public.validate_attendance_v2_push(uuid, uuid) from public, anon, authenticated;
grant execute on function public.validate_attendance_v2_push(uuid, uuid) to service_role;

commit;
