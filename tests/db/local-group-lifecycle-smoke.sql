\set ON_ERROR_STOP on
do $$ begin
  if current_database() <> 'service_lifecycle_group_integration'
    or inet_server_addr() is distinct from '127.0.0.1'::inet
    or inet_server_port() is distinct from 55434 then
    raise exception 'LOCAL integration target guard failed';
  end if;
end $$;
-- Disposable LOCAL synthetic compatibility test, never production.
update public.services set name='Local Treatment', duration_minutes=60,
  duration_policy='fixed' where id='00000000-0000-4000-8000-000000000003';
update public.staff set system_role='owner', auth_user_id='11111111-1111-4111-8111-111111111111'
  where id='00000000-0000-4000-8000-000000000001';

select public.test_make_order('lifecycle-group-local-20261104',2,0,current_date+1,1);
update public.booking_orders set booking_date=current_date
  where idempotency_key='lifecycle-group-local-20261104';
update public.bookings set booking_date=current_date,
  start_time=((clock_timestamp() at time zone 'Asia/Manila')+interval '5 minutes')::time,
  end_time=((clock_timestamp() at time zone 'Asia/Manila')+interval '65 minutes')::time
  where order_id=(select id from public.booking_orders
    where idempotency_key='lifecycle-group-local-20261104');
select public.confirm_online_booking_order_atomic(b.id,b.branch_id)
  from public.bookings b join public.booking_orders o on o.id=b.order_id
  where o.idempotency_key='lifecycle-group-local-20261104'
  order by b.id limit 1;
do $$ begin
  if (select count(*) from public.bookings b join public.booking_orders o on o.id=b.order_id
    where o.idempotency_key='lifecycle-group-local-20261104'
      and b.status='confirmed' and b.resource_id is not null) <> 2 then
    raise exception 'Accepted group confirmation failed after lifecycle migrations';
  end if;
end $$;

select b.id as booking_id from public.bookings b
  join public.booking_orders o on o.id=b.order_id
  where o.idempotency_key='lifecycle-group-local-20261104'
  order by b.line_sequence,b.id limit 1 \gset
update public.bookings set status='in_progress', booking_progress_status='session_started',
  start_time=((clock_timestamp() at time zone 'Asia/Manila')-interval '5 minutes')::time,
  end_time=((clock_timestamp() at time zone 'Asia/Manila')+interval '55 minutes')::time,
  session_started_at=clock_timestamp(),
  session_due_at=clock_timestamp()+interval '60 minutes',
  session_start_source='crm', session_started_by='00000000-0000-4000-8000-000000000001',
  session_duration_minutes_snapshot=60
  where id=:'booking_id'::uuid;
do $$ begin
  if (select count(*) from public.workspace_notifications
    where entity_id=(select b.id from public.bookings b join public.booking_orders o on o.id=b.order_id
      where o.idempotency_key='lifecycle-group-local-20261104' order by b.line_sequence,b.id limit 1)
      and title='Service Started') <> 3 then
    raise exception 'Transactional start notices missing';
  end if;
  if (select count(*) from public.bookings b join public.booking_orders o on o.id=b.order_id
    where o.idempotency_key='lifecycle-group-local-20261104' and b.status='confirmed') <> 1 then
    raise exception 'Sibling group line changed';
  end if;
end $$;

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
set role authenticated;
select public.set_fixed_service_continuation_option(
  '00000000-0000-4000-8000-000000000003',30,100,120);
select public.set_branch_treatment_closing_time(
  '00000000-0000-4000-8000-000000000001','18:00');
select public.continue_booking_service_session(:'booking_id'::uuid,30,'LOCAL group continuation',
  '22222222-2222-4222-8222-222222222222');
select public.continue_booking_service_session(:'booking_id'::uuid,30,'LOCAL group continuation',
  '22222222-2222-4222-8222-222222222222');
reset role;

do $$ begin
  if (select count(*) from public.service_continuation_events
    where booking_id=(select b.id from public.bookings b join public.booking_orders o on o.id=b.order_id
      where o.idempotency_key='lifecycle-group-local-20261104' order by b.line_sequence,b.id limit 1)) <> 1 then
    raise exception 'Continuation retry was not idempotent';
  end if;
  if (select count(*) from public.order_payable_items
    where booking_id=(select b.id from public.bookings b join public.booking_orders o on o.id=b.order_id
      where o.idempotency_key='lifecycle-group-local-20261104' order by b.line_sequence,b.id limit 1)
      and charge_type='surcharge' and amount=100) <> 1 then
    raise exception 'Priced continuation surcharge missing';
  end if;
  if (select count(*) from public.bookings b join public.booking_orders o on o.id=b.order_id
    where o.idempotency_key='lifecycle-group-local-20261104' and b.status='confirmed') <> 1 then
    raise exception 'Continuation changed sibling group line';
  end if;
end $$;

alter table public.workspace_notifications add constraint local_fail_completed_notice
  check(title <> 'Service Completed');
do $$ begin
  begin
    update public.bookings set status='completed', booking_progress_status='completed',
      session_completed_at=clock_timestamp(), session_completion_source='crm_manual',
      session_completed_by='00000000-0000-4000-8000-000000000001'
    where id=(select b.id from public.bookings b join public.booking_orders o on o.id=b.order_id
      where o.idempotency_key='lifecycle-group-local-20261104' order by b.line_sequence,b.id limit 1);
    raise exception 'Expected notification write failure';
  exception when check_violation then null;
  end;
  if (select b.status from public.bookings b join public.booking_orders o on o.id=b.order_id
    where o.idempotency_key='lifecycle-group-local-20261104' order by b.line_sequence,b.id limit 1) <> 'in_progress' then
    raise exception 'Failed notification left a partial completion';
  end if;
end $$;
alter table public.workspace_notifications drop constraint local_fail_completed_notice;
update public.bookings set status='completed', booking_progress_status='completed',
  session_completed_at=clock_timestamp(), session_completion_source='crm_manual',
  session_completed_by='00000000-0000-4000-8000-000000000001'
where id=:'booking_id'::uuid;
do $$ begin
  if (select count(*) from public.workspace_notifications
    where entity_id=(select b.id from public.bookings b join public.booking_orders o on o.id=b.order_id
      where o.idempotency_key='lifecycle-group-local-20261104' order by b.line_sequence,b.id limit 1)
      and title='Service Completed') <> 3 then
    raise exception 'Transactional completion notices missing';
  end if;
  if exists(select 1 from public.service_auto_completion_policy where enabled) then
    raise exception 'Release latch was enabled';
  end if;
end $$;
