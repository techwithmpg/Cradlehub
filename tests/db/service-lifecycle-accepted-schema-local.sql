\set ON_ERROR_STOP on
do $$ begin
 if current_database() <> 'cradlehub_lifecycle_fresh_local' or inet_server_addr() is not null then
  raise exception 'LOCAL_FIXTURE_REFUSES_NONLOCAL_TARGET';
 end if;
end $$;
begin;
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
insert into public.branches(id,name,address) values
 ('10000000-0000-4000-8000-000000000001','LOCAL Branch','Synthetic address');
insert into public.service_categories(id,name) values
 ('20000000-0000-4000-8000-000000000001','LOCAL Category');
insert into public.services(id,category_id,name,duration_minutes,price,duration_policy) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','LOCAL Treatment',60,500,'fixed');
insert into public.branch_services(branch_id,service_id,is_active,available_in_spa) values
 ('10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',true,true)
 on conflict (branch_id,service_id) do update set is_active=true,available_in_spa=true;
insert into public.staff(id,branch_id,full_name,system_role,staff_type,auth_user_id,is_active) values
 ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','LOCAL Owner','owner','managerial','11111111-1111-4111-8111-111111111111',true),
 ('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','LOCAL CRM','crm','csr','22222222-2222-4222-8222-222222222222',true),
 ('40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','LOCAL Therapist A','staff','therapist',null,true),
 ('40000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','LOCAL Therapist B','staff','therapist',null,true);
insert into public.staff_services(staff_id,service_id) values
 ('40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001'),
 ('40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000001');
insert into public.staff_schedules(staff_id,day_of_week,start_time,end_time,is_active)
select staff_id,day_of_week,'08:00'::time,'23:59'::time,true
from (values
 ('40000000-0000-4000-8000-000000000003'::uuid),
 ('40000000-0000-4000-8000-000000000004'::uuid)) as staff(staff_id)
cross join generate_series(0,6) as day(day_of_week);
insert into public.branch_resources(id,branch_id,name,type,capacity,is_active,sort_order) values
 ('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','LOCAL Room A','room',1,true,1),
 ('50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','LOCAL Room B','room',1,true,2);
insert into public.customers(id,full_name,phone) values
 ('60000000-0000-4000-8000-000000000001','LOCAL Organizer','00000000001');
insert into public.booking_orders(id,order_number,branch_id,organizer_customer_id,booking_date,idempotency_key,payload_hash,delivery_type,metadata) values
 ('70000000-0000-4000-8000-000000000001','LOCAL-ORDER-1','10000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',current_date+1,'local-lifecycle-group-1','synthetic-hash','in_spa','{"total_amount":1000}');
insert into public.booking_attendees(id,booking_order_id,display_name,sequence) values
 ('80000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','LOCAL Guest A',1),
 ('80000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000001','LOCAL Guest B',2);
insert into public.bookings(id,order_id,attendee_id,line_sequence,branch_id,service_id,staff_id,customer_id,booking_date,start_time,end_time,type,delivery_type,status,booking_progress_status,metadata)
values
 ('90000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',1,'10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003','60000000-0000-4000-8000-000000000001',current_date+1,'10:00','11:00','online','in_spa','pending_crm_confirmation','not_started','{"price_paid":500}'),
 ('90000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',2,'10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000004','60000000-0000-4000-8000-000000000001',current_date+1,'10:00','11:00','online','in_spa','pending_crm_confirmation','not_started','{"price_paid":500}');
set role service_role;
select public.confirm_online_booking_order_atomic('90000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
reset role;
do $$ begin
 if (select count(*) from public.bookings where order_id='70000000-0000-4000-8000-000000000001' and status='confirmed' and resource_id is not null) <> 2 then
  raise exception 'LOCAL_GROUP_CONFIRMATION_FAILED';
 end if;
end $$;
update public.booking_orders set booking_date=(now() at time zone 'Asia/Manila')::date
 where id='70000000-0000-4000-8000-000000000001';
update public.bookings set booking_date=(now() at time zone 'Asia/Manila')::date,
 start_time=((now() at time zone 'Asia/Manila')+interval '2 hours')::time,
 end_time=((now() at time zone 'Asia/Manila')+interval '3 hours')::time
 where id='90000000-0000-4000-8000-000000000002';
update public.bookings set booking_date=(now() at time zone 'Asia/Manila')::date,
 start_time=((now() at time zone 'Asia/Manila')-interval '5 minutes')::time,
 end_time=((now() at time zone 'Asia/Manila')+interval '55 minutes')::time,
 status='in_progress', booking_progress_status='session_started',
 session_started_at=clock_timestamp(),
 session_due_at=clock_timestamp()+interval '60 minutes',
 session_start_source='crm',session_started_by='40000000-0000-4000-8000-000000000002',
 session_duration_minutes_snapshot=60
 where id='90000000-0000-4000-8000-000000000001';
do $$ begin
 if (select count(*) from public.workspace_notifications where entity_id='90000000-0000-4000-8000-000000000001' and title='Service Started') <> 3 then
  raise exception 'LOCAL_START_NOTIFICATIONS_MISSING';
 end if;
 if (select count(*) from public.service_transition_push_outbox) <> 3 then
  raise exception 'LOCAL_START_PUSH_OUTBOX_MISSING';
 end if;
 if (select status from public.bookings where id='90000000-0000-4000-8000-000000000002') <> 'confirmed' then
  raise exception 'LOCAL_GROUP_SIBLING_CHANGED';
 end if;
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set role authenticated;
select public.set_fixed_service_continuation_option('30000000-0000-4000-8000-000000000001',30,100,120);
select public.set_branch_treatment_closing_time('10000000-0000-4000-8000-000000000001','23:59');
reset role;
savepoint local_legacy_order_probe;
update public.bookings set order_id=null
 where id='90000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set role authenticated;
do $$ begin
 begin
  perform public.continue_booking_service_session('90000000-0000-4000-8000-000000000001',30,
   'LOCAL legacy order', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10');
  raise exception 'LOCAL_LEGACY_ORDER_UNEXPECTED';
 exception when others then
  if sqlerrm <> 'SERVICE_CONTINUATION_ORDER_REVIEW_REQUIRED' then raise; end if;
 end;
end $$;
reset role;
rollback to savepoint local_legacy_order_probe;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set role authenticated;
select public.continue_booking_service_session('90000000-0000-4000-8000-000000000001',30,'LOCAL synthetic continuation','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select public.continue_booking_service_session('90000000-0000-4000-8000-000000000001',30,'LOCAL synthetic continuation','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
reset role;
do $$ begin
 if (select count(*) from public.service_continuation_events where booking_id='90000000-0000-4000-8000-000000000001') <> 1 then
  raise exception 'LOCAL_CONTINUATION_NOT_IDEMPOTENT';
 end if;
 if (select count(*) from public.order_payable_items where order_id='70000000-0000-4000-8000-000000000001' and charge_type='surcharge' and amount=100) <> 1 then
  raise exception 'LOCAL_SURCHARGE_NOT_UNIQUE';
 end if;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set role authenticated;
do $$ begin
 begin
  perform public.set_fixed_service_continuation_option('30000000-0000-4000-8000-000000000001',30,1,120);
  raise exception 'LOCAL_CRM_PRICE_APPROVAL_UNEXPECTED';
 exception when others then
  if sqlerrm = 'LOCAL_CRM_PRICE_APPROVAL_UNEXPECTED' then raise; end if;
 end;
 begin
  perform public.continue_booking_service_session('90000000-0000-4000-8000-000000000001',60,
    'LOCAL exceeds maximum','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02');
  raise exception 'LOCAL_MAXIMUM_UNEXPECTED';
 exception when others then
  if sqlerrm <> 'SERVICE_CONTINUATION_PRICE_OR_LIMIT_UNAVAILABLE' then raise; end if;
 end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set role authenticated;
select public.set_fixed_service_continuation_option('30000000-0000-4000-8000-000000000001',30,100,180);
select public.set_branch_treatment_closing_time('10000000-0000-4000-8000-000000000001',
 ((now() at time zone 'Asia/Manila')+interval '100 minutes')::time);
reset role;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set role authenticated;
do $$ begin
 begin
  perform public.continue_booking_service_session('90000000-0000-4000-8000-000000000001',30,
    'LOCAL after close','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03');
  raise exception 'LOCAL_TREATMENT_CLOSE_UNEXPECTED';
 exception when others then
  if sqlerrm <> 'SERVICE_CONTINUATION_AFTER_TREATMENT_CLOSE' then raise; end if;
 end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set role authenticated;
select public.set_branch_treatment_closing_time('10000000-0000-4000-8000-000000000001','23:59');
reset role;
insert into public.blocked_times(staff_id,block_date,start_time,end_time,reason)
 values ('40000000-0000-4000-8000-000000000003',(now() at time zone 'Asia/Manila')::date,
 ((now() at time zone 'Asia/Manila')+interval '5 minutes')::time,
 ((now() at time zone 'Asia/Manila')+interval '100 minutes')::time,'other');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set role authenticated;
do $$ begin
 begin
  perform public.continue_booking_service_session('90000000-0000-4000-8000-000000000001',30,
    'LOCAL therapist blocked','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04');
  raise exception 'LOCAL_THERAPIST_BLOCK_UNEXPECTED';
 exception when others then
  if sqlerrm <> 'SERVICE_CONTINUATION_THERAPIST_BLOCKED' then raise; end if;
 end;
end $$;
reset role;
delete from public.blocked_times where staff_id='40000000-0000-4000-8000-000000000003';
insert into public.bookings(id,branch_id,service_id,staff_id,customer_id,booking_date,start_time,end_time,
 type,delivery_type,status,booking_progress_status,resource_id)
 values ('90000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000004',
 '60000000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Manila')::date,
 ((now() at time zone 'Asia/Manila')+interval '91 minutes')::time,
 ((now() at time zone 'Asia/Manila')+interval '119 minutes')::time,
 'walkin','in_spa','confirmed','not_started',
 (select resource_id from public.bookings where id='90000000-0000-4000-8000-000000000001'));
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set role authenticated;
do $$ begin
 begin
  perform public.continue_booking_service_session('90000000-0000-4000-8000-000000000001',30,
    'LOCAL room conflict','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa05');
  raise exception 'LOCAL_ROOM_CONFLICT_UNEXPECTED';
 exception when others then
  if sqlerrm <> 'SERVICE_CONTINUATION_ROOM_CONFLICT' then raise; end if;
 end;
end $$;
reset role;
delete from public.bookings where id='90000000-0000-4000-8000-000000000003';
insert into auth.users(id) values ('33333333-3333-4333-8333-333333333333');
insert into public.branches(id,name,address) values
 ('10000000-0000-4000-8000-000000000002','LOCAL Other Branch','Synthetic other address');
insert into public.staff(id,branch_id,full_name,system_role,staff_type,auth_user_id,is_active) values
 ('40000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000002',
  'LOCAL Other CRM','crm','csr','33333333-3333-4333-8333-333333333333',true);
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
set role authenticated;
do $$ begin
 begin
  perform public.continue_booking_service_session('90000000-0000-4000-8000-000000000001',30,
    'LOCAL cross branch','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa06');
  raise exception 'LOCAL_CROSS_BRANCH_UNEXPECTED';
 exception when others then
  if sqlerrm <> 'SERVICE_CONTINUATION_NOT_AUTHORIZED' then raise; end if;
 end;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.service_continuation_events) <> 1
    or (select count(*) from public.order_payable_items where charge_type='surcharge') <> 1 then
  raise exception 'LOCAL_DENIED_CONTINUATION_LEFT_FINANCIAL_MUTATION';
 end if;
end $$;
savepoint local_extendable_probe;
update public.services set duration_policy='extendable',extension_increment_minutes=30,
 extension_price=120,maximum_duration_minutes=180
where id='30000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set role authenticated;
do $$ begin
 begin
  perform public.continue_booking_service_session('90000000-0000-4000-8000-000000000001',30,
    'LOCAL unapproved catalog','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa07');
  raise exception 'LOCAL_UNAPPROVED_CATALOG_UNEXPECTED';
 exception when others then
  if sqlerrm <> 'SERVICE_CONTINUATION_OWNER_APPROVAL_REQUIRED' then raise; end if;
 end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set role authenticated;
select public.approve_extendable_service_continuation('30000000-0000-4000-8000-000000000001',true);
reset role;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set role authenticated;
select public.continue_booking_service_session('90000000-0000-4000-8000-000000000001',30,
 'LOCAL approved extendable','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa08');
reset role;
do $$ begin
 if (select count(*) from public.service_continuation_events) <> 2
    or (select count(*) from public.order_payable_items where charge_type='surcharge' and amount=120) <> 1 then
  raise exception 'LOCAL_APPROVED_EXTENDABLE_CHARGE_MISSING';
 end if;
end $$;
update public.services set extension_price=130
where id='30000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set role authenticated;
do $$ begin
 begin
  perform public.continue_booking_service_session('90000000-0000-4000-8000-000000000001',30,
    'LOCAL edited catalog','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa09');
  raise exception 'LOCAL_EDITED_CATALOG_UNEXPECTED';
 exception when others then
  if sqlerrm <> 'SERVICE_CONTINUATION_OWNER_APPROVAL_REQUIRED' then raise; end if;
 end;
end $$;
reset role;
rollback to savepoint local_extendable_probe;
savepoint local_auto_completion_probe;
alter table public.service_auto_completion_policy
 drop constraint service_auto_completion_release_gate;
insert into public.service_auto_completion_policy(branch_id,enabled,eligible_started_after,activated_at)
 values ('10000000-0000-4000-8000-000000000001',true,clock_timestamp()-interval '10 minutes',
  clock_timestamp()-interval '10 minutes');
update public.bookings set session_started_at=clock_timestamp()-interval '5 minutes',
 session_due_at=clock_timestamp()-interval '1 minute'
 where id='90000000-0000-4000-8000-000000000001';
set role service_role;
do $$ begin
 if (select count(*) from public.complete_due_service_sessions(10)) <> 0 then
  raise exception 'LOCAL_AUTO_GRACE_VIOLATED';
 end if;
end $$;
reset role;
update public.bookings set session_due_at=clock_timestamp()-interval '3 minutes'
 where id='90000000-0000-4000-8000-000000000001';
set role service_role;
do $$ begin
 if (select count(*) from public.complete_due_service_sessions(10)) <> 1
    or (select count(*) from public.complete_due_service_sessions(10)) <> 0 then
  raise exception 'LOCAL_AUTO_COMPLETION_OR_RETRY_FAILED';
 end if;
end $$;
reset role;
do $$ begin
 if (select session_completion_source from public.bookings where id='90000000-0000-4000-8000-000000000001') <> 'auto_due'
    or (select count(*) from public.workspace_notifications where entity_id='90000000-0000-4000-8000-000000000001' and title='Service Completed Automatically') <> 3
    or (select count(*) from public.service_transition_push_outbox) <> 6 then
  raise exception 'LOCAL_AUTO_COMPLETION_EVIDENCE_MISSING';
 end if;
end $$;
rollback to savepoint local_auto_completion_probe;
do $$ begin
 if has_function_privilege('authenticated','public.claim_service_transition_push_jobs(integer,text)','EXECUTE')
    or has_function_privilege('anon','public.finish_service_transition_push_job(uuid,uuid,uuid[],boolean,text)','EXECUTE') then
  raise exception 'LOCAL_PUSH_OUTBOX_CLIENT_ACCESS_EXPOSED';
 end if;
end $$;
set role service_role;
do $$ declare v_job record; begin
 select * into v_job from public.claim_service_transition_push_jobs(1,null);
 if v_job.notification_id is null then raise exception 'LOCAL_PUSH_JOB_NOT_CLAIMED'; end if;
 if not public.finish_service_transition_push_job(v_job.notification_id,v_job.lease_token,
     array['aaaaaaaa-0000-4000-8000-000000000001'::uuid],false,'LOCAL injected push failure') then
  raise exception 'LOCAL_PUSH_JOB_FINISH_FAILED';
 end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.service_transition_push_outbox
      where delivered_subscription_ids @> array['aaaaaaaa-0000-4000-8000-000000000001'::uuid]
        and completed_at is null and next_attempt_at > now()) <> 1 then
  raise exception 'LOCAL_FAILED_PUSH_WORK_NOT_DURABLE';
 end if;
end $$;
alter table public.service_transition_push_outbox
 add constraint local_fail_outbox_insert check (false) not valid;
do $$ begin
 begin
  update public.bookings set status='in_progress', booking_progress_status='session_started',
   start_time=((now() at time zone 'Asia/Manila')-interval '5 minutes')::time,
   end_time=((now() at time zone 'Asia/Manila')+interval '55 minutes')::time,
   session_started_at=clock_timestamp(),session_due_at=clock_timestamp()+interval '60 minutes',
   session_start_source='crm',session_started_by='40000000-0000-4000-8000-000000000002',
   session_duration_minutes_snapshot=60
  where id='90000000-0000-4000-8000-000000000002';
  raise exception 'LOCAL_OUTBOX_FAILURE_DID_NOT_ABORT';
 exception when check_violation then null;
 end;
 if (select status from public.bookings where id='90000000-0000-4000-8000-000000000002') <> 'confirmed'
    or (select count(*) from public.workspace_notifications where entity_id='90000000-0000-4000-8000-000000000002') <> 0
    or (select count(*) from public.service_transition_push_outbox) <> 3 then
  raise exception 'LOCAL_OUTBOX_FAILURE_LEFT_PARTIAL_TRANSITION';
 end if;
end $$;
alter table public.service_transition_push_outbox drop constraint local_fail_outbox_insert;
alter table public.workspace_notifications
 add constraint local_fail_completion_notice check (title <> 'Service Completed');
do $$ begin
 begin
  update public.bookings set status='completed',booking_progress_status='completed',
   session_completed_at=clock_timestamp(),session_completion_source='crm_manual',
   session_completed_by='40000000-0000-4000-8000-000000000002'
  where id='90000000-0000-4000-8000-000000000001';
  raise exception 'LOCAL_NOTIFICATION_FAILURE_DID_NOT_ABORT';
 exception when check_violation then null;
 end;
 if (select status from public.bookings where id='90000000-0000-4000-8000-000000000001') <> 'in_progress'
    or (select count(*) from public.service_continuation_events) <> 1
    or (select count(*) from public.order_payable_items where charge_type='surcharge') <> 1 then
  raise exception 'LOCAL_NOTIFICATION_FAILURE_LEFT_PARTIAL_MUTATION';
 end if;
end $$;
alter table public.workspace_notifications drop constraint local_fail_completion_notice;
update public.bookings set status='completed',booking_progress_status='completed',
 session_completed_at=clock_timestamp(),session_completion_source='crm_manual',
 session_completed_by='40000000-0000-4000-8000-000000000002'
where id='90000000-0000-4000-8000-000000000001';
do $$ begin
 if (select count(*) from public.workspace_notifications
      where entity_id='90000000-0000-4000-8000-000000000001' and title='Service Completed') <> 3
    or (select count(*) from public.service_transition_push_outbox) <> 6 then
  raise exception 'LOCAL_COMPLETION_NOTICES_OR_PUSH_WORK_MISSING';
 end if;
 if exists(select 1 from public.service_auto_completion_policy where enabled) then
  raise exception 'LOCAL_COMPLETION_LATCH_ENABLED';
 end if;
end $$;
rollback;
