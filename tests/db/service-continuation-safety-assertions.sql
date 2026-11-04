\set ON_ERROR_STOP on
-- Run after service-continuation-assertions.sql in the same disposable database.
-- Booking 18 is active and has an approved option, but never acquires a charge.
update public.branch_treatment_closing_policy
set closing_time = ((clock_timestamp() + interval '65 minutes') at time zone 'Asia/Manila')::time
where branch_id = '00000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000013',false);
set role authenticated;
do $$ begin
  begin
    perform public.continue_booking_service_session(
      '00000000-0000-4000-8000-000000000018',15,'after close',
      '00000000-0000-4000-8000-000000000031');
    raise exception 'branch treatment close was bypassed';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'SERVICE_CONTINUATION_AFTER_TREATMENT_CLOSE' then raise; end if;
  end;
end $$;
reset role;

update public.branch_treatment_closing_policy set closing_time = '23:59'
where branch_id = '00000000-0000-4000-8000-000000000001';

update public.staff_schedules
set end_time = ((clock_timestamp() + interval '65 minutes') at time zone 'Asia/Manila')::time
where staff_id = '00000000-0000-4000-8000-000000000004';
set role authenticated;
do $$ begin
  begin
    perform public.continue_booking_service_session(
      '00000000-0000-4000-8000-000000000018',15,'beyond shift',
      '00000000-0000-4000-8000-000000000032');
    raise exception 'therapist shift was bypassed';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'SERVICE_CONTINUATION_THERAPIST_UNAVAILABLE' then raise; end if;
  end;
end $$;
reset role;
update public.staff_schedules set end_time = '23:59'
where staff_id = '00000000-0000-4000-8000-000000000004';

-- The earlier completed synthetic line occupies the same room in the fixture;
-- remove its therapist assignment so each conflict below isolates one guard.
update public.bookings set staff_id = null
where id in ('00000000-0000-4000-8000-000000000008',
  '00000000-0000-4000-8000-000000000028');

insert into public.bookings (
  id,branch_id,staff_id,resource_id,booking_date,delivery_type,status,
  booking_progress_status,start_time,end_time)
values (
  '00000000-0000-4000-8000-000000000033',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000006',
  (clock_timestamp() at time zone 'Asia/Manila')::date,
  'in_spa','confirmed','scheduled',
  ((clock_timestamp() + interval '65 minutes') at time zone 'Asia/Manila')::time,
  ((clock_timestamp() + interval '95 minutes') at time zone 'Asia/Manila')::time);
set role authenticated;
do $$ begin
  begin
    perform public.continue_booking_service_session(
      '00000000-0000-4000-8000-000000000018',15,'room conflict',
      '00000000-0000-4000-8000-000000000034');
    raise exception 'room capacity was bypassed';
  exception when sqlstate '23P01' then
    if sqlerrm <> 'SERVICE_CONTINUATION_ROOM_CONFLICT' then raise; end if;
  end;
end $$;
reset role;
delete from public.bookings where id = '00000000-0000-4000-8000-000000000033';

insert into public.bookings (
  id,branch_id,staff_id,booking_date,delivery_type,status,
  booking_progress_status,start_time,end_time)
values (
  '00000000-0000-4000-8000-000000000035',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000004',
  (clock_timestamp() at time zone 'Asia/Manila')::date,
  'in_spa','confirmed','scheduled',
  ((clock_timestamp() + interval '65 minutes') at time zone 'Asia/Manila')::time,
  ((clock_timestamp() + interval '95 minutes') at time zone 'Asia/Manila')::time);
set role authenticated;
do $$ begin
  begin
    perform public.continue_booking_service_session(
      '00000000-0000-4000-8000-000000000018',15,'therapist conflict',
      '00000000-0000-4000-8000-000000000036');
    raise exception 'therapist booking conflict was bypassed';
  exception when sqlstate '23P01' then
    if sqlerrm <> 'SERVICE_CONTINUATION_THERAPIST_CONFLICT' then raise; end if;
  end;
end $$;
reset role;
delete from public.bookings where id = '00000000-0000-4000-8000-000000000035';
update public.bookings set staff_id = '00000000-0000-4000-8000-000000000004'
where id in ('00000000-0000-4000-8000-000000000008',
  '00000000-0000-4000-8000-000000000028');

do $$ begin
  if (select count(*) from public.service_continuation_events) <> 1
    or (select count(*) from public.order_payable_items where charge_type = 'surcharge') <> 1
    or (select session_extension_minutes_total from public.bookings
      where id = '00000000-0000-4000-8000-000000000018') <> 0 then
    raise exception 'rejected continuations altered financial or booking state';
  end if;
end $$;

insert into public.staff(id,auth_user_id,system_role,branch_id)
values ('00000000-0000-4000-8000-000000000037',
  '00000000-0000-4000-8000-000000000038','staff',
  '00000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000038',false);
set role authenticated;
do $$ begin
  begin
    perform public.continue_booking_service_session(
      '00000000-0000-4000-8000-000000000018',15,'unauthorized',
      '00000000-0000-4000-8000-000000000039');
    raise exception 'unassigned therapist was authorized';
  exception when sqlstate '42501' then
    if sqlerrm <> 'SERVICE_CONTINUATION_NOT_AUTHORIZED' then raise; end if;
  end;
end $$;
reset role;

-- Extendable catalogue charges require a current owner approval snapshot.
insert into public.staff(id,auth_user_id,system_role,branch_id)
values ('00000000-0000-4000-8000-000000000042',null,'staff',
  '00000000-0000-4000-8000-000000000001');
insert into public.services
  (id,name,duration_minutes,duration_policy,extension_increment_minutes,
   extension_price,maximum_duration_minutes)
values ('00000000-0000-4000-8000-000000000041','Extendable service',60,
  'extendable',15,80,90);
insert into public.branch_resources(id,branch_id,capacity)
values ('00000000-0000-4000-8000-000000000043',
  '00000000-0000-4000-8000-000000000001',1);
insert into public.booking_orders(id,branch_id,metadata)
values ('00000000-0000-4000-8000-000000000044',
  '00000000-0000-4000-8000-000000000001','{"total_amount":120}');
insert into public.bookings (
  id,order_id,branch_id,staff_id,service_id,resource_id,booking_date,
  delivery_type,status,booking_progress_status,start_time,end_time,
  session_started_at,session_due_at,session_duration_minutes_snapshot,
  session_extension_minutes_total,metadata)
values (
  '00000000-0000-4000-8000-000000000040',
  '00000000-0000-4000-8000-000000000044',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000042',
  '00000000-0000-4000-8000-000000000041',
  '00000000-0000-4000-8000-000000000043',
  (clock_timestamp() at time zone 'Asia/Manila')::date,
  'in_spa','in_progress','session_started',
  ((clock_timestamp() - interval '10 minutes') at time zone 'Asia/Manila')::time,
  ((clock_timestamp() + interval '50 minutes') at time zone 'Asia/Manila')::time,
  clock_timestamp() - interval '10 minutes',
  clock_timestamp() + interval '50 minutes',60,0,'{"price_paid":120}');
insert into public.staff_schedules(staff_id,day_of_week,start_time,end_time,is_active)
values ('00000000-0000-4000-8000-000000000042',
  extract(dow from (clock_timestamp() at time zone 'Asia/Manila')::date),
  '00:00','23:59',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000013',false);
set role authenticated;
do $$ begin
  begin
    perform public.continue_booking_service_session(
      '00000000-0000-4000-8000-000000000040',15,'before owner approval',
      '00000000-0000-4000-8000-000000000045');
    raise exception 'unapproved extendable price was charged';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'SERVICE_CONTINUATION_OWNER_APPROVAL_REQUIRED' then raise; end if;
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000012',false);
set role authenticated;
select public.approve_extendable_service_continuation(
  '00000000-0000-4000-8000-000000000041',true);
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000013',false);
set role authenticated;
select public.continue_booking_service_session(
  '00000000-0000-4000-8000-000000000040',15,'approved extendable price',
  '00000000-0000-4000-8000-000000000046');
reset role;
do $$ begin
  if not exists (select 1 from public.order_payable_items
    where booking_id = '00000000-0000-4000-8000-000000000040'
      and charge_type = 'surcharge' and amount = 80) then
    raise exception 'owner-approved extendable surcharge absent';
  end if;
end $$;
update public.services set extension_price = 100
where id = '00000000-0000-4000-8000-000000000041';
set role authenticated;
do $$ begin
  begin
    perform public.continue_booking_service_session(
      '00000000-0000-4000-8000-000000000040',15,'changed catalogue price',
      '00000000-0000-4000-8000-000000000047');
    raise exception 'changed catalogue price bypassed owner approval';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'SERVICE_CONTINUATION_OWNER_APPROVAL_REQUIRED' then raise; end if;
  end;
end $$;
reset role;
