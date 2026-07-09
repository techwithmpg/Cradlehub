-- =============================================================================
-- CradleHub — Branch Correction Requests
-- =============================================================================
-- Safe recovery flow for Attendance QR wrong-branch blocks.
--
-- Staff can request correction to the scanned QR branch. They do not update
-- staff.branch_id directly. CRM/front-desk users can see requests for their
-- requested branch; owner/management roles can see all requests. Approval is
-- handled by a service-role Server Action through the transactional review RPC.
-- =============================================================================

create table if not exists public.staff_branch_change_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null,
  current_branch_id uuid null,
  requested_branch_id uuid not null,
  qr_point_id uuid null,
  scan_event_id uuid null,
  requested_by_auth_user_id uuid null,
  requested_by_staff_id uuid null,
  request_source text not null default 'qr_wrong_branch',
  reason text null,
  status text not null default 'pending',
  reviewed_by_auth_user_id uuid null,
  reviewed_by_staff_id uuid null,
  reviewed_at timestamptz null,
  reviewer_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,

  constraint staff_branch_change_requests_staff_id_fkey
    foreign key (staff_id)
    references public.staff(id)
    on delete cascade,
  constraint staff_branch_change_requests_current_branch_id_fkey
    foreign key (current_branch_id)
    references public.branches(id)
    on delete set null,
  constraint staff_branch_change_requests_requested_branch_id_fkey
    foreign key (requested_branch_id)
    references public.branches(id)
    on delete restrict,
  constraint staff_branch_change_requests_qr_point_id_fkey
    foreign key (qr_point_id)
    references public.qr_points(id)
    on delete set null,
  constraint staff_branch_change_requests_scan_event_id_fkey
    foreign key (scan_event_id)
    references public.qr_scan_events(id)
    on delete set null,
  constraint staff_branch_change_requests_requested_by_staff_id_fkey
    foreign key (requested_by_staff_id)
    references public.staff(id)
    on delete set null,
  constraint staff_branch_change_requests_reviewed_by_staff_id_fkey
    foreign key (reviewed_by_staff_id)
    references public.staff(id)
    on delete set null,
  constraint staff_branch_change_requests_status_check
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  constraint staff_branch_change_requests_branch_change_check
    check (current_branch_id is null or current_branch_id <> requested_branch_id)
);

comment on table public.staff_branch_change_requests is
  'Branch correction request and review audit trail for Attendance QR wrong-branch recovery.';
comment on column public.staff_branch_change_requests.requested_branch_id is
  'The scanned/requested branch whose CRM inbox can review this request.';
comment on column public.staff_branch_change_requests.metadata is
  'JSONB audit context such as scanned QR public code, branch ids before review, and source notes.';

drop trigger if exists trg_staff_branch_change_requests_updated_at
  on public.staff_branch_change_requests;
create trigger trg_staff_branch_change_requests_updated_at
  before update on public.staff_branch_change_requests
  for each row execute function public.fn_update_updated_at();

create index if not exists staff_branch_change_requests_staff_id_idx
  on public.staff_branch_change_requests (staff_id);

create index if not exists staff_branch_change_requests_current_branch_id_idx
  on public.staff_branch_change_requests (current_branch_id)
  where current_branch_id is not null;

create index if not exists staff_branch_change_requests_requested_branch_status_idx
  on public.staff_branch_change_requests (requested_branch_id, status, created_at desc);

create index if not exists staff_branch_change_requests_qr_point_id_idx
  on public.staff_branch_change_requests (qr_point_id)
  where qr_point_id is not null;

create index if not exists staff_branch_change_requests_scan_event_id_idx
  on public.staff_branch_change_requests (scan_event_id)
  where scan_event_id is not null;

create index if not exists staff_branch_change_requests_requested_by_staff_id_idx
  on public.staff_branch_change_requests (requested_by_staff_id)
  where requested_by_staff_id is not null;

create index if not exists staff_branch_change_requests_reviewed_by_staff_id_idx
  on public.staff_branch_change_requests (reviewed_by_staff_id)
  where reviewed_by_staff_id is not null;

create unique index if not exists staff_branch_change_requests_one_pending_per_staff_branch_idx
  on public.staff_branch_change_requests (staff_id, requested_branch_id)
  where status = 'pending';

alter table public.staff_branch_change_requests enable row level security;

drop policy if exists "staff_branch_change_requests_select_owner_management"
  on public.staff_branch_change_requests;
create policy "staff_branch_change_requests_select_owner_management"
  on public.staff_branch_change_requests
  for select
  to authenticated
  using (
    (select public.get_auth_role()) in ('owner', 'manager', 'assistant_manager', 'store_manager')
  );

drop policy if exists "staff_branch_change_requests_select_requested_branch"
  on public.staff_branch_change_requests;
create policy "staff_branch_change_requests_select_requested_branch"
  on public.staff_branch_change_requests
  for select
  to authenticated
  using (
    (select public.get_auth_role()) in ('crm', 'csr', 'csr_head', 'csr_staff')
    and requested_branch_id = (select public.get_auth_branch_id())
  );

drop policy if exists "staff_branch_change_requests_select_own"
  on public.staff_branch_change_requests;
create policy "staff_branch_change_requests_select_own"
  on public.staff_branch_change_requests
  for select
  to authenticated
  using (
    staff_id = (select public.get_auth_staff_id())
  );

drop policy if exists "staff_branch_change_requests_insert_own_pending"
  on public.staff_branch_change_requests;
create policy "staff_branch_change_requests_insert_own_pending"
  on public.staff_branch_change_requests
  for insert
  to authenticated
  with check (
    status = 'pending'
    and request_source = 'qr_wrong_branch'
    and requested_by_auth_user_id = (select auth.uid())
    and staff_id = (select public.get_auth_staff_id())
    and requested_by_staff_id = (select public.get_auth_staff_id())
    and current_branch_id = (select public.get_auth_branch_id())
    and current_branch_id <> requested_branch_id
  );

revoke all on table public.staff_branch_change_requests from anon;
grant select, insert on table public.staff_branch_change_requests to authenticated;
grant select, insert, update, delete on table public.staff_branch_change_requests to service_role;

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
  'Atomically reviews a pending branch correction request. Approval updates staff.branch_id, which triggers staff_devices branch sync.';

revoke execute on function public.review_staff_branch_change_request(uuid, text, uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.review_staff_branch_change_request(uuid, text, uuid, uuid, text)
to service_role;
