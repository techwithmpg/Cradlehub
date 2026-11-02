-- =============================================================================
-- CRADLEHUB ATTENDANCE DEPENDENCY SLICE: QR POINTS, SCAN EVENTS & GEOFENCE
-- Target: Disposable LOCAL PostgreSQL 17 only (127.0.0.1:55444)
-- Provenance:
--   - 20260505000001_branch_resources.sql (branch_resources table, RLS, grants)
--   - 20260702075213_attendance_qr_system.sql (qr_points, qr_scan_events, attendance_exceptions, policies)
--   - 20260709103000_home_service_distance_fee.sql (branch latitude/longitude columns & constraints)
--   - 20260710055131_attendance_test_mode.sql (is_test column)
--   - 20260712035222_attendance_autonomy_hardening.sql (operation_id, operation_result, exceptions dedupe)
--   - 20260712044527_attendance_transactional_scan_rpc.sql (commit_attendance_scan_transaction signature & grants)
--   - 20260821023717_fix_attendance_function_ambiguity.sql (commit_attendance_scan_transaction implementation)
--   - 20261029065202_attendance_geofence_branch_coordinates.sql (branch coordinate values)
--   - src/lib/attendance/geofence.ts & geofence-server.ts (Haversine formula & geofence rules)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. BRANCH GEOFENCE COORDINATES & RANGE CONSTRAINTS
-- -----------------------------------------------------------------------------

alter table public.branches
  add column if not exists latitude numeric,
  add column if not exists longitude numeric;

alter table public.branches
  drop constraint if exists branches_latitude_range,
  drop constraint if exists branches_longitude_range;

alter table public.branches
  add constraint branches_latitude_range
    check (latitude is null or (latitude >= -90 and latitude <= 90)),
  add constraint branches_longitude_range
    check (longitude is null or (longitude >= -180 and longitude <= 180));

comment on column public.branches.latitude is
  'Branch latitude used for attendance geofencing and home-service travel.';
comment on column public.branches.longitude is
  'Branch longitude used for attendance geofencing and home-service travel.';

-- Seed coordinates for test branches
-- Main branch (c1000000-...0001 or 00000000-...0201)
update public.branches
set latitude = 10.7024485,
    longitude = 122.9619465
where id in (
  'c1000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000201'::uuid
);

-- SM branch (c1000000-...0002 or 00000000-...0202)
update public.branches
set latitude = 10.671561584942413,
    longitude = 122.94369105292084
where id in (
  'c1000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000202'::uuid
);

-- -----------------------------------------------------------------------------
-- 2. BRANCH RESOURCES (Rooms, Beds, Equipment)
-- -----------------------------------------------------------------------------

create table if not exists public.branch_resources (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  type text not null default 'room'
    check (type in ('room', 'bed', 'chair', 'equipment', 'home_service_unit', 'shared_area', 'other')),
  capacity integer not null default 1 check (capacity >= 1),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.branch_resources is
  'Bookable physical spaces or equipment within a branch.';

create index if not exists idx_branch_resources_branch_id
  on public.branch_resources(branch_id);
create index if not exists idx_branch_resources_branch_active
  on public.branch_resources(branch_id, is_active);
create index if not exists idx_branch_resources_sort_order
  on public.branch_resources(branch_id, sort_order);

drop trigger if exists update_branch_resources_modtime on public.branch_resources;
create trigger update_branch_resources_modtime
  before update on public.branch_resources
  for each row execute function public.fn_update_updated_at();

alter table public.branch_resources enable row level security;

revoke all on table public.branch_resources from public, anon, authenticated;
grant select on table public.branch_resources to authenticated;
grant select, insert, update, delete on table public.branch_resources to service_role;

drop policy if exists "branch_resources_owner_all" on public.branch_resources;
create policy "branch_resources_owner_all"
  on public.branch_resources for all
  to authenticated
  using ((select public.get_auth_role()) = 'owner')
  with check ((select public.get_auth_role()) = 'owner');

drop policy if exists "branch_resources_manager_all" on public.branch_resources;
create policy "branch_resources_manager_all"
  on public.branch_resources for all
  to authenticated
  using (
    (select public.get_auth_role()) = 'manager'
    and branch_id = (select public.get_auth_branch_id())
  )
  with check (
    (select public.get_auth_role()) = 'manager'
    and branch_id = (select public.get_auth_branch_id())
  );

drop policy if exists "branch_resources_staff_read" on public.branch_resources;
create policy "branch_resources_staff_read"
  on public.branch_resources for select
  to authenticated
  using (
    (select public.get_auth_role()) = 'staff'
    and branch_id = (select public.get_auth_branch_id())
    and is_active = true
  );

drop policy if exists "branch_resources_crm_read" on public.branch_resources;
create policy "branch_resources_crm_read"
  on public.branch_resources for select
  to authenticated
  using (
    (select public.get_auth_role()) in ('crm', 'csr_head', 'csr_staff')
    and is_active = true
  );

-- -----------------------------------------------------------------------------
-- 3. QR POINTS (Permanent Public QR Endpoints)
-- -----------------------------------------------------------------------------

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

alter table public.qr_points enable row level security;

revoke all on table public.qr_points from public, anon, authenticated;
grant select on table public.qr_points to authenticated;
grant select, insert, update, delete on table public.qr_points to service_role;

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

-- -----------------------------------------------------------------------------
-- 4. BOOKINGS STUB (Narrow structural projection for QR scan foreign key)
-- -----------------------------------------------------------------------------

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid()
);

-- -----------------------------------------------------------------------------
-- 5. QR SCAN EVENTS (Append-only Audit Trail)
-- -----------------------------------------------------------------------------

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
  created_at timestamptz not null default now(),
  is_test boolean not null default false,
  operation_id text,
  operation_result jsonb,
  operation_result_recorded_at timestamptz
);

comment on table public.qr_scan_events is
  'Append-only audit trail for every public QR scan attempt and server decision.';
comment on column public.qr_scan_events.request_id is
  'Optional idempotency key generated by the browser/server for duplicate scan suppression.';
comment on column public.qr_scan_events.operation_result is
  'Sanitized final public scan result for idempotent request replay. Does not contain raw device credentials or auth tokens.';

create index if not exists qr_scan_events_branch_created_idx
  on public.qr_scan_events(branch_id, created_at desc);

create index if not exists qr_scan_events_staff_created_idx
  on public.qr_scan_events(staff_id, created_at desc);

create index if not exists qr_scan_events_checkin_created_idx
  on public.qr_scan_events(checkin_id, created_at desc)
  where checkin_id is not null;

create index if not exists qr_scan_events_point_created_idx
  on public.qr_scan_events(qr_point_id, created_at desc);

create index if not exists qr_scan_events_operation_id_idx
  on public.qr_scan_events(operation_id)
  where operation_id is not null;

alter table public.qr_scan_events enable row level security;

revoke all on table public.qr_scan_events from public, anon, authenticated;
grant select on table public.qr_scan_events to authenticated;
grant select, insert, update, delete on table public.qr_scan_events to service_role;

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

-- -----------------------------------------------------------------------------
-- 6. EXTEND CHECKINS WITH SCAN EVENT LINKAGE AND ATTENDANCE FIELDS
-- -----------------------------------------------------------------------------

alter table public.staff_shift_checkins
  add column if not exists clock_in_scan_event_id uuid references public.qr_scan_events(id) on delete set null,
  add column if not exists clock_out_scan_event_id uuid references public.qr_scan_events(id) on delete set null,
  add column if not exists clock_in_method text,
  add column if not exists clock_out_method text,
  add column if not exists shift_instance_key text,
  add column if not exists scheduled_start_at timestamptz,
  add column if not exists scheduled_end_at timestamptz,
  add column if not exists schedule_source text,
  add column if not exists schedule_source_id text,
  add column if not exists branch_timezone text default 'Asia/Manila',
  add column if not exists attendance_business_date date,
  add column if not exists late_minutes integer default 0,
  add column if not exists early_leave_minutes integer default 0,
  add column if not exists overtime_minutes integer default 0,
  add column if not exists worked_minutes integer default 0,
  add column if not exists attendance_status text default 'present',
  add column if not exists exception_state text default 'none',
  add column if not exists notes text,
  add column if not exists updated_at timestamptz default now();

-- -----------------------------------------------------------------------------
-- 7. ATTENDANCE EXCEPTIONS (Anomaly Tracking)
-- -----------------------------------------------------------------------------

create table if not exists public.attendance_exceptions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete set null,
  checkin_id uuid references public.staff_shift_checkins(id) on delete set null,
  scan_event_id uuid references public.qr_scan_events(id) on delete set null,
  latest_scan_event_id uuid references public.qr_scan_events(id) on delete set null,
  exception_type text not null check (
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
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  message text not null,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.staff(id) on delete set null,
  resolution_note text,
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text,
  occurrence_count integer not null default 1 check (occurrence_count >= 1),
  first_detected_at timestamptz,
  last_detected_at timestamptz,
  related_checkin_ids uuid[] not null default '{}'::uuid[],
  recommended_action text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.attendance_exceptions is
  'Branch-scoped attendance anomalies created by scan processing or manual review.';

create index if not exists attendance_exceptions_branch_status_idx
  on public.attendance_exceptions(branch_id, status, detected_at desc);
create index if not exists attendance_exceptions_staff_idx
  on public.attendance_exceptions(staff_id, detected_at desc);
create index if not exists attendance_exceptions_open_dedupe_idx
  on public.attendance_exceptions(branch_id, dedupe_key, is_test)
  where status = 'open' and dedupe_key is not null;
create index if not exists attendance_exceptions_latest_scan_idx
  on public.attendance_exceptions(latest_scan_event_id)
  where latest_scan_event_id is not null;

drop trigger if exists trg_attendance_exceptions_updated_at on public.attendance_exceptions;
create trigger trg_attendance_exceptions_updated_at
  before update on public.attendance_exceptions
  for each row execute function public.fn_update_updated_at();

alter table public.attendance_exceptions enable row level security;

revoke all on table public.attendance_exceptions from public, anon, authenticated;
grant select on table public.attendance_exceptions to authenticated;
grant select, insert, update, delete on table public.attendance_exceptions to service_role;

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

-- -----------------------------------------------------------------------------
-- 8. HAVERSINE DISTANCE & GEOFENCE VALIDATION HELPERS
-- -----------------------------------------------------------------------------

create or replace function public.calculate_distance_meters(
  lat1 numeric,
  lon1 numeric,
  lat2 numeric,
  lon2 numeric
)
returns numeric
language sql
immutable
as $$
  select (
    6371000.0 * 2.0 * atan2(
      sqrt(
        sin(radians(lat2 - lat1) / 2.0)^2 +
        cos(radians(lat1)) * cos(radians(lat2)) *
        sin(radians(lon2 - lon1) / 2.0)^2
      ),
      sqrt(
        greatest(
          0.0,
          1.0 - (
            sin(radians(lat2 - lat1) / 2.0)^2 +
            cos(radians(lat1)) * cos(radians(lat2)) *
            sin(radians(lon2 - lon1) / 2.0)^2
          )
        )
      )
    )
  )::numeric;
$$;

comment on function public.calculate_distance_meters(numeric, numeric, numeric, numeric) is
  'Authoritative Haversine spherical distance calculation in meters between two lat/lon coordinates.';

grant execute on function public.calculate_distance_meters(numeric, numeric, numeric, numeric) to anon, authenticated, service_role;

create or replace function public.verify_attendance_geofence(
  p_branch_id uuid,
  p_staff_latitude numeric,
  p_staff_longitude numeric,
  p_accuracy numeric,
  p_location_timestamp timestamptz,
  p_now timestamptz default now()
)
returns text
language plpgsql
stable
as $$
declare
  v_branch_lat numeric;
  v_branch_lon numeric;
  v_radius numeric;
  v_distance numeric;
  v_age_ms numeric;
begin
  -- Branch lookup
  select latitude, longitude into v_branch_lat, v_branch_lon
  from public.branches
  where id = p_branch_id;

  if not found or v_branch_lat is null or v_branch_lon is null then
    return 'geofence_configuration';
  end if;

  -- Radii from branch policy: Main 100m, SM 150m, default 100m
  if p_branch_id in ('c1000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000201'::uuid) then
    v_radius := 100;
  elsif p_branch_id in ('c1000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000202'::uuid) then
    v_radius := 150;
  else
    v_radius := 100;
  end if;

  if p_staff_latitude is null or p_staff_longitude is null then
    return 'location_required';
  end if;

  if p_staff_latitude < -90 or p_staff_latitude > 90 or
     p_staff_longitude < -180 or p_staff_longitude > 180 or
     p_accuracy is null or p_accuracy <= 0 then
    return 'location_invalid';
  end if;

  -- Max accuracy: 75m
  if p_accuracy > 75 then
    return 'location_inaccurate';
  end if;

  -- Location age: -5s to 20s
  v_age_ms := extract(epoch from (p_now - p_location_timestamp)) * 1000.0;
  if v_age_ms < -5000 or v_age_ms > 20000 then
    return 'location_stale';
  end if;

  -- Distance verification
  v_distance := public.calculate_distance_meters(p_staff_latitude, p_staff_longitude, v_branch_lat, v_branch_lon);
  if v_distance > v_radius then
    return 'location_outside';
  end if;

  return 'passed';
end;
$$;

comment on function public.verify_attendance_geofence(uuid, numeric, numeric, numeric, timestamptz, timestamptz) is
  'Database-level verification of server geofence rules matching src/lib/attendance/geofence.ts.';

grant execute on function public.verify_attendance_geofence(uuid, numeric, numeric, numeric, timestamptz, timestamptz) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 9. TRANSACTIONAL SCAN EXECUTION RPC (commit_attendance_scan_transaction)
-- -----------------------------------------------------------------------------

create or replace function public.commit_attendance_scan_transaction(
  p_request_id text,
  p_branch_id uuid,
  p_qr_point_id uuid,
  p_staff_id uuid,
  p_device_id uuid,
  p_scan_type text,
  p_action text,
  p_outcome text,
  p_reason_code text default null,
  p_message text default null,
  p_user_agent text default null,
  p_ip_address text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_is_test boolean default false,
  p_public_result jsonb default null,
  p_checkin_id uuid default null,
  p_checkin_insert jsonb default null,
  p_checkin_update jsonb default null,
  p_exception jsonb default null,
  p_device_scan_type text default 'attendance'
)
returns table (
  success boolean,
  code text,
  scan_event_id uuid,
  checkin_id uuid,
  recovery_issue_id uuid,
  operation_result jsonb,
  message text
)
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_now timestamptz := now();
  v_existing_event public.qr_scan_events%rowtype;
  v_existing_checkin public.staff_shift_checkins%rowtype;
  v_scan_event_id uuid;
  v_checkin_id uuid := p_checkin_id;
  v_recovery_issue_id uuid;
  v_operation_result jsonb := coalesce(p_public_result, '{}'::jsonb);
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_ip_address inet;
  v_ip_text text;
  v_shift_instance_key text;
  v_shift_date date;
  v_shift_type text;
  v_exception_dedupe_key text;
  v_exception_metadata jsonb;
  v_exception_related_checkins uuid[];
begin
  if p_branch_id is null or p_scan_type is null or p_action is null or p_outcome is null then
    return query select false, 'invalid_request', null::uuid, null::uuid, null::uuid, null::jsonb, 'Missing scan commit fields.';
    return;
  end if;

  if p_scan_type not in ('attendance', 'room', 'activation', 'unknown') then
    return query select false, 'invalid_scan_type', null::uuid, null::uuid, null::uuid, null::jsonb, 'Unsupported scan type.';
    return;
  end if;

  if p_outcome not in ('success', 'blocked', 'exception', 'error', 'noop') then
    return query select false, 'invalid_outcome', null::uuid, null::uuid, null::uuid, null::jsonb, 'Unsupported scan outcome.';
    return;
  end if;

  if p_checkin_insert is not null and p_checkin_update is not null then
    return query select false, 'invalid_checkin_operation', null::uuid, null::uuid, null::uuid, null::jsonb, 'A scan cannot insert and update attendance in one commit.';
    return;
  end if;

  if p_request_id is not null then
    perform pg_advisory_xact_lock(hashtext('attendance_scan_request'), hashtext(p_request_id));

    select event_row.*
      into v_existing_event
    from public.qr_scan_events as event_row
    where event_row.request_id = p_request_id
    order by event_row.created_at
    limit 1
    for update;

    if found and v_existing_event.operation_result is not null then
      return query select true, 'replayed', v_existing_event.id, v_existing_event.checkin_id, null::uuid, v_existing_event.operation_result, 'Committed scan result replayed.';
      return;
    end if;
  end if;

  if p_staff_id is not null then
    perform pg_advisory_xact_lock(
      hashtext('attendance_scan_staff'),
      hashtext(concat_ws(':', p_branch_id::text, p_staff_id::text, p_is_test::text))
    );

    perform 1
    from public.staff
    where id = p_staff_id
    for update;
  end if;

  v_ip_text := nullif(trim(split_part(coalesce(p_ip_address, ''), ',', 1)), '');
  if v_ip_text is not null and v_ip_text ~ '^[0-9a-fA-F:.]+$' then
    begin
      v_ip_address := v_ip_text::inet;
    exception
      when invalid_text_representation then
        v_ip_address := null;
    end;
  end if;

  if p_is_test then
    v_metadata := v_metadata || jsonb_build_object('isTest', true);
  end if;

  if p_checkin_update is not null then
    if p_checkin_id is null then
      return query select false, 'checkin_required', null::uuid, null::uuid, null::uuid, null::jsonb, 'Attendance update requires a selected check-in.';
      return;
    end if;

    select checkin_row.*
      into v_existing_checkin
    from public.staff_shift_checkins as checkin_row
    where checkin_row.id = p_checkin_id
      and checkin_row.branch_id = p_branch_id
      and (p_staff_id is null or checkin_row.staff_id = p_staff_id)
    for update;

    if not found or v_existing_checkin.status <> 'checked_in' or v_existing_checkin.checked_out_at is not null then
      return query select false, 'checkin_not_open', null::uuid, p_checkin_id, null::uuid, null::jsonb, 'Attendance record is no longer open.';
      return;
    end if;

    update public.staff_shift_checkins
       set shift_instance_key = coalesce(nullif(p_checkin_update->>'shift_instance_key', ''), shift_instance_key),
           schedule_source = coalesce(nullif(p_checkin_update->>'schedule_source', ''), schedule_source),
           schedule_source_id = coalesce(nullif(p_checkin_update->>'schedule_source_id', ''), schedule_source_id),
           branch_timezone = coalesce(nullif(p_checkin_update->>'branch_timezone', ''), branch_timezone),
           attendance_business_date = coalesce(nullif(p_checkin_update->>'attendance_business_date', '')::date, attendance_business_date),
           checked_out_at = coalesce(nullif(p_checkin_update->>'checked_out_at', '')::timestamptz, checked_out_at),
           status = coalesce(nullif(p_checkin_update->>'status', ''), status),
           clock_out_method = coalesce(nullif(p_checkin_update->>'clock_out_method', ''), clock_out_method),
           worked_minutes = coalesce((p_checkin_update->>'worked_minutes')::integer, worked_minutes),
           late_minutes = coalesce((p_checkin_update->>'late_minutes')::integer, late_minutes),
           early_leave_minutes = coalesce((p_checkin_update->>'early_leave_minutes')::integer, early_leave_minutes),
           overtime_minutes = coalesce((p_checkin_update->>'overtime_minutes')::integer, overtime_minutes),
           attendance_status = coalesce(nullif(p_checkin_update->>'attendance_status', ''), attendance_status),
           exception_state = coalesce(nullif(p_checkin_update->>'exception_state', ''), exception_state),
           notes = coalesce(nullif(p_checkin_update->>'notes', ''), notes),
           updated_at = v_now
     where id = p_checkin_id
     returning id into v_checkin_id;
  end if;

  if p_checkin_insert is not null then
    v_shift_instance_key := nullif(p_checkin_insert->>'shift_instance_key', '');
    v_shift_date := nullif(p_checkin_insert->>'shift_date', '')::date;
    v_shift_type := coalesce(nullif(p_checkin_insert->>'shift_type', ''), 'single');

    if p_staff_id is null or v_shift_date is null then
      return query select false, 'invalid_checkin_insert', null::uuid, null::uuid, null::uuid, null::jsonb, 'Attendance insert is missing staff or shift date.';
      return;
    end if;

    if v_shift_instance_key is not null then
      select checkin_row.*
        into v_existing_checkin
      from public.staff_shift_checkins as checkin_row
      where checkin_row.staff_id = p_staff_id
        and checkin_row.branch_id = p_branch_id
        and checkin_row.is_test = p_is_test
        and checkin_row.status <> 'voided'
        and checkin_row.shift_instance_key = v_shift_instance_key
      limit 1
      for update;
    else
      select checkin_row.*
        into v_existing_checkin
      from public.staff_shift_checkins as checkin_row
      where checkin_row.staff_id = p_staff_id
        and checkin_row.branch_id = p_branch_id
        and checkin_row.is_test = p_is_test
        and checkin_row.status <> 'voided'
        and checkin_row.shift_date = v_shift_date
        and checkin_row.shift_type = v_shift_type
      limit 1
      for update;
    end if;

    if found then
      v_checkin_id := v_existing_checkin.id;
      p_action := 'duplicate_scan';
      p_outcome := 'noop';
      p_reason_code := coalesce(p_reason_code, 'already_checked_in');
      p_message := coalesce(p_message, 'Attendance already exists for this shift.');
      v_operation_result := jsonb_build_object(
        'ok', true,
        'outcome', 'noop',
        'severity', 'info',
        'title', case when v_existing_checkin.status = 'checked_out' then 'Already checked out' else 'Already clocked in' end,
        'message', p_message,
        'reasonCode', p_reason_code,
        'attendance', jsonb_build_object(
          'attendanceId', v_existing_checkin.id,
          'status', v_existing_checkin.status,
          'shiftDate', v_existing_checkin.shift_date,
          'shiftType', v_existing_checkin.shift_type
        )
      );
    else
      insert into public.staff_shift_checkins (
        branch_id,
        staff_id,
        shift_date,
        shift_type,
        shift_instance_key,
        checked_in_at,
        status,
        clock_in_method,
        scheduled_start_at,
        scheduled_end_at,
        schedule_source,
        schedule_source_id,
        branch_timezone,
        attendance_business_date,
        late_minutes,
        attendance_status,
        exception_state,
        is_test,
        notes
      )
      values (
        p_branch_id,
        p_staff_id,
        v_shift_date,
        v_shift_type,
        v_shift_instance_key,
        v_now,
        'checked_in',
        coalesce(nullif(p_checkin_insert->>'clock_in_method', ''), 'qr'),
        nullif(p_checkin_insert->>'scheduled_start_at', '')::timestamptz,
        nullif(p_checkin_insert->>'scheduled_end_at', '')::timestamptz,
        nullif(p_checkin_insert->>'schedule_source', ''),
        nullif(p_checkin_insert->>'schedule_source_id', ''),
        coalesce(nullif(p_checkin_insert->>'branch_timezone', ''), 'Asia/Manila'),
        nullif(p_checkin_insert->>'attendance_business_date', '')::date,
        coalesce((p_checkin_insert->>'late_minutes')::integer, 0),
        coalesce(nullif(p_checkin_insert->>'attendance_status', ''), 'present'),
        coalesce(nullif(p_checkin_insert->>'exception_state', ''), 'none'),
        p_is_test,
        nullif(p_checkin_insert->>'notes', '')
      )
      returning id into v_checkin_id;
    end if;
  end if;

  if v_existing_event.id is not null then
    update public.qr_scan_events
       set branch_id = p_branch_id,
           qr_point_id = p_qr_point_id,
           staff_id = p_staff_id,
           device_id = p_device_id,
           checkin_id = coalesce(v_checkin_id, p_checkin_id, qr_scan_events.checkin_id),
           scan_type = p_scan_type,
           action = p_action,
           outcome = p_outcome,
           reason_code = p_reason_code,
           message = p_message,
           user_agent = p_user_agent,
           ip_address = v_ip_address,
           metadata = v_metadata,
           is_test = p_is_test,
           operation_id = p_request_id
     where id = v_existing_event.id
     returning id into v_scan_event_id;
  else
    insert into public.qr_scan_events (
      branch_id,
      qr_point_id,
      staff_id,
      device_id,
      checkin_id,
      scan_type,
      action,
      outcome,
      reason_code,
      message,
      request_id,
      user_agent,
      ip_address,
      metadata,
      is_test,
      operation_id
    )
    values (
      p_branch_id,
      p_qr_point_id,
      p_staff_id,
      p_device_id,
      coalesce(v_checkin_id, p_checkin_id),
      p_scan_type,
      p_action,
      p_outcome,
      p_reason_code,
      p_message,
      p_request_id,
      p_user_agent,
      v_ip_address,
      v_metadata,
      p_is_test,
      p_request_id
    )
    returning id into v_scan_event_id;
  end if;

  if v_checkin_id is not null then
    if p_action = 'clock_in' then
      update public.staff_shift_checkins
         set clock_in_scan_event_id = coalesce(clock_in_scan_event_id, v_scan_event_id),
             updated_at = v_now
       where id = v_checkin_id;
    elsif p_action = 'clock_out' then
      update public.staff_shift_checkins
         set clock_out_scan_event_id = coalesce(clock_out_scan_event_id, v_scan_event_id),
             updated_at = v_now
       where id = v_checkin_id;
    end if;
  end if;

  if p_exception is not null then
    v_exception_dedupe_key := coalesce(
      nullif(p_exception->>'dedupe_key', ''),
      concat_ws('|', coalesce(p_staff_id::text, 'unknown_staff'), coalesce(v_checkin_id::text, 'no_checkin'), coalesce(nullif(p_exception->>'exception_type', ''), p_reason_code, 'manual'), case when p_is_test then 'test' else 'live' end)
    );
    v_exception_metadata := coalesce(p_exception->'metadata', '{}'::jsonb) || jsonb_build_object('dedupeKey', v_exception_dedupe_key);

    select exception_row.id,
           exception_row.related_checkin_ids
      into v_recovery_issue_id,
           v_exception_related_checkins
    from public.attendance_exceptions as exception_row
    where exception_row.branch_id = p_branch_id
      and exception_row.is_test = p_is_test
      and exception_row.status = 'open'
      and exception_row.dedupe_key = v_exception_dedupe_key
    limit 1
    for update;

    if v_recovery_issue_id is not null then
      if v_checkin_id is not null and not (v_checkin_id = any(coalesce(v_exception_related_checkins, '{}'::uuid[]))) then
        v_exception_related_checkins := array_append(coalesce(v_exception_related_checkins, '{}'::uuid[]), v_checkin_id);
      end if;

      update public.attendance_exceptions as attendance_exception
         set checkin_id = coalesce(v_checkin_id, attendance_exception.checkin_id),
             scan_event_id = v_scan_event_id,
             latest_scan_event_id = v_scan_event_id,
             severity = coalesce(nullif(p_exception->>'severity', ''), attendance_exception.severity),
             message = coalesce(nullif(p_exception->>'message', ''), attendance_exception.message),
             metadata = coalesce(attendance_exception.metadata, '{}'::jsonb) || v_exception_metadata,
             occurrence_count = greatest(1, attendance_exception.occurrence_count) + 1,
             detected_at = v_now,
             last_detected_at = v_now,
             related_checkin_ids = coalesce(v_exception_related_checkins, attendance_exception.related_checkin_ids),
             recommended_action = coalesce(nullif(p_exception->>'recommended_action', ''), attendance_exception.recommended_action),
             priority = coalesce(nullif(p_exception->>'priority', ''), attendance_exception.priority),
             updated_at = v_now
       where attendance_exception.id = v_recovery_issue_id;
    else
      insert into public.attendance_exceptions (
        branch_id,
        staff_id,
        checkin_id,
        scan_event_id,
        latest_scan_event_id,
        exception_type,
        severity,
        message,
        metadata,
        dedupe_key,
        occurrence_count,
        first_detected_at,
        last_detected_at,
        related_checkin_ids,
        recommended_action,
        priority,
        is_test
      )
      values (
        p_branch_id,
        p_staff_id,
        v_checkin_id,
        v_scan_event_id,
        v_scan_event_id,
        coalesce(nullif(p_exception->>'exception_type', ''), p_reason_code, 'manual'),
        coalesce(nullif(p_exception->>'severity', ''), 'warning'),
        coalesce(nullif(p_exception->>'message', ''), coalesce(p_message, 'Attendance scan needs review.')),
        v_exception_metadata,
        v_exception_dedupe_key,
        1,
        v_now,
        v_now,
        case when v_checkin_id is null then '{}'::uuid[] else array[v_checkin_id] end,
        nullif(p_exception->>'recommended_action', ''),
        coalesce(nullif(p_exception->>'priority', ''), 'normal'),
        p_is_test
      )
      returning id into v_recovery_issue_id;
    end if;
  end if;

  if p_device_id is not null then
    if p_device_scan_type = 'service' then
      update public.staff_devices
         set last_seen_at = v_now,
             last_service_scan_at = v_now,
             updated_at = v_now
       where id = p_device_id;
    elsif p_device_scan_type = 'attendance' then
      update public.staff_devices
         set last_seen_at = v_now,
             last_attendance_scan_at = v_now,
             updated_at = v_now
       where id = p_device_id;
    end if;
  end if;

  v_operation_result := v_operation_result || jsonb_build_object('scanEventId', v_scan_event_id::text);
  if v_checkin_id is not null and v_operation_result ? 'attendance' then
    v_operation_result := jsonb_set(v_operation_result, '{attendance,attendanceId}', to_jsonb(v_checkin_id::text), true);
  end if;

  update public.qr_scan_events
     set operation_id = coalesce(p_request_id, operation_id),
         operation_result = v_operation_result,
         operation_result_recorded_at = v_now
   where id = v_scan_event_id;

  return query select true, 'committed', v_scan_event_id, v_checkin_id, v_recovery_issue_id, v_operation_result, 'Attendance scan committed.';
end;
$$;

revoke all on function public.commit_attendance_scan_transaction(
  text, uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, jsonb, boolean, jsonb, uuid, jsonb, jsonb, jsonb, text
) from public, anon, authenticated;

grant execute on function public.commit_attendance_scan_transaction(
  text, uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, jsonb, boolean, jsonb, uuid, jsonb, jsonb, jsonb, text
) to service_role;

