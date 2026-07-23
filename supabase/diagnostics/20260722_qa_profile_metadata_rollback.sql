-- MANUAL ROLLBACK — DO NOT RUN AS PART OF NORMAL DEPLOYMENT
-- Restores only the exact QA staff row changed by migration
-- 20260722150121_attendance_production_audit_repairs.sql.
-- Backup location:
--   public.schedule_repair_backups
--   reason = attendance_20260722_confirmed_qa_profile_before_metadata_repair

begin;

do $$
declare
  v_staff_id constant uuid := 'c336a150-015d-467d-a400-b90cd8b21d76'::uuid;
  v_reason constant text := 'attendance_20260722_confirmed_qa_profile_before_metadata_repair';
  v_original_row jsonb;
begin
  select backup.original_row
  into v_original_row
  from public.schedule_repair_backups backup
  where backup.source_table = 'staff'
    and backup.source_pk = v_staff_id::text
    and backup.reason = v_reason
  order by backup.created_at
  limit 1;

  if v_original_row is null then
    raise exception 'Required Attendance audit backup was not found for staff %', v_staff_id;
  end if;

  update public.staff
  set metadata = coalesce(v_original_row -> 'metadata', '{}'::jsonb)
  where id = v_staff_id
    and full_name = 'Codex QA Work Queue';

  if not found then
    raise exception 'Expected QA staff profile % was not found', v_staff_id;
  end if;
end;
$$;

commit;
