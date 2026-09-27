-- Forward migration recording live database repairs:
-- 1. Removal of obsolete 3-argument start_booking_service_session overload causing ambiguous function call errors.
-- 2. Canonical definition of resolve_service_session_actor(uuid) using auth.role() for service_role detection and auth.uid() for authenticated staff identity.

begin;

-- A: Drop obsolete compatibility overload
drop function if exists public.start_booking_service_session(uuid, text, uuid);

-- B: Canonical definition of resolve_service_session_actor(uuid)
create or replace function public.resolve_service_session_actor(
  p_actor_staff_id uuid default null
)
returns table (
  actor_staff_id uuid,
  actor_role text,
  actor_branch_id uuid,
  is_service_role boolean
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_claim_role text := coalesce(auth.role(), '');
begin
  if v_claim_role = 'service_role' then
    return query
    select
      case
        when exists (
          select 1
          from public.staff as actor_staff
          where actor_staff.id = p_actor_staff_id
        ) then p_actor_staff_id
        else null::uuid
      end,
      'service_role'::text,
      null::uuid,
      true;
    return;
  end if;

  return query
  select
    staff.id,
    staff.system_role,
    staff.branch_id,
    false
  from public.staff as staff
  where staff.auth_user_id = auth.uid()
    and staff.is_active = true
    and staff.archived_at is null
    and staff.merged_into_staff_id is null
  limit 1;
end;
$$;

comment on function public.resolve_service_session_actor(uuid) is
  'Resolves service session actor identity using auth.role() for service_role and auth.uid() for authenticated staff.';

revoke all on function public.resolve_service_session_actor(uuid)
  from public, anon;
grant execute on function public.resolve_service_session_actor(uuid)
  to authenticated, service_role;

commit;

notify pgrst, 'reload schema';
