-- Attendance Recovery / Smart Intent rules.
--
-- This migration extends the existing QR Attendance schema instead of adding
-- duplicate settings/correction tables. Raw qr_scan_events remain immutable;
-- interpreted attendance changes are tracked through attendance_corrections.

alter table public.attendance_settings
  add column if not exists timezone text not null default 'Asia/Manila',
  add column if not exists attendance_day_boundary time not null default '06:00',
  add column if not exists early_clock_in_allowed_minutes integer not null default 30
    check (early_clock_in_allowed_minutes between 0 and 240),
  add column if not exists late_grace_minutes integer not null default 10
    check (late_grace_minutes between 0 and 240),
  add column if not exists clock_in_window_before_shift_minutes integer not null default 30
    check (clock_in_window_before_shift_minutes between 0 and 720),
  add column if not exists clock_in_window_after_shift_start_minutes integer not null default 120
    check (clock_in_window_after_shift_start_minutes between 0 and 720),
  add column if not exists clock_out_window_before_shift_end_minutes integer not null default 120
    check (clock_out_window_before_shift_end_minutes between 0 and 720),
  add column if not exists clock_out_window_after_shift_end_minutes integer not null default 120
    check (clock_out_window_after_shift_end_minutes between 0 and 720),
  add column if not exists early_leave_threshold_minutes integer not null default 5
    check (early_leave_threshold_minutes between 0 and 240),
  add column if not exists overtime_threshold_minutes integer not null default 15
    check (overtime_threshold_minutes between 0 and 240),
  add column if not exists duplicate_scan_debounce_minutes integer not null default 3
    check (duplicate_scan_debounce_minutes between 1 and 10),
  add column if not exists first_scan_closing_behavior text not null default 'flag_for_recovery'
    check (first_scan_closing_behavior in ('flag_for_recovery', 'treat_as_clock_out_launch_only', 'require_manager_confirmation', 'never_auto_clock_in')),
  add column if not exists missing_schedule_behavior text not null default 'flag_for_recovery'
    check (missing_schedule_behavior in ('flag_for_recovery', 'allow_clock_in_with_exception', 'block_scan')),
  add column if not exists off_day_scan_behavior text not null default 'flag_for_recovery'
    check (off_day_scan_behavior in ('flag_for_recovery', 'allow_clock_in_with_exception', 'block_scan')),
  add column if not exists ambiguous_scan_behavior text not null default 'flag_for_recovery'
    check (ambiguous_scan_behavior in ('flag_for_recovery', 'require_manager_confirmation', 'block_scan')),
  add column if not exists launch_recovery_enabled boolean not null default false,
  add column if not exists launch_recovery_start_date date,
  add column if not exists launch_recovery_end_date date,
  add column if not exists launch_recovery_closing_start_time time not null default '20:30',
  add column if not exists launch_recovery_closing_end_time time not null default '23:59',
  add column if not exists launch_recovery_reason text,
  add column if not exists updated_by uuid references public.staff(id) on delete set null;

update public.attendance_settings
set
  late_grace_minutes = greatest(late_grace_minutes, clock_in_late_grace_minutes),
  duplicate_scan_debounce_minutes = greatest(1, least(10, ceil(duplicate_scan_window_seconds / 60.0)::integer))
where true;

alter table public.attendance_corrections
  add column if not exists attendance_date date,
  add column if not exists scan_event_ids jsonb not null default '[]'::jsonb,
  add column if not exists action_type text,
  add column if not exists corrected_by uuid references public.staff(id) on delete set null,
  add column if not exists corrected_at timestamptz;

update public.attendance_corrections
set
  action_type = coalesce(action_type, correction_type),
  corrected_by = coalesce(corrected_by, approved_by),
  corrected_at = coalesce(corrected_at, applied_at, created_at)
where action_type is null
   or corrected_by is null
   or corrected_at is null;

alter table public.attendance_corrections
  alter column action_type set default 'note',
  alter column corrected_at set default now();

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
      'revert_correction'
    )
  );

create index if not exists attendance_corrections_branch_date_idx
  on public.attendance_corrections(branch_id, attendance_date, created_at desc);

create index if not exists attendance_corrections_action_type_idx
  on public.attendance_corrections(branch_id, action_type, created_at desc);

comment on column public.attendance_settings.first_scan_closing_behavior is
  'Controls first scan inside clock-out/closing window when no earlier clock-in exists. Default flags for Recovery.';

comment on column public.attendance_settings.launch_recovery_enabled is
  'Temporary branch/date-range safety mode for launch-day closing scans. Must be paired with date range and reason.';

comment on column public.attendance_corrections.scan_event_ids is
  'Related raw qr_scan_events IDs. Raw scan events remain immutable.';
