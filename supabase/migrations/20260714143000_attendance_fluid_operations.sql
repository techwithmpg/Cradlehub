-- Attendance fluid operations
--
-- Adds date-scoped branch authority, database-enforced single-open semantics,
-- correction-to-exception traceability, and device last-used branch metadata.
-- Existing conflicting open rows are preserved as evidence; the guard prevents
-- new conflicts and the application routes existing conflicts to review.

create table if not exists public.staff_attendance_branch_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  assignment_date date not null,
  assignment_type text not null default 'temporary'
    check (assignment_type in ('temporary', 'approved_cross_branch')),
  status text not null default 'approved'
    check (status in ('approved', 'revoked')),
  reason text,
  approved_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists staff_attendance_branch_assignments_one_active_type
  on public.staff_attendance_branch_assignments (staff_id, assignment_date, assignment_type)
  where status = 'approved';

create index if not exists staff_attendance_branch_assignments_lookup
  on public.staff_attendance_branch_assignments (staff_id, assignment_date, status, assignment_type);

alter table public.staff_attendance_branch_assignments enable row level security;

drop policy if exists "attendance branch assignments owner all" on public.staff_attendance_branch_assignments;
create policy "attendance branch assignments owner all"
  on public.staff_attendance_branch_assignments
  for all to authenticated
  using (public.get_auth_role() = 'owner')
  with check (public.get_auth_role() = 'owner');

drop policy if exists "attendance branch assignments branch staff read" on public.staff_attendance_branch_assignments;
create policy "attendance branch assignments branch staff read"
  on public.staff_attendance_branch_assignments
  for select to authenticated
  using (
    branch_id = public.get_auth_branch_id()
    or staff_id = public.get_auth_staff_id()
  );

revoke all on public.staff_attendance_branch_assignments from anon;
grant select on public.staff_attendance_branch_assignments to authenticated;
grant all on public.staff_attendance_branch_assignments to service_role;

alter table public.attendance_corrections
  add column if not exists exception_id uuid references public.attendance_exceptions(id) on delete set null;

create index if not exists attendance_corrections_exception_id_idx
  on public.attendance_corrections (exception_id)
  where exception_id is not null;

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
  p_attendance_date date
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
begin
  if p_staff_id is null or p_qr_branch_id is null or p_attendance_date is null then
    return query select false, null::uuid, 'review'::text;
    return;
  end if;

  if not exists (
    select 1 from public.branches
    where id = p_qr_branch_id and is_active = true
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

  select assignment.branch_id, assignment.assignment_type
    into v_effective_branch_id, v_source
  from public.staff_attendance_branch_assignments as assignment
  where assignment.staff_id = p_staff_id
    and assignment.assignment_date = p_attendance_date
    and assignment.status = 'approved'
    and assignment.assignment_type = 'temporary'
  order by assignment.created_at desc
  limit 1;

  if v_effective_branch_id is null then
    select duty.branch_id, 'schedule_assignment'
      into v_effective_branch_id, v_source
    from public.staff_duty_assignments as duty
    where duty.staff_id = p_staff_id
      and duty.day_of_week = extract(dow from p_attendance_date)::integer
      and duty.is_active = true
    order by duty.created_at desc, duty.id
    limit 1;
  end if;

  if v_effective_branch_id is null then
    select assignment.branch_id, assignment.assignment_type
      into v_effective_branch_id, v_source
    from public.staff_attendance_branch_assignments as assignment
    where assignment.staff_id = p_staff_id
      and assignment.assignment_date = p_attendance_date
      and assignment.status = 'approved'
      and assignment.assignment_type = 'approved_cross_branch'
    order by assignment.created_at desc
    limit 1;
  end if;

  if v_effective_branch_id is null and v_staff.is_cross_branch is true then
    v_effective_branch_id := p_qr_branch_id;
    v_source := 'approved_cross_branch';
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

revoke all on function public.resolve_effective_attendance_branch(uuid, uuid, date) from public;
revoke all on function public.resolve_effective_attendance_branch(uuid, uuid, date) from anon;
revoke all on function public.resolve_effective_attendance_branch(uuid, uuid, date) from authenticated;
grant execute on function public.resolve_effective_attendance_branch(uuid, uuid, date) to service_role;

create or replace function public.enforce_single_open_attendance()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status = 'checked_in' and new.checked_out_at is null then
    perform pg_advisory_xact_lock(
      hashtext('attendance_open_staff'),
      hashtext(concat_ws(':', new.staff_id::text, new.is_test::text))
    );

    if exists (
      select 1
      from public.staff_shift_checkins as existing
      where existing.staff_id = new.staff_id
        and existing.is_test = new.is_test
        and existing.status = 'checked_in'
        and existing.checked_out_at is null
        and existing.id <> new.id
    ) then
      raise exception using
        errcode = '23505',
        message = 'attendance_single_open_violation',
        detail = 'A staff member can have only one live open Attendance record.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists staff_shift_checkins_single_open_guard on public.staff_shift_checkins;
create trigger staff_shift_checkins_single_open_guard
  before insert or update of staff_id, is_test, status, checked_out_at
  on public.staff_shift_checkins
  for each row execute function public.enforce_single_open_attendance();

create or replace function public.sync_attendance_device_last_used_branch()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_scanned_branch_id uuid;
begin
  if new.scan_type = 'attendance' and new.device_id is not null and new.qr_point_id is not null then
    select point.branch_id into v_scanned_branch_id
    from public.qr_points as point
    where point.id = new.qr_point_id;

    if v_scanned_branch_id is not null then
      update public.staff_devices
      set branch_id = v_scanned_branch_id,
          updated_at = now()
      where id = new.device_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists qr_scan_events_sync_attendance_device_branch on public.qr_scan_events;
create trigger qr_scan_events_sync_attendance_device_branch
  after insert or update of qr_point_id, device_id, scan_type
  on public.qr_scan_events
  for each row execute function public.sync_attendance_device_last_used_branch();

create or replace function public.apply_attendance_review_correction(
  p_branch_id uuid,
  p_actor_staff_id uuid,
  p_action text,
  p_reason text,
  p_exception_id uuid default null,
  p_checkin_id uuid default null,
  p_values jsonb default '{}'::jsonb,
  p_is_test boolean default false
)
returns table (
  success boolean,
  code text,
  message text,
  correction_id uuid
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_exception public.attendance_exceptions%rowtype;
  v_checkin public.staff_shift_checkins%rowtype;
  v_staff_id uuid;
  v_attendance_date date;
  v_previous jsonb := '{}'::jsonb;
  v_new jsonb := coalesce(p_values, '{}'::jsonb);
  v_correction_id uuid;
  v_target_branch_id uuid;
begin
  if p_branch_id is null or p_actor_staff_id is null or v_reason is null then
    return query select false, 'invalid_request', 'Branch, actor, and reason are required.', null::uuid;
    return;
  end if;

  if p_exception_id is not null then
    select exception_row.* into v_exception
    from public.attendance_exceptions as exception_row
    where exception_row.id = p_exception_id and exception_row.branch_id = p_branch_id
    for update;
    if not found then
      return query select false, 'exception_not_found', 'Review issue was not found.', null::uuid;
      return;
    end if;
    v_staff_id := v_exception.staff_id;
    p_checkin_id := coalesce(p_checkin_id, v_exception.checkin_id);
    v_previous := jsonb_build_object('exception', to_jsonb(v_exception));
  end if;

  if p_checkin_id is not null then
    select checkin_row.* into v_checkin
    from public.staff_shift_checkins as checkin_row
    where checkin_row.id = p_checkin_id
      and checkin_row.branch_id = p_branch_id
      and checkin_row.is_test = p_is_test
    for update;
    if not found then
      return query select false, 'checkin_not_found', 'Attendance record was not found.', null::uuid;
      return;
    end if;
    v_staff_id := coalesce(v_staff_id, v_checkin.staff_id);
    v_attendance_date := v_checkin.shift_date;
    v_previous := v_previous || jsonb_build_object('attendance', to_jsonb(v_checkin));
  end if;

  if p_action = 'set_manual_clock_out' then
    if p_checkin_id is null or nullif(p_values->>'checkedOutAt', '') is null then
      return query select false, 'times_required', 'Attendance and clock-out time are required.', null::uuid;
      return;
    end if;
    update public.staff_shift_checkins
    set checked_out_at = (p_values->>'checkedOutAt')::timestamptz,
        status = 'checked_out',
        clock_out_method = 'manual_review',
        worked_minutes = coalesce((p_values->>'workedMinutes')::integer, worked_minutes),
        late_minutes = coalesce((p_values->>'lateMinutes')::integer, late_minutes),
        early_leave_minutes = coalesce((p_values->>'earlyLeaveMinutes')::integer, early_leave_minutes),
        overtime_minutes = coalesce((p_values->>'overtimeMinutes')::integer, overtime_minutes),
        attendance_status = coalesce(nullif(p_values->>'attendanceStatus', ''), attendance_status),
        exception_state = 'none',
        updated_at = v_now
    where id = p_checkin_id;
  elsif p_action in ('void_duplicate', 'mark_accidental_scan') then
    if p_checkin_id is not null then
      update public.staff_shift_checkins
      set status = 'voided', exception_state = 'none', notes = v_reason, updated_at = v_now
      where id = p_checkin_id;
    end if;
  elsif p_action = 'allow_branch_today' then
    v_target_branch_id := nullif(p_values->>'targetBranchId', '')::uuid;
    v_attendance_date := coalesce(nullif(p_values->>'attendanceDate', '')::date, current_date);
    if v_staff_id is null or v_target_branch_id is null then
      return query select false, 'branch_assignment_required', 'Staff and target branch are required.', null::uuid;
      return;
    end if;
    update public.staff_attendance_branch_assignments
    set status = 'revoked', updated_at = v_now
    where staff_id = v_staff_id
      and assignment_date = v_attendance_date
      and assignment_type = 'temporary'
      and status = 'approved';
    insert into public.staff_attendance_branch_assignments (
      staff_id, branch_id, assignment_date, assignment_type, status, reason, approved_by
    ) values (
      v_staff_id, v_target_branch_id, v_attendance_date, 'temporary', 'approved', v_reason, p_actor_staff_id
    );
  elsif p_action = 'change_permanent_branch' then
    v_target_branch_id := nullif(p_values->>'targetBranchId', '')::uuid;
    if v_staff_id is null or v_target_branch_id is null then
      return query select false, 'branch_assignment_required', 'Staff and target branch are required.', null::uuid;
      return;
    end if;
    v_previous := v_previous || jsonb_build_object(
      'homeBranchId', (select branch_id from public.staff where id = v_staff_id)
    );
    update public.staff set branch_id = v_target_branch_id, updated_at = v_now where id = v_staff_id;
  elsif p_action not in ('accept_recorded_attendance', 'ignore_scan') then
    return query select false, 'unsupported_action', 'This review action is not supported.', null::uuid;
    return;
  end if;

  if p_exception_id is not null then
    update public.attendance_exceptions
    set status = 'resolved',
        resolution_status = 'resolved',
        resolution_action = p_action,
        resolution_note = v_reason,
        resolved_at = v_now,
        resolved_by = p_actor_staff_id,
        updated_at = v_now
    where id = p_exception_id;
  end if;

  insert into public.attendance_corrections (
    branch_id, staff_id, checkin_id, exception_id, attendance_date,
    correction_type, action_type, previous_values, new_values, reason,
    status, requested_by, approved_by, corrected_by, applied_at, corrected_at, is_test
  ) values (
    p_branch_id, v_staff_id, p_checkin_id, p_exception_id, v_attendance_date,
    p_action, p_action, v_previous, v_new, v_reason,
    'applied', p_actor_staff_id, p_actor_staff_id, p_actor_staff_id, v_now, v_now, p_is_test
  ) returning id into v_correction_id;

  return query select true, 'committed', 'Attendance review correction applied.', v_correction_id;
end;
$$;

revoke all on function public.apply_attendance_review_correction(uuid, uuid, text, text, uuid, uuid, jsonb, boolean) from public;
revoke all on function public.apply_attendance_review_correction(uuid, uuid, text, text, uuid, uuid, jsonb, boolean) from anon;
revoke all on function public.apply_attendance_review_correction(uuid, uuid, text, text, uuid, uuid, jsonb, boolean) from authenticated;
grant execute on function public.apply_attendance_review_correction(uuid, uuid, text, text, uuid, uuid, jsonb, boolean) to service_role;

comment on table public.staff_attendance_branch_assignments is
  'Date-scoped attendance branch authority. Device branch remains last-used metadata and is never the authority source.';
comment on function public.resolve_effective_attendance_branch(uuid, uuid, date) is
  'Resolves attendance branch in fixed order: temporary assignment, schedule assignment, approved cross-branch, then home branch.';
comment on function public.enforce_single_open_attendance() is
  'Preserves legacy conflicts but rejects creation of a second live open Attendance row under a global staff/test lock.';
comment on function public.apply_attendance_review_correction(uuid, uuid, text, text, uuid, uuid, jsonb, boolean) is
  'Atomic review action: locks evidence, mutates official attendance or branch authority, resolves the linked exception, and inserts one correction audit.';

comment on column public.attendance_settings.first_scan_closing_behavior is
  'Deprecated compatibility field. Fluid Attendance always captures a first scan near expected closing without inventing attendance.';
comment on column public.attendance_settings.missing_schedule_behavior is
  'Deprecated compatibility field. Fluid Attendance always records the scan as attendance and opens a review issue.';
comment on column public.attendance_settings.off_day_scan_behavior is
  'Deprecated compatibility field. Fluid Attendance always records the scan as attendance and opens a review issue.';
comment on column public.attendance_settings.ambiguous_scan_behavior is
  'Deprecated compatibility field. Fluid Attendance uses the fixed record-first decision model.';
comment on column public.attendance_settings.active_service_blocks_clock_out is
  'Deprecated compatibility field. A sole open Attendance record is closed by the next valid scan; service state may be reviewed separately.';
