-- Attendance transactional correction operations
--
-- Moves selected-record Attendance State Reset into a PostgreSQL transaction:
-- selected interpreted row update, linked Recovery issue resolution, and
-- correction audit insertion commit or roll back together. Raw qr_scan_events
-- are not modified.

create or replace function public.reset_attendance_state_transaction(
  p_branch_id uuid,
  p_checkin_id uuid,
  p_actor_staff_id uuid,
  p_reason text,
  p_reset_mode text default 'next_scan_state',
  p_is_test boolean default false
)
returns table (
  success boolean,
  code text,
  message text,
  staff_id uuid,
  checkin_id uuid,
  attendance_date date,
  next_expected_action text,
  resolved_exception_count integer,
  correction_id uuid
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_reset_mode text := coalesce(nullif(trim(p_reset_mode), ''), 'next_scan_state');
  v_checkin public.staff_shift_checkins%rowtype;
  v_next_expected_action text;
  v_resolved_count integer := 0;
  v_correction_id uuid;
  v_open_checkin_id uuid;
begin
  if p_branch_id is null or p_checkin_id is null then
    return query select false, 'invalid_request', 'Choose one attendance record before resetting state.', null::uuid, p_checkin_id, null::date, null::text, 0, null::uuid;
    return;
  end if;

  if v_reason is null then
    return query select false, 'reason_required', 'Enter a reason before resetting attendance state.', null::uuid, p_checkin_id, null::date, null::text, 0, null::uuid;
    return;
  end if;

  if v_reset_mode not in ('next_scan_state', 'void_incorrect_attendance') then
    return query select false, 'unsupported_reset_mode', 'Use the dedicated manual or rebuild action after reviewing raw scan evidence.', null::uuid, p_checkin_id, null::date, null::text, 0, null::uuid;
    return;
  end if;

  select checkin_row.*
    into v_checkin
  from public.staff_shift_checkins as checkin_row
  where checkin_row.id = p_checkin_id
    and checkin_row.branch_id = p_branch_id
    and checkin_row.is_test = p_is_test
  for update;

  if not found then
    return query select false, 'not_found', 'Attendance record was not found for this branch.', null::uuid, p_checkin_id, null::date, null::text, 0, null::uuid;
    return;
  end if;

  if v_checkin.status = 'voided' then
    return query select false, 'already_reset', 'Attendance record was already reset.', v_checkin.staff_id, v_checkin.id, v_checkin.shift_date, 'clock_in', 0, null::uuid;
    return;
  end if;

  update public.staff_shift_checkins
     set status = 'voided',
         exception_state = 'none',
         notes = v_reason,
         updated_at = v_now
   where id = v_checkin.id;

  with resolved as (
    update public.attendance_exceptions
       set status = 'resolved',
           resolved_at = v_now,
           resolved_by = p_actor_staff_id,
           resolution_note = v_reason,
           updated_at = v_now
     where branch_id = p_branch_id
       and checkin_id = v_checkin.id
       and status = 'open'
     returning id
  )
  select count(*)::integer
    into v_resolved_count
  from resolved;

  select open_checkin.id
    into v_open_checkin_id
  from public.staff_shift_checkins as open_checkin
  where open_checkin.branch_id = p_branch_id
    and open_checkin.staff_id = v_checkin.staff_id
    and open_checkin.is_test = p_is_test
    and open_checkin.status = 'checked_in'
    and open_checkin.checked_out_at is null
    and open_checkin.id <> v_checkin.id
  order by open_checkin.checked_in_at desc
  limit 1
  for update;

  v_next_expected_action := case when v_open_checkin_id is not null then 'clock_out' else 'clock_in' end;

  insert into public.attendance_corrections (
    branch_id,
    staff_id,
    checkin_id,
    attendance_date,
    correction_type,
    action_type,
    previous_values,
    new_values,
    reason,
    status,
    requested_by,
    approved_by,
    corrected_by,
    applied_at,
    corrected_at,
    is_test
  )
  values (
    p_branch_id,
    v_checkin.staff_id,
    v_checkin.id,
    v_checkin.shift_date,
    'reset_attendance_state',
    'reset_attendance_state',
    to_jsonb(v_checkin),
    jsonb_build_object(
      'resetMode', v_reset_mode,
      'status', 'voided',
      'nextExpectedAction', v_next_expected_action,
      'resolvedOpenExceptionCount', v_resolved_count
    ),
    v_reason,
    'applied',
    p_actor_staff_id,
    p_actor_staff_id,
    p_actor_staff_id,
    v_now,
    v_now,
    p_is_test
  )
  returning id into v_correction_id;

  return query select true, 'committed', 'Attendance state reset.', v_checkin.staff_id, v_checkin.id, v_checkin.shift_date, v_next_expected_action, v_resolved_count, v_correction_id;
end;
$$;

comment on function public.reset_attendance_state_transaction(uuid, uuid, uuid, text, text, boolean) is
  'Transactional selected-record Attendance State Reset. Voids the interpreted check-in, resolves linked open Recovery issues, and writes correction audit history.';

revoke all on function public.reset_attendance_state_transaction(uuid, uuid, uuid, text, text, boolean) from public;
revoke all on function public.reset_attendance_state_transaction(uuid, uuid, uuid, text, text, boolean) from anon;
revoke all on function public.reset_attendance_state_transaction(uuid, uuid, uuid, text, text, boolean) from authenticated;
grant execute on function public.reset_attendance_state_transaction(uuid, uuid, uuid, text, text, boolean) to service_role;
