-- LOCAL fixture only, after public.staff creation. The real final contracts of
-- devices/schedules must be independently closed in the full attendance baseline.
create table public.staff_devices (
  id uuid primary key,
  staff_id uuid not null references public.staff(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb
);
create table public.staff_schedules (
  id uuid primary key,
  staff_id uuid not null references public.staff(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  shift_type text not null default 'single' check (shift_type in ('single','opening','closing')),
  window_order smallint not null default 1 check (window_order between 1 and 12),
  ends_next_day boolean not null default false,
  created_at timestamptz not null default now(),
  constraint staff_schedules_staff_day_window_unique unique (staff_id,day_of_week,window_order)
);
alter table public.staff_devices enable row level security;
alter table public.staff_schedules enable row level security;
