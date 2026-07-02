-- Align staff operational profile edits and branch resource setup with the
-- unified Front Desk role model. The application still validates individual
-- fields server-side; this RLS layer enforces row scope and prevents non-owner
-- actors from writing protected management/owner rows.

grant select on table public.staff to authenticated;
grant update (
  full_name,
  nickname,
  phone,
  tier,
  staff_type,
  is_head,
  is_active,
  system_role,
  branch_id
) on table public.staff to authenticated;

drop policy if exists "staff_operational_update_branch" on public.staff;

create policy "staff_operational_update_branch"
  on public.staff for update
  to authenticated
  using (
    (select public.get_auth_role()) in (
      'manager',
      'assistant_manager',
      'store_manager',
      'crm',
      'csr',
      'csr_head',
      'csr_staff'
    )
    and branch_id = (select public.get_auth_branch_id())
    and system_role not in ('owner', 'manager', 'assistant_manager', 'store_manager')
  )
  with check (
    (select public.get_auth_role()) in (
      'manager',
      'assistant_manager',
      'store_manager',
      'crm',
      'csr',
      'csr_head',
      'csr_staff'
    )
    and branch_id = (select public.get_auth_branch_id())
    and system_role not in ('owner', 'manager', 'assistant_manager', 'store_manager')
  );

grant select, insert, update, delete
on table public.branch_resources
to authenticated;

drop policy if exists "branch_resources_front_desk_select_branch" on public.branch_resources;
drop policy if exists "branch_resources_front_desk_insert_branch" on public.branch_resources;
drop policy if exists "branch_resources_front_desk_update_branch" on public.branch_resources;
drop policy if exists "branch_resources_front_desk_delete_branch" on public.branch_resources;

create policy "branch_resources_front_desk_select_branch"
  on public.branch_resources for select
  to authenticated
  using (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and branch_id = (select public.get_auth_branch_id())
  );

create policy "branch_resources_front_desk_insert_branch"
  on public.branch_resources for insert
  to authenticated
  with check (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and branch_id = (select public.get_auth_branch_id())
  );

create policy "branch_resources_front_desk_update_branch"
  on public.branch_resources for update
  to authenticated
  using (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and branch_id = (select public.get_auth_branch_id())
  )
  with check (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and branch_id = (select public.get_auth_branch_id())
  );

create policy "branch_resources_front_desk_delete_branch"
  on public.branch_resources for delete
  to authenticated
  using (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and branch_id = (select public.get_auth_branch_id())
  );

notify pgrst, 'reload schema';
