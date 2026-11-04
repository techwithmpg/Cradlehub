\set ON_ERROR_STOP on
insert into public.branches(id) values ('00000000-0000-4000-8000-000000000001');
insert into public.staff(id,auth_user_id,system_role,branch_id) values
  ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000012','owner','00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000013','crm','00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000014','staff','00000000-0000-4000-8000-000000000001');
insert into public.services(id,name,duration_minutes,duration_policy)
values ('00000000-0000-4000-8000-000000000005','Fixed service',60,'fixed');
insert into public.branch_resources(id,branch_id,capacity)
values ('00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001',1);
insert into public.booking_orders(id,branch_id,metadata)
values ('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000001','{"total_amount":100}');
insert into public.bookings (
  id,order_id,branch_id,staff_id,service_id,resource_id,booking_date,
  delivery_type,status,booking_progress_status,start_time,end_time,
  session_started_at,session_due_at,session_duration_minutes_snapshot,
  session_extension_minutes_total,metadata)
values (
  '00000000-0000-4000-8000-000000000008',
  '00000000-0000-4000-8000-000000000007',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000006',
  (clock_timestamp() at time zone 'Asia/Manila')::date,
  'in_spa','in_progress','session_started',
  ((clock_timestamp() - interval '10 minutes') at time zone 'Asia/Manila')::time,
  ((clock_timestamp() + interval '50 minutes') at time zone 'Asia/Manila')::time,
  clock_timestamp() - interval '10 minutes',
  clock_timestamp() + interval '50 minutes',60,0,'{"price_paid":100}');
insert into public.staff_schedules(staff_id,day_of_week,start_time,end_time,is_active)
values ('00000000-0000-4000-8000-000000000004',
  extract(dow from (clock_timestamp() at time zone 'Asia/Manila')::date),
  '00:00','23:59',true);

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000012',false);
set role authenticated;
select public.set_fixed_service_continuation_option(
  '00000000-0000-4000-8000-000000000005',15,200,90);
select public.set_branch_treatment_closing_time(
  '00000000-0000-4000-8000-000000000001','23:59');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000013',false);
set role authenticated;
do $$ begin
  begin
    perform public.extend_booking_service_session(
      '00000000-0000-4000-8000-000000000008',15,'bypass',null);
    raise exception 'old no-charge RPC was accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'PRICED_SERVICE_CONTINUATION_REQUIRED' then raise; end if;
  end;
end $$;
select public.continue_booking_service_session(
  '00000000-0000-4000-8000-000000000008',15,'client requested',
  '00000000-0000-4000-8000-000000000009');
select public.continue_booking_service_session(
  '00000000-0000-4000-8000-000000000008',15,'client requested',
  '00000000-0000-4000-8000-000000000009');
reset role;

do $$
declare v_booking record; v_count integer;
begin
  select * into v_booking from public.bookings
    where id = '00000000-0000-4000-8000-000000000008';
  if v_booking.session_extension_minutes_total <> 15 then
    raise exception 'extension minutes were not persisted once';
  end if;
  if (v_booking.session_due_at - v_booking.session_started_at) <> interval '75 minutes' then
    raise exception 'due time was not extended from server snapshot';
  end if;
  select count(*) into v_count from public.service_continuation_events;
  if v_count <> 1 then raise exception 'continuation retry duplicated audit'; end if;
  select count(*) into v_count from public.order_payable_items
    where charge_type = 'surcharge' and amount = 200
      and source_type = 'service_continuation';
  if v_count <> 1 then raise exception 'continuation surcharge missing or duplicated'; end if;
  if (select (metadata->>'service_continuation_total')::numeric
    from public.booking_orders where id = '00000000-0000-4000-8000-000000000007') <> 200 then
    raise exception 'parent order continuation total incorrect';
  end if;
  if (select count(*) from public.order_payable_items) <> 2 then
    raise exception 'base payable or surcharge missing';
  end if;
end $$;

-- A second request cannot extend beyond the owner-approved 90-minute maximum.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000013',false);
set role authenticated;
do $$ begin
  begin
    perform public.continue_booking_service_session(
      '00000000-0000-4000-8000-000000000008',30,'too long',
      '00000000-0000-4000-8000-000000000010');
    raise exception 'maximum duration was bypassed';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'SERVICE_CONTINUATION_PRICE_OR_LIMIT_UNAVAILABLE' then raise; end if;
  end;
end $$;
reset role;

-- Manual notifications are inserted within the booking update transaction.
update public.bookings set session_started_at = clock_timestamp(),
  session_started_by = '00000000-0000-4000-8000-000000000003'
where id = '00000000-0000-4000-8000-000000000008';
update public.bookings set status = 'completed', booking_progress_status = 'completed',
  session_completed_at = clock_timestamp(), session_completion_source = 'crm_manual',
  session_completed_by = '00000000-0000-4000-8000-000000000003'
where id = '00000000-0000-4000-8000-000000000008';
do $$ begin
  if (select count(*) from public.workspace_notifications
      where metadata->>'service_transition' = 'completed') <> 3 then
    raise exception 'manual completion notifications not atomic';
  end if;
end $$;

-- A separate booking proves that start notifications roll back with the
-- transition and that re-saving the same timestamp emits nothing twice.
insert into public.bookings (
  id,order_id,branch_id,staff_id,service_id,resource_id,booking_date,
  delivery_type,status,booking_progress_status,start_time,end_time,
  session_duration_minutes_snapshot,session_extension_minutes_total,metadata)
values (
  '00000000-0000-4000-8000-000000000018',
  '00000000-0000-4000-8000-000000000007',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000006',
  (clock_timestamp() at time zone 'Asia/Manila')::date,
  'in_spa','confirmed','scheduled',
  ((clock_timestamp() + interval '2 hours') at time zone 'Asia/Manila')::time,
  ((clock_timestamp() + interval '3 hours') at time zone 'Asia/Manila')::time,
  60,0,'{"price_paid":100}');
begin;
update public.bookings set status = 'in_progress', booking_progress_status = 'session_started',
  session_started_at = clock_timestamp(),
  session_due_at = clock_timestamp() + interval '60 minutes',
  session_started_by = '00000000-0000-4000-8000-000000000003'
where id = '00000000-0000-4000-8000-000000000018';
rollback;
do $$ begin
  if exists (select 1 from public.workspace_notifications
      where entity_id = '00000000-0000-4000-8000-000000000018') then
    raise exception 'uncommitted start notification escaped rollback';
  end if;
end $$;
update public.bookings set status = 'in_progress', booking_progress_status = 'session_started',
  session_started_at = clock_timestamp(),
  session_due_at = clock_timestamp() + interval '60 minutes',
  session_started_by = '00000000-0000-4000-8000-000000000003'
where id = '00000000-0000-4000-8000-000000000018';
update public.bookings set session_started_at = session_started_at
where id = '00000000-0000-4000-8000-000000000018';
do $$ begin
  if (select count(*) from public.workspace_notifications
      where entity_id = '00000000-0000-4000-8000-000000000018'
        and metadata->>'service_transition' = 'started') <> 3 then
    raise exception 'committed start notification count incorrect';
  end if;
end $$;

-- No canonical order is a visible manual-review case, never a free extension.
insert into public.bookings (
  id,branch_id,staff_id,service_id,resource_id,booking_date,
  delivery_type,status,booking_progress_status,start_time,end_time,
  session_started_at,session_due_at,session_duration_minutes_snapshot,
  session_extension_minutes_total,metadata)
values ('00000000-0000-4000-8000-000000000028',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000006',
  (clock_timestamp() at time zone 'Asia/Manila')::date,
  'in_spa','in_progress','session_started',
  ((clock_timestamp() - interval '10 minutes') at time zone 'Asia/Manila')::time,
  ((clock_timestamp() + interval '50 minutes') at time zone 'Asia/Manila')::time,
  clock_timestamp() - interval '10 minutes',
  clock_timestamp() + interval '50 minutes',60,0,'{"price_paid":100}');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000013',false);
set role authenticated;
do $$ begin
  begin
    perform public.continue_booking_service_session(
      '00000000-0000-4000-8000-000000000028',15,'legacy request',
      '00000000-0000-4000-8000-000000000029');
    raise exception 'legacy booking was extended';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'SERVICE_CONTINUATION_ORDER_REVIEW_REQUIRED' then raise; end if;
  end;
end $$;
reset role;
