-- Review-only correction. No price, closing time, release policy or Cron is seeded.
begin;

-- Fixed catalogue services retain their fixed sale policy. This is a separate,
-- owner-approved operational continuation quote, never an inferred sale price.
create table public.fixed_service_continuation_options (
  service_id uuid primary key references public.services(id) on delete restrict,
  increment_minutes integer not null check (increment_minutes between 5 and 180),
  price_per_increment numeric(10,2) not null check (price_per_increment > 0),
  maximum_total_minutes integer not null check (maximum_total_minutes between 15 and 720),
  approved_by uuid not null references public.staff(id) on delete restrict,
  approved_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.fixed_service_continuation_options enable row level security;
revoke all on public.fixed_service_continuation_options from public, anon, authenticated;
grant select, insert, update on public.fixed_service_continuation_options to service_role;

-- Existing extendable catalogue prices also require an explicit owner approval.
-- A subsequent catalogue edit invalidates the snapshot until reapproved.
create table public.extendable_service_continuation_approvals (
  service_id uuid primary key references public.services(id) on delete restrict,
  increment_minutes integer not null check (increment_minutes between 1 and 180),
  price_per_increment numeric(10,2) not null check (price_per_increment > 0),
  maximum_total_minutes integer not null check (maximum_total_minutes between 15 and 720),
  approved_by uuid not null references public.staff(id) on delete restrict,
  approved_at timestamptz not null default clock_timestamp()
);
alter table public.extendable_service_continuation_approvals enable row level security;
revoke all on public.extendable_service_continuation_approvals
  from public, anon, authenticated;
grant select, insert, update on public.extendable_service_continuation_approvals to service_role;

-- Appointment start cutoff is not a treatment closing time. No default is safe.
create table public.branch_treatment_closing_policy (
  branch_id uuid primary key references public.branches(id) on delete restrict,
  closing_time time not null,
  approved_by uuid not null references public.staff(id) on delete restrict,
  approved_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.branch_treatment_closing_policy enable row level security;
revoke all on public.branch_treatment_closing_policy from public, anon, authenticated;
grant select, insert, update on public.branch_treatment_closing_policy to service_role;

create table public.service_continuation_events (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  order_id uuid not null references public.booking_orders(id) on delete restrict,
  actor_staff_id uuid not null references public.staff(id) on delete restrict,
  minutes_added integer not null check (minutes_added > 0),
  increment_minutes integer not null check (increment_minutes > 0),
  increment_price numeric(10,2) not null check (increment_price > 0),
  charge_amount numeric(12,2) not null check (charge_amount > 0),
  old_due_at timestamptz not null,
  new_due_at timestamptz not null check (new_due_at > old_due_at),
  reason text not null check (length(btrim(reason)) between 1 and 500),
  payable_item_id uuid unique references public.order_payable_items(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp()
);
create index service_continuation_events_booking_idx
  on public.service_continuation_events(booking_id, created_at desc);
alter table public.service_continuation_events enable row level security;
revoke all on public.service_continuation_events from public, anon, authenticated;
grant select, insert, update on public.service_continuation_events to service_role;

-- Owners explicitly configure prices and hours. A NULL option removes approval.
create or replace function public.set_fixed_service_continuation_option(
  p_service_id uuid, p_increment_minutes integer, p_price numeric,
  p_maximum_total_minutes integer
) returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_duration integer;
begin
  select id into v_actor from public.staff
  where auth_user_id = auth.uid() and system_role = 'owner'
    and is_active and archived_at is null and merged_into_staff_id is null;
  if v_actor is null then
    raise exception 'SERVICE_CONTINUATION_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if p_increment_minutes is null and p_price is null
    and p_maximum_total_minutes is null then
    delete from public.fixed_service_continuation_options where service_id = p_service_id;
    return;
  end if;
  select duration_minutes into v_duration from public.services
  where id = p_service_id and duration_policy = 'fixed' and is_active for update;
  if v_duration is null then
    raise exception 'FIXED_SERVICE_NOT_FOUND' using errcode = '22023';
  end if;
  if p_increment_minutes is null or p_increment_minutes not between 5 and 180
    or p_price is null or p_price <= 0 or p_price > 9999999
    or p_maximum_total_minutes is null or p_maximum_total_minutes <= v_duration
    or p_maximum_total_minutes > 720
    or mod(p_maximum_total_minutes - v_duration, p_increment_minutes) <> 0 then
    raise exception 'SERVICE_CONTINUATION_OPTION_INVALID' using errcode = '22023';
  end if;
  insert into public.fixed_service_continuation_options
    (service_id, increment_minutes, price_per_increment, maximum_total_minutes, approved_by)
  values (p_service_id, p_increment_minutes, p_price, p_maximum_total_minutes, v_actor)
  on conflict (service_id) do update set
    increment_minutes = excluded.increment_minutes,
    price_per_increment = excluded.price_per_increment,
    maximum_total_minutes = excluded.maximum_total_minutes,
    approved_by = excluded.approved_by,
    approved_at = clock_timestamp(), updated_at = clock_timestamp();
end $$;
revoke all on function public.set_fixed_service_continuation_option(uuid,integer,numeric,integer)
  from public, anon, authenticated;
grant execute on function public.set_fixed_service_continuation_option(uuid,integer,numeric,integer)
  to authenticated;

create or replace function public.approve_extendable_service_continuation(
  p_service_id uuid, p_enabled boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_service public.services%rowtype;
begin
  select id into v_actor from public.staff
  where auth_user_id = auth.uid() and system_role = 'owner'
    and is_active and archived_at is null and merged_into_staff_id is null;
  if v_actor is null then
    raise exception 'SERVICE_CONTINUATION_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if p_service_id is null or p_enabled is null then
    raise exception 'SERVICE_CONTINUATION_APPROVAL_INVALID' using errcode = '22023';
  end if;
  if not p_enabled then
    delete from public.extendable_service_continuation_approvals
      where service_id = p_service_id;
    return;
  end if;
  select * into v_service from public.services where id = p_service_id for share;
  if not found or not v_service.is_active or v_service.duration_policy <> 'extendable'
    or v_service.extension_increment_minutes is null
    or v_service.extension_increment_minutes not between 1 and 180
    or v_service.extension_price is null or v_service.extension_price <= 0
    or v_service.maximum_duration_minutes is null
    or v_service.maximum_duration_minutes <= v_service.duration_minutes
    or v_service.maximum_duration_minutes > 720 then
    raise exception 'SERVICE_CONTINUATION_CATALOG_INVALID' using errcode = '22023';
  end if;
  insert into public.extendable_service_continuation_approvals
    (service_id, increment_minutes, price_per_increment, maximum_total_minutes,
     approved_by)
  values (p_service_id, v_service.extension_increment_minutes,
    v_service.extension_price, v_service.maximum_duration_minutes, v_actor)
  on conflict (service_id) do update set
    increment_minutes = excluded.increment_minutes,
    price_per_increment = excluded.price_per_increment,
    maximum_total_minutes = excluded.maximum_total_minutes,
    approved_by = excluded.approved_by, approved_at = clock_timestamp();
end $$;
revoke all on function public.approve_extendable_service_continuation(uuid,boolean)
  from public, anon, authenticated;
grant execute on function public.approve_extendable_service_continuation(uuid,boolean)
  to authenticated;

create or replace function public.set_branch_treatment_closing_time(
  p_branch_id uuid, p_closing_time time
) returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid;
begin
  select id into v_actor from public.staff
  where auth_user_id = auth.uid() and system_role = 'owner'
    and is_active and archived_at is null and merged_into_staff_id is null;
  if v_actor is null then
    raise exception 'TREATMENT_HOURS_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if p_closing_time is null then
    delete from public.branch_treatment_closing_policy where branch_id = p_branch_id;
    return;
  end if;
  if p_closing_time <= time '00:00'
    or not exists (select 1 from public.branches where id = p_branch_id and is_active) then
    raise exception 'TREATMENT_CLOSING_TIME_INVALID' using errcode = '22023';
  end if;
  insert into public.branch_treatment_closing_policy (branch_id, closing_time, approved_by)
  values (p_branch_id, p_closing_time, v_actor)
  on conflict (branch_id) do update set closing_time = excluded.closing_time,
    approved_by = excluded.approved_by, approved_at = clock_timestamp(),
    updated_at = clock_timestamp();
end $$;
revoke all on function public.set_branch_treatment_closing_time(uuid,time)
  from public, anon, authenticated;
grant execute on function public.set_branch_treatment_closing_time(uuid,time)
  to authenticated;

-- The old no-charge endpoint is retired before the chargeable command exists.
create or replace function public.extend_booking_service_session(
  p_booking_id uuid, p_minutes integer, p_reason text,
  p_actor_staff_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'PRICED_SERVICE_CONTINUATION_REQUIRED' using errcode = 'P0001';
end $$;

create or replace function public.continue_booking_service_session(
  p_booking_id uuid, p_minutes integer, p_reason text, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_booking public.bookings%rowtype;
  v_order public.booking_orders%rowtype;
  v_actor public.staff%rowtype;
  v_event public.service_continuation_events%rowtype;
  v_service public.services%rowtype;
  v_increment integer;
  v_maximum integer;
  v_price numeric(10,2);
  v_charge numeric(12,2);
  v_new_due timestamptz;
  v_old_due timestamptz;
  v_new_end time;
  v_now timestamptz;
  v_close time;
  v_resource_capacity integer;
  v_occupied integer;
  v_payable_id uuid;
  v_base_total numeric(12,2);
  v_next_sequence integer;
  v_normalized_reason text := btrim(coalesce(p_reason, ''));
  v_base_duration integer;
  v_order_id uuid;
  v_auth_uid uuid := auth.uid();
begin
  if v_auth_uid is null then
    raise exception 'SERVICE_CONTINUATION_AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_booking_id is null or p_idempotency_key is null
    or p_minutes is null or p_minutes < 1 or p_minutes > 180
    or length(v_normalized_reason) not between 1 and 500 then
    raise exception 'SERVICE_CONTINUATION_INPUT_INVALID' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('service-continuation:' || p_idempotency_key::text)::bigint);
  select * into v_event from public.service_continuation_events
  where idempotency_key = p_idempotency_key;
  if found then
    if v_event.booking_id <> p_booking_id or v_event.minutes_added <> p_minutes
      or v_event.reason <> v_normalized_reason
      or not exists (select 1 from public.staff s where s.id = v_event.actor_staff_id
        and s.auth_user_id = v_auth_uid and s.is_active and s.archived_at is null
        and s.merged_into_staff_id is null) then
      raise exception 'SERVICE_CONTINUATION_IDEMPOTENCY_CONFLICT' using errcode = '22023';
    end if;
    return jsonb_build_object('booking_id', v_event.booking_id,
      'order_id', v_event.order_id, 'event_id', v_event.id,
      'due_at', v_event.new_due_at, 'charge_amount', v_event.charge_amount,
      'already_applied', true);
  end if;

  -- Match payment writer lock order: parent order, then booking line.
  select order_id into v_order_id from public.bookings where id = p_booking_id;
  if not found or v_order_id is null then
    raise exception 'SERVICE_CONTINUATION_ORDER_REVIEW_REQUIRED' using errcode = 'P0001';
  end if;
  select * into v_order from public.booking_orders
  where id = v_order_id for update;
  if not found or v_order.currency <> 'PHP' then
    raise exception 'SERVICE_CONTINUATION_ORDER_INVALID' using errcode = 'P0001';
  end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or v_booking.order_id is distinct from v_order.id
    or v_booking.branch_id is distinct from v_order.branch_id then
    raise exception 'SERVICE_CONTINUATION_ORDER_CHANGED' using errcode = 'P0001';
  end if;
  select * into v_actor from public.staff
  where auth_user_id = v_auth_uid and is_active and archived_at is null
    and merged_into_staff_id is null limit 1;
  if not found or not (v_actor.id = v_booking.staff_id or v_actor.system_role = 'owner'
    or (v_actor.branch_id = v_booking.branch_id and v_actor.system_role in
      ('manager','assistant_manager','store_manager','crm','csr','csr_head','csr_staff'))) then
    raise exception 'SERVICE_CONTINUATION_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  v_now := clock_timestamp();
  if v_booking.delivery_type <> 'in_spa' or v_booking.resource_id is null
    or v_booking.staff_id is null or v_booking.status <> 'in_progress'
    or v_booking.booking_progress_status <> 'session_started'
    or v_booking.session_started_at is null or v_booking.session_completed_at is not null
    or v_booking.booking_date <> (v_now at time zone 'Asia/Manila')::date
    or v_booking.session_due_at <= v_booking.session_started_at then
    raise exception 'SERVICE_CONTINUATION_SESSION_INVALID' using errcode = 'P0001';
  end if;
  select * into v_service from public.services
  where id = v_booking.service_id and is_active for share;
  if not found then
    raise exception 'SERVICE_CONTINUATION_CATALOG_UNAVAILABLE' using errcode = 'P0001';
  end if;
  v_base_duration := v_booking.session_duration_minutes_snapshot;
  if v_base_duration is null or v_base_duration < 1 then
    raise exception 'SERVICE_CONTINUATION_DURATION_UNKNOWN' using errcode = 'P0001';
  end if;
  if v_service.duration_policy = 'extendable' then
    v_increment := v_service.extension_increment_minutes;
    v_price := v_service.extension_price;
    v_maximum := v_service.maximum_duration_minutes;
    -- Do not apply a current catalogue maximum to a different purchased base.
    if v_base_duration <> v_service.duration_minutes then
      raise exception 'SERVICE_CONTINUATION_CATALOG_REVIEW_REQUIRED' using errcode = 'P0001';
    end if;
    perform 1 from public.extendable_service_continuation_approvals approval
    where approval.service_id = v_service.id
      and approval.increment_minutes = v_increment
      and approval.price_per_increment = v_price
      and approval.maximum_total_minutes = v_maximum
    for share;
    if not found then
      raise exception 'SERVICE_CONTINUATION_OWNER_APPROVAL_REQUIRED'
        using errcode = 'P0001';
    end if;
  elsif v_service.duration_policy = 'fixed' then
    if v_base_duration <> v_service.duration_minutes then
      raise exception 'SERVICE_CONTINUATION_CATALOG_REVIEW_REQUIRED' using errcode = 'P0001';
    end if;
    select increment_minutes, price_per_increment, maximum_total_minutes
    into v_increment, v_price, v_maximum
    from public.fixed_service_continuation_options
    where service_id = v_service.id for share;
  end if;
  if v_increment is null or v_increment < 1 or v_price is null or v_price <= 0
    or v_maximum is null or v_maximum > 720
    or mod(p_minutes, v_increment) <> 0
    or v_base_duration + coalesce(v_booking.session_extension_minutes_total, 0)
      + p_minutes > v_maximum then
    raise exception 'SERVICE_CONTINUATION_PRICE_OR_LIMIT_UNAVAILABLE' using errcode = 'P0001';
  end if;
  v_charge := v_price * (p_minutes / v_increment);
  v_old_due := v_booking.session_due_at;
  v_new_due := v_booking.session_started_at + make_interval(
    mins => v_base_duration + coalesce(v_booking.session_extension_minutes_total, 0) + p_minutes);
  if v_new_due <= v_old_due or v_new_due <= v_now
    or (v_new_due at time zone 'Asia/Manila')::date <> v_booking.booking_date then
    raise exception 'SERVICE_CONTINUATION_DUE_INVALID' using errcode = 'P0001';
  end if;
  v_new_end := (v_new_due at time zone 'Asia/Manila')::time;
  select closing_time into v_close from public.branch_treatment_closing_policy
    where branch_id = v_booking.branch_id for share;
  if v_close is null or v_new_end > v_close then
    raise exception 'SERVICE_CONTINUATION_AFTER_TREATMENT_CLOSE' using errcode = 'P0001';
  end if;
  -- A single confirmed shift/override must cover the remaining treatment.
  if exists (select 1 from public.schedule_overrides so
      where so.staff_id = v_booking.staff_id and so.override_date = v_booking.booking_date) then
    if not exists (select 1 from public.schedule_overrides so
      where so.staff_id = v_booking.staff_id and so.override_date = v_booking.booking_date
        and not so.is_day_off and so.start_time <= (v_now at time zone 'Asia/Manila')::time
        and so.end_time >= v_new_end and not so.ends_next_day) then
      raise exception 'SERVICE_CONTINUATION_THERAPIST_UNAVAILABLE' using errcode = 'P0001';
    end if;
  elsif not exists (select 1 from public.staff_schedules ss
    where ss.staff_id = v_booking.staff_id and ss.day_of_week = extract(dow from v_booking.booking_date)
      and ss.is_active and not ss.ends_next_day
      and ss.start_time <= (v_now at time zone 'Asia/Manila')::time
      and ss.end_time >= v_new_end) then
    raise exception 'SERVICE_CONTINUATION_THERAPIST_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.blocked_times bt where bt.staff_id = v_booking.staff_id
    and bt.block_date = v_booking.booking_date
    and bt.start_time < v_new_end and bt.end_time > (v_now at time zone 'Asia/Manila')::time) then
    raise exception 'SERVICE_CONTINUATION_THERAPIST_BLOCKED' using errcode = 'P0001';
  end if;

  -- Use the same advisory locks as the booking overlap trigger. Its scheduled
  -- overlap check remains a second guard after end_time changes below.
  perform pg_advisory_xact_lock(hashtext('booking-staff:' ||
    v_booking.staff_id::text || ':' || v_booking.booking_date::text)::bigint);
  perform pg_advisory_xact_lock(hashtext('booking-resource:' ||
    v_booking.resource_id::text || ':' || v_booking.booking_date::text)::bigint);
  select capacity into v_resource_capacity from public.branch_resources
  where id = v_booking.resource_id and branch_id = v_booking.branch_id and is_active for share;
  if v_resource_capacity is null then
    raise exception 'SERVICE_CONTINUATION_ROOM_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.bookings b
    where b.id <> v_booking.id and b.staff_id = v_booking.staff_id
      and b.booking_date = v_booking.booking_date
      and public.crm_booking_row_blocks_availability(b.status, b.hold_expires_at)
      and b.start_time < v_new_end
      and greatest(b.end_time, coalesce((b.session_due_at at time zone 'Asia/Manila')::time,
        b.end_time)) > (v_now at time zone 'Asia/Manila')::time) then
    raise exception 'SERVICE_CONTINUATION_THERAPIST_CONFLICT' using errcode = '23P01';
  end if;
  select count(*) into v_occupied from public.bookings b
  where b.id <> v_booking.id and b.resource_id = v_booking.resource_id
    and b.booking_date = v_booking.booking_date
    and public.crm_booking_row_blocks_availability(b.status, b.hold_expires_at)
    and b.start_time < v_new_end
    and greatest(b.end_time, coalesce((b.session_due_at at time zone 'Asia/Manila')::time,
      b.end_time)) > (v_now at time zone 'Asia/Manila')::time;
  if v_occupied >= v_resource_capacity then
    raise exception 'SERVICE_CONTINUATION_ROOM_CONFLICT' using errcode = '23P01';
  end if;

  -- Materialize the canonical original payable once, exactly as the payment
  -- writer does. Ambiguous snapshots fail closed before any surcharge is added.
  if not exists (select 1 from public.order_payable_items where order_id = v_order.id) then
    if not (v_order.metadata->>'total_amount') ~ '^[0-9]+([.][0-9]{1,2})?$'
      or exists (select 1 from public.bookings b where b.order_id = v_order.id
        and not coalesce((b.metadata->>'price_paid') ~ '^[0-9]+([.][0-9]{1,2})?$', false))
      or (v_order.metadata ? 'home_service_fee'
        and not coalesce((v_order.metadata->>'home_service_fee') ~ '^[0-9]+([.][0-9]{1,2})?$', false)) then
      raise exception 'SERVICE_CONTINUATION_PAYABLE_REVIEW_REQUIRED' using errcode = 'P0001';
    end if;
    insert into public.order_payable_items
      (order_id, booking_id, charge_type, description, amount, currency,
       sequence, source_type, source_id, created_by)
    select v_order.id, b.id, 'service', 'Booking ' || left(b.id::text, 8),
      (b.metadata->>'price_paid')::numeric, 'PHP', row_number() over (order by b.id),
      'booking', b.id, v_actor.id
    from public.bookings b where b.order_id = v_order.id
      and (b.metadata->>'price_paid')::numeric > 0;
    if coalesce((v_order.metadata->>'home_service_fee')::numeric, 0) > 0 then
      insert into public.order_payable_items
        (order_id, charge_type, description, amount, currency, sequence, source_type, created_by)
      values (v_order.id, 'home_service_fee', 'Home Service travel',
        (v_order.metadata->>'home_service_fee')::numeric, 'PHP',
        (select coalesce(max(sequence), 0) + 1 from public.order_payable_items
          where order_id = v_order.id), 'booking_order', v_actor.id);
    end if;
    select coalesce(sum(amount), 0) into v_base_total from public.order_payable_items
      where order_id = v_order.id;
    if v_base_total <> (v_order.metadata->>'total_amount')::numeric then
      raise exception 'SERVICE_CONTINUATION_PAYABLE_SNAPSHOT_MISMATCH' using errcode = 'P0001';
    end if;
  elsif exists (select 1 from public.bookings b where b.order_id = v_order.id
    and not coalesce((b.metadata->>'price_paid') ~ '^[0-9]+([.][0-9]{1,2})?$', false))
    or exists (select 1 from public.bookings b where b.order_id = v_order.id
      and (b.metadata->>'price_paid') ~ '^[0-9]+([.][0-9]{1,2})?$'
      and (b.metadata->>'price_paid')::numeric > 0
      and not exists (select 1 from public.order_payable_items opi
        where opi.order_id = v_order.id and opi.booking_id = b.id
          and opi.charge_type = 'service' and opi.amount = (b.metadata->>'price_paid')::numeric)) then
    raise exception 'SERVICE_CONTINUATION_PARTIAL_PAYABLE_REVIEW_REQUIRED' using errcode = 'P0001';
  end if;

  update public.bookings set
    session_extension_minutes_total = coalesce(session_extension_minutes_total, 0) + p_minutes,
    session_due_at = v_new_due, session_extension_reason = v_normalized_reason,
    session_extended_by = v_actor.id, session_extended_at = v_now,
    end_time = greatest(end_time, v_new_end), updated_at = v_now
  where id = v_booking.id;
  update public.booking_orders set metadata = coalesce(metadata, '{}'::jsonb) ||
    jsonb_build_object('service_continuation_total',
      coalesce((metadata->>'service_continuation_total')::numeric, 0) + v_charge,
      'service_continuation_last_at', v_now)
  where id = v_order.id;
  insert into public.service_continuation_events
    (idempotency_key, booking_id, order_id, actor_staff_id, minutes_added,
     increment_minutes, increment_price, charge_amount, old_due_at, new_due_at, reason)
  values (p_idempotency_key, v_booking.id, v_order.id, v_actor.id, p_minutes,
    v_increment, v_price, v_charge, v_old_due, v_new_due, v_normalized_reason)
  returning * into v_event;
  select coalesce(max(sequence), 0) + 1 into v_next_sequence
    from public.order_payable_items where order_id = v_order.id;
  insert into public.order_payable_items
    (order_id, booking_id, charge_type, description, amount, currency,
     sequence, source_type, source_id, created_by)
  values (v_order.id, v_booking.id, 'surcharge',
    'Service continuation ' || p_minutes || ' min', v_charge, 'PHP',
    v_next_sequence, 'service_continuation', v_event.id, v_actor.id)
  returning id into v_payable_id;
  update public.service_continuation_events set payable_item_id = v_payable_id
    where id = v_event.id;
  return jsonb_build_object('booking_id', v_booking.id, 'order_id', v_order.id,
    'event_id', v_event.id, 'payable_item_id', v_payable_id,
    'due_at', v_new_due, 'charge_amount', v_charge, 'already_applied', false);
end $$;
revoke all on function public.continue_booking_service_session(uuid,integer,text,uuid)
  from public, anon, authenticated;
grant execute on function public.continue_booking_service_session(uuid,integer,text,uuid)
  to authenticated;

-- Installation-time fence avoids producing new toasts for historical repairs.
create table public.service_transition_notification_cutover (
  singleton boolean primary key default true check (singleton),
  installed_at timestamptz not null default clock_timestamp()
);
insert into public.service_transition_notification_cutover(singleton) values (true);
alter table public.service_transition_notification_cutover enable row level security;
revoke all on public.service_transition_notification_cutover
  from public, anon, authenticated;
grant select on public.service_transition_notification_cutover to service_role;

-- Insert into the established notification table in the booking transaction.
-- A committed start/completion therefore cannot be stranded if the web process
-- exits before its best-effort publisher runs. The publisher uses these keys.
create or replace function public.record_service_transition_notifications()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_transition text;
  v_at timestamptz;
  v_title text;
  v_actor uuid;
  v_guest text;
  v_service text;
  v_event_id text;
  v_body text;
  v_metadata jsonb;
  v_cutover timestamptz;
begin
  if new.session_started_at is distinct from old.session_started_at
    and old.session_started_at is null and new.session_started_at is not null
    and new.status = 'in_progress' and new.booking_progress_status = 'session_started' then
    v_transition := 'started';
    v_at := new.session_started_at;
    v_title := 'Service Started';
    v_actor := new.session_started_by;
  elsif new.session_completed_at is distinct from old.session_completed_at
    and old.session_completed_at is null and new.session_completed_at is not null
    and new.status = 'completed' and new.booking_progress_status = 'completed'
    and new.session_completion_source is distinct from 'auto_due' then
    v_transition := 'completed';
    v_at := new.session_completed_at;
    v_title := 'Service Completed';
    v_actor := new.session_completed_by;
  else
    return new;
  end if;
  select installed_at into v_cutover from public.service_transition_notification_cutover
    where singleton;
  if v_cutover is null then
    raise exception 'SERVICE_TRANSITION_NOTIFICATION_CUTOVER_MISSING'
      using errcode = 'P0001';
  end if;
  if v_at < v_cutover then
    return new;
  end if;
  select coalesce(nullif(btrim(a.display_name), ''), nullif(btrim(c.full_name), ''), 'Guest'),
    coalesce(nullif(btrim(s.name), ''), 'Service')
  into v_guest, v_service
  from public.bookings b
  left join public.booking_attendees a on a.id = b.attendee_id
  left join public.customers c on c.id = b.customer_id
  left join public.services s on s.id = b.service_id
  where b.id = new.id;
  v_event_id := 'service_' || v_transition || ':' || new.id::text || ':' ||
    to_char(v_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_body := v_guest || ' — ' || v_service || ' · ' ||
    case when v_transition = 'started' then 'Started' else 'Completed' end ||
    ' at ' || to_char(v_at at time zone 'Asia/Manila', 'HH12:MI AM');
  v_metadata := jsonb_build_object('service_transition', v_transition,
    'service_transition_event_id', v_event_id, 'service_transition_at', v_at,
    'service_completion_source', new.session_completion_source);
  insert into public.workspace_notifications
    (branch_id, target_workspace, actor_staff_id, type, title, body,
     entity_type, entity_id, action_href, priority, status, requires_action,
     dedupe_key, metadata)
  values
    (new.branch_id, 'crm', v_actor, 'booking_status_changed', v_title, v_body,
      'booking', new.id, '/crm/bookings', 'normal', 'unread', false,
      v_event_id || ':crm:' || new.branch_id::text, v_metadata),
    (new.branch_id, 'manager', v_actor, 'booking_status_changed', v_title, v_body,
      'booking', new.id, '/manager/bookings', 'normal', 'unread', false,
      v_event_id || ':manager:' || new.branch_id::text, v_metadata);
  if new.staff_id is not null then
    insert into public.workspace_notifications
      (branch_id, target_workspace, recipient_staff_id, actor_staff_id,
       type, title, body, entity_type, entity_id, action_href, priority,
       status, requires_action, dedupe_key, metadata)
    values (new.branch_id, 'staff', new.staff_id, v_actor,
      'booking_status_changed', v_title, v_body, 'booking', new.id,
      '/staff-portal/today', 'normal', 'unread', false,
      v_event_id || ':staff:' || new.staff_id::text, v_metadata);
  end if;
  return new;
end $$;
revoke all on function public.record_service_transition_notifications()
  from public, anon, authenticated;
drop trigger if exists trg_record_service_transition_notifications on public.bookings;
create trigger trg_record_service_transition_notifications
  after update of session_started_at, session_completed_at on public.bookings
  for each row execute function public.record_service_transition_notifications();

commit;
