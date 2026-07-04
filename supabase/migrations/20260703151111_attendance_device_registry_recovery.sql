-- ATTENDANCE-DEVICE-REGISTRY-005
-- Extend the existing Attendance device/token tables for registry and recovery.

create extension if not exists pgcrypto with schema extensions;

-- ─── staff_devices registry fields ──────────────────────────────────────────

alter table public.staff_devices
  add column if not exists registration_source text not null default 'first_scan_activation',
  add column if not exists browser_name text,
  add column if not exists browser_version text,
  add column if not exists platform_name text,
  add column if not exists last_attendance_scan_at timestamptz,
  add column if not exists last_service_scan_at timestamptz,
  add column if not exists revocation_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'staff_devices_registration_source_check'
      and conrelid = 'public.staff_devices'::regclass
  ) then
    alter table public.staff_devices
      add constraint staff_devices_registration_source_check
      check (registration_source in (
        'first_scan_activation',
        'device_recovery',
        'crm_assisted_activation'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'staff_devices_device_label_length_check'
      and conrelid = 'public.staff_devices'::regclass
  ) then
    alter table public.staff_devices
      add constraint staff_devices_device_label_length_check
      check (device_label is null or char_length(device_label) <= 60);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'staff_devices_revocation_reason_check'
      and conrelid = 'public.staff_devices'::regclass
  ) then
    alter table public.staff_devices
      add constraint staff_devices_revocation_reason_check
      check (
        revocation_reason is null
        or revocation_reason in (
          'lost_phone',
          'replacement_phone',
          'shared_device',
          'security_concern',
          'staff_request',
          'browser_reset',
          'other'
        )
      );
  end if;
end $$;

create index if not exists staff_devices_staff_idx
  on public.staff_devices(staff_id);

create index if not exists staff_devices_branch_idx
  on public.staff_devices(branch_id);

create index if not exists staff_devices_active_staff_idx
  on public.staff_devices(staff_id)
  where status = 'active';

create index if not exists staff_devices_last_seen_idx
  on public.staff_devices(last_seen_at desc);

-- ─── device_activation_tokens recovery fields ───────────────────────────────

alter table public.device_activation_tokens
  add column if not exists purpose text not null default 'first_scan_activation',
  add column if not exists reason text,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references public.staff(id) on delete set null,
  add column if not exists revoke_previous_device_id uuid references public.staff_devices(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'device_activation_tokens_purpose_check'
      and conrelid = 'public.device_activation_tokens'::regclass
  ) then
    alter table public.device_activation_tokens
      add constraint device_activation_tokens_purpose_check
      check (purpose in (
        'first_scan_activation',
        'device_recovery',
        'crm_assisted_activation'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'device_activation_tokens_reason_check'
      and conrelid = 'public.device_activation_tokens'::regclass
  ) then
    alter table public.device_activation_tokens
      add constraint device_activation_tokens_reason_check
      check (
        reason is null
        or reason in (
          'browser_data_cleared',
          'replacement_phone',
          'lost_phone',
          'device_cookie_expired',
          'support_recovery',
          'security_concern',
          'other'
        )
      );
  end if;
end $$;

drop trigger if exists trg_device_activation_tokens_updated_at on public.device_activation_tokens;
create trigger trg_device_activation_tokens_updated_at
  before update on public.device_activation_tokens
  for each row execute function public.fn_update_updated_at();

create index if not exists device_activation_tokens_branch_idx
  on public.device_activation_tokens(branch_id);

create index if not exists device_activation_tokens_staff_branch_idx
  on public.device_activation_tokens(staff_id, branch_id);

create index if not exists device_activation_tokens_expires_idx
  on public.device_activation_tokens(expires_at);

create index if not exists device_activation_tokens_recovery_pending_idx
  on public.device_activation_tokens(staff_id, branch_id, expires_at desc)
  where purpose = 'device_recovery'
    and used_at is null
    and revoked_at is null;

create index if not exists device_activation_tokens_revoked_idx
  on public.device_activation_tokens(revoked_at)
  where revoked_at is not null;

-- ─── Atomic device recovery consumption ─────────────────────────────────────

create or replace function public.consume_attendance_device_recovery(
  p_raw_token text,
  p_device_fingerprint_hash text,
  p_device_label text default null,
  p_user_agent text default null,
  p_browser_name text default null,
  p_browser_version text default null,
  p_platform_name text default null,
  p_active_device_limit integer default 2
)
returns table (
  success boolean,
  code text,
  message text,
  device_id uuid,
  staff_id uuid,
  staff_name text,
  staff_type text,
  branch_id uuid,
  branch_name text,
  expires_at timestamptz
)
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_token public.device_activation_tokens%rowtype;
  v_staff public.staff%rowtype;
  v_branch public.branches%rowtype;
  v_previous public.staff_devices%rowtype;
  v_active_count integer;
  v_effective_active_count integer;
  v_limit integer := greatest(coalesce(p_active_device_limit, 2), 1);
  v_device_id uuid;
  v_now timestamptz := now();
  v_token_hash text;
  v_revocation_reason text;
begin
  if nullif(trim(coalesce(p_raw_token, '')), '') is null then
    return query select false, 'invalid_token', 'Recovery link is invalid.', null::uuid, null::uuid, null::text, null::text, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  if nullif(trim(coalesce(p_device_fingerprint_hash, '')), '') is null then
    return query select false, 'device_hash_missing', 'This phone could not be identified.', null::uuid, null::uuid, null::text, null::text, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  v_token_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

  select token_row.*
    into v_token
  from public.device_activation_tokens as token_row
  where token_row.token_hash = v_token_hash
  for update;

  if not found then
    return query select false, 'invalid_token', 'Recovery link is invalid.', null::uuid, null::uuid, null::text, null::text, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  if v_token.purpose <> 'device_recovery' then
    return query select false, 'invalid_token', 'Recovery link is invalid.', null::uuid, v_token.staff_id, null::text, null::text, v_token.branch_id, null::text, v_token.expires_at;
    return;
  end if;

  if v_token.used_at is not null then
    return query select false, 'token_used', 'Recovery link was already used.', null::uuid, v_token.staff_id, null::text, null::text, v_token.branch_id, null::text, v_token.expires_at;
    return;
  end if;

  if v_token.revoked_at is not null then
    return query select false, 'token_revoked', 'Recovery link was revoked.', null::uuid, v_token.staff_id, null::text, null::text, v_token.branch_id, null::text, v_token.expires_at;
    return;
  end if;

  if v_token.expires_at <= v_now then
    return query select false, 'token_expired', 'Recovery link has expired.', null::uuid, v_token.staff_id, null::text, null::text, v_token.branch_id, null::text, v_token.expires_at;
    return;
  end if;

  select staff_row.*
    into v_staff
  from public.staff as staff_row
  where staff_row.id = v_token.staff_id
  for update;

  if not found or v_staff.is_active is false then
    return query select false, 'staff_inactive', 'Staff account is inactive.', null::uuid, v_token.staff_id, null::text, null::text, v_token.branch_id, null::text, v_token.expires_at;
    return;
  end if;

  select branch_row.*
    into v_branch
  from public.branches as branch_row
  where branch_row.id = v_token.branch_id
  for update;

  if not found or v_branch.is_active is false or v_staff.branch_id <> v_token.branch_id then
    return query select false, 'branch_unavailable', 'Branch is unavailable for this staff member.', null::uuid, v_staff.id, v_staff.full_name, v_staff.staff_type, v_token.branch_id, null::text, v_token.expires_at;
    return;
  end if;

  select count(*)
    into v_active_count
  from public.staff_devices
  where staff_id = v_token.staff_id
    and status = 'active';

  v_effective_active_count := v_active_count;

  if v_token.revoke_previous_device_id is not null then
    select previous_row.*
      into v_previous
    from public.staff_devices as previous_row
    where previous_row.id = v_token.revoke_previous_device_id
      and previous_row.staff_id = v_token.staff_id
      and previous_row.status = 'active'
    for update;

    if not found then
      return query select false, 'previous_device_invalid', 'Previous device is no longer active.', null::uuid, v_staff.id, v_staff.full_name, v_staff.staff_type, v_branch.id, v_branch.name, v_token.expires_at;
      return;
    end if;

    v_effective_active_count := greatest(v_active_count - 1, 0);
  end if;

  if v_effective_active_count + 1 > v_limit then
    return query select false, 'device_limit_reached', 'Active device limit reached.', null::uuid, v_staff.id, v_staff.full_name, v_staff.staff_type, v_branch.id, v_branch.name, v_token.expires_at;
    return;
  end if;

  insert into public.staff_devices (
    staff_id,
    branch_id,
    device_fingerprint_hash,
    device_label,
    status,
    trusted_after,
    last_seen_at,
    registration_source,
    browser_name,
    browser_version,
    platform_name,
    metadata
  )
  values (
    v_token.staff_id,
    v_token.branch_id,
    p_device_fingerprint_hash,
    coalesce(nullif(trim(p_device_label), ''), 'Recovered attendance device'),
    'active',
    v_now,
    v_now,
    'device_recovery',
    nullif(trim(coalesce(p_browser_name, '')), ''),
    nullif(trim(coalesce(p_browser_version, '')), ''),
    nullif(trim(coalesce(p_platform_name, '')), ''),
    jsonb_build_object(
      'source', 'device_recovery',
      'activation_token_id', v_token.id,
      'user_agent', p_user_agent
    )
  )
  returning id into v_device_id;

  update public.device_activation_tokens
  set used_at = v_now,
      used_by_device_id = v_device_id,
      updated_at = v_now
  where id = v_token.id;

  if v_token.revoke_previous_device_id is not null then
    v_revocation_reason := case v_token.reason
      when 'lost_phone' then 'lost_phone'
      when 'replacement_phone' then 'replacement_phone'
      when 'security_concern' then 'security_concern'
      when 'browser_data_cleared' then 'browser_reset'
      when 'device_cookie_expired' then 'browser_reset'
      else 'other'
    end;

    update public.staff_devices
    set status = 'revoked',
        revoked_at = v_now,
        revoked_by = v_token.requested_by,
        revocation_reason = v_revocation_reason,
        updated_at = v_now,
        metadata = metadata || jsonb_build_object('revoked_by_recovery_token_id', v_token.id)
    where id = v_token.revoke_previous_device_id;
  end if;

  insert into public.qr_scan_events (
    branch_id,
    staff_id,
    device_id,
    scan_type,
    action,
    outcome,
    reason_code,
    message,
    user_agent,
    metadata
  )
  values (
    v_token.branch_id,
    v_token.staff_id,
    v_device_id,
    'activation',
    'device_recovery_completed',
    'success',
    'device_recovery',
    'Attendance device recovery completed.',
    p_user_agent,
    jsonb_build_object('activation_token_id', v_token.id)
  );

  return query select true, 'ok', 'Phone connected successfully.', v_device_id, v_staff.id, v_staff.full_name, v_staff.staff_type, v_branch.id, v_branch.name, v_token.expires_at;
end;
$$;

revoke all on function public.consume_attendance_device_recovery(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer
) from public;

revoke all on function public.consume_attendance_device_recovery(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer
) from anon;

revoke all on function public.consume_attendance_device_recovery(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer
) from authenticated;

grant execute on function public.consume_attendance_device_recovery(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer
) to service_role;
