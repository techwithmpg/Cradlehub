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
