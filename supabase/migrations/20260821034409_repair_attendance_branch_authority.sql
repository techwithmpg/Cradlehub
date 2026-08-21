-- Make assignment data, not a phone's last-used branch, authoritative for
-- Attendance. Future permanent transfers remain scheduled until their
-- effective date and contradictory duty schedules fail closed for review.

begin;

create table if not exists public.staff_permanent_branch_transfers (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete restrict,
  previous_branch_id uuid references public.branches(id) on delete set null,
  new_branch_id uuid not null references public.branches(id) on delete restrict,
  effective_date date not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'effective', 'cancelled')),
  source_assignment_issue_id uuid unique
    references public.staff_branch_assignment_issues(id) on delete set null,
  approved_by_auth_user_id uuid,
  approved_by_staff_id uuid references public.staff(id) on delete set null,
  reason text,
  applied_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (previous_branch_id is null or previous_branch_id <> new_branch_id)
);

comment on table public.staff_permanent_branch_transfers is
  'Effective-dated permanent branch authority. Scheduled rows do not change staff.branch_id before effective_date.';

create index if not exists staff_permanent_branch_transfers_staff_effective_idx
  on public.staff_permanent_branch_transfers (staff_id, effective_date desc, created_at desc)
  where status in ('scheduled', 'effective');

create unique index if not exists staff_permanent_branch_transfers_one_scheduled_uidx
  on public.staff_permanent_branch_transfers (staff_id)
  where status = 'scheduled';

drop trigger if exists trg_staff_permanent_branch_transfers_updated_at
  on public.staff_permanent_branch_transfers;
create trigger trg_staff_permanent_branch_transfers_updated_at
  before update on public.staff_permanent_branch_transfers
  for each row execute function public.fn_update_updated_at();

alter table public.staff_permanent_branch_transfers enable row level security;

drop policy if exists "staff permanent branch transfers management read"
  on public.staff_permanent_branch_transfers;
create policy "staff permanent branch transfers management read"
  on public.staff_permanent_branch_transfers
  for select to authenticated
  using (
    (select public.get_auth_role()) in (
      'owner', 'manager', 'assistant_manager', 'store_manager',
      'crm', 'csr', 'csr_head', 'csr_staff'
    )
    or staff_id = (select public.get_auth_staff_id())
  );

revoke all on table public.staff_permanent_branch_transfers
  from public, anon, authenticated;
grant select on table public.staff_permanent_branch_transfers to authenticated;
grant select, insert, update, delete on table public.staff_permanent_branch_transfers
  to service_role;

-- The deprecated branch-correction transaction replays the source scan inside
-- the transfer transaction, so it must never accept a future date. Future
-- transfers use resolve_staff_permanent_branch_transfer_issue(...) instead.
alter table public.staff_branch_change_requests
  drop constraint if exists staff_branch_change_requests_legacy_transfer_date_guard;
alter table public.staff_branch_change_requests
  add constraint staff_branch_change_requests_legacy_transfer_date_guard
  check (
    decision_type is distinct from 'permanent_branch_transfer'
    or status is distinct from 'approved'
    or (
      permanent_effective_date is not null
      and attendance_business_date is not null
      and permanent_effective_date <= attendance_business_date
    )
  );

create or replace function public.resolve_staff_permanent_branch_transfer_issue(
  p_issue_id uuid,
  p_actor_auth_user_id uuid,
  p_actor_staff_id uuid,
  p_reason text,
  p_effective_date date,
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
  v_transfer public.staff_permanent_branch_transfers%rowtype;
  v_actor_role text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_effective_now boolean := p_effective_date <= current_date;
  v_repairs jsonb;
  v_message text;
begin
  if p_issue_id is null or p_effective_date is null then
    return query select false, 'EFFECTIVE_DATE_REQUIRED', p_issue_id, null::text,
      'correct_permanent_primary_branch'::text, null::uuid, null::uuid,
      null::uuid, '[]'::jsonb, '[]'::jsonb, 'management_review_required'::text,
      'Choose the permanent transfer effective date.'::text;
    return;
  end if;

  if v_reason is null then
    return query select false, 'REASON_REQUIRED', p_issue_id, null::text,
      'correct_permanent_primary_branch'::text, null::uuid, null::uuid,
      null::uuid, '[]'::jsonb, '[]'::jsonb, 'management_review_required'::text,
      'A reason is required before changing permanent branch authority.'::text;
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtext('staff_permanent_branch_transfer_issue'),
    hashtext(p_issue_id::text)
  );

  select issue_row.* into v_issue
  from public.staff_branch_assignment_issues as issue_row
  where issue_row.id = p_issue_id
  for update;

  if not found then
    return query select false, 'ISSUE_NOT_FOUND', p_issue_id, null::text,
      'correct_permanent_primary_branch'::text, null::uuid, null::uuid,
      null::uuid, '[]'::jsonb, '[]'::jsonb, 'management_review_required'::text,
      'The branch assignment issue was not found.'::text;
    return;
  end if;

  if v_issue.status not in ('open', 'requires_review') then
    if v_issue.resolution_type = 'correct_permanent_primary_branch' then
      return query select true, 'ALREADY_RESOLVED', v_issue.id, v_issue.status,
        v_issue.resolution_type, v_issue.previous_branch_id,
        v_issue.resolved_branch_id, v_issue.temporary_authorization_id,
        v_issue.repairs_applied, v_issue.repairs_requiring_review,
        coalesce(v_issue.next_action, 'no_action_required'),
        'The existing permanent branch decision was replayed.'::text;
      return;
    end if;
    return query select false, 'ISSUE_ALREADY_FINAL', v_issue.id, v_issue.status,
      'correct_permanent_primary_branch'::text, v_issue.previous_branch_id,
      v_issue.resolved_branch_id, v_issue.temporary_authorization_id,
      v_issue.repairs_applied, v_issue.repairs_requiring_review,
      'management_review_required'::text,
      'This branch assignment issue already has a final decision.'::text;
    return;
  end if;

  if v_issue.is_test then
    return query select false, 'TEST_MODE_PERMANENT_TRANSFER_BLOCKED', v_issue.id,
      v_issue.status, 'correct_permanent_primary_branch'::text,
      v_issue.previous_branch_id, v_issue.resolved_branch_id, null::uuid,
      '[]'::jsonb, '[]'::jsonb, 'management_review_required'::text,
      'Permanent transfers are disabled for Test Mode branch issues.'::text;
    return;
  end if;

  select actor_row.* into v_actor
  from public.staff as actor_row
  where actor_row.id = p_actor_staff_id
    and actor_row.auth_user_id = p_actor_auth_user_id
    and actor_row.is_active is true
    and actor_row.archived_at is null
    and actor_row.merged_into_staff_id is null
  for share;

  if not found then
    return query select false, 'ACTOR_NOT_AUTHENTICATED', v_issue.id,
      v_issue.status, 'correct_permanent_primary_branch'::text,
      v_issue.previous_branch_id, v_issue.resolved_branch_id, null::uuid,
      '[]'::jsonb, '[]'::jsonb, 'management_review_required'::text,
      'An authenticated authorized staff member is required.'::text;
    return;
  end if;

  v_actor_role := case
    when v_actor.system_role in ('csr', 'csr_head', 'csr_staff') then 'crm'
    else v_actor.system_role
  end;
  if v_actor.id = v_issue.staff_id
     or v_actor_role not in ('owner', 'manager', 'assistant_manager', 'store_manager', 'crm')
     or (
       v_actor_role = 'crm'
       and v_actor.branch_id is distinct from
         coalesce(v_issue.affected_branch_id, v_issue.profile_branch_id)
     ) then
    return query select false, 'ACTOR_NOT_AUTHORIZED', v_issue.id,
      v_issue.status, 'correct_permanent_primary_branch'::text,
      v_issue.previous_branch_id, v_issue.resolved_branch_id, null::uuid,
      '[]'::jsonb, '[]'::jsonb, 'management_review_required'::text,
      'You are not authorized to approve this permanent transfer.'::text;
    return;
  end if;

  select staff_row.* into v_staff
  from public.staff as staff_row
  where staff_row.id = v_issue.staff_id
    and staff_row.is_active is true
    and staff_row.archived_at is null
    and staff_row.merged_into_staff_id is null
  for update;

  if not found then
    return query select false, 'STAFF_REQUIRES_REVIEW', v_issue.id,
      'requires_review'::text, 'correct_permanent_primary_branch'::text,
      v_issue.previous_branch_id, v_issue.resolved_branch_id, null::uuid,
      '[]'::jsonb, '[]'::jsonb, 'management_review_required'::text,
      'The staff profile is not active and requires management review.'::text;
    return;
  end if;

  if v_issue.affected_branch_id is null
     or v_issue.affected_branch_id = v_staff.branch_id
     or not exists (
       select 1 from public.branches as branch_row
       where branch_row.id = v_issue.affected_branch_id
         and branch_row.is_active is true
     ) then
    return query select false, 'TARGET_BRANCH_INVALID', v_issue.id,
      v_issue.status, 'correct_permanent_primary_branch'::text,
      v_staff.branch_id, v_issue.affected_branch_id, null::uuid,
      '[]'::jsonb, '[]'::jsonb, 'management_review_required'::text,
      'The target branch is missing, inactive, or already current.'::text;
    return;
  end if;

  if exists (
    select 1 from public.staff_shift_checkins as checkin_row
    where checkin_row.staff_id = v_staff.id
      and checkin_row.status = 'checked_in'
      and checkin_row.checked_out_at is null
  ) then
    update public.staff_branch_assignment_issues as issue_row
       set status = 'requires_review',
           root_causes = array(
             select distinct cause
             from unnest(issue_row.root_causes || array['open_attendance_branch_conflict']) as cause
           ),
           next_action = 'management_review_required',
           repairs_requiring_review = jsonb_build_array(jsonb_build_object(
             'type', 'open_attendance_branch_conflict',
             'message', 'Close or review the open Attendance record before approving the transfer.'
           ))
     where issue_row.id = v_issue.id;
    return query select false, 'OPEN_ATTENDANCE_CONFLICT', v_issue.id,
      'requires_review'::text, 'correct_permanent_primary_branch'::text,
      v_staff.branch_id, v_issue.affected_branch_id, null::uuid,
      '[]'::jsonb, jsonb_build_array(jsonb_build_object(
        'type', 'open_attendance_branch_conflict',
        'message', 'Close or review the open Attendance record before approving the transfer.'
      )), 'management_review_required'::text,
      'An open Attendance record must be reviewed before this transfer.'::text;
    return;
  end if;

  update public.staff_permanent_branch_transfers as transfer_row
     set status = 'cancelled',
         cancelled_at = now(),
         metadata = transfer_row.metadata || jsonb_build_object(
           'supersededByAssignmentIssueId', v_issue.id
         )
   where transfer_row.staff_id = v_staff.id
     and transfer_row.status = 'scheduled'
     and transfer_row.source_assignment_issue_id is distinct from v_issue.id;

  insert into public.staff_permanent_branch_transfers (
    staff_id, previous_branch_id, new_branch_id, effective_date, status,
    source_assignment_issue_id, approved_by_auth_user_id, approved_by_staff_id,
    reason, applied_at, metadata
  ) values (
    v_staff.id, v_staff.branch_id, v_issue.affected_branch_id, p_effective_date,
    case when v_effective_now then 'effective' else 'scheduled' end,
    v_issue.id, p_actor_auth_user_id, p_actor_staff_id, v_reason,
    case when v_effective_now then now() else null end,
    jsonb_build_object(
      'source', 'branch_assignment_issue',
      'profileBranchPreservedUntilEffectiveDate', not v_effective_now
    )
  )
  on conflict (source_assignment_issue_id) do update
    set effective_date = excluded.effective_date,
        status = excluded.status,
        approved_by_auth_user_id = excluded.approved_by_auth_user_id,
        approved_by_staff_id = excluded.approved_by_staff_id,
        reason = excluded.reason,
        applied_at = excluded.applied_at,
        cancelled_at = null,
        metadata = public.staff_permanent_branch_transfers.metadata || excluded.metadata
  returning * into v_transfer;

  if v_effective_now then
    update public.staff as staff_row
       set branch_id = v_issue.affected_branch_id,
           metadata = coalesce(staff_row.metadata, '{}'::jsonb) || jsonb_build_object(
             'branch_changed_at', now(),
             'branch_change_effective_date', p_effective_date,
             'branch_change_source', 'staff_permanent_branch_transfers',
             'branch_transfer_id', v_transfer.id,
             'previous_branch_id', v_staff.branch_id,
             'requested_branch_id', v_issue.affected_branch_id,
             'reviewed_by_staff_id', p_actor_staff_id
           )
     where staff_row.id = v_staff.id;
  end if;

  insert into public.staff_branch_audit_logs (
    staff_id, old_branch_id, new_branch_id, changed_by_auth_user_id,
    changed_by_staff_id, source, reason, metadata
  ) values (
    v_staff.id, v_staff.branch_id, v_issue.affected_branch_id,
    p_actor_auth_user_id, p_actor_staff_id,
    case
      when v_effective_now then 'branch_assignment_permanent_transfer'
      else 'branch_assignment_permanent_transfer_scheduled'
    end,
    v_reason,
    jsonb_build_object(
      'assignmentIssueId', v_issue.id,
      'transferId', v_transfer.id,
      'effectiveDate', p_effective_date,
      'applied', v_effective_now,
      'scheduled', not v_effective_now,
      'impactSummary', coalesce(p_impact_summary, '{}'::jsonb)
    )
  );

  v_repairs := jsonb_build_array(jsonb_build_object(
    'type', case when v_effective_now then 'primary_branch' else 'scheduled_primary_branch' end,
    'branch_id', v_issue.affected_branch_id,
    'effective_date', p_effective_date,
    'transfer_id', v_transfer.id
  ));
  v_message := case
    when v_effective_now then
      'The permanent branch transfer is effective now. The same connected phone can scan at the new branch.'
    else format(
      'The permanent branch transfer is scheduled for %s. The current branch remains authoritative until then.',
      p_effective_date
    )
  end;

  update public.staff_branch_assignment_issues as issue_row
     set status = 'resolved',
         dedupe_key = null,
         root_causes = array(
           select distinct cause
           from unnest(issue_row.root_causes || array['profile_branch_incorrect']) as cause
         ),
         impact_summary = coalesce(p_impact_summary, '{}'::jsonb) || jsonb_build_object(
           'effective_date', p_effective_date,
           'scheduled', not v_effective_now,
           'transfer_id', v_transfer.id
         ),
         selected_repairs = jsonb_build_object(
           'effective_date', p_effective_date,
           'target_branch_id', v_issue.affected_branch_id
         ),
         repairs_applied = v_repairs,
         repairs_requiring_review = '[]'::jsonb,
         resolution_type = 'correct_permanent_primary_branch',
         previous_branch_id = v_staff.branch_id,
         resolved_branch_id = v_issue.affected_branch_id,
         next_action = case when v_effective_now then 'rescan_required' else 'no_action_required' end,
         reason = v_reason,
         decided_by_auth_user_id = p_actor_auth_user_id,
         decided_by_staff_id = p_actor_staff_id,
         decided_at = now(),
         resolved_at = now(),
         metadata = coalesce(issue_row.metadata, '{}'::jsonb) || jsonb_build_object(
           'permanentBranchTransferId', v_transfer.id,
           'permanentEffectiveDate', p_effective_date,
           'profileBranchChangedImmediately', v_effective_now
         )
   where issue_row.id = v_issue.id;

  insert into public.staff_branch_assignment_issue_audits (
    issue_id, staff_id, issue_source, root_causes, resolution_type,
    previous_branch_id, resolved_branch_id, selected_repairs, repairs_applied,
    repairs_requiring_review, profile_branch_snapshot, schedule_branch_snapshot,
    booking_branch_summary, temporary_access_summary, impact_summary, reason,
    deciding_auth_user_id, deciding_staff_id, next_action
  ) values (
    v_issue.id, v_staff.id, v_issue.issue_source, v_issue.root_causes,
    'correct_permanent_primary_branch', v_staff.branch_id, v_issue.affected_branch_id,
    jsonb_build_object('effective_date', p_effective_date), v_repairs, '[]'::jsonb,
    jsonb_build_object('branch_id', v_staff.branch_id),
    v_issue.schedule_branch_snapshot, v_issue.booking_branch_summary,
    v_issue.temporary_access_summary,
    coalesce(p_impact_summary, '{}'::jsonb) || jsonb_build_object(
      'effective_date', p_effective_date,
      'scheduled', not v_effective_now,
      'transfer_id', v_transfer.id
    ),
    v_reason, p_actor_auth_user_id, p_actor_staff_id,
    case when v_effective_now then 'rescan_required' else 'no_action_required' end
  );

  return query select true, 'RESOLVED', v_issue.id, 'resolved'::text,
    'correct_permanent_primary_branch'::text, v_staff.branch_id,
    v_issue.affected_branch_id, null::uuid, v_repairs, '[]'::jsonb,
    case when v_effective_now then 'rescan_required' else 'no_action_required' end,
    v_message;
end;
$$;

comment on function public.resolve_staff_permanent_branch_transfer_issue(
  uuid, uuid, uuid, text, date, jsonb
) is
  'Approves immediate or future permanent branch authority without applying it early.';

revoke all on function public.resolve_staff_permanent_branch_transfer_issue(
  uuid, uuid, uuid, text, date, jsonb
) from public, anon, authenticated;
grant execute on function public.resolve_staff_permanent_branch_transfer_issue(
  uuid, uuid, uuid, text, date, jsonb
) to service_role;

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

notify pgrst, 'reload schema';

commit;
