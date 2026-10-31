-- Staff attendance truth is written by the server-side scan transaction,
-- dedicated portal clock-out, and audited correction/reconciliation operations.
-- Authenticated Data API clients retain their existing scoped reads only.
-- Apply to a classified target after comparing its live policies and grants.

begin;

alter table public.staff_shift_checkins enable row level security;

drop policy if exists "checkins_owner_all" on public.staff_shift_checkins;
drop policy if exists "checkins_manager_branch_all" on public.staff_shift_checkins;
drop policy if exists "checkins_csr_branch_all" on public.staff_shift_checkins;
drop policy if exists "checkins_staff_self_insert" on public.staff_shift_checkins;
drop policy if exists "checkins_staff_self_update" on public.staff_shift_checkins;

-- Preserve the read side of the former FOR ALL policies. The separate
-- checkins_staff_read_own policy continues to serve staff self-service reads.
create policy "checkins_owner_read" on public.staff_shift_checkins
  for select to authenticated
  using (get_auth_role() = 'owner');

create policy "checkins_manager_branch_read" on public.staff_shift_checkins
  for select to authenticated
  using (
    get_auth_role() in ('manager', 'assistant_manager', 'store_manager')
    and branch_id = get_auth_branch_id()
  );

create policy "checkins_csr_branch_read" on public.staff_shift_checkins
  for select to authenticated
  using (
    get_auth_role() in ('crm', 'csr_head', 'csr_staff')
    and branch_id = get_auth_branch_id()
  );

-- Grants and RLS must both deny direct mutations. Revoking PUBLIC also
-- prevents inherited table privileges from silently reopening Data API writes.
revoke insert, update, delete on table public.staff_shift_checkins
  from public, anon, authenticated;
grant select on table public.staff_shift_checkins to authenticated;
grant select, insert, update, delete on table public.staff_shift_checkins to service_role;

commit;
