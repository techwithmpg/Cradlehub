\set ON_ERROR_STOP on
do $$ begin
  if current_database() <> 'service_lifecycle_group_integration'
    or inet_server_addr() is distinct from '127.0.0.1'::inet
    or inet_server_port() is distinct from 55434 then
    raise exception 'LOCAL integration target guard failed';
  end if;
end $$;
-- Disposable LOCAL compatibility harness only. It fills columns/tables omitted
-- by the accepted Group Booking fixture; it is not the full Supabase schema.
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
grant usage on schema public to authenticated, anon, service_role;

alter table public.branches add column if not exists is_active boolean not null default true;
alter table public.staff add column if not exists auth_user_id uuid;
alter table public.services add column if not exists name text;
alter table public.services add column if not exists duration_minutes integer;
alter table public.services add column if not exists duration_policy text;
alter table public.services add column if not exists extension_increment_minutes integer;
alter table public.services add column if not exists extension_price numeric(10,2);
alter table public.services add column if not exists maximum_duration_minutes integer;
alter table public.customers add column if not exists full_name text;

alter table public.bookings add column if not exists session_started_at timestamptz;
alter table public.bookings add column if not exists session_due_at timestamptz;
alter table public.bookings add column if not exists session_completed_at timestamptz;
alter table public.bookings add column if not exists completed_at timestamptz;
alter table public.bookings add column if not exists session_start_source text;
alter table public.bookings add column if not exists session_started_by uuid;
alter table public.bookings add column if not exists session_completion_source text;
alter table public.bookings add column if not exists session_completed_by uuid;
alter table public.bookings add column if not exists session_auto_completed_at timestamptz;
alter table public.bookings add column if not exists session_duration_minutes_snapshot integer;
alter table public.bookings add column if not exists session_extension_minutes_total integer not null default 0;
alter table public.bookings add column if not exists session_extension_reason text;
alter table public.bookings add column if not exists session_extended_by uuid;
alter table public.bookings add column if not exists session_extended_at timestamptz;
alter table public.bookings add column if not exists updated_at timestamptz;

create table public.order_payable_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null,
  booking_id uuid, charge_type text not null, description text not null,
  amount numeric(12,2) not null check (amount > 0), currency text not null,
  sequence integer not null, source_type text, source_id uuid, created_by uuid
);
create table public.workspace_notifications (
  id uuid primary key default gen_random_uuid(), branch_id uuid,
  target_workspace text, recipient_staff_id uuid, actor_staff_id uuid,
  type text, title text, body text, entity_type text, entity_id uuid,
  action_href text, priority text, status text, requires_action boolean,
  dedupe_key text, metadata jsonb
);
create unique index workspace_notifications_open_dedupe_key_uidx
  on public.workspace_notifications(dedupe_key)
  where dedupe_key is not null and status in ('unread', 'read');
