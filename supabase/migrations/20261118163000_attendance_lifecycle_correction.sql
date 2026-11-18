-- Attendance Lifecycle Correction candidate. LOCAL/TEST only until independent review and owner release.
-- Reconciles:
--   1. Stale recovery exception attribution (attribute missed_checkout / stale_open_checkin to original stale session & business date, never today's active session).
--   2. Approved 120-minute one-scan arrival policy and dynamic effective shift end / early-release credit bounds.
--   3. Automatic actionable reminders: +20m after effective authorized shift end, +10m after verified final home-service completion + operational buffers.
--   4. Overnight shift protection (no premature midnight auto-close before shift end + reminder window).
--   5. Live pre-dispatch push revalidation + automatic cancellation/suppression on clock-out + deduplication & delivery evidence preservation.
--   6. Closing cash-session custody enforcement inside portal clock-out eligibility and commit RPCs.

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

-- 7. Enforce open cash-session custody check inside server-side portal clock-out eligibility and commit RPCs.
create or replace function public.recalculate_attendance_clock_out_policy(
  p_checkin_id uuid,
  p_calculated_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := coalesce(p_calculated_at, now());
  v_checkin public.staff_shift_checkins%rowtype;
  v_staff public.staff%rowtype;
  v_settings public.attendance_settings%rowtype;
  v_rule public.attendance_staff_category_rules%rowtype;
  v_rule_version public.attendance_rule_versions%rowtype;
  v_values jsonb := '{}'::jsonb;
  v_category text := 'other';
  v_timezone text;
  v_boundary time;
  v_business_date date;
  v_scope_start timestamptz;
  v_scope_end timestamptz;
  v_schedule_end timestamptz;
  v_override_end timestamptz;
  v_override_id uuid;
  v_source text := 'schedule';
  v_source_booking_id uuid;
  v_source_dispatch_id uuid;
  v_source_trip_id uuid;
  v_source_completion timestamptz;
  v_source_scheduled_start timestamptz;
  v_source_delivery_type text;
  v_source_progress text;
  v_source_status text;
  v_buffer integer := 0;
  v_service_buffer integer;
  v_home_buffer integer;
  v_driver_buffer integer;
  v_crm_buffer integer;
  v_late_grace integer;
  v_early_tolerance integer;
  v_escalation_delay integer;
  v_hard_delay integer;
  v_final_release boolean;
  v_portal_closing_enabled boolean;
  v_is_service_provider boolean := false;
  v_has_active boolean := false;
  v_has_upcoming boolean := false;
  v_has_open_cash boolean := false;
  v_cash_end timestamptz;
  v_next_assignment_at timestamptz;
  v_expected timestamptz;
  v_earliest timestamptz;
  v_latest timestamptz;
  v_reminder timestamptz;
  v_escalation timestamptz;
  v_hard timestamptz;
  v_provisional timestamptz;
  v_safety_enabled boolean := false;
  v_portal_eligible boolean := false;
  v_portal_reason text := 'use_branch_qr';
  v_portal_method text;
  v_candidate_snapshot jsonb;
  v_snapshot jsonb;
  v_changed boolean := false;
begin
  if p_checkin_id is null then
    raise exception using errcode = '22023', message = 'Attendance record is required.';
  end if;

  select checkin.* into v_checkin
  from public.staff_shift_checkins as checkin
  where checkin.id = p_checkin_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Attendance record was not found.';
  end if;

  select staff.* into v_staff from public.staff as staff where staff.id = v_checkin.staff_id;
  select settings.* into v_settings
  from public.attendance_settings as settings
  where settings.branch_id = v_checkin.branch_id;

  if v_staff.id is null or v_settings.branch_id is null then
    raise exception using errcode = 'P0002', message = 'Attendance policy context was not found.';
  end if;

  v_category := public.resolve_attendance_staff_category(v_staff);
  v_business_date := coalesce(v_checkin.attendance_business_date, v_checkin.shift_date);
  v_timezone := coalesce(v_settings.timezone, nullif(v_checkin.branch_timezone, ''), 'Asia/Manila');
  v_boundary := coalesce(v_settings.attendance_day_boundary, '06:00:00'::time);
  v_scope_start := (v_business_date::text || ' ' || v_boundary::text)::timestamp at time zone v_timezone;
  v_scope_end := v_scope_start + interval '24 hours';
  v_schedule_end := v_checkin.scheduled_end_at;

  select version.* into v_rule_version
  from public.attendance_rule_versions as version
  where version.branch_id = v_checkin.branch_id
    and version.effective_from <= v_now
  order by version.effective_from desc
  limit 1;
  v_values := case when v_rule_version.id is null then '{}'::jsonb else v_rule_version.rule_values end;

  select rule.* into v_rule
  from public.attendance_staff_category_rules as rule
  where rule.branch_id = v_checkin.branch_id
    and rule.staff_category = v_category
    and rule.effective_from <= v_now
    and (rule.effective_until is null or rule.effective_until > v_now)
  order by rule.effective_from desc
  limit 1;

  v_service_buffer := coalesce(
    v_rule.service_cleanup_buffer_minutes,
    nullif(v_values->>'service_cleanup_buffer_minutes', '')::integer,
    15
  );
  v_home_buffer := coalesce(
    v_rule.home_service_wrap_up_buffer_minutes,
    nullif(v_values->>'home_service_wrap_up_buffer_minutes', '')::integer,
    v_service_buffer
  );
  v_driver_buffer := coalesce(
    v_rule.driver_return_buffer_minutes,
    nullif(v_values->>'driver_return_buffer_minutes', '')::integer,
    0
  );
  v_crm_buffer := coalesce(
    nullif(v_values->>'crm_closing_buffer_minutes', '')::integer,
    v_settings.crm_closing_buffer_minutes,
    30
  );
  v_late_grace := coalesce(
    v_rule.late_grace_minutes,
    nullif(v_values->>'late_grace_minutes', '')::integer,
    v_settings.late_grace_minutes,
    10
  );
  v_early_tolerance := coalesce(
    v_rule.early_leave_threshold_minutes,
    nullif(v_values->>'early_leave_threshold_minutes', '')::integer,
    v_settings.early_leave_threshold_minutes,
    5
  );
  v_escalation_delay := coalesce(
    nullif(v_values->>'crm_manager_escalation_delay_minutes', '')::integer,
    v_settings.crm_manager_escalation_delay_minutes,
    30
  );
  v_hard_delay := coalesce(
    nullif(v_values->>'crm_hard_cutoff_delay_minutes', '')::integer,
    v_settings.crm_hard_cutoff_delay_minutes,
    60
  );
  v_final_release := coalesce(
    v_rule.final_client_release_enabled,
    nullif(v_values->>'final_client_release_enabled', '')::boolean,
    false
  );
  v_portal_closing_enabled := coalesce(
    v_rule.portal_closing_shift_enabled,
    nullif(v_values->>'portal_closing_shift_enabled', '')::boolean,
    v_category in ('crm_front_desk', 'therapists')
  );

  select
    (override.override_date::text || ' ' || override.end_time::text)::timestamp
      at time zone v_timezone
      + case when override.ends_next_day then interval '1 day' else interval '0' end,
    override.id
  into v_override_end, v_override_id
  from public.schedule_overrides as override
  where override.staff_id = v_checkin.staff_id
    and override.override_date = v_business_date
    and override.is_day_off = false
    and override.end_time is not null
    and override.created_by is not null
  order by override.created_at desc
  limit 1;

  if v_override_end is not null then
    v_schedule_end := v_override_end;
  elsif v_checkin.schedule_source = 'weekly' and v_checkin.schedule_source_id is not null then
    select
      (v_business_date::text || ' ' || schedule.end_time::text)::timestamp
        at time zone v_timezone
        + case when schedule.ends_next_day then interval '1 day' else interval '0' end
    into v_override_end
    from public.staff_schedules as schedule
    where schedule.id::text = v_checkin.schedule_source_id
      and schedule.staff_id = v_checkin.staff_id
      and schedule.is_active = true;
    v_schedule_end := coalesce(v_override_end, v_schedule_end);
  end if;

  if v_schedule_end is null then
    v_schedule_end := v_scope_end;
  end if;

  v_is_service_provider := v_category in ('therapists', 'salon')
    or exists (
      select 1 from public.staff_services as capability
      where capability.staff_id = v_checkin.staff_id
    );

  if v_category = 'crm_front_desk'
     and lower(coalesce(v_checkin.shift_type, '')) = 'closing'
     and coalesce(
       v_rule.crm_closing_policy_enabled,
       nullif(v_values->>'crm_closing_policy_enabled', '')::boolean,
       v_settings.crm_closing_policy_enabled,
       true
     ) then
    select candidate.id,
           candidate.completion_at,
           candidate.scheduled_start_at,
           candidate.delivery_type,
           candidate.booking_progress_status,
           candidate.status
    into v_source_booking_id, v_source_completion, v_source_scheduled_start,
         v_source_delivery_type, v_source_progress, v_source_status
    from (
      select booking.id,
             booking.delivery_type,
             booking.booking_progress_status,
             booking.status,
             (booking.booking_date::text || ' ' || booking.start_time::text)::timestamp
               at time zone v_timezone as scheduled_start_at,
             coalesce(
               booking.session_completed_at,
               booking.completed_at,
               booking.session_due_at,
               case when booking.session_started_at is not null then
                 booking.session_started_at + make_interval(
                   mins => coalesce(booking.session_duration_minutes_snapshot, service.duration_minutes, 60)
                 )
               end,
               (booking.booking_date::text || ' ' || booking.end_time::text)::timestamp
                 at time zone v_timezone
                 + case when booking.end_time <= booking.start_time then interval '1 day' else interval '0' end
             ) as completion_at
      from public.bookings as booking
      left join public.services as service on service.id = booking.service_id
      where booking.branch_id = v_checkin.branch_id
        and booking.delivery_type = 'in_spa'
        and booking.status not in ('cancelled', 'no_show')
        and coalesce(booking.booking_progress_status, '') <> 'no_show'
        and booking.booking_date between v_business_date and v_business_date + 1
        and (
          (v_checkin.is_test and lower(coalesce(
            booking.metadata->>'isTest', booking.metadata->>'is_test',
            booking.metadata->>'test_mode', 'false'
          )) in ('true', '1', 'yes'))
          or (not v_checkin.is_test and lower(coalesce(
            booking.metadata->>'isTest', booking.metadata->>'is_test',
            booking.metadata->>'test_mode', 'false'
          )) not in ('true', '1', 'yes'))
        )
    ) as candidate
    where candidate.scheduled_start_at >= v_scope_start
      and candidate.scheduled_start_at < v_scope_end
    order by candidate.completion_at desc, candidate.id
    limit 1;

    v_source := case when v_source_booking_id is null then 'schedule' else 'crm_closing' end;
    v_buffer := case when v_source_booking_id is null then 0 else v_crm_buffer end;
  elsif v_category = 'drivers' then
    select candidate.id,
           candidate.id,
           candidate.completion_at,
           candidate.scheduled_start_at,
           candidate.delivery_type,
           candidate.booking_progress_status,
           candidate.status
    into v_source_booking_id, v_source_trip_id, v_source_completion,
         v_source_scheduled_start, v_source_delivery_type, v_source_progress, v_source_status
    from (
      select booking.id,
             booking.delivery_type,
             booking.booking_progress_status,
             booking.status,
             (booking.booking_date::text || ' ' || booking.start_time::text)::timestamp
               at time zone v_timezone as scheduled_start_at,
             coalesce(
               booking.completed_at,
               booking.session_completed_at,
               booking.session_due_at,
               (booking.booking_date::text || ' ' || booking.end_time::text)::timestamp
                 at time zone v_timezone
                 + case when booking.end_time <= booking.start_time then interval '1 day' else interval '0' end
             ) as completion_at
      from public.bookings as booking
      where booking.branch_id = v_checkin.branch_id
        and booking.driver_id = v_checkin.staff_id
        and booking.delivery_type = 'home_service'
        and booking.status not in ('cancelled', 'no_show')
        and coalesce(booking.booking_progress_status, '') <> 'no_show'
        and booking.booking_date between v_business_date and v_business_date + 1
        and (
          (v_checkin.is_test and lower(coalesce(
            booking.metadata->>'isTest', booking.metadata->>'is_test',
            booking.metadata->>'test_mode', 'false'
          )) in ('true', '1', 'yes'))
          or (not v_checkin.is_test and lower(coalesce(
            booking.metadata->>'isTest', booking.metadata->>'is_test',
            booking.metadata->>'test_mode', 'false'
          )) not in ('true', '1', 'yes'))
        )
    ) as candidate
    where candidate.scheduled_start_at >= v_scope_start
      and candidate.scheduled_start_at < v_scope_end
    order by candidate.completion_at desc, candidate.id
    limit 1;

    v_source := case when v_source_booking_id is null then 'schedule' else 'driver_trip' end;
    v_buffer := case when v_source_booking_id is null then 0 else v_driver_buffer end;
  elsif v_is_service_provider then
    select candidate.id,
           case when candidate.delivery_type = 'home_service' then candidate.id else null end,
           candidate.completion_at,
           candidate.scheduled_start_at,
           candidate.delivery_type,
           candidate.booking_progress_status,
           candidate.status
    into v_source_booking_id, v_source_dispatch_id, v_source_completion,
         v_source_scheduled_start, v_source_delivery_type, v_source_progress, v_source_status
    from (
      select booking.id,
             booking.delivery_type,
             booking.booking_progress_status,
             booking.status,
             (booking.booking_date::text || ' ' || booking.start_time::text)::timestamp
               at time zone v_timezone as scheduled_start_at,
             coalesce(
               booking.session_completed_at,
               booking.completed_at,
               booking.session_due_at,
               case when booking.session_started_at is not null then
                 booking.session_started_at + make_interval(
                   mins => coalesce(booking.session_duration_minutes_snapshot, service.duration_minutes, 60)
                 )
               end,
               (booking.booking_date::text || ' ' || booking.end_time::text)::timestamp
                 at time zone v_timezone
                 + case when booking.end_time <= booking.start_time then interval '1 day' else interval '0' end
             ) as completion_at
      from public.bookings as booking
      left join public.services as service on service.id = booking.service_id
      where booking.branch_id = v_checkin.branch_id
        and booking.staff_id = v_checkin.staff_id
        and booking.status not in ('cancelled', 'no_show')
        and coalesce(booking.booking_progress_status, '') <> 'no_show'
        and booking.booking_date between v_business_date and v_business_date + 1
        and (
          (v_checkin.is_test and lower(coalesce(
            booking.metadata->>'isTest', booking.metadata->>'is_test',
            booking.metadata->>'test_mode', 'false'
          )) in ('true', '1', 'yes'))
          or (not v_checkin.is_test and lower(coalesce(
            booking.metadata->>'isTest', booking.metadata->>'is_test',
            booking.metadata->>'test_mode', 'false'
          )) not in ('true', '1', 'yes'))
        )
    ) as candidate
    where candidate.scheduled_start_at >= v_scope_start
      and candidate.scheduled_start_at < v_scope_end
    order by candidate.completion_at desc, candidate.id
    limit 1;

    v_source := case
      when v_source_booking_id is null then 'schedule'
      when v_source_delivery_type = 'home_service' then 'home_service'
      else 'service_completion'
    end;
    v_buffer := case
      when v_source_booking_id is null then 0
      when v_source_delivery_type = 'home_service' then v_home_buffer
      else v_service_buffer
    end;
  end if;

  select coalesce(bool_or(candidate.is_active), false),
         coalesce(bool_or(candidate.is_upcoming), false),
         min(candidate.scheduled_start_at) filter (where candidate.is_upcoming)
  into v_has_active, v_has_upcoming, v_next_assignment_at
  from (
    select
      (booking.booking_date::text || ' ' || booking.start_time::text)::timestamp
        at time zone v_timezone as scheduled_start_at,
      (
        booking.status = 'in_progress'
        or booking.booking_progress_status in (
          'checked_in', 'travel_started', 'arrived', 'session_started'
        )
      ) and coalesce(booking.booking_progress_status, '') <> 'completed'
        and booking.session_completed_at is null
        and booking.completed_at is null as is_active,
      (
        (booking.booking_date::text || ' ' || booking.start_time::text)::timestamp
          at time zone v_timezone > v_now
        and booking.status in ('pending', 'pending_payment', 'pending_crm_confirmation', 'confirmed', 'in_progress')
        and coalesce(booking.booking_progress_status, 'not_started') not in ('completed', 'no_show')
      ) as is_upcoming
    from public.bookings as booking
    where booking.branch_id = v_checkin.branch_id
      and booking.status not in ('cancelled', 'no_show')
      and coalesce(booking.booking_progress_status, '') <> 'no_show'
      and booking.booking_date between v_business_date and v_business_date + 1
      and (
        (v_category = 'crm_front_desk'
          and lower(coalesce(v_checkin.shift_type, '')) = 'closing'
          and booking.delivery_type = 'in_spa')
        or (v_category = 'drivers'
          and booking.driver_id = v_checkin.staff_id
          and booking.delivery_type = 'home_service')
        or (v_category <> 'crm_front_desk'
          and v_category <> 'drivers'
          and v_is_service_provider
          and booking.staff_id = v_checkin.staff_id)
      )
      and (
        (v_checkin.is_test and lower(coalesce(
          booking.metadata->>'isTest', booking.metadata->>'is_test',
          booking.metadata->>'test_mode', 'false'
        )) in ('true', '1', 'yes'))
        or (not v_checkin.is_test and lower(coalesce(
          booking.metadata->>'isTest', booking.metadata->>'is_test',
          booking.metadata->>'test_mode', 'false'
        )) not in ('true', '1', 'yes'))
      )
  ) as candidate
  where candidate.scheduled_start_at >= v_scope_start
    and candidate.scheduled_start_at < v_scope_end;

  v_expected := v_schedule_end;
  if v_source_completion is not null and v_source <> 'schedule' then
    v_expected := v_source_completion + make_interval(mins => v_buffer);
    if v_source in ('service_completion', 'home_service')
       and v_expected < v_schedule_end
       and not v_final_release
       and lower(coalesce(v_checkin.shift_type, '')) <> 'closing' then
      v_expected := v_schedule_end;
    end if;
  end if;

  if not v_checkin.is_test and to_regclass('public.cash_sessions') is not null then
    select exists (
      select 1
      from public.cash_sessions as cs
      where cs.branch_id = v_checkin.branch_id
        and cs.business_date = v_business_date
        and cs.status = 'open'
        and coalesce(cs.current_custodian_id, cs.opened_by) = v_checkin.staff_id
    ) into v_has_open_cash;
  end if;

  if not v_checkin.is_test
     and v_category = 'crm_front_desk'
     and lower(coalesce(v_checkin.shift_type, '')) = 'closing'
     and to_regclass('public.cash_sessions') is not null
     and to_regclass('public.cash_session_handovers') is not null then
    select greatest(
      (select max(cs.closed_at)
         from public.cash_sessions as cs
        where cs.branch_id = v_checkin.branch_id
          and cs.closed_by = v_checkin.staff_id
          and cs.business_date = v_business_date
          and cs.closed_at >= v_checkin.checked_in_at
          and cs.closed_at <= v_now),
      (select max(h.created_at)
         from public.cash_session_handovers as h
         join public.cash_sessions as cs on cs.id = h.cash_session_id
        where h.branch_id = v_checkin.branch_id
          and cs.branch_id = v_checkin.branch_id
          and cs.business_date = v_business_date
          and h.outgoing_custodian_id = v_checkin.staff_id
          and h.created_at >= v_checkin.checked_in_at
          and h.created_at <= v_now)
    ) into v_cash_end;
    v_expected := greatest(v_expected, coalesce(v_cash_end, v_expected));
  end if;

  v_earliest := v_expected - make_interval(mins => v_early_tolerance);
  v_latest := v_expected + make_interval(mins => v_late_grace);
  v_safety_enabled := v_category = 'crm_front_desk'
    and lower(coalesce(v_checkin.shift_type, '')) = 'closing';
  if v_safety_enabled then
    v_reminder := v_latest;
    v_escalation := v_latest + make_interval(mins => v_escalation_delay);
    v_hard := v_latest + make_interval(mins => v_hard_delay);
    v_provisional := v_latest;
  end if;

  if v_checkin.status <> 'checked_in' or v_checkin.checked_out_at is not null then
    v_portal_reason := 'already_clocked_out';
  elsif v_has_active then
    v_portal_reason := 'active_assignment';
  elsif v_has_upcoming then
    v_portal_reason := 'upcoming_assignment';
  elsif v_has_open_cash then
    v_portal_reason := 'open_cash_session';
  elsif v_category = 'drivers'
     and v_source = 'driver_trip'
     and v_source_status = 'completed'
     and v_source_progress = 'completed'
     and v_source_completion is not null then
    v_portal_eligible := true;
    v_portal_reason := 'final_trip_complete';
    v_portal_method := 'driver_portal_final_trip';
  elsif v_category = 'therapists'
     and v_source = 'home_service'
     and v_source_status = 'completed'
     and v_source_progress = 'completed'
     and v_source_completion is not null then
    v_portal_eligible := true;
    v_portal_reason := 'final_home_service_complete';
    v_portal_method := 'staff_portal_home_service';
  elsif lower(coalesce(v_checkin.shift_type, '')) = 'closing'
     and v_category in ('crm_front_desk', 'therapists')
     and v_portal_closing_enabled
     and v_now >= v_earliest then
    v_portal_eligible := true;
    v_portal_reason := 'eligible_closing_shift';
    v_portal_method := 'staff_portal_closing_shift';
  elsif lower(coalesce(v_checkin.shift_type, '')) = 'closing'
     and v_category in ('crm_front_desk', 'therapists')
     and v_portal_closing_enabled then
    v_portal_reason := 'closing_duties_remain';
  else
    v_portal_reason := 'use_branch_qr';
  end if;

  v_candidate_snapshot := jsonb_build_object(
    'kind', v_source,
    'staffCategory', v_category,
    'branchRuleVersionId', v_rule_version.id,
    'categoryRuleId', v_rule.id,
    'timezone', v_timezone,
    'attendanceDayBoundary', v_boundary,
    'attendanceBusinessDate', v_business_date,
    'rawScheduledStartAt', v_checkin.scheduled_start_at,
    'rawScheduledEndAt', v_checkin.scheduled_end_at,
    'resolvedScheduleEndAt', v_schedule_end,
    'managerOverrideId', v_override_id,
    'expectedEndAt', v_expected,
    'earliestNormalClockOutAt', v_earliest,
    'latestNormalClockOutAt', v_latest,
    'reminderAt', v_reminder,
    'managerEscalationAt', v_escalation,
    'hardCutoffAt', v_hard,
    'provisionalClockOutAt', v_provisional,
    'sourceBookingId', v_source_booking_id,
    'sourceDispatchId', v_source_dispatch_id,
    'sourceTripId', v_source_trip_id,
    'sourceCompletionAt', v_source_completion,
    'sourceScheduledStartAt', v_source_scheduled_start,
    'appliedBufferMinutes', v_buffer,
    'lateGraceMinutes', v_late_grace,
    'earlyLeaveThresholdMinutes', v_early_tolerance,
    'activeServiceBlocksClockOut', true,
    'hasActiveAssignment', v_has_active,
    'hasUpcomingAssignment', v_has_upcoming,
    'hasOpenCashSession', v_has_open_cash,
    'nextAssignmentAt', v_next_assignment_at,
    'portalClockOutEligible', v_portal_eligible,
    'portalEligibilityReason', v_portal_reason,
    'portalClockOutMethod', v_portal_method,
    'safetyProcessingEnabled', v_safety_enabled
  );

  v_changed :=
    v_checkin.attendance_expected_end_at is distinct from v_expected
    or v_checkin.earliest_normal_clock_out_at is distinct from v_earliest
    or v_checkin.latest_normal_clock_out_at is distinct from v_latest
    or v_checkin.clock_out_reminder_at is distinct from v_reminder
    or v_checkin.manager_escalation_at is distinct from v_escalation
    or v_checkin.hard_cutoff_at is distinct from v_hard
    or v_checkin.provisional_clock_out_at is distinct from v_provisional
    or v_checkin.attendance_policy_source is distinct from v_source
    or (coalesce(v_checkin.attendance_policy_snapshot, '{}'::jsonb) - 'calculatedAt' - 'v2')
       is distinct from v_candidate_snapshot;

  if v_changed and v_checkin.status = 'checked_in' and v_checkin.checked_out_at is null then
    v_snapshot :=
      (case
        when coalesce(v_checkin.attendance_policy_snapshot, '{}'::jsonb) ? 'v2'
          then jsonb_build_object('v2', v_checkin.attendance_policy_snapshot->'v2')
        else '{}'::jsonb
      end)
      || v_candidate_snapshot
      || jsonb_build_object('calculatedAt', v_now);
    update public.staff_shift_checkins
    set attendance_expected_end_at = v_expected,
        earliest_normal_clock_out_at = v_earliest,
        latest_normal_clock_out_at = v_latest,
        clock_out_reminder_at = v_reminder,
        manager_escalation_at = v_escalation,
        hard_cutoff_at = v_hard,
        provisional_clock_out_at = v_provisional,
        attendance_policy_source = v_source,
        attendance_policy_snapshot = v_snapshot,
        updated_at = v_now
    where id = v_checkin.id
      and status = 'checked_in'
      and checked_out_at is null;
  else
    v_snapshot := coalesce(v_checkin.attendance_policy_snapshot, '{}'::jsonb);
  end if;

  return jsonb_build_object(
    'checkin_id', v_checkin.id,
    'scheduled_end_at', v_schedule_end,
    'attendance_expected_end_at', v_expected,
    'earliest_normal_clock_out_at', v_earliest,
    'latest_normal_clock_out_at', v_latest,
    'clock_out_reminder_at', v_reminder,
    'manager_escalation_at', v_escalation,
    'hard_cutoff_at', v_hard,
    'provisional_clock_out_at', v_provisional,
    'attendance_policy_source', v_source,
    'attendance_policy_snapshot', v_snapshot,
    'has_active_assignment', v_has_active,
    'has_upcoming_assignment', v_has_upcoming,
    'has_open_cash_session', v_has_open_cash,
    'next_assignment_at', v_next_assignment_at,
    'portal_clock_out_eligible', v_portal_eligible,
    'portal_eligibility_reason', v_portal_reason,
    'portal_clock_out_method', v_portal_method,
    'changed', v_changed
  );
end;
$$;
revoke all on function public.recalculate_attendance_clock_out_policy(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.recalculate_attendance_clock_out_policy(uuid, timestamptz) to service_role;

create or replace function public.commit_attendance_portal_clock_out(
  p_auth_user_id uuid,
  p_device_fingerprint_hash text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_now timestamptz := now();
  v_staff public.staff%rowtype;
  v_device public.staff_devices%rowtype;
  v_checkin public.staff_shift_checkins%rowtype;
  v_settings public.attendance_settings%rowtype;
  v_policy jsonb;
  v_existing jsonb;
  v_result jsonb;
  v_event_id uuid;
  v_open_count integer := 0;
  v_method text;
  v_reason text;
  v_eligible boolean := false;
  v_earliest timestamptz;
  v_latest timestamptz;
  v_expected timestamptz;
  v_early_minutes integer := 0;
  v_overtime_minutes integer := 0;
  v_worked_minutes integer := 0;
  v_classification text := 'normal';
  v_attendance_status text;
  v_exception_type text;
  v_exception_message text;
  v_dedupe_key text;
  v_nickname text;
  v_local_time text;
begin
  if p_auth_user_id is null
     or nullif(trim(coalesce(p_device_fingerprint_hash, '')), '') is null
     or nullif(trim(coalesce(p_request_id, '')), '') is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_request',
      'title', 'Clock-out unavailable',
      'message', 'Sign in again and retry from your registered device.'
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtext('attendance_scan_request'), hashtext(p_request_id)
  );
  select event.operation_result into v_existing
  from public.qr_scan_events as event
  where event.request_id = p_request_id
    and event.operation_result is not null
  order by event.created_at
  limit 1;
  if v_existing is not null then
    return v_existing || jsonb_build_object('replayed', true);
  end if;

  select staff.* into v_staff
  from public.staff as staff
  where staff.auth_user_id = p_auth_user_id
    and staff.is_active = true
    and staff.archived_at is null
    and staff.merged_into_staff_id is null
  limit 1
  for update;

  if v_staff.id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'unauthorized',
      'title', 'Clock-out unavailable',
      'message', 'Your active staff profile could not be verified.'
    );
  end if;

  select settings.* into v_settings
  from public.attendance_settings as settings
  where settings.branch_id = v_staff.branch_id;

  select count(*)::integer into v_open_count
  from public.staff_shift_checkins as checkin
  where checkin.staff_id = v_staff.id
    and checkin.status = 'checked_in'
    and checkin.checked_out_at is null
    and checkin.is_test = coalesce(v_settings.test_mode_enabled, false);

  select checkin.* into v_checkin
  from public.staff_shift_checkins as checkin
  where checkin.staff_id = v_staff.id
    and checkin.status = 'checked_in'
    and checkin.checked_out_at is null
    and checkin.is_test = coalesce(v_settings.test_mode_enabled, false)
  order by checkin.checked_in_at desc
  limit 1
  for update;

  if v_open_count <> 1 or v_checkin.id is null then
    v_reason := case when v_open_count > 1 then 'conflicting_open_attendance' else 'no_open_attendance' end;
    v_result := jsonb_build_object(
      'ok', false,
      'code', v_reason,
      'title', case when v_open_count > 1 then 'Attendance needs CRM review' else 'No open shift' end,
      'message', case
        when v_open_count > 1 then 'Ask CRM to resolve the open Attendance records before clocking out.'
        else 'There is no open Attendance shift to clock out.'
      end
    );
    return public.write_attendance_portal_audit(
      v_staff.branch_id, v_staff.id, null, null, p_request_id,
      'blocked', v_reason, 'Portal clock-out was rejected.', v_result,
      coalesce(v_settings.test_mode_enabled, false)
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtext('attendance_scan_staff'),
    hashtext(concat_ws(
      ':', v_checkin.branch_id::text, v_staff.id::text, v_checkin.is_test::text
    ))
  );

  select checkin.* into v_checkin
  from public.staff_shift_checkins as checkin
  where checkin.id = v_checkin.id
    and checkin.staff_id = v_staff.id
    and checkin.status = 'checked_in'
    and checkin.checked_out_at is null
  for update;
  if v_checkin.id is null then
    v_result := jsonb_build_object(
      'ok', false,
      'code', 'already_clocked_out',
      'title', 'Already clocked out',
      'message', 'This Attendance shift is already complete.'
    );
    return public.write_attendance_portal_audit(
      v_staff.branch_id, v_staff.id, null, null, p_request_id,
      'noop', 'already_clocked_out', 'Portal clock-out was already complete.',
      v_result, coalesce(v_settings.test_mode_enabled, false)
    );
  end if;

  select device.* into v_device
  from public.staff_devices as device
  where device.device_fingerprint_hash = p_device_fingerprint_hash
    and device.staff_id = v_staff.id
    and device.branch_id = v_checkin.branch_id
    and device.status = 'active'
    and device.trusted_after <= v_now
    and device.revoked_at is null
  limit 1
  for update;

  if v_device.id is null then
    v_result := jsonb_build_object(
      'ok', false,
      'code', 'unregistered_device',
      'title', 'Registered device required',
      'message', 'Use your registered Attendance device or ask CRM for help.'
    );
    return public.write_attendance_portal_audit(
      v_checkin.branch_id, v_staff.id, null, v_checkin.id, p_request_id,
      'blocked', 'unregistered_device', 'Portal clock-out requires a registered device.',
      v_result, v_checkin.is_test
    );
  end if;

  v_policy := public.recalculate_attendance_clock_out_policy(v_checkin.id, v_now);
  v_eligible := coalesce((v_policy->>'portal_clock_out_eligible')::boolean, false);
  v_reason := coalesce(v_policy->>'portal_eligibility_reason', 'use_branch_qr');
  v_method := nullif(v_policy->>'portal_clock_out_method', '');

  if not v_eligible or v_method is null then
    v_result := jsonb_build_object(
      'ok', false,
      'code', v_reason,
      'title', case
        when v_reason = 'active_assignment' then 'Complete your current assignment'
        when v_reason = 'upcoming_assignment' then 'Another assignment is still scheduled'
        when v_reason = 'open_cash_session' then 'Open cash session remains'
        when v_reason = 'closing_duties_remain' then 'Closing duties remain'
        else 'Use the branch QR'
      end,
      'message', case
        when v_reason = 'active_assignment' then 'Complete the active service or dispatch before clocking out.'
        when v_reason = 'upcoming_assignment' then 'You can clock out after completing your final service.'
        when v_reason = 'open_cash_session' then 'Close or hand over your open cash session before clocking out.'
        when v_reason = 'closing_duties_remain' then 'Clock-out becomes available after the closing completion window.'
        else 'Branch QR remains the normal clock-out method for this shift.'
      end,
      'next_assignment_at', v_policy->'next_assignment_at',
      'expected_clock_out_at', v_policy->'attendance_expected_end_at'
    );
    return public.write_attendance_portal_audit(
      v_checkin.branch_id, v_staff.id, v_device.id, v_checkin.id, p_request_id,
      'blocked', v_reason, 'Portal clock-out was not eligible.', v_result, v_checkin.is_test
    );
  end if;

  v_expected := nullif(v_policy->>'attendance_expected_end_at', '')::timestamptz;
  v_earliest := nullif(v_policy->>'earliest_normal_clock_out_at', '')::timestamptz;
  v_latest := nullif(v_policy->>'latest_normal_clock_out_at', '')::timestamptz;
  v_worked_minutes := greatest(
    0, round(extract(epoch from (v_now - v_checkin.checked_in_at)) / 60.0)::integer
  );
  if v_earliest is not null and v_now < v_earliest then
    v_classification := 'early';
    v_early_minutes := round(extract(epoch from (v_earliest - v_now)) / 60.0)::integer;
  elsif v_latest is not null and v_now > v_latest then
    v_classification := 'overtime';
    v_overtime_minutes := round(extract(epoch from (v_now - v_latest)) / 60.0)::integer;
  end if;

  v_attendance_status := case
    when v_checkin.late_minutes > 0 then 'late'
    when v_classification = 'early' then 'early_leave'
    when v_classification = 'overtime' then 'overtime'
    else 'present'
  end;
  v_nickname := coalesce(nullif(v_staff.nickname, ''), split_part(v_staff.full_name, ' ', 1), 'there');
  v_local_time := to_char(
    v_now at time zone coalesce(v_checkin.branch_timezone, v_settings.timezone, 'Asia/Manila'),
    'FMHH12:MI AM'
  );

  update public.staff_shift_checkins
  set checked_out_at = v_now,
      status = 'checked_out',
      clock_out_method = v_method,
      worked_minutes = v_worked_minutes,
      early_leave_minutes = v_early_minutes,
      overtime_minutes = v_overtime_minutes,
      attendance_status = v_attendance_status,
      exception_state = case when v_classification = 'normal' then exception_state else 'open' end,
      attendance_policy_snapshot = attendance_policy_snapshot || jsonb_build_object(
        'clockOutMethod', v_method,
        'portalEligibilityReason', v_reason,
        'actualClockOutAt', v_now,
        'classification', v_classification
      ),
      updated_at = v_now
  where id = v_checkin.id
    and status = 'checked_in'
    and checked_out_at is null;

  if not found then
    raise exception using errcode = '40001', message = 'Attendance was completed concurrently.';
  end if;

  v_result := jsonb_build_object(
    'ok', true,
    'code', 'clocked_out',
    'title', case
      when v_classification = 'early' then 'Clocked out · For review'
      when v_classification = 'overtime' then 'Clocked out · Overtime recorded'
      else format('All done, %s', v_nickname)
    end,
    'message', case
      when v_classification = 'early' then 'Your clock-out was earlier than the expected completion window.'
      when v_classification = 'overtime' then 'Your final work completed later than expected.'
      when v_method = 'staff_portal_home_service' then
        format('Your home-service shift ended at %s.', v_local_time)
      else format('Your shift ended at %s.', v_local_time)
    end,
    'classification', v_classification,
    'checkin_id', v_checkin.id,
    'clock_out_method', v_method,
    'checked_out_at', v_now,
    'expected_clock_out_at', v_expected,
    'early_leave_minutes', v_early_minutes,
    'overtime_minutes', v_overtime_minutes,
    'is_test', v_checkin.is_test
  );
  v_result := public.write_attendance_portal_audit(
    v_checkin.branch_id, v_staff.id, v_device.id, v_checkin.id, p_request_id,
    'success', v_classification, 'Portal clock-out recorded.', v_result, v_checkin.is_test
  );
  v_event_id := (v_result->>'scan_event_id')::uuid;

  update public.staff_shift_checkins
  set clock_out_scan_event_id = v_event_id
  where id = v_checkin.id;
  update public.staff_devices
  set last_seen_at = v_now,
      updated_at = v_now
  where id = v_device.id;

  if v_classification <> 'normal' then
    v_exception_type := case when v_classification = 'early' then 'early_leave' else 'overtime' end;
    v_exception_message := case
      when v_classification = 'early' then
        format('%s clocked out %s minutes before the dynamic completion window.', v_staff.full_name, v_early_minutes)
      else format('%s clocked out %s minutes after the dynamic completion window.', v_staff.full_name, v_overtime_minutes)
    end;
    v_dedupe_key := concat_ws(
      '|', v_staff.id, v_checkin.id, v_exception_type,
      case when v_checkin.is_test then 'test' else 'live' end
    );
    insert into public.attendance_exceptions (
      branch_id, staff_id, checkin_id, scan_event_id, latest_scan_event_id,
      exception_type, severity, message, metadata, dedupe_key,
      recommended_action, priority, related_checkin_ids, is_test
    ) values (
      v_checkin.branch_id, v_staff.id, v_checkin.id, v_event_id, v_event_id,
      v_exception_type, 'warning', v_exception_message,
      jsonb_build_object(
        'internalExceptionType', v_exception_type || '_portal_clock_out',
        'clockOutMethod', v_method,
        'classification', v_classification,
        'expectedClockOutAt', v_expected,
        'actualClockOutAt', v_now,
        'policySnapshot', v_policy->'attendance_policy_snapshot'
      ),
      v_dedupe_key, 'review_clock_out', 'normal', array[v_checkin.id], v_checkin.is_test
    ) on conflict do nothing;
  end if;

  return v_result;
end;
$$;
revoke all on function public.commit_attendance_portal_clock_out(uuid, text, text) from public, anon, authenticated;
grant execute on function public.commit_attendance_portal_clock_out(uuid, text, text) to service_role;

commit;
