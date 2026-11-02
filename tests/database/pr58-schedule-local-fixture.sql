-- LOCAL ONLY: narrow schedule-function test fixture, not a production schema baseline.
-- Columns are the projection used by the accepted functions, sourced from
-- 20260429000001_core_tables.sql and src/types/supabase.ts.
-- The LOCAL cluster already supplies Supabase roles anon, authenticated,
-- service_role, and postgres; this file never creates or changes them.
create table public.staff (
  id uuid primary key,
  branch_id uuid not null,
  full_name text not null,
  is_active boolean not null default true,
  archived_at timestamptz,
  merged_into_staff_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  staff_type text not null default 'therapist',
  system_role text not null default 'staff'
);
create table public.staff_schedules (
  id uuid primary key,
  staff_id uuid not null references public.staff(id),
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  shift_type text not null default 'single' check (shift_type in ('single','opening','closing')),
  window_order smallint not null default 1 check (window_order between 1 and 12),
  ends_next_day boolean not null default false,
  created_at timestamptz not null default now(),
  constraint staff_schedules_staff_day_window_unique unique (staff_id, day_of_week, window_order)
);
alter table public.staff enable row level security;
alter table public.staff_schedules enable row level security;
