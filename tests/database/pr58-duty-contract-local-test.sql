\set ON_ERROR_STOP on

-- Disposable LOCAL PostgreSQL 17 harness. The two parent table definitions
-- below are copied from 20260429000001_core_tables.sql. auth.users is only a
-- LOCAL platform prerequisite for staff's Auth FK, not an integration claim.
create schema auth;
create table auth.users (id uuid primary key);
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  phone text,
  email text,
  maps_embed_url text,
  fb_page text,
  messenger_link text,
  slot_interval_minutes int not null default 30
    check (slot_interval_minutes in (15, 30, 60)),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  phone text,
  tier text not null default 'junior'
    check (tier in ('senior', 'mid', 'junior')),
  system_role text not null default 'staff'
    check (system_role in ('owner', 'manager', 'crm', 'staff')),
  staff_type text not null default 'therapist'
    check (staff_type in ('therapist', 'nail_tech', 'aesthetician', 'csr', 'driver', 'utility', 'salon_head', 'managerial')),
  is_head boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

\ir pr58-staff-duty-assignments-baseline.sql

do $$ begin
  if (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'name',a.attname,'type',pg_catalog.format_type(a.atttypid,a.atttypmod),
        'not_null',a.attnotnull,'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid)
      ) order by a.attnum)
      from pg_catalog.pg_attribute a
      left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid='public.staff_duty_assignments'::regclass
        and a.attnum>0 and not a.attisdropped)
      is distinct from '[
        {"name":"id","type":"uuid","not_null":true,"default":"gen_random_uuid()"},
        {"name":"staff_id","type":"uuid","not_null":true,"default":null},
        {"name":"branch_id","type":"uuid","not_null":true,"default":null},
        {"name":"day_of_week","type":"smallint","not_null":true,"default":null},
        {"name":"duty_type","type":"text","not_null":true,"default":null},
        {"name":"is_active","type":"boolean","not_null":true,"default":"true"},
        {"name":"created_at","type":"timestamp with time zone","not_null":true,"default":"now()"}
      ]'::jsonb then
    raise exception 'duty columns differ from production catalog';
  end if;
  if (select count(*) from pg_catalog.pg_constraint
      where conrelid='public.staff_duty_assignments'::regclass) <> 6 then
    raise exception 'duty constraint count differs from production catalog';
  end if;
  if (select pg_catalog.jsonb_object_agg(conname,
      pg_catalog.pg_get_constraintdef(oid,true)) from pg_catalog.pg_constraint
      where conrelid='public.staff_duty_assignments'::regclass)
      is distinct from '{
        "staff_duty_assignments_pkey":"PRIMARY KEY (id)",
        "staff_duty_assignments_staff_id_day_of_week_duty_type_key":"UNIQUE (staff_id, day_of_week, duty_type)",
        "staff_duty_assignments_day_of_week_check":"CHECK (day_of_week >= 0 AND day_of_week <= 6)",
        "staff_duty_assignments_duty_type_check":"CHECK (duty_type = ANY (ARRAY[''opening''::text, ''closing''::text]))",
        "staff_duty_assignments_staff_id_fkey":"FOREIGN KEY (staff_id) REFERENCES staff(id)",
        "staff_duty_assignments_branch_id_fkey":"FOREIGN KEY (branch_id) REFERENCES branches(id)"
      }'::jsonb then
    raise exception 'duty constraint definitions differ from production catalog';
  end if;
  if exists (select 1 from pg_catalog.pg_constraint
      where conrelid='public.staff_duty_assignments'::regclass
        and contype='f' and (confdeltype<>'a' or confupdtype<>'a')) then
    raise exception 'duty FK actions differ from NO ACTION';
  end if;
  if (select count(*) from pg_catalog.pg_index
      where indrelid='public.staff_duty_assignments'::regclass) <> 2 then
    raise exception 'duty index count differs from production catalog';
  end if;
  if exists (select 1 from pg_catalog.pg_trigger
      where tgrelid='public.staff_duty_assignments'::regclass and not tgisinternal)
    or exists (select 1 from pg_catalog.pg_policy
      where polrelid='public.staff_duty_assignments'::regclass) then
    raise exception 'unexpected duty trigger or policy';
  end if;
  if not (select relrowsecurity and not relforcerowsecurity
      and relowner='postgres'::regrole from pg_catalog.pg_class
      where oid='public.staff_duty_assignments'::regclass) then
    raise exception 'duty ownership or RLS differs from production catalog';
  end if;
  if has_table_privilege('anon','public.staff_duty_assignments','SELECT')
    or has_table_privilege('authenticated','public.staff_duty_assignments','SELECT')
    or has_table_privilege('authenticated','public.staff_duty_assignments','INSERT')
    or not has_table_privilege('service_role','public.staff_duty_assignments','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'duty grants differ from production catalog';
  end if;
end $$;

insert into public.branches (id, name, address) values
  ('c1000000-0000-0000-0000-000000000001','LOCAL Main','LOCAL only'),
  ('c1000000-0000-0000-0000-000000000002','LOCAL SM','LOCAL only');
insert into public.staff (id, branch_id, full_name) values
  ('a1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001','LOCAL Staff');
insert into public.staff_duty_assignments
  (staff_id, branch_id, day_of_week, duty_type) values
  ('a1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001',1,'opening'),
  ('a1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000002',1,'closing');

do $$ declare rejected boolean; begin
  if (select count(*) from public.staff_duty_assignments
      where staff_id='a1000000-0000-0000-0000-000000000001') <> 2 then
    raise exception 'expected two distinct accepted duty types';
  end if;
  if exists (select 1 from public.staff_duty_assignments
      where id is null or created_at is null or is_active is not true) then
    raise exception 'duty defaults failed';
  end if;

  rejected := false;
  begin
    insert into public.staff_duty_assignments
      (staff_id, branch_id, day_of_week, duty_type) values
      ('a1000000-0000-0000-0000-000000000001',
       'c1000000-0000-0000-0000-000000000002',1,'opening');
  exception when unique_violation then rejected := true; end;
  if not rejected then raise exception 'duplicate staff/day/duty accepted'; end if;

  rejected := false;
  begin
    insert into public.staff_duty_assignments
      (staff_id, branch_id, day_of_week, duty_type) values
      ('a1000000-0000-0000-0000-000000000001',
       'c1000000-0000-0000-0000-000000000001',7,'opening');
  exception when check_violation then rejected := true; end;
  if not rejected then raise exception 'invalid weekday accepted'; end if;

  rejected := false;
  begin
    insert into public.staff_duty_assignments
      (staff_id, branch_id, day_of_week, duty_type) values
      ('a1000000-0000-0000-0000-000000000001',
       'c1000000-0000-0000-0000-000000000001',2,'midday');
  exception when check_violation then rejected := true; end;
  if not rejected then raise exception 'invalid duty type accepted'; end if;

  rejected := false;
  begin
    insert into public.staff_duty_assignments
      (staff_id, branch_id, day_of_week, duty_type) values
      ('a1000000-0000-0000-0000-000000000099',
       'c1000000-0000-0000-0000-000000000001',2,'opening');
  exception when foreign_key_violation then rejected := true; end;
  if not rejected then raise exception 'unknown staff accepted'; end if;

  rejected := false;
  begin
    insert into public.staff_duty_assignments
      (staff_id, branch_id, day_of_week, duty_type) values
      ('a1000000-0000-0000-0000-000000000001',
       'c1000000-0000-0000-0000-000000000099',2,'opening');
  exception when foreign_key_violation then rejected := true; end;
  if not rejected then raise exception 'unknown branch accepted'; end if;
end $$;

\echo 'PR58 duty contract LOCAL SQL passed'
