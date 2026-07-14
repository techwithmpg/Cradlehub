-- ATTENDANCE-STAFF-SELF-SERVICE-001
-- Staff-requested attendance phone registration with CRM review and same-phone activation.

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

    select count(*) into v_active_count from public.staff_devices
      where staff_id = v_request.staff_id and status = 'active';

    if v_request.request_type = 'replacement' then
      select * into v_replacement from public.staff_devices
      where id = p_replacement_device_id and staff_id = v_request.staff_id
        and branch_id = v_request.branch_id and status = 'active' for update;
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
