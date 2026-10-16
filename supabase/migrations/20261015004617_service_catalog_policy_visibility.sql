-- Service configuration is global; branch_services remains the offering and
-- deliberate per-branch override layer. Existing rows retain fixed pricing.
alter table public.services
  add column if not exists is_public_visible boolean not null default true,
  add column if not exists duration_policy text not null default 'fixed',
  add column if not exists extension_increment_minutes integer,
  add column if not exists extension_price numeric(10,2),
  add column if not exists maximum_duration_minutes integer;

alter table public.services
  add constraint services_duration_policy_valid check (
    (duration_policy = 'fixed'
      and extension_increment_minutes is null
      and extension_price is null
      and maximum_duration_minutes is null)
    or
    (duration_policy = 'extendable'
      and extension_increment_minutes is not null
      and extension_increment_minutes > 0
      and extension_price is not null
      and extension_price >= 0
      and maximum_duration_minutes is not null
      and maximum_duration_minutes > duration_minutes
      and mod(maximum_duration_minutes - duration_minutes, extension_increment_minutes) = 0)
  );

comment on column public.services.is_public_visible is
  'Global customer presentation flag; independent of operational is_active and branch offering.';
comment on column public.services.duration_policy is
  'Fixed by default for legacy commercial behavior; extendable only with explicit step pricing.';

-- The function keeps canonical fields and branch offerings in one database
-- transaction. It runs with caller RLS and also checks the owner role itself.
create or replace function public.save_owner_service_catalog(
  p_service_id uuid,
  p_catalog jsonb,
  p_all_branches boolean,
  p_branch_ids uuid[]
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_service_id uuid;
  v_branch_ids uuid[];
  v_requested_count integer;
begin
  if auth.uid() is null or public.get_auth_role() <> 'owner' then
    raise exception 'Owner access required';
  end if;

  if p_catalog is null or jsonb_typeof(p_catalog) <> 'object' then
    raise exception 'Invalid service payload';
  end if;
  if length(btrim(coalesce(p_catalog->>'name', ''))) not between 2 and 100
    or nullif(p_catalog->>'categoryId', '') is null
    or length(coalesce(p_catalog->>'description', '')) > 1000
    or nullif(p_catalog->>'durationMinutes', '') is null
    or (p_catalog->>'durationMinutes')::integer not between 15 and 480
    or nullif(p_catalog->>'price', '') is null
    or (p_catalog->>'price')::numeric not between 0 and 9999999
    or (p_catalog->>'isActive') is null
    or (p_catalog->>'isPublicVisible') is null
    or (p_catalog->>'durationPolicy') is null
    or (p_catalog->>'durationPolicy') not in ('fixed', 'extendable')
    or length(coalesce(p_catalog->>'imageAlt', '')) > 220 then
    raise exception 'Invalid service fields';
  end if;

  if p_all_branches then
    select coalesce(array_agg(id), array[]::uuid[]) into v_branch_ids
    from public.branches where is_active = true;
  else
    v_branch_ids := coalesce(p_branch_ids, array[]::uuid[]);
    select count(*) into v_requested_count
    from unnest(v_branch_ids) as requested(id)
    left join public.branches b on b.id = requested.id and b.is_active = true
    where b.id is null;
    if v_requested_count > 0 then
      raise exception 'Selected branches must be active branches';
    end if;
  end if;

  if cardinality(v_branch_ids) = 0 then
    raise exception 'Choose at least one active branch';
  end if;

  if p_service_id is null then
    insert into public.services (
      category_id, name, description, duration_minutes, price,
      buffer_before, buffer_after, is_active, is_public_visible,
      duration_policy, extension_increment_minutes, extension_price,
      maximum_duration_minutes, image_url, image_alt
    ) values (
      (p_catalog->>'categoryId')::uuid,
      p_catalog->>'name', p_catalog->>'description',
      (p_catalog->>'durationMinutes')::integer,
      (p_catalog->>'price')::numeric,
      coalesce((p_catalog->>'bufferBefore')::integer, 0),
      coalesce((p_catalog->>'bufferAfter')::integer, 0),
      (p_catalog->>'isActive')::boolean,
      (p_catalog->>'isPublicVisible')::boolean,
      p_catalog->>'durationPolicy',
      (p_catalog->>'extensionIncrementMinutes')::integer,
      (p_catalog->>'extensionPrice')::numeric,
      (p_catalog->>'maximumDurationMinutes')::integer,
      p_catalog->>'imageUrl', p_catalog->>'imageAlt'
    ) returning id into v_service_id;
  else
    update public.services set
      category_id = (p_catalog->>'categoryId')::uuid,
      name = p_catalog->>'name',
      description = p_catalog->>'description',
      duration_minutes = (p_catalog->>'durationMinutes')::integer,
      price = (p_catalog->>'price')::numeric,
      metadata = case
        when price is distinct from (p_catalog->>'price')::numeric
        then coalesce(metadata, '{}'::jsonb) - 'price_label'
        else metadata
      end - case
        when duration_minutes is distinct from (p_catalog->>'durationMinutes')::integer
        then 'duration_text'
        else ''
      end,
      is_active = (p_catalog->>'isActive')::boolean,
      is_public_visible = (p_catalog->>'isPublicVisible')::boolean,
      duration_policy = p_catalog->>'durationPolicy',
      extension_increment_minutes = (p_catalog->>'extensionIncrementMinutes')::integer,
      extension_price = (p_catalog->>'extensionPrice')::numeric,
      maximum_duration_minutes = (p_catalog->>'maximumDurationMinutes')::integer,
      image_url = p_catalog->>'imageUrl',
      image_alt = p_catalog->>'imageAlt'
    where id = p_service_id
    returning id into v_service_id;
    if v_service_id is null then
      raise exception 'Service not found or update denied';
    end if;
  end if;

  insert into public.branch_services (
    branch_id, service_id, is_active, available_in_spa,
    available_home_service, visibility, booking_visibility
  )
  select distinct id, v_service_id, true, true, false, 'public', 'public'
  from unnest(v_branch_ids) as selected(id)
  on conflict (branch_id, service_id) do update set is_active = true;

  update public.branch_services
  set is_active = false
  where service_id = v_service_id
    and branch_id in (select id from public.branches where is_active = true)
    and not (branch_id = any(v_branch_ids));

  return v_service_id;
end;
$$;

revoke all on function public.save_owner_service_catalog(uuid, jsonb, boolean, uuid[]) from public;
revoke all on function public.save_owner_service_catalog(uuid, jsonb, boolean, uuid[]) from anon;
grant execute on function public.save_owner_service_catalog(uuid, jsonb, boolean, uuid[]) to authenticated;
