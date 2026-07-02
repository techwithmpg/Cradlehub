-- =============================================================================
-- CradleHub — QR Attendance and Service Session System
-- =============================================================================
-- Adds server-owned QR scan infrastructure for:
--   - permanent branch attendance QRs
--   - staff device activation and revocation
--   - append-only scan audit events
--   - attendance exceptions/corrections/settings
--   - room/resource QR service-session starts
--   - due-session auto-completion support
--
-- Design notes:
--   * Public scan routes use trusted server actions + service_role.
--   * New tables expose authenticated SELECT through branch-scoped RLS only.
--   * Mutations are intentionally service_role/server-owned; no anon table access.
-- =============================================================================

-- ─── QR points ───────────────────────────────────────────────────────────────

create table if not exists public.qr_points (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  point_type text not null
    check (point_type in ('attendance', 'room', 'resource')),
  resource_id uuid references public.branch_resources(id) on delete cascade,
  public_code text not null unique,
  label text not null,
  description text,
  is_active boolean not null default true,
  requires_registered_device boolean not null default false,
  scan_behavior text not null default 'auto'
    check (scan_behavior in ('auto', 'clock_in', 'clock_out', 'start_session')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qr_points_resource_requirement
    check (
      (point_type = 'attendance' and resource_id is null)
      or (point_type in ('room', 'resource') and resource_id is not null)
    )
);

comment on table public.qr_points is
  'Permanent public QR endpoints. The code is non-secret; scan processing is handled by server-side actions.';
comment on column public.qr_points.public_code is
  'Opaque public route token used at /scan/[publicCode]. Not an authentication secret.';

create unique index if not exists qr_points_one_active_attendance_per_branch_idx
  on public.qr_points(branch_id)
  where point_type = 'attendance' and is_active = true;

create unique index if not exists qr_points_one_active_resource_idx
  on public.qr_points(resource_id)
  where point_type in ('room', 'resource') and is_active = true;

create index if not exists qr_points_branch_type_idx
  on public.qr_points(branch_id, point_type, is_active);

drop trigger if exists trg_qr_points_updated_at on public.qr_points;
create trigger trg_qr_points_updated_at
  before update on public.qr_points
  for each row execute function public.fn_update_updated_at();


-- ─── Staff devices and activation tokens ─────────────────────────────────────

create table if not exists public.staff_devices (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  device_fingerprint_hash text not null unique,
  device_label text,
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  trusted_after timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.staff(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.staff_devices is
  'Registered staff device fingerprints. Raw device credentials are stored only in secure HttpOnly cookies.';
comment on column public.staff_devices.device_fingerprint_hash is
  'SHA-256 hash of the raw browser device credential. The raw value is never stored in the database.';

create index if not exists staff_devices_staff_status_idx
  on public.staff_devices(staff_id, status);

create index if not exists staff_devices_branch_status_idx
  on public.staff_devices(branch_id, status);

drop trigger if exists trg_staff_devices_updated_at on public.staff_devices;
create trigger trg_staff_devices_updated_at
  before update on public.staff_devices
  for each row execute function public.fn_update_updated_at();

create table if not exists public.device_activation_tokens (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_device_id uuid references public.staff_devices(id) on delete set null,
  requested_by uuid references public.staff(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint device_activation_tokens_not_expired_on_create
    check (expires_at > created_at)
);

comment on table public.device_activation_tokens is
  'One-time short-lived device activation tokens. Only token hashes are stored.';

create index if not exists device_activation_tokens_staff_idx
  on public.device_activation_tokens(staff_id, expires_at desc);

create index if not exists device_activation_tokens_unused_idx
  on public.device_activation_tokens(expires_at)
  where used_at is null;


-- ─── Append-only scan audit events ───────────────────────────────────────────

create table if not exists public.qr_scan_events (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches(id) on delete set null,
  qr_point_id uuid references public.qr_points(id) on delete set null,
  staff_id uuid references public.staff(id) on delete set null,
  device_id uuid references public.staff_devices(id) on delete set null,
  checkin_id uuid references public.staff_shift_checkins(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  resource_id uuid references public.branch_resources(id) on delete set null,
  scan_type text not null
    check (scan_type in ('attendance', 'room', 'activation', 'unknown')),
  action text not null,
  outcome text not null
    check (outcome in ('success', 'blocked', 'exception', 'error', 'noop')),
  reason_code text,
  message text,
  request_id text unique,
  user_agent text,
  ip_address inet,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.qr_scan_events is
  'Append-only audit trail for every public QR scan attempt and server decision.';
comment on column public.qr_scan_events.request_id is
  'Optional idempotency key generated by the browser/server for duplicate scan suppression.';

create index if not exists qr_scan_events_branch_created_idx
  on public.qr_scan_events(branch_id, created_at desc);

create index if not exists qr_scan_events_staff_created_idx
  on public.qr_scan_events(staff_id, created_at desc);

create index if not exists qr_scan_events_checkin_created_idx
  on public.qr_scan_events(checkin_id, created_at desc)
  where checkin_id is not null;

create index if not exists qr_scan_events_point_created_idx
  on public.qr_scan_events(qr_point_id, created_at desc);


-- ─── Attendance exceptions and corrections ───────────────────────────────────

create table if not exists public.attendance_exceptions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete set null,
  checkin_id uuid references public.staff_shift_checkins(id) on delete set null,
  scan_event_id uuid references public.qr_scan_events(id) on delete set null,
  exception_type text not null
    check (
      exception_type in (
        'late',
        'early_leave',
        'overtime',
        'missed_checkout',
        'wrong_branch',
        'unscheduled',
        'duplicate_scan',
        'active_service',
        'unknown_device',
        'revoked_device',
        'resource_conflict',
        'manual'
      )
    ),
  severity text not null default 'warning'
    check (severity in ('info', 'warning', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'resolved', 'dismissed')),
  message text not null,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.staff(id) on delete set null,
  resolution_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.attendance_exceptions is
  'Branch-scoped attendance anomalies created by scan processing or manual review.';

create index if not exists attendance_exceptions_branch_status_idx
  on public.attendance_exceptions(branch_id, status, detected_at desc);

create index if not exists attendance_exceptions_staff_idx
  on public.attendance_exceptions(staff_id, detected_at desc);

drop trigger if exists trg_attendance_exceptions_updated_at
  on public.attendance_exceptions;
create trigger trg_attendance_exceptions_updated_at
  before update on public.attendance_exceptions
  for each row execute function public.fn_update_updated_at();

create table if not exists public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete set null,
  checkin_id uuid references public.staff_shift_checkins(id) on delete set null,
  requested_by uuid references public.staff(id) on delete set null,
  approved_by uuid references public.staff(id) on delete set null,
  correction_type text not null
    check (
      correction_type in (
        'manual_clock_in',
        'manual_clock_out',
        'void',
        'adjust_times',
        'note'
      )
    ),
  previous_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  reason text not null,
  status text not null default 'applied'
    check (status in ('pending', 'applied', 'rejected')),
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.attendance_corrections is
  'Auditable manual attendance corrections. The check-in row stores current truth; corrections store why it changed.';

create index if not exists attendance_corrections_branch_created_idx
  on public.attendance_corrections(branch_id, created_at desc);

create index if not exists attendance_corrections_staff_created_idx
  on public.attendance_corrections(staff_id, created_at desc);


-- ─── Branch attendance settings ──────────────────────────────────────────────

create table if not exists public.attendance_settings (
  branch_id uuid primary key references public.branches(id) on delete cascade,
  duplicate_scan_window_seconds integer not null default 90
    check (duplicate_scan_window_seconds between 10 and 600),
  clock_in_early_grace_minutes integer not null default 15
    check (clock_in_early_grace_minutes between 0 and 240),
  clock_in_late_grace_minutes integer not null default 5
    check (clock_in_late_grace_minutes between 0 and 240),
  clock_out_early_grace_minutes integer not null default 5
    check (clock_out_early_grace_minutes between 0 and 240),
  clock_out_late_grace_minutes integer not null default 15
    check (clock_out_late_grace_minutes between 0 and 240),
  overnight_shift_cutoff_time time not null default '06:00',
  active_service_blocks_clock_out boolean not null default true,
  require_registered_device_for_attendance boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.attendance_settings is
  'Per-branch QR attendance behavior, duplicate window, grace periods, and overnight checkout settings.';

drop trigger if exists trg_attendance_settings_updated_at
  on public.attendance_settings;
create trigger trg_attendance_settings_updated_at
  before update on public.attendance_settings
  for each row execute function public.fn_update_updated_at();

insert into public.attendance_settings(branch_id)
select b.id
from public.branches b
where not exists (
  select 1
  from public.attendance_settings s
  where s.branch_id = b.id
);


-- ─── Existing table extensions ───────────────────────────────────────────────

alter table public.staff_shift_checkins
  add column if not exists scheduled_start_at timestamptz,
  add column if not exists scheduled_end_at timestamptz,
  add column if not exists source_qr_point_id uuid references public.qr_points(id) on delete set null,
  add column if not exists clock_in_scan_event_id uuid references public.qr_scan_events(id) on delete set null,
  add column if not exists clock_out_scan_event_id uuid references public.qr_scan_events(id) on delete set null,
  add column if not exists clock_in_method text,
  add column if not exists clock_out_method text,
  add column if not exists late_minutes integer not null default 0,
  add column if not exists early_leave_minutes integer not null default 0,
  add column if not exists overtime_minutes integer not null default 0,
  add column if not exists worked_minutes integer not null default 0,
  add column if not exists attendance_status text not null default 'present',
  add column if not exists exception_state text not null default 'none';

create index if not exists staff_shift_checkins_qr_point_idx
  on public.staff_shift_checkins(source_qr_point_id);

create index if not exists staff_shift_checkins_attendance_status_idx
  on public.staff_shift_checkins(branch_id, shift_date, attendance_status);

alter table public.bookings
  add column if not exists session_duration_minutes_snapshot integer,
  add column if not exists session_due_at timestamptz,
  add column if not exists session_start_scan_event_id uuid references public.qr_scan_events(id) on delete set null,
  add column if not exists session_started_from_resource_id uuid references public.branch_resources(id) on delete set null,
  add column if not exists session_auto_completed_at timestamptz,
  add column if not exists session_completion_source text,
  add column if not exists session_extension_reason text,
  add column if not exists session_extended_by uuid references public.staff(id) on delete set null,
  add column if not exists session_extended_at timestamptz;

create index if not exists bookings_due_service_sessions_idx
  on public.bookings(session_due_at)
  where booking_progress_status = 'session_started'
    and session_completed_at is null;

create index if not exists bookings_session_resource_idx
  on public.bookings(session_started_from_resource_id, session_started_at desc)
  where session_started_from_resource_id is not null;


-- ─── Due-session completion RPC ──────────────────────────────────────────────

create or replace function public.complete_due_service_sessions(p_limit integer default 100)
returns table (
  booking_id uuid,
  branch_id uuid,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select b.id,
           b.branch_id
    from public.bookings b
    join public.services s on s.id = b.service_id
    where b.booking_progress_status = 'session_started'
      and b.status = 'in_progress'
      and b.session_started_at is not null
      and b.session_completed_at is null
      and coalesce(
            b.session_due_at,
            b.session_started_at
              + make_interval(mins => coalesce(b.session_duration_minutes_snapshot, s.duration_minutes, 60))
          ) <= now()
    order by coalesce(
      b.session_due_at,
      b.session_started_at
        + make_interval(mins => coalesce(b.session_duration_minutes_snapshot, s.duration_minutes, 60))
    )
    limit greatest(1, least(coalesce(p_limit, 100), 500))
    for update of b skip locked
  ),
  updated as (
    update public.bookings b
       set booking_progress_status = 'completed',
           status = 'completed',
           session_completed_at = now(),
           completed_at = coalesce(b.completed_at, now()),
           session_auto_completed_at = now(),
           session_completion_source = coalesce(b.session_completion_source, 'auto_due'),
           updated_at = now()
      from due
     where b.id = due.id
    returning b.id, b.branch_id, b.session_completed_at
  )
  select updated.id, updated.branch_id, updated.session_completed_at
  from updated;
end;
$$;

comment on function public.complete_due_service_sessions(integer) is
  'Completes in-progress service sessions whose server-side due time has elapsed. Intended for service_role server jobs or pg_cron.';

revoke all on function public.complete_due_service_sessions(integer) from public;
revoke all on function public.complete_due_service_sessions(integer) from anon;
revoke all on function public.complete_due_service_sessions(integer) from authenticated;
grant execute on function public.complete_due_service_sessions(integer) to service_role;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    execute $cron$
      select cron.schedule(
        'cradlehub-complete-due-service-sessions',
        '* * * * *',
        'select public.complete_due_service_sessions(100);'
      )
      where not exists (
        select 1
        from cron.job
        where jobname = 'cradlehub-complete-due-service-sessions'
      );
    $cron$;
  else
    raise notice 'pg_cron schema not installed; complete_due_service_sessions() is available for server-side scheduling.';
  end if;
end $$;


-- ─── RLS and explicit grants ─────────────────────────────────────────────────

alter table public.qr_points enable row level security;
alter table public.staff_devices enable row level security;
alter table public.device_activation_tokens enable row level security;
alter table public.qr_scan_events enable row level security;
alter table public.attendance_exceptions enable row level security;
alter table public.attendance_corrections enable row level security;
alter table public.attendance_settings enable row level security;

drop policy if exists "qr_points_owner_select" on public.qr_points;
create policy "qr_points_owner_select"
  on public.qr_points for select
  to authenticated
  using ((select public.get_auth_role()) = 'owner');

drop policy if exists "qr_points_branch_select" on public.qr_points;
create policy "qr_points_branch_select"
  on public.qr_points for select
  to authenticated
  using (
    (select public.get_auth_role()) in (
      'manager',
      'assistant_manager',
      'store_manager',
      'crm',
      'csr',
      'csr_head',
      'csr_staff',
      'staff',
      'driver',
      'utility'
    )
    and branch_id = (select public.get_auth_branch_id())
  );

drop policy if exists "staff_devices_owner_select" on public.staff_devices;
create policy "staff_devices_owner_select"
  on public.staff_devices for select
  to authenticated
  using ((select public.get_auth_role()) = 'owner');

drop policy if exists "staff_devices_branch_select" on public.staff_devices;
create policy "staff_devices_branch_select"
  on public.staff_devices for select
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
  );

drop policy if exists "staff_devices_staff_select_own" on public.staff_devices;
create policy "staff_devices_staff_select_own"
  on public.staff_devices for select
  to authenticated
  using (staff_id = (select public.get_auth_staff_id()));

drop policy if exists "qr_scan_events_owner_select" on public.qr_scan_events;
create policy "qr_scan_events_owner_select"
  on public.qr_scan_events for select
  to authenticated
  using ((select public.get_auth_role()) = 'owner');

drop policy if exists "qr_scan_events_branch_select" on public.qr_scan_events;
create policy "qr_scan_events_branch_select"
  on public.qr_scan_events for select
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
  );

drop policy if exists "qr_scan_events_staff_select_own" on public.qr_scan_events;
create policy "qr_scan_events_staff_select_own"
  on public.qr_scan_events for select
  to authenticated
  using (staff_id = (select public.get_auth_staff_id()));

drop policy if exists "attendance_exceptions_owner_select" on public.attendance_exceptions;
create policy "attendance_exceptions_owner_select"
  on public.attendance_exceptions for select
  to authenticated
  using ((select public.get_auth_role()) = 'owner');

drop policy if exists "attendance_exceptions_branch_select" on public.attendance_exceptions;
create policy "attendance_exceptions_branch_select"
  on public.attendance_exceptions for select
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
  );

drop policy if exists "attendance_corrections_owner_select" on public.attendance_corrections;
create policy "attendance_corrections_owner_select"
  on public.attendance_corrections for select
  to authenticated
  using ((select public.get_auth_role()) = 'owner');

drop policy if exists "attendance_corrections_branch_select" on public.attendance_corrections;
create policy "attendance_corrections_branch_select"
  on public.attendance_corrections for select
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
  );

drop policy if exists "attendance_settings_owner_select" on public.attendance_settings;
create policy "attendance_settings_owner_select"
  on public.attendance_settings for select
  to authenticated
  using ((select public.get_auth_role()) = 'owner');

drop policy if exists "attendance_settings_branch_select" on public.attendance_settings;
create policy "attendance_settings_branch_select"
  on public.attendance_settings for select
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
  );

revoke all on table public.qr_points from anon;
revoke all on table public.staff_devices from anon;
revoke all on table public.device_activation_tokens from anon;
revoke all on table public.qr_scan_events from anon;
revoke all on table public.attendance_exceptions from anon;
revoke all on table public.attendance_corrections from anon;
revoke all on table public.attendance_settings from anon;

revoke all on table public.qr_points from authenticated;
revoke all on table public.staff_devices from authenticated;
revoke all on table public.device_activation_tokens from authenticated;
revoke all on table public.qr_scan_events from authenticated;
revoke all on table public.attendance_exceptions from authenticated;
revoke all on table public.attendance_corrections from authenticated;
revoke all on table public.attendance_settings from authenticated;

grant select on table public.qr_points to authenticated;
grant select on table public.staff_devices to authenticated;
grant select on table public.qr_scan_events to authenticated;
grant select on table public.attendance_exceptions to authenticated;
grant select on table public.attendance_corrections to authenticated;
grant select on table public.attendance_settings to authenticated;

grant select, insert, update, delete on table public.qr_points to service_role;
grant select, insert, update, delete on table public.staff_devices to service_role;
grant select, insert, update, delete on table public.device_activation_tokens to service_role;
grant select, insert, update, delete on table public.qr_scan_events to service_role;
grant select, insert, update, delete on table public.attendance_exceptions to service_role;
grant select, insert, update, delete on table public.attendance_corrections to service_role;
grant select, insert, update, delete on table public.attendance_settings to service_role;
