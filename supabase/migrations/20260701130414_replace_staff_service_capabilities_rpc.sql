-- Transactional replacement for CRM staff service capabilities.
-- This function intentionally performs its own authorization checks and runs as
-- SECURITY DEFINER so the replacement cannot partially fail across delete/insert
-- steps because of caller-visible RLS differences.

grant select
on table public.staff_services
to authenticated;

create or replace function public.replace_staff_service_capabilities(
  p_target_staff_id uuid,
  p_service_ids uuid[] default '{}'::uuid[]
)
returns table(service_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_auth_id uuid := (select auth.uid());
  v_actor_staff_id uuid;
  v_actor_role text;
  v_actor_branch_id uuid;
  v_target_branch_id uuid;
  v_target_role text;
  v_target_is_active boolean;
  v_requested_service_ids uuid[] := '{}'::uuid[];
  v_invalid_service_ids uuid[] := '{}'::uuid[];
begin
  if v_actor_auth_id is null then
    raise exception 'crm_staff_services_not_authenticated'
      using errcode = '28000';
  end if;

  select
    actor.id,
    case
      when actor.system_role in ('csr', 'csr_head', 'csr_staff') then 'crm'
      else actor.system_role
    end,
    actor.branch_id
  into v_actor_staff_id, v_actor_role, v_actor_branch_id
  from public.staff actor
  where actor.auth_user_id = v_actor_auth_id
    and actor.is_active = true
  limit 1;

  if v_actor_staff_id is null then
    raise exception 'crm_staff_services_not_authenticated'
      using errcode = '28000';
  end if;

  if v_actor_role not in (
    'owner',
    'manager',
    'assistant_manager',
    'store_manager',
    'crm'
  ) then
    raise exception 'crm_staff_services_not_authorized'
      using errcode = '42501';
  end if;

  select
    target_staff.branch_id,
    case
      when target_staff.system_role in ('csr', 'csr_head', 'csr_staff') then 'crm'
      else target_staff.system_role
    end,
    target_staff.is_active
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

    if v_target_role in ('owner', 'manager', 'assistant_manager', 'store_manager') then
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
  on conflict on constraint staff_services_staff_id_service_id_key do nothing;

  return query
  select final_assignment.service_id
  from public.staff_services final_assignment
  where final_assignment.staff_id = p_target_staff_id
  order by final_assignment.service_id;
end;
$$;

comment on function public.replace_staff_service_capabilities(uuid, uuid[]) is
  'Atomically replaces staff_services rows after authenticated actor, branch, target, and branch-active service validation.';

revoke all on function public.replace_staff_service_capabilities(uuid, uuid[]) from public;
revoke all on function public.replace_staff_service_capabilities(uuid, uuid[]) from anon;
grant execute on function public.replace_staff_service_capabilities(uuid, uuid[]) to authenticated;
grant execute on function public.replace_staff_service_capabilities(uuid, uuid[]) to service_role;

notify pgrst, 'reload schema';
