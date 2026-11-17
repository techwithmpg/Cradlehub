-- REVIEW CANDIDATE ONLY. Requires separate target-aware approval BEFORE execution.
-- New private journey/event/device contracts. No historical migration replay.
-- Never apply through a generic db push. Controls default inactive.
begin;
create schema driver_unified_private;
revoke all on schema driver_unified_private from public,anon,authenticated;
create table driver_unified_private.control(id boolean primary key default true check(id),enabled boolean not null default false);
insert into driver_unified_private.control(id) values(true);
create table driver_unified_private.journeys(
 booking_id uuid primary key references public.bookings(id),
 branch_id uuid not null references public.branches(id),
 driver_id uuid not null references public.staff(id),therapist_id uuid not null references public.staff(id),
 stage text not null default 'pickup_pending' check(stage in ('pickup_pending','pickup_enroute','pickup_arrived','delivery_pending','delivery_enroute','customer_arrived','service_active','collection_pending','collection_enroute','collection_arrived','return_pending','return_enroute','return_arrived','complete','review')),
 revision integer not null default 0 check(revision>=0),reason text,updated_at timestamptz not null default now());
create index driver_journey_branch on driver_unified_private.journeys(branch_id,updated_at);
create index driver_journey_driver on driver_unified_private.journeys(driver_id,stage);
create index driver_journey_therapist on driver_unified_private.journeys(therapist_id);
-- Conservative one occupied/active transport at a time until capacity/dispatch
-- plans are explicitly installed. Service/collection waiting does not reserve a car.
create unique index driver_journey_one_active on driver_unified_private.journeys(driver_id)
 where stage in ('pickup_enroute','pickup_arrived','delivery_pending','delivery_enroute','customer_arrived','collection_enroute','collection_arrived','return_pending','return_enroute','return_arrived');
create table driver_unified_private.events(
 actor_id uuid not null references public.staff(id),request_id uuid not null,
 booking_id uuid not null references public.bookings(id),payload_hash bytea not null,
 action text not null,previous_stage text,next_stage text,revision integer not null,
 observation jsonb,result jsonb not null,created_at timestamptz not null default now(),primary key(actor_id,request_id));
create index driver_event_booking on driver_unified_private.events(booking_id,created_at);
create table driver_unified_private.devices(
 installation_id uuid primary key,staff_id uuid not null references public.staff(id),
 auth_user_id uuid not null,session_id uuid not null references auth.sessions(id) on delete cascade,
 token text not null unique check(length(token) between 80 and 4096),
 updated_at timestamptz not null default now(),disabled_at timestamptz);
create index driver_device_staff on driver_unified_private.devices(staff_id) where disabled_at is null;
create index driver_device_session on driver_unified_private.devices(session_id);
create table driver_unified_private.push(
 id uuid primary key default gen_random_uuid(),booking_id uuid not null references public.bookings(id),
 staff_id uuid not null references public.staff(id),kind text not null,
 event_key text not null unique,created_at timestamptz not null default now(),
 next_attempt_at timestamptz not null default now(),lease uuid,lease_until timestamptz,
 attempts integer not null default 0,state text not null default 'queued',
 accepted_installations uuid[] not null default '{}',attempt_log jsonb not null default '[]');
create index driver_push_due on driver_unified_private.push(next_attempt_at,id) where state in ('queued','failed','attempted');
create index driver_push_booking on driver_unified_private.push(booking_id);
create index driver_push_staff on driver_unified_private.push(staff_id);
alter table driver_unified_private.control enable row level security;
alter table driver_unified_private.journeys enable row level security;
alter table driver_unified_private.events enable row level security;
alter table driver_unified_private.devices enable row level security;
alter table driver_unified_private.push enable row level security;
revoke all on all tables in schema driver_unified_private from public,anon,authenticated;

-- Every privileged implementation is private, derives auth.uid(), and is called
-- by a narrow public invoker wrapper. No mobile service-role credential.
create function driver_unified_private.actor() returns public.staff
language plpgsql security definer set search_path='' as $$
declare s public.staff%rowtype;
begin
 if not exists(select 1 from driver_unified_private.control where id and enabled) then raise exception 'driver_journeys_inactive'; end if;
 select * into s from public.staff where auth_user_id=auth.uid() and is_active and archived_at is null and merged_into_staff_id is null for share;
 if s.id is null or s.branch_id is null or not coalesce((s.system_role='driver' or s.staff_type='driver'),false) or s.system_role in ('owner','manager','assistant_manager','store_manager','digital_marketer') or s.staff_type='managerial' then raise exception 'driver_required' using errcode='42501'; end if;
 return s;
end;$$;

create function driver_unified_private.project(b public.bookings,j driver_unified_private.journeys)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_stage text:=coalesce(j.stage,'pickup_pending');v_leg text;v_lat double precision;v_lng double precision;v_label text;v_destination jsonb;
begin
 v_leg:=case when v_stage like 'pickup_%' then 'pickup' when v_stage like 'delivery_%' then 'delivery'
  when v_stage like 'collection_%' then 'collection' when v_stage like 'return_%' then 'return' else null end;
 if v_leg in ('pickup','return') then
  select latitude,longitude,name into v_lat,v_lng,v_label from public.branches where id=b.branch_id and is_active;
 elsif v_leg in ('delivery','collection') then
  begin
   v_lat:=(b.metadata->'home_service_address'->>'lat')::double precision;
   v_lng:=(b.metadata->'home_service_address'->>'lng')::double precision;
   v_label:=coalesce(b.metadata->'home_service_address'->>'full_address',b.metadata->'home_service_address'->>'formatted_address',b.metadata->'home_service_address'->>'address');
  exception when others then v_lat:=null;v_lng:=null;end;
 end if;
 if v_lat between -90 and 90 and v_lng between -180 and 180 and nullif(btrim(v_label),'') is not null then
  v_destination:=jsonb_build_object('lat',v_lat,'lng',v_lng,'label',left(v_label,200));
 end if;
 return jsonb_build_object('bookingId',b.id,'revision',coalesce(j.revision,0),'stage',v_stage,'leg',v_leg,
  'destination',v_destination,'observedAt',now(),'reason',j.reason,
  'therapistName',(select left(full_name,160) from public.staff where id=b.staff_id),
  'customerName',(select left(full_name,160) from public.customers where id=b.customer_id),
  'branchName',(select left(name,160) from public.branches where id=b.branch_id),
  'bookingDate',b.booking_date,'startTime',b.start_time,
  'pickupLabel',(select left(name,200) from public.branches where id=b.branch_id),
  'customerAddress',left(coalesce(b.metadata->'home_service_address'->>'full_address',b.metadata->'home_service_address'->>'formatted_address',b.metadata->'home_service_address'->>'address'),200));
end;$$;

create function driver_unified_private.snapshot(p_booking_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.staff%rowtype;result jsonb;
begin
 s:=driver_unified_private.actor();
 select coalesce(jsonb_agg(x.snapshot order by x.booking_date,x.start_time,x.id),'[]') into result from (
  select b.id,b.booking_date,b.start_time,driver_unified_private.project(b,j) snapshot
  from public.bookings b left join driver_unified_private.journeys j on j.booking_id=b.id
  where b.driver_id=s.id and b.branch_id=s.branch_id and b.delivery_type='home_service'
   and b.status in ('confirmed','in_progress','completed')
   and (p_booking_id is null or b.id=p_booking_id)
   and ((j.booking_id is not null and j.stage<>'complete' and j.driver_id=s.id and j.therapist_id=b.staff_id)
     or (j.booking_id is null and b.status in ('confirmed','in_progress') and b.booking_progress_status='not_started'
       and b.booking_date between (now() at time zone 'Asia/Manila')::date and (now() at time zone 'Asia/Manila')::date+7))
  order by b.booking_date,b.start_time,b.id limit 100
 ) x;
 return result;
end;$$;

create function driver_unified_private.event(p_event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.staff%rowtype;b public.bookings%rowtype;j driver_unified_private.journeys%rowtype;
 e driver_unified_private.events%rowtype;v_request uuid:=(p_event->>'requestId')::uuid;
 v_booking uuid:=(p_event->>'bookingId')::uuid;v_action text:=p_event->>'action';v_previous text;v_next text;
 v_snapshot jsonb;v_target jsonb;v_point jsonb:=p_event->'point';v_lat double precision;v_lng double precision;
 v_accuracy double precision;v_observed timestamptz;v_distance double precision;v_hash bytea:=sha256(convert_to(p_event::text,'UTF8'));
begin
 s:=driver_unified_private.actor();
 -- Serialize this driver's starts; booking -> journey is also the trigger order.
 perform pg_advisory_xact_lock(hashtext('driver_unified_transport'),hashtext(s.id::text));
 select * into b from public.bookings where id=v_booking for update;
 if b.id is null or b.driver_id is distinct from s.id or b.branch_id is distinct from s.branch_id
  or b.delivery_type<>'home_service' or b.status not in ('confirmed','in_progress','completed') then raise exception 'assignment_expired' using errcode='42501'; end if;
 select * into e from driver_unified_private.events where actor_id=s.id and request_id=v_request;
 if found then
  if e.booking_id<>b.id or e.payload_hash<>v_hash then raise exception 'request_identity_mismatch';end if;
  return e.result;
 end if;
 select * into j from driver_unified_private.journeys where booking_id=b.id for update;
 if j.booking_id is null then
  if b.status not in ('confirmed','in_progress') or b.booking_progress_status<>'not_started' then raise exception 'legacy_trip_requires_review';end if;
  insert into driver_unified_private.journeys(booking_id,branch_id,driver_id,therapist_id) values(b.id,b.branch_id,s.id,b.staff_id) returning * into j;
 end if;
 if j.driver_id<>s.id or j.therapist_id<>b.staff_id or j.stage='review' then raise exception 'journey_assignment_changed';end if;
 if j.revision is distinct from (p_event->>'expectedRevision')::integer then raise exception 'stale_journey_revision';end if;
 v_previous:=j.stage;v_next:=null;
 v_snapshot:=driver_unified_private.project(b,j);v_target:=v_snapshot->'destination';
 if v_action='resume' and j.stage in ('pickup_enroute','delivery_enroute','collection_enroute','return_enroute') then v_next:=j.stage;
 elsif v_action='start' then
  if v_target is null or v_target='null'::jsonb then raise exception 'destination_requires_review';end if;
  v_next:=case j.stage when 'pickup_pending' then 'pickup_enroute' when 'delivery_pending' then 'delivery_enroute'
   when 'collection_pending' then 'collection_enroute' when 'return_pending' then 'return_enroute' else null end;
  if j.stage='pickup_pending' and b.booking_date<>(now() at time zone 'Asia/Manila')::date then raise exception 'pickup_not_due_today';end if;
  if j.stage='pickup_pending' and exists(select 1 from driver_unified_private.journeys other where other.driver_id=s.id and other.booking_id<>b.id and other.stage in ('service_active','collection_pending','customer_arrived')) then raise exception 'collection_commitment_requires_dispatch_plan';end if;
  if not exists(select 1 from public.staff_shift_checkins c where c.staff_id=s.id and c.branch_id=s.branch_id
    and c.status='checked_in' and c.checked_out_at is null and not c.is_test) then raise exception 'active_shift_required';end if;
  -- Unknown vehicle capacity/overlapping plan is never treated as free capacity.
  -- At most one occupied leg is allowed; booking scheduling stays authoritative.
  if exists(select 1 from driver_unified_private.journeys other where other.driver_id=s.id and other.booking_id<>b.id
   and other.stage in ('pickup_enroute','pickup_arrived','delivery_pending','delivery_enroute','customer_arrived','collection_enroute','collection_arrived','return_pending','return_enroute','return_arrived')) then raise exception 'another_journey_active';end if;
 elsif v_action in ('gps_arrival','location') then
  if j.stage not in ('pickup_enroute','delivery_enroute','customer_arrived','collection_enroute','return_enroute') then raise exception 'not_travelling';end if;
  v_lat:=(v_point->>'lat')::double precision;v_lng:=(v_point->>'lng')::double precision;
  v_accuracy:=(v_point->>'accuracyMeters')::double precision;v_observed:=(v_point->>'observedAt')::timestamptz;
  if v_lat is null or v_lng is null or v_accuracy is null or v_observed is null or not(v_lat between -90 and 90) or not(v_lng between -180 and 180)
   or not(v_accuracy>0 and v_accuracy<=50) or v_observed<now()-interval '30 seconds' or v_observed>now()+interval '5 seconds' then raise exception 'gps_evidence_invalid';end if;
  -- Reuse the existing CRM snapshot table, never a parallel location authority.
  if not exists(select 1 from public.staff_location_snapshots l where l.staff_id=s.id and l.booking_id=b.id and l.recorded_at>now()-interval '20 seconds') then
   insert into public.staff_location_snapshots(staff_id,branch_id,booking_id,lat,lng,accuracy_meters,source) values(s.id,b.branch_id,b.id,v_lat,v_lng,v_accuracy,'gps');
  end if;
  if v_action='location' then v_next:=j.stage;
  else
   if v_target is null or v_target='null'::jsonb then raise exception 'destination_requires_review';end if;
   v_distance:=6371000*2*asin(sqrt(least(1,power(sin(radians(((v_target->>'lat')::double precision-v_lat)/2)),2)+cos(radians(v_lat))*cos(radians((v_target->>'lat')::double precision))*power(sin(radians(((v_target->>'lng')::double precision-v_lng)/2)),2))));
   if v_distance+v_accuracy>100 then raise exception 'outside_arrival_boundary';end if;
   v_next:=case j.stage when 'pickup_enroute' then 'pickup_arrived' when 'delivery_enroute' then 'customer_arrived' when 'collection_enroute' then 'collection_arrived' when 'return_enroute' then 'return_arrived' end;
  end if;
 elsif v_action='board' then
  v_next:=case j.stage when 'pickup_arrived' then 'delivery_pending' when 'collection_arrived' then 'return_pending' else null end;
 elsif v_action='finish_return' and j.stage='return_arrived' then v_next:='complete';
 end if;
 if v_next is null then raise exception 'invalid_journey_transition';end if;
 update driver_unified_private.journeys set stage=v_next,revision=revision+case when v_action in ('location','resume') then 0 else 1 end,updated_at=now() where booking_id=b.id returning * into j;
 -- Set the transport stage inside this transaction before the canonical writer;
 -- the cross-consumer guard below verifies the authoritative transport state.
 if v_action='start' and v_next='delivery_enroute' then perform public.advance_staff_booking_progress(b.id,'travel_started',s.id);end if;
 if v_action='gps_arrival' and v_next='customer_arrived' then perform public.advance_staff_booking_progress(b.id,'arrived',s.id);end if;
 -- Existing therapist service workflow is untouched. Driver GPS does not start,
 -- complete, collect, pay, or clock out a therapist/customer booking.
 v_snapshot:=driver_unified_private.project(b,j);
 insert into driver_unified_private.events(actor_id,request_id,booking_id,payload_hash,action,previous_stage,next_stage,revision,observation,result)
 values(s.id,v_request,b.id,v_hash,v_action,v_previous,v_next,j.revision,v_point,v_snapshot);
 return v_snapshot;
end;$$;

-- Exact existing service lifecycle supplies readiness; estimates/auto_due are
-- not therapist confirmation. Only already-enrolled journeys are affected.
create function driver_unified_private.booking_changed() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_stage text;v_reason text;v_revision integer;
begin
 if not exists(select 1 from driver_unified_private.control where id and enabled) then return new;end if;
 if new.driver_id is distinct from old.driver_id or new.staff_id is distinct from old.staff_id
  or new.branch_id is distinct from old.branch_id or new.status in ('cancelled','no_show')
  or new.metadata->'home_service_address' is distinct from old.metadata->'home_service_address' then
  v_stage:='review';v_reason:='Assignment or destination changed. Dispatch must reconcile the transport plan.';
 elsif new.session_completed_at is not null and new.session_completed_at is distinct from old.session_completed_at
  and coalesce(new.session_completion_source,'')<>'auto_due' then v_stage:='collection_pending';
 elsif new.session_completed_at is not null and new.session_completed_at is distinct from old.session_completed_at then v_stage:='service_active';v_reason:='Service timer ended. Awaiting therapist confirmation of collection readiness.';
 elsif new.session_started_at is not null and old.session_started_at is null then v_stage:='service_active';
 else return new;end if;
 update driver_unified_private.journeys set stage=v_stage,revision=revision+1,reason=v_reason,updated_at=now()
 where booking_id=new.id and (v_stage='review' or stage in ('customer_arrived','service_active')) returning revision into v_revision;
 if found then
  insert into driver_unified_private.push(booking_id,staff_id,kind,event_key)
  values(new.id,coalesce(new.driver_id,old.driver_id),case when v_stage='collection_pending' then 'collection_ready' else 'assignment_changed' end,
    concat_ws(':','journey',new.id,v_stage,v_revision)) on conflict(event_key) do nothing;
 end if;
 return new;
end;$$;
create trigger driver_unified_booking_changed after update on public.bookings for each row execute function driver_unified_private.booking_changed();

create function public.driver_unified_snapshot(p_booking_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select driver_unified_private.snapshot(p_booking_id);$$;
create function public.driver_unified_event(p_event jsonb) returns jsonb language sql security invoker set search_path='' as $$select driver_unified_private.event(p_event);$$;
revoke all on all functions in schema driver_unified_private from public,anon,authenticated;
grant usage on schema driver_unified_private to authenticated;
grant execute on function driver_unified_private.snapshot(uuid),driver_unified_private.event(jsonb) to authenticated;
revoke all on function public.driver_unified_snapshot(uuid),public.driver_unified_event(jsonb) from public,anon;
grant execute on function public.driver_unified_snapshot(uuid),public.driver_unified_event(jsonb) to authenticated;
-- Device and delivery functions are appended below before the transaction commit.

create function driver_unified_private.register_device(p_device jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare s public.staff%rowtype;v_session uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
 v_install uuid:=(p_device->>'installationId')::uuid;v_token text:=p_device->>'token';v_enabled boolean:=(p_device->>'enabled')::boolean;
begin
 s:=driver_unified_private.actor();
 if v_session is null or not exists(select 1 from auth.sessions where id=v_session and user_id=auth.uid() and (not_after is null or not_after>now())) then raise exception 'current_session_required' using errcode='42501';end if;
 if v_enabled is false then update driver_unified_private.devices set disabled_at=now() where installation_id=v_install and staff_id=s.id and auth_user_id=auth.uid();return true;end if;
 if length(v_token) not between 80 and 4096 then raise exception 'invalid_push_token';end if;
 if exists(select 1 from driver_unified_private.devices where installation_id=v_install and (staff_id<>s.id or auth_user_id<>auth.uid())) then raise exception 'installation_owned_by_another_account';end if;
 insert into driver_unified_private.devices(installation_id,staff_id,auth_user_id,session_id,token)
 values(v_install,s.id,auth.uid(),v_session,v_token) on conflict(installation_id) do update set session_id=v_session,token=v_token,updated_at=now(),disabled_at=null;
 return true;
end;$$;
create function public.driver_native_register(p_device jsonb) returns boolean language sql security invoker set search_path='' as $$select driver_unified_private.register_device(p_device);$$;
revoke all on function driver_unified_private.register_device(jsonb),public.driver_native_register(jsonb) from public,anon;
grant execute on function driver_unified_private.register_device(jsonb),public.driver_native_register(jsonb) to authenticated;

create function public.driver_native_revoke_session() returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;
 delete from driver_unified_private.devices where auth_user_id=auth.uid() and session_id=nullif(auth.jwt()->>'session_id','')::uuid;
 return true;
end;$$;
revoke all on function public.driver_native_revoke_session() from public,anon;
grant execute on function public.driver_native_revoke_session() to authenticated;

create function driver_unified_private.notice_created() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from driver_unified_private.control where id and enabled)
  and new.target_workspace='driver' and new.recipient_staff_id is not null and new.entity_type='booking'
  and new.type in ('home_service_assigned','booking_reassigned','booking_cancelled','booking_rescheduled','booking_status_changed') then
  insert into driver_unified_private.push(booking_id,staff_id,kind,event_key)
  values(new.entity_id,new.recipient_staff_id,new.type,'notice:'||new.id) on conflict(event_key) do nothing;
 end if;
 return new;
end;$$;
create trigger driver_unified_notice_created after insert on public.workspace_notifications for each row execute function driver_unified_private.notice_created();

create function public.driver_native_preferred(p_staff_ids uuid[]) returns uuid[]
language sql security definer set search_path='' as $$
 select coalesce(array_agg(distinct d.staff_id),'{}'::uuid[]) from driver_unified_private.devices d
 join public.staff s on s.id=d.staff_id and s.auth_user_id=d.auth_user_id and s.is_active and s.archived_at is null and s.merged_into_staff_id is null and s.branch_id is not null
 join auth.sessions a on a.id=d.session_id and a.user_id=d.auth_user_id and (a.not_after is null or a.not_after>now())
 where coalesce((s.system_role='driver' or s.staff_type='driver'),false) and s.system_role not in ('owner','manager','assistant_manager','store_manager','digital_marketer') and s.staff_type<>'managerial'
 and d.staff_id=any(p_staff_ids) and d.disabled_at is null and d.updated_at>now()-interval '7 days'
 and exists(select 1 from driver_unified_private.control where id and enabled);
$$;
create function public.driver_native_claim(p_limit integer default 20) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_limit is null or p_limit not between 1 and 50 then raise exception 'invalid_batch';end if;
 if not exists(select 1 from driver_unified_private.control where id and enabled) then return '[]';end if;
 with expired as (select id from driver_unified_private.push where state in ('queued','failed','attempted') and (created_at<=now()-interval '5 minutes' or attempts>=5) order by next_attempt_at,id for update skip locked limit 100) update driver_unified_private.push p set state='suppressed' from expired where p.id=expired.id;
 with due as (select p.id from driver_unified_private.push p where p.state in ('queued','failed','attempted')
  and p.next_attempt_at<=now() and p.created_at>now()-interval '5 minutes' and p.attempts<5
  and (p.lease_until is null or p.lease_until<=now()) order by p.next_attempt_at,p.id for update skip locked limit p_limit),
 claimed as (update driver_unified_private.push p set state='attempted',lease=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=attempts+1 from due where p.id=due.id returning p.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'bookingId',p.booking_id,'staffId',p.staff_id,'lease',p.lease,'kind',p.kind,'alreadyAccepted',cardinality(p.accepted_installations)>0,
  'devices',coalesce((select jsonb_agg(jsonb_build_object('id',d.installation_id,'token',d.token,'tokenHash',encode(sha256(convert_to(d.token,'UTF8')),'hex')))
   from driver_unified_private.devices d join auth.sessions a on a.id=d.session_id and a.user_id=d.auth_user_id and (a.not_after is null or a.not_after>now())
   join public.staff s on s.id=d.staff_id and s.auth_user_id=d.auth_user_id and s.is_active and s.archived_at is null and s.merged_into_staff_id is null
   join public.bookings b on b.id=p.booking_id and (b.driver_id=s.id or p.kind in ('assignment_changed','booking_cancelled','booking_reassigned'))
   where coalesce((s.system_role='driver' or s.staff_type='driver'),false) and s.system_role not in ('owner','manager','assistant_manager','store_manager','digital_marketer') and s.staff_type<>'managerial'
   and d.staff_id=p.staff_id and d.disabled_at is null and d.updated_at>now()-interval '7 days' and not(d.installation_id=any(p.accepted_installations))),'[]'::jsonb))), '[]'::jsonb) into result from claimed p;
 return result;
end;$$;
create function public.driver_native_finish(p_id uuid,p_lease uuid,p_accepted uuid[],p_invalid jsonb,p_complete boolean,p_error text default null) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update driver_unified_private.push set state=case when p_complete then 'accepted' else 'failed' end,
 accepted_installations=array(select distinct unnest(accepted_installations||coalesce(p_accepted,'{}'))),
 attempt_log=attempt_log||jsonb_build_array(jsonb_build_object('at',now(),'accepted',p_accepted,'complete',p_complete,'error',left(p_error,80))),
 next_attempt_at=now()+interval '1 minute',lease_until=null where id=p_id and lease=p_lease and state='attempted';
 if not found then return false;end if;
 update driver_unified_private.devices d set disabled_at=now() from jsonb_to_recordset(coalesce(p_invalid,'[]')) as bad(id uuid,hash text)
 where d.installation_id=bad.id and encode(sha256(convert_to(d.token,'UTF8')),'hex')=bad.hash;
 return true;
end;$$;
revoke all on function public.driver_native_preferred(uuid[]),public.driver_native_claim(integer),public.driver_native_finish(uuid,uuid,uuid[],jsonb,boolean,text) from public,anon,authenticated;
grant execute on function public.driver_native_preferred(uuid[]),public.driver_native_claim(integer),public.driver_native_finish(uuid,uuid,uuid[],jsonb,boolean,text) to service_role;
revoke all on function driver_unified_private.notice_created(),driver_unified_private.booking_changed() from public,anon,authenticated;
-- Explicit provider/CRM acknowledgment also repairs readiness after an
-- auto_due service timestamp; it never equates elapsed time with collection.
create function driver_unified_private.collection_ready(p_booking_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare s public.staff%rowtype;b public.bookings%rowtype;j driver_unified_private.journeys%rowtype;
begin
 if not exists(select 1 from driver_unified_private.control where id and enabled) then raise exception 'driver_journeys_inactive';end if;
 select * into s from public.staff where auth_user_id=auth.uid() and is_active and archived_at is null and merged_into_staff_id is null for share;
 select * into b from public.bookings where id=p_booking_id for update;
 if s.id is null or b.id is null or b.branch_id is distinct from s.branch_id or b.delivery_type<>'home_service'
  or not(b.staff_id=s.id or s.system_role in ('owner','manager','assistant_manager','store_manager','crm','csr','csr_head','csr_staff')) then raise exception 'collection_readiness_forbidden' using errcode='42501';end if;
 if b.status<>'completed' or b.session_completed_at is null then raise exception 'service_completion_required';end if;
 select * into j from driver_unified_private.journeys where booking_id=b.id for update;
 if j.booking_id is null then return true;end if; -- Unenrolled legacy trip.
 if j.driver_id is distinct from b.driver_id or j.therapist_id is distinct from b.staff_id or j.stage='review' then raise exception 'journey_assignment_changed';end if;
 if j.stage not in ('customer_arrived','service_active') then return true;end if;
 update driver_unified_private.journeys set stage='collection_pending',reason=null,revision=revision+1,updated_at=now() where booking_id=b.id returning * into j;
 insert into driver_unified_private.events(actor_id,request_id,booking_id,payload_hash,action,previous_stage,next_stage,revision,observation,result)
 values(s.id,gen_random_uuid(),b.id,sha256(convert_to(b.id::text||':service_ready','UTF8')),'service_ready_confirmed','service_active','collection_pending',j.revision,
  jsonb_build_object('serviceCompletedAt',b.session_completed_at,'completionSource',b.session_completion_source),driver_unified_private.project(b,j));
 insert into driver_unified_private.push(booking_id,staff_id,kind,event_key) values(b.id,j.driver_id,'collection_ready',concat_ws(':','journey',b.id,'collection_pending',j.revision)) on conflict(event_key) do nothing;
 return true;
end;$$;
create function public.driver_unified_collection_ready(p_booking_id uuid) returns boolean language sql security invoker set search_path='' as $$select driver_unified_private.collection_ready(p_booking_id);$$;
revoke all on function driver_unified_private.collection_ready(uuid),public.driver_unified_collection_ready(uuid) from public,anon;
grant execute on function driver_unified_private.collection_ready(uuid),public.driver_unified_collection_ready(uuid) to authenticated;

create function public.driver_unified_legacy_allowed(p_booking_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare s public.staff%rowtype;
begin
 s:=driver_unified_private.actor();
 return exists(select 1 from public.bookings b where b.id=p_booking_id and b.driver_id=s.id and b.branch_id=s.branch_id and b.delivery_type='home_service'
  and b.status in ('confirmed','in_progress') and b.booking_progress_status='travel_started'
  and not exists(select 1 from driver_unified_private.journeys j where j.booking_id=b.id));
end;$$;
revoke all on function public.driver_unified_legacy_allowed(uuid) from public,anon;
grant execute on function public.driver_unified_legacy_allowed(uuid) to authenticated;

-- Prevent legacy consumers from skipping pickup or GPS validation once enrolled.
create function driver_unified_private.guard_booking_travel() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_stage text;
begin
 if not exists(select 1 from driver_unified_private.control where id and enabled) or new.delivery_type<>'home_service'
   or new.booking_progress_status is not distinct from old.booking_progress_status
   or new.booking_progress_status not in ('travel_started','arrived') then return new;end if;
 select stage into v_stage from driver_unified_private.journeys where booking_id=new.id;
 if v_stage is null then
  if new.driver_id is not null and new.booking_progress_status='travel_started' and old.booking_progress_status='not_started' then raise exception 'unified_journey_required';end if;
  return new; -- Previously in-flight, unenrolled legacy booking.
 end if;
 if (new.booking_progress_status='travel_started' and v_stage<>'delivery_enroute')
   or (new.booking_progress_status='arrived' and v_stage<>'customer_arrived') then raise exception 'unified_journey_transition_required';end if;
 return new;
end;$$;
revoke all on function driver_unified_private.guard_booking_travel() from public,anon,authenticated;
create trigger driver_unified_guard_booking_travel before update on public.bookings for each row execute function driver_unified_private.guard_booking_travel();

-- Read-only CRM projection includes completed services with outstanding transport.
-- The requested branch is checked against the authenticated staff branch; it is
-- never accepted as authority merely because a caller supplied it.
create function public.driver_unified_dispatch(p_branch_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.staff%rowtype;result jsonb;
begin
 if not exists(select 1 from driver_unified_private.control where id and enabled) then raise exception 'driver_journeys_inactive';end if;
 select * into s from public.staff where auth_user_id=auth.uid() and is_active and archived_at is null and merged_into_staff_id is null;
 if s.id is null or s.branch_id is distinct from p_branch_id
  or s.system_role not in ('owner','manager','assistant_manager','store_manager','crm','csr','csr_head','csr_staff','front_desk') then raise exception 'dispatch_branch_forbidden' using errcode='42501';end if;
 select coalesce(jsonb_agg(x.row),'[]'::jsonb) into result from (
  select jsonb_build_object('journey',driver_unified_private.project(b,j),'driverName',left(d.full_name,160),
    'location',(select jsonb_build_object('lat',l.lat,'lng',l.lng,'recordedAt',l.recorded_at) from public.staff_location_snapshots l
       where l.staff_id=j.driver_id and l.booking_id=b.id and l.branch_id=p_branch_id and l.recorded_at>=j.updated_at-interval '30 seconds'
       order by l.recorded_at desc limit 1)) row
  from driver_unified_private.journeys j join public.bookings b on b.id=j.booking_id join public.staff d on d.id=j.driver_id
  where j.branch_id=p_branch_id and b.branch_id=p_branch_id and j.stage<>'complete'
  order by j.updated_at desc,b.id limit 100
 ) x;
 return result;
end;$$;
revoke all on function public.driver_unified_dispatch(uuid) from public,anon;
grant execute on function public.driver_unified_dispatch(uuid) to authenticated;

-- Deliberately no activation, scheduled job, migration-ledger write or backfill.
notify pgrst,'reload schema';
commit;
