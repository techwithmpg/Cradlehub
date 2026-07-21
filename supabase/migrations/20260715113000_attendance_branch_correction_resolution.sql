-- Explicit Attendance branch-correction resolution.
--
-- Extends the existing wrong-branch request and date-scoped Attendance branch
-- assignment models. The resolver applies branch authority (or a permanent
-- transfer), invokes the authoritative Attendance commit RPC, and finalizes
-- the request in one database transaction.

alter table public.staff_attendance_branch_assignments
  add column if not exists home_branch_id uuid references public.branches(id) on delete set null,
  add column if not exists valid_from timestamptz,
  add column if not exists valid_until timestamptz,
  add column if not exists attendance_business_date date,
  add column if not exists scope text,
  add column if not exists source_scan_event_id uuid references public.qr_scan_events(id) on delete set null,
  add column if not exists source_branch_correction_id uuid references public.staff_branch_change_requests(id) on delete set null,
  add column if not exists approved_by_auth_user_id uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists revoked_by uuid references public.staff(id) on delete set null,
  add column if not exists revoked_at timestamptz,
  add column if not exists revocation_reason text,
  add column if not exists consumed_checkin_id uuid references public.staff_shift_checkins(id) on delete set null,
  add column if not exists is_test boolean not null default false,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.staff_attendance_branch_assignments
  drop constraint if exists staff_attendance_branch_assignments_scope_check;
alter table public.staff_attendance_branch_assignments
  add constraint staff_attendance_branch_assignments_scope_check
  check (scope is null or scope in ('shift', 'business_day'));

alter table public.staff_attendance_branch_assignments
  drop constraint if exists staff_attendance_branch_assignments_validity_check;
alter table public.staff_attendance_branch_assignments
  add constraint staff_attendance_branch_assignments_validity_check
  check (valid_from is null or valid_until is null or valid_until > valid_from);

create unique index if not exists staff_attendance_branch_assignments_correction_active_uidx
  on public.staff_attendance_branch_assignments (source_branch_correction_id)
  where source_branch_correction_id is not null and status = 'approved';

create index if not exists staff_attendance_branch_assignments_active_resolution_idx
  on public.staff_attendance_branch_assignments
    (staff_id, branch_id, is_test, attendance_business_date, valid_until)
  where status = 'approved' and assignment_type = 'temporary';

alter table public.staff_branch_change_requests
  add column if not exists decision_type text,
  add column if not exists resolution_status text,
  add column if not exists temporary_authorization_id uuid references public.staff_attendance_branch_assignments(id) on delete set null,
  add column if not exists temporary_valid_from timestamptz,
  add column if not exists temporary_valid_until timestamptz,
  add column if not exists attendance_business_date date,
  add column if not exists permanent_effective_date date,
  add column if not exists previous_primary_branch_id uuid references public.branches(id) on delete set null,
  add column if not exists new_primary_branch_id uuid references public.branches(id) on delete set null,
  add column if not exists continuation_request_id text,
  add column if not exists continuation_scan_event_id uuid references public.qr_scan_events(id) on delete set null,
  add column if not exists attendance_checkin_id uuid references public.staff_shift_checkins(id) on delete set null,
  add column if not exists attendance_result jsonb,
  add column if not exists impact_summary jsonb not null default '{}'::jsonb,
  add column if not exists is_test boolean not null default false;

alter table public.staff_branch_change_requests
  drop constraint if exists staff_branch_change_requests_decision_type_check;
alter table public.staff_branch_change_requests
  add constraint staff_branch_change_requests_decision_type_check
  check (
    decision_type is null or decision_type in (
      'temporary_branch_access_shift',
      'temporary_branch_access_day',
      'permanent_branch_transfer',
      'rejected_wrong_branch'
    )
  );

alter table public.staff_branch_change_requests
  drop constraint if exists staff_branch_change_requests_resolution_status_check;
alter table public.staff_branch_change_requests
  add constraint staff_branch_change_requests_resolution_status_check
  check (resolution_status is null or resolution_status in ('pending', 'resolved', 'requires_review'));

create index if not exists staff_branch_change_requests_resolution_status_idx
  on public.staff_branch_change_requests (resolution_status, created_at desc);

create unique index if not exists staff_branch_change_requests_continuation_request_uidx
  on public.staff_branch_change_requests (continuation_request_id)
  where continuation_request_id is not null;

alter table public.staff_shift_checkins
  add column if not exists home_branch_id uuid references public.branches(id) on delete set null,
  add column if not exists branch_authorization_id uuid references public.staff_attendance_branch_assignments(id) on delete set null,
  add column if not exists branch_correction_request_id uuid references public.staff_branch_change_requests(id) on delete set null,
  add column if not exists branch_resolution_decision_type text,
  add column if not exists branch_approved_by uuid references public.staff(id) on delete set null,
  add column if not exists branch_approved_at timestamptz;

create index if not exists staff_shift_checkins_branch_correction_request_idx
  on public.staff_shift_checkins (branch_correction_request_id)
  where branch_correction_request_id is not null;

create index if not exists staff_shift_checkins_branch_authorization_idx
  on public.staff_shift_checkins (branch_authorization_id)
  where branch_authorization_id is not null;

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
        and coalesce(assignment.attendance_business_date, assignment.assignment_date) = p_attendance_date
      )
      or (
        assignment.scope = 'shift'
        and (
          coalesce(assignment.attendance_business_date, assignment.assignment_date) = p_attendance_date
          or exists (
            select 1
            from public.staff_shift_checkins as checkin
            where checkin.branch_authorization_id = assignment.id
              and checkin.staff_id = assignment.staff_id
              and checkin.branch_id = assignment.branch_id
              and checkin.is_test = assignment.is_test
              and checkin.status = 'checked_in'
              and checkin.checked_out_at is null
          )
        )
      )
    )
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
      and assignment.is_test = coalesce(p_is_test, false)
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

create or replace function public.resolve_staff_branch_correction_transaction(
  p_request_id uuid,
  p_decision_type text,
  p_actor_auth_user_id uuid,
  p_actor_staff_id uuid,
  p_reason text default null,
  p_attendance_business_date date default null,
  p_valid_from timestamptz default null,
  p_valid_until timestamptz default null,
  p_permanent_effective_date date default null,
  p_impact_summary jsonb default '{}'::jsonb,
  p_scan_commit jsonb default null
)
returns table (
  success boolean,
  code text,
  request_id uuid,
  request_status text,
  resolution_status text,
  authorization_id uuid,
  scan_event_id uuid,
  checkin_id uuid,
  operation_result jsonb,
  message text
)
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_now timestamptz := now();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_request public.staff_branch_change_requests%rowtype;
  v_actor public.staff%rowtype;
  v_staff public.staff%rowtype;
  v_source_event public.qr_scan_events%rowtype;
  v_point public.qr_points%rowtype;
  v_authorization public.staff_attendance_branch_assignments%rowtype;
  v_commit record;
  v_args jsonb;
  v_kind text;
  v_candidate_count integer := 0;
  v_candidate_event_id uuid;
  v_branch_name text;
  v_operation_result jsonb;
  v_resolution_status text;
  v_continuation_request_id text;
  v_scan_event_id uuid;
  v_checkin_id uuid;
  v_is_test boolean := false;
begin
  if p_decision_type not in (
    'temporary_branch_access_shift',
    'temporary_branch_access_day',
    'permanent_branch_transfer',
    'rejected_wrong_branch'
  ) then
    return query select false, 'invalid_decision', p_request_id, null::text, null::text,
      null::uuid, null::uuid, null::uuid, null::jsonb, 'Choose a supported branch resolution.';
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtext('staff_branch_correction_request'),
    hashtext(coalesce(p_request_id::text, 'missing'))
  );

  select * into v_request
  from public.staff_branch_change_requests
  where id = p_request_id
  for update;

  if not found then
    return query select false, 'request_not_found', p_request_id, null::text, null::text,
      null::uuid, null::uuid, null::uuid, null::jsonb, 'The branch correction request was not found.';
    return;
  end if;

  if v_request.status <> 'pending' then
    if v_request.decision_type = p_decision_type
       and v_request.resolution_status in ('resolved', 'requires_review') then
      return query select true, 'replayed', v_request.id, v_request.status,
        v_request.resolution_status, v_request.temporary_authorization_id,
        v_request.continuation_scan_event_id, v_request.attendance_checkin_id,
        v_request.attendance_result, 'The existing branch resolution was replayed.';
      return;
    end if;

    return query select false, 'already_resolved', v_request.id, v_request.status,
      v_request.resolution_status, v_request.temporary_authorization_id,
      v_request.continuation_scan_event_id, v_request.attendance_checkin_id,
      v_request.attendance_result, 'This request already has a final decision.';
    return;
  end if;

  select * into v_actor
  from public.staff
  where id = p_actor_staff_id
    and auth_user_id = p_actor_auth_user_id
    and is_active = true
    and archived_at is null
    and merged_into_staff_id is null;

  if not found or v_actor.id = v_request.staff_id then
    return query select false, 'not_authorized', v_request.id, v_request.status,
      v_request.resolution_status, null::uuid, null::uuid, null::uuid, null::jsonb,
      'You are not authorized to resolve this request.';
    return;
  end if;

  if v_actor.system_role not in ('owner', 'manager', 'assistant_manager', 'store_manager')
     and not (
       v_actor.system_role in ('crm', 'csr', 'csr_head', 'csr_staff')
       and v_actor.branch_id = v_request.requested_branch_id
     ) then
    return query select false, 'not_authorized', v_request.id, v_request.status,
      v_request.resolution_status, null::uuid, null::uuid, null::uuid, null::jsonb,
      'You can only resolve requests for branches you manage.';
    return;
  end if;

  select * into v_staff
  from public.staff
  where id = v_request.staff_id
  for update;

  if not found
     or v_staff.is_active is not true
     or v_staff.archived_at is not null
     or v_staff.merged_into_staff_id is not null then
    return query select false, 'staff_inactive', v_request.id, v_request.status,
      v_request.resolution_status, null::uuid, null::uuid, null::uuid, null::jsonb,
      'The staff profile is not active.';
    return;
  end if;

  if not exists (
      select 1 from public.branches
      where id = v_request.requested_branch_id and is_active = true
    )
    or (
      v_request.current_branch_id is not null
      and not exists (
        select 1 from public.branches
        where id = v_request.current_branch_id and is_active = true
      )
    ) then
    return query select false, 'inactive_branch', v_request.id, v_request.status,
      v_request.resolution_status, null::uuid, null::uuid, null::uuid, null::jsonb,
      'The source or scanned branch is not active.';
    return;
  end if;

  if v_staff.branch_id is distinct from v_request.current_branch_id then
    return query select false, 'stale_request', v_request.id, v_request.status,
      v_request.resolution_status, null::uuid, null::uuid, null::uuid, null::jsonb,
      'The staff branch changed after this request. Refresh and review the current assignment.';
    return;
  end if;

  if v_request.scan_event_id is null then
    select count(*), (array_agg(event_row.id order by event_row.created_at desc))[1]
      into v_candidate_count, v_candidate_event_id
    from public.qr_scan_events as event_row
    where event_row.staff_id = v_request.staff_id
      and event_row.qr_point_id = v_request.qr_point_id
      and event_row.reason_code = 'wrong_branch'
      and event_row.created_at >= v_request.created_at - interval '15 minutes'
      and event_row.created_at <= v_request.created_at + interval '5 minutes'
      and not exists (
        select 1
        from public.staff_branch_change_requests as linked_request
        where linked_request.scan_event_id = event_row.id
          and linked_request.id <> v_request.id
      );

    if v_candidate_count = 1 then
      update public.staff_branch_change_requests
         set scan_event_id = v_candidate_event_id
       where id = v_request.id;
      v_request.scan_event_id := v_candidate_event_id;
    end if;
  end if;

  select * into v_source_event
  from public.qr_scan_events
  where id = v_request.scan_event_id
    and staff_id = v_request.staff_id
  for update;

  if not found
     or v_source_event.reason_code <> 'wrong_branch'
     or v_source_event.qr_point_id is distinct from v_request.qr_point_id then
    return query select false, 'source_scan_unavailable', v_request.id, v_request.status,
      v_request.resolution_status, null::uuid, null::uuid, null::uuid, null::jsonb,
      'The original Attendance scan cannot be resumed safely.';
    return;
  end if;

  select * into v_point
  from public.qr_points
  where id = v_source_event.qr_point_id
    and branch_id = v_request.requested_branch_id
    and point_type = 'attendance'
    and is_active = true;

  if not found or v_source_event.device_id is null then
    return query select false, 'source_scan_unavailable', v_request.id, v_request.status,
      v_request.resolution_status, null::uuid, null::uuid, null::uuid, null::jsonb,
      'The original Attendance scan no longer has a valid QR point or device.';
    return;
  end if;

  v_is_test := coalesce(v_source_event.is_test, false);

  if p_decision_type = 'permanent_branch_transfer' and v_is_test then
    return query select false, 'test_mode_permanent_transfer_blocked', v_request.id,
      v_request.status, v_request.resolution_status, null::uuid, null::uuid,
      null::uuid, null::jsonb,
      'Permanent staff transfers are disabled for Test Mode scans.';
    return;
  end if;

  if p_decision_type in ('permanent_branch_transfer', 'rejected_wrong_branch')
     and v_reason is null then
    return query select false, 'reason_required', v_request.id, v_request.status,
      v_request.resolution_status, null::uuid, null::uuid, null::uuid, null::jsonb,
      'A short reason is required for this decision.';
    return;
  end if;

  if p_decision_type = 'rejected_wrong_branch' then
    select name into v_branch_name
    from public.branches
    where id = v_staff.branch_id;

    v_operation_result := jsonb_build_object(
      'ok', false,
      'outcome', 'blocked',
      'severity', 'warning',
      'title', 'Wrong branch',
      'message', format(
        'You are currently assigned to %s. Please scan the Attendance QR code at your assigned branch or ask CRM for assistance.',
        coalesce(v_branch_name, 'your assigned branch')
      ),
      'reasonCode', 'wrong_branch_rejected',
      'operationId', v_source_event.request_id,
      'scanEventId', v_source_event.id::text,
      'isTest', v_is_test
    );

    update public.qr_scan_events
       set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
             'branchCorrectionRequestId', v_request.id,
             'branchCorrectionDecision', p_decision_type,
             'branchCorrectionResolvedAt', v_now,
             'branchCorrectionResolvedByStaffId', p_actor_staff_id
           ),
           operation_result = v_operation_result,
           operation_result_recorded_at = v_now
     where id = v_source_event.id;

    update public.attendance_exceptions
       set status = 'resolved',
           resolution_status = 'resolved',
           resolution_action = p_decision_type,
           resolution_note = v_reason,
           resolved_at = v_now,
           resolved_by = p_actor_staff_id,
           updated_at = v_now
     where status = 'open'
       and (scan_event_id = v_source_event.id or latest_scan_event_id = v_source_event.id)
       and (exception_type = 'wrong_branch' or metadata->>'internalExceptionType' = 'wrong_branch');

    update public.staff_branch_change_requests
       set status = 'rejected',
           resolution_status = 'resolved',
           decision_type = p_decision_type,
           reviewed_by_auth_user_id = p_actor_auth_user_id,
           reviewed_by_staff_id = p_actor_staff_id,
           reviewed_at = v_now,
           reviewer_note = v_reason,
           attendance_business_date = p_attendance_business_date,
           previous_primary_branch_id = v_staff.branch_id,
           new_primary_branch_id = v_staff.branch_id,
           attendance_result = v_operation_result,
           impact_summary = coalesce(p_impact_summary, '{}'::jsonb),
           is_test = v_is_test,
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
             'reviewed_by_role', v_actor.system_role,
             'source_scan_preserved', true
           )
     where id = v_request.id;

    return query select true, 'resolved', v_request.id, 'rejected'::text,
      'resolved'::text, null::uuid, v_source_event.id, null::uuid,
      v_operation_result, 'Wrong-branch scan rejected.';
    return;
  end if;

  if p_scan_commit is null or jsonb_typeof(p_scan_commit) <> 'object' then
    return query select false, 'scan_commit_missing', v_request.id, v_request.status,
      v_request.resolution_status, null::uuid, null::uuid, null::uuid, null::jsonb,
      'The original Attendance scan could not be prepared for continuation.';
    return;
  end if;

  v_kind := p_scan_commit->>'kind';
  v_args := p_scan_commit->'args';
  if v_kind not in ('attendance', 'provisional') or jsonb_typeof(v_args) <> 'object' then
    return query select false, 'scan_commit_invalid', v_request.id, v_request.status,
      v_request.resolution_status, null::uuid, null::uuid, null::uuid, null::jsonb,
      'The Attendance continuation payload is invalid.';
    return;
  end if;

  if (v_args->>'p_branch_id')::uuid is distinct from v_request.requested_branch_id
     or (v_args->>'p_qr_point_id')::uuid is distinct from v_source_event.qr_point_id
     or (v_args->>'p_staff_id')::uuid is distinct from v_request.staff_id
     or (v_args->>'p_device_id')::uuid is distinct from v_source_event.device_id
     or coalesce((v_args->>'p_is_test')::boolean, false) is distinct from v_is_test then
    return query select false, 'scan_commit_identity_mismatch', v_request.id,
      v_request.status, v_request.resolution_status, null::uuid, null::uuid,
      null::uuid, null::jsonb, 'The Attendance continuation identity did not match the original scan.';
    return;
  end if;

  if p_decision_type in ('temporary_branch_access_shift', 'temporary_branch_access_day') then
    if p_attendance_business_date is null
       or p_valid_from is null
       or p_valid_until is null
       or p_valid_until <= p_valid_from
       or p_valid_until <= v_now then
      return query select false, 'invalid_validity', v_request.id, v_request.status,
        v_request.resolution_status, null::uuid, null::uuid, null::uuid, null::jsonb,
        'Temporary branch access needs a valid start and expiry.';
      return;
    end if;

    select * into v_authorization
    from public.staff_attendance_branch_assignments
    where staff_id = v_request.staff_id
      and assignment_date = p_attendance_business_date
      and assignment_type = 'temporary'
      and status = 'approved'
    limit 1
    for update;

    if found and v_authorization.valid_until is not null and v_authorization.valid_until <= v_now then
      update public.staff_attendance_branch_assignments
         set status = 'revoked',
             revoked_at = v_now,
             revocation_reason = 'Expired before a new branch resolution.',
             updated_at = v_now
       where id = v_authorization.id;
      v_authorization := null;
    end if;

    if v_authorization.id is not null
       and (
         v_authorization.branch_id <> v_request.requested_branch_id
         or v_authorization.is_test <> v_is_test
         or (
           v_authorization.source_branch_correction_id is not null
           and v_authorization.source_branch_correction_id <> v_request.id
         )
       ) then
      return query select false, 'conflicting_temporary_authorization', v_request.id,
        v_request.status, v_request.resolution_status, null::uuid, null::uuid,
        null::uuid, null::jsonb,
        'Another temporary branch authorization already covers this Attendance day.';
      return;
    end if;

    if v_authorization.id is null then
      insert into public.staff_attendance_branch_assignments (
        staff_id,
        branch_id,
        assignment_date,
        assignment_type,
        status,
        reason,
        approved_by,
        home_branch_id,
        valid_from,
        valid_until,
        attendance_business_date,
        scope,
        source_scan_event_id,
        source_branch_correction_id,
        approved_by_auth_user_id,
        approved_at,
        is_test,
        metadata
      ) values (
        v_request.staff_id,
        v_request.requested_branch_id,
        p_attendance_business_date,
        'temporary',
        'approved',
        coalesce(v_reason, 'Temporary branch coverage approved.'),
        p_actor_staff_id,
        v_staff.branch_id,
        p_valid_from,
        p_valid_until,
        p_attendance_business_date,
        case
          when p_decision_type = 'temporary_branch_access_shift' then 'shift'
          else 'business_day'
        end,
        v_source_event.id,
        v_request.id,
        p_actor_auth_user_id,
        v_now,
        v_is_test,
        jsonb_build_object('decisionType', p_decision_type)
      )
      returning * into v_authorization;
    else
      update public.staff_attendance_branch_assignments
         set home_branch_id = coalesce(home_branch_id, v_staff.branch_id),
             valid_from = p_valid_from,
             valid_until = p_valid_until,
             attendance_business_date = p_attendance_business_date,
             scope = case
               when p_decision_type = 'temporary_branch_access_shift' then 'shift'
               else 'business_day'
             end,
             source_scan_event_id = coalesce(source_scan_event_id, v_source_event.id),
             source_branch_correction_id = coalesce(source_branch_correction_id, v_request.id),
             approved_by = p_actor_staff_id,
             approved_by_auth_user_id = p_actor_auth_user_id,
             approved_at = coalesce(approved_at, v_now),
             reason = coalesce(v_reason, reason, 'Temporary branch coverage approved.'),
             updated_at = v_now
       where id = v_authorization.id
       returning * into v_authorization;
    end if;
  elsif p_decision_type = 'permanent_branch_transfer' then
    if p_permanent_effective_date is null then
      return query select false, 'effective_date_required', v_request.id, v_request.status,
        v_request.resolution_status, null::uuid, null::uuid, null::uuid, null::jsonb,
        'Permanent transfer needs an effective date.';
      return;
    end if;

    update public.staff
       set branch_id = v_request.requested_branch_id,
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
             'branch_changed_at', v_now,
             'branch_change_effective_date', p_permanent_effective_date,
             'branch_change_source', 'branch_correction_resolution',
             'branch_change_request_id', v_request.id,
             'previous_branch_id', v_staff.branch_id,
             'requested_branch_id', v_request.requested_branch_id,
             'reviewed_by_staff_id', p_actor_staff_id
           )
     where id = v_request.staff_id;

    insert into public.staff_branch_audit_logs (
      staff_id,
      old_branch_id,
      new_branch_id,
      change_request_id,
      changed_by_auth_user_id,
      changed_by_staff_id,
      source,
      reason,
      metadata
    ) values (
      v_request.staff_id,
      v_staff.branch_id,
      v_request.requested_branch_id,
      v_request.id,
      p_actor_auth_user_id,
      p_actor_staff_id,
      'branch_correction_resolution',
      v_reason,
      jsonb_build_object(
        'decisionType', p_decision_type,
        'effectiveDate', p_permanent_effective_date,
        'reviewedByRole', v_actor.system_role,
        'impactSummary', coalesce(p_impact_summary, '{}'::jsonb)
      )
    );
  end if;

  if v_kind = 'attendance' then
    select * into v_commit
    from public.commit_attendance_scan_transaction(
      v_args->>'p_request_id',
      (v_args->>'p_branch_id')::uuid,
      (v_args->>'p_qr_point_id')::uuid,
      (v_args->>'p_staff_id')::uuid,
      (v_args->>'p_device_id')::uuid,
      v_args->>'p_scan_type',
      v_args->>'p_action',
      v_args->>'p_outcome',
      v_args->>'p_reason_code',
      v_args->>'p_message',
      v_args->>'p_user_agent',
      v_args->>'p_ip_address',
      coalesce(v_args->'p_metadata', '{}'::jsonb),
      coalesce((v_args->>'p_is_test')::boolean, false),
      v_args->'p_public_result',
      (v_args->>'p_checkin_id')::uuid,
      v_args->'p_checkin_insert',
      v_args->'p_checkin_update',
      v_args->'p_exception',
      v_args->>'p_device_scan_type'
    );
  else
    select * into v_commit
    from public.reconcile_provisional_attendance_clock_out(
      v_args->>'p_request_id',
      (v_args->>'p_checkin_id')::uuid,
      (v_args->>'p_branch_id')::uuid,
      (v_args->>'p_staff_id')::uuid,
      (v_args->>'p_qr_point_id')::uuid,
      (v_args->>'p_device_id')::uuid,
      (v_args->>'p_actual_clock_out_at')::timestamptz,
      v_args->'p_public_result',
      v_args->>'p_user_agent',
      v_args->>'p_ip_address',
      coalesce(v_args->'p_metadata', '{}'::jsonb),
      coalesce((v_args->>'p_is_test')::boolean, false)
    );
  end if;

  if v_commit.success is not true then
    raise exception 'branch_correction_scan_commit_failed:%', coalesce(v_commit.code, 'unknown')
      using errcode = 'P0001';
  end if;

  v_scan_event_id := v_commit.scan_event_id;
  v_checkin_id := v_commit.checkin_id;
  v_operation_result := v_commit.operation_result;
  v_continuation_request_id := v_args->>'p_request_id';
  v_resolution_status := case
    when v_operation_result->>'outcome' = 'exception' then 'requires_review'
    else 'resolved'
  end;

  if v_checkin_id is not null then
    update public.staff_shift_checkins
       set home_branch_id = coalesce(home_branch_id, v_request.current_branch_id),
           branch_authorization_id = coalesce(branch_authorization_id, v_authorization.id),
           branch_correction_request_id = coalesce(branch_correction_request_id, v_request.id),
           branch_resolution_decision_type = coalesce(branch_resolution_decision_type, p_decision_type),
           branch_approved_by = coalesce(branch_approved_by, p_actor_staff_id),
           branch_approved_at = coalesce(branch_approved_at, v_now),
           updated_at = v_now
     where id = v_checkin_id;

    if v_authorization.id is not null then
      update public.staff_attendance_branch_assignments
         set consumed_checkin_id = coalesce(consumed_checkin_id, v_checkin_id),
             status = case
               when scope = 'shift'
                    and (v_kind = 'provisional' or coalesce(v_args->>'p_action', '') in ('clock_out', 'clock_out_reconciled'))
                 then 'revoked'
               else status
             end,
             revoked_at = case
               when scope = 'shift'
                    and (v_kind = 'provisional' or coalesce(v_args->>'p_action', '') in ('clock_out', 'clock_out_reconciled'))
                 then coalesce(revoked_at, v_now)
               else revoked_at
             end,
             revocation_reason = case
               when scope = 'shift'
                    and (v_kind = 'provisional' or coalesce(v_args->>'p_action', '') in ('clock_out', 'clock_out_reconciled'))
                 then coalesce(revocation_reason, 'Attendance shift closed during resolution.')
               else revocation_reason
             end,
             updated_at = v_now
       where id = v_authorization.id;
    end if;
  end if;

  update public.qr_scan_events
     set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
           'branchCorrectionRequestId', v_request.id,
           'branchCorrectionDecision', p_decision_type,
           'branchCorrectionResolvedAt', v_now,
           'branchCorrectionResolvedByStaffId', p_actor_staff_id,
           'continuationScanEventId', v_scan_event_id,
           'continuationRequestId', v_continuation_request_id,
           'authorizationId', v_authorization.id
         ),
         operation_result = v_operation_result,
         operation_result_recorded_at = v_now
   where id = v_source_event.id;

  update public.attendance_exceptions
     set status = 'resolved',
         resolution_status = 'resolved',
         resolution_action = p_decision_type,
         resolution_note = coalesce(v_reason, 'Branch assignment resolved.'),
         resolved_at = v_now,
         resolved_by = p_actor_staff_id,
         latest_scan_event_id = coalesce(v_scan_event_id, latest_scan_event_id),
         updated_at = v_now
   where status = 'open'
     and (scan_event_id = v_source_event.id or latest_scan_event_id = v_source_event.id)
     and (exception_type = 'wrong_branch' or metadata->>'internalExceptionType' = 'wrong_branch');

  update public.staff_branch_change_requests
     set status = 'approved',
         resolution_status = v_resolution_status,
         decision_type = p_decision_type,
         reviewed_by_auth_user_id = p_actor_auth_user_id,
         reviewed_by_staff_id = p_actor_staff_id,
         reviewed_at = v_now,
         reviewer_note = v_reason,
         temporary_authorization_id = v_authorization.id,
         temporary_valid_from = v_authorization.valid_from,
         temporary_valid_until = v_authorization.valid_until,
         attendance_business_date = p_attendance_business_date,
         permanent_effective_date = p_permanent_effective_date,
         previous_primary_branch_id = v_request.current_branch_id,
         new_primary_branch_id = case
           when p_decision_type = 'permanent_branch_transfer' then v_request.requested_branch_id
           else v_request.current_branch_id
         end,
         continuation_request_id = v_continuation_request_id,
         continuation_scan_event_id = v_scan_event_id,
         attendance_checkin_id = v_checkin_id,
         attendance_result = v_operation_result,
         impact_summary = coalesce(p_impact_summary, '{}'::jsonb),
         is_test = v_is_test,
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
           'reviewed_by_role', v_actor.system_role,
           'source_scan_preserved', true,
           'continuation_event_required_by_transactional_scan_architecture', true
         )
   where id = v_request.id;

  if p_decision_type = 'permanent_branch_transfer' then
    update public.staff_branch_change_requests
       set status = 'cancelled',
           resolution_status = 'resolved',
           reviewed_by_auth_user_id = p_actor_auth_user_id,
           reviewed_by_staff_id = p_actor_staff_id,
           reviewed_at = v_now,
           reviewer_note = 'Closed after another permanent branch transfer.',
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
             'supersededByBranchCorrectionRequestId', v_request.id
           )
     where staff_id = v_request.staff_id
       and id <> v_request.id
       and status = 'pending';
  end if;

  return query select true, 'resolved', v_request.id, 'approved'::text,
    v_resolution_status, v_authorization.id, v_scan_event_id, v_checkin_id,
    v_operation_result,
    case
      when v_resolution_status = 'requires_review'
        then 'Branch assignment resolved; the resumed Attendance scan still needs review.'
      else 'Branch assignment resolved and the original Attendance scan completed.'
    end;
end;
$$;

comment on function public.resolve_staff_branch_correction_transaction(
  uuid, text, uuid, uuid, text, date, timestamptz, timestamptz, date, jsonb, jsonb
) is
  'Locks and resolves a wrong-branch Attendance request, invokes the authoritative Attendance commit, links the continuation, and finalizes audit state atomically.';

revoke all on function public.resolve_staff_branch_correction_transaction(
  uuid, text, uuid, uuid, text, date, timestamptz, timestamptz, date, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.resolve_staff_branch_correction_transaction(
  uuid, text, uuid, uuid, text, date, timestamptz, timestamptz, date, jsonb, jsonb
) to service_role;

revoke all on table public.staff_attendance_branch_assignments from anon;
revoke all on table public.staff_attendance_branch_assignments from authenticated;
grant select on table public.staff_attendance_branch_assignments to authenticated;
grant select, insert, update, delete on table public.staff_attendance_branch_assignments to service_role;

drop policy if exists "attendance branch assignments owner all"
  on public.staff_attendance_branch_assignments;
drop policy if exists "attendance branch assignments management read"
  on public.staff_attendance_branch_assignments;
create policy "attendance branch assignments management read"
  on public.staff_attendance_branch_assignments
  for select to authenticated
  using ((select public.get_auth_role()) in ('owner', 'manager', 'assistant_manager', 'store_manager'));

revoke all on table public.staff_branch_change_requests from anon;
revoke all on table public.staff_branch_change_requests from authenticated;
grant select on table public.staff_branch_change_requests to authenticated;
grant select, insert, update, delete on table public.staff_branch_change_requests to service_role;

drop policy if exists "staff_branch_change_requests_insert_own_pending"
  on public.staff_branch_change_requests;

notify pgrst, 'reload schema';
