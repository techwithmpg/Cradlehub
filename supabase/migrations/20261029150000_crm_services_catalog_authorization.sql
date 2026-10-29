-- =============================================================================
-- Migration: 20261029150000_crm_services_catalog_authorization.sql
-- Description: Authorize service management for verified service-admin roles
--              (owner, manager, assistant_manager, store_manager, crm, csr_head),
--              harden is_service_admin() search path to public, pg_temp,
--              preserve SECURITY INVOKER on save_owner_service_catalog,
--              eliminate cross-branch write exposure and non-owner DELETE permissions
--              on public.branch_services and public.services,
--              eliminate direct CSR UPDATE permissions on branch_services,
--              enforce strict branch-scoped INSERT and UPDATE on branch_services for non-owners,
--              protect SM Branch Home Service, and grant service-images upload/update media policies.
-- Target: Supabase Postgres
-- Safety: Idempotent. Preserves existing Owner rights.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Harden public.is_service_admin() search path
-- -----------------------------------------------------------------------------
-- Ensure the SECURITY DEFINER function has a fixed search path (public, pg_temp)
-- to avoid search-path shadowing risks.
alter function public.is_service_admin() set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- 1. Correct cross-branch exposure and DELETE permissions on public.branch_services
-- -----------------------------------------------------------------------------
-- The existing permissive service_admin_all_branch_services allowed service admins
-- to write across branches. Additionally, branch_services_management_roles and
-- branch_services_manager_manage granted FOR ALL (including hard DELETE) to managers,
-- while branch_services_crm_operational_update permitted ordinary CSR roles to UPDATE
-- branch services directly.
-- We drop these permissive/ALL/unintended policies and replace them with strictly
-- branch-scoped SELECT, INSERT, and UPDATE policies for verified service administrators.
-- Hard DELETE on branch_services remains strictly restricted to owners via
-- existing branch_services_owner_all.

drop policy if exists "service_admin_all_branch_services" on public.branch_services;
drop policy if exists "branch_services_manager_manage" on public.branch_services;
drop policy if exists "branch_services_management_roles" on public.branch_services;
drop policy if exists "branch_services_crm_operational_update" on public.branch_services;
drop policy if exists "branch_services_service_admin_branch_write" on public.branch_services;
drop policy if exists "branch_services_service_admin_select" on public.branch_services;
drop policy if exists "branch_services_service_admin_branch_insert" on public.branch_services;
drop policy if exists "branch_services_service_admin_branch_update" on public.branch_services;

-- Read policy: Service administrators may view all branch offerings across branches
-- (to display multi-branch availability in shared catalogue screens).
create policy "branch_services_service_admin_select"
  on public.branch_services for select
  to authenticated
  using (public.is_service_admin());

-- Insert policy: Non-owner service admins can ONLY insert rows for their own branch.
-- Owners retain full cross-branch insert access.
create policy "branch_services_service_admin_branch_insert"
  on public.branch_services for insert
  to authenticated
  with check (
    public.is_service_admin()
    and (
      public.get_auth_role() = 'owner'
      or branch_id = public.get_auth_branch_id()
    )
  );

-- Update policy: Non-owner service admins can ONLY update rows for their own branch.
-- Owners retain full cross-branch update access.
create policy "branch_services_service_admin_branch_update"
  on public.branch_services for update
  to authenticated
  using (
    public.is_service_admin()
    and (
      public.get_auth_role() = 'owner'
      or branch_id = public.get_auth_branch_id()
    )
  )
  with check (
    public.is_service_admin()
    and (
      public.get_auth_role() = 'owner'
      or branch_id = public.get_auth_branch_id()
    )
  );

-- -----------------------------------------------------------------------------
-- 2. Table RLS on public.services for service administrators
-- -----------------------------------------------------------------------------
-- Because save_owner_service_catalog is SECURITY INVOKER, table-level RLS on
-- public.services must permit authorized service administrators to SELECT, INSERT,
-- and UPDATE master catalogue rows. Hard DELETE remains restricted to owners via
-- existing services_owner_all.

drop policy if exists "service_admin_all_services" on public.services;
drop policy if exists "services_service_admin_select" on public.services;
create policy "services_service_admin_select"
  on public.services for select
  to authenticated
  using (public.is_service_admin());

drop policy if exists "services_service_admin_insert" on public.services;
create policy "services_service_admin_insert"
  on public.services for insert
  to authenticated
  with check (public.is_service_admin());

drop policy if exists "services_service_admin_update" on public.services;
create policy "services_service_admin_update"
  on public.services for update
  to authenticated
  using (public.is_service_admin())
  with check (public.is_service_admin());

-- -----------------------------------------------------------------------------
-- 3. Update public.save_owner_service_catalog (SECURITY INVOKER preserved)
-- -----------------------------------------------------------------------------
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
  v_auth_role text;
  v_auth_branch_id uuid;
  v_service_id uuid;
  v_branch_ids uuid[];
  v_other_branch_ids uuid[];
  v_requested_count integer;
begin
  -- Validate caller: must be authenticated and a recognized service admin
  -- (owner, manager, assistant_manager, store_manager, crm, csr_head)
  if auth.uid() is null or not public.is_service_admin() then
    raise exception 'Unauthorized to update service catalogue';
  end if;

  v_auth_role := public.get_auth_role();
  v_auth_branch_id := public.get_auth_branch_id();

  -- Non-owner branch scoping guards
  if v_auth_role <> 'owner' then
    if v_auth_branch_id is null then
      raise exception 'Branch assignment required to manage services';
    end if;
    if p_all_branches then
      raise exception 'Cross-branch service configuration requires owner role';
    end if;
  end if;

  -- Payload field validations
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

  -- Resolve offering branches
  if v_auth_role = 'owner' then
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
  else
    -- Non-owner service admin:
    if p_service_id is null then
      -- New service: offered at creator's branch
      v_branch_ids := array[v_auth_branch_id];
    else
      -- Existing service: preserve existing active offerings of other branches
      select coalesce(array_agg(branch_id), array[]::uuid[]) into v_other_branch_ids
      from public.branch_services
      where service_id = p_service_id
        and is_active = true
        and branch_id <> v_auth_branch_id;

      if v_auth_branch_id = any(coalesce(p_branch_ids, array[]::uuid[])) then
        v_branch_ids := array_cat(v_other_branch_ids, array[v_auth_branch_id]);
      else
        v_branch_ids := v_other_branch_ids;
      end if;
    end if;
  end if;

  if cardinality(v_branch_ids) = 0 then
    raise exception 'Choose at least one active branch';
  end if;

  -- Write canonical service record
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

  -- Write branch offerings:
  -- Owner manages all branches in v_branch_ids.
  -- Non-owner ONLY inserts/updates their own branch (v_auth_branch_id).
  if v_auth_role = 'owner' then
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

    -- SM Branch / Disabled Home Service protection for owner updates
    update public.branch_services
    set available_home_service = false
    where service_id = v_service_id
      and branch_id in (
        select b.id from public.branches b
        join public.branch_booking_rules r on r.branch_id = b.id
        where r.home_service_enabled = false
      );
  else
    if v_auth_branch_id = any(v_branch_ids) then
      insert into public.branch_services (
        branch_id, service_id, is_active, available_in_spa,
        available_home_service, visibility, booking_visibility
      ) values (
        v_auth_branch_id, v_service_id, true, true, false, 'public', 'public'
      )
      on conflict (branch_id, service_id) do update set is_active = true;
    else
      update public.branch_services
      set is_active = false
      where service_id = v_service_id
        and branch_id = v_auth_branch_id;
    end if;

    -- SM Branch / Disabled Home Service protection for non-owner updates:
    -- Strictly scoped to caller's branch (never touches other branches).
    if exists (
      select 1 from public.branch_booking_rules
      where branch_id = v_auth_branch_id and home_service_enabled = false
    ) then
      update public.branch_services
      set available_home_service = false
      where service_id = v_service_id
        and branch_id = v_auth_branch_id;
    end if;
  end if;

  return v_service_id;
end;
$$;

revoke all on function public.save_owner_service_catalog(uuid, jsonb, boolean, uuid[]) from public;
revoke all on function public.save_owner_service_catalog(uuid, jsonb, boolean, uuid[]) from anon;
grant execute on function public.save_owner_service_catalog(uuid, jsonb, boolean, uuid[]) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Storage policies for service images in public-site-media
-- -----------------------------------------------------------------------------
-- Allow service administrators to upload and update service images under service-images/*.
-- In accordance with owner security decision, non-owner service administrators do NOT
-- receive DELETE privileges on storage.objects. Deletions remain restricted to Owner
-- and Digital Marketer via existing public_site_media_marketing_delete policy.

drop policy if exists "public_site_media_service_images_crm_insert" on storage.objects;
drop policy if exists "public_site_media_service_images_crm_update" on storage.objects;
drop policy if exists "public_site_media_service_images_crm_delete" on storage.objects;
drop policy if exists "public_site_media_service_images_admin_insert" on storage.objects;
drop policy if exists "public_site_media_service_images_admin_update" on storage.objects;
drop policy if exists "public_site_media_service_images_admin_delete" on storage.objects;

create policy "public_site_media_service_images_admin_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'public-site-media'
    and (storage.foldername(name))[1] = 'service-images'
    and public.is_service_admin()
  );

create policy "public_site_media_service_images_admin_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'public-site-media'
    and (storage.foldername(name))[1] = 'service-images'
    and public.is_service_admin()
  );
