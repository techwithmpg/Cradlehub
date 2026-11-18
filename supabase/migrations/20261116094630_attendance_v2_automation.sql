-- Attendance V2 candidate. LOCAL/TEST only until independent review and owner release.
-- No historical replay/backfill, RLS/Auth edits, activation or Cron installation.
begin;

do $$ begin
  if to_regprocedure('public.recalculate_attendance_clock_out_policy(uuid,timestamptz)') is null
     or to_regprocedure('public.enforce_qr_clock_in_shift_window()') is null
     or to_regprocedure('public.resolve_effective_attendance_branch(uuid,uuid,date,boolean)') is null then
    raise exception 'Attendance V2 prerequisites missing. Review the exact installed schema; do not replay historical migrations.';
  end if;
end $$;

-- Forward-only Closing reminder check cursor table (without replaying historical migrations).
create table if not exists public.attendance_staff_reminder_checks (
  checkin_id uuid primary key references public.staff_shift_checkins(id) on delete cascade,
  checked_at timestamptz not null
);
alter table public.attendance_staff_reminder_checks enable row level security;
revoke all on public.attendance_staff_reminder_checks from public, anon, authenticated;

create schema attendance_v2_private;
revoke all on schema attendance_v2_private from public, anon, authenticated;
create table attendance_v2_private.control (
  id boolean primary key default true check(id),
  enabled_at timestamptz,
  owns_closing boolean not null default false
);
insert into attendance_v2_private.control(id) values(true);
create table attendance_v2_private.work (
  checkin_id uuid primary key references public.staff_shift_checkins(id),
  next_due_at timestamptz not null,
  deadline timestamptz,
  generation integer not null default 0,
  last_interval integer not null default 0,
  last_reason text,
  failures integer not null default 0,
  updated_at timestamptz not null default now()
);
create index attendance_v2_work_due on attendance_v2_private.work(next_due_at, checkin_id);
create table attendance_v2_private.delivery (
  notification_id uuid primary key references public.workspace_notifications(id),
  checkin_id uuid not null references public.staff_shift_checkins(id),
  dedupe_key text not null unique,
  next_attempt_at timestamptz not null,
  lease_token uuid,
  lease_until timestamptz,
  state text not null default 'queued' check(state in ('queued','attempted','provider_accepted','failed','suppressed')),
  attempts integer not null default 0,
  delivered_subscription_ids uuid[] not null default '{}',
  attempt_log jsonb not null default '[]',
  last_error text
);
create index attendance_v2_delivery_due on attendance_v2_private.delivery(next_attempt_at, notification_id)
  where state in ('queued','attempted','failed');
revoke all on all tables in schema attendance_v2_private from public, anon, authenticated;

create function public.attendance_v2_enabled() returns boolean
language sql stable security definer set search_path = '' as $$
  select enabled_at is not null from attendance_v2_private.control where id;
$$;
revoke all on function public.attendance_v2_enabled() from public, anon, authenticated;
grant execute on function public.attendance_v2_enabled() to service_role;

-- Extend the existing metric contract at the canonical storage boundary. Every
-- existing QR/portal/correction/reconciliation writer receives the same rule.
create function attendance_v2_private.guard_credit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_credit jsonb;
  v_start timestamptz;
  v_end timestamptz;
  v_actual timestamptz;
  v_state text;
  v_enabled timestamptz;
  v_service_end timestamptz;
  v_source uuid;
  v_cash_end timestamptz;
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
  v_end := coalesce(nullif(v_credit->>'authorizedEndAt','')::timestamptz, new.scheduled_end_at);
  v_end := greatest(v_end,nullif(new.attendance_policy_snapshot->>'resolvedScheduleEndAt','')::timestamptz);
  v_source := nullif(new.attendance_policy_snapshot->>'sourceBookingId','')::uuid;
  if v_source is not null then
    select greatest(b.session_completed_at,b.completed_at) into v_service_end from public.bookings b
    where b.id=v_source and b.branch_id=new.branch_id
      and (b.staff_id=new.staff_id or b.driver_id=new.staff_id or
        new.attendance_policy_snapshot->>'staffCategory'='crm_front_desk');
    if v_service_end is not null then
      v_end:=greatest(v_end,v_service_end+make_interval(mins=>least(360,greatest(0,
        coalesce((new.attendance_policy_snapshot->>'appliedBufferMinutes')::integer,0)))));
    end if;
  end if;
  if new.attendance_policy_snapshot->>'staffCategory'='crm_front_desk'
     and to_regclass('public.cash_sessions') is not null and to_regclass('public.cash_session_handovers') is not null then
    select greatest(
      (select max(cs.closed_at) from public.cash_sessions cs where cs.branch_id=new.branch_id
        and cs.closed_by=new.staff_id and cs.closed_at>=new.checked_in_at
        and cs.business_date=coalesce(new.attendance_business_date,new.shift_date)
        and cs.closed_at<=coalesce(new.checked_out_at,now())),
      (select max(h.created_at) from public.cash_session_handovers h join public.cash_sessions cs on cs.id=h.cash_session_id
        where h.branch_id=new.branch_id and cs.branch_id=new.branch_id
        and cs.business_date=coalesce(new.attendance_business_date,new.shift_date)
        and h.outgoing_custodian_id=new.staff_id and h.created_at>=new.checked_in_at
        and h.created_at<=coalesce(new.checked_out_at,now()))) into v_cash_end;
    v_end:=greatest(v_end,v_cash_end);
  end if;
  if new.scheduled_start_at is null or new.scheduled_end_at is null then
    v_end := null;
  end if;
  v_actual := case when new.clock_out_method in ('qr','staff_portal_home_service',
    'staff_portal_closing_shift','driver_portal_final_trip') then new.checked_out_at else null end;
  v_state := case
    when v_end is null then 'review'
    when new.checked_out_at is null and (new.clock_in_method='manual_review' or new.clock_out_method='manual_review') then 'review'
    when new.clock_out_method = 'system_auto_close' or new.checked_out_at is null then 'preliminary'
    when new.checked_out_at > v_end or new.exception_state = 'open' then 'review'
    else 'final' end;
  if tg_op = 'UPDATE' and new.clock_out_method = 'manual_review'
     and (new.checked_out_at is distinct from old.checked_out_at or old.clock_out_method='system_auto_close') then
    new.provisional_auto_closed_at := null;
    new.clock_out_confirmation_required := false;
  end if;
  new.worked_minutes := case when v_end is null or new.checked_out_at is null then 0
    else greatest(0, round(extract(epoch from (least(new.checked_out_at,v_end)-v_start))/60.0)::integer) end;
  new.attendance_policy_snapshot := coalesce(new.attendance_policy_snapshot,'{}') ||
    jsonb_build_object('v2', v_credit || jsonb_build_object(
      'version',2, 'actualArrivalAt',new.checked_in_at,'creditedStartAt',v_start,
      'revision',case when tg_op='INSERT' then 1 else coalesce((old.attendance_policy_snapshot->'v2'->>'revision')::integer,0)+1 end,
      'authorizedEndAt',v_end,'creditedEndAt',case when new.checked_out_at is null then null else least(new.checked_out_at,v_end) end,
      'actualClockOutAt',v_actual,'state',v_state,
      'reason',case when v_end is null then 'missing_schedule_end'
        when new.checked_out_at > v_end then 'unverified_overtime'
        when new.clock_out_method='system_auto_close' then 'system_provisional_closure'
        else 'scheduled_credit' end));
  return new;
end;
$$;
revoke all on function attendance_v2_private.guard_credit() from public, anon, authenticated;
create trigger attendance_v2_credit_guard before insert or update on public.staff_shift_checkins
  for each row execute function attendance_v2_private.guard_credit();

-- Forward replacement of the existing INSERT guard. Legacy rows retain 60m.
create or replace function public.enforce_qr_clock_in_shift_window()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_minutes integer := 60;
begin
  if new.clock_in_method is distinct from 'qr' or new.status is distinct from 'checked_in' then return new; end if;
  if new.checked_in_at is null or new.schedule_source not in ('weekly','override')
     or new.schedule_source is null or nullif(new.schedule_source_id,'') is null
     or new.scheduled_start_at is null or new.scheduled_end_at is null
     or new.scheduled_end_at <= new.scheduled_start_at then
    raise exception using errcode='23514',message='attendance_qr_clock_in_requires_resolved_shift';
  end if;
  if new.attendance_policy_snapshot->'v2'->>'version' = '2' and public.attendance_v2_enabled() then v_minutes := 120; end if;
  if new.checked_in_at < new.scheduled_start_at - make_interval(mins=>v_minutes)
     or new.checked_in_at >= new.scheduled_end_at then
    raise exception using errcode='23514',message='attendance_qr_clock_in_outside_shift_window';
  end if;
  return new;
end;
$$;

create function attendance_v2_private.track_work() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.is_test or new.attendance_policy_snapshot->'v2'->>'version' is distinct from '2' then return new; end if;
  if new.attendance_policy_snapshot->'v2'->>'state'='review' then
    insert into public.attendance_exceptions(branch_id,staff_id,checkin_id,exception_type,severity,
      message,metadata,dedupe_key,recommended_action,priority,is_test)
    select new.branch_id,new.staff_id,new.id,'manual','warning',
      'The credited working period requires authorized review. Actual attendance evidence is preserved.',
      jsonb_build_object('internalExceptionType','attendance_work_time_review','credit',new.attendance_policy_snapshot->'v2'),
      'attendance-v2-credit-review:'||new.id::text,'review_clock_out','high',new.is_test
    where not exists(select 1 from public.attendance_exceptions e
      where e.dedupe_key='attendance-v2-credit-review:'||new.id::text and e.status='open');
  elsif new.attendance_policy_snapshot->'v2'->>'state'='final' then
    update public.attendance_exceptions set status='resolved',resolved_at=now(),resolution_status='resolved',
      resolution_action='accept_recorded_attendance',
      resolution_note='Credited time reconciled through the canonical attendance writer.'
    where checkin_id=new.id and dedupe_key='attendance-v2-credit-review:'||new.id::text and status='open';
  end if;
  if new.status <> 'checked_in' or new.checked_out_at is not null
     or new.clock_in_method='manual_review' or new.clock_out_method='manual_review' then
    update public.workspace_notifications set status='resolved',resolved_at=now(),requires_action=false
    where entity_type='attendance_record' and entity_id=new.id
      and type='attendance_clock_out_reminder' and status in ('unread','read');
    update attendance_v2_private.delivery set state='suppressed'
    where checkin_id=new.id and state in ('queued','attempted','failed');
    delete from attendance_v2_private.work where checkin_id=new.id;
  else
    insert into attendance_v2_private.work(checkin_id,next_due_at)
    values(new.id, coalesce(new.scheduled_end_at + interval '5 minutes',now()))
    on conflict(checkin_id) do update set next_due_at=least(attendance_v2_private.work.next_due_at,now());
  end if;
  return new;
end;
$$;
revoke all on function attendance_v2_private.track_work() from public, anon, authenticated;
create trigger attendance_v2_track after insert or update on public.staff_shift_checkins
  for each row execute function attendance_v2_private.track_work();

-- Retain delivery history while retiring notices made obsolete by new duties.
create function attendance_v2_private.suppress_reminders(p_checkin_id uuid,p_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.workspace_notifications set status='resolved',resolved_at=p_at,requires_action=false
  where entity_type='attendance_record' and entity_id=p_checkin_id
    and type='attendance_clock_out_reminder' and status in ('unread','read');
  update attendance_v2_private.delivery set state='suppressed',last_error='work_or_deadline_changed'
  where checkin_id=p_checkin_id and state in ('queued','attempted','failed');
end;
$$;
revoke all on function attendance_v2_private.suppress_reminders(uuid,timestamptz) from public,anon,authenticated;

create function public.process_due_attendance_v2(
  p_processed_at timestamptz default now(), p_batch_size integer default 50
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  candidate record;
  c public.staff_shift_checkins%rowtype;
  w attendance_v2_private.work%rowtype;
  p jsonb;
  snapshot jsonb;
  v_end timestamptz;
  v_midnight timestamptz;
  v_source uuid;
  v_verified_end timestamptz;
  v_interval integer;
  v_key text;
  v_notice uuid;
  v_timezone text;
  v_workspace text;
  v_active boolean;
  v_closing boolean;
  v_owns_closing boolean;
  v_cash_active boolean;
  v_cash_end timestamptz;
  v_examined integer := 0;
  v_reminded integer := 0;
  v_closed integer := 0;
  v_failed integer := 0;
  v_started timestamptz := clock_timestamp();
begin
  if p_processed_at is null or p_batch_size is null or p_batch_size not between 1 and 100 then
    raise exception 'Invalid Attendance V2 batch';
  end if;
  if not public.attendance_v2_enabled() then return jsonb_build_object('inactive',true); end if;
  select owns_closing into v_owns_closing from attendance_v2_private.control where id;
  for candidate in
    select q.checkin_id, a.branch_id, a.staff_id, a.is_test
    from attendance_v2_private.work q join public.staff_shift_checkins a on a.id=q.checkin_id
    where q.next_due_at <= p_processed_at
    order by q.next_due_at,q.checkin_id limit p_batch_size
  loop
    -- Match the canonical booking/scan lock order before taking the session row.
    if not pg_try_advisory_xact_lock(hashtext('attendance_scan_staff'),
      hashtext(concat_ws(':',candidate.branch_id,candidate.staff_id,candidate.is_test))) then continue; end if;
    select * into c from public.staff_shift_checkins where id=candidate.checkin_id for update skip locked;
    if not found then continue; end if;
    select * into w from attendance_v2_private.work where checkin_id=c.id for update;
    if not found or w.next_due_at > p_processed_at then continue; end if;
    v_examined := v_examined+1;
    begin
      if c.checked_out_at is not null or c.status <> 'checked_in' or c.is_test then
        delete from attendance_v2_private.work where checkin_id=c.id;
        continue;
      end if;
      v_closing := exists(select 1 from public.staff s where s.id=c.staff_id
        and public.resolve_attendance_staff_category(s)='crm_front_desk') and lower(c.shift_type)='closing';
      if v_closing and not v_owns_closing then
        update attendance_v2_private.work set next_due_at=p_processed_at+interval '5 minutes',last_reason='legacy_closing_owner' where checkin_id=c.id;
        continue;
      end if;
      if c.scheduled_end_at is null or c.scheduled_start_at is null then
        update attendance_v2_private.work set next_due_at=p_processed_at+interval '1 day',last_reason='missing_schedule_end' where checkin_id=c.id;
        continue;
      end if;
      if not exists(select 1 from public.staff s join public.branches b on b.id=c.branch_id
        where s.id=c.staff_id and s.is_active and s.archived_at is null and s.merged_into_staff_id is null
          and s.auth_user_id is not null and b.is_active)
         or not exists(select 1 from public.resolve_effective_attendance_branch(
           c.staff_id,c.branch_id,coalesce(c.attendance_business_date,c.shift_date),c.is_test) authority
           where authority.allowed and authority.effective_branch_id=c.branch_id) then
        update attendance_v2_private.work set next_due_at=p_processed_at+interval '1 day',last_reason='staff_branch_unverified' where checkin_id=c.id;
        continue;
      end if;
      p := public.recalculate_attendance_clock_out_policy(c.id,p_processed_at);
      if p->>'has_active_assignment' is null or p->>'has_upcoming_assignment' is null then
        raise exception 'Dynamic work evidence unavailable';
      end if;
      v_active := (p->>'has_active_assignment')::boolean or (p->>'has_upcoming_assignment')::boolean;
      snapshot := p->'attendance_policy_snapshot';
      v_timezone := coalesce(nullif(snapshot->>'timezone',''),c.branch_timezone);
      if v_timezone is null then raise exception 'Branch timezone unavailable'; end if;
      v_end := greatest(c.scheduled_end_at, nullif(c.attendance_policy_snapshot->'v2'->>'authorizedEndAt','')::timestamptz,
        nullif(snapshot->>'resolvedScheduleEndAt','')::timestamptz);
      v_cash_active:=false;
      if v_closing then
        if to_regclass('public.cash_sessions') is null or to_regclass('public.cash_session_handovers') is null then
          raise exception 'Cash closing evidence unavailable';
        end if;
        -- Cash custody, close and handover are duty evidence independent of spa bookings.
        perform 1 from public.cash_sessions cs where cs.branch_id=c.branch_id
          and cs.business_date=coalesce(c.attendance_business_date,c.shift_date)
          and coalesce(cs.current_custodian_id,cs.opened_by)=c.staff_id for share;
        select exists(select 1 from public.cash_sessions cs where cs.branch_id=c.branch_id
          and cs.status='open' and cs.business_date=coalesce(c.attendance_business_date,c.shift_date)
          and coalesce(cs.current_custodian_id,cs.opened_by)=c.staff_id)
          into v_cash_active;
        select greatest(
          (select max(cs.closed_at) from public.cash_sessions cs where cs.branch_id=c.branch_id and cs.closed_by=c.staff_id
            and cs.business_date=coalesce(c.attendance_business_date,c.shift_date)
            and cs.closed_at>=c.checked_in_at and cs.closed_at<=p_processed_at),
          (select max(h.created_at) from public.cash_session_handovers h join public.cash_sessions cs on cs.id=h.cash_session_id
            where h.branch_id=c.branch_id and cs.branch_id=c.branch_id
            and cs.business_date=coalesce(c.attendance_business_date,c.shift_date)
            and h.outgoing_custodian_id=c.staff_id and h.created_at>=c.checked_in_at and h.created_at<=p_processed_at)) into v_cash_end;
        v_end:=greatest(v_end,v_cash_end);
        v_active:=v_active or v_cash_active;
      end if;
      -- A successful retry resolves only this processor's unreviewed transient
      -- issue. Preserve its original evidence and any explicit human review.
      update public.attendance_exceptions set status='resolved',resolution_status='resolved',
        resolved_at=p_processed_at,resolution_action='accept_recorded_attendance',
        resolution_note='Work evidence revalidated by an automatic Attendance V2 retry.',
        metadata=metadata||jsonb_build_object('automaticResolution','work_evidence_revalidated','resolvedAt',p_processed_at)
      where checkin_id=c.id and dedupe_key='attendance-v2-processing:'||c.id::text
        and status='open' and reviewed_by is null;
      update attendance_v2_private.work set failures=0 where checkin_id=c.id;
      -- Use actual lifecycle completion, never an estimated due timestamp as proof.
      v_source := nullif(snapshot->>'sourceBookingId','')::uuid;
      v_verified_end := null;
      if v_source is not null then
        select greatest(b.session_completed_at,b.completed_at) into v_verified_end
        from public.bookings b where b.id=v_source and b.branch_id=c.branch_id;
        if v_verified_end is not null then
          v_end := greatest(v_end,v_verified_end + make_interval(mins=>coalesce((snapshot->>'appliedBufferMinutes')::integer,0)));
        end if;
      end if;
      if v_active then
        perform attendance_v2_private.suppress_reminders(c.id,p_processed_at);
        -- Only verified active work can extend the preliminary bound to this pass.
        if (p->>'has_active_assignment')::boolean or coalesce(v_cash_active,false) then v_end:=greatest(v_end,p_processed_at); end if;
        update public.staff_shift_checkins set attendance_policy_snapshot=attendance_policy_snapshot ||
          jsonb_build_object('v2',(attendance_policy_snapshot->'v2') || jsonb_build_object('authorizedEndAt',v_end,'activeWork',true)) where id=c.id;
        update attendance_v2_private.work set next_due_at=p_processed_at+interval '5 minutes',last_reason='active_or_upcoming_work',updated_at=p_processed_at where checkin_id=c.id;
        continue;
      end if;
      -- A changed server-authorized schedule/verified completion is a new deadline.
      update public.staff_shift_checkins set attendance_policy_snapshot=attendance_policy_snapshot ||
        jsonb_build_object('v2',(attendance_policy_snapshot->'v2') || jsonb_build_object('authorizedEndAt',v_end,'activeWork',false)) where id=c.id;
      if w.deadline is distinct from v_end then
        perform attendance_v2_private.suppress_reminders(c.id,p_processed_at);
        w.generation:=w.generation+1; w.last_interval:=0;
        update attendance_v2_private.work set deadline=v_end,generation=w.generation,last_interval=0 where checkin_id=c.id;
      end if;
      v_midnight := ((c.shift_date+1)::timestamp at time zone v_timezone);
      if p_processed_at >= v_midnight and p_processed_at >= v_end then
        update public.staff_shift_checkins set checked_out_at=v_end,status='checked_out',
          clock_out_method='system_auto_close',clock_out_scan_event_id=null,
          provisional_auto_closed_at=p_processed_at,clock_out_confirmation_required=true,
          exception_state='none',updated_at=p_processed_at where id=c.id;
        insert into public.attendance_corrections(branch_id,staff_id,checkin_id,attendance_date,
          correction_type,action_type,previous_values,new_values,reason,status,applied_at,corrected_at,is_test)
        values(c.branch_id,c.staff_id,c.id,c.shift_date,'system_auto_close','system_auto_close',
          to_jsonb(c),jsonb_build_object('creditedEndAt',v_end,'actualClockOutAt',null,'version',2),
          'Attendance V2: expired shift provisionally reconciled; no employee clock-out recorded.',
          'applied',p_processed_at,p_processed_at,false);
        v_closed:=v_closed+1;
        continue;
      end if;
      v_interval:=floor(extract(epoch from(p_processed_at-v_end))/300)::integer;
      if v_interval>=1 and v_interval>w.last_interval then
        v_key:=concat_ws(':','staff-clock-out-reminder','v2',c.id,w.generation,v_interval);
        select case when s.system_role='driver' then 'driver' when s.system_role='utility' then 'utility'
          when s.system_role in ('crm','csr','csr_head','csr_staff') then 'crm' else 'staff' end
          into v_workspace from public.staff s where s.id=c.staff_id;
        insert into public.workspace_notifications(branch_id,target_workspace,recipient_staff_id,
          type,title,body,entity_type,entity_id,action_href,priority,status,requires_action,dedupe_key,metadata,created_at)
        values(c.branch_id,v_workspace,c.staff_id,'attendance_clock_out_reminder','Cradle Attendance',
          'Your shift has ended. Please scan to clock out.','attendance_record',c.id,'/staff/attendance',
          'normal','unread',false,v_key,jsonb_build_object('attendanceVersion',2,'deadline',v_end,'interval',v_interval),p_processed_at)
        returning id into v_notice;
        insert into attendance_v2_private.delivery(notification_id,checkin_id,dedupe_key,next_attempt_at)
          values(v_notice,c.id,v_key,p_processed_at);
        update attendance_v2_private.work set last_interval=v_interval where checkin_id=c.id;
        v_reminded:=v_reminded+1;
      end if;
      update attendance_v2_private.work set next_due_at=least(
        v_end+make_interval(secs=>greatest(1,v_interval+1)*300),greatest(v_midnight,v_end)),
        last_reason='awaiting_clock_out',updated_at=p_processed_at where checkin_id=c.id;
    exception when others then
      v_failed:=v_failed+1;
      update attendance_v2_private.work set next_due_at=p_processed_at+interval '5 minutes',
        failures=failures+1,last_reason='processing_failed:'||sqlstate,updated_at=p_processed_at where checkin_id=c.id;
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
  return jsonb_build_object('examined',v_examined,'reminded',v_reminded,'provisionallyClosed',v_closed,
    'failed',v_failed,'durationMs',extract(epoch from(clock_timestamp()-v_started))*1000,
    'dueBacklog',(select count(*) from attendance_v2_private.work where next_due_at<=p_processed_at));
end;
$$;
revoke all on function public.process_due_attendance_v2(timestamptz,integer) from public,anon,authenticated;
grant execute on function public.process_due_attendance_v2(timestamptz,integer) to service_role;

-- Push claims retain interval and endpoint delivery evidence across resolved notices.
create function public.claim_attendance_v2_push(p_limit integer default 20)
returns table(notification_id uuid,lease_token uuid,delivered_subscription_ids uuid[])
language plpgsql security definer set search_path = '' as $$
begin
  if p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid push batch'; end if;
  if not public.attendance_v2_enabled() then return; end if;
  -- Expired/resolved intervals are terminal. Cleanup is bounded too.
  with expired as (
    select d.notification_id from attendance_v2_private.delivery d
    join public.workspace_notifications n on n.id=d.notification_id
    join public.staff_shift_checkins c on c.id=d.checkin_id
    where d.state in ('queued','attempted','failed')
      and (n.created_at<=now()-interval '5 minutes' or n.status<>'unread'
        or c.checked_out_at is not null or c.status<>'checked_in' or d.attempts>=5)
    order by d.next_attempt_at,d.notification_id for update of d skip locked limit 100
  ) update attendance_v2_private.delivery d set state='suppressed',last_error='interval_expired_or_resolved',
      attempt_log=d.attempt_log||jsonb_build_array(jsonb_build_object('at',now(),'suppressed',true))
    from expired where d.notification_id=expired.notification_id;
  return query
  with due as (
    select d.notification_id from attendance_v2_private.delivery d
    join public.workspace_notifications n on n.id=d.notification_id
    join public.staff_shift_checkins c on c.id=d.checkin_id
    where d.state in ('queued','attempted','failed') and d.next_attempt_at<=now()
      and (d.lease_until is null or d.lease_until<=now()) and d.attempts<5
      and c.status='checked_in' and c.checked_out_at is null and n.status='unread'
      and n.created_at>now()-interval '5 minutes'
    order by d.next_attempt_at,d.notification_id for update of d skip locked limit p_limit
  ) update attendance_v2_private.delivery d set state='attempted',lease_token=gen_random_uuid(),
      lease_until=now()+interval '2 minutes',attempts=d.attempts+1
    from due where d.notification_id=due.notification_id
    returning d.notification_id,d.lease_token,d.delivered_subscription_ids;
end;
$$;
create function public.validate_attendance_v2_push(p_notification_id uuid,p_lease_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  c public.staff_shift_checkins%rowtype;
  n public.workspace_notifications%rowtype;
  p jsonb;
  v_end timestamptz;
  v_valid boolean := false;
begin
  if not public.attendance_v2_enabled() then return false; end if;
  select a.* into c from public.staff_shift_checkins a
    join attendance_v2_private.delivery d on d.checkin_id=a.id
    where d.notification_id=p_notification_id;
  if not found then return false; end if;
  -- Same branch/staff -> session order as scan/booking writers. Never lock the
  -- delivery row before policy refresh, which can itself suppress deliveries.
  if not pg_try_advisory_xact_lock(hashtext('attendance_scan_staff'),
      hashtext(concat_ws(':',c.branch_id,c.staff_id,c.is_test))) then return false; end if;
  select * into c from public.staff_shift_checkins where id=c.id for update;
  select * into n from public.workspace_notifications where id=p_notification_id;
  if c.status='checked_in' and c.checked_out_at is null and not c.is_test
     and n.status='unread' and n.created_at>now()-interval '5 minutes'
     and exists(select 1 from attendance_v2_private.delivery d where d.notification_id=n.id
       and d.lease_token=p_lease_token and d.lease_until>now() and d.state='attempted')
     and exists(select 1 from public.staff s where s.id=c.staff_id and s.is_active
       and s.archived_at is null and s.merged_into_staff_id is null and s.auth_user_id is not null)
     and exists(select 1 from public.resolve_effective_attendance_branch(c.staff_id,c.branch_id,
       coalesce(c.attendance_business_date,c.shift_date),c.is_test) a where a.allowed and a.effective_branch_id=c.branch_id) then
    p:=public.recalculate_attendance_clock_out_policy(c.id,now());
    select * into c from public.staff_shift_checkins where id=c.id;
    v_end:=greatest(c.scheduled_end_at,
      nullif(c.attendance_policy_snapshot->'v2'->>'authorizedEndAt','')::timestamptz,
      nullif(p->'attendance_policy_snapshot'->>'resolvedScheduleEndAt','')::timestamptz,
      nullif(p->>'attendance_expected_end_at','')::timestamptz);
    v_valid:=p->>'has_active_assignment'='false' and p->>'has_upcoming_assignment'='false'
      and v_end=nullif(n.metadata->>'deadline','')::timestamptz and now()>=v_end+interval '5 minutes'
      and not exists(select 1 from public.cash_sessions cs where cs.branch_id=c.branch_id
        and cs.status='open' and cs.business_date=coalesce(c.attendance_business_date,c.shift_date)
          and coalesce(cs.current_custodian_id,cs.opened_by)=c.staff_id);
  end if;
  if coalesce(v_valid,false) then return true; end if;
  perform attendance_v2_private.suppress_reminders(c.id,now());
  return false;
end;
$$;
revoke all on function public.validate_attendance_v2_push(uuid,uuid) from public,anon,authenticated;
grant execute on function public.validate_attendance_v2_push(uuid,uuid) to service_role;

create function public.finish_attendance_v2_push(p_notification_id uuid,p_lease_token uuid,
  p_delivered uuid[],p_complete boolean,p_error text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update attendance_v2_private.delivery d set
    state=case when d.state='suppressed' then 'suppressed' when p_complete then 'provider_accepted' else 'failed' end,
    delivered_subscription_ids=array(select distinct unnest(d.delivered_subscription_ids||coalesce(p_delivered,'{}'))),
    attempt_log=d.attempt_log||jsonb_build_array(jsonb_build_object('at',now(),'providerAccepted',p_complete,
      'acceptedEndpoints',coalesce(p_delivered,'{}'::uuid[]),'error',left(p_error,160))),
    last_error=left(p_error,160),next_attempt_at=now()+interval '1 minute',lease_token=null,lease_until=null
  where d.notification_id=p_notification_id and d.lease_token=p_lease_token and d.state in ('attempted','suppressed');
  return found;
end;
$$;
revoke all on function public.claim_attendance_v2_push(integer) from public,anon,authenticated;
revoke all on function public.finish_attendance_v2_push(uuid,uuid,uuid[],boolean,text) from public,anon,authenticated;
grant execute on function public.claim_attendance_v2_push(integer) to service_role;
grant execute on function public.finish_attendance_v2_push(uuid,uuid,uuid[],boolean,text) to service_role;


-- Exact forward definitions derived from accepted canonical writers.
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

    if found and public.attendance_v2_enabled() and
       (v_existing_event.staff_id is distinct from p_staff_id or v_existing_event.branch_id is distinct from p_branch_id
        or v_existing_event.device_id is distinct from p_device_id
        or v_existing_event.is_test is distinct from p_is_test
        or (p_checkin_id is not null and v_existing_event.checkin_id is distinct from p_checkin_id)) then
      return query select false,'scan_request_mismatch',null::uuid,null::uuid,null::uuid,null::jsonb,
        'This scan request belongs to a different operation. Please scan again.';
      return;
    end if;
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

  if p_checkin_update is not null and public.attendance_v2_enabled() then
    select c.* into v_existing_checkin from public.staff_shift_checkins c
      where c.id=p_checkin_id and c.branch_id=p_branch_id and c.staff_id=p_staff_id for update;
    if found and v_existing_checkin.attendance_policy_snapshot->'v2'->>'version'='2'
       and v_existing_checkin.checked_out_at is null
       and nullif(p_checkin_update->>'checked_out_at','')::timestamptz <=
         v_existing_checkin.checked_in_at + make_interval(secs=>coalesce(
           (select duplicate_scan_window_seconds from public.attendance_settings where branch_id=p_branch_id),90)) then
      p_checkin_update:=null; p_exception:=null; p_action:='duplicate_scan'; p_outcome:='noop';
      p_reason_code:='duplicate_scan'; p_message:='Arrival already recorded. No clock-out was inferred.';
      v_operation_result:=jsonb_build_object('ok',true,'outcome','noop','title','Already recorded',
        'message',p_message,'reasonCode',p_reason_code);
    end if;
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

  -- V2 rechecks global open-session conflicts under the canonical staff row lock.
  if p_checkin_insert is not null and public.attendance_v2_enabled() then
    select c.* into v_existing_checkin from public.staff_shift_checkins c
    where c.staff_id=p_staff_id and c.is_test=p_is_test and c.status='checked_in'
      and c.checked_out_at is null
      and (c.branch_id<>p_branch_id or c.shift_instance_key is distinct from p_checkin_insert->>'shift_instance_key')
    order by c.id limit 1 for update;
    if found then
      p_checkin_insert:=null;
      p_action:='scan_captured'; p_outcome:='exception'; p_reason_code:='conflicting_open_checkin';
      p_message:='Another open shift needs review. This scan was retained.';
      v_operation_result:=jsonb_build_object('ok',false,'outcome','exception','severity','warning',
        'title','Attendance needs review','message',p_message,'reasonCode',p_reason_code);
      p_exception:=jsonb_build_object('exception_type','manual','severity','warning','message',p_message,
        'dedupe_key',p_staff_id::text||':v2-open-conflict',
        'metadata',jsonb_build_object('internalExceptionType','conflicting_open_checkin','existingCheckinId',v_existing_checkin.id));
    end if;
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

  -- Public results and persisted minutes use the same authoritative credit.
  if v_checkin_id is not null and v_operation_result ? 'attendance' then
    select c.* into v_existing_checkin from public.staff_shift_checkins c where c.id=v_checkin_id;
    if v_existing_checkin.attendance_policy_snapshot->'v2'->>'version'='2' then
      v_operation_result:=jsonb_set(v_operation_result,'{attendance}',(v_operation_result->'attendance') ||
        jsonb_build_object('workedMinutes',v_existing_checkin.worked_minutes,
          'creditedStartAt',v_existing_checkin.attendance_policy_snapshot->'v2'->>'creditedStartAt'));
    end if;
  end if;
  if v_checkin_id is not null and v_existing_checkin.attendance_policy_snapshot->'v2'->>'version'='2' then
    v_metadata:=v_metadata||jsonb_build_object('creditedMetrics',jsonb_build_object('workedMinutes',v_existing_checkin.worked_minutes),
      'credit',v_existing_checkin.attendance_policy_snapshot->'v2');
  end if;
  update public.qr_scan_events
     set metadata=v_metadata, operation_id = coalesce(p_request_id, operation_id),
         operation_result = v_operation_result,
         operation_result_recorded_at = v_now
   where id = v_scan_event_id;

  return query select true, 'committed', v_scan_event_id, v_checkin_id, v_recovery_issue_id, v_operation_result, 'Attendance scan committed.';
end;
$$;

create or replace function public.process_due_attendance_closing_interventions(
  p_stage text,
  p_processed_at timestamptz default now(),
  p_batch_size integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_stage text := lower(trim(coalesce(p_stage, '')));
  v_processed_at timestamptz := coalesce(p_processed_at, now());
  v_batch_size integer := greatest(1, least(coalesce(p_batch_size, 50), 200));
  v_due_query text;
  v_record record;
  v_policy jsonb;
  v_fresh_reminder_at timestamptz;
  v_scope_start timestamptz;
  v_scope_end timestamptz;
  v_home_work_pending boolean;
  v_intervention public.attendance_closing_interventions%rowtype;
  v_exception_id uuid;
  v_staff_name text;
  v_dedupe_key text;
  v_exception_dedupe_key text;
  v_notification_key text;
  v_task_key text;
  v_signal_stage text;
  v_title text;
  v_body text;
  v_target_workspace text;
  v_target_role text;
  v_recipient_staff_id uuid;
  v_notification_type text;
  v_priority text;
  v_requires_action boolean;
  v_task_required boolean;
  v_active_service boolean;
  v_notification_ready boolean;
  v_task_ready boolean;
  v_did_apply boolean;
  v_row_count integer;
  v_worked_minutes integer;
  v_examined integer := 0;
  v_applied integer := 0;
  v_skipped integer := 0;
  v_failed integer := 0;
  v_auto_closed integer := 0;
  v_active_service_blocks integer := 0;
  v_reminder_summary jsonb;
  v_escalation_summary jsonb;
  v_auto_close_summary jsonb;
begin
  if v_stage not in ('reminder', 'manager_escalation', 'auto_close', 'catch_up') then
    raise exception using
      errcode = '22023',
      message = 'Unsupported Attendance closing intervention stage.';
  end if;

  if v_stage = 'catch_up' then
    v_reminder_summary := public.process_due_attendance_closing_interventions(
      'reminder', v_processed_at, v_batch_size
    );
    v_escalation_summary := public.process_due_attendance_closing_interventions(
      'manager_escalation', v_processed_at, v_batch_size
    );
    v_auto_close_summary := public.process_due_attendance_closing_interventions(
      'auto_close', v_processed_at, v_batch_size
    );

    return jsonb_build_object(
      'stage', 'catch_up',
      'processedAt', v_processed_at,
      'batchSize', v_batch_size,
      'examined', coalesce((v_reminder_summary->>'examined')::integer, 0)
        + coalesce((v_escalation_summary->>'examined')::integer, 0)
        + coalesce((v_auto_close_summary->>'examined')::integer, 0),
      'applied', coalesce((v_reminder_summary->>'applied')::integer, 0)
        + coalesce((v_escalation_summary->>'applied')::integer, 0)
        + coalesce((v_auto_close_summary->>'applied')::integer, 0),
      'skipped', coalesce((v_reminder_summary->>'skipped')::integer, 0)
        + coalesce((v_escalation_summary->>'skipped')::integer, 0)
        + coalesce((v_auto_close_summary->>'skipped')::integer, 0),
      'failed', coalesce((v_reminder_summary->>'failed')::integer, 0)
        + coalesce((v_escalation_summary->>'failed')::integer, 0)
        + coalesce((v_auto_close_summary->>'failed')::integer, 0),
      'autoClosed', coalesce((v_auto_close_summary->>'autoClosed')::integer, 0),
      'activeServiceBlocks', coalesce((v_auto_close_summary->>'activeServiceBlocks')::integer, 0),
      'stages', jsonb_build_array(
        v_reminder_summary, v_escalation_summary, v_auto_close_summary
      )
    );
  end if;

  if v_stage = 'reminder' then
    v_due_query := $query$
      select checkin.id,
             checkin.branch_id,
             checkin.staff_id,
             checkin.attendance_business_date,
             checkin.shift_date,
             checkin.attendance_policy_snapshot,
             checkin.clock_out_reminder_at as due_at
      from public.staff_shift_checkins as checkin
      left join public.attendance_staff_reminder_checks as prior
        on prior.checkin_id = checkin.id
      where checkin.status = 'checked_in'
        and checkin.checked_out_at is null
        and checkin.attendance_policy_source = 'crm_closing'
        and checkin.clock_out_reminder_at is not null
        and checkin.clock_out_reminder_at <= $1
        and checkin.provisional_auto_closed_at is null
        and checkin.is_test = false
        and not (coalesce(checkin.attendance_policy_snapshot->'v2'->>'version','')='2' and
          coalesce((select owns_closing from attendance_v2_private.control where id),false))
        and exists (
          select 1 from public.branches as branch
          where branch.id = checkin.branch_id and branch.is_active = true
        )
      order by prior.checked_at nulls first, checkin.clock_out_reminder_at, checkin.id
      for update of checkin skip locked
      limit $2
    $query$;
  elsif v_stage = 'manager_escalation' then
    v_due_query := $query$
      select checkin.id,
             checkin.branch_id,
             checkin.staff_id,
             checkin.attendance_business_date,
             checkin.shift_date,
             checkin.attendance_policy_snapshot,
             checkin.manager_escalation_at as due_at
      from public.staff_shift_checkins as checkin
      where checkin.status = 'checked_in'
        and checkin.checked_out_at is null
        and checkin.attendance_policy_source = 'crm_closing'
        and checkin.manager_escalation_at is not null
        and checkin.manager_escalation_at <= $1
        and checkin.provisional_auto_closed_at is null
        and checkin.is_test = false
        and not (coalesce(checkin.attendance_policy_snapshot->'v2'->>'version','')='2' and
          coalesce((select owns_closing from attendance_v2_private.control where id),false))
        and exists (
          select 1 from public.branches as branch
          where branch.id = checkin.branch_id and branch.is_active = true
        )
      order by checkin.manager_escalation_at, checkin.id
      for update of checkin skip locked
      limit $2
    $query$;
  else
    v_due_query := $query$
      select checkin.id,
             checkin.branch_id,
             checkin.staff_id,
             checkin.attendance_business_date,
             checkin.shift_date,
             checkin.checked_in_at,
             checkin.provisional_clock_out_at,
             checkin.hard_cutoff_at as due_at,
             checkin.late_minutes,
             checkin.attendance_policy_snapshot
      from public.staff_shift_checkins as checkin
      where checkin.status = 'checked_in'
        and checkin.checked_out_at is null
        and checkin.attendance_policy_source = 'crm_closing'
        and checkin.provisional_clock_out_at is not null
        and checkin.provisional_clock_out_at <= $1
        and checkin.hard_cutoff_at is not null
        and checkin.hard_cutoff_at <= $1
        and checkin.provisional_auto_closed_at is null
        and checkin.is_test = false
        and not (coalesce(checkin.attendance_policy_snapshot->'v2'->>'version','')='2' and
          coalesce((select owns_closing from attendance_v2_private.control where id),false))
        and exists (
          select 1 from public.branches as branch
          where branch.id = checkin.branch_id and branch.is_active = true
        )
      order by checkin.provisional_clock_out_at, checkin.id
      for update of checkin skip locked
      limit $2
    $query$;
  end if;

  for v_record in execute v_due_query using v_processed_at, v_batch_size
  loop
    v_examined := v_examined + 1;
    v_did_apply := false;
    v_intervention := null;
    v_exception_id := null;

    if v_stage = 'reminder' then
      -- Rotate deferred due rows behind unexamined shifts in a bounded pass.
      insert into public.attendance_staff_reminder_checks(checkin_id, checked_at)
      values (v_record.id, v_processed_at)
      on conflict (checkin_id) do update set checked_at = excluded.checked_at;
    end if;

    begin
      if v_stage = 'reminder' then
        -- The stored due time is a candidate only. Recheck the canonical
        -- policy and live assignments while holding the attendance row lock.
        v_policy := public.recalculate_attendance_clock_out_policy(
          v_record.id, v_processed_at
        );
        v_fresh_reminder_at := nullif(v_policy->>'clock_out_reminder_at', '')::timestamptz;
        if coalesce(v_policy->>'attendance_policy_source', '') <> 'crm_closing'
           or v_fresh_reminder_at is null
           or v_fresh_reminder_at > v_processed_at
           or coalesce((v_policy->>'has_active_assignment')::boolean, true)
           or coalesce((v_policy->>'has_upcoming_assignment')::boolean, true) then
          v_skipped := v_skipped + 1;
          continue;
        end if;
        v_scope_start := (
          coalesce(v_record.attendance_business_date, v_record.shift_date)::text
          || ' ' || coalesce(
            v_policy->'attendance_policy_snapshot'->>'attendanceDayBoundary',
            '06:00:00'
          )
        )::timestamp at time zone coalesce(
          v_policy->'attendance_policy_snapshot'->>'timezone', 'Asia/Manila'
        );
        v_scope_end := v_scope_start + interval '24 hours';

        -- CRM Closing remains responsible while a branch Home Service is in
        -- progress or a booked dispatch still lies ahead in this business day.
        select exists (
          select 1 from public.bookings as booking
          where booking.branch_id = v_record.branch_id
            and booking.delivery_type = 'home_service'
            and booking.status not in ('cancelled', 'no_show')
            and coalesce(booking.booking_progress_status, '') <> 'no_show'
            and booking.booking_date between
              coalesce(v_record.attendance_business_date, v_record.shift_date) - 1
              and coalesce(v_record.attendance_business_date, v_record.shift_date) + 1
            and lower(coalesce(
              booking.metadata->>'isTest', booking.metadata->>'is_test',
              booking.metadata->>'test_mode', 'false'
            )) not in ('true', '1', 'yes')
            and (
              ((booking.status = 'in_progress'
                or booking.booking_progress_status in (
                  'checked_in', 'travel_started', 'arrived', 'session_started'
                ))
                and coalesce(booking.booking_progress_status, '') <> 'completed'
                and booking.session_completed_at is null
                and booking.completed_at is null)
              or ((booking.booking_date::text || ' ' || booking.start_time::text)::timestamp
                    at time zone coalesce(
                      v_policy->'attendance_policy_snapshot'->>'timezone',
                      'Asia/Manila'
                    ) > v_processed_at
                  and (booking.booking_date::text || ' ' || booking.start_time::text)::timestamp
                    at time zone coalesce(
                      v_policy->'attendance_policy_snapshot'->>'timezone',
                      'Asia/Manila'
                    ) >= v_scope_start
                  and (booking.booking_date::text || ' ' || booking.start_time::text)::timestamp
                    at time zone coalesce(
                      v_policy->'attendance_policy_snapshot'->>'timezone',
                      'Asia/Manila'
                    ) < v_scope_end
                  and booking.status in (
                    'pending', 'pending_payment', 'pending_crm_confirmation',
                    'confirmed', 'in_progress'
                  )
                  and coalesce(booking.booking_progress_status, 'not_started')
                    not in ('completed', 'no_show'))
            )
        ) into v_home_work_pending;
        if v_home_work_pending or exists (
          select 1 from public.attendance_exceptions as reviewed
          where reviewed.checkin_id = v_record.id
            and reviewed.branch_id = v_record.branch_id
            and reviewed.staff_id = v_record.staff_id
            and reviewed.exception_type = 'missed_checkout'
            and reviewed.status = 'open'
            and reviewed.resolution_status = 'reviewed'
            and reviewed.reviewed_by is not null
            and reviewed.reviewed_at is not null
        ) then
          v_skipped := v_skipped + 1;
          continue;
        end if;
        v_record.due_at := v_fresh_reminder_at;
        v_record.attendance_policy_snapshot := v_policy->'attendance_policy_snapshot';
      end if;

      if v_stage = 'auto_close' then
        select exists (
          select 1
          from public.bookings as booking
          where booking.branch_id = v_record.branch_id
            and booking.staff_id = v_record.staff_id
            and booking.status = 'in_progress'
            and booking.booking_progress_status = 'session_started'
            and booking.session_completed_at is null
        ) and coalesce(
          (v_record.attendance_policy_snapshot->>'activeServiceBlocksClockOut')::boolean,
          true
        )
        into v_active_service;

        if v_active_service then
          v_signal_stage := 'active_service_blocked';
          v_dedupe_key := concat_ws(
            ':', 'crm-closing', v_record.branch_id, v_record.staff_id,
            coalesce(v_record.attendance_business_date, v_record.shift_date),
            'active-service-blocked'
          );

          insert into public.attendance_closing_interventions (
            branch_id, staff_id, checkin_id, attendance_business_date, stage,
            dedupe_key, due_at, policy_snapshot, applied_at
          ) values (
            v_record.branch_id, v_record.staff_id, v_record.id,
            coalesce(v_record.attendance_business_date, v_record.shift_date),
            v_signal_stage, v_dedupe_key, v_record.due_at,
            v_record.attendance_policy_snapshot, v_processed_at
          )
          on conflict (checkin_id, stage) do nothing
          returning * into v_intervention;

          if v_intervention.id is null then
            select * into v_intervention
            from public.attendance_closing_interventions
            where checkin_id = v_record.id and stage = v_signal_stage;
          else
            v_did_apply := true;
          end if;

          v_exception_dedupe_key := concat_ws(
            '|', v_record.staff_id, v_record.id,
            'active_service_at_closing_cutoff', 'live'
          );
          select exception_row.id into v_exception_id
          from public.attendance_exceptions as exception_row
          where exception_row.branch_id = v_record.branch_id
            and exception_row.dedupe_key = v_exception_dedupe_key
            and exception_row.status = 'open'
          limit 1
          for update;

          if v_exception_id is null then
            insert into public.attendance_exceptions (
              branch_id, staff_id, checkin_id, exception_type, severity, message,
              metadata, dedupe_key, recommended_action, priority,
              staff_response_required, related_checkin_ids, is_test
            ) values (
              v_record.branch_id, v_record.staff_id, v_record.id,
              'active_service', 'warning',
              'Active service prevented the CRM closing attendance auto-close.',
              jsonb_build_object(
                'internalExceptionType', 'active_service_at_closing_cutoff',
                'policySnapshot', v_record.attendance_policy_snapshot
              ),
              v_exception_dedupe_key, 'review_active_service', 'high', false,
              array[v_record.id], false
            );
            v_did_apply := true;
          end if;

          v_active_service_blocks := v_active_service_blocks + 1;
        else
          v_signal_stage := 'auto_close';
          v_dedupe_key := concat_ws(
            ':', 'crm-closing', v_record.branch_id, v_record.staff_id,
            coalesce(v_record.attendance_business_date, v_record.shift_date),
            'auto-close'
          );
          v_worked_minutes := greatest(
            0,
            round(extract(epoch from (
              v_record.provisional_clock_out_at - v_record.checked_in_at
            )) / 60.0)::integer
          );

          update public.staff_shift_checkins
          set checked_out_at = provisional_clock_out_at,
              status = 'checked_out',
              clock_out_method = 'system_auto_close',
              clock_out_scan_event_id = null,
              worked_minutes = v_worked_minutes,
              early_leave_minutes = 0,
              overtime_minutes = 0,
              attendance_status = case when late_minutes > 0 then 'late' else 'present' end,
              exception_state = 'open',
              provisional_auto_closed_at = v_processed_at,
              clock_out_confirmation_required = true,
              notes = format(
                'Auto-closed at %s · Confirmation required',
                to_char(
                  v_record.provisional_clock_out_at at time zone coalesce(
                    v_record.attendance_policy_snapshot->>'timezone', 'Asia/Manila'
                  ),
                  'FMHH12:MI AM'
                )
              ),
              updated_at = v_processed_at
          where id = v_record.id
            and status = 'checked_in'
            and checked_out_at is null
            and provisional_auto_closed_at is null;
          get diagnostics v_row_count = row_count;

          if v_row_count = 0 then
            v_skipped := v_skipped + 1;
            continue;
          end if;

          v_exception_dedupe_key := concat_ws(
            '|', v_record.staff_id, v_record.id, 'missing_clock_out', 'live'
          );
          select exception_row.id into v_exception_id
          from public.attendance_exceptions as exception_row
          where exception_row.branch_id = v_record.branch_id
            and exception_row.dedupe_key = v_exception_dedupe_key
            and exception_row.status = 'open'
          limit 1
          for update;

          if v_exception_id is null then
            insert into public.attendance_exceptions (
              branch_id, staff_id, checkin_id, exception_type, severity, message,
              metadata, dedupe_key, recommended_action, priority,
              staff_response_required, related_checkin_ids, is_test
            ) values (
              v_record.branch_id, v_record.staff_id, v_record.id,
              'missed_checkout', 'warning',
              format(
                'Auto-closed at %s · Confirmation required',
                to_char(
                  v_record.provisional_clock_out_at at time zone coalesce(
                    v_record.attendance_policy_snapshot->>'timezone', 'Asia/Manila'
                  ),
                  'FMHH12:MI AM'
                )
              ),
              jsonb_build_object(
                'internalExceptionType', 'missing_clock_out',
                'provisionalClockOutAt', v_record.provisional_clock_out_at,
                'autoClosedAt', v_processed_at,
                'policySnapshot', v_record.attendance_policy_snapshot
              ),
              v_exception_dedupe_key, 'confirm_actual_clock_out', 'high', true,
              array[v_record.id], false
            ) returning id into v_exception_id;
          end if;

          insert into public.attendance_corrections (
            branch_id, staff_id, checkin_id, exception_id, attendance_date,
            correction_type, action_type, previous_values, new_values, reason,
            status, applied_at, corrected_at, is_test
          )
          select
            v_record.branch_id, v_record.staff_id, v_record.id, v_exception_id,
            coalesce(v_record.attendance_business_date, v_record.shift_date),
            'system_auto_close', 'system_auto_close',
            jsonb_build_object(
              'checkedOutAt', null,
              'status', 'checked_in',
              'clockOutMethod', null,
              'confirmationRequired', false
            ),
            jsonb_build_object(
              'checkedOutAt', v_record.provisional_clock_out_at,
              'clockOutMethod', 'system_auto_close',
              'confirmationRequired', true
            ),
            'CRM closing hard cutoff reached without a real clock-out scan.',
            'applied', v_processed_at, v_processed_at, false
          where not exists (
            select 1 from public.attendance_corrections as correction
            where correction.checkin_id = v_record.id
              and correction.correction_type = 'system_auto_close'
              and correction.is_test = false
          );

          insert into public.attendance_closing_interventions (
            branch_id, staff_id, checkin_id, attendance_business_date, stage,
            dedupe_key, due_at, policy_snapshot, applied_at
          ) values (
            v_record.branch_id, v_record.staff_id, v_record.id,
            coalesce(v_record.attendance_business_date, v_record.shift_date),
            v_signal_stage, v_dedupe_key, v_record.due_at,
            v_record.attendance_policy_snapshot, v_processed_at
          )
          on conflict (checkin_id, stage) do nothing
          returning * into v_intervention;

          if v_intervention.id is null then
            select * into v_intervention
            from public.attendance_closing_interventions
            where checkin_id = v_record.id and stage = v_signal_stage;
          end if;

          v_did_apply := true;
          v_auto_closed := v_auto_closed + 1;
        end if;
      else
        v_signal_stage := v_stage;
        v_dedupe_key := concat_ws(
          ':', 'crm-closing', v_record.branch_id, v_record.staff_id,
          coalesce(v_record.attendance_business_date, v_record.shift_date),
          case when v_stage = 'manager_escalation'
            then 'manager-escalation' else 'reminder' end
        );

        insert into public.attendance_closing_interventions (
          branch_id, staff_id, checkin_id, attendance_business_date, stage,
          dedupe_key, due_at, policy_snapshot, applied_at
        ) values (
          v_record.branch_id, v_record.staff_id, v_record.id,
          coalesce(v_record.attendance_business_date, v_record.shift_date),
          v_signal_stage, v_dedupe_key, v_record.due_at,
          v_record.attendance_policy_snapshot, v_processed_at
        )
        on conflict (checkin_id, stage) do nothing
        returning * into v_intervention;

        if v_intervention.id is null then
          select * into v_intervention
          from public.attendance_closing_interventions
          where checkin_id = v_record.id and stage = v_signal_stage;
        else
          v_did_apply := true;
        end if;
      end if;

      if v_intervention.id is null then
        raise exception 'Attendance closing intervention could not be claimed.';
      end if;

      v_notification_key := v_intervention.dedupe_key || ':notification';
      v_task_key := v_intervention.dedupe_key || ':task';
      v_notification_ready := v_intervention.notification_sent_at is not null;
      v_task_ready := v_intervention.workflow_task_sent_at is not null;

      if v_signal_stage = 'reminder' then
        v_target_workspace := 'crm';
        v_target_role := 'crm';
        v_recipient_staff_id := v_record.staff_id;
        v_notification_type := 'attendance_clock_out_reminder';
        v_title := 'Closing shift clock-out reminder';
        v_body := 'Your closing shift is still open. Please scan to clock out.';
        v_priority := 'normal';
        v_requires_action := false;
        v_task_required := false;
      elsif v_signal_stage = 'auto_close' then
        v_target_workspace := 'crm';
        v_target_role := 'crm';
        v_recipient_staff_id := v_record.staff_id;
        v_notification_type := 'attendance_provisional_auto_close';
        v_title := 'Clock-out confirmation required';
        v_body := 'Attendance was provisionally auto-closed at the latest normal clock-out time. A real QR scan will replace it automatically.';
        v_priority := 'high';
        v_requires_action := true;
        v_task_required := true;
      else
        select coalesce(nullif(trim(staff.full_name), ''), 'CRM staff member')
        into v_staff_name
        from public.staff as staff
        where staff.id = v_record.staff_id;
        v_staff_name := coalesce(v_staff_name, 'CRM staff member');
        v_target_workspace := 'manager';
        v_target_role := 'manager';
        v_recipient_staff_id := null;
        v_notification_type := 'attendance_closing_escalation';
        v_title := case when v_signal_stage = 'active_service_blocked'
          then 'Active service blocked closing auto-close'
          else 'Closing shift still open' end;
        v_body := case when v_signal_stage = 'active_service_blocked'
          then format('%s still has an active service at the hard cutoff. Attendance was left open for review.', v_staff_name)
          else format(
            'CRM closing attendance is still open for %s. Expected clock-out was by %s.',
            v_staff_name,
            to_char(
              coalesce(
                nullif(v_record.attendance_policy_snapshot->>'latestNormalClockOutAt', '')::timestamptz,
                v_record.due_at
              ) at time zone coalesce(
                v_record.attendance_policy_snapshot->>'timezone', 'Asia/Manila'
              ),
              'FMHH12:MI AM'
            )
          ) end;
        v_priority := 'high';
        v_requires_action := true;
        v_task_required := true;
      end if;

      if not v_notification_ready then
        insert into public.workspace_notifications (
          branch_id, target_workspace, target_role, recipient_staff_id,
          type, title, body, entity_type, entity_id, action_href,
          priority, status, requires_action, dedupe_key, metadata, created_at
        ) values (
          v_record.branch_id, v_target_workspace, v_target_role,
          v_recipient_staff_id, v_notification_type, v_title, v_body,
          'attendance_record', v_record.id, '/crm/attendance?tab=exceptions',
          v_priority, 'unread', v_requires_action, v_notification_key,
          jsonb_build_object(
            'intervention_id', v_intervention.id,
            'intervention_stage', v_signal_stage,
            'policy_snapshot', v_record.attendance_policy_snapshot
          ),
          v_processed_at
        ) on conflict do nothing;

        select exists (
          select 1 from public.workspace_notifications as notification
          where notification.dedupe_key = v_notification_key
            and notification.status in ('unread', 'read')
        ) into v_notification_ready;
      end if;

      if v_task_required and not v_task_ready then
        insert into public.workflow_tasks (
          branch_id, workspace_scope, assigned_to_role, task_type,
          title, body, entity_type, entity_id, action_href, priority,
          status, due_at, dedupe_key, metadata
        ) values (
          v_record.branch_id, 'manager', 'manager',
          'attendance.crm_closing.' || v_signal_stage,
          v_title, v_body, 'attendance_record', v_record.id,
          '/crm/attendance?tab=exceptions', 'high', 'open',
          v_intervention.due_at, v_task_key,
          jsonb_build_object(
            'intervention_id', v_intervention.id,
            'intervention_stage', v_signal_stage,
            'staff_id', v_record.staff_id
          )
        ) on conflict do nothing;

        select exists (
          select 1 from public.workflow_tasks as task
          where task.dedupe_key = v_task_key
            and task.status in ('open', 'in_progress')
        ) into v_task_ready;
      end if;

      if not v_notification_ready or (v_task_required and not v_task_ready) then
        raise exception 'Attendance closing signal delivery could not be confirmed.';
      end if;

      update public.attendance_closing_interventions
      set notification_sent_at = coalesce(notification_sent_at, v_processed_at),
          workflow_task_sent_at = case
            when v_task_required then coalesce(workflow_task_sent_at, v_processed_at)
            else workflow_task_sent_at
          end,
          delivery_attempts = delivery_attempts + 1,
          last_delivery_error = null,
          updated_at = v_processed_at
      where id = v_intervention.id
        and (
          notification_sent_at is null
          or (v_task_required and workflow_task_sent_at is null)
        );
      get diagnostics v_row_count = row_count;
      if v_row_count > 0 then
        v_did_apply := true;
      end if;

      if v_did_apply then
        v_applied := v_applied + 1;
      else
        v_skipped := v_skipped + 1;
      end if;
    exception
      when others then
        v_failed := v_failed + 1;
    end;
  end loop;

  update public.attendance_settings
  set closing_intervention_last_run_at = v_processed_at,
      closing_intervention_last_error = case
        when v_failed > 0 then 'One or more due Attendance closing records could not be processed.'
        else null
      end
  where crm_closing_policy_enabled = true;

  return jsonb_build_object(
    'stage', v_stage,
    'processedAt', v_processed_at,
    'batchSize', v_batch_size,
    'examined', v_examined,
    'applied', v_applied,
    'skipped', v_skipped,
    'failed', v_failed,
    'autoClosed', v_auto_closed,
    'activeServiceBlocks', v_active_service_blocks
  );
end;
$$;


-- Preserve explicit manual correction provenance even at the same provisional instant.
create or replace function public.correct_attendance_times_transaction(
  p_branch_id uuid,
  p_actor_staff_id uuid,
  p_action text,
  p_reason text,
  p_checkin_id uuid,
  p_checked_in_at timestamptz,
  p_checked_out_at timestamptz default null,
  p_exception_id uuid default null,
  p_metrics jsonb default '{}'::jsonb,
  p_is_test boolean default false
)
returns table (success boolean, code text, message text, correction_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_checkin public.staff_shift_checkins%rowtype;
  v_correction_id uuid;
  v_previous jsonb;
  v_status text;
begin
  if p_branch_id is null or p_actor_staff_id is null or p_checkin_id is null or p_checked_in_at is null or v_reason is null then
    return query select false, 'invalid_request', 'Branch, actor, record, clock-in, and reason are required.', null::uuid;
    return;
  end if;
  if p_action not in ('set_manual_clock_in', 'set_manual_clock_out', 'correct_attendance_times') then
    return query select false, 'unsupported_action', 'This time correction is not supported.', null::uuid;
    return;
  end if;
  if p_checked_out_at is not null and p_checked_out_at <= p_checked_in_at then
    return query select false, 'invalid_time_range', 'Clock-out must be after clock-in.', null::uuid;
    return;
  end if;

  select checkin_row.* into v_checkin
  from public.staff_shift_checkins as checkin_row
  where checkin_row.id = p_checkin_id
    and checkin_row.branch_id = p_branch_id
    and checkin_row.is_test = p_is_test
  for update;
  if not found then
    return query select false, 'checkin_not_found', 'Attendance record was not found.', null::uuid;
    return;
  end if;

  v_previous := jsonb_build_object('attendance', to_jsonb(v_checkin));
  v_status := case when p_checked_out_at is null then 'checked_in' else 'checked_out' end;
  update public.staff_shift_checkins
  set checked_in_at = p_checked_in_at,
      checked_out_at = p_checked_out_at,
      status = v_status,
      clock_in_method = case when p_checked_in_at is distinct from v_checkin.checked_in_at then 'manual_review' else clock_in_method end,
      clock_out_method = case when p_checked_out_at is null then null when p_checked_out_at is distinct from v_checkin.checked_out_at
        or (v_checkin.attendance_policy_snapshot->'v2'->>'version'='2' and v_checkin.clock_out_method='system_auto_close') then 'manual_review' else clock_out_method end,
      worked_minutes = coalesce((p_metrics->>'workedMinutes')::integer, 0),
      late_minutes = coalesce((p_metrics->>'lateMinutes')::integer, 0),
      early_leave_minutes = coalesce((p_metrics->>'earlyLeaveMinutes')::integer, 0),
      overtime_minutes = coalesce((p_metrics->>'overtimeMinutes')::integer, 0),
      attendance_status = coalesce(nullif(p_metrics->>'attendanceStatus', ''), attendance_status),
      exception_state = 'none',
      updated_at = v_now
  where id = p_checkin_id;

  if p_exception_id is not null then
    update public.attendance_exceptions
    set status = 'resolved', resolution_status = 'resolved', resolution_action = p_action,
        resolution_note = v_reason, resolved_at = v_now, resolved_by = p_actor_staff_id,
        updated_at = v_now
    where id = p_exception_id and branch_id = p_branch_id;
  end if;

  insert into public.attendance_corrections (
    branch_id, staff_id, checkin_id, exception_id, attendance_date,
    correction_type, action_type, previous_values, new_values, reason,
    status, requested_by, approved_by, corrected_by, applied_at, corrected_at, is_test
  ) values (
    p_branch_id, v_checkin.staff_id, p_checkin_id, p_exception_id, v_checkin.shift_date,
    p_action, p_action, v_previous,
    jsonb_build_object('checkedInAt', p_checked_in_at, 'checkedOutAt', p_checked_out_at, 'metrics', p_metrics),
    v_reason, 'applied', p_actor_staff_id, p_actor_staff_id, p_actor_staff_id, v_now, v_now, p_is_test
  ) returning id into v_correction_id;

  return query select true, 'committed', 'Attendance times corrected.', v_correction_id;
end;
$$;


-- Keep late-scan public replay consistent with authoritative credited minutes.
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
  if found and (v_existing_event.staff_id is distinct from p_staff_id
      or v_existing_event.branch_id is distinct from p_branch_id
      or v_existing_event.device_id is distinct from p_device_id
      or v_existing_event.is_test is distinct from p_is_test
      or v_existing_event.checkin_id is distinct from p_checkin_id) then
    return query select false,'scan_request_mismatch',null::uuid,p_checkin_id,null::jsonb,
      'This scan request belongs to a different operation. Please scan again.';
    return;
  end if;
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

  if v_checkin.attendance_policy_snapshot->'v2'->>'version'='2' and v_result ? 'attendance' then
    v_result:=jsonb_set(v_result,'{attendance}',(v_result->'attendance')||
      (select jsonb_build_object('workedMinutes',c.worked_minutes,'creditedStartAt',c.attendance_policy_snapshot->'v2'->>'creditedStartAt')
       from public.staff_shift_checkins c where c.id=p_checkin_id));
  end if;
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

commit;
