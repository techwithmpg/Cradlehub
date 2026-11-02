-- LOCAL schema-only correction recovered from classified PRODUCTION pg_catalog
-- on 2026-11-01. This is not a Supabase migration or an apply queue.
-- Prerequisites: accepted public.branches(id), public.staff(id), and the
-- platform roles anon, authenticated, service_role, postgres.
-- No rows, production credentials, or production SQL write were used.

create table public.staff_duty_assignments (
  id uuid not null default gen_random_uuid(),
  staff_id uuid not null,
  branch_id uuid not null,
  day_of_week smallint not null,
  duty_type text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint staff_duty_assignments_pkey primary key (id),
  constraint staff_duty_assignments_staff_id_day_of_week_duty_type_key
    unique (staff_id, day_of_week, duty_type),
  constraint staff_duty_assignments_day_of_week_check
    check (day_of_week >= 0 and day_of_week <= 6),
  constraint staff_duty_assignments_duty_type_check
    check (duty_type = any (array['opening'::text, 'closing'::text])),
  constraint staff_duty_assignments_staff_id_fkey
    foreign key (staff_id) references public.staff(id),
  constraint staff_duty_assignments_branch_id_fkey
    foreign key (branch_id) references public.branches(id)
);

alter table public.staff_duty_assignments owner to postgres;
alter table public.staff_duty_assignments enable row level security;
revoke all on table public.staff_duty_assignments
  from public, anon, authenticated;
grant all on table public.staff_duty_assignments to service_role;

-- The source catalog has no row policies or user-defined triggers. The primary
-- key and unique constraint create its only two indexes.
