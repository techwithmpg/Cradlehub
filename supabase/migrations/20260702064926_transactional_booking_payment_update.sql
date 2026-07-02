-- Atomic payment updates for bookings.
-- Keeps the booking_payment_logs audit insert and bookings update in one
-- transaction when called from authenticated server actions.

create or replace function public.record_booking_payment_change(
  p_booking_id uuid,
  p_payment_method text,
  p_payment_status text,
  p_amount_paid numeric,
  p_payment_reference text default null,
  p_reason text default null,
  p_changed_by uuid default null,
  p_branch_id uuid default null,
  p_next_status text default null,
  p_clear_hold boolean default false
)
returns table(id uuid, branch_id uuid)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_before record;
  v_updated record;
begin
  select
    b.branch_id,
    b.status,
    b.payment_method,
    b.payment_status,
    b.amount_paid,
    b.payment_reference
  into v_before
  from public.bookings b
  where b.id = p_booking_id
    and (p_branch_id is null or b.branch_id = p_branch_id)
  for update;

  if not found then
    raise exception 'booking_payment_booking_not_found'
      using errcode = 'P0002';
  end if;

  insert into public.booking_payment_logs (
    booking_id,
    changed_by,
    old_payment_method,
    old_payment_status,
    old_amount_paid,
    old_payment_reference,
    new_payment_method,
    new_payment_status,
    new_amount_paid,
    new_payment_reference,
    reason
  )
  values (
    p_booking_id,
    p_changed_by,
    v_before.payment_method,
    v_before.payment_status,
    v_before.amount_paid,
    v_before.payment_reference,
    p_payment_method,
    p_payment_status,
    p_amount_paid,
    p_payment_reference,
    p_reason
  );

  update public.bookings b
  set
    payment_method = p_payment_method,
    payment_status = p_payment_status,
    amount_paid = p_amount_paid,
    payment_reference = p_payment_reference,
    status = coalesce(p_next_status, b.status),
    hold_expires_at = case when p_clear_hold then null else b.hold_expires_at end
  where b.id = p_booking_id
    and (p_branch_id is null or b.branch_id = p_branch_id)
  returning b.id, b.branch_id
  into v_updated;

  if not found then
    raise exception 'booking_payment_update_failed'
      using errcode = 'P0002';
  end if;

  return query select v_updated.id, v_updated.branch_id;
end;
$$;

comment on function public.record_booking_payment_change(
  uuid,
  text,
  text,
  numeric,
  text,
  text,
  uuid,
  uuid,
  text,
  boolean
) is
  'Atomically inserts a booking payment audit log row and updates the booking payment fields/status.';

revoke all on function public.record_booking_payment_change(
  uuid,
  text,
  text,
  numeric,
  text,
  text,
  uuid,
  uuid,
  text,
  boolean
) from public;
revoke all on function public.record_booking_payment_change(
  uuid,
  text,
  text,
  numeric,
  text,
  text,
  uuid,
  uuid,
  text,
  boolean
) from anon;
grant execute on function public.record_booking_payment_change(
  uuid,
  text,
  text,
  numeric,
  text,
  text,
  uuid,
  uuid,
  text,
  boolean
) to authenticated;
grant execute on function public.record_booking_payment_change(
  uuid,
  text,
  text,
  numeric,
  text,
  text,
  uuid,
  uuid,
  text,
  boolean
) to service_role;

-- Branch-scoped CRM/management Booking Rules writes.
-- Earlier policies allowed CRM reads but kept writes manager-only.

drop policy if exists "branch_booking_rules_operations_read_branch" on public.branch_booking_rules;
drop policy if exists "branch_booking_rules_operations_insert_branch" on public.branch_booking_rules;
drop policy if exists "branch_booking_rules_operations_update_branch" on public.branch_booking_rules;

create policy "branch_booking_rules_operations_read_branch"
  on public.branch_booking_rules for select
  to authenticated
  using (
    (select public.get_auth_role()) in ('manager', 'assistant_manager', 'store_manager', 'crm')
    and branch_id = (select public.get_auth_branch_id())
  );

create policy "branch_booking_rules_operations_insert_branch"
  on public.branch_booking_rules for insert
  to authenticated
  with check (
    (select public.get_auth_role()) in ('manager', 'assistant_manager', 'store_manager', 'crm')
    and branch_id = (select public.get_auth_branch_id())
  );

create policy "branch_booking_rules_operations_update_branch"
  on public.branch_booking_rules for update
  to authenticated
  using (
    (select public.get_auth_role()) in ('manager', 'assistant_manager', 'store_manager', 'crm')
    and branch_id = (select public.get_auth_branch_id())
  )
  with check (
    (select public.get_auth_role()) in ('manager', 'assistant_manager', 'store_manager', 'crm')
    and branch_id = (select public.get_auth_branch_id())
  );

notify pgrst, 'reload schema';
