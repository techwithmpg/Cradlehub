-- Atomic CRM correction for clock-in, clock-out, or both values.

alter table public.attendance_corrections
  drop constraint if exists attendance_corrections_correction_type_check;
alter table public.attendance_corrections
  add constraint attendance_corrections_correction_type_check
  check (correction_type in (
    'manual_clock_in', 'manual_clock_out', 'void', 'adjust_times', 'note',
    'reclassify_scan', 'set_manual_clock_in', 'set_manual_clock_out',
    'correct_attendance_times', 'reset_staff_day', 'reset_attendance_state',
    'rebuild_from_scans', 'ignore_scan', 'accept_recorded_attendance',
    'void_duplicate', 'mark_accidental_scan', 'allow_branch_today',
    'change_permanent_branch', 'apply_launch_recovery', 'update_attendance_rules',
    'archive_test_data', 'revert_correction', 'system_auto_close',
    'reconcile_provisional_clock_out'
  ));

alter table public.attendance_corrections
  drop constraint if exists attendance_corrections_action_type_check;
alter table public.attendance_corrections
  add constraint attendance_corrections_action_type_check
  check (action_type in (
    'manual_clock_in', 'manual_clock_out', 'void', 'adjust_times', 'note',
    'reclassify_scan', 'set_manual_clock_in', 'set_manual_clock_out',
    'correct_attendance_times', 'reset_staff_day', 'reset_attendance_state',
    'rebuild_from_scans', 'ignore_scan', 'accept_recorded_attendance',
    'void_duplicate', 'mark_accidental_scan', 'allow_branch_today',
    'change_permanent_branch', 'apply_launch_recovery', 'update_attendance_rules',
    'archive_test_data', 'revert_correction', 'system_auto_close',
    'reconcile_provisional_clock_out'
  ));

create or replace function public.correct_attendance_times_transaction(
  p_branch_id uuid,
  p_actor_staff_id uuid,
  p_action text,
  p_reason text,
  p_checkin_id uuid,
  p_checked_in_at timestamptz,
  p_checked_out_at timestamptz default null,
  p_exception_id uuid default null,
  p_metrics jsonb default '{}'::jsonb,
  p_is_test boolean default false
)
returns table (success boolean, code text, message text, correction_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_checkin public.staff_shift_checkins%rowtype;
  v_correction_id uuid;
  v_previous jsonb;
  v_status text;
begin
  if p_branch_id is null or p_actor_staff_id is null or p_checkin_id is null or p_checked_in_at is null or v_reason is null then
    return query select false, 'invalid_request', 'Branch, actor, record, clock-in, and reason are required.', null::uuid;
    return;
  end if;
  if p_action not in ('set_manual_clock_in', 'set_manual_clock_out', 'correct_attendance_times') then
    return query select false, 'unsupported_action', 'This time correction is not supported.', null::uuid;
    return;
  end if;
  if p_checked_out_at is not null and p_checked_out_at <= p_checked_in_at then
    return query select false, 'invalid_time_range', 'Clock-out must be after clock-in.', null::uuid;
    return;
  end if;

  select checkin_row.* into v_checkin
  from public.staff_shift_checkins as checkin_row
  where checkin_row.id = p_checkin_id
    and checkin_row.branch_id = p_branch_id
    and checkin_row.is_test = p_is_test
  for update;
  if not found then
    return query select false, 'checkin_not_found', 'Attendance record was not found.', null::uuid;
    return;
  end if;

  v_previous := jsonb_build_object('attendance', to_jsonb(v_checkin));
  v_status := case when p_checked_out_at is null then 'checked_in' else 'checked_out' end;
  update public.staff_shift_checkins
  set checked_in_at = p_checked_in_at,
      checked_out_at = p_checked_out_at,
      status = v_status,
      clock_in_method = case when p_checked_in_at is distinct from v_checkin.checked_in_at then 'manual_review' else clock_in_method end,
      clock_out_method = case when p_checked_out_at is null then null when p_checked_out_at is distinct from v_checkin.checked_out_at then 'manual_review' else clock_out_method end,
      worked_minutes = coalesce((p_metrics->>'workedMinutes')::integer, 0),
      late_minutes = coalesce((p_metrics->>'lateMinutes')::integer, 0),
      early_leave_minutes = coalesce((p_metrics->>'earlyLeaveMinutes')::integer, 0),
      overtime_minutes = coalesce((p_metrics->>'overtimeMinutes')::integer, 0),
      attendance_status = coalesce(nullif(p_metrics->>'attendanceStatus', ''), attendance_status),
      exception_state = 'none',
      updated_at = v_now
  where id = p_checkin_id;

  if p_exception_id is not null then
    update public.attendance_exceptions
    set status = 'resolved', resolution_status = 'resolved', resolution_action = p_action,
        resolution_note = v_reason, resolved_at = v_now, resolved_by = p_actor_staff_id,
        updated_at = v_now
    where id = p_exception_id and branch_id = p_branch_id;
  end if;

  insert into public.attendance_corrections (
    branch_id, staff_id, checkin_id, exception_id, attendance_date,
    correction_type, action_type, previous_values, new_values, reason,
    status, requested_by, approved_by, corrected_by, applied_at, corrected_at, is_test
  ) values (
    p_branch_id, v_checkin.staff_id, p_checkin_id, p_exception_id, v_checkin.shift_date,
    p_action, p_action, v_previous,
    jsonb_build_object('checkedInAt', p_checked_in_at, 'checkedOutAt', p_checked_out_at, 'metrics', p_metrics),
    v_reason, 'applied', p_actor_staff_id, p_actor_staff_id, p_actor_staff_id, v_now, v_now, p_is_test
  ) returning id into v_correction_id;

  return query select true, 'committed', 'Attendance times corrected.', v_correction_id;
end;
$$;

revoke all on function public.correct_attendance_times_transaction(uuid, uuid, text, text, uuid, timestamptz, timestamptz, uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.correct_attendance_times_transaction(uuid, uuid, text, text, uuid, timestamptz, timestamptz, uuid, jsonb, boolean) to service_role;

comment on function public.correct_attendance_times_transaction(uuid, uuid, text, text, uuid, timestamptz, timestamptz, uuid, jsonb, boolean) is
  'Atomically corrects attendance clock-in/clock-out, resolves a linked exception, and appends one audit row.';
