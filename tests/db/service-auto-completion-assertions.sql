begin;

insert into public.branches values ('10000000-0000-0000-0000-000000000001');
insert into public.staff values ('20000000-0000-0000-0000-000000000001');
insert into public.customers values ('30000000-0000-0000-0000-000000000001', 'Test Customer');
insert into public.services values ('40000000-0000-0000-0000-000000000001', 'Test Treatment');
insert into public.booking_attendees values ('50000000-0000-0000-0000-000000000001', 'Test Guest');

-- The eligible line and a later sibling share a synthetic parent order ID.
-- The other lines cover historical and no-start exclusions.
insert into public.bookings (
  id, branch_id, staff_id, customer_id, service_id, attendee_id, resource_id,
  booking_date, delivery_type, status, booking_progress_status,
  session_start_source, session_started_at, session_due_at
) values
  ('60000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000001',
   '50000000-0000-0000-0000-000000000001',
   '70000000-0000-0000-0000-000000000001',
   (clock_timestamp() at time zone 'Asia/Manila')::date,
   'in_spa', 'in_progress', 'session_started', 'crm',
   clock_timestamp() - interval '9 minutes', clock_timestamp() - interval '3 minutes'),
  ('60000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000001', null,
   '70000000-0000-0000-0000-000000000001',
   (clock_timestamp() at time zone 'Asia/Manila')::date - 1,
   'in_spa', 'in_progress', 'session_started', 'crm',
   clock_timestamp() - interval '1 day', clock_timestamp() - interval '23 hours'),
  ('60000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000001', null,
   '70000000-0000-0000-0000-000000000001',
   (clock_timestamp() at time zone 'Asia/Manila')::date,
   'in_spa', 'in_progress', 'session_started', 'staff_portal',
   clock_timestamp() - interval '1 minute', clock_timestamp() + interval '59 minutes'),
  ('60000000-0000-0000-0000-000000000004',
   '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000001', null,
   '70000000-0000-0000-0000-000000000001',
   (clock_timestamp() at time zone 'Asia/Manila')::date,
   'in_spa', 'in_progress', 'session_started', null,
   null, clock_timestamp() - interval '3 minutes');

update public.bookings
set order_id = '80000000-0000-0000-0000-000000000001'
where id in (
  '60000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000003'
);

do $assert_disabled$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.service_auto_completion_policy'::regclass
      and conname = 'service_auto_completion_release_gate'
  ) then
    raise exception 'physical release gate is absent';
  end if;
  if has_function_privilege('authenticated', 'public.complete_due_service_sessions(integer)', 'EXECUTE') then
    raise exception 'authenticated role may execute auto completion';
  end if;
  if not has_function_privilege('service_role', 'public.complete_due_service_sessions(integer)', 'EXECUTE') then
    raise exception 'service role cannot execute auto completion';
  end if;
  if (select count(*) from public.complete_due_service_sessions(100)) <> 0 then
    raise exception 'disabled policy completed a service';
  end if;
end
$assert_disabled$;

-- Simulate the separately approved release migration only inside this
-- disposable transaction. The shipped migration itself remains hard-disabled.
alter table public.service_auto_completion_policy
  drop constraint service_auto_completion_release_gate;

insert into public.service_auto_completion_policy (
  branch_id, enabled, eligible_started_after, activated_at
) values (
  '10000000-0000-0000-0000-000000000001', true,
  clock_timestamp() - interval '10 minutes', clock_timestamp() - interval '10 minutes'
);

do $assert_completion$
declare
  v_completed_at timestamptz;
begin
  select completed_at into v_completed_at
  from public.complete_due_service_sessions(100);
  if v_completed_at is null then
    raise exception 'eligible service did not complete';
  end if;
  if (select count(*) from public.bookings where status = 'completed') <> 1 then
    raise exception 'incorrect number of completed service lines';
  end if;
  if not exists (
    select 1 from public.bookings
    where id = '60000000-0000-0000-0000-000000000001'
      and session_completion_source = 'auto_due'
      and session_completed_at = session_auto_completed_at
      and session_completed_at = completed_at
  ) then
    raise exception 'completion state or timestamp mismatch';
  end if;
  if (select count(*) from public.workspace_notifications) <> 3 then
    raise exception 'CRM, manager, therapist notifications were not all committed';
  end if;
  if (select count(distinct dedupe_key) from public.workspace_notifications) <> 3 then
    raise exception 'notification dedupe keys collided';
  end if;
  if (select count(*) from public.complete_due_service_sessions(100)) <> 0 then
    raise exception 'retry completed a service twice';
  end if;
  if (select count(*) from public.workspace_notifications) <> 3 then
    raise exception 'retry duplicated notifications';
  end if;
end
$assert_completion$;

rollback;
