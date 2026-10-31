\set ON_ERROR_STOP on
-- Run only in an empty, isolated native PostgreSQL TEST database.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;

create table public.branches (id uuid primary key, is_active boolean not null default true);
create table public.attendance_settings (
  branch_id uuid primary key, crm_closing_policy_enabled boolean default true,
  closing_intervention_last_run_at timestamptz,
  closing_intervention_last_error text
);
create table public.staff (
  id uuid primary key, branch_id uuid references public.branches(id),
  system_role text, staff_type text, is_active boolean default true,
  archived_at timestamptz, merged_into_staff_id uuid, auth_user_id uuid
);
create table public.staff_shift_checkins (
  id uuid primary key, branch_id uuid not null, staff_id uuid not null,
  status text not null default 'checked_in', checked_in_at timestamptz not null,
  checked_out_at timestamptz, is_test boolean not null default false,
  provisional_auto_closed_at timestamptz, latest_normal_clock_out_at timestamptz,
  clock_out_reminder_at timestamptz, attendance_policy_source text,
  attendance_policy_snapshot jsonb not null default '{}'::jsonb,
  attendance_business_date date, shift_date date, manager_escalation_at timestamptz,
  hard_cutoff_at timestamptz, provisional_clock_out_at timestamptz,
  late_minutes integer default 0, clock_out_method text, clock_out_scan_event_id uuid,
  worked_minutes integer, early_leave_minutes integer, overtime_minutes integer,
  attendance_status text, exception_state text, clock_out_confirmation_required boolean,
  notes text, updated_at timestamptz
);
create table public.bookings (
  id uuid primary key, branch_id uuid not null, staff_id uuid,
  booking_date date not null, start_time time not null,
  delivery_type text, status text, booking_progress_status text,
  session_completed_at timestamptz, completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);
create table public.attendance_exceptions (
  id uuid primary key, branch_id uuid not null, staff_id uuid,
  checkin_id uuid, exception_type text, severity text, message text,
  metadata jsonb not null default '{}'::jsonb, dedupe_key text,
  recommended_action text, priority text, staff_response_required boolean,
  related_checkin_ids uuid[] default '{}'::uuid[], is_test boolean default false,
  status text not null default 'open', resolution_status text not null default 'open',
  reviewed_by uuid, reviewed_at timestamptz
);
create table public.workspace_notifications (
  id uuid primary key default gen_random_uuid(), branch_id uuid,
  target_workspace text, target_role text, recipient_staff_id uuid,
  actor_staff_id uuid, type text, title text, body text, entity_type text,
  entity_id uuid, action_href text, priority text, status text,
  requires_action boolean, dedupe_key text, metadata jsonb default '{}'::jsonb,
  created_at timestamptz, resolved_at timestamptz, read_at timestamptz
);
create unique index workspace_notifications_open_dedupe_key_uidx
  on public.workspace_notifications(dedupe_key)
  where dedupe_key is not null and status in ('unread','read');
create table public.attendance_closing_interventions (
  id uuid primary key default gen_random_uuid(), branch_id uuid, staff_id uuid,
  checkin_id uuid, attendance_business_date date, stage text,
  dedupe_key text unique, due_at timestamptz, policy_snapshot jsonb,
  applied_at timestamptz, notification_sent_at timestamptz,
  workflow_task_sent_at timestamptz, delivery_attempts integer default 0,
  last_delivery_error text, updated_at timestamptz,
  unique(checkin_id,stage)
);
create table public.attendance_corrections (
  id uuid primary key default gen_random_uuid(), branch_id uuid, staff_id uuid,
  checkin_id uuid, exception_id uuid, attendance_date date, correction_type text,
  action_type text, previous_values jsonb, new_values jsonb, reason text,
  status text, applied_at timestamptz, corrected_at timestamptz,
  is_test boolean default false
);
create table public.workflow_tasks (
  id uuid primary key default gen_random_uuid(), branch_id uuid,
  workspace_scope text, assigned_to_role text, task_type text, title text,
  body text, entity_type text, entity_id uuid, action_href text,
  priority text, status text, due_at timestamptz, dedupe_key text unique,
  metadata jsonb
);

create function public.get_auth_role() returns text language sql stable as $$
  select current_setting('test.auth_role', true)
$$;
create function public.get_auth_staff_id() returns uuid language sql stable as $$
  select nullif(current_setting('test.auth_staff_id', true), '')::uuid
$$;
create function public.get_auth_branch_id() returns uuid language sql stable as $$
  select nullif(current_setting('test.auth_branch_id', true), '')::uuid
$$;

create table public.test_policy_state (
  checkin_id uuid primary key, source text not null,
  due_at timestamptz not null, active boolean default false,
  upcoming boolean default false
);
create function public.recalculate_attendance_clock_out_policy(
  p_checkin_id uuid, p_calculated_at timestamptz
) returns jsonb language plpgsql security definer as $$
declare p public.test_policy_state%rowtype;
begin
  select * into p from public.test_policy_state where checkin_id = p_checkin_id;
  if not found then raise exception 'Missing TEST policy state'; end if;
  update public.staff_shift_checkins set
    latest_normal_clock_out_at = p.due_at,
    clock_out_reminder_at = p.due_at,
    attendance_policy_source = p.source
  where id = p_checkin_id;
  return jsonb_build_object(
    'latest_normal_clock_out_at', p.due_at,
    'clock_out_reminder_at', p.due_at,
    'attendance_policy_source', p.source,
    'attendance_policy_snapshot', jsonb_build_object('timezone','Asia/Manila'),
    'has_active_assignment', p.active,
    'has_upcoming_assignment', p.upcoming
  );
end $$;

grant usage on schema public to authenticated;
-- Supabase's actual table grants include INSERT; RLS must still deny it.
grant select, update, insert on public.workspace_notifications to authenticated;
grant execute on function public.get_auth_role() to authenticated;
grant execute on function public.get_auth_staff_id() to authenticated;
grant execute on function public.get_auth_branch_id() to authenticated;
alter table public.workspace_notifications enable row level security;
create policy notif_crm_branch on public.workspace_notifications for select to authenticated
  using (public.get_auth_role() in ('crm','csr','csr_head','csr_staff')
    and target_workspace = 'crm' and branch_id = public.get_auth_branch_id());
create policy notif_crm_branch_update on public.workspace_notifications for update to authenticated
  using (public.get_auth_role() in ('crm','csr','csr_head','csr_staff')
    and target_workspace = 'crm' and branch_id = public.get_auth_branch_id())
  with check (public.get_auth_role() in ('crm','csr','csr_head','csr_staff')
    and target_workspace = 'crm' and branch_id = public.get_auth_branch_id());

\ir ../../supabase/migrations/20261031074004_staff_clock_out_reminders.sql
\ir ../../supabase/migrations/20261031074005_crm_closing_reminder_eligibility.sql
do $$ begin
  if has_function_privilege('authenticated',
       'public.process_due_staff_clock_out_reminders(timestamptz,integer)', 'EXECUTE')
     or not has_function_privilege('service_role',
       'public.process_due_staff_clock_out_reminders(timestamptz,integer)', 'EXECUTE') then
    raise exception 'staff processor execute grants are unsafe';
  end if;
end $$;

insert into public.branches(id) values ('10000000-0000-0000-0000-000000000001');
insert into public.staff(id,branch_id,system_role,staff_type,auth_user_id) values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','service_staff','therapist','30000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','crm','crm','30000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','crm','crm','30000000-0000-0000-0000-000000000003');
insert into public.attendance_staff_reminder_activation values (true,'2026-10-31 00:00+00');

insert into public.staff_shift_checkins
  (id,branch_id,staff_id,checked_in_at,latest_normal_clock_out_at,
   clock_out_reminder_at,attendance_policy_source,attendance_business_date,shift_date)
values
  ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2026-10-31 01:00+00','2026-10-31 02:00+00',null,'home_service','2026-10-31','2026-10-31'),
  ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','2026-10-31 01:00+00','2026-10-31 02:00+00','2026-10-31 02:00+00','crm_closing','2026-10-31','2026-10-31');
insert into public.test_policy_state(checkin_id,source,due_at,active) values
  ('40000000-0000-0000-0000-000000000001','home_service','2026-10-31 02:00+00',true),
  ('40000000-0000-0000-0000-000000000002','crm_closing','2026-10-31 02:00+00',true);

-- Active work, upcoming assignment, and a moved deadline each defer delivery.
do $$ begin
  perform public.process_due_staff_clock_out_reminders('2026-10-31 03:00+00',50);
  perform public.process_due_attendance_closing_interventions('reminder','2026-10-31 03:00+00',50);
  if exists(select 1 from public.workspace_notifications) then raise exception 'active work sent reminder'; end if;
end $$;
update public.test_policy_state set active=false, upcoming=true;
do $$ begin
  perform public.process_due_staff_clock_out_reminders('2026-10-31 03:00+00',50);
  perform public.process_due_attendance_closing_interventions('reminder','2026-10-31 03:00+00',50);
  if exists(select 1 from public.workspace_notifications) then raise exception 'upcoming work sent reminder'; end if;
end $$;
update public.test_policy_state set upcoming=false, due_at='2026-10-31 04:00+00';
do $$ begin
  perform public.process_due_staff_clock_out_reminders('2026-10-31 03:00+00',50);
  perform public.process_due_attendance_closing_interventions('reminder','2026-10-31 03:00+00',50);
  if exists(select 1 from public.workspace_notifications) then raise exception 'moved deadline sent reminder'; end if;
end $$;
update public.test_policy_state set due_at='2026-10-31 02:00+00';
-- A booking/schedule update normally refreshes the stored candidate deadline.
update public.staff_shift_checkins set
  latest_normal_clock_out_at='2026-10-31 02:00+00',
  clock_out_reminder_at='2026-10-31 02:00+00';

-- Active Home Service dispatch prevents CRM Closing reminder.
insert into public.bookings(id,branch_id,booking_date,start_time,delivery_type,status,booking_progress_status)
values ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','2026-10-31','08:00','home_service','in_progress','travel_started');
do $$ begin
  perform public.process_due_attendance_closing_interventions('reminder','2026-10-31 03:00+00',50);
  if exists(select 1 from public.workspace_notifications where dedupe_key like 'crm-closing:%') then
    raise exception 'active dispatch sent CRM reminder';
  end if;
end $$;
update public.bookings set status='confirmed', booking_progress_status='not_started',
  start_time='12:00', completed_at=null;
do $$ begin
  perform public.process_due_attendance_closing_interventions('reminder','2026-10-31 03:00+00',50);
  if exists(select 1 from public.workspace_notifications where dedupe_key like 'crm-closing:%') then
    raise exception 'upcoming Home Service dispatch sent CRM reminder';
  end if;
end $$;
update public.bookings set status='completed', booking_progress_status='completed', completed_at='2026-10-31 03:00+00';
insert into public.bookings(id,branch_id,booking_date,start_time,delivery_type,status,booking_progress_status)
values ('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',
        '2026-11-01','08:00','home_service','confirmed','not_started');

do $$ begin
  perform public.process_due_staff_clock_out_reminders('2026-10-31 03:00+00',50);
  perform public.process_due_staff_clock_out_reminders('2026-10-31 03:00+00',50);
  perform public.process_due_attendance_closing_interventions('reminder','2026-10-31 03:00+00',50);
  perform public.process_due_attendance_closing_interventions('reminder','2026-10-31 03:00+00',50);
  if (select count(*) from public.workspace_notifications) <> 2 then
    raise exception 'missing or duplicate due reminders';
  end if;
end $$;

insert into public.attendance_exceptions(id,branch_id,staff_id,checkin_id,exception_type)
values ('60000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','missed_checkout');
update public.attendance_exceptions set resolution_status='reviewed',
  reviewed_by='20000000-0000-0000-0000-000000000002', reviewed_at='2026-10-31 03:30+00'
where id='60000000-0000-0000-0000-000000000001';
update public.attendance_exceptions set reviewed_at='2026-10-31 03:45+00'
where id='60000000-0000-0000-0000-000000000001';
do $$ begin
  if not exists(select 1 from public.workspace_notifications where
    dedupe_key='staff-clock-out-reminder:40000000-0000-0000-0000-000000000001'
    and status='resolved' and metadata->>'attendance_resolution'='exception_reviewed'
    and actor_staff_id='20000000-0000-0000-0000-000000000002') then
    raise exception 'review did not resolve personal reminder';
  end if;
  if not exists(select 1 from public.workspace_notifications where
    dedupe_key='staff-clock-out-reminder:40000000-0000-0000-0000-000000000001'
    and resolved_at='2026-10-31 03:30+00') then
    raise exception 'repeat review changed resolution audit time';
  end if;
  if not exists(select 1 from public.staff_shift_checkins where
    id='40000000-0000-0000-0000-000000000001' and status='checked_in' and checked_out_at is null) then
    raise exception 'review changed canonical attendance';
  end if;
end $$;

-- A review before the due pass suppresses creation; provisional closure only
-- resolves the notice and leaves confirmation data in the canonical row.
insert into public.staff_shift_checkins
  (id,branch_id,staff_id,checked_in_at,latest_normal_clock_out_at,
   attendance_policy_source,attendance_business_date,shift_date)
values
  ('40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2026-10-31 01:00+00','2026-10-31 02:00+00','home_service','2026-10-31','2026-10-31'),
  ('40000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2026-10-31 01:00+00','2026-10-31 02:00+00','home_service','2026-10-31','2026-10-31');
insert into public.test_policy_state(checkin_id,source,due_at) values
  ('40000000-0000-0000-0000-000000000003','home_service','2026-10-31 02:00+00'),
  ('40000000-0000-0000-0000-000000000004','home_service','2026-10-31 02:00+00');
insert into public.attendance_exceptions(id,branch_id,staff_id,checkin_id,exception_type,
  resolution_status,reviewed_by,reviewed_at)
values ('60000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000003',
  'missed_checkout','reviewed','20000000-0000-0000-0000-000000000002','2026-10-31 02:30+00');
do $$ begin
  perform public.process_due_staff_clock_out_reminders('2026-10-31 03:00+00',50);
  if exists(select 1 from public.workspace_notifications where
    entity_id='40000000-0000-0000-0000-000000000003') then
    raise exception 'reviewed open shift received new reminder';
  end if;
  if not exists(select 1 from public.workspace_notifications where
    entity_id='40000000-0000-0000-0000-000000000004' and status='unread') then
    raise exception 'unreviewed open shift did not receive reminder';
  end if;
end $$;
update public.staff_shift_checkins set
  status='checked_out',checked_out_at='2026-10-31 02:00+00',
  provisional_auto_closed_at='2026-10-31 03:00+00',
  clock_out_confirmation_required=true
where id='40000000-0000-0000-0000-000000000004';
do $$ begin
  if not exists(select 1 from public.workspace_notifications where
    entity_id='40000000-0000-0000-0000-000000000004' and status='resolved'
    and metadata->>'attendance_resolution'='provisionally_closed') then
    raise exception 'provisional close did not resolve reminder';
  end if;
  if not exists(select 1 from public.staff_shift_checkins where
    id='40000000-0000-0000-0000-000000000004'
    and checked_out_at='2026-10-31 02:00+00'
    and clock_out_confirmation_required=true) then
    raise exception 'provisional confirmation data changed';
  end if;
end $$;
insert into public.staff_shift_checkins
  (id,branch_id,staff_id,checked_in_at,latest_normal_clock_out_at,
   attendance_policy_source,attendance_business_date,shift_date)
values ('40000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001','2026-10-31 01:00+00',
        '2026-10-31 02:00+00','home_service','2026-10-31','2026-10-31');
insert into public.test_policy_state(checkin_id,source,due_at)
values ('40000000-0000-0000-0000-000000000005','home_service','2026-10-31 02:00+00');
do $$ begin
  perform public.process_due_staff_clock_out_reminders('2026-10-31 03:00+00',50);
end $$;
insert into public.attendance_exceptions(id,branch_id,staff_id,checkin_id,exception_type)
values ('60000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000005','late');
update public.attendance_exceptions set resolution_status='reviewed',
  reviewed_by='20000000-0000-0000-0000-000000000002', reviewed_at='2026-10-31 03:30+00'
where id='60000000-0000-0000-0000-000000000003';
do $$ begin
  if not exists(select 1 from public.workspace_notifications where
    entity_id='40000000-0000-0000-0000-000000000005' and status='unread') then
    raise exception 'unrelated exception review cleared clock-out reminder';
  end if;
end $$;
update public.staff_shift_checkins set status='checked_out',checked_out_at='2026-10-31 04:00+00'
where id='40000000-0000-0000-0000-000000000002';
do $$ begin
  if not exists(select 1 from public.workspace_notifications where
    dedupe_key like 'crm-closing:%' and status='resolved'
    and metadata->>'attendance_resolution'='clocked_out') then
    raise exception 'clock-out did not resolve CRM reminder';
  end if;
end $$;

-- Fifty repeatedly blocked CRM rows must not starve a later eligible row.
create temporary table test_starvation as
select n, md5('starve-staff-'||n)::uuid as staff_id,
       md5('starve-checkin-'||n)::uuid as checkin_id
from generate_series(1,51) as n;
insert into public.staff(id,branch_id,system_role,staff_type,auth_user_id)
select staff_id,'10000000-0000-0000-0000-000000000001','crm','crm',
       md5('starve-auth-'||n)::uuid from test_starvation;
insert into public.staff_shift_checkins
  (id,branch_id,staff_id,checked_in_at,latest_normal_clock_out_at,
   clock_out_reminder_at,attendance_policy_source,attendance_business_date,shift_date)
select checkin_id,'10000000-0000-0000-0000-000000000001',staff_id,
  '2026-10-31 01:00+00','2026-10-31 02:00+00',
  case when n=51 then '2026-10-31 02:30+00'::timestamptz
       else '2026-10-31 02:00+00'::timestamptz end,
  'crm_closing','2026-10-31','2026-10-31' from test_starvation;
insert into public.test_policy_state(checkin_id,source,due_at,active)
select checkin_id,'crm_closing',
  case when n=51 then '2026-10-31 02:30+00'::timestamptz
       else '2026-10-31 02:00+00'::timestamptz end,
  n<=50 from test_starvation;
do $$ begin
  perform public.process_due_attendance_closing_interventions('reminder','2026-10-31 03:00+00',50);
  if exists(select 1 from public.workspace_notifications as notice
    join test_starvation as test on test.checkin_id=notice.entity_id) then
    raise exception 'blocked CRM rows received reminder';
  end if;
  perform public.process_due_attendance_closing_interventions('reminder','2026-10-31 03:00+00',50);
  if not exists(select 1 from public.workspace_notifications as notice
    join test_starvation as test on test.checkin_id=notice.entity_id
    where test.n=51) then
    raise exception 'eligible CRM row starved behind blocked rows';
  end if;
end $$;

-- A CRM coworker cannot read another recipient's personal reminder, and
-- authenticated users cannot insert new notifications through RLS.
set role authenticated;
select set_config('test.auth_role','crm',false);
select set_config('test.auth_branch_id','10000000-0000-0000-0000-000000000001',false);
select set_config('test.auth_staff_id','20000000-0000-0000-0000-000000000003',false);
do $$ begin
  if exists(select 1 from public.workspace_notifications where
    dedupe_key='staff-clock-out-reminder:40000000-0000-0000-0000-000000000001') then
    raise exception 'CRM coworker can read personal reminder';
  end if;
  update public.workspace_notifications set status='unread' where
    dedupe_key='staff-clock-out-reminder:40000000-0000-0000-0000-000000000001';
  if found then raise exception 'CRM coworker changed personal reminder'; end if;
  begin
    insert into public.workspace_notifications(type,status,target_workspace)
    values ('attendance_clock_out_reminder','unread','crm');
    raise exception 'authenticated insertion unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Execute the reviewed operation against a local cron stand-in. It must add
-- exactly one job while retaining the four accepted Closing jobs.
create schema cron;
create table cron.job (
  jobid bigint generated always as identity primary key,
  jobname text unique, schedule text, active boolean default true, command text
);
create function cron.schedule(p_name text,p_schedule text,p_command text)
returns bigint language plpgsql as $$
declare v_jobid bigint;
begin
  insert into cron.job(jobname,schedule,command)
  values (p_name,p_schedule,p_command) returning jobid into v_jobid;
  return v_jobid;
end $$;
insert into cron.job(jobname,schedule,command) values
  ('attendance-closing-reminder','baseline','baseline'),
  ('attendance-closing-manager-escalation','baseline','baseline'),
  ('attendance-closing-auto-close','baseline','baseline'),
  ('attendance-closing-catch-up','baseline','baseline');
\ir ../../supabase/operations/enable-staff-attendance-reminders.sql
do $$ begin
  if (select count(*) from cron.job) <> 5
     or (select count(*) from cron.job where jobname like 'attendance-closing-%'
         and schedule='baseline' and command='baseline') <> 4
     or not exists(select 1 from cron.job where
         jobname='attendance-staff-clock-out-reminder' and schedule='7 * * * *') then
    raise exception 'operation changed existing Closing jobs or failed to add one';
  end if;
end $$;

select 'attendance reminder TEST integration passed' as result;
