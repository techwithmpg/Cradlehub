-- LOCAL-only attendance dependency slice. Run after the reviewed staff/duty/
-- schedule fixtures and staff TEST privilege overlay. Source-backed projections
-- below are limited to the final branch resolver's input fields; they do not
-- represent complete checkin, correction, or transfer contracts.

-- Accepted helper, 20260429000003_helper_functions.sql. The prior staff
-- fixture needed only role and branch helpers.
create or replace function public.get_auth_staff_id()
returns uuid language sql stable security definer set search_path=public as $$
  select id from public.staff where auth_user_id=(select auth.uid())
    and is_active=true limit 1;
$$;
grant execute on function public.get_auth_staff_id() to anon,authenticated,service_role;

-- The current staff fixture seeded one device before the final registry fields.
alter table public.staff_devices alter column id set default gen_random_uuid();
alter table public.staff_devices
  add column device_fingerprint_hash text,
  add column device_label text,
  add column trusted_after timestamptz not null default now(),
  add column last_seen_at timestamptz,
  add column revoked_at timestamptz,
  add column revoked_by uuid references public.staff(id) on delete set null,
  add column registration_source text not null default 'first_scan_activation',
  add column browser_name text,
  add column browser_version text,
  add column platform_name text,
  add column last_attendance_scan_at timestamptz,
  add column last_service_scan_at timestamptz,
  add column revocation_reason text,
  add column device_role text not null default 'primary',
  add column superseded_by_device_id uuid references public.staff_devices(id) on delete set null,
  add column security_state text not null default 'clear',
  add column replacement_confirmed_at timestamptz,
  add column replacement_confirmed_by uuid references public.staff(id) on delete set null,
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();
update public.staff_devices set device_fingerprint_hash = 'synthetic-seeded-device-hash'
  where id = '00000000-0000-0000-0000-000000000401';
update public.staff_devices set device_fingerprint_hash = 'synthetic-seeded-device-hash-' || id::text
  where device_fingerprint_hash is null;
alter table public.staff_devices alter column device_fingerprint_hash set not null;
alter table public.staff_devices add constraint staff_devices_device_fingerprint_hash_key unique(device_fingerprint_hash);
alter table public.staff_devices add constraint staff_devices_status_check
  check(status in ('active','revoked','expired','lost','stolen','security_blocked'));
alter table public.staff_devices add constraint staff_devices_device_role_check
  check(device_role in ('primary','secondary','replacement_pending'));
alter table public.staff_devices add constraint staff_devices_security_state_check
  check(security_state in ('clear','lost','stolen','suspicious','blocked'));
alter table public.staff_devices add constraint staff_devices_registration_source_check
  check(registration_source in ('first_scan_activation','device_recovery','crm_assisted_activation'));
alter table public.staff_devices add constraint staff_devices_device_label_length_check
  check(device_label is null or char_length(device_label)<=60);
alter table public.staff_devices add constraint staff_devices_revocation_reason_check
  check(revocation_reason is null or revocation_reason in
    ('lost_phone','replacement_phone','shared_device','security_concern',
     'staff_request','browser_reset','other'));
create unique index staff_devices_one_active_primary_idx on public.staff_devices(staff_id)
  where status='active' and device_role='primary';
create index staff_devices_staff_policy_idx on public.staff_devices(staff_id,status,device_role,security_state);
create index staff_devices_staff_status_idx on public.staff_devices(staff_id,status);
create index staff_devices_branch_status_idx on public.staff_devices(branch_id,status);
create index staff_devices_last_seen_idx on public.staff_devices(last_seen_at desc);
create trigger trg_staff_devices_updated_at before update on public.staff_devices
  for each row execute function public.fn_update_updated_at();

-- Accepted QR device grants and select policies, 20260702075213.
revoke all on public.staff_devices from public,anon,authenticated;
grant select on public.staff_devices to authenticated;
grant select,insert,update,delete on public.staff_devices to service_role;
create policy staff_devices_owner_select on public.staff_devices for select to authenticated
  using ((select public.get_auth_role())='owner');
create policy staff_devices_branch_select on public.staff_devices for select to authenticated
  using ((select public.get_auth_role()) in
    ('manager','assistant_manager','store_manager','crm','csr','csr_head','csr_staff')
    and branch_id=(select public.get_auth_branch_id()));
create policy staff_devices_staff_select_own on public.staff_devices for select to authenticated
  using (staff_id=(select public.get_auth_staff_id()));

-- Accepted source 20260429000001 + 20260703022600 + 20260713082146.
create table public.schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  override_date date not null,
  start_time time,
  end_time time,
  is_day_off boolean not null default false,
  reason text,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  shift_type text check(shift_type is null or shift_type in ('single','opening','closing')),
  ends_next_day boolean not null default false,
  constraint schedule_overrides_time_check check (
    is_day_off=true or (start_time is not null and end_time is not null
      and start_time<>end_time and
      ((ends_next_day=false and end_time>start_time)
       or (ends_next_day=true and end_time<start_time)))),
  unique(staff_id,override_date)
);
alter table public.schedule_overrides enable row level security;
revoke all on public.staff_schedules,public.schedule_overrides from public,anon,authenticated;
grant select,insert,update,delete on public.staff_schedules,public.schedule_overrides to authenticated,service_role;
create policy staff_schedules_read_own on public.staff_schedules for select to authenticated
  using(staff_id=public.get_auth_staff_id());
create policy staff_schedules_owner_all on public.staff_schedules for all to authenticated
  using(public.get_auth_role()='owner') with check(public.get_auth_role()='owner');
create policy staff_schedules_operational_read on public.staff_schedules for select to authenticated
  using(public.get_auth_role() in ('manager','assistant_manager','store_manager','crm','csr_head','csr_staff','csr')
    and staff_id in(select id from public.staff where branch_id=public.get_auth_branch_id()));
create policy staff_schedules_operational_insert on public.staff_schedules for insert to authenticated
  with check(public.get_auth_role() in ('manager','assistant_manager','store_manager','crm','csr_head','csr_staff','csr')
    and staff_id in(select id from public.staff where branch_id=public.get_auth_branch_id()));
create policy staff_schedules_operational_update on public.staff_schedules for update to authenticated
  using(public.get_auth_role() in ('manager','assistant_manager','store_manager','crm','csr_head','csr_staff','csr')
    and staff_id in(select id from public.staff where branch_id=public.get_auth_branch_id()))
  with check(public.get_auth_role() in ('manager','assistant_manager','store_manager','crm','csr_head','csr_staff','csr')
    and staff_id in(select id from public.staff where branch_id=public.get_auth_branch_id()));
create policy schedule_overrides_read_own on public.schedule_overrides for select to authenticated
  using(staff_id=public.get_auth_staff_id());
create policy schedule_overrides_owner_all on public.schedule_overrides for all to authenticated
  using(public.get_auth_role()='owner') with check(public.get_auth_role()='owner');
create policy schedule_overrides_operational_all on public.schedule_overrides for all to authenticated
  using(public.get_auth_role() in ('manager','assistant_manager','store_manager','crm','csr_head','csr_staff','csr')
    and staff_id in(select id from public.staff where branch_id=public.get_auth_branch_id()))
  with check(public.get_auth_role() in ('manager','assistant_manager','store_manager','crm','csr_head','csr_staff','csr')
    and staff_id in(select id from public.staff where branch_id=public.get_auth_branch_id()));

-- Exact resolver input fields from 20260714143000, 20260715113000,
-- 20260715113002, and 20260821034409. Optional FKs to QR/correction records
-- await their separate dependency slices; no synthetic behavior is inserted.
create table public.staff_attendance_branch_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  assignment_date date not null,
  assignment_type text not null default 'temporary'
    check(assignment_type in ('temporary','approved_cross_branch')),
  status text not null default 'approved' check(status in ('approved','revoked')),
  reason text,
  approved_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  valid_from timestamptz,
  valid_until timestamptz,
  attendance_business_date date,
  scope text check(scope is null or scope in ('shift','business_day','date_range')),
  is_test boolean not null default false,
  revoked_at timestamptz,
  revocation_reason text,
  check(valid_from is null or valid_until is null or valid_until>valid_from)
);
create unique index staff_attendance_branch_assignments_one_active_type
  on public.staff_attendance_branch_assignments(staff_id,assignment_date,assignment_type)
  where status='approved';
alter table public.staff_attendance_branch_assignments enable row level security;
create policy "attendance branch assignments branch staff read"
  on public.staff_attendance_branch_assignments for select to authenticated
  using(branch_id=public.get_auth_branch_id() or staff_id=public.get_auth_staff_id());
create policy "attendance branch assignments management read"
  on public.staff_attendance_branch_assignments for select to authenticated
  using((select public.get_auth_role()) in
    ('owner','manager','assistant_manager','store_manager'));
revoke all on public.staff_attendance_branch_assignments from public,anon,authenticated;
grant select on public.staff_attendance_branch_assignments to authenticated;
grant select,insert,update,delete on public.staff_attendance_branch_assignments to service_role;

create table public.staff_shift_checkins (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  shift_date date not null,
  shift_type text not null default 'single' check(shift_type in ('single','opening','closing')),
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  status text not null default 'checked_in' check(status in ('checked_in','checked_out','voided')),
  is_test boolean not null default false,
  branch_authorization_id uuid references public.staff_attendance_branch_assignments(id) on delete set null,
  unique(staff_id,shift_date,shift_type)
);
alter table public.staff_shift_checkins enable row level security;
revoke all on public.staff_shift_checkins from public,anon,authenticated;
grant select,insert,update,delete on public.staff_shift_checkins to service_role;
alter table public.staff_attendance_branch_assignments
  add column consumed_checkin_id uuid references public.staff_shift_checkins(id) on delete set null;

create table public.staff_permanent_branch_transfers (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete restrict,
  previous_branch_id uuid references public.branches(id) on delete set null,
  new_branch_id uuid not null references public.branches(id) on delete restrict,
  effective_date date not null,
  status text not null default 'scheduled' check(status in ('scheduled','effective','cancelled')),
  created_at timestamptz not null default now()
);
alter table public.staff_permanent_branch_transfers enable row level security;
revoke all on public.staff_permanent_branch_transfers from public,anon,authenticated;
create policy "staff permanent branch transfers management read"
  on public.staff_permanent_branch_transfers for select to authenticated
  using ((select public.get_auth_role()) in
    ('owner','manager','assistant_manager','store_manager','crm','csr','csr_head','csr_staff')
    or staff_id=(select public.get_auth_staff_id()));
grant select on public.staff_permanent_branch_transfers to authenticated;
grant select,insert,update,delete on public.staff_permanent_branch_transfers to service_role;

-- The exact final two resolver overloads and their EXECUTE ACLs are appended
-- verbatim from the reviewed 20260821034409 source (lines 442-645).
create table if not exists public.attendance_device_audit_events (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  staff_id uuid not null references public.staff(id) on delete restrict,
  device_id uuid not null references public.staff_devices(id) on delete restrict,
  event_type text not null,
  actor_staff_id uuid references public.staff(id) on delete set null,
  previous_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists attendance_device_audit_events_device_created_idx
  on public.attendance_device_audit_events (device_id, created_at desc);
create index if not exists attendance_device_audit_events_branch_created_idx
  on public.attendance_device_audit_events (branch_id, created_at desc);

alter table public.attendance_device_audit_events enable row level security;
drop policy if exists "attendance device audit branch read" on public.attendance_device_audit_events;
create policy "attendance device audit branch read"
  on public.attendance_device_audit_events for select to authenticated
  using (public.get_auth_role() = 'owner' or branch_id = public.get_auth_branch_id());
revoke all on public.attendance_device_audit_events from anon;
grant select on public.attendance_device_audit_events to authenticated;
grant all on public.attendance_device_audit_events to service_role;

create or replace function public.audit_attendance_device_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_event_type text;
  v_actor_staff_id uuid;
begin
  if tg_op = 'INSERT' then
    v_event_type := 'registered';
  elsif old.status is distinct from new.status then
    v_event_type := case
      when new.status = 'active' then 'reconnected'
      when new.status = 'revoked' then 'revoked'
      when new.status = 'security_blocked' then 'security_blocked'
      else 'status_changed'
    end;
  elsif old.superseded_by_device_id is distinct from new.superseded_by_device_id
     or old.replacement_confirmed_at is distinct from new.replacement_confirmed_at then
    v_event_type := 'replaced';
  elsif old.branch_id is distinct from new.branch_id then
    v_event_type := 'last_used_branch_changed';
  else
    return new;
  end if;

  v_actor_staff_id := coalesce(new.revoked_by, new.replacement_confirmed_by);
  insert into public.attendance_device_audit_events (
    branch_id, staff_id, device_id, event_type, actor_staff_id, previous_values, new_values
  ) values (
    new.branch_id,
    new.staff_id,
    new.id,
    v_event_type,
    v_actor_staff_id,
    case when tg_op = 'INSERT' then '{}'::jsonb else jsonb_build_object(
      'branchId', old.branch_id, 'status', old.status,
      'supersededByDeviceId', old.superseded_by_device_id
    ) end,
    jsonb_build_object(
      'branchId', new.branch_id, 'status', new.status,
      'supersededByDeviceId', new.superseded_by_device_id,
      'registrationSource', new.registration_source
    )
  );
  return new;
end;
$$;

drop trigger if exists staff_devices_attendance_lifecycle_audit on public.staff_devices;
create trigger staff_devices_attendance_lifecycle_audit
  after insert or update on public.staff_devices
  for each row execute function public.audit_attendance_device_lifecycle();

create or replace function public.resolve_effective_attendance_branch(
  p_staff_id uuid,
  p_qr_branch_id uuid,
  p_attendance_date date,
  p_is_test boolean
)
returns table (
  allowed boolean,
  effective_branch_id uuid,
  source text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff%rowtype;
  v_effective_branch_id uuid;
  v_source text;
  v_duty_branch_count integer := 0;
begin
  if p_staff_id is null or p_qr_branch_id is null or p_attendance_date is null then
    return query select false, null::uuid, 'review'::text;
    return;
  end if;

  if not exists (
    select 1 from public.branches as branch_row
    where branch_row.id = p_qr_branch_id and branch_row.is_active is true
  ) then
    return query select false, null::uuid, 'inactive_branch'::text;
    return;
  end if;

  select staff_row.* into v_staff
  from public.staff as staff_row
  where staff_row.id = p_staff_id
  for share;

  if not found
     or v_staff.is_active is not true
     or v_staff.archived_at is not null
     or v_staff.merged_into_staff_id is not null then
    return query select false, null::uuid, 'inactive_staff'::text;
    return;
  end if;

  select assignment.branch_id,
         case
           when assignment.scope = 'shift' then 'temporary_branch_access_shift'
           when assignment.scope = 'business_day' then 'temporary_branch_access_day'
           else assignment.assignment_type
         end
    into v_effective_branch_id, v_source
  from public.staff_attendance_branch_assignments as assignment
  where assignment.staff_id = p_staff_id
    and assignment.branch_id = p_qr_branch_id
    and assignment.status = 'approved'
    and assignment.assignment_type = 'temporary'
    and assignment.is_test = coalesce(p_is_test, false)
    and (assignment.valid_from is null or assignment.valid_from <= now())
    and (assignment.valid_until is null or assignment.valid_until > now())
    and (
      (
        coalesce(assignment.scope, 'business_day') = 'business_day'
        and coalesce(assignment.attendance_business_date, assignment.assignment_date)
          = p_attendance_date
      )
      or (
        assignment.scope = 'shift'
        and (
          coalesce(assignment.attendance_business_date, assignment.assignment_date)
            = p_attendance_date
          or exists (
            select 1
            from public.staff_shift_checkins as checkin_row
            where checkin_row.branch_authorization_id = assignment.id
              and checkin_row.staff_id = assignment.staff_id
              and checkin_row.branch_id = assignment.branch_id
              and checkin_row.is_test = assignment.is_test
              and checkin_row.status = 'checked_in'
              and checkin_row.checked_out_at is null
          )
        )
      )
    )
  order by
    case assignment.scope when 'shift' then 0 when 'business_day' then 1 else 2 end,
    assignment.created_at desc,
    assignment.id
  limit 1;

  if v_effective_branch_id is null then
    select count(distinct duty.branch_id)::integer
      into v_duty_branch_count
    from public.staff_duty_assignments as duty
    where duty.staff_id = p_staff_id
      and duty.day_of_week = extract(dow from p_attendance_date)::integer
      and duty.is_active is true;

    if v_duty_branch_count > 1 then
      return query select false, null::uuid, 'duty_assignment_conflict'::text;
      return;
    end if;

    select duty.branch_id, 'schedule_assignment'
      into v_effective_branch_id, v_source
    from public.staff_duty_assignments as duty
    where duty.staff_id = p_staff_id
      and duty.branch_id = p_qr_branch_id
      and duty.day_of_week = extract(dow from p_attendance_date)::integer
      and duty.is_active is true
    order by duty.created_at desc, duty.id
    limit 1;

    if v_effective_branch_id is null and v_duty_branch_count = 1 then
      select duty.branch_id, 'schedule_assignment'
        into v_effective_branch_id, v_source
      from public.staff_duty_assignments as duty
      where duty.staff_id = p_staff_id
        and duty.day_of_week = extract(dow from p_attendance_date)::integer
        and duty.is_active is true
      order by duty.created_at desc, duty.id
      limit 1;
    end if;
  end if;

  if v_effective_branch_id is null then
    select assignment.branch_id, assignment.assignment_type
      into v_effective_branch_id, v_source
    from public.staff_attendance_branch_assignments as assignment
    where assignment.staff_id = p_staff_id
      and assignment.branch_id = p_qr_branch_id
      and assignment.assignment_date = p_attendance_date
      and assignment.status = 'approved'
      and assignment.assignment_type = 'approved_cross_branch'
      and assignment.is_test = coalesce(p_is_test, false)
      and (assignment.valid_from is null or assignment.valid_from <= now())
      and (assignment.valid_until is null or assignment.valid_until > now())
    order by assignment.created_at desc, assignment.id
    limit 1;
  end if;

  if v_effective_branch_id is null and v_staff.is_cross_branch is true then
    v_effective_branch_id := p_qr_branch_id;
    v_source := 'approved_cross_branch';
  end if;

  if v_effective_branch_id is null then
    select transfer_row.new_branch_id, 'effective_permanent_transfer'
      into v_effective_branch_id, v_source
    from public.staff_permanent_branch_transfers as transfer_row
    where transfer_row.staff_id = p_staff_id
      and transfer_row.status in ('scheduled', 'effective')
      and transfer_row.effective_date <= p_attendance_date
    order by transfer_row.effective_date desc, transfer_row.created_at desc
    limit 1;
  end if;


  if v_effective_branch_id is null then
    v_effective_branch_id := v_staff.branch_id;
    v_source := 'home_branch';
  end if;

  return query select
    v_effective_branch_id = p_qr_branch_id,
    v_effective_branch_id,
    coalesce(v_source, 'review');
end;
$$;

create or replace function public.resolve_effective_attendance_branch(
  p_staff_id uuid,
  p_qr_branch_id uuid,
  p_attendance_date date
)
returns table (
  allowed boolean,
  effective_branch_id uuid,
  source text
)
language sql
security definer
set search_path = public
as $$
  select *
  from public.resolve_effective_attendance_branch(
    p_staff_id,
    p_qr_branch_id,
    p_attendance_date,
    false
  );
$$;

revoke all on function public.resolve_effective_attendance_branch(uuid, uuid, date, boolean)
  from public, anon, authenticated;
grant execute on function public.resolve_effective_attendance_branch(uuid, uuid, date, boolean)
  to service_role;

revoke all on function public.resolve_effective_attendance_branch(uuid, uuid, date)
  from public, anon, authenticated;
grant execute on function public.resolve_effective_attendance_branch(uuid, uuid, date)
  to service_role;

-- Accepted activation-token table 20260702075213, with registry/recovery
-- additions from 20260703151111. The request RPCs below own consumption.
create table public.device_activation_tokens (
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
  purpose text not null default 'first_scan_activation'
    check(purpose in ('first_scan_activation','device_recovery','crm_assisted_activation')),
  reason text check(reason is null or reason in
    ('browser_data_cleared','replacement_phone','lost_phone','device_cookie_expired',
     'support_recovery','security_concern','other')),
  revoked_at timestamptz,
  revoked_by uuid references public.staff(id) on delete set null,
  revoke_previous_device_id uuid references public.staff_devices(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint device_activation_tokens_not_expired_on_create check(expires_at>created_at)
);
alter table public.device_activation_tokens enable row level security;
revoke all on public.device_activation_tokens from public,anon,authenticated;
grant select,insert,update,delete on public.device_activation_tokens to service_role;
create trigger trg_device_activation_tokens_updated_at before update on public.device_activation_tokens
  for each row execute function public.fn_update_updated_at();

-- The accepted 20260714050554 request table, policies, and review/complete
-- RPCs are appended verbatim (lines 4-354). These server-only RPCs are the
-- registration authorization contract for this slice.
create table if not exists public.staff_device_registration_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  request_type text not null default 'new_phone'
    check (request_type in ('new_phone', 'replacement')),
  device_fingerprint_hash text not null,
  device_label text,
  browser_name text,
  platform_name text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'completed', 'cancelled', 'expired')),
  existing_device_id uuid references public.staff_devices(id) on delete set null,
  replacement_device_id uuid references public.staff_devices(id) on delete set null,
  completed_device_id uuid references public.staff_devices(id) on delete set null,
  activation_token_id uuid references public.device_activation_tokens(id) on delete set null,
  registration_method text not null default 'portal_request'
    check (registration_method in ('portal_request', 'first_scan_auto', 'crm_recovery')),
  requested_at timestamptz not null default now(),
  reviewed_by_staff_id uuid references public.staff(id) on delete set null,
  reviewed_at timestamptz,
  reviewer_note text,
  rejection_reason text,
  expires_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint staff_device_registration_requests_label_length
    check (device_label is null or char_length(device_label) <= 60),
  constraint staff_device_registration_requests_rejection_reason
    check (
      rejection_reason is null or rejection_reason in (
        'unable_to_verify_request',
        'device_limit_reached',
        'shared_phone_not_permitted',
        'staff_account_inactive',
        'security_concern',
        'other'
      )
    )
);

comment on table public.staff_device_registration_requests is
  'Audited staff-initiated attendance phone registration and replacement requests. Only a credential hash is stored.';
comment on column public.staff_device_registration_requests.device_fingerprint_hash is
  'Peppered hash of the HttpOnly same-phone credential. Never stores the raw browser credential.';

drop trigger if exists trg_staff_device_registration_requests_updated_at
  on public.staff_device_registration_requests;
create trigger trg_staff_device_registration_requests_updated_at
  before update on public.staff_device_registration_requests
  for each row execute function public.fn_update_updated_at();

create index if not exists staff_device_registration_requests_branch_status_idx
  on public.staff_device_registration_requests(branch_id, status, requested_at desc);
create index if not exists staff_device_registration_requests_staff_idx
  on public.staff_device_registration_requests(staff_id, requested_at desc);
create unique index if not exists staff_device_registration_requests_open_phone_idx
  on public.staff_device_registration_requests(staff_id, device_fingerprint_hash)
  where status in ('pending', 'approved');

alter table public.staff_device_registration_requests enable row level security;

drop policy if exists "staff_device_registration_requests_select_own"
  on public.staff_device_registration_requests;
create policy "staff_device_registration_requests_select_own"
  on public.staff_device_registration_requests for select to authenticated
  using (staff_id = (select public.get_auth_staff_id()));

drop policy if exists "staff_device_registration_requests_select_owner"
  on public.staff_device_registration_requests;
create policy "staff_device_registration_requests_select_owner"
  on public.staff_device_registration_requests for select to authenticated
  using ((select public.get_auth_role()) = 'owner');

drop policy if exists "staff_device_registration_requests_select_branch_crm"
  on public.staff_device_registration_requests;
create policy "staff_device_registration_requests_select_branch_crm"
  on public.staff_device_registration_requests for select to authenticated
  using (
    (select public.get_auth_role()) in (
      'manager', 'assistant_manager', 'store_manager', 'crm', 'csr', 'csr_head', 'csr_staff'
    )
    and branch_id = (select public.get_auth_branch_id())
  );

revoke all on table public.staff_device_registration_requests from anon;
revoke all on table public.staff_device_registration_requests from authenticated;
grant select on table public.staff_device_registration_requests to authenticated;
grant select, insert, update, delete on table public.staff_device_registration_requests to service_role;

create or replace function public.review_staff_device_registration_request(
  p_request_id uuid,
  p_review_status text,
  p_reviewer_auth_user_id uuid,
  p_reviewer_staff_id uuid,
  p_reviewer_note text default null,
  p_rejection_reason text default null,
  p_replacement_device_id uuid default null,
  p_token_hash text default null,
  p_token_expires_at timestamptz default null,
  p_active_device_limit integer default 2
)
returns table (
  request_id uuid,
  request_status text,
  staff_id uuid,
  branch_id uuid,
  activation_token_id uuid,
  expires_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_request public.staff_device_registration_requests%rowtype;
  v_reviewer public.staff%rowtype;
  v_target public.staff%rowtype;
  v_replacement public.staff_devices%rowtype;
  v_token_id uuid;
  v_now timestamptz := now();
  v_active_count integer;
begin
  if p_review_status not in ('approved', 'rejected') then
    raise exception 'device_request_invalid_review_status' using errcode = '22023';
  end if;

  select * into v_reviewer from public.staff
  where id = p_reviewer_staff_id
    and auth_user_id = p_reviewer_auth_user_id
    and is_active = true
    and archived_at is null
    and merged_into_staff_id is null;
  if not found then
    raise exception 'device_request_reviewer_not_found' using errcode = '28000';
  end if;

  select * into v_request from public.staff_device_registration_requests
  where id = p_request_id for update;
  if not found then
    raise exception 'device_request_not_found' using errcode = 'P0002';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'device_request_not_pending' using errcode = 'P0001';
  end if;
  if v_reviewer.system_role <> 'owner'
    and not (
      v_reviewer.system_role in ('manager', 'assistant_manager', 'store_manager', 'crm', 'csr', 'csr_head', 'csr_staff')
      and v_reviewer.branch_id = v_request.branch_id
    )
  then
    raise exception 'device_request_not_authorized' using errcode = '42501';
  end if;

  select * into v_target from public.staff where id = v_request.staff_id for update;
  if not found or not v_target.is_active or v_target.archived_at is not null
    or v_target.merged_into_staff_id is not null
  then
    raise exception 'device_request_staff_inactive' using errcode = 'P0001';
  end if;
  if v_target.branch_id <> v_request.branch_id then
    raise exception 'device_request_branch_changed' using errcode = 'P0001';
  end if;

  if p_review_status = 'rejected' then
    if p_rejection_reason not in (
      'unable_to_verify_request', 'device_limit_reached', 'shared_phone_not_permitted',
      'staff_account_inactive', 'security_concern', 'other'
    ) then
      raise exception 'device_request_rejection_reason_required' using errcode = '22023';
    end if;
    update public.staff_device_registration_requests
       set status = 'rejected', reviewed_by_staff_id = p_reviewer_staff_id,
           reviewed_at = v_now, reviewer_note = nullif(trim(p_reviewer_note), ''),
           rejection_reason = p_rejection_reason, expires_at = null
     where id = v_request.id;
  else
    if nullif(trim(coalesce(p_token_hash, '')), '') is null
      or p_token_expires_at is null or p_token_expires_at <= v_now
    then
      raise exception 'device_request_activation_token_required' using errcode = '22023';
    end if;

    select count(*) into v_active_count from public.staff_devices as sd
      where sd.staff_id = v_request.staff_id and sd.status = 'active';

    if v_request.request_type = 'replacement' then
      select * into v_replacement from public.staff_devices as sd
      where sd.id = p_replacement_device_id and sd.staff_id = v_request.staff_id
        and sd.branch_id = v_request.branch_id and sd.status = 'active' for update;
      if not found then
        raise exception 'device_request_replacement_required' using errcode = '22023';
      end if;
    elsif v_active_count >= greatest(coalesce(p_active_device_limit, 2), 1) then
      raise exception 'device_request_limit_reached' using errcode = 'P0001';
    end if;

    insert into public.device_activation_tokens (
      staff_id, branch_id, token_hash, expires_at, requested_by, purpose, reason,
      revoke_previous_device_id, metadata
    ) values (
      v_request.staff_id, v_request.branch_id, p_token_hash, p_token_expires_at,
      p_reviewer_staff_id, 'crm_assisted_activation',
      case when v_request.request_type = 'replacement' then 'replacement_phone' else 'support_recovery' end,
      case when v_request.request_type = 'replacement' then p_replacement_device_id else null end,
      jsonb_build_object('source', 'staff_portal_device_request', 'request_id', v_request.id)
    ) returning id into v_token_id;

    update public.staff_device_registration_requests
       set status = 'approved', reviewed_by_staff_id = p_reviewer_staff_id,
           reviewed_at = v_now, reviewer_note = nullif(trim(p_reviewer_note), ''),
           rejection_reason = null, replacement_device_id = p_replacement_device_id,
           activation_token_id = v_token_id, expires_at = p_token_expires_at
     where id = v_request.id;
  end if;

  return query select v_request.id, p_review_status, v_request.staff_id,
    v_request.branch_id, v_token_id,
    case when p_review_status = 'approved' then p_token_expires_at else null end;
end;
$$;

create or replace function public.complete_staff_device_registration_request(
  p_request_id uuid,
  p_staff_id uuid,
  p_device_fingerprint_hash text,
  p_device_label text default null,
  p_user_agent text default null,
  p_browser_name text default null,
  p_browser_version text default null,
  p_platform_name text default null,
  p_active_device_limit integer default 2
)
returns table (success boolean, code text, device_id uuid, request_status text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_request public.staff_device_registration_requests%rowtype;
  v_token public.device_activation_tokens%rowtype;
  v_staff public.staff%rowtype;
  v_replacement public.staff_devices%rowtype;
  v_device_id uuid;
  v_device_role text;
  v_active_count integer;
  v_now timestamptz := now();
begin
  select * into v_request from public.staff_device_registration_requests
  where id = p_request_id for update;
  if not found or v_request.staff_id <> p_staff_id
    or v_request.device_fingerprint_hash <> p_device_fingerprint_hash
  then
    return query select false, 'request_not_available', null::uuid, coalesce(v_request.status, 'missing');
    return;
  end if;
  if v_request.status = 'completed' and v_request.completed_device_id is not null then
    return query select true, 'already_completed', v_request.completed_device_id, v_request.status;
    return;
  end if;
  if v_request.status <> 'approved' then
    return query select false, 'request_not_approved', null::uuid, v_request.status;
    return;
  end if;
  if v_request.expires_at is null or v_request.expires_at <= v_now then
    update public.staff_device_registration_requests set status = 'expired' where id = v_request.id;
    return query select false, 'approval_expired', null::uuid, 'expired';
    return;
  end if;

  select * into v_token from public.device_activation_tokens
  where id = v_request.activation_token_id for update;
  if not found or v_token.used_at is not null or v_token.revoked_at is not null or v_token.expires_at <= v_now then
    return query select false, 'activation_unavailable', null::uuid, v_request.status;
    return;
  end if;

  select * into v_staff from public.staff where id = p_staff_id for update;
  if not found or not v_staff.is_active or v_staff.archived_at is not null
    or v_staff.merged_into_staff_id is not null or v_staff.branch_id <> v_request.branch_id
  then
    return query select false, 'staff_inactive', null::uuid, v_request.status;
    return;
  end if;

  select count(*) into v_active_count from public.staff_devices
    where staff_id = p_staff_id and status = 'active';

  if v_request.request_type = 'replacement' then
    select * into v_replacement from public.staff_devices
      where id = v_request.replacement_device_id and staff_id = p_staff_id and status = 'active'
      for update;
    if not found then
      return query select false, 'replacement_unavailable', null::uuid, v_request.status;
      return;
    end if;
    v_device_role := v_replacement.device_role;
    update public.staff_devices
      set status = 'revoked', revoked_at = v_now, revoked_by = v_request.reviewed_by_staff_id,
          revocation_reason = 'replacement_phone', updated_at = v_now
      where id = v_replacement.id;
  else
    if v_active_count >= greatest(coalesce(p_active_device_limit, 2), 1) then
      return query select false, 'device_limit_reached', null::uuid, v_request.status;
      return;
    end if;
    select case when exists (
      select 1 from public.staff_devices
      where staff_id = p_staff_id and status = 'active' and device_role = 'primary'
    ) then 'secondary' else 'primary' end into v_device_role;
  end if;

  insert into public.staff_devices (
    staff_id, branch_id, device_fingerprint_hash, device_label, status, device_role,
    registration_source, browser_name, browser_version, platform_name, last_seen_at, metadata
  ) values (
    p_staff_id, v_request.branch_id, p_device_fingerprint_hash,
    left(nullif(trim(p_device_label), ''), 60), 'active', v_device_role,
    'crm_assisted_activation', p_browser_name, p_browser_version, p_platform_name, v_now,
    jsonb_build_object('source', 'staff_portal_device_request', 'request_id', v_request.id,
      'user_agent', p_user_agent)
  ) returning id into v_device_id;

  if v_request.request_type = 'replacement' then
    update public.staff_devices set superseded_by_device_id = v_device_id,
      replacement_confirmed_at = v_now, replacement_confirmed_by = v_request.reviewed_by_staff_id
      where id = v_replacement.id;
  end if;
  update public.device_activation_tokens set used_at = v_now, updated_at = v_now where id = v_token.id;
  update public.staff_device_registration_requests
    set status = 'completed', completed_device_id = v_device_id, completed_at = v_now
    where id = v_request.id;

  return query select true, 'completed', v_device_id, 'completed';
end;
$$;

revoke all on function public.review_staff_device_registration_request(
  uuid, text, uuid, uuid, text, text, uuid, text, timestamptz, integer
) from public, anon, authenticated;
revoke all on function public.complete_staff_device_registration_request(
  uuid, uuid, text, text, text, text, text, text, integer
) from public, anon, authenticated;
grant execute on function public.review_staff_device_registration_request(
  uuid, text, uuid, uuid, text, text, uuid, text, timestamptz, integer
) to service_role;
grant execute on function public.complete_staff_device_registration_request(
  uuid, uuid, text, text, text, text, text, text, integer
) to service_role;

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

create or replace function public.expire_shift_branch_authorization_on_clock_out()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.checked_out_at is not null and new.branch_authorization_id is not null then
    update public.staff_attendance_branch_assignments
       set status = 'revoked',
           revoked_at = coalesce(revoked_at, now()),
           revocation_reason = coalesce(revocation_reason, 'Attendance shift closed.'),
           consumed_checkin_id = coalesce(consumed_checkin_id, new.id),
           updated_at = now()
     where id = new.branch_authorization_id
       and scope = 'shift'
       and status = 'approved';
  end if;
  return new;
end;
$$;

drop trigger if exists staff_shift_checkins_expire_branch_authorization
  on public.staff_shift_checkins;
create trigger staff_shift_checkins_expire_branch_authorization
  after update of checked_out_at, status on public.staff_shift_checkins
  for each row
  when (new.checked_out_at is not null)
  execute function public.expire_shift_branch_authorization_on_clock_out();
