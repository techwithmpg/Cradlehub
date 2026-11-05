-- Disposable LOCAL PostgreSQL contract harness, not a full Supabase schema.
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
grant usage on schema public to authenticated, anon, service_role;

create table public.branches (id uuid primary key, is_active boolean not null default true);
create table public.staff (
  id uuid primary key, auth_user_id uuid, system_role text, branch_id uuid,
  is_active boolean not null default true, archived_at timestamptz,
  merged_into_staff_id uuid
);
create table public.services (
  id uuid primary key, name text, is_active boolean not null default true,
  duration_minutes integer not null, duration_policy text not null,
  extension_increment_minutes integer, extension_price numeric(10,2),
  maximum_duration_minutes integer
);
create table public.customers (id uuid primary key, full_name text);
create table public.booking_attendees (id uuid primary key, display_name text);
create table public.branch_resources (
  id uuid primary key, branch_id uuid not null, capacity integer not null,
  is_active boolean not null default true
);
create table public.booking_orders (
  id uuid primary key, branch_id uuid not null, currency text not null default 'PHP',
  metadata jsonb not null default '{}'::jsonb
);
create table public.bookings (
  id uuid primary key, order_id uuid, branch_id uuid not null,
  staff_id uuid, customer_id uuid, attendee_id uuid, service_id uuid,
  resource_id uuid, booking_date date not null, delivery_type text not null,
  status text not null, booking_progress_status text not null,
  start_time time not null, end_time time not null, hold_expires_at timestamptz,
  session_started_at timestamptz, session_due_at timestamptz,
  session_completed_at timestamptz, completed_at timestamptz,
  session_start_source text, session_started_by uuid,
  session_completion_source text, session_completed_by uuid,
  session_auto_completed_at timestamptz,
  session_duration_minutes_snapshot integer,
  session_extension_minutes_total integer,
  session_extension_reason text, session_extended_by uuid,
  session_extended_at timestamptz, updated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);
create table public.staff_schedules (
  staff_id uuid, day_of_week integer, start_time time, end_time time,
  is_active boolean, ends_next_day boolean not null default false
);
create table public.schedule_overrides (
  staff_id uuid, override_date date, start_time time, end_time time,
  is_day_off boolean, ends_next_day boolean not null default false
);
create table public.blocked_times (
  staff_id uuid, block_date date, start_time time, end_time time
);
create table public.order_payable_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null,
  booking_id uuid, charge_type text not null, description text not null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null, sequence integer not null,
  source_type text, source_id uuid, created_by uuid
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
create function public.crm_booking_row_blocks_availability(text,timestamptz)
returns boolean language sql stable as $$
  select $1 in ('pending','confirmed','in_progress','completed')
$$;
grant select on public.bookings, public.booking_orders, public.staff,
  public.services, public.branches to authenticated;
