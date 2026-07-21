-- Authoritative staff branch-assignment integrity resolver.
--
-- Attendance may detect a wrong-branch scan, but it never changes staff branch
-- data. This migration adds the independent issue/audit model and the only
-- assignment resolver transaction. The previous
-- resolve_staff_branch_correction_transaction(...) remains for compatibility
-- with legacy callers and is explicitly deprecated below.

create table if not exists public.staff_branch_assignment_issues (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete restrict,
  issue_source text not null check (issue_source in (
    'attendance_scan',
    'staff_management',
    'schedule_conflict',
    'booking_assignment',
    'availability_check',
    'online_booking_exclusion',
    'transfer_audit',
    'temporary_access_conflict',
    'manual_review',
    'system_integrity_check'
  )),
  status text not null default 'open' check (status in (
    'open',
    'resolved',
    'resolved_with_booking_review',
    'requires_review',
    'dismissed'
  )),
  dedupe_key text unique,
  profile_branch_id uuid references public.branches(id) on delete set null,
  affected_branch_id uuid references public.branches(id) on delete set null,
  scan_event_id uuid references public.qr_scan_events(id) on delete set null,
  root_causes text[] not null default '{}'::text[],
  profile_branch_snapshot jsonb not null default '{}'::jsonb,
  schedule_branch_snapshot jsonb not null default '{}'::jsonb,
  booking_branch_summary jsonb not null default '{}'::jsonb,
  temporary_access_summary jsonb not null default '{}'::jsonb,
  impact_summary jsonb not null default '{}'::jsonb,
  selected_repairs jsonb not null default '{}'::jsonb,
  repairs_applied jsonb not null default '[]'::jsonb,
  repairs_requiring_review jsonb not null default '[]'::jsonb,
  resolution_type text,
  previous_branch_id uuid references public.branches(id) on delete set null,
  resolved_branch_id uuid references public.branches(id) on delete set null,
  temporary_authorization_id uuid references public.staff_attendance_branch_assignments(id) on delete set null,
  next_action text,
  reason text,
  decided_by_auth_user_id uuid,
  decided_by_staff_id uuid references public.staff(id) on delete set null,
  decided_at timestamptz,
  resolved_at timestamptz,
  is_test boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_branch_assignment_issues_open_idx
  on public.staff_branch_assignment_issues (status, created_at desc)
  where status in ('open', 'requires_review');
create index if not exists staff_branch_assignment_issues_staff_idx
  on public.staff_branch_assignment_issues (staff_id, created_at desc);
create index if not exists staff_branch_assignment_issues_branch_idx
  on public.staff_branch_assignment_issues (affected_branch_id, status, created_at desc)
  where affected_branch_id is not null;

drop trigger if exists trg_staff_branch_assignment_issues_updated_at
  on public.staff_branch_assignment_issues;
create trigger trg_staff_branch_assignment_issues_updated_at
  before update on public.staff_branch_assignment_issues
  for each row execute function public.fn_update_updated_at();

create table if not exists public.staff_branch_assignment_issue_audits (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.staff_branch_assignment_issues(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete restrict,
  issue_source text not null,
  root_causes text[] not null default '{}'::text[],
  resolution_type text not null,
  previous_branch_id uuid references public.branches(id) on delete set null,
  resolved_branch_id uuid references public.branches(id) on delete set null,
  selected_repairs jsonb not null default '{}'::jsonb,
  repairs_applied jsonb not null default '[]'::jsonb,
  repairs_requiring_review jsonb not null default '[]'::jsonb,
  profile_branch_snapshot jsonb not null default '{}'::jsonb,
  schedule_branch_snapshot jsonb not null default '{}'::jsonb,
  booking_branch_summary jsonb not null default '{}'::jsonb,
  temporary_access_summary jsonb not null default '{}'::jsonb,
  impact_summary jsonb not null default '{}'::jsonb,
  reason text,
  deciding_auth_user_id uuid,
  deciding_staff_id uuid references public.staff(id) on delete set null,
  next_action text,
  created_at timestamptz not null default now()
);

create index if not exists staff_branch_assignment_issue_audits_issue_idx
  on public.staff_branch_assignment_issue_audits (issue_id, created_at desc);

alter table public.staff_attendance_branch_assignments
  add column if not exists source_assignment_issue_id uuid
    references public.staff_branch_assignment_issues(id) on delete set null;

alter table public.staff_attendance_branch_assignments
  drop constraint if exists staff_attendance_branch_assignments_scope_check;
alter table public.staff_attendance_branch_assignments
  add constraint staff_attendance_branch_assignments_scope_check
  check (scope is null or scope in ('shift', 'business_day', 'date_range'));

create unique index if not exists staff_attendance_branch_assignments_issue_active_uidx
  on public.staff_attendance_branch_assignments (source_assignment_issue_id)
  where source_assignment_issue_id is not null and status = 'approved';

alter table public.staff_branch_assignment_issues enable row level security;
alter table public.staff_branch_assignment_issue_audits enable row level security;

drop policy if exists "staff branch assignment issues management read"
  on public.staff_branch_assignment_issues;
create policy "staff branch assignment issues management read"
  on public.staff_branch_assignment_issues
  for select to authenticated
  using (
    (select public.get_auth_role()) in ('owner', 'manager', 'assistant_manager', 'store_manager', 'crm', 'csr', 'csr_head', 'csr_staff')
    or staff_id = (select public.get_auth_staff_id())
  );

drop policy if exists "staff branch assignment issue audits management read"
  on public.staff_branch_assignment_issue_audits;
create policy "staff branch assignment issue audits management read"
  on public.staff_branch_assignment_issue_audits
  for select to authenticated
  using (
    (select public.get_auth_role()) in ('owner', 'manager', 'assistant_manager', 'store_manager', 'crm', 'csr', 'csr_head', 'csr_staff')
  );

revoke all on table public.staff_branch_assignment_issues from public, anon, authenticated;
grant select on table public.staff_branch_assignment_issues to authenticated;
grant select, insert, update, delete on table public.staff_branch_assignment_issues to service_role;

revoke all on table public.staff_branch_assignment_issue_audits from public, anon, authenticated;
grant select on table public.staff_branch_assignment_issue_audits to authenticated;
grant select, insert, update, delete on table public.staff_branch_assignment_issue_audits to service_role;

create or replace function public.resolve_staff_branch_assignment_issue(
  p_issue_id uuid,
  p_resolution_type text,
  p_actor_auth_user_id uuid,
  p_actor_staff_id uuid,
  p_reason text,
  p_effective_date date default null,
  p_valid_from timestamptz default null,
  p_valid_until timestamptz default null,
  p_selected_repairs jsonb default '{}'::jsonb,
  p_impact_summary jsonb default '{}'::jsonb
)
returns table (
  success boolean,
  code text,
  issue_id uuid,
  issue_status text,
  resolution_type text,
  previous_branch_id uuid,
  resolved_branch_id uuid,
  temporary_authorization_id uuid,
  repairs_applied jsonb,
  repairs_requiring_review jsonb,
  next_action text,
  message text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_issue public.staff_branch_assignment_issues%rowtype;
  v_actor public.staff%rowtype;
  v_staff public.staff%rowtype;
  v_actor_role text;
  v_target_branch_id uuid;
  v_target_branch_active boolean;
  v_temporary_scope text;
  v_previous_branch_id uuid;
  v_resolved_branch_id uuid;
  v_authorization_id uuid;
  v_root_causes text[] := '{}'::text[];
  v_schedule_branch_ids uuid[] := '{}'::uuid[];
  v_schedule_summary jsonb := '[]'::jsonb;
  v_booking_summary jsonb := '[]'::jsonb;
  v_temporary_summary jsonb := '[]'::jsonb;
  v_open_attendance_count integer := 0;
  v_future_booking_count integer := 0;
  v_invalid_service_count integer := 0;
  v_repairs_applied jsonb := '[]'::jsonb;
  v_repairs_requiring_review jsonb := '[]'::jsonb;
  v_effective_impact jsonb := '{}'::jsonb;
  v_issue_status text := 'resolved';
  v_next_action text := 'no_action_required';
  v_has_other_branch_schedule boolean := false;
  v_has_other_branch_booking boolean := false;
  v_has_conflicting_access boolean := false;
  v_selected_service_ids uuid[] := '{}'::uuid[];
  v_invalid_selected_service_count integer := 0;
  v_resolution_message text;
begin
  select issue.* into v_issue
  from public.staff_branch_assignment_issues as issue
  where issue.id = p_issue_id
  for update;

  if not found then
    return query select false, 'ISSUE_NOT_FOUND', p_issue_id, null::text, p_resolution_type,
      null::uuid, null::uuid, null::uuid, '[]'::jsonb, '[]'::jsonb,
      'management_review_required', 'The branch assignment issue was not found.';
    return;
  end if;

  select actor.* into v_actor
  from public.staff as actor
  where actor.id = p_actor_staff_id
    and actor.auth_user_id = p_actor_auth_user_id
    and actor.is_active is true
    and actor.archived_at is null
  for share;

  if not found then
    return query select false, 'ACTOR_NOT_AUTHENTICATED', v_issue.id, v_issue.status,
      p_resolution_type, v_issue.previous_branch_id, v_issue.resolved_branch_id,
      v_issue.temporary_authorization_id, v_issue.repairs_applied,
      v_issue.repairs_requiring_review, 'management_review_required',
      'An authenticated authorized staff member is required.';
    return;
  end if;

  v_actor_role := case
    when v_actor.system_role in ('csr', 'csr_head', 'csr_staff') then 'crm'
    else v_actor.system_role
  end;
  if v_actor_role not in ('owner', 'manager', 'assistant_manager', 'store_manager', 'crm') then
    return query select false, 'ACTOR_NOT_AUTHORIZED', v_issue.id, v_issue.status,
      p_resolution_type, v_issue.previous_branch_id, v_issue.resolved_branch_id,
      v_issue.temporary_authorization_id, v_issue.repairs_applied,
      v_issue.repairs_requiring_review, 'management_review_required',
      'This branch assignment decision requires an authorized manager or CRM leader.';
    return;
  end if;

  if v_actor_role = 'crm'
     and v_actor.branch_id is distinct from coalesce(v_issue.affected_branch_id, v_issue.profile_branch_id) then
    return query select false, 'ACTOR_BRANCH_MISMATCH', v_issue.id, v_issue.status,
      p_resolution_type, v_issue.previous_branch_id, v_issue.resolved_branch_id,
      v_issue.temporary_authorization_id, v_issue.repairs_applied,
      v_issue.repairs_requiring_review, 'management_review_required',
      'CRM may resolve only issues affecting its current branch.';
    return;
  end if;

  if v_issue.status not in ('open', 'requires_review') then
    if v_issue.resolution_type = p_resolution_type then
      return query select true, 'ALREADY_RESOLVED', v_issue.id, v_issue.status,
        v_issue.resolution_type, v_issue.previous_branch_id, v_issue.resolved_branch_id,
        v_issue.temporary_authorization_id, v_issue.repairs_applied,
        v_issue.repairs_requiring_review, coalesce(v_issue.next_action, 'no_action_required'),
        'The existing branch assignment decision was returned safely.';
      return;
    end if;

    return query select false, 'ISSUE_ALREADY_FINAL', v_issue.id, v_issue.status,
      p_resolution_type, v_issue.previous_branch_id, v_issue.resolved_branch_id,
      v_issue.temporary_authorization_id, v_issue.repairs_applied,
      v_issue.repairs_requiring_review, coalesce(v_issue.next_action, 'management_review_required'),
      'This branch assignment issue already has a final decision.';
    return;
  end if;

  select target.* into v_staff
  from public.staff as target
  where target.id = v_issue.staff_id
  for update;

  if not found or v_staff.is_active is not true or v_staff.archived_at is not null or v_staff.merged_into_staff_id is not null then
    update public.staff_branch_assignment_issues as issue
       set status = 'requires_review',
           root_causes = array(select distinct cause from unnest(issue.root_causes || array['ambiguous_branch_state']) as cause),
           next_action = 'management_review_required'
     where issue.id = v_issue.id;
    return query select true, 'STAFF_REQUIRES_REVIEW', v_issue.id, 'requires_review',
      'require_manual_review', v_staff.branch_id, null::uuid, null::uuid,
      '[]'::jsonb, jsonb_build_array(jsonb_build_object('type', 'staff_state', 'message', 'The staff record is inactive, archived, or merged.')),
      'management_review_required', 'No branch data was changed because the staff record requires manual review.';
    return;
  end if;

  v_previous_branch_id := v_staff.branch_id;
  v_target_branch_id := coalesce(
    nullif(p_selected_repairs ->> 'target_branch_id', '')::uuid,
    v_issue.affected_branch_id,
    v_staff.branch_id
  );

  select branch.is_active into v_target_branch_active
  from public.branches as branch
  where branch.id = v_target_branch_id;
  if v_target_branch_id is null or coalesce(v_target_branch_active, false) is not true then
    return query select false, 'TARGET_BRANCH_INVALID', v_issue.id, v_issue.status,
      p_resolution_type, v_previous_branch_id, null::uuid, null::uuid,
      '[]'::jsonb, '[]'::jsonb, 'management_review_required',
      'The target branch does not exist or is inactive.';
    return;
  end if;

  -- Low-risk deterministic cleanup: expired permissions cannot remain active.
  update public.staff_attendance_branch_assignments as assignment
     set status = 'revoked',
         revoked_at = coalesce(assignment.revoked_at, now()),
         revocation_reason = coalesce(assignment.revocation_reason, 'Automatically expired.'),
         updated_at = now()
   where assignment.staff_id = v_staff.id
     and assignment.status = 'approved'
     and assignment.valid_until is not null
     and assignment.valid_until <= now();

  select coalesce(array_agg(distinct duty.branch_id), '{}'::uuid[]),
         coalesce(jsonb_agg(jsonb_build_object('branch_id', duty.branch_id, 'duty_type', duty.duty_type, 'day_of_week', duty.day_of_week) order by duty.day_of_week, duty.duty_type), '[]'::jsonb)
    into v_schedule_branch_ids, v_schedule_summary
  from public.staff_duty_assignments as duty
  where duty.staff_id = v_staff.id
    and duty.is_active is true;

  select coalesce(jsonb_agg(jsonb_build_object('branch_id', branch_counts.branch_id, 'booking_count', branch_counts.booking_count)), '[]'::jsonb),
         coalesce(sum(branch_counts.booking_count), 0)
    into v_booking_summary, v_future_booking_count
  from (
    select booking.branch_id, count(*)::integer as booking_count
    from public.bookings as booking
    where booking.staff_id = v_staff.id
      and booking.booking_date >= coalesce(p_effective_date, current_date)
      and booking.status not in ('cancelled', 'completed', 'no_show')
    group by booking.branch_id
  ) as branch_counts;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', assignment.id,
      'branch_id', assignment.branch_id,
      'scope', assignment.scope,
      'valid_from', assignment.valid_from,
      'valid_until', assignment.valid_until,
      'status', assignment.status
    ) order by assignment.created_at desc), '[]'::jsonb)
    into v_temporary_summary
  from public.staff_attendance_branch_assignments as assignment
  where assignment.staff_id = v_staff.id
    and assignment.status = 'approved';

  select count(*)::integer into v_open_attendance_count
  from public.staff_shift_checkins as checkin
  where checkin.staff_id = v_staff.id
    and checkin.status = 'checked_in'
    and checkin.checked_out_at is null;

  v_has_other_branch_schedule := exists (
    select 1 from public.staff_duty_assignments as duty
    where duty.staff_id = v_staff.id and duty.is_active is true and duty.branch_id <> v_staff.branch_id
  );
  v_has_other_branch_booking := exists (
    select 1 from public.bookings as booking
    where booking.staff_id = v_staff.id
      and booking.booking_date >= coalesce(p_effective_date, current_date)
      and booking.status not in ('cancelled', 'completed', 'no_show')
      and booking.branch_id <> v_staff.branch_id
  );
  v_has_conflicting_access := (
    select count(distinct assignment.branch_id) > 1
    from public.staff_attendance_branch_assignments as assignment
    where assignment.staff_id = v_staff.id
      and assignment.status = 'approved'
      and (assignment.valid_from is null or assignment.valid_from <= now())
      and (assignment.valid_until is null or assignment.valid_until > now())
  );

  if v_staff.branch_id is null then
    v_root_causes := array_append(v_root_causes, 'missing_primary_branch');
  elsif not exists (select 1 from public.branches as branch where branch.id = v_staff.branch_id and branch.is_active is true) then
    v_root_causes := array_append(v_root_causes, 'inactive_primary_branch');
  end if;
  if v_has_other_branch_schedule then v_root_causes := array_append(v_root_causes, 'schedule_branch_incorrect'); end if;
  if v_has_other_branch_booking then v_root_causes := array_append(v_root_causes, 'booking_branch_mismatch'); end if;
  if v_has_conflicting_access then v_root_causes := array_append(v_root_causes, 'temporary_access_conflict'); end if;
  if exists (
    select 1 from public.staff_shift_checkins as checkin
    where checkin.staff_id = v_staff.id
      and checkin.status = 'checked_in'
      and checkin.checked_out_at is null
      and checkin.branch_id <> v_staff.branch_id
  ) then v_root_causes := array_append(v_root_causes, 'open_attendance_branch_conflict'); end if;
  if v_issue.affected_branch_id is not null and v_issue.affected_branch_id <> v_staff.branch_id then
    if v_issue.affected_branch_id = any(v_schedule_branch_ids)
       or exists (
         select 1 from public.bookings as booking
         where booking.staff_id = v_staff.id
           and booking.booking_date >= coalesce(p_effective_date, current_date)
           and booking.status not in ('cancelled', 'completed', 'no_show')
           and booking.branch_id = v_issue.affected_branch_id
       ) then
      v_root_causes := array_append(v_root_causes, 'profile_branch_incorrect');
    elsif not v_has_other_branch_schedule and not v_has_other_branch_booking and not v_has_conflicting_access then
      v_root_causes := array_append(v_root_causes, 'wrong_qr_scan_only');
    else
      v_root_causes := array_append(v_root_causes, 'ambiguous_branch_state');
    end if;
  end if;
  v_root_causes := array(select distinct cause from unnest(v_root_causes || v_issue.root_causes) as cause);

  select count(*)::integer into v_invalid_service_count
  from public.staff_services as capability
  where capability.staff_id = v_staff.id
    and not exists (
      select 1 from public.branch_services as branch_service
      where branch_service.branch_id = v_target_branch_id
        and branch_service.service_id = capability.service_id
        and branch_service.is_active is true
    );
  if v_invalid_service_count > 0 then
    v_root_causes := array_append(v_root_causes, 'service_assignment_mismatch');
  end if;

  v_effective_impact := jsonb_build_object(
    'effective_date', coalesce(p_effective_date, current_date),
    'future_booking_count', v_future_booking_count,
    'open_attendance_count', v_open_attendance_count,
    'schedule_branch_count', cardinality(v_schedule_branch_ids),
    'invalid_service_count', v_invalid_service_count,
    'client_impact_summary', coalesce(p_impact_summary, '{}'::jsonb)
  );

  if p_resolution_type = 'require_manual_review'
     or 'ambiguous_branch_state' = any(v_root_causes)
     or 'open_attendance_branch_conflict' = any(v_root_causes) then
    v_issue_status := 'requires_review';
    v_next_action := 'management_review_required';
    v_repairs_requiring_review := jsonb_build_array(jsonb_build_object(
      'type', 'manual_review',
      'root_causes', v_root_causes,
      'message', 'Conflicting branch evidence or open Attendance requires an authorized manager review.'
    ));
  elsif p_resolution_type = 'confirm_wrong_qr_scan' then
    v_issue_status := 'resolved';
    v_next_action := 'rescan_required';
    v_resolution_message := 'Branch assignment is unchanged. Ask the staff member to scan the correct branch QR code.';
  elsif p_resolution_type = 'correct_permanent_primary_branch' then
    if nullif(btrim(coalesce(p_reason, '')), '') is null then
      return query select false, 'REASON_REQUIRED', v_issue.id, v_issue.status, p_resolution_type,
        v_previous_branch_id, null::uuid, null::uuid, '[]'::jsonb, '[]'::jsonb,
        'management_review_required', 'A reason is required before changing a permanent primary branch.';
      return;
    end if;
    update public.staff as target set branch_id = v_target_branch_id where target.id = v_staff.id;
    insert into public.staff_branch_audit_logs (
      staff_id, old_branch_id, new_branch_id, changed_by_auth_user_id, changed_by_staff_id,
      reason, source, metadata
    ) values (
      v_staff.id, v_previous_branch_id, v_target_branch_id, p_actor_auth_user_id, p_actor_staff_id,
      p_reason, 'branch_assignment_resolver', jsonb_build_object('issue_id', v_issue.id, 'effective_date', coalesce(p_effective_date, current_date))
    );
    v_resolved_branch_id := v_target_branch_id;
    v_repairs_applied := v_repairs_applied || jsonb_build_array(jsonb_build_object('type', 'primary_branch', 'branch_id', v_target_branch_id));
    v_next_action := 'rescan_required';
    v_resolution_message := 'The permanent primary branch was corrected. Historical Attendance, bookings, payroll, and completed schedules were preserved.';
  elsif p_resolution_type = 'grant_temporary_branch_access' then
    v_temporary_scope := coalesce(p_selected_repairs ->> 'temporary_scope', 'business_day');
    if v_temporary_scope not in ('shift', 'business_day', 'date_range')
       or p_valid_from is null or p_valid_until is null or p_valid_until <= p_valid_from then
      return query select false, 'INVALID_TEMPORARY_VALIDITY', v_issue.id, v_issue.status,
        p_resolution_type, v_previous_branch_id, null::uuid, null::uuid, '[]'::jsonb, '[]'::jsonb,
        'management_review_required', 'A bounded temporary access scope and valid time range are required.';
      return;
    end if;
    if exists (
      select 1 from public.staff_attendance_branch_assignments as assignment
      where assignment.staff_id = v_staff.id
        and assignment.status = 'approved'
        and assignment.branch_id <> v_target_branch_id
        and (assignment.valid_from is null or assignment.valid_from < p_valid_until)
        and (assignment.valid_until is null or assignment.valid_until > p_valid_from)
    ) then
      v_issue_status := 'requires_review';
      v_next_action := 'management_review_required';
      v_root_causes := array_append(v_root_causes, 'temporary_access_conflict');
      v_repairs_requiring_review := jsonb_build_array(jsonb_build_object('type', 'temporary_access_conflict', 'message', 'An overlapping temporary permission exists for another branch.'));
    else
      insert into public.staff_attendance_branch_assignments (
        staff_id, branch_id, assignment_date, assignment_type, status, reason,
        approved_by, home_branch_id, valid_from, valid_until, attendance_business_date,
        scope, source_assignment_issue_id, approved_by_auth_user_id, approved_at, is_test, metadata
      ) values (
        v_staff.id, v_target_branch_id, coalesce(p_effective_date, current_date), 'temporary', 'approved', p_reason,
        p_actor_staff_id, v_previous_branch_id, p_valid_from, p_valid_until, coalesce(p_effective_date, current_date),
        v_temporary_scope, v_issue.id, p_actor_auth_user_id, now(), v_issue.is_test,
        jsonb_build_object('issue_source', v_issue.issue_source, 'issue_id', v_issue.id)
      ) returning id into v_authorization_id;
      v_resolved_branch_id := v_previous_branch_id;
      v_repairs_applied := v_repairs_applied || jsonb_build_array(jsonb_build_object('type', 'temporary_branch_access', 'branch_id', v_target_branch_id, 'scope', v_temporary_scope));
      v_next_action := 'rescan_required';
      v_resolution_message := 'Temporary branch access was granted. No Attendance was created; ask the staff member to scan again.';
    end if;
  elsif p_resolution_type = 'repair_schedule_branch' then
    update public.staff_duty_assignments as duty
       set branch_id = v_target_branch_id
     where duty.staff_id = v_staff.id
       and duty.is_active is true
       and duty.branch_id <> v_target_branch_id;
    v_repairs_applied := v_repairs_applied || jsonb_build_array(jsonb_build_object('type', 'branch_duty_schedule', 'branch_id', v_target_branch_id));
    v_repairs_requiring_review := jsonb_build_array(jsonb_build_object('type', 'weekly_schedule_and_overrides', 'message', 'Weekly schedules and overrides derive branch from the staff profile and were not rewritten.'));
    v_issue_status := 'requires_review';
    v_next_action := 'schedule_review_required';
    v_resolved_branch_id := v_previous_branch_id;
    v_resolution_message := 'Branch-duty assignments were repaired. Confirm any schedule and override impact before closing the review.';
  elsif p_resolution_type = 'repair_service_assignments' then
    if jsonb_typeof(coalesce(p_selected_repairs -> 'service_ids', 'null'::jsonb)) <> 'array' then
      return query select false, 'SERVICE_SELECTION_REQUIRED', v_issue.id, v_issue.status,
        p_resolution_type, v_previous_branch_id, null::uuid, null::uuid, '[]'::jsonb, '[]'::jsonb,
        'management_review_required', 'Select existing qualified services to retain at the active branch.';
      return;
    end if;
    select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_selected_service_ids
    from jsonb_array_elements_text(p_selected_repairs -> 'service_ids') as selected(value);
    select count(*)::integer into v_invalid_selected_service_count
    from unnest(v_selected_service_ids) as selected(service_id)
    where not exists (
      select 1 from public.staff_services as capability
      where capability.staff_id = v_staff.id and capability.service_id = selected.service_id
    ) or not exists (
      select 1 from public.branch_services as branch_service
      where branch_service.branch_id = v_target_branch_id
        and branch_service.service_id = selected.service_id
        and branch_service.is_active is true
    );
    if v_invalid_selected_service_count > 0 then
      return query select false, 'INVALID_SERVICE_SELECTION', v_issue.id, v_issue.status,
        p_resolution_type, v_previous_branch_id, null::uuid, null::uuid, '[]'::jsonb, '[]'::jsonb,
        'management_review_required', 'The selected services are not already qualified and active at the target branch.';
      return;
    end if;
    delete from public.staff_services as capability
    where capability.staff_id = v_staff.id
      and not (capability.service_id = any(v_selected_service_ids));
    v_repairs_applied := v_repairs_applied || jsonb_build_array(jsonb_build_object('type', 'service_assignments', 'retained_service_ids', to_jsonb(v_selected_service_ids)));
    v_resolved_branch_id := v_previous_branch_id;
    v_next_action := 'no_action_required';
    v_resolution_message := 'Only already-qualified services active at the target branch were retained.';
  elsif p_resolution_type = 'review_future_bookings' then
    v_issue_status := 'resolved_with_booking_review';
    v_next_action := 'booking_review_required';
    v_repairs_requiring_review := jsonb_build_array(jsonb_build_object('type', 'future_bookings', 'count', v_future_booking_count, 'message', 'No booking was moved or cancelled. Use the normal booking workflow to reassign safely.'));
    v_resolved_branch_id := v_previous_branch_id;
    v_resolution_message := 'Future bookings remain unchanged and are queued for operational review.';
  elsif p_resolution_type = 'complete_incomplete_transfer' then
    if nullif(btrim(coalesce(p_reason, '')), '') is null then
      return query select false, 'REASON_REQUIRED', v_issue.id, v_issue.status, p_resolution_type,
        v_previous_branch_id, null::uuid, null::uuid, '[]'::jsonb, '[]'::jsonb,
        'management_review_required', 'A reason is required before completing a branch transfer.';
      return;
    end if;
    if v_previous_branch_id <> v_target_branch_id then
      update public.staff as target set branch_id = v_target_branch_id where target.id = v_staff.id;
      insert into public.staff_branch_audit_logs (
        staff_id, old_branch_id, new_branch_id, changed_by_auth_user_id, changed_by_staff_id,
        reason, source, metadata
      ) values (
        v_staff.id, v_previous_branch_id, v_target_branch_id, p_actor_auth_user_id, p_actor_staff_id,
        p_reason, 'branch_assignment_transfer_completion', jsonb_build_object('issue_id', v_issue.id, 'effective_date', coalesce(p_effective_date, current_date))
      );
      v_repairs_applied := v_repairs_applied || jsonb_build_array(jsonb_build_object('type', 'primary_branch', 'branch_id', v_target_branch_id));
    end if;
    if coalesce((p_selected_repairs ->> 'repair_schedule_branch')::boolean, false) then
      update public.staff_duty_assignments as duty set branch_id = v_target_branch_id
      where duty.staff_id = v_staff.id and duty.is_active is true and duty.branch_id <> v_target_branch_id;
      v_repairs_applied := v_repairs_applied || jsonb_build_array(jsonb_build_object('type', 'branch_duty_schedule', 'branch_id', v_target_branch_id));
    end if;
    v_resolved_branch_id := v_target_branch_id;
    v_next_action := 'rescan_required';
    v_resolution_message := 'The available transfer steps were completed without rewriting historical records.';
  elsif p_resolution_type = 'fix_temporary_access_conflict' then
    if nullif(p_selected_repairs ->> 'revoke_authorization_id', '') is null then
      v_issue_status := 'requires_review';
      v_next_action := 'management_review_required';
      v_repairs_requiring_review := jsonb_build_array(jsonb_build_object('type', 'temporary_access_conflict', 'message', 'Select the invalid authorization to revoke.'));
    else
      update public.staff_attendance_branch_assignments as assignment
         set status = 'revoked', revoked_at = now(), revoked_by = p_actor_staff_id,
             revocation_reason = coalesce(nullif(btrim(p_reason), ''), 'Revoked by branch assignment resolver.'), updated_at = now()
       where assignment.id = (p_selected_repairs ->> 'revoke_authorization_id')::uuid
         and assignment.staff_id = v_staff.id
         and assignment.status = 'approved';
      if not found then
        return query select false, 'TEMPORARY_ACCESS_NOT_FOUND', v_issue.id, v_issue.status,
          p_resolution_type, v_previous_branch_id, null::uuid, null::uuid, '[]'::jsonb, '[]'::jsonb,
          'management_review_required', 'The selected temporary authorization is no longer active for this staff member.';
        return;
      end if;
      v_repairs_applied := v_repairs_applied || jsonb_build_array(jsonb_build_object('type', 'temporary_access_revoked'));
      v_resolved_branch_id := v_previous_branch_id;
      v_next_action := 'rescan_required';
      v_resolution_message := 'The invalid temporary permission was revoked. The next scan will re-evaluate effective branch access.';
    end if;
  else
    return query select false, 'INVALID_RESOLUTION_TYPE', v_issue.id, v_issue.status,
      p_resolution_type, v_previous_branch_id, null::uuid, null::uuid, '[]'::jsonb, '[]'::jsonb,
      'management_review_required', 'Choose a supported branch assignment resolution.';
    return;
  end if;

  if v_resolution_message is null then
    v_resolution_message := case
      when v_issue_status = 'requires_review' then 'No unsafe branch mutation was applied. This issue requires manual review.'
      else 'The branch assignment issue was resolved.'
    end;
  end if;

  update public.staff_branch_assignment_issues as issue
     set status = v_issue_status,
         dedupe_key = case when v_issue_status in ('open', 'requires_review') then issue.dedupe_key else null end,
         root_causes = array(select distinct cause from unnest(v_root_causes) as cause),
         profile_branch_id = coalesce(v_resolved_branch_id, v_previous_branch_id),
         profile_branch_snapshot = jsonb_build_object('branch_id', coalesce(v_resolved_branch_id, v_previous_branch_id)),
         schedule_branch_snapshot = jsonb_build_object('assignments', v_schedule_summary),
         booking_branch_summary = jsonb_build_object('branches', v_booking_summary),
         temporary_access_summary = jsonb_build_object('permissions', v_temporary_summary),
         impact_summary = v_effective_impact,
         selected_repairs = coalesce(p_selected_repairs, '{}'::jsonb),
         repairs_applied = v_repairs_applied,
         repairs_requiring_review = v_repairs_requiring_review,
         resolution_type = p_resolution_type,
         previous_branch_id = v_previous_branch_id,
         resolved_branch_id = v_resolved_branch_id,
         temporary_authorization_id = v_authorization_id,
         next_action = v_next_action,
         reason = nullif(btrim(coalesce(p_reason, '')), ''),
         decided_by_auth_user_id = p_actor_auth_user_id,
         decided_by_staff_id = p_actor_staff_id,
         decided_at = now(),
         resolved_at = case when v_issue_status in ('resolved', 'resolved_with_booking_review', 'dismissed') then now() else null end
   where issue.id = v_issue.id;

  insert into public.staff_branch_assignment_issue_audits (
    issue_id, staff_id, issue_source, root_causes, resolution_type,
    previous_branch_id, resolved_branch_id, selected_repairs, repairs_applied,
    repairs_requiring_review, profile_branch_snapshot, schedule_branch_snapshot,
    booking_branch_summary, temporary_access_summary, impact_summary, reason,
    deciding_auth_user_id, deciding_staff_id, next_action
  ) values (
    v_issue.id, v_staff.id, v_issue.issue_source, array(select distinct cause from unnest(v_root_causes) as cause), p_resolution_type,
    v_previous_branch_id, v_resolved_branch_id, coalesce(p_selected_repairs, '{}'::jsonb), v_repairs_applied,
    v_repairs_requiring_review, jsonb_build_object('branch_id', coalesce(v_resolved_branch_id, v_previous_branch_id)),
    jsonb_build_object('assignments', v_schedule_summary), jsonb_build_object('branches', v_booking_summary),
    jsonb_build_object('permissions', v_temporary_summary), v_effective_impact, nullif(btrim(coalesce(p_reason, '')), ''),
    p_actor_auth_user_id, p_actor_staff_id, v_next_action
  );

  return query select true, case when v_issue_status = 'requires_review' then 'REQUIRES_REVIEW' else 'RESOLVED' end,
    v_issue.id, v_issue_status, p_resolution_type, v_previous_branch_id,
    v_resolved_branch_id, v_authorization_id, v_repairs_applied,
    v_repairs_requiring_review, v_next_action, v_resolution_message;
end;
$$;

comment on function public.resolve_staff_branch_assignment_issue(uuid, text, uuid, uuid, text, date, timestamptz, timestamptz, jsonb, jsonb) is
  'Authoritative branch-assignment integrity resolver. It never creates or replays Attendance.';
comment on function public.resolve_staff_branch_correction_transaction(uuid, text, uuid, uuid, text, date, timestamptz, timestamptz, date, jsonb, jsonb) is
  'DEPRECATED: legacy replay-based Attendance correction. New branch integrity decisions must use resolve_staff_branch_assignment_issue.';

revoke all on function public.resolve_staff_branch_assignment_issue(uuid, text, uuid, uuid, text, date, timestamptz, timestamptz, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.resolve_staff_branch_assignment_issue(uuid, text, uuid, uuid, text, date, timestamptz, timestamptz, jsonb, jsonb)
  to service_role;

notify pgrst, 'reload schema';
