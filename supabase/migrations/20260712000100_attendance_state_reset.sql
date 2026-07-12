-- Attendance State Reset
--
-- Keeps the existing attendance_corrections audit table but adds an explicit
-- action name for selected-record state resets. The operation voids selected
-- interpreted attendance rows only; raw qr_scan_events remain immutable.

alter table public.attendance_corrections
  drop constraint if exists attendance_corrections_correction_type_check;

alter table public.attendance_corrections
  add constraint attendance_corrections_correction_type_check
  check (
    correction_type in (
      'manual_clock_in',
      'manual_clock_out',
      'void',
      'adjust_times',
      'note',
      'reclassify_scan',
      'set_manual_clock_in',
      'set_manual_clock_out',
      'reset_staff_day',
      'reset_attendance_state',
      'rebuild_from_scans',
      'ignore_scan',
      'apply_launch_recovery',
      'update_attendance_rules',
      'archive_test_data',
      'revert_correction'
    )
  );

alter table public.attendance_corrections
  drop constraint if exists attendance_corrections_action_type_check;

alter table public.attendance_corrections
  add constraint attendance_corrections_action_type_check
  check (
    action_type in (
      'manual_clock_in',
      'manual_clock_out',
      'void',
      'adjust_times',
      'note',
      'reclassify_scan',
      'set_manual_clock_in',
      'set_manual_clock_out',
      'reset_staff_day',
      'reset_attendance_state',
      'rebuild_from_scans',
      'ignore_scan',
      'apply_launch_recovery',
      'update_attendance_rules',
      'archive_test_data',
      'revert_correction'
    )
  );

comment on constraint attendance_corrections_action_type_check on public.attendance_corrections is
  'Allowed attendance correction action names. reset_attendance_state voids selected interpreted records without mutating raw QR scan events.';
