-- Forward-only reconciliation of the current production review RPC for new environments.
-- Catalog source: classified CradleHub production, public.review_staff_device_registration_request,
-- read-only pg_get_functiondef on 2026-11-02. The 20260714050554 migration remains untouched.
-- This migration is not part of the PR58 production apply set; the live RPC already has this body.

CREATE OR REPLACE FUNCTION public.review_staff_device_registration_request(p_request_id uuid, p_review_status text, p_reviewer_auth_user_id uuid, p_reviewer_staff_id uuid, p_reviewer_note text DEFAULT NULL::text, p_rejection_reason text DEFAULT NULL::text, p_replacement_device_id uuid DEFAULT NULL::uuid, p_token_hash text DEFAULT NULL::text, p_token_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_active_device_limit integer DEFAULT 2)
 RETURNS TABLE(request_id uuid, request_status text, staff_id uuid, branch_id uuid, activation_token_id uuid, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_request public.staff_device_registration_requests%rowtype;
  v_reviewer public.staff%rowtype;
  v_target public.staff%rowtype;
  v_replacement public.staff_devices%rowtype;

  v_token_id uuid;
  v_now timestamptz := clock_timestamp();
  v_active_count integer;
begin
  if p_review_status not in ('approved', 'rejected') then
    raise exception 'device_request_invalid_review_status'
      using errcode = '22023';
  end if;

  select reviewer_row.*
  into v_reviewer
  from public.staff as reviewer_row
  where reviewer_row.id = p_reviewer_staff_id
    and reviewer_row.auth_user_id = p_reviewer_auth_user_id
    and reviewer_row.is_active = true
    and reviewer_row.archived_at is null
    and reviewer_row.merged_into_staff_id is null;

  if not found then
    raise exception 'device_request_reviewer_not_found'
      using errcode = '28000';
  end if;

  select request_row.*
  into v_request
  from public.staff_device_registration_requests as request_row
  where request_row.id = p_request_id
  for update;

  if not found then
    raise exception 'device_request_not_found'
      using errcode = 'P0002';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'device_request_not_pending'
      using errcode = 'P0001';
  end if;

  if v_reviewer.system_role <> 'owner'
    and not (
      v_reviewer.system_role in (
        'manager',
        'assistant_manager',
        'store_manager',
        'crm',
        'csr',
        'csr_head',
        'csr_staff'
      )
      and v_reviewer.branch_id = v_request.branch_id
    )
  then
    raise exception 'device_request_not_authorized'
      using errcode = '42501';
  end if;

  select target_row.*
  into v_target
  from public.staff as target_row
  where target_row.id = v_request.staff_id
  for update;

  if not found
    or v_target.is_active is not true
    or v_target.archived_at is not null
    or v_target.merged_into_staff_id is not null
  then
    raise exception 'device_request_staff_inactive'
      using errcode = 'P0001';
  end if;

  if v_target.branch_id is distinct from v_request.branch_id then
    raise exception 'device_request_branch_changed'
      using errcode = 'P0001';
  end if;

  if p_review_status = 'rejected' then
    if p_rejection_reason not in (
      'unable_to_verify_request',
      'device_limit_reached',
      'shared_phone_not_permitted',
      'staff_account_inactive',
      'security_concern',
      'other'
    ) then
      raise exception 'device_request_rejection_reason_required'
        using errcode = '22023';
    end if;

    update public.staff_device_registration_requests as request_row
    set
      status = 'rejected',
      reviewed_by_staff_id = p_reviewer_staff_id,
      reviewed_at = v_now,
      reviewer_note = nullif(trim(p_reviewer_note), ''),
      rejection_reason = p_rejection_reason,
      expires_at = null
    where request_row.id = v_request.id;

  else
    if nullif(trim(coalesce(p_token_hash, '')), '') is null
      or p_token_expires_at is null
      or p_token_expires_at <= v_now
    then
      raise exception 'device_request_activation_token_required'
        using errcode = '22023';
    end if;

    -- FIX:
    -- Qualify staff_id with the staff_devices table alias.
    select count(*)
    into v_active_count
    from public.staff_devices as device_row
    where device_row.staff_id = v_request.staff_id
      and device_row.status = 'active';

    if v_request.request_type = 'replacement' then
      -- FIX:
      -- Qualify id, staff_id, branch_id and status.
      select device_row.*
      into v_replacement
      from public.staff_devices as device_row
      where device_row.id = p_replacement_device_id
        and device_row.staff_id = v_request.staff_id
        and device_row.branch_id = v_request.branch_id
        and device_row.status = 'active'
      for update;

      if not found then
        raise exception 'device_request_replacement_required'
          using errcode = '22023';
      end if;

    elsif v_active_count >= greatest(
      coalesce(p_active_device_limit, 2),
      1
    ) then
      raise exception 'device_request_limit_reached'
        using errcode = 'P0001';
    end if;

    insert into public.device_activation_tokens (
      staff_id,
      branch_id,
      token_hash,
      expires_at,
      requested_by,
      purpose,
      reason,
      revoke_previous_device_id,
      metadata
    )
    values (
      v_request.staff_id,
      v_request.branch_id,
      p_token_hash,
      p_token_expires_at,
      p_reviewer_staff_id,
      'crm_assisted_activation',
      case
        when v_request.request_type = 'replacement'
          then 'replacement_phone'
        else 'support_recovery'
      end,
      case
        when v_request.request_type = 'replacement'
          then p_replacement_device_id
        else null
      end,
      jsonb_build_object(
        'source',
        'staff_portal_device_request',
        'request_id',
        v_request.id
      )
    )
    returning id into v_token_id;

    update public.staff_device_registration_requests as request_row
    set
      status = 'approved',
      reviewed_by_staff_id = p_reviewer_staff_id,
      reviewed_at = v_now,
      reviewer_note = nullif(trim(p_reviewer_note), ''),
      rejection_reason = null,
      replacement_device_id = p_replacement_device_id,
      activation_token_id = v_token_id,
      expires_at = p_token_expires_at
    where request_row.id = v_request.id;
  end if;

  return query
  select
    v_request.id,
    p_review_status,
    v_request.staff_id,
    v_request.branch_id,
    v_token_id,
    case
      when p_review_status = 'approved'
        then p_token_expires_at
      else null
    end;
end;
$function$;

-- Preserve the observed production EXECUTE boundary.
revoke all on function public.review_staff_device_registration_request(
  uuid, text, uuid, uuid, text, text, uuid, text, timestamptz, integer
) from public, anon, authenticated;
grant execute on function public.review_staff_device_registration_request(
  uuid, text, uuid, uuid, text, text, uuid, text, timestamptz, integer
) to service_role;
