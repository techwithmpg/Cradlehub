-- Repair branch-aware group schedule rule access for the complete operational
-- role model. The original policy omitted the legacy `csr` front-desk role.

alter table public.staff_schedule_groups enable row level security;
alter table public.staff_group_schedule_rules enable row level security;

drop policy if exists "schedule_group_rules_owner_all"
  on public.staff_group_schedule_rules;
drop policy if exists "schedule_group_rules_manager_branch_all"
  on public.staff_group_schedule_rules;
drop policy if exists "schedule_group_rules_csr_branch_all"
  on public.staff_group_schedule_rules;
drop policy if exists "schedule_group_rules_staff_read"
  on public.staff_group_schedule_rules;
drop policy if exists "staff_group_schedule_rules_select_branch"
  on public.staff_group_schedule_rules;
drop policy if exists "staff_group_schedule_rules_insert_authorized_branch"
  on public.staff_group_schedule_rules;
drop policy if exists "staff_group_schedule_rules_update_authorized_branch"
  on public.staff_group_schedule_rules;
drop policy if exists "staff_group_schedule_rules_delete_authorized_branch"
  on public.staff_group_schedule_rules;

create policy "staff_group_schedule_rules_select_branch"
  on public.staff_group_schedule_rules
  for select
  to authenticated
  using (
    (select public.get_auth_role()) = 'owner'
    or exists (
      select 1
      from public.staff_schedule_groups as schedule_group
      where schedule_group.id = staff_group_schedule_rules.group_id
        and schedule_group.branch_id = (select public.get_auth_branch_id())
    )
  );

create policy "staff_group_schedule_rules_insert_authorized_branch"
  on public.staff_group_schedule_rules
  for insert
  to authenticated
  with check (
    (select public.get_auth_role()) = 'owner'
    or (
      (select public.get_auth_role()) = any (
        array[
          'manager',
          'assistant_manager',
          'store_manager',
          'crm',
          'csr',
          'csr_head',
          'csr_staff'
        ]::text[]
      )
      and exists (
        select 1
        from public.staff_schedule_groups as schedule_group
        where schedule_group.id = staff_group_schedule_rules.group_id
          and schedule_group.branch_id = (select public.get_auth_branch_id())
      )
    )
  );

create policy "staff_group_schedule_rules_update_authorized_branch"
  on public.staff_group_schedule_rules
  for update
  to authenticated
  using (
    (select public.get_auth_role()) = 'owner'
    or (
      (select public.get_auth_role()) = any (
        array[
          'manager',
          'assistant_manager',
          'store_manager',
          'crm',
          'csr',
          'csr_head',
          'csr_staff'
        ]::text[]
      )
      and exists (
        select 1
        from public.staff_schedule_groups as schedule_group
        where schedule_group.id = staff_group_schedule_rules.group_id
          and schedule_group.branch_id = (select public.get_auth_branch_id())
      )
    )
  )
  with check (
    (select public.get_auth_role()) = 'owner'
    or (
      (select public.get_auth_role()) = any (
        array[
          'manager',
          'assistant_manager',
          'store_manager',
          'crm',
          'csr',
          'csr_head',
          'csr_staff'
        ]::text[]
      )
      and exists (
        select 1
        from public.staff_schedule_groups as schedule_group
        where schedule_group.id = staff_group_schedule_rules.group_id
          and schedule_group.branch_id = (select public.get_auth_branch_id())
      )
    )
  );

create policy "staff_group_schedule_rules_delete_authorized_branch"
  on public.staff_group_schedule_rules
  for delete
  to authenticated
  using (
    (select public.get_auth_role()) = 'owner'
    or (
      (select public.get_auth_role()) = any (
        array[
          'manager',
          'assistant_manager',
          'store_manager',
          'crm',
          'csr',
          'csr_head',
          'csr_staff'
        ]::text[]
      )
      and exists (
        select 1
        from public.staff_schedule_groups as schedule_group
        where schedule_group.id = staff_group_schedule_rules.group_id
          and schedule_group.branch_id = (select public.get_auth_branch_id())
      )
    )
  );

revoke all on table public.staff_schedule_groups from anon, authenticated;
revoke all on table public.staff_group_schedule_rules from anon, authenticated;

grant select
  on table public.staff_schedule_groups
  to authenticated;

grant select, insert, update, delete
  on table public.staff_group_schedule_rules
  to authenticated;
