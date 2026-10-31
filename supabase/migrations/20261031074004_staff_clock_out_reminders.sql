-- Personal Staff PWA reminders. The existing CRM Closing processor remains authoritative.
-- Apply only after target classification, schema review, and owner release approval.
create index if not exists staff_shift_checkins_staff_reminder_due_idx
  on public.staff_shift_checkins (latest_normal_clock_out_at, id)
  where status = 'checked_in'
    and checked_out_at is null
    and is_test = false
    and latest_normal_clock_out_at is not null;
create index if not exists workspace_notifications_staff_reminder_key_idx
  on public.workspace_notifications (dedupe_key)
  where type = 'attendance_clock_out_reminder' and dedupe_key is not null;

-- Activation is a separate owner-approved operation and prevents old backlog.
create table public.attendance_staff_reminder_activation (
  id boolean primary key default true check (id),
  activated_at timestamptz not null
);
alter table public.attendance_staff_reminder_activation enable row level security;
revoke all on public.attendance_staff_reminder_activation from public, anon, authenticated;

-- A bounded pass rotates previously examined, legitimately active shifts behind
-- unexamined shifts so old active work cannot starve new due staff.
create table public.attendance_staff_reminder_checks (
  checkin_id uuid primary key references public.staff_shift_checkins(id) on delete cascade,
  checked_at timestamptz not null
);
alter table public.attendance_staff_reminder_checks enable row level security;
revoke all on public.attendance_staff_reminder_checks from public, anon, authenticated;

create or replace function public.process_due_staff_clock_out_reminders(
  p_processed_at timestamptz default now(),
  p_batch_size integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_checkin record;
  v_policy jsonb;
  v_workspace text;
  v_due_at timestamptz;
  v_examined integer := 0;
  v_sent integer := 0;
  v_key text;
  v_activated_at timestamptz;
begin
  if p_processed_at is null or p_batch_size is null or p_batch_size < 1 or p_batch_size > 100 then
    raise exception 'Invalid staff reminder batch.';
  end if;
  select activated_at into v_activated_at
  from public.attendance_staff_reminder_activation where id = true;
  if v_activated_at is null then
    return jsonb_build_object('examined', 0, 'sent', 0, 'inactive', true);
  end if;

  for v_checkin in
    select checkin.id, checkin.branch_id, checkin.staff_id,
           staff.system_role, staff.staff_type
    from public.staff_shift_checkins as checkin
    left join public.attendance_staff_reminder_checks as prior
      on prior.checkin_id = checkin.id
    join public.staff as staff on staff.id = checkin.staff_id
    join public.branches as branch on branch.id = checkin.branch_id
    where checkin.status = 'checked_in'
      and checkin.checked_out_at is null
      and checkin.is_test = false
      and checkin.provisional_auto_closed_at is null
      and checkin.latest_normal_clock_out_at <= p_processed_at
      and checkin.latest_normal_clock_out_at >= v_activated_at
      and checkin.attendance_policy_source <> 'crm_closing'
      and not exists (
        select 1 from public.workspace_notifications as issued
        where issued.dedupe_key = 'staff-clock-out-reminder:' || checkin.id::text
      )
      and not exists (
        select 1 from public.attendance_exceptions as reviewed
        where reviewed.checkin_id = checkin.id
          and reviewed.branch_id = checkin.branch_id
          and reviewed.staff_id = checkin.staff_id
          and reviewed.exception_type = 'missed_checkout'
          and reviewed.status = 'open'
          and reviewed.resolution_status = 'reviewed'
          and reviewed.reviewed_by is not null
          and reviewed.reviewed_at is not null
      )
      and staff.is_active = true
      and staff.archived_at is null
      and staff.merged_into_staff_id is null
      and staff.auth_user_id is not null
      and staff.branch_id = checkin.branch_id
      and staff.system_role in ('staff', 'service_staff', 'service_head',
                                'driver', 'utility', 'crm', 'csr', 'csr_head', 'csr_staff')
      and branch.is_active = true
    order by prior.checked_at nulls first, checkin.latest_normal_clock_out_at, checkin.id
    for update of checkin skip locked
    limit p_batch_size
  loop
    v_examined := v_examined + 1;
    insert into public.attendance_staff_reminder_checks (checkin_id, checked_at)
    values (v_checkin.id, p_processed_at)
    on conflict (checkin_id) do update set checked_at = excluded.checked_at;
    -- Re-resolve assignments and the dynamic deadline under the open-record lock.
    v_policy := public.recalculate_attendance_clock_out_policy(v_checkin.id, p_processed_at);
    v_due_at := nullif(v_policy->>'latest_normal_clock_out_at', '')::timestamptz;
    if v_due_at is null or v_due_at > p_processed_at
       or coalesce((v_policy->>'has_active_assignment')::boolean, true)
       or coalesce((v_policy->>'has_upcoming_assignment')::boolean, true) then
      continue;
    end if;

    v_workspace := case
      when v_checkin.system_role = 'driver' or lower(coalesce(v_checkin.staff_type, '')) = 'driver' then 'driver'
      when v_checkin.system_role = 'utility' or lower(coalesce(v_checkin.staff_type, '')) = 'utility' then 'utility'
      when v_checkin.system_role in ('crm', 'csr', 'csr_head', 'csr_staff') then 'crm'
      else 'staff'
    end;
    v_key := 'staff-clock-out-reminder:' || v_checkin.id::text;
    if exists (select 1 from public.workspace_notifications as notification
               where notification.dedupe_key = v_key) then
      continue;
    end if;
    if exists (
      select 1 from public.attendance_exceptions as reviewed
      where reviewed.checkin_id = v_checkin.id
        and reviewed.branch_id = v_checkin.branch_id
        and reviewed.staff_id = v_checkin.staff_id
        and reviewed.exception_type = 'missed_checkout'
        and reviewed.status = 'open'
        and reviewed.resolution_status = 'reviewed'
        and reviewed.reviewed_by is not null
        and reviewed.reviewed_at is not null
    ) then
      continue;
    end if;

    insert into public.workspace_notifications (
      branch_id, target_workspace, target_role, recipient_staff_id,
      type, title, body, entity_type, entity_id, action_href,
      priority, status, requires_action, dedupe_key, metadata, created_at
    ) values (
      v_checkin.branch_id, v_workspace, null, v_checkin.staff_id,
      'attendance_clock_out_reminder', 'You forgot to clock out',
      'Your expected shift has ended, but your attendance is still open. Please clock out if eligible or contact CRM for assistance.',
      'attendance_record', v_checkin.id, '/staff-portal/attendance',
      'normal', 'unread', false, v_key,
      jsonb_build_object('attendance_business_date',
        v_policy->'attendance_policy_snapshot'->'attendanceBusinessDate'),
      p_processed_at
    ) on conflict do nothing;
    if found then v_sent := v_sent + 1; end if;
  end loop;

  return jsonb_build_object('examined', v_examined, 'sent', v_sent);
end;
$$;

revoke all on function public.process_due_staff_clock_out_reminders(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.process_due_staff_clock_out_reminders(timestamptz, integer)
  to service_role;

-- Completion through QR, portal, correction, or provisional close all changes
-- the canonical record and must resolve its outstanding reminder.
create or replace function public.resolve_attendance_reminder_on_completion()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.status = 'checked_in'
     and (new.status <> 'checked_in' or new.checked_out_at is not null) then
    update public.workspace_notifications
    set status = 'resolved', resolved_at = now(), requires_action = false,
        metadata = metadata || jsonb_build_object(
          'attendance_resolution', case
            when new.provisional_auto_closed_at is not null then 'provisionally_closed'
            else 'clocked_out'
          end
        )
    where type = 'attendance_clock_out_reminder'
      and entity_type = 'attendance_record'
      and entity_id = new.id
      and status in ('unread', 'read')
      and resolved_at is null;
    delete from public.attendance_staff_reminder_checks
    where checkin_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.resolve_attendance_reminder_on_completion()
  from public, anon, authenticated;
create trigger resolve_attendance_reminder_on_completion
  after update of checked_out_at, status on public.staff_shift_checkins
  for each row
  execute function public.resolve_attendance_reminder_on_completion();

-- Reviewing a linked exception acknowledges the notice without changing the
-- canonical attendance record. The exception update and notice resolution are
-- atomic; a repeated review cannot resolve the same notice twice.
create or replace function public.resolve_attendance_reminder_on_review()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'open'
     and new.exception_type = 'missed_checkout'
     and new.resolution_status = 'reviewed'
     and new.reviewed_by is not null
     and new.reviewed_at is not null
     and (old.resolution_status is distinct from new.resolution_status
          or old.reviewed_at is distinct from new.reviewed_at)
     and new.checkin_id is not null then
    perform 1 from public.staff_shift_checkins as checkin
    where checkin.id = new.checkin_id for update;
    update public.workspace_notifications as notice
    set status = 'resolved', resolved_at = new.reviewed_at,
        requires_action = false, actor_staff_id = new.reviewed_by,
        metadata = notice.metadata || jsonb_build_object(
          'attendance_resolution', 'exception_reviewed',
          'attendance_exception_id', new.id,
          'reviewed_by', new.reviewed_by
        )
    where notice.type = 'attendance_clock_out_reminder'
      and notice.entity_type = 'attendance_record'
      and notice.entity_id = new.checkin_id
      and notice.branch_id = new.branch_id
      and notice.recipient_staff_id = new.staff_id
      and notice.status in ('unread', 'read')
      and notice.resolved_at is null;
  end if;
  return new;
end;
$$;
revoke all on function public.resolve_attendance_reminder_on_review()
  from public, anon, authenticated;
create trigger resolve_attendance_reminder_on_review
  after update of resolution_status, reviewed_by, reviewed_at
  on public.attendance_exceptions
  for each row
  execute function public.resolve_attendance_reminder_on_review();

-- Existing CRM branch-wide policies otherwise expose personal CRM notices to
-- coworkers. Preserve broad access to legacy Closing notices.
drop policy if exists notif_crm_branch on public.workspace_notifications;
create policy notif_crm_branch
  on public.workspace_notifications for select to authenticated
  using (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and target_workspace = 'crm'
    and branch_id = (select public.get_auth_branch_id())
    and (dedupe_key is null or dedupe_key not like 'staff-clock-out-reminder:%')
  );
drop policy if exists notif_crm_branch_update on public.workspace_notifications;
create policy notif_crm_branch_update
  on public.workspace_notifications for update to authenticated
  using (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and target_workspace = 'crm'
    and branch_id = (select public.get_auth_branch_id())
    and (dedupe_key is null or dedupe_key not like 'staff-clock-out-reminder:%')
  )
  with check (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and target_workspace = 'crm'
    and branch_id = (select public.get_auth_branch_id())
    and (dedupe_key is null or dedupe_key not like 'staff-clock-out-reminder:%')
  );

-- Legacy role/type combinations can render a different mobile workspace than
-- system_role alone. A reminder is accessible only to its own recipient.
create policy attendance_reminder_recipient_read
  on public.workspace_notifications for select to authenticated
  using (
    type = 'attendance_clock_out_reminder'
    and dedupe_key like 'staff-clock-out-reminder:%'
    and recipient_staff_id = (select public.get_auth_staff_id())
    and branch_id = (select public.get_auth_branch_id())
  );

create policy attendance_reminder_recipient_update
  on public.workspace_notifications for update to authenticated
  using (
    type = 'attendance_clock_out_reminder'
    and dedupe_key like 'staff-clock-out-reminder:%'
    and recipient_staff_id = (select public.get_auth_staff_id())
    and branch_id = (select public.get_auth_branch_id())
  )
  with check (
    type = 'attendance_clock_out_reminder'
    and dedupe_key like 'staff-clock-out-reminder:%'
    and recipient_staff_id = (select public.get_auth_staff_id())
    and branch_id = (select public.get_auth_branch_id())
  );
