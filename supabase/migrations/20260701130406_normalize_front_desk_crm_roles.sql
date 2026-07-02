-- Normalize legacy Front Desk system roles to the canonical CRM role.
-- `staff_type = 'csr'` remains the real-world job function; it is not an
-- authorization role.

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

drop trigger if exists normalize_front_desk_system_role on public.staff;

create trigger normalize_front_desk_system_role
before insert or update of system_role on public.staff
for each row
execute function public.normalize_front_desk_system_role();

update public.staff
set system_role = 'crm'
where system_role in ('csr', 'csr_head', 'csr_staff');

do $$
begin
  if to_regclass('public.job_title_definitions') is not null then
    update public.job_title_definitions
    set system_role = 'crm'
    where system_role in ('csr', 'csr_head', 'csr_staff');
  end if;
end $$;

do $$
begin
  if to_regclass('public.role_definitions') is not null then
    insert into public.role_definitions (
      system_role,
      display_name,
      description,
      workspace,
      can_book,
      can_manage
    )
    values (
      'crm',
      'CRM',
      'Front Desk CRM workspace access.',
      'crm',
      true,
      true
    )
    on conflict (system_role) do update
      set display_name = excluded.display_name,
          description = excluded.description,
          workspace = excluded.workspace,
          can_book = excluded.can_book,
          can_manage = excluded.can_manage;

    delete from public.role_definitions
    where system_role in ('csr', 'csr_head', 'csr_staff');
  end if;
end $$;

alter table public.staff
  drop constraint if exists staff_system_role_check;

alter table public.staff
  add constraint staff_system_role_check
  check (
    system_role in (
      'owner',
      'manager',
      'assistant_manager',
      'store_manager',
      'crm',
      'staff',
      'service_head',
      'service_staff',
      'driver',
      'utility'
    )
  );

comment on column public.staff.system_role is
  'Canonical access role. Front Desk users are stored as crm; staff_type describes real-world function.';

notify pgrst, 'reload schema';
