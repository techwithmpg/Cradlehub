-- Staff camera attendance navigation grants. No attendance or QR scan row is changed here.
create table if not exists public.staff_scan_grants (
  token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  public_code text not null,
  operation_id uuid not null unique,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint staff_scan_grants_expiry_check check (expires_at > created_at)
);

create index if not exists staff_scan_grants_unclaimed_expiry_idx
  on public.staff_scan_grants (expires_at)
  where claimed_at is null;

alter table public.staff_scan_grants enable row level security;
revoke all on public.staff_scan_grants from public, anon, authenticated;
grant select, insert, update on public.staff_scan_grants to service_role;

create or replace function public.claim_staff_scan_grant(
  p_token_hash text,
  p_user_id uuid,
  p_public_code text,
  p_operation_id uuid
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  update public.staff_scan_grants
     set claimed_at = clock_timestamp()
   where token_hash = p_token_hash
     and user_id = p_user_id
     and public_code = p_public_code
     and operation_id = p_operation_id
     and claimed_at is null
     and expires_at > clock_timestamp()
  returning operation_id;
$$;

revoke all on function public.claim_staff_scan_grant(text, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_staff_scan_grant(text, uuid, text, uuid)
  to service_role;

comment on table public.staff_scan_grants is
  'Server-only, single-use Staff camera attendance navigation grants. A conditional database claim consumes one grant atomically.';
