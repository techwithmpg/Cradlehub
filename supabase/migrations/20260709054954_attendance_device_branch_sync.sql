-- Keep active attendance device rows aligned with the staff home branch.
-- QR scans still use the scanned QR branch as the source of truth; this repair
-- prevents stale staff_devices.branch_id values from creating false wrong-branch
-- blocks after a staff member is moved between branches.

create or replace function public.sync_staff_device_branch_from_staff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' or new.branch_id is not distinct from old.branch_id then
    return new;
  end if;

  if new.branch_id is null then
    return new;
  end if;

  update public.staff_devices
     set branch_id = new.branch_id,
         metadata = coalesce(metadata, '{}'::jsonb)
           || jsonb_build_object(
             'branch_synced_from_staff_at', now(),
             'branch_sync_source', 'staff_branch_update',
             'previous_branch_id', old.branch_id
           )
   where staff_id = new.id
     and status = 'active'
     and branch_id is distinct from new.branch_id;

  return new;
end;
$$;

comment on function public.sync_staff_device_branch_from_staff() is
  'Internal trigger helper that keeps active attendance device branch ids aligned with staff.branch_id.';

revoke all on function public.sync_staff_device_branch_from_staff() from public, anon, authenticated;

drop trigger if exists trg_staff_branch_sync_devices on public.staff;
create trigger trg_staff_branch_sync_devices
  after update of branch_id on public.staff
  for each row execute function public.sync_staff_device_branch_from_staff();

update public.staff_devices d
   set branch_id = s.branch_id,
       metadata = coalesce(d.metadata, '{}'::jsonb)
         || jsonb_build_object(
           'branch_synced_from_staff_at', now(),
           'branch_sync_source', 'attendance_device_branch_sync_migration',
           'previous_branch_id', d.branch_id
         )
  from public.staff s
 where s.id = d.staff_id
   and s.branch_id is not null
   and d.status = 'active'
   and d.branch_id is distinct from s.branch_id;
