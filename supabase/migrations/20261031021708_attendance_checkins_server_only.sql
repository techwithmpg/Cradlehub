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

-- TRUNCATE and REFERENCES are outside RLS. Data API roles do not need
-- maintenance operations or schema-level trigger/reference powers.
-- Keep the server role's existing DML for scan, correction, and closing RPCs.
revoke insert, update, delete, truncate, trigger, references, maintain
  on table public.staff_shift_checkins
  from public, anon, authenticated;
grant select on table public.staff_shift_checkins to authenticated;
grant select, insert, update, delete on table public.staff_shift_checkins to service_role;

-- Fail the migration rather than leave an inherited grant silently effective.
do $$
declare
  checked_role text;
  checked_privilege text;
begin
  foreach checked_role in array array['anon', 'authenticated'] loop
    foreach checked_privilege in array array[
      'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES', 'MAINTAIN'
    ] loop
      if has_table_privilege(
        checked_role, 'public.staff_shift_checkins', checked_privilege
      ) then
        raise exception 'Unexpected inherited % privilege on staff_shift_checkins for %',
          checked_privilege, checked_role;
      end if;
    end loop;
  end loop;
end $$;

commit;
