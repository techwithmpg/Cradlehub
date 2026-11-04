-- PostgreSQL-only harness for the guarded migration. Not a Supabase integration schema.
create role anon;
create role authenticated;
create role service_role;

create table public.branches (id uuid primary key);
create table public.staff (id uuid primary key);
create table public.customers (id uuid primary key, full_name text);
create table public.services (id uuid primary key, name text);
create table public.booking_attendees (id uuid primary key, display_name text);

create table public.bookings (
  id uuid primary key,
  order_id uuid,
  branch_id uuid not null references public.branches(id),
  staff_id uuid references public.staff(id),
  customer_id uuid references public.customers(id),
  service_id uuid references public.services(id),
  attendee_id uuid references public.booking_attendees(id),
  resource_id uuid,
  booking_date date not null,
  delivery_type text not null,
  status text not null,
  booking_progress_status text not null,
  session_start_source text,
  session_started_at timestamptz,
  session_due_at timestamptz,
  session_completed_at timestamptz,
  completed_at timestamptz,
  session_completion_source text,
  session_completed_by uuid,
  session_auto_completed_at timestamptz,
  updated_at timestamptz
);

create table public.workspace_notifications (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches(id),
  target_workspace text not null,
  recipient_staff_id uuid references public.staff(id),
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  action_href text,
  priority text not null,
  status text not null,
  requires_action boolean not null,
  dedupe_key text,
  metadata jsonb not null default '{}'::jsonb
);

create unique index workspace_notifications_open_dedupe_key_uidx
  on public.workspace_notifications (dedupe_key)
  where dedupe_key is not null and status in ('unread', 'read');
