-- LOCAL/TEST candidate only. Recovered from the classified public.staff catalog
-- on 2026-11-02. Not a migration or production DDL instruction.
-- Prerequisites: public.branches(id), auth.users(id), auth.uid(), Supabase roles.
-- Helper and trigger functions below transcribe accepted repository behavior.

create table public.staff (
  id uuid not null default gen_random_uuid(),
  branch_id uuid not null,
  auth_user_id uuid,
  full_name text not null,
  phone text,
  tier text not null default 'junior',
  system_role text not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  staff_type text not null default 'therapist',
  is_head boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  avatar_url text,
  avatar_path text,
  workspace_access text[] not null default '{}'::text[],
  temporary_access_expires_at timestamptz,
  access_notes text,
  nickname text,
  merged_into_staff_id uuid,
  archived_at timestamptz,
  archive_reason text,
  identity_verified_at timestamptz,
  is_cross_branch boolean not null default false,
  constraint staff_pkey primary key (id),
  constraint staff_auth_user_id_key unique (auth_user_id),
  constraint staff_branch_id_fkey foreign key (branch_id)
    references public.branches(id) on delete restrict,
  constraint staff_auth_user_id_fkey foreign key (auth_user_id)
    references auth.users(id) on delete set null,
  constraint staff_merged_into_staff_id_fkey foreign key (merged_into_staff_id)
    references public.staff(id),
  constraint staff_staff_type_check check (staff_type = any (array[
    'therapist'::text, 'nail_tech'::text, 'aesthetician'::text,
    'csr'::text, 'driver'::text, 'utility'::text,
    'salon_head'::text, 'managerial'::text])),
  constraint staff_system_role_check check (system_role = any (array[
    'owner'::text, 'manager'::text, 'assistant_manager'::text,
    'store_manager'::text, 'crm'::text, 'staff'::text,
    'service_head'::text, 'service_staff'::text, 'digital_marketer'::text,
    'driver'::text, 'utility'::text])),
  constraint staff_tier_check check (tier = any (array[
    'senior'::text, 'mid'::text, 'junior'::text, 'head'::text, 'n/a'::text]))
);

alter table public.staff owner to postgres;
create index idx_staff_auth_user_id on public.staff (auth_user_id)
  where auth_user_id is not null;
create index idx_staff_branch_id on public.staff (branch_id);
create index idx_staff_role_active on public.staff (system_role)
  where is_active = true;
create index staff_metadata_gin_idx on public.staff using gin (metadata);
create index staff_operational_branch_idx on public.staff (branch_id, is_active)
  where archived_at is null and merged_into_staff_id is null;
create unique index staff_unique_auth_user_id on public.staff (auth_user_id)
  where auth_user_id is not null;

alter table public.staff enable row level security;
revoke all on table public.staff from public;
grant all on table public.staff to anon, authenticated, service_role;
grant update (branch_id, full_name, phone, tier, system_role,
              is_active, staff_type, is_head, nickname)
  on table public.staff to authenticated;

-- Accepted source: 20260429000003_helper_functions.sql.
create or replace function public.get_auth_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select system_role
  from staff
  where auth_user_id = (select auth.uid())
    and is_active = true
  limit 1;
$$;

create or replace function public.get_auth_branch_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select branch_id
  from staff
  where auth_user_id = (select auth.uid())
    and is_active = true
  limit 1;
$$;

-- Accepted source: 20260429000004_triggers.sql.
create or replace function public.fn_update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Accepted source: 20260701130406_normalize_front_desk_crm_roles.sql.
create or replace function public.normalize_front_desk_system_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.system_role in ('csr', 'csr_head', 'csr_staff') then
    new.system_role := 'crm';
  end if;
  return new;
end;
$$;

-- Accepted source: 20260709054954_attendance_device_branch_sync.sql.
create or replace function public.sync_staff_device_branch_from_staff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' or new.branch_id is not distinct from old.branch_id then
    return new;
  end if;

  if new.branch_id is null then
    return new;
  end if;

  update public.staff_devices
     set branch_id = new.branch_id,
         metadata = coalesce(metadata, '{}'::jsonb)
           || jsonb_build_object(
             'branch_synced_from_staff_at', now(),
             'branch_sync_source', 'staff_branch_update',
             'previous_branch_id', old.branch_id
           )
   where staff_id = new.id
     and status = 'active'
     and branch_id is distinct from new.branch_id;

  return new;
end;
$$;
revoke all on function public.sync_staff_device_branch_from_staff()
  from public, anon, authenticated;

create policy staff_csr_read_branch on public.staff for select to authenticated
  using (get_auth_role() = any (array['csr','csr_head','csr_staff'])
    and branch_id = get_auth_branch_id());
create policy staff_driver_read_branch on public.staff for select to authenticated
  using (get_auth_role() = 'driver' and branch_id = get_auth_branch_id());
create policy staff_manager_read_branch on public.staff for select to authenticated
  using (get_auth_role() = 'manager' and branch_id = get_auth_branch_id());
create policy staff_operational_read_branch on public.staff for select to authenticated
  using (get_auth_role() = any (array[
    'assistant_manager','store_manager','crm','csr_head','csr_staff','csr'])
    and branch_id = get_auth_branch_id());
create policy staff_operational_update_branch on public.staff for update to authenticated
  using ((select get_auth_role()) = any (array[
      'manager','assistant_manager','store_manager','crm','csr','csr_head','csr_staff'])
    and branch_id = (select get_auth_branch_id())
    and system_role <> all (array['owner','manager','assistant_manager','store_manager']))
  with check ((select get_auth_role()) = any (array[
      'manager','assistant_manager','store_manager','crm','csr','csr_head','csr_staff'])
    and branch_id = (select get_auth_branch_id())
    and system_role <> all (array['owner','manager','assistant_manager','store_manager']));
create policy staff_owner_all on public.staff for all to authenticated
  using (get_auth_role() = 'owner') with check (get_auth_role() = 'owner');
create policy staff_read_own on public.staff for select to authenticated
  using (auth_user_id = auth.uid());

create trigger normalize_front_desk_system_role
  before insert or update of system_role on public.staff
  for each row execute function public.normalize_front_desk_system_role();
create trigger trg_staff_branch_sync_devices
  after update of branch_id on public.staff
  for each row execute function public.sync_staff_device_branch_from_staff();
create trigger trg_staff_updated_at
  before update on public.staff
  for each row execute function public.fn_update_updated_at();
