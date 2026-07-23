-- ATTENDANCE-PRODUCTION-AUDIT-20260722
--
-- High-confidence repair only. This migration does not create, delete, merge,
-- or rewrite any Attendance record or scan. It marks one conclusively identified
-- QA profile as non-operational so it cannot appear in production monitoring.
-- The complete staff row and audit evidence are persisted before the update.

do $$
declare
  v_batch_id constant uuid := '20260722-1501-4121-8000-000000000001'::uuid;
  v_staff_id constant uuid := 'c336a150-015d-467d-a400-b90cd8b21d76'::uuid;
  v_reason constant text := 'attendance_20260722_confirmed_qa_profile_before_metadata_repair';
  v_original_row jsonb;
begin
  select
    to_jsonb(staff_row) || jsonb_build_object(
      '_audit_evidence', jsonb_build_object(
        'authEmail', auth_user.email,
        'verifiedAt', now(),
        'attendanceRecords', 0,
        'scanEvents', 0,
        'bookings', 0,
        'staffServices', 0,
        'deviceRowsPreserved', (
          select count(*)
          from public.staff_devices device
          where device.staff_id = staff_row.id
        )
      )
    )
  into v_original_row
  from public.staff staff_row
  join auth.users auth_user on auth_user.id = staff_row.auth_user_id
  where staff_row.id = v_staff_id
    and staff_row.full_name = 'Codex QA Work Queue'
    and staff_row.phone = '+639990009999'
    and auth_user.email = 'codex.qa.workqueue+mr0f7r54@example.test'
    and not exists (
      select 1 from public.staff_shift_checkins checkin
      where checkin.staff_id = staff_row.id
    )
    and not exists (
      select 1 from public.qr_scan_events scan
      where scan.staff_id = staff_row.id
    )
    and not exists (
      select 1 from public.bookings booking
      where booking.staff_id = staff_row.id
    )
    and not exists (
      select 1 from public.staff_services staff_service
      where staff_service.staff_id = staff_row.id
    );

  if v_original_row is not null then
    insert into public.schedule_repair_backups (
      batch_id,
      source_table,
      source_pk,
      original_row,
      reason
    )
    select
      v_batch_id,
      'staff',
      v_staff_id::text,
      v_original_row,
      v_reason
    where not exists (
      select 1
      from public.schedule_repair_backups backup
      where backup.source_table = 'staff'
        and backup.source_pk = v_staff_id::text
        and backup.reason = v_reason
    );

    update public.staff
    set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'is_test', true,
      'test', true,
      'is_schedulable', false,
      'non_schedulable', true,
      'attendance_audit_repair', 'ATTENDANCE-PRODUCTION-AUDIT-20260722'
    )
    where id = v_staff_id
      and not (
        coalesce(metadata, '{}'::jsonb) @> jsonb_build_object(
          'is_test', true,
          'test', true,
          'is_schedulable', false,
          'non_schedulable', true,
          'attendance_audit_repair', 'ATTENDANCE-PRODUCTION-AUDIT-20260722'
        )
      );
  end if;
end;
$$;
