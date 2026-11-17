-- CradleHub O4 Multi-Leg & Pooled Optimizer Journey Candidate (LOCAL/TEST candidate)
-- Requires: supabase/operations/driver-unified-journeys.sql applied first.
-- Adds pooled vehicle journeys, split delivery/collection driver ownership,
-- conditional return disposition, atomic optimizer commit RPC, and O4 projections
-- without weakening RLS or enabling production cutover.

alter table driver_unified_private.journeys
  add column if not exists vehicle_journey_id uuid,
  add column if not exists delivery_driver_id uuid references public.staff(id),
  add column if not exists collection_driver_id uuid references public.staff(id),
  add column if not exists stop_order integer not null default 1 check (stop_order >= 1),
  add column if not exists collection_decision text not null default 'required'
    check (collection_decision in ('required', 'not_required', 'undecided')),
  add column if not exists collection_approval_metadata jsonb not null default '{}'::jsonb,
  add column if not exists return_destination jsonb,
  add column if not exists optimizer_snapshot_id text,
  add column if not exists optimizer_plan_committed_at timestamptz,
  add column if not exists boarded_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists collected_at timestamptz;

update driver_unified_private.journeys
set delivery_driver_id = coalesce(delivery_driver_id, driver_id),
    collection_driver_id = coalesce(collection_driver_id, driver_id)
where delivery_driver_id is null or collection_driver_id is null;

drop index if exists driver_unified_private.driver_journey_one_active;

create index if not exists driver_journey_vehicle
  on driver_unified_private.journeys(vehicle_journey_id, stop_order)
  where vehicle_journey_id is not null;

create index if not exists driver_journey_collection_driver
  on driver_unified_private.journeys(collection_driver_id, stage)
  where collection_driver_id is not null;

create or replace function driver_unified_private.crm_actor(p_branch_id uuid)
returns public.staff
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.staff%rowtype;
  v_role text;
begin
  if not exists(select 1 from driver_unified_private.control where id and enabled) then
    raise exception 'driver_journeys_inactive';
  end if;
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;
  select * into s
  from public.staff
  where auth_user_id = auth.uid()
    and is_active = true
  limit 1;
  if not found then
    raise exception 'active_staff_required';
  end if;
  v_role := lower(coalesce(s.system_role, ''));
  if v_role not in ('owner', 'admin', 'manager', 'supervisor', 'crm') then
    raise exception 'crm_authorization_required';
  end if;
  if v_role not in ('owner', 'admin') and s.branch_id is distinct from p_branch_id then
    raise exception 'branch_scope_mismatch';
  end if;
  return s;
end;
$$;

create or replace function driver_unified_private.project(
  b public.bookings,
  j driver_unified_private.journeys
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_br public.branches%rowtype;
  v_th public.staff%rowtype;
  v_cust text;
  v_addr jsonb;
  v_stage text;
  v_leg text;
  v_dest jsonb;
  v_pickup_label text;
  v_cust_addr text;
  v_meta jsonb := coalesce(b.metadata, '{}'::jsonb);
  v_dc jsonb := coalesce(v_meta->'driver_collection', '{}'::jsonb);
  v_collection_decision text;
  v_delivery_driver_id uuid;
  v_collection_driver_id uuid;
  v_vehicle_journey_id uuid;
  v_stop_order integer;
begin
  select * into v_br from public.branches where id = b.branch_id;
  select * into v_th from public.staff where id = b.staff_id;
  select left(full_name, 160) into v_cust from public.customers where id = b.customer_id;

  v_addr := coalesce(v_meta->'home_service_address', '{}'::jsonb);
  v_pickup_label := nullif(left(coalesce(v_br.name, 'Branch pickup'), 200), '');
  v_cust_addr := nullif(left(coalesce(
    nullif(v_addr->>'full_address', ''),
    nullif(v_addr->>'formatted_address', ''),
    nullif(v_addr->>'address', ''),
    nullif(v_addr->>'barangay', ''),
    'Customer location'
  ), 200), '');

  v_stage := coalesce(
    j.stage,
    case
      when b.status in ('cancelled', 'no_show') or b.booking_progress_status = 'no_show' then 'review'
      when b.booking_progress_status = 'completed' or b.status = 'completed' then 'collection_pending'
      when b.booking_progress_status = 'session_started' or b.status = 'in_progress' then 'service_active'
      when b.home_service_tracking_status = 'arrived_at_customer' then 'customer_arrived'
      when b.home_service_tracking_status = 'in_route' then 'delivery_enroute'
      else 'pickup_pending'
    end
  );

  v_leg := case
    when v_stage like 'pickup_%' then 'pickup'
    when v_stage like 'delivery_%' then 'delivery'
    when v_stage like 'collection_%' then 'collection'
    when v_stage like 'return_%' then 'return'
    else null
  end;

  if v_stage in ('pickup_pending', 'pickup_enroute', 'pickup_arrived') then
    if v_br.latitude is not null and v_br.longitude is not null then
      v_dest := jsonb_build_object(
        'lat', v_br.latitude::double precision,
        'lng', v_br.longitude::double precision,
        'label', coalesce(v_pickup_label, 'Branch pickup')
      );
    end if;
  elsif v_stage in ('return_pending', 'return_enroute', 'return_arrived') then
    if j.return_destination is not null
       and (j.return_destination->>'lat') is not null
       and (j.return_destination->>'lng') is not null then
      v_dest := jsonb_build_object(
        'lat', (j.return_destination->>'lat')::double precision,
        'lng', (j.return_destination->>'lng')::double precision,
        'label', left(coalesce(nullif(j.return_destination->>'label', ''), v_pickup_label, 'Return stop'), 200)
      );
    elsif v_br.latitude is not null and v_br.longitude is not null then
      v_dest := jsonb_build_object(
        'lat', v_br.latitude::double precision,
        'lng', v_br.longitude::double precision,
        'label', coalesce(v_pickup_label, 'Branch return')
      );
    end if;
  elsif v_stage in ('delivery_pending', 'delivery_enroute', 'collection_pending', 'collection_enroute', 'collection_arrived') then
    if nullif(v_addr->>'lat', '') is not null and nullif(v_addr->>'lng', '') is not null then
      v_dest := jsonb_build_object(
        'lat', (v_addr->>'lat')::double precision,
        'lng', (v_addr->>'lng')::double precision,
        'label', coalesce(v_cust_addr, 'Customer location')
      );
    end if;
  end if;

  v_collection_decision := coalesce(
    nullif(j.collection_decision, ''),
    nullif(v_dc->>'decision', ''),
    'required'
  );
  v_delivery_driver_id := coalesce(j.delivery_driver_id, j.driver_id, b.driver_id);
  v_collection_driver_id := coalesce(
    j.collection_driver_id,
    nullif(v_dc->>'collectionDriverId', '')::uuid,
    j.driver_id,
    b.driver_id
  );
  v_vehicle_journey_id := j.vehicle_journey_id;
  v_stop_order := coalesce(j.stop_order, 1);

  return jsonb_strip_nulls(jsonb_build_object(
    'bookingId', b.id,
    'revision', coalesce(j.revision, 0),
    'stage', v_stage,
    'leg', v_leg,
    'destination', v_dest,
    'observedAt', coalesce(j.updated_at, b.updated_at, now()),
    'reason', j.reason,
    'therapistId', b.staff_id,
    'therapistName', left(coalesce(nullif(v_th.nickname, ''), v_th.full_name), 160),
    'customerName', v_cust,
    'branchName', left(v_br.name, 160),
    'bookingDate', b.booking_date,
    'startTime', b.start_time::text,
    'endTime', b.end_time::text,
    'pickupLabel', v_pickup_label,
    'pickupCoords', case
      when v_br.latitude is not null and v_br.longitude is not null
      then jsonb_build_object('lat', v_br.latitude::double precision, 'lng', v_br.longitude::double precision)
      else null
    end,
    'customerAddress', v_cust_addr,
    'customerCoords', case
      when nullif(v_addr->>'lat', '') is not null and nullif(v_addr->>'lng', '') is not null
      then jsonb_build_object('lat', (v_addr->>'lat')::double precision, 'lng', (v_addr->>'lng')::double precision)
      else null
    end,
    'vehicleJourneyId', v_vehicle_journey_id,
    'deliveryDriverId', v_delivery_driver_id,
    'collectionDriverId', v_collection_driver_id,
    'activeDriverId', coalesce(j.driver_id, b.driver_id),
    'stopOrder', v_stop_order,
    'collectionDecision', v_collection_decision,
    'collectionApprovalMetadata', nullif(
      coalesce(nullif(j.collection_approval_metadata, '{}'::jsonb), nullif(v_dc, '{}'::jsonb)),
      '{}'::jsonb
    ),
    'returnDestination', j.return_destination,
    'optimizerSnapshotId', j.optimizer_snapshot_id,
    'boardedAt', j.boarded_at,
    'deliveredAt', j.delivered_at,
    'collectedAt', j.collected_at,
    'bookingStatus', b.status,
    'bookingProgressStatus', b.booking_progress_status,
    'sessionStartedAt', b.session_started_at,
    'sessionDueAt', b.session_due_at,
    'sessionCompletedAt', b.session_completed_at,
    'sessionCompletionSource', b.session_completion_source
  ));
end;
$$;

create or replace function driver_unified_private.snapshot(p_booking_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.staff%rowtype;
  v_rows jsonb;
begin
  s := driver_unified_private.actor();
  select coalesce(jsonb_agg(sub.snap order by sub.booking_date, sub.stop_order, sub.start_time, sub.id), '[]'::jsonb)
  into v_rows
  from (
    select
      b.id,
      b.booking_date,
      b.start_time,
      coalesce(j.stop_order, 1) as stop_order,
      driver_unified_private.project(b, j) || jsonb_build_object('viewerDriverId', s.id) as snap
    from public.bookings b
    left join driver_unified_private.journeys j on j.booking_id = b.id
    where b.delivery_type = 'home_service'
      and b.status not in ('cancelled', 'no_show')
      and b.booking_progress_status <> 'no_show'
      and (p_booking_id is null or b.id = p_booking_id)
      and (
        b.driver_id = s.id
        or j.driver_id = s.id
        or j.delivery_driver_id = s.id
        or j.collection_driver_id = s.id
      )
      and (
        p_booking_id is not null
        or coalesce(j.stage, '') <> 'complete'
      )
  ) sub;
  return v_rows;
end;
$$;

create or replace function driver_unified_private.event(p_event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.staff%rowtype;
  b public.bookings%rowtype;
  j driver_unified_private.journeys%rowtype;
  e driver_unified_private.events%rowtype;
  v_booking uuid := (p_event->>'bookingId')::uuid;
  v_request uuid := (p_event->>'requestId')::uuid;
  v_expected integer := (p_event->>'expectedRevision')::integer;
  v_action text := p_event->>'action';
  v_point jsonb := p_event->'point';
  v_hash bytea := pg_catalog.sha256(convert_to(p_event::text, 'utf8'));
  v_snapshot jsonb;
  v_target jsonb;
  v_next text;
  v_dist double precision;
  v_obs timestamptz;
  v_acc double precision;
  v_owner uuid;
  v_prev_stage text;
  v_booking_changed boolean := false;
begin
  s := driver_unified_private.actor();
  perform pg_advisory_xact_lock(hashtext('driver_unified_transport'), hashtext(s.id::text));

  select * into e
  from driver_unified_private.events
  where actor_id = s.id and request_id = v_request;
  if found then
    if e.payload_hash <> v_hash then
      raise exception 'request_id_reused_with_different_payload';
    end if;
    return e.result;
  end if;

  select * into b from public.bookings where id = v_booking for update;
  if not found or b.delivery_type <> 'home_service' then
    raise exception 'booking_not_found';
  end if;

  select * into j from driver_unified_private.journeys where booking_id = b.id for update;
  if not found then
    if b.driver_id is distinct from s.id then
      raise exception 'booking_not_assigned_to_driver';
    end if;
    insert into driver_unified_private.journeys(
      booking_id, branch_id, driver_id, delivery_driver_id, collection_driver_id, therapist_id
    )
    values (b.id, b.branch_id, s.id, s.id, s.id, b.staff_id)
    returning * into j;
  end if;

  v_owner := case
    when j.stage in ('collection_pending', 'collection_enroute', 'collection_arrived', 'return_pending', 'return_enroute', 'return_arrived')
      then coalesce(j.collection_driver_id, j.driver_id, b.driver_id)
    when j.stage in ('pickup_pending', 'pickup_enroute', 'pickup_arrived', 'delivery_pending', 'delivery_enroute', 'customer_arrived', 'service_active')
      then coalesce(j.delivery_driver_id, j.driver_id, b.driver_id)
    else coalesce(j.driver_id, b.driver_id)
  end;

  if v_owner is distinct from s.id then
    raise exception 'booking_not_assigned_to_driver';
  end if;

  if j.revision <> v_expected then
    raise exception 'stale_revision';
  end if;

  v_snapshot := driver_unified_private.project(b, j);
  v_target := v_snapshot->'destination';

  if v_action in ('gps_arrival', 'location') then
    if v_point is null then
      raise exception 'location_required';
    end if;
    v_obs := (v_point->>'observedAt')::timestamptz;
    v_acc := (v_point->>'accuracyMeters')::double precision;
    if v_acc is null or v_acc <= 0 or v_acc > 50 then
      raise exception 'accuracy_insufficient';
    end if;
    if v_obs > now() + interval '5 seconds' or v_obs < now() - interval '30 seconds' then
      raise exception 'observation_stale';
    end if;
  end if;

  if v_action in ('start', 'resume') then
    if j.stage = 'pickup_pending' and j.vehicle_journey_id is null and exists (
      select 1
      from driver_unified_private.journeys other
      where other.driver_id = s.id
        and other.booking_id <> b.id
        and other.vehicle_journey_id is null
        and other.stage in ('service_active', 'collection_pending', 'customer_arrived')
    ) then
      raise exception 'collection_commitment_requires_dispatch_plan';
    end if;

    if j.vehicle_journey_id is null and exists (
      select 1
      from driver_unified_private.journeys other
      where other.driver_id = s.id
        and other.booking_id <> b.id
        and other.vehicle_journey_id is null
        and other.stage in (
          'pickup_enroute', 'pickup_arrived', 'delivery_pending', 'delivery_enroute',
          'collection_enroute', 'collection_arrived', 'return_pending', 'return_enroute', 'return_arrived'
        )
    ) then
      raise exception 'one_active_journey';
    end if;
  end if;

  v_next := case
    when v_action = 'start' and j.stage = 'pickup_pending' then 'pickup_enroute'
    when v_action = 'start' and j.stage = 'delivery_pending' then 'delivery_enroute'
    when v_action = 'start' and j.stage = 'collection_pending' then 'collection_enroute'
    when v_action = 'start' and j.stage = 'return_pending' then 'return_enroute'
    when v_action = 'resume' and j.stage in ('pickup_enroute', 'delivery_enroute', 'collection_enroute', 'return_enroute') then j.stage
    when v_action = 'location' and j.stage in ('pickup_enroute', 'delivery_enroute', 'collection_enroute', 'return_enroute') then j.stage
    when v_action = 'board' and j.stage = 'pickup_arrived' then 'delivery_pending'
    when v_action = 'board' and j.stage = 'collection_arrived' then 'return_pending'
    when v_action = 'finish_return' and j.stage = 'return_arrived' then 'complete'
    when v_action = 'gps_arrival' and j.stage in ('pickup_enroute', 'delivery_enroute', 'collection_enroute', 'return_enroute') then
      case j.stage
        when 'pickup_enroute' then 'pickup_arrived'
        when 'delivery_enroute' then 'customer_arrived'
        when 'collection_enroute' then 'collection_arrived'
        else 'return_arrived'
      end
    else null
  end;

  if v_next is null then
    raise exception 'invalid_stage_transition';
  end if;

  if v_action in ('start', 'resume', 'gps_arrival') and v_target is null then
    raise exception 'destination_coordinates_required';
  end if;

  if v_action = 'gps_arrival' then
    v_dist := 6371000.0 * 2.0 * asin(least(1.0, sqrt(
      power(sin(radians(((v_point->>'lat')::double precision - (v_target->>'lat')::double precision) / 2.0)), 2)
      + cos(radians((v_target->>'lat')::double precision))
      * cos(radians((v_point->>'lat')::double precision))
      * power(sin(radians(((v_point->>'lng')::double precision - (v_target->>'lng')::double precision) / 2.0)), 2)
    )));
    if v_dist > 250.0 then
      raise exception 'arrival_outside_destination_geofence';
    end if;
  end if;

  perform set_config('cradlehub.o4_internal', 'true', true);

  if v_next in ('delivery_enroute', 'collection_enroute') and b.home_service_tracking_status is distinct from 'in_route' then
    update public.bookings
    set home_service_tracking_status = 'in_route',
        travel_started_at = coalesce(travel_started_at, now())
    where id = b.id;
    v_booking_changed := true;
  elsif v_next = 'customer_arrived' and b.home_service_tracking_status is distinct from 'arrived_at_customer' then
    update public.bookings
    set home_service_tracking_status = 'arrived_at_customer',
        arrived_at = coalesce(arrived_at, v_obs, now())
    where id = b.id;
    v_booking_changed := true;
  end if;

  if v_booking_changed then
    select * into b from public.bookings where id = b.id;
  end if;

  if v_action in ('location', 'gps_arrival') then
    insert into public.staff_location_snapshots(branch_id, staff_id, booking_id, lat, lng, accuracy_meters, recorded_at, source, metadata)
    values (
      b.branch_id,
      s.id,
      b.id,
      (v_point->>'lat')::double precision,
      (v_point->>'lng')::double precision,
      v_acc,
      v_obs,
      case when v_action = 'gps_arrival' then 'driver_unified_arrival' else 'driver_unified_location' end,
      jsonb_build_object('stage', v_next, 'leg', v_snapshot->>'leg', 'vehicleJourneyId', j.vehicle_journey_id)
    );
  end if;

  v_prev_stage := j.stage;

  update driver_unified_private.journeys
  set stage = v_next,
      driver_id = s.id,
      revision = revision + case when v_action in ('location', 'resume') then 0 else 1 end,
      boarded_at = case when v_action = 'board' and j.stage = 'pickup_arrived' then coalesce(boarded_at, now()) else boarded_at end,
      delivered_at = case when v_next = 'customer_arrived' then coalesce(delivered_at, v_obs, now()) else delivered_at end,
      collected_at = case when v_action = 'board' and j.stage = 'collection_arrived' then coalesce(collected_at, now()) else collected_at end,
      updated_at = now()
  where booking_id = b.id
  returning * into j;

  v_snapshot := driver_unified_private.project(b, j);

  insert into driver_unified_private.events(
    actor_id, request_id, booking_id, payload_hash, action, previous_stage, next_stage, revision, observation, result
  )
  values (
    s.id, v_request, b.id, v_hash, v_action, v_prev_stage, v_next, j.revision,
    coalesce(v_point, '{}'::jsonb), v_snapshot
  )
  on conflict (actor_id, request_id) do nothing;

  return v_snapshot;
end;
$$;

create or replace function driver_unified_private.booking_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  j driver_unified_private.journeys%rowtype;
  v_stage text;
  v_reason text;
  v_target_driver uuid;
begin
  if current_setting('cradlehub.o4_internal', true) = 'true' then
    return new;
  end if;
  if not exists(select 1 from driver_unified_private.control where id and enabled) then
    return new;
  end if;
  if new.delivery_type <> 'home_service' then
    return new;
  end if;

  select * into j from driver_unified_private.journeys where booking_id = new.id for update;
  if not found then
    return new;
  end if;

  if new.status in ('cancelled', 'no_show') or new.booking_progress_status = 'no_show' then
    v_stage := 'review';
    v_reason := 'booking_cancelled_or_no_show';
  elsif new.driver_id is null then
    v_stage := 'review';
    v_reason := 'driver_unassigned';
  elsif new.driver_id is distinct from old.driver_id then
    if j.stage in ('pickup_enroute', 'pickup_arrived', 'delivery_pending', 'delivery_enroute', 'collection_enroute', 'collection_arrived', 'return_pending', 'return_enroute', 'return_arrived') then
      v_stage := 'review';
      v_reason := 'driver_reassigned_mid_leg';
    else
      v_stage := j.stage;
      v_reason := j.reason;
    end if;
  elsif (new.booking_progress_status = 'session_started' or new.status = 'in_progress') and j.stage = 'customer_arrived' then
    v_stage := 'service_active';
    v_reason := null;
  else
    return new;
  end if;

  v_target_driver := coalesce(new.driver_id, j.driver_id);

  update driver_unified_private.journeys
  set stage = v_stage,
      driver_id = v_target_driver,
      delivery_driver_id = case when j.stage in ('pickup_pending', 'review') and new.driver_id is not null then new.driver_id else delivery_driver_id end,
      collection_driver_id = case when j.stage in ('pickup_pending', 'collection_pending', 'review') and new.driver_id is not null then new.driver_id else collection_driver_id end,
      reason = v_reason,
      revision = revision + 1,
      updated_at = now()
  where booking_id = new.id;

  if v_target_driver is not null and (new.driver_id is distinct from old.driver_id or v_stage = 'review') then
    insert into driver_unified_private.push(booking_id, staff_id, kind, event_key)
    values (new.id, v_target_driver, 'booking_changed', concat_ws(':', 'journey', new.id, v_stage, j.revision + 1))
    on conflict (event_key) do nothing;
  end if;

  return new;
end;
$$;

create or replace function driver_unified_private.guard_booking_travel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage text;
begin
  if current_setting('cradlehub.o4_internal', true) = 'true' then
    return new;
  end if;
  if not exists(select 1 from driver_unified_private.control where id and enabled) or new.delivery_type <> 'home_service' then
    return new;
  end if;
  if new.home_service_tracking_status is not distinct from old.home_service_tracking_status then
    return new;
  end if;
  select stage into v_stage from driver_unified_private.journeys where booking_id = new.id;
  if v_stage is not null and new.home_service_tracking_status in ('in_route', 'arrived_at_customer') then
    raise exception 'unified_journey_controls_booking_travel';
  end if;
  return new;
end;
$$;

create or replace function driver_unified_private.collection_ready(p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.staff%rowtype;
  b public.bookings%rowtype;
  j driver_unified_private.journeys%rowtype;
  v_role text;
  v_decision text;
  v_meta jsonb;
  v_has_approval boolean;
  v_conflict boolean;
  v_col_driver uuid;
  v_next_stage text;
  v_reason text;
begin
  if not exists(select 1 from driver_unified_private.control where id and enabled) then
    raise exception 'driver_journeys_inactive';
  end if;
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;
  select * into s from public.staff where auth_user_id = auth.uid() and is_active = true limit 1;
  if not found then
    raise exception 'active_staff_required';
  end if;
  select * into b from public.bookings where id = p_booking_id for update;
  if not found or b.delivery_type <> 'home_service' then
    return false;
  end if;

  v_role := lower(coalesce(s.system_role, ''));
  if s.id is distinct from b.staff_id
     and not (v_role in ('owner', 'admin') or (v_role in ('manager', 'supervisor', 'crm') and s.branch_id = b.branch_id)) then
    raise exception 'not_authorized_for_collection_ready';
  end if;

  if (b.booking_progress_status <> 'completed' and b.status <> 'completed' and b.session_completed_at is null)
     or coalesce(b.session_completion_source, '') = 'auto_due' then
    return false;
  end if;

  select * into j from driver_unified_private.journeys where booking_id = b.id for update;
  if not found then
    return true;
  end if;
  if j.stage in ('collection_pending', 'collection_enroute', 'collection_arrived', 'return_pending', 'return_enroute', 'return_arrived', 'complete') then
    return true;
  end if;

  v_meta := coalesce(
    nullif(b.metadata->'driver_collection', 'null'::jsonb),
    j.collection_approval_metadata,
    '{}'::jsonb
  );
  v_decision := coalesce(
    nullif(v_meta->>'decision', ''),
    nullif(j.collection_decision, ''),
    'required'
  );
  v_conflict := coalesce((v_meta->>'conflictingApproval')::boolean, false);
  v_has_approval := (
    nullif(v_meta->>'approvedBy', '') is not null
    or nullif(v_meta->>'approvedAt', '') is not null
    or nullif(v_meta->>'source', '') is not null
  );

  if v_decision = 'not_required' and not v_conflict and v_has_approval then
    v_next_stage := 'complete';
    v_reason := 'collection_not_required_approved';
    v_col_driver := coalesce(j.collection_driver_id, j.driver_id, b.driver_id);
  elsif v_decision = 'undecided' or v_conflict or (v_decision = 'not_required' and not v_has_approval) then
    v_next_stage := 'review';
    v_reason := 'collection_requirement_undecided';
    v_col_driver := coalesce(j.collection_driver_id, j.driver_id, b.driver_id);
  else
    v_next_stage := 'collection_pending';
    v_reason := null;
    v_col_driver := coalesce(
      j.collection_driver_id,
      nullif(v_meta->>'collectionDriverId', '')::uuid,
      j.driver_id,
      b.driver_id
    );
  end if;

  perform set_config('cradlehub.o4_internal', 'true', true);
  if v_next_stage = 'collection_pending' and v_col_driver is not null and b.driver_id is distinct from v_col_driver then
    update public.bookings
    set driver_id = v_col_driver,
        updated_at = now()
    where id = b.id;
    select * into b from public.bookings where id = b.id;
  end if;

  update driver_unified_private.journeys
  set stage = v_next_stage,
      driver_id = coalesce(v_col_driver, driver_id),
      collection_driver_id = v_col_driver,
      collection_decision = case
        when v_next_stage = 'complete' then 'not_required'
        when v_next_stage = 'review' then 'undecided'
        else 'required'
      end,
      reason = v_reason,
      revision = revision + 1,
      updated_at = now()
  where booking_id = b.id
  returning * into j;

  insert into driver_unified_private.events(
    actor_id, request_id, booking_id, payload_hash, action, previous_stage, next_stage, revision, observation, result
  )
  values (
    s.id, gen_random_uuid(), b.id, pg_catalog.sha256(convert_to(concat_ws(':', b.id, j.revision), 'utf8')), 'collection_ready',
    null, v_next_stage, j.revision,
    jsonb_build_object(
      'serviceCompletedAt', b.session_completed_at,
      'completionSource', b.session_completion_source,
      'decision', v_decision
    ),
    driver_unified_private.project(b, j)
  );

  if v_next_stage = 'collection_pending' and v_col_driver is not null then
    insert into driver_unified_private.push(booking_id, staff_id, kind, event_key)
    values (
      b.id,
      v_col_driver,
      'collection_ready',
      concat_ws(':', 'journey', b.id, 'collection_pending', j.revision)
    )
    on conflict (event_key) do nothing;
  end if;

  return true;
end;
$$;

create or replace function public.driver_unified_dispatch(p_branch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  perform driver_unified_private.crm_actor(p_branch_id);
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'journey', driver_unified_private.project(b, j),
        'driverName', left(coalesce(nullif(d.nickname, ''), d.full_name), 160),
        'collectionDriverName', left(coalesce(nullif(cd.nickname, ''), cd.full_name), 160),
        'location', (
          select jsonb_build_object(
            'lat', l.lat,
            'lng', l.lng,
            'recordedAt', l.recorded_at
          )
          from public.staff_location_snapshots l
          where l.booking_id = b.id
          order by l.recorded_at desc
          limit 1
        )
      )
      order by j.vehicle_journey_id nulls last, j.stop_order, b.start_time, b.id
    ),
    '[]'::jsonb
  )
  into v_rows
  from driver_unified_private.journeys j
  join public.bookings b on b.id = j.booking_id
  left join public.staff d on d.id = j.driver_id
  left join public.staff cd on cd.id = j.collection_driver_id
  where j.branch_id = p_branch_id
    and b.status not in ('cancelled', 'no_show');
  return v_rows;
end;
$$;

create or replace function public.driver_o4_commit_plan(
  p_branch_id uuid,
  p_plan jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.staff%rowtype;
  v_snapshot_id text := nullif(trim(coalesce(p_plan->>'snapshotId', '')), '');
  v_updates jsonb := coalesce(p_plan->'bookingUpdates', '[]'::jsonb);
  v_item jsonb;
  b public.bookings%rowtype;
  j driver_unified_private.journeys%rowtype;
  v_booking_id uuid;
  v_vj_id uuid;
  v_del_driver uuid;
  v_col_driver uuid;
  v_stop_order integer;
  v_col_decision text;
  v_col_meta jsonb;
  v_ret_dest jsonb;
  v_existing_stage text;
  v_active_driver uuid;
  v_has_approval boolean;
  v_meta jsonb;
  v_committed integer := 0;
  v_push_targets uuid[] := '{}'::uuid[];
begin
  v_actor := driver_unified_private.crm_actor(p_branch_id);
  if v_snapshot_id is null then
    raise exception 'optimizer_snapshot_id_required';
  end if;
  if jsonb_typeof(v_updates) <> 'array' then
    raise exception 'invalid_plan_booking_updates';
  end if;

  perform pg_advisory_xact_lock(hashtext('driver_o4_commit'), hashtext(p_branch_id::text));
  perform set_config('cradlehub.o4_internal', 'true', true);

  for v_item in select * from jsonb_array_elements(v_updates) loop
    v_booking_id := (v_item->>'bookingId')::uuid;
    v_vj_id := nullif(v_item->>'vehicleJourneyId', '')::uuid;
    v_del_driver := nullif(v_item->>'deliveryDriverId', '')::uuid;
    v_col_driver := nullif(v_item->>'collectionDriverId', '')::uuid;
    v_stop_order := greatest(1, coalesce((v_item->>'stopOrder')::integer, 1));
    v_col_decision := coalesce(nullif(v_item->>'collectionDecision', ''), 'required');
    v_col_meta := coalesce(nullif(v_item->'collectionApprovalMetadata', 'null'::jsonb), '{}'::jsonb);
    v_ret_dest := nullif(v_item->'returnDestination', 'null'::jsonb);

    if v_col_decision not in ('required', 'not_required', 'undecided') then
      raise exception 'invalid_collection_decision';
    end if;

    v_has_approval := (
      nullif(v_col_meta->>'approvedBy', '') is not null
      or nullif(v_col_meta->>'approvedAt', '') is not null
      or nullif(v_col_meta->>'source', '') is not null
    );
    if v_col_decision = 'not_required' and not v_has_approval then
      raise exception 'independent_departure_requires_approval_metadata';
    end if;

    select * into b from public.bookings
    where id = v_booking_id and branch_id = p_branch_id
    for update;
    if not found or b.delivery_type <> 'home_service' then
      raise exception 'booking_not_found_in_branch';
    end if;
    if b.status in ('cancelled', 'no_show') or b.booking_progress_status = 'no_show' then
      raise exception 'cannot_commit_terminal_booking';
    end if;

    if v_del_driver is not null and not exists (
      select 1 from public.staff ds
      where ds.id = v_del_driver and ds.branch_id = p_branch_id and ds.is_active = true
    ) then
      raise exception 'delivery_driver_unavailable';
    end if;
    if v_col_driver is not null and not exists (
      select 1 from public.staff cs
      where cs.id = v_col_driver and cs.branch_id = p_branch_id and cs.is_active = true
    ) then
      raise exception 'collection_driver_unavailable';
    end if;

    select * into j from driver_unified_private.journeys where booking_id = b.id for update;
    v_existing_stage := coalesce(j.stage, 'pickup_pending');

    if v_existing_stage in ('pickup_enroute', 'pickup_arrived', 'delivery_pending', 'delivery_enroute', 'customer_arrived', 'service_active')
       and j.delivery_driver_id is not null
       and v_del_driver is not null
       and v_del_driver is distinct from j.delivery_driver_id then
      raise exception 'locked_delivery_leg_cannot_reassign';
    end if;

    if v_existing_stage in ('collection_enroute', 'collection_arrived', 'return_pending', 'return_enroute', 'return_arrived', 'complete')
       and j.collection_driver_id is not null
       and v_col_driver is not null
       and v_col_driver is distinct from j.collection_driver_id then
      raise exception 'locked_collection_leg_cannot_reassign';
    end if;

    v_active_driver := case
      when v_existing_stage in ('collection_pending', 'collection_enroute', 'collection_arrived', 'return_pending', 'return_enroute', 'return_arrived')
        then coalesce(v_col_driver, j.collection_driver_id, j.driver_id, b.driver_id)
      when b.booking_progress_status = 'completed' or b.status = 'completed'
        then coalesce(v_col_driver, j.collection_driver_id, j.driver_id, b.driver_id)
      else coalesce(v_del_driver, j.delivery_driver_id, j.driver_id, b.driver_id)
    end;

    if v_active_driver is null then
      raise exception 'driver_required_for_committed_leg';
    end if;

    v_meta := coalesce(b.metadata, '{}'::jsonb);
    v_meta := jsonb_set(
      v_meta,
      '{driver_collection}',
      jsonb_strip_nulls(jsonb_build_object(
        'decision', v_col_decision,
        'reasonCode', v_col_meta->>'reasonCode',
        'source', v_col_meta->>'source',
        'approvedBy', v_col_meta->>'approvedBy',
        'approvedAt', v_col_meta->>'approvedAt',
        'collectionDriverId', v_col_driver,
        'collectionDriverName', (select left(coalesce(nullif(st.nickname, ''), st.full_name), 160) from public.staff st where st.id = v_col_driver),
        'collectionConfirmed', (v_existing_stage in ('return_pending', 'return_enroute', 'return_arrived', 'complete') and v_col_decision = 'required')
      )),
      true
    );
    v_meta := jsonb_set(
      v_meta,
      '{o4_plan}',
      jsonb_strip_nulls(jsonb_build_object(
        'snapshotId', v_snapshot_id,
        'vehicleJourneyId', v_vj_id,
        'stopOrder', v_stop_order,
        'deliveryDriverId', v_del_driver,
        'collectionDriverId', v_col_driver,
        'committedBy', v_actor.id,
        'committedAt', now()
      )),
      true
    );

    update public.bookings
    set driver_id = v_active_driver,
        home_service_tracking_status = case
          when home_service_tracking_status = 'awaiting_driver' then 'ready'
          else home_service_tracking_status
        end,
        metadata = v_meta,
        updated_at = now()
    where id = b.id;

    select * into b from public.bookings where id = b.id;

    insert into driver_unified_private.journeys(
      booking_id, branch_id, driver_id, delivery_driver_id, collection_driver_id,
      therapist_id, vehicle_journey_id, stop_order, stage,
      collection_decision, collection_approval_metadata, return_destination,
      optimizer_snapshot_id, optimizer_plan_committed_at, revision, updated_at
    )
    values (
      b.id, b.branch_id, v_active_driver, coalesce(v_del_driver, v_active_driver),
      v_col_driver, b.staff_id, v_vj_id, v_stop_order, v_existing_stage,
      v_col_decision, v_col_meta, v_ret_dest,
      v_snapshot_id, now(), coalesce(j.revision, 0) + 1, now()
    )
    on conflict (booking_id) do update
    set driver_id = excluded.driver_id,
        delivery_driver_id = coalesce(excluded.delivery_driver_id, driver_unified_private.journeys.delivery_driver_id),
        collection_driver_id = coalesce(excluded.collection_driver_id, driver_unified_private.journeys.collection_driver_id),
        vehicle_journey_id = excluded.vehicle_journey_id,
        stop_order = excluded.stop_order,
        collection_decision = excluded.collection_decision,
        collection_approval_metadata = excluded.collection_approval_metadata,
        return_destination = excluded.return_destination,
        optimizer_snapshot_id = excluded.optimizer_snapshot_id,
        optimizer_plan_committed_at = excluded.optimizer_plan_committed_at,
        reason = case when driver_unified_private.journeys.stage = 'review' then driver_unified_private.journeys.reason else null end,
        revision = driver_unified_private.journeys.revision + 1,
        updated_at = now()
    returning * into j;

    insert into driver_unified_private.events(
      actor_id, request_id, booking_id, payload_hash, action, previous_stage, next_stage, revision, observation, result
    )
    values (
      v_actor.id, gen_random_uuid(), b.id, pg_catalog.sha256(convert_to(concat_ws(':', b.id, v_snapshot_id, j.revision), 'utf8')),
      'plan_commit', v_existing_stage, j.stage, j.revision,
      jsonb_build_object('snapshotId', v_snapshot_id, 'vehicleJourneyId', v_vj_id),
      driver_unified_private.project(b, j)
    );

    insert into driver_unified_private.push(booking_id, staff_id, kind, event_key)
    values (
      b.id,
      v_active_driver,
      'assignment',
      concat_ws(':', 'plan', v_snapshot_id, b.id, j.revision)
    )
    on conflict (event_key) do nothing;

    v_push_targets := array_append(v_push_targets, v_active_driver);
    v_committed := v_committed + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'snapshotId', v_snapshot_id,
    'committedCount', v_committed,
    'notifiedDriverIds', coalesce(to_jsonb(array(select distinct unnest(v_push_targets))), '[]'::jsonb)
  );
end;
$$;

create or replace function public.driver_o4_set_collection_decision(
  p_booking_id uuid,
  p_decision text,
  p_collection_driver_id uuid default null,
  p_approval jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.staff%rowtype;
  b public.bookings%rowtype;
  j driver_unified_private.journeys%rowtype;
  v_has_approval boolean;
  v_next_stage text;
  v_reason text;
  v_driver uuid;
  v_meta jsonb;
begin
  if p_decision not in ('required', 'not_required', 'undecided') then
    raise exception 'invalid_collection_decision';
  end if;

  select * into b from public.bookings where id = p_booking_id for update;
  if not found or b.delivery_type <> 'home_service' then
    raise exception 'booking_not_found';
  end if;

  v_actor := driver_unified_private.crm_actor(b.branch_id);

  v_has_approval := (
    nullif(coalesce(p_approval->>'approvedBy', v_actor.id::text), '') is not null
    and (nullif(p_approval->>'approvedAt', '') is not null or nullif(p_approval->>'source', '') is not null)
  );
  if p_decision = 'not_required' and not v_has_approval then
    raise exception 'independent_departure_requires_approval_metadata';
  end if;

  if p_collection_driver_id is not null and not exists (
    select 1 from public.staff st
    where st.id = p_collection_driver_id and st.branch_id = b.branch_id and st.is_active = true
  ) then
    raise exception 'collection_driver_unavailable';
  end if;

  perform set_config('cradlehub.o4_internal', 'true', true);
  select * into j from driver_unified_private.journeys where booking_id = b.id for update;

  v_meta := jsonb_set(
    coalesce(b.metadata, '{}'::jsonb),
    '{driver_collection}',
    jsonb_strip_nulls(jsonb_build_object(
      'decision', p_decision,
      'reasonCode', coalesce(p_approval->>'reasonCode', case when p_decision = 'not_required' then 'APPROVED_INDEPENDENT_DEPARTURE' else 'CRM_UPDATED' end),
      'source', coalesce(p_approval->>'source', 'crm_dispatch'),
      'approvedBy', case when p_decision = 'not_required' then coalesce(p_approval->>'approvedBy', v_actor.id::text) else null end,
      'approvedAt', case when p_decision = 'not_required' then coalesce(p_approval->>'approvedAt', now()::text) else null end,
      'collectionDriverId', coalesce(p_collection_driver_id, j.collection_driver_id),
      'collectionDriverName', (
        select left(coalesce(nullif(st.nickname, ''), st.full_name), 160)
        from public.staff st
        where st.id = coalesce(p_collection_driver_id, j.collection_driver_id)
      ),
      'collectionConfirmed', (coalesce(j.stage, '') in ('return_pending', 'return_enroute', 'return_arrived', 'complete') and p_decision = 'required')
    )),
    true
  );

  v_driver := coalesce(p_collection_driver_id, j.collection_driver_id, j.driver_id, b.driver_id);

  if b.booking_progress_status = 'completed' or b.status = 'completed' or b.session_completed_at is not null then
    if p_decision = 'not_required' then
      v_next_stage := 'complete';
      v_reason := 'collection_not_required_approved';
    elsif p_decision = 'undecided' then
      v_next_stage := 'review';
      v_reason := 'collection_requirement_undecided';
    else
      v_next_stage := coalesce(
        case when j.stage in ('collection_enroute', 'collection_arrived', 'return_pending', 'return_enroute', 'return_arrived') then j.stage end,
        'collection_pending'
      );
      v_reason := null;
    end if;
  else
    v_next_stage := coalesce(j.stage, 'pickup_pending');
    v_reason := j.reason;
  end if;

  update public.bookings
  set metadata = v_meta,
      driver_id = case when v_next_stage = 'collection_pending' and v_driver is not null then v_driver else driver_id end,
      updated_at = now()
  where id = b.id;

  select * into b from public.bookings where id = b.id;

  if j.booking_id is not null then
    update driver_unified_private.journeys
    set collection_decision = p_decision,
        collection_driver_id = v_driver,
        collection_approval_metadata = coalesce(p_approval, '{}'::jsonb),
        driver_id = case when v_next_stage = 'collection_pending' and v_driver is not null then v_driver else driver_id end,
        stage = v_next_stage,
        reason = v_reason,
        revision = revision + 1,
        updated_at = now()
    where booking_id = b.id
    returning * into j;

    if v_next_stage = 'collection_pending' and v_driver is not null then
      insert into driver_unified_private.push(booking_id, staff_id, kind, event_key)
      values (b.id, v_driver, 'collection_ready', concat_ws(':', 'collection_decision', b.id, j.revision))
      on conflict (event_key) do nothing;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'bookingId', b.id,
    'collectionDecision', p_decision,
    'journey', case when j.booking_id is not null then driver_unified_private.project(b, j) else null end
  );
end;
$$;

revoke all on function driver_unified_private.crm_actor(uuid),
  driver_unified_private.project(public.bookings, driver_unified_private.journeys),
  driver_unified_private.snapshot(uuid),
  driver_unified_private.event(jsonb),
  driver_unified_private.booking_changed(),
  driver_unified_private.guard_booking_travel(),
  driver_unified_private.collection_ready(uuid),
  public.driver_unified_dispatch(uuid),
  public.driver_o4_commit_plan(uuid, jsonb),
  public.driver_o4_set_collection_decision(uuid, text, uuid, jsonb)
from public, anon;

grant execute on function
  driver_unified_private.snapshot(uuid),
  driver_unified_private.event(jsonb),
  driver_unified_private.collection_ready(uuid),
  public.driver_unified_dispatch(uuid),
  public.driver_o4_commit_plan(uuid, jsonb),
  public.driver_o4_set_collection_decision(uuid, text, uuid, jsonb)
to authenticated;

grant execute on function
  driver_unified_private.crm_actor(uuid)
to service_role;
