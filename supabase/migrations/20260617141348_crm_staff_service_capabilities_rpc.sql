-- =============================================================================
-- CradleHub — CRM Staff Service Capabilities Atomic Replacement
-- =============================================================================
-- Fixes CRM Staff → Service Assignments saves by moving replacement into a
-- single database transaction and aligning staff_services RLS with the CRM
-- operational role set.
--
-- Security model:
--   - RLS remains enabled.
--   - Owner can manage all branches through the existing owner policy.
--   - All non-owner CRM operational roles are branch-scoped.
--   - The RPC is SECURITY INVOKER, so table grants and RLS still apply.
--   - The function validates actor, target staff, branch, and branch-active
--     services before deleting any existing assignments.
-- =============================================================================

-- Keep the table reachable through the Data API for authenticated users; RLS
-- remains the row-level authorization layer.
grant select, insert, update, delete
on table public.staff_services
to authenticated;

-- Replace the older broad operational FOR ALL policy with operation-specific
-- branch policies. The INSERT / UPDATE checks also require the selected service
-- to be active for the target staff member's branch.
drop policy if exists "staff_services_operational_all" on public.staff_services;
drop policy if exists "staff_services_csr_read" on public.staff_services;

create policy "staff_services_operational_select_branch"
  on public.staff_services for select
  to authenticated
  using (
    (select public.get_auth_role()) = any (
      array['manager', 'assistant_manager', 'store_manager', 'crm', 'csr_head', 'csr_staff', 'csr']
    )
    and exists (
      select 1
      from public.staff target_staff
      where target_staff.id = staff_services.staff_id
        and target_staff.branch_id = (select public.get_auth_branch_id())
    )
  );

create policy "staff_services_operational_insert_branch"
  on public.staff_services for insert
  to authenticated
  with check (
    (select public.get_auth_role()) = any (
      array['manager', 'assistant_manager', 'store_manager', 'crm', 'csr_head', 'csr_staff', 'csr']
    )
    and exists (
      select 1
      from public.staff target_staff
      join public.branch_services branch_service
        on branch_service.branch_id = target_staff.branch_id
       and branch_service.service_id = staff_services.service_id
       and branch_service.is_active = true
      join public.services service
        on service.id = staff_services.service_id
       and service.is_active = true
      where target_staff.id = staff_services.staff_id
        and target_staff.is_active = true
        and target_staff.system_role <> all (
          array['owner', 'manager', 'assistant_manager', 'store_manager']
        )
        and target_staff.branch_id = (select public.get_auth_branch_id())
    )
  );

create policy "staff_services_operational_update_branch"
  on public.staff_services for update
  to authenticated
  using (
    (select public.get_auth_role()) = any (
      array['manager', 'assistant_manager', 'store_manager', 'crm', 'csr_head', 'csr_staff', 'csr']
    )
    and exists (
      select 1
      from public.staff target_staff
      where target_staff.id = staff_services.staff_id
        and target_staff.branch_id = (select public.get_auth_branch_id())
        and target_staff.system_role <> all (
          array['owner', 'manager', 'assistant_manager', 'store_manager']
        )
    )
  )
  with check (
    (select public.get_auth_role()) = any (
      array['manager', 'assistant_manager', 'store_manager', 'crm', 'csr_head', 'csr_staff', 'csr']
    )
    and exists (
      select 1
      from public.staff target_staff
      join public.branch_services branch_service
        on branch_service.branch_id = target_staff.branch_id
       and branch_service.service_id = staff_services.service_id
       and branch_service.is_active = true
      join public.services service
        on service.id = staff_services.service_id
       and service.is_active = true
      where target_staff.id = staff_services.staff_id
        and target_staff.is_active = true
        and target_staff.system_role <> all (
          array['owner', 'manager', 'assistant_manager', 'store_manager']
        )
        and target_staff.branch_id = (select public.get_auth_branch_id())
    )
  );

create policy "staff_services_operational_delete_branch"
  on public.staff_services for delete
  to authenticated
  using (
    (select public.get_auth_role()) = any (
      array['manager', 'assistant_manager', 'store_manager', 'crm', 'csr_head', 'csr_staff', 'csr']
    )
    and exists (
      select 1
      from public.staff target_staff
      where target_staff.id = staff_services.staff_id
        and target_staff.branch_id = (select public.get_auth_branch_id())
        and target_staff.system_role <> all (
          array['owner', 'manager', 'assistant_manager', 'store_manager']
        )
    )
  );

create or replace function public.replace_staff_service_capabilities(
  p_target_staff_id uuid,
  p_service_ids uuid[] default '{}'::uuid[]
)
returns table(service_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor_staff_id uuid := public.get_auth_staff_id();
  v_actor_role text := public.get_auth_role();
  v_actor_branch_id uuid := public.get_auth_branch_id();
  v_target_branch_id uuid;
  v_target_role text;
  v_target_is_active boolean;
  v_requested_service_ids uuid[] := '{}'::uuid[];
  v_invalid_service_ids uuid[] := '{}'::uuid[];
begin
  if (select auth.uid()) is null or v_actor_staff_id is null then
    raise exception 'crm_staff_services_not_authenticated'
      using errcode = '28000';
  end if;

  if v_actor_role is null
    or v_actor_role <> all (
      array['owner', 'manager', 'assistant_manager', 'store_manager', 'crm', 'csr_head', 'csr_staff', 'csr']
    )
  then
    raise exception 'crm_staff_services_not_authorized'
      using errcode = '42501';
  end if;

  select target_staff.branch_id, target_staff.system_role, target_staff.is_active
  into v_target_branch_id, v_target_role, v_target_is_active
  from public.staff target_staff
  where target_staff.id = p_target_staff_id;

  if v_target_branch_id is null then
    raise exception 'crm_staff_services_target_not_found'
      using errcode = 'P0002';
  end if;

  if not v_target_is_active then
    raise exception 'crm_staff_services_target_inactive'
      using errcode = 'P0001';
  end if;

  if v_actor_role <> 'owner' then
    if v_actor_branch_id is null or v_actor_branch_id <> v_target_branch_id then
      raise exception 'crm_staff_services_branch_mismatch'
        using errcode = '42501';
    end if;

    if v_target_role = any (array['owner', 'manager', 'assistant_manager', 'store_manager']) then
      raise exception 'crm_staff_services_privileged_target'
        using errcode = '42501';
    end if;
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_service_ids, '{}'::uuid[])) requested(service_id)
    where requested.service_id is null
  ) then
    raise exception 'crm_staff_services_invalid_service'
      using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct requested.service_id), '{}'::uuid[])
  into v_requested_service_ids
  from unnest(coalesce(p_service_ids, '{}'::uuid[])) requested(service_id);

  select coalesce(array_agg(requested.service_id), '{}'::uuid[])
  into v_invalid_service_ids
  from unnest(v_requested_service_ids) requested(service_id)
  where not exists (
    select 1
    from public.services service
    join public.branch_services branch_service
      on branch_service.service_id = service.id
     and branch_service.branch_id = v_target_branch_id
     and branch_service.is_active = true
    where service.id = requested.service_id
      and service.is_active = true
  );

  if cardinality(v_invalid_service_ids) > 0 then
    raise exception 'crm_staff_services_invalid_service'
      using errcode = '22023';
  end if;

  delete from public.staff_services existing_assignment
  where existing_assignment.staff_id = p_target_staff_id
    and not (
      cardinality(v_requested_service_ids) > 0
      and existing_assignment.service_id = any (v_requested_service_ids)
    );

  insert into public.staff_services (staff_id, service_id)
  select p_target_staff_id, requested.service_id
  from unnest(v_requested_service_ids) requested(service_id)
  on conflict (staff_id, service_id) do nothing;

  return query
  select final_assignment.service_id
  from public.staff_services final_assignment
  where final_assignment.staff_id = p_target_staff_id
  order by final_assignment.service_id;
end;
$$;

comment on function public.replace_staff_service_capabilities(uuid, uuid[]) is
  'Atomically replaces staff_services rows for a target staff member after validating the authenticated actor, branch scope, target staff, and branch-active services. SECURITY INVOKER keeps RLS active.';

revoke execute on function public.replace_staff_service_capabilities(uuid, uuid[]) from public;
revoke execute on function public.replace_staff_service_capabilities(uuid, uuid[]) from anon;
grant execute on function public.replace_staff_service_capabilities(uuid, uuid[]) to authenticated;
grant execute on function public.replace_staff_service_capabilities(uuid, uuid[]) to service_role;
