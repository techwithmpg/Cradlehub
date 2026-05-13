-- Migration: booking_payment_logs
-- Purpose: Append-only audit table for manual payment changes.
-- Phase 2 — Manual Payment Recording

create table if not exists public.booking_payment_logs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  changed_by uuid references public.staff(id) on delete set null,

  -- old values
  old_payment_method text,
  old_payment_status text,
  old_amount_paid numeric(12,2),
  old_payment_reference text,

  -- new values
  new_payment_method text,
  new_payment_status text,
  new_amount_paid numeric(12,2),
  new_payment_reference text,

  reason text,

  created_at timestamptz not null default now()
);

comment on table public.booking_payment_logs is 'Append-only audit trail for manual payment changes on bookings.';
comment on column public.booking_payment_logs.reason is 'Required when voiding, refunding, or correcting a payment (e.g. paid→unpaid or amount reduction).';

-- Index for fast lookup by booking, newest first
create index idx_payment_logs_booking on public.booking_payment_logs(booking_id, created_at desc);

-- RLS
alter table public.booking_payment_logs enable row level security;

create policy "Allow authenticated insert"
  on public.booking_payment_logs
  for insert
  to authenticated
  with check (true);

create policy "Allow authenticated select"
  on public.booking_payment_logs
  for select
  to authenticated
  using (true);
