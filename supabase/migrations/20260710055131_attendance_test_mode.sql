-- Attendance Test / Training Mode
--
-- Branch-scoped setting plus explicit is_test markers on the existing
-- attendance audit/truth tables. Live reports and availability can filter on
-- is_test = false while training scans remain reviewable.

alter table public.attendance_settings
  add column if not exists test_mode_enabled boolean not null default false,
  add column if not exists test_mode_reason text,
  add column if not exists test_mode_enabled_at timestamptz,
  add column if not exists test_mode_enabled_by uuid references public.staff(id) on delete set null,
  add column if not exists test_mode_disabled_at timestamptz,
  add column if not exists test_mode_disabled_by uuid references public.staff(id) on delete set null;

alter table public.qr_scan_events
  add column if not exists is_test boolean not null default false;

alter table public.staff_shift_checkins
  add column if not exists is_test boolean not null default false;

alter table public.attendance_exceptions
  add column if not exists is_test boolean not null default false;

alter table public.attendance_corrections
  add column if not exists is_test boolean not null default false;

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
      'rebuild_from_scans',
      'ignore_scan',
      'apply_launch_recovery',
      'update_attendance_rules',
      'archive_test_data',
      'revert_correction'
    )
  );

alter table public.staff_shift_checkins
  drop constraint if exists staff_shift_checkins_unique_day_shift;

alter table public.staff_shift_checkins
  add constraint staff_shift_checkins_unique_day_shift
    unique (staff_id, shift_date, shift_type, is_test);

create index if not exists qr_scan_events_branch_test_created_idx
  on public.qr_scan_events(branch_id, is_test, created_at desc);

create index if not exists staff_shift_checkins_branch_test_date_idx
  on public.staff_shift_checkins(branch_id, is_test, shift_date);

create index if not exists attendance_exceptions_branch_test_status_idx
  on public.attendance_exceptions(branch_id, is_test, status, detected_at desc);

create index if not exists attendance_corrections_branch_test_created_idx
  on public.attendance_corrections(branch_id, is_test, created_at desc);

comment on column public.attendance_settings.test_mode_enabled is
  'When true, branch attendance scans are training/sample scans and are excluded from live reporting.';

comment on column public.qr_scan_events.is_test is
  'True when the scan was captured while branch Attendance Test / Training Mode was enabled.';

comment on column public.staff_shift_checkins.is_test is
  'True when the attendance record was created by a training/test scan.';

comment on column public.attendance_exceptions.is_test is
  'True when the exception was created from training/test activity.';

comment on column public.attendance_corrections.is_test is
  'True when the correction/audit row belongs to training/test activity.';
