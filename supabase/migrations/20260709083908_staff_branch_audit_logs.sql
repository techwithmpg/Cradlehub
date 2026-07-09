-- =============================================================================
-- CradleHub — Branch Correction Audit Logs and Review Hardening
-- =============================================================================
-- Adds the dedicated audit table required by the QR wrong-branch correction
-- flow and tightens request indexes / approval validation.
-- =============================================================================

create table if not exists public.staff_branch_audit_logs (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  old_branch_id uuid null references public.branches(id) on delete set null,
  new_branch_id uuid not null references public.branches(id) on delete restrict,
  change_request_id uuid null references public.staff_branch_change_requests(id) on delete set null,
  changed_by_auth_user_id uuid null,
  changed_by_staff_id uuid null references public.staff(id) on delete set null,
  source text not null default 'branch_correction_request',
  reason text null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.staff_branch_audit_logs is
  'Append-only audit log for staff.branch_id changes made through controlled workflows.';

create index if not exists staff_branch_audit_logs_staff_id_idx
  on public.staff_branch_audit_logs (staff_id);

create index if not exists staff_branch_audit_logs_change_request_id_idx
  on public.staff_branch_audit_logs (change_request_id)
  where change_request_id is not null;

create index if not exists staff_branch_audit_logs_created_at_idx
  on public.staff_branch_audit_logs (created_at desc);

alter table public.staff_branch_audit_logs enable row level security;

drop policy if exists "staff_branch_audit_logs_select_owner_management"
  on public.staff_branch_audit_logs;
create policy "staff_branch_audit_logs_select_owner_management"
  on public.staff_branch_audit_logs
  for select
  to authenticated
  using (
    (select public.get_auth_role()) in ('owner', 'manager', 'assistant_manager', 'store_manager')
  );

drop policy if exists "staff_branch_audit_logs_select_new_branch"
  on public.staff_branch_audit_logs;
create policy "staff_branch_audit_logs_select_new_branch"
  on public.staff_branch_audit_logs
  for select
  to authenticated
  using (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and new_branch_id = (select public.get_auth_branch_id())
  );

drop policy if exists "staff_branch_audit_logs_select_own"
  on public.staff_branch_audit_logs;
create policy "staff_branch_audit_logs_select_own"
  on public.staff_branch_audit_logs
  for select
  to authenticated
  using (
    staff_id = (select public.get_auth_staff_id())
  );

revoke all on table public.staff_branch_audit_logs from anon;
grant select on table public.staff_branch_audit_logs to authenticated;
grant select, insert, update, delete on table public.staff_branch_audit_logs to service_role;

create index if not exists staff_branch_change_requests_requested_branch_id_idx
  on public.staff_branch_change_requests (requested_branch_id);

create index if not exists staff_branch_change_requests_status_idx
  on public.staff_branch_change_requests (status);

create index if not exists staff_branch_change_requests_created_at_idx
  on public.staff_branch_change_requests (created_at desc);

create or replace function public.review_staff_branch_change_request(
  p_request_id uuid,
  p_review_status text,
  p_reviewer_auth_user_id uuid,
  p_reviewer_staff_id uuid,
  p_reviewer_note text default null
)
returns table (
  request_id uuid,
  request_status text,
  staff_id uuid,
  previous_branch_id uuid,
  requested_branch_id uuid,
  reviewed_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_request public.staff_branch_change_requests%rowtype;
  v_reviewer record;
  v_staff record;
  v_requested_branch record;
  v_now timestamptz := now();
begin
  if p_review_status not in ('approved', 'rejected') then
    raise exception 'branch_correction_invalid_review_status'
      using errcode = '22023';
  end if;

  select id, auth_user_id, system_role, branch_id, is_active
  into v_reviewer
  from public.staff
  where id = p_reviewer_staff_id
    and auth_user_id = p_reviewer_auth_user_id
    and is_active = true;

  if not found then
    raise exception 'branch_correction_reviewer_not_found'
      using errcode = '28000';
  end if;

  select *
  into v_request
  from public.staff_branch_change_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'branch_correction_request_not_found'
      using errcode = 'P0002';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'branch_correction_request_not_pending'
      using errcode = 'P0001';
  end if;

  if v_reviewer.system_role not in ('owner', 'manager', 'assistant_manager', 'store_manager')
    and not (
      v_reviewer.system_role in ('crm', 'csr', 'csr_head', 'csr_staff')
      and v_reviewer.branch_id = v_request.requested_branch_id
    )
  then
    raise exception 'branch_correction_not_authorized'
      using errcode = '42501';
  end if;

  if p_review_status = 'approved' then
    select id, is_active
    into v_requested_branch
    from public.branches
    where id = v_request.requested_branch_id;

    if v_requested_branch.id is null or v_requested_branch.is_active is not true then
      raise exception 'branch_correction_requested_branch_inactive'
        using errcode = 'P0001';
    end if;
  end if;

  select id, branch_id, is_active
  into v_staff
  from public.staff
  where id = v_request.staff_id
  for update;

  if not found then
    raise exception 'branch_correction_staff_not_found'
      using errcode = 'P0002';
  end if;

  if p_review_status = 'approved' then
    if v_staff.branch_id is distinct from v_request.current_branch_id
      and v_staff.branch_id is distinct from v_request.requested_branch_id
    then
      raise exception 'branch_correction_staff_branch_changed'
        using errcode = 'P0001';
    end if;

    if v_staff.branch_id is distinct from v_request.requested_branch_id then
      update public.staff
         set branch_id = v_request.requested_branch_id,
             metadata = coalesce(metadata, '{}'::jsonb)
               || jsonb_build_object(
                 'branch_changed_at', v_now,
                 'branch_change_source', 'branch_correction_request',
                 'branch_change_request_id', v_request.id,
                 'previous_branch_id', v_staff.branch_id,
                 'requested_branch_id', v_request.requested_branch_id,
                 'reviewed_by_staff_id', p_reviewer_staff_id
               )
       where id = v_request.staff_id;
    end if;

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
    )
    values (
      v_request.staff_id,
      v_staff.branch_id,
      v_request.requested_branch_id,
      v_request.id,
      p_reviewer_auth_user_id,
      p_reviewer_staff_id,
      'branch_correction_request',
      coalesce(nullif(trim(p_reviewer_note), ''), v_request.reason),
      jsonb_build_object(
        'reviewed_by_role', v_reviewer.system_role,
        'request_source', v_request.request_source,
        'request_metadata', coalesce(v_request.metadata, '{}'::jsonb)
      )
    );
  end if;

  update public.staff_branch_change_requests
     set status = p_review_status,
         reviewed_by_auth_user_id = p_reviewer_auth_user_id,
         reviewed_by_staff_id = p_reviewer_staff_id,
         reviewed_at = v_now,
         reviewer_note = nullif(trim(p_reviewer_note), ''),
         metadata = coalesce(metadata, '{}'::jsonb)
           || jsonb_build_object(
             'reviewed_by_role', v_reviewer.system_role,
             'staff_branch_before_review', v_staff.branch_id,
             'staff_branch_after_review',
               case
                 when p_review_status = 'approved' then v_request.requested_branch_id
                 else v_staff.branch_id
               end
           )
   where id = v_request.id;

  request_id := v_request.id;
  request_status := p_review_status;
  staff_id := v_request.staff_id;
  previous_branch_id := v_staff.branch_id;
  requested_branch_id := v_request.requested_branch_id;
  reviewed_at := v_now;
  return next;
end;
$$;

comment on function public.review_staff_branch_change_request(uuid, text, uuid, uuid, text) is
  'Atomically reviews a pending branch correction request. Approval validates the requested active branch, updates staff.branch_id, writes an audit log, and lets the staff_devices sync trigger repair active devices.';

revoke execute on function public.review_staff_branch_change_request(uuid, text, uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.review_staff_branch_change_request(uuid, text, uuid, uuid, text)
to service_role;
