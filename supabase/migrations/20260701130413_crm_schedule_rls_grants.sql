-- Branch-scoped CRM/front-desk schedule access.
-- Keep owner/management/self-read policies from earlier migrations; add explicit
-- front-desk CRUD policies and Data API grants for authenticated users.

grant select, insert, update, delete
on table public.staff_schedules,
         public.schedule_overrides,
         public.blocked_times
to authenticated;

-- ── staff_schedules ────────────────────────────────────────────────────────

drop policy if exists "staff_schedules_front_desk_select_branch" on public.staff_schedules;
drop policy if exists "staff_schedules_front_desk_insert_branch" on public.staff_schedules;
drop policy if exists "staff_schedules_front_desk_update_branch" on public.staff_schedules;
drop policy if exists "staff_schedules_front_desk_delete_branch" on public.staff_schedules;

create policy "staff_schedules_front_desk_select_branch"
  on public.staff_schedules for select
  to authenticated
  using (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and exists (
      select 1
      from public.staff target_staff
      where target_staff.id = staff_schedules.staff_id
        and target_staff.branch_id = (select public.get_auth_branch_id())
    )
  );

create policy "staff_schedules_front_desk_insert_branch"
  on public.staff_schedules for insert
  to authenticated
  with check (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and exists (
      select 1
      from public.staff target_staff
      where target_staff.id = staff_schedules.staff_id
        and target_staff.is_active = true
        and target_staff.branch_id = (select public.get_auth_branch_id())
    )
  );

create policy "staff_schedules_front_desk_update_branch"
  on public.staff_schedules for update
  to authenticated
  using (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and exists (
      select 1
      from public.staff target_staff
      where target_staff.id = staff_schedules.staff_id
        and target_staff.branch_id = (select public.get_auth_branch_id())
    )
  )
  with check (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and exists (
      select 1
      from public.staff target_staff
      where target_staff.id = staff_schedules.staff_id
        and target_staff.is_active = true
        and target_staff.branch_id = (select public.get_auth_branch_id())
    )
  );

create policy "staff_schedules_front_desk_delete_branch"
  on public.staff_schedules for delete
  to authenticated
  using (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and exists (
      select 1
      from public.staff target_staff
      where target_staff.id = staff_schedules.staff_id
        and target_staff.branch_id = (select public.get_auth_branch_id())
    )
  );

-- ── schedule_overrides ──────────────────────────────────────────────────────

drop policy if exists "schedule_overrides_front_desk_select_branch" on public.schedule_overrides;
drop policy if exists "schedule_overrides_front_desk_insert_branch" on public.schedule_overrides;
drop policy if exists "schedule_overrides_front_desk_update_branch" on public.schedule_overrides;
drop policy if exists "schedule_overrides_front_desk_delete_branch" on public.schedule_overrides;

create policy "schedule_overrides_front_desk_select_branch"
  on public.schedule_overrides for select
  to authenticated
  using (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and exists (
      select 1
      from public.staff target_staff
      where target_staff.id = schedule_overrides.staff_id
        and target_staff.branch_id = (select public.get_auth_branch_id())
    )
  );

create policy "schedule_overrides_front_desk_insert_branch"
  on public.schedule_overrides for insert
  to authenticated
  with check (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and exists (
      select 1
      from public.staff target_staff
      where target_staff.id = schedule_overrides.staff_id
        and target_staff.is_active = true
        and target_staff.branch_id = (select public.get_auth_branch_id())
    )
  );

create policy "schedule_overrides_front_desk_update_branch"
  on public.schedule_overrides for update
  to authenticated
  using (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and exists (
      select 1
      from public.staff target_staff
      where target_staff.id = schedule_overrides.staff_id
        and target_staff.branch_id = (select public.get_auth_branch_id())
    )
  )
  with check (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and exists (
      select 1
      from public.staff target_staff
      where target_staff.id = schedule_overrides.staff_id
        and target_staff.is_active = true
        and target_staff.branch_id = (select public.get_auth_branch_id())
    )
  );

create policy "schedule_overrides_front_desk_delete_branch"
  on public.schedule_overrides for delete
  to authenticated
  using (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and exists (
      select 1
      from public.staff target_staff
      where target_staff.id = schedule_overrides.staff_id
        and target_staff.branch_id = (select public.get_auth_branch_id())
    )
  );

-- ── blocked_times ───────────────────────────────────────────────────────────

drop policy if exists "blocked_times_front_desk_select_branch" on public.blocked_times;
drop policy if exists "blocked_times_front_desk_insert_branch" on public.blocked_times;
drop policy if exists "blocked_times_front_desk_update_branch" on public.blocked_times;
drop policy if exists "blocked_times_front_desk_delete_branch" on public.blocked_times;

create policy "blocked_times_front_desk_select_branch"
  on public.blocked_times for select
  to authenticated
  using (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and exists (
      select 1
      from public.staff target_staff
      where target_staff.id = blocked_times.staff_id
        and target_staff.branch_id = (select public.get_auth_branch_id())
    )
  );

create policy "blocked_times_front_desk_insert_branch"
  on public.blocked_times for insert
  to authenticated
  with check (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and exists (
      select 1
      from public.staff target_staff
      where target_staff.id = blocked_times.staff_id
        and target_staff.is_active = true
        and target_staff.branch_id = (select public.get_auth_branch_id())
    )
  );

create policy "blocked_times_front_desk_update_branch"
  on public.blocked_times for update
  to authenticated
  using (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and exists (
      select 1
      from public.staff target_staff
      where target_staff.id = blocked_times.staff_id
        and target_staff.branch_id = (select public.get_auth_branch_id())
    )
  )
  with check (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and exists (
      select 1
      from public.staff target_staff
      where target_staff.id = blocked_times.staff_id
        and target_staff.is_active = true
        and target_staff.branch_id = (select public.get_auth_branch_id())
    )
  );

create policy "blocked_times_front_desk_delete_branch"
  on public.blocked_times for delete
  to authenticated
  using (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and exists (
      select 1
      from public.staff target_staff
      where target_staff.id = blocked_times.staff_id
        and target_staff.branch_id = (select public.get_auth_branch_id())
    )
  );

notify pgrst, 'reload schema';
