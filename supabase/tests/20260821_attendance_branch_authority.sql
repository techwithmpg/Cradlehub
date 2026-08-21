begin;

do $test$
declare
  v_staff_id uuid;
  v_home_branch_id uuid;
  v_other_branch_id uuid;
  v_temporary_id uuid;
  v_duty_other_id uuid;
  v_duty_home_id uuid;
  v_result record;
begin
  select staff_row.id, staff_row.branch_id
    into v_staff_id, v_home_branch_id
  from public.staff as staff_row
  where staff_row.is_active is true
    and staff_row.archived_at is null
    and staff_row.merged_into_staff_id is null
    and staff_row.branch_id is not null
    and coalesce(staff_row.is_cross_branch, false) is false
    and not exists (
      select 1 from public.staff_permanent_branch_transfers as transfer_row
      where transfer_row.staff_id = staff_row.id
        and transfer_row.status in ('scheduled', 'effective')
    )
    and not exists (
      select 1 from public.staff_branch_change_requests as request_row
      where request_row.staff_id = staff_row.id
        and request_row.decision_type = 'permanent_branch_transfer'
    )
  order by staff_row.created_at
  limit 1
  for update;

  select branch_row.id into v_other_branch_id
  from public.branches as branch_row
  where branch_row.is_active is true
    and branch_row.id <> v_home_branch_id
  order by branch_row.created_at
  limit 1;

  if v_staff_id is null or v_other_branch_id is null then
    raise exception 'attendance_branch_authority_fixture_unavailable';
  end if;

  select * into v_result
  from public.resolve_effective_attendance_branch(
    v_staff_id, v_home_branch_id, current_date, false
  );
  if v_result.allowed is not true
     or v_result.effective_branch_id <> v_home_branch_id
     or v_result.source <> 'home_branch' then
    raise exception 'home_branch_resolution_failed';
  end if;

  insert into public.staff_permanent_branch_transfers (
    staff_id, previous_branch_id, new_branch_id, effective_date,
    status, reason, metadata
  ) values (
    v_staff_id, v_home_branch_id, v_other_branch_id, current_date + 10,
    'scheduled', 'Rollback-only Attendance authority test',
    jsonb_build_object('test', true)
  );

  select * into v_result
  from public.resolve_effective_attendance_branch(
    v_staff_id, v_home_branch_id, current_date, false
  );
  if v_result.allowed is not true or v_result.effective_branch_id <> v_home_branch_id then
    raise exception 'future_transfer_applied_early';
  end if;

  select * into v_result
  from public.resolve_effective_attendance_branch(
    v_staff_id, v_other_branch_id, current_date + 10, false
  );
  if v_result.allowed is not true
     or v_result.effective_branch_id <> v_other_branch_id
     or v_result.source <> 'effective_permanent_transfer' then
    raise exception 'future_transfer_not_effective_on_date';
  end if;

  insert into public.staff_attendance_branch_assignments (
    staff_id, branch_id, assignment_date, assignment_type, status,
    home_branch_id, valid_from, valid_until, attendance_business_date,
    scope, is_test, reason, metadata
  ) values (
    v_staff_id, v_other_branch_id, current_date, 'temporary', 'approved',
    v_home_branch_id, now() - interval '1 minute', now() + interval '1 hour',
    current_date, 'shift', false, 'Rollback-only Attendance authority test',
    jsonb_build_object('test', true)
  ) returning id into v_temporary_id;

  select * into v_result
  from public.resolve_effective_attendance_branch(
    v_staff_id, v_other_branch_id, current_date, false
  );
  if v_result.allowed is not true
     or v_result.source <> 'temporary_branch_access_shift' then
    raise exception 'temporary_assignment_not_selected';
  end if;
  if (select branch_id from public.staff where id = v_staff_id) <> v_home_branch_id then
    raise exception 'temporary_assignment_changed_home_branch';
  end if;

  update public.staff_attendance_branch_assignments
     set valid_until = now() - interval '1 second'
   where id = v_temporary_id;

  select * into v_result
  from public.resolve_effective_attendance_branch(
    v_staff_id, v_home_branch_id, current_date, false
  );
  if v_result.allowed is not true or v_result.effective_branch_id <> v_home_branch_id then
    raise exception 'expired_temporary_assignment_remained_effective';
  end if;

  insert into public.staff_duty_assignments (
    staff_id, branch_id, day_of_week, duty_type, is_active
  ) values (
    v_staff_id, v_other_branch_id, extract(dow from current_date)::integer,
    'opening', true
  ) returning id into v_duty_other_id;

  select * into v_result
  from public.resolve_effective_attendance_branch(
    v_staff_id, v_other_branch_id, current_date, false
  );
  if v_result.allowed is not true or v_result.source <> 'schedule_assignment' then
    raise exception 'matching_duty_assignment_not_selected';
  end if;

  insert into public.staff_duty_assignments (
    staff_id, branch_id, day_of_week, duty_type, is_active
  ) values (
    v_staff_id, v_home_branch_id, extract(dow from current_date)::integer,
    'closing', true
  ) returning id into v_duty_home_id;

  select * into v_result
  from public.resolve_effective_attendance_branch(
    v_staff_id, v_other_branch_id, current_date, false
  );
  if v_result.allowed is not false or v_result.source <> 'duty_assignment_conflict' then
    raise exception 'contradictory_duty_assignment_did_not_fail_closed';
  end if;

  delete from public.staff_duty_assignments
  where id in (v_duty_other_id, v_duty_home_id);

  update public.staff set is_cross_branch = true where id = v_staff_id;
  select * into v_result
  from public.resolve_effective_attendance_branch(
    v_staff_id, v_other_branch_id, current_date, false
  );
  if v_result.allowed is not true or v_result.source <> 'approved_cross_branch' then
    raise exception 'cross_branch_resolution_failed';
  end if;

  update public.staff set is_cross_branch = false where id = v_staff_id;
  select * into v_result
  from public.resolve_effective_attendance_branch(
    v_staff_id, v_other_branch_id, current_date, false
  );
  if v_result.allowed is not false or v_result.effective_branch_id <> v_home_branch_id then
    raise exception 'unauthorized_wrong_branch_was_allowed';
  end if;
end;
$test$;

rollback;
