-- Cut CRM Branch Corrections over to the authoritative branch-assignment issue model.
-- Branch decisions are independent from Attendance replay. Every successful
-- resolution requires a fresh QR scan when next_action = 'rescan_required'.

begin;

-- The previous direct hotfix mirrored scans into the deprecated request table.
-- Stop creating new legacy requests once the CRM UI reads assignment issues.
drop trigger if exists trg_capture_wrong_branch_scan_for_branch_correction
  on public.qr_scan_events;
drop function if exists public.capture_wrong_branch_scan_for_branch_correction();

-- Complete the FK when the issue table was first created by the direct hotfix.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.staff_branch_assignment_issues'::regclass
      and conname = 'staff_branch_assignment_issues_temporary_authorization_id_fkey'
  ) then
    alter table public.staff_branch_assignment_issues
      add constraint staff_branch_assignment_issues_temporary_authorization_id_fkey
      foreign key (temporary_authorization_id)
      references public.staff_attendance_branch_assignments(id)
      on delete set null;
  end if;
end
$$;

create or replace function public.capture_wrong_branch_assignment_issue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_branch_id uuid;
  v_root_causes text[];
  v_dedupe_key text;
  v_is_test boolean := false;
begin
  if new.reason_code is distinct from 'wrong_branch'
     or new.staff_id is null
     or new.branch_id is null then
    return new;
  end if;

  select staff.branch_id
    into v_profile_branch_id
  from public.staff as staff
  where staff.id = new.staff_id;

  if not found or v_profile_branch_id = new.branch_id then
    return new;
  end if;

  v_root_causes := case
    when v_profile_branch_id is null then array['missing_primary_branch']::text[]
    else array['wrong_qr_scan_only']::text[]
  end;
  v_dedupe_key := concat(new.staff_id::text, ':attendance_scan:', new.branch_id::text);
  v_is_test := coalesce((to_jsonb(new) ->> 'is_test')::boolean, false);

  insert into public.staff_branch_assignment_issues (
    staff_id,
    issue_source,
    status,
    dedupe_key,
    profile_branch_id,
    affected_branch_id,
    scan_event_id,
    root_causes,
    profile_branch_snapshot,
    next_action,
    reason,
    is_test,
    metadata
  ) values (
    new.staff_id,
    'attendance_scan',
    'open',
    v_dedupe_key,
    v_profile_branch_id,
    new.branch_id,
    new.id,
    v_root_causes,
    jsonb_build_object('branch_id', v_profile_branch_id),
    'review_branch_assignment',
    coalesce(new.message, 'Staff scanned an Attendance QR assigned to another branch.'),
    v_is_test,
    jsonb_build_object(
      'qr_point_id', new.qr_point_id,
      'scan_event_id', new.id,
      'scan_action', new.action,
      'scan_outcome', new.outcome,
      'detection', 'attendance_wrong_branch',
      'source_event_metadata', coalesce(new.metadata, '{}'::jsonb)
    )
  )
  on conflict (dedupe_key) do update
  set status = 'open',
      profile_branch_id = excluded.profile_branch_id,
      affected_branch_id = excluded.affected_branch_id,
      scan_event_id = excluded.scan_event_id,
      root_causes = excluded.root_causes,
      profile_branch_snapshot = excluded.profile_branch_snapshot,
      next_action = excluded.next_action,
      reason = excluded.reason,
      decided_by_auth_user_id = null,
      decided_by_staff_id = null,
      decided_at = null,
      resolved_at = null,
      resolution_type = null,
      previous_branch_id = null,
      resolved_branch_id = null,
      temporary_authorization_id = null,
      is_test = excluded.is_test,
      metadata = coalesce(public.staff_branch_assignment_issues.metadata, '{}'::jsonb)
        || excluded.metadata,
      updated_at = now();

  return new;
end;
$$;

revoke all on function public.capture_wrong_branch_assignment_issue()
  from public, anon, authenticated;
grant execute on function public.capture_wrong_branch_assignment_issue()
  to service_role;

drop trigger if exists trg_capture_wrong_branch_assignment_issue
  on public.qr_scan_events;
create trigger trg_capture_wrong_branch_assignment_issue
after insert on public.qr_scan_events
for each row
when (new.reason_code = 'wrong_branch')
execute function public.capture_wrong_branch_assignment_issue();

-- Recover current legacy pending requests into the authoritative issue inbox.
with legacy_pending as (
  select distinct on (request.staff_id, request.requested_branch_id)
    request.id as legacy_request_id,
    request.staff_id,
    request.current_branch_id as profile_branch_id,
    request.requested_branch_id as affected_branch_id,
    request.scan_event_id,
    request.qr_point_id,
    request.reason,
    request.created_at,
    request.is_test,
    concat(request.staff_id::text, ':attendance_scan:', request.requested_branch_id::text) as dedupe_key
  from public.staff_branch_change_requests as request
  where request.status = 'pending'
    and request.requested_branch_id is not null
  order by request.staff_id, request.requested_branch_id, request.created_at desc, request.id desc
), upserted as (
  insert into public.staff_branch_assignment_issues (
    staff_id,
    issue_source,
    status,
    dedupe_key,
    profile_branch_id,
    affected_branch_id,
    scan_event_id,
    root_causes,
    profile_branch_snapshot,
    next_action,
    reason,
    is_test,
    metadata,
    created_at,
    updated_at
  )
  select
    legacy.staff_id,
    'attendance_scan',
    'open',
    legacy.dedupe_key,
    legacy.profile_branch_id,
    legacy.affected_branch_id,
    legacy.scan_event_id,
    case
      when legacy.profile_branch_id is null then array['missing_primary_branch']::text[]
      else array['wrong_qr_scan_only']::text[]
    end,
    jsonb_build_object('branch_id', legacy.profile_branch_id),
    'review_branch_assignment',
    coalesce(legacy.reason, 'Migrated from the legacy Branch Corrections inbox.'),
    coalesce(legacy.is_test, false),
    jsonb_build_object(
      'legacy_branch_correction_request_id', legacy.legacy_request_id,
      'qr_point_id', legacy.qr_point_id,
      'migrated_from', 'staff_branch_change_requests'
    ),
    legacy.created_at,
    now()
  from legacy_pending as legacy
  on conflict (dedupe_key) do update
  set profile_branch_id = excluded.profile_branch_id,
      affected_branch_id = excluded.affected_branch_id,
      scan_event_id = coalesce(excluded.scan_event_id, public.staff_branch_assignment_issues.scan_event_id),
      metadata = coalesce(public.staff_branch_assignment_issues.metadata, '{}'::jsonb)
        || excluded.metadata,
      updated_at = now()
  returning id, staff_id, affected_branch_id
)
update public.staff_branch_change_requests as request
set status = 'cancelled',
    resolution_status = 'resolved',
    reviewer_note = coalesce(
      nullif(request.reviewer_note, ''),
      'Migrated to the authoritative Branch Assignment Issues workflow.'
    ),
    metadata = coalesce(request.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'legacy_read_only', true,
        'migrated_to_assignment_issue_id', upserted.id,
        'migrated_at', now()
      ),
    updated_at = now()
from upserted
where request.staff_id = upserted.staff_id
  and request.requested_branch_id = upserted.affected_branch_id
  and request.status = 'pending';

-- Recover recent wrong-branch scan events that never reached either inbox.
with recent_scans as (
  select distinct on (event.staff_id, event.branch_id)
    event.staff_id,
    staff.branch_id as profile_branch_id,
    event.branch_id as affected_branch_id,
    event.id as scan_event_id,
    event.qr_point_id,
    event.message,
    event.created_at,
    coalesce((to_jsonb(event) ->> 'is_test')::boolean, false) as is_test
  from public.qr_scan_events as event
  join public.staff as staff on staff.id = event.staff_id
  where event.reason_code = 'wrong_branch'
    and event.created_at >= now() - interval '30 days'
    and event.staff_id is not null
    and event.branch_id is not null
    and staff.branch_id is distinct from event.branch_id
  order by event.staff_id, event.branch_id, event.created_at desc, event.id desc
)
insert into public.staff_branch_assignment_issues (
  staff_id,
  issue_source,
  status,
  dedupe_key,
  profile_branch_id,
  affected_branch_id,
  scan_event_id,
  root_causes,
  profile_branch_snapshot,
  next_action,
  reason,
  is_test,
  metadata,
  created_at,
  updated_at
)
select
  scan.staff_id,
  'attendance_scan',
  'open',
  concat(scan.staff_id::text, ':attendance_scan:', scan.affected_branch_id::text),
  scan.profile_branch_id,
  scan.affected_branch_id,
  scan.scan_event_id,
  case
    when scan.profile_branch_id is null then array['missing_primary_branch']::text[]
    else array['wrong_qr_scan_only']::text[]
  end,
  jsonb_build_object('branch_id', scan.profile_branch_id),
  'review_branch_assignment',
  coalesce(scan.message, 'Recovered from a wrong-branch Attendance scan.'),
  scan.is_test,
  jsonb_build_object(
    'qr_point_id', scan.qr_point_id,
    'scan_event_id', scan.scan_event_id,
    'backfilled_from', 'qr_scan_events'
  ),
  scan.created_at,
  now()
from recent_scans as scan
on conflict (dedupe_key) do update
set profile_branch_id = excluded.profile_branch_id,
    affected_branch_id = excluded.affected_branch_id,
    scan_event_id = excluded.scan_event_id,
    metadata = coalesce(public.staff_branch_assignment_issues.metadata, '{}'::jsonb)
      || excluded.metadata,
    updated_at = now();

comment on function public.capture_wrong_branch_assignment_issue() is
  'Creates only a branch-assignment issue from a wrong-branch scan. It never creates or replays Attendance.';

notify pgrst, 'reload schema';

commit;
