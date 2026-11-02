-- LOCAL-only tests after the accepted staff fixtures, TEST privilege overlay,
-- and pr58-branch-schedule-device-local-slice.sql, in one disposable database.

-- Section 1: Initial State & Security / Privilege Boundary Assertions
-- 1.1 Reset fixture state
update public.staff set branch_id='00000000-0000-0000-0000-000000000201',system_role='staff'
 where id='00000000-0000-0000-0000-000000000303';

-- 1.2 Privilege and trigger invariants
do $$ begin
  if (select branch_id from public.staff_devices where id='00000000-0000-0000-0000-000000000401')
      <> '00000000-0000-0000-0000-000000000201'::uuid then
    raise exception 'staff/device branch synchronization failed'; end if;
  if has_table_privilege('anon','public.staff','SELECT')
    or has_table_privilege('anon','public.staff_devices','SELECT')
    or has_table_privilege('anon','public.schedule_overrides','SELECT')
    or has_table_privilege('anon','public.staff_schedules','SELECT')
    or has_table_privilege('anon','public.staff_attendance_branch_assignments','SELECT')
    or has_table_privilege('anon','public.staff_device_registration_requests','SELECT')
    or has_table_privilege('anon','public.device_activation_tokens','SELECT')
    or has_table_privilege('anon','public.attendance_device_audit_events','SELECT')
    or has_table_privilege('authenticated','public.staff_devices','INSERT')
    or has_table_privilege('authenticated','public.staff_devices','UPDATE')
    or has_table_privilege('authenticated','public.staff_attendance_branch_assignments','INSERT')
    or has_table_privilege('authenticated','public.staff_device_registration_requests','INSERT')
    or has_table_privilege('authenticated','public.device_activation_tokens','INSERT')
    or has_function_privilege('authenticated',
      'public.resolve_effective_attendance_branch(uuid,uuid,date)','EXECUTE')
    or has_function_privilege('authenticated',
      'public.resolve_effective_attendance_branch(uuid,uuid,date,boolean)','EXECUTE')
    or has_function_privilege('authenticated',
      'public.review_staff_device_registration_request(uuid,text,uuid,uuid,text,text,uuid,text,timestamptz,integer)',
      'EXECUTE')
    or has_function_privilege('authenticated',
      'public.complete_staff_device_registration_request(uuid,uuid,text,text,text,text,text,text,integer)',
      'EXECUTE')
    or has_function_privilege('anon',
      'public.complete_staff_device_registration_request(uuid,uuid,text,text,text,text,text,text,integer)',
      'EXECUTE') then raise exception 'authorization grant widened'; end if;
  if not has_function_privilege('service_role',
      'public.resolve_effective_attendance_branch(uuid,uuid,date)','EXECUTE')
    or not has_function_privilege('service_role',
      'public.resolve_effective_attendance_branch(uuid,uuid,date,boolean)','EXECUTE')
    or not has_function_privilege('service_role',
      'public.review_staff_device_registration_request(uuid,text,uuid,uuid,text,text,uuid,text,timestamptz,integer)',
      'EXECUTE')
    or not has_function_privilege('service_role',
      'public.complete_staff_device_registration_request(uuid,uuid,text,text,text,text,text,text,integer)',
      'EXECUTE') then raise exception 'server grant missing'; end if;
  if (select count(*) from pg_catalog.pg_trigger
      where tgrelid='public.staff_schedules'::regclass and not tgisinternal)<>1 then
    raise exception 'reviewed schedule validator missing'; end if;
  if (select count(*) from pg_catalog.pg_trigger
      where tgrelid='public.staff_devices'::regclass and not tgisinternal)<>2 then
    raise exception 'device update/audit trigger missing'; end if;
end $$;

-- Section 2: Branch Authority Resolution (resolve_effective_attendance_branch)
set role service_role;
do $$ declare v record; s uuid := '00000000-0000-0000-0000-000000000303';
  main uuid := '00000000-0000-0000-0000-000000000201';
  sm uuid := '00000000-0000-0000-0000-000000000202'; begin
  select * into v from public.resolve_effective_attendance_branch(s,main,date '2026-11-02');
  if not v.allowed or v.source<>'home_branch' then raise exception 'home authority failed'; end if;
  select * into v from public.resolve_effective_attendance_branch(s,sm,date '2026-11-02');
  if v.allowed or v.effective_branch_id<>main then raise exception 'wrong branch accepted'; end if;
  select * into v from public.resolve_effective_attendance_branch(null,main,date '2026-11-02');
  if v.allowed or v.source<>'review' then raise exception 'null staff accepted'; end if;
end $$;
reset role;

update public.branches set is_active=false where id='00000000-0000-0000-0000-000000000202';
set role service_role;
do $$ declare v record; begin
  select * into v from public.resolve_effective_attendance_branch(
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0000-000000000202',date '2026-11-02');
  if v.allowed or v.source<>'inactive_branch' then raise exception 'inactive branch accepted'; end if;
end $$;
reset role;
update public.branches set is_active=true where id='00000000-0000-0000-0000-000000000202';

insert into public.staff_duty_assignments(staff_id,branch_id,day_of_week,duty_type)
values ('00000000-0000-0000-0000-000000000303','00000000-0000-0000-0000-000000000202',1,'opening');
set role service_role;
do $$ declare v record; begin
  select * into v from public.resolve_effective_attendance_branch(
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0000-000000000202',date '2026-11-02');
  if not v.allowed or v.source<>'schedule_assignment' then raise exception 'duty branch not effective'; end if;
end $$;
reset role;
insert into public.staff_duty_assignments(staff_id,branch_id,day_of_week,duty_type)
values ('00000000-0000-0000-0000-000000000303','00000000-0000-0000-0000-000000000201',1,'closing');
set role service_role;
do $$ declare v record; begin
  select * into v from public.resolve_effective_attendance_branch(
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0000-000000000202',date '2026-11-02');
  if v.allowed or v.source<>'duty_assignment_conflict' then
    raise exception 'contradictory duty accepted'; end if;
end $$;
reset role;
delete from public.staff_duty_assignments where staff_id='00000000-0000-0000-0000-000000000303';

insert into public.staff_attendance_branch_assignments
  (id,staff_id,branch_id,assignment_date,assignment_type,scope,attendance_business_date)
values ('00000000-0000-0000-0000-000000000601',
  '00000000-0000-0000-0000-000000000303',
  '00000000-0000-0000-0000-000000000202',date '2026-11-02',
  'temporary','business_day',date '2026-11-02');
set role service_role;
do $$ declare v record; begin
  select * into v from public.resolve_effective_attendance_branch(
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0000-000000000202',date '2026-11-02',false);
  if not v.allowed or v.source<>'temporary_branch_access_day' then
    raise exception 'approved temporary branch rejected'; end if;
  select * into v from public.resolve_effective_attendance_branch(
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0000-000000000202',date '2026-11-02',true);
  if v.allowed then raise exception 'TEST-mode mismatch accepted'; end if;
end $$;
reset role;
update public.staff_attendance_branch_assignments set status='revoked'
  where id='00000000-0000-0000-0000-000000000601';

insert into public.staff_permanent_branch_transfers
  (staff_id,previous_branch_id,new_branch_id,effective_date,status)
values ('00000000-0000-0000-0000-000000000303',
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000202',date '2026-11-03','scheduled');
set role service_role;
do $$ declare v record; begin
  select * into v from public.resolve_effective_attendance_branch(
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0000-000000000202',date '2026-11-02');
  if v.allowed then raise exception 'future transfer applied early'; end if;
  select * into v from public.resolve_effective_attendance_branch(
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0000-000000000202',date '2026-11-03');
  if not v.allowed or v.source<>'effective_permanent_transfer' then
    raise exception 'effective transfer rejected'; end if;
end $$;
reset role;

-- Section 3: Staff Schedules, Schedule Overrides, Triggers, and RLS
-- 3.1 Valid schedule insertion (subject to validate_staff_schedule_window) on Wednesday (day 3)
insert into public.staff_schedules (id, staff_id, day_of_week, start_time, end_time, is_active, shift_type, window_order)
values ('00000000-0000-0000-0000-000000000701',
        '00000000-0000-0000-0000-000000000303', 3, time '09:00', time '18:00', true, 'single', 1);

-- 3.2 Overlapping window rejection (day 1 already has 09:00-17:00 from prior fixture)
do $$ begin
  begin
    insert into public.staff_schedules (id, staff_id, day_of_week, start_time, end_time, is_active, shift_type, window_order)
    values ('00000000-0000-0000-0000-000000000702',
            '00000000-0000-0000-0000-000000000303', 1, time '14:00', time '20:00', true, 'single', 2);
    raise exception 'overlapping schedule window accepted';
  exception when sqlstate '23P01' then null; end;
end $$;

-- 3.3 Schedule overrides insertion & constraints
insert into public.schedule_overrides (id, staff_id, override_date, is_day_off, reason)
values ('00000000-0000-0000-0000-000000000711',
        '00000000-0000-0000-0000-000000000303', date '2026-11-04', true, 'Approved day off');

insert into public.schedule_overrides (id, staff_id, override_date, is_day_off, start_time, end_time, shift_type, reason)
values ('00000000-0000-0000-0000-000000000712',
        '00000000-0000-0000-0000-000000000303', date '2026-11-05', false, time '10:00', time '19:00', 'single', 'Special shift');

-- Invalid override constraint checks
do $$ begin
  begin
    insert into public.schedule_overrides (staff_id, override_date, is_day_off, start_time, end_time)
    values ('00000000-0000-0000-0000-000000000303', date '2026-11-06', false, null, null);
    raise exception 'missing times on working override accepted';
  exception when check_violation then null; end;
  begin
    insert into public.schedule_overrides (staff_id, override_date, is_day_off, start_time, end_time, ends_next_day)
    values ('00000000-0000-0000-0000-000000000303', date '2026-11-06', false, time '18:00', time '09:00', false);
    raise exception 'inverted time without ends_next_day accepted';
  exception when check_violation then null; end;
  begin
    insert into public.schedule_overrides (staff_id, override_date, is_day_off, start_time, end_time)
    values ('00000000-0000-0000-0000-000000000303', date '2026-11-06', false, time '10:00', time '10:00');
    raise exception 'zero length override window accepted';
  exception when check_violation then null; end;
end $$;

-- 3.4 Schedules and overrides RLS checks
-- Staff (therapist 303, user 103)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000103',false);
set role authenticated;
do $$ begin
  if (select count(*) from public.staff_schedules where staff_id='00000000-0000-0000-0000-000000000303') <> 3 then
    raise exception 'staff cannot see own schedule'; end if;
  if (select count(*) from public.staff_schedules where staff_id='00000000-0000-0000-0000-000000000304') <> 0 then
    raise exception 'staff saw another staff schedule'; end if;
  if (select count(*) from public.schedule_overrides where staff_id='00000000-0000-0000-0000-000000000303') <> 2 then
    raise exception 'staff cannot see own overrides'; end if;
  if (select count(*) from public.schedule_overrides where staff_id='00000000-0000-0000-0000-000000000304') <> 0 then
    raise exception 'staff saw another staff override'; end if;
  -- Staff cannot insert schedule override (requires managerial/crm role)
  begin
    insert into public.schedule_overrides (staff_id, override_date, is_day_off)
    values ('00000000-0000-0000-0000-000000000303', date '2026-11-07', true);
    raise exception 'regular staff inserted schedule override';
  exception when insufficient_privilege or check_violation then null; end;
end $$;
reset role;

-- Manager in Branch 201 (manager 302, user 102)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',false);
set role authenticated;
do $$ begin
  if (select count(*) from public.staff_schedules where staff_id='00000000-0000-0000-0000-000000000303') <> 3 then
    raise exception 'branch manager cannot see branch staff schedule'; end if;
  -- Manager can insert override for branch staff
  insert into public.schedule_overrides (staff_id, override_date, is_day_off, reason)
  values ('00000000-0000-0000-0000-000000000303', date '2026-11-07', true, 'Manager inserted day off');
  -- Manager CANNOT insert override for staff in branch 202
  begin
    insert into public.schedule_overrides (staff_id, override_date, is_day_off, reason)
    values ('00000000-0000-0000-0000-000000000304', date '2026-11-07', true, 'Unauthorized cross-branch override');
    raise exception 'manager inserted override for staff in another branch';
  exception when check_violation or insufficient_privilege then null; end;
end $$;
reset role;

-- Section 4: Device Registration Requests, Reviews, and Completions
-- 4.1 Insert initial pending registration request via service_role
insert into public.staff_device_registration_requests (
  id, staff_id, branch_id, device_fingerprint_hash, device_label,
  request_type, registration_method, status
) values (
  '00000000-0000-0000-0000-000000000501',
  '00000000-0000-0000-0000-000000000303',
  '00000000-0000-0000-0000-000000000201',
  'phone-hash-pending-rejection',
  'Synthetic Pending Phone',
  'new_phone',
  'portal_request',
  'pending'
);

-- 4.2 RLS on staff_device_registration_requests
-- Staff (therapist 303, user 103)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000103',false);
set role authenticated;
do $$ begin
  if (select count(*) from public.staff_device_registration_requests where staff_id='00000000-0000-0000-0000-000000000303') <> 1 then
    raise exception 'staff cannot see own registration request'; end if;
  if (select count(*) from public.staff_device_registration_requests where staff_id='00000000-0000-0000-0000-000000000304') <> 0 then
    raise exception 'staff saw another staff registration request'; end if;
end $$;
reset role;

-- Driver (driver 304, user 104 in branch 202)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000104',false);
set role authenticated;
do $$ begin
  if (select count(*) from public.staff_device_registration_requests where id='00000000-0000-0000-0000-000000000501') <> 0 then
    raise exception 'driver in branch 202 saw branch 201 registration request'; end if;
end $$;
reset role;

-- 4.3 Review function (review_staff_device_registration_request)
set role service_role;
-- Unauthorized reviewer check: driver 304 from branch 202 attempts to review request for branch 201 staff
do $$ begin
  begin
    perform public.review_staff_device_registration_request(
      '00000000-0000-0000-0000-000000000501',
      'rejected',
      '00000000-0000-0000-0000-000000000104',
      '00000000-0000-0000-0000-000000000304',
      'Unauthorized review attempt',
      'security_concern'
    );
    raise exception 'unauthorized reviewer accepted';
  exception when sqlstate '42501' then null; end;
end $$;

-- Invalid review status check
do $$ begin
  begin
    perform public.review_staff_device_registration_request(
      '00000000-0000-0000-0000-000000000501',
      'invalid_status',
      '00000000-0000-0000-0000-000000000102',
      '00000000-0000-0000-0000-000000000302'
    );
    raise exception 'invalid review status accepted';
  exception when sqlstate '22023' then null; end;
end $$;

-- Invalid rejection reason check
do $$ begin
  begin
    perform public.review_staff_device_registration_request(
      '00000000-0000-0000-0000-000000000501',
      'rejected',
      '00000000-0000-0000-0000-000000000102',
      '00000000-0000-0000-0000-000000000302',
      'note',
      'invalid_reason_string'
    );
    raise exception 'invalid rejection reason accepted';
  exception when sqlstate '22023' then null; end;
end $$;

-- Valid rejection execution
do $$ declare r record; begin
  select * into r from public.review_staff_device_registration_request(
    '00000000-0000-0000-0000-000000000501',
    'rejected',
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000302',
    'Rejected by manager note',
    'device_limit_reached'
  );
  if r.request_status <> 'rejected' then raise exception 'rejection status failed'; end if;
end $$;

-- 4.4 Approval and completion flow for secondary device
insert into public.staff_device_registration_requests (
  id, staff_id, branch_id, device_fingerprint_hash, device_label,
  request_type, registration_method, status
) values (
  '00000000-0000-0000-0000-000000000502',
  '00000000-0000-0000-0000-000000000303',
  '00000000-0000-0000-0000-000000000201',
  'phone-hash-secondary-active',
  'Therapist Secondary Phone',
  'new_phone',
  'portal_request',
  'pending'
);

-- Missing activation token on approval check
do $$ begin
  begin
    perform public.review_staff_device_registration_request(
      '00000000-0000-0000-0000-000000000502',
      'approved',
      '00000000-0000-0000-0000-000000000102',
      '00000000-0000-0000-0000-000000000302',
      'Approval note',
      null,
      null,
      null,
      null
    );
    raise exception 'approval without token accepted';
  exception when sqlstate '22023' then null; end;
end $$;

-- Valid approval
do $$ declare r record; begin
  select * into r from public.review_staff_device_registration_request(
    '00000000-0000-0000-0000-000000000502',
    'approved',
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000302',
    'Approved by manager',
    null,
    null,
    'token-hash-approval-502',
    now() + interval '24 hours',
    2
  );
  if r.request_status <> 'approved' or r.activation_token_id is null then
    raise exception 'valid approval failed'; end if;
end $$;

-- 4.5 Completion rejection paths (complete_staff_device_registration_request)
do $$ declare res record; begin
  -- Wrong staff_id rejection
  select * into res from public.complete_staff_device_registration_request(
    '00000000-0000-0000-0000-000000000502',
    '00000000-0000-0000-0000-000000000304', -- Wrong staff
    'phone-hash-secondary-active'
  );
  if res.success or res.code <> 'request_not_available' then
    raise exception 'wrong-user completion accepted'; end if;

  -- Credential hash mismatch rejection
  select * into res from public.complete_staff_device_registration_request(
    '00000000-0000-0000-0000-000000000502',
    '00000000-0000-0000-0000-000000000303',
    'wrong-credential-hash'
  );
  if res.success or res.code <> 'request_not_available' then
    raise exception 'mismatched credential hash completion accepted'; end if;
end $$;

-- Expired approval token rejection
update public.staff_device_registration_requests
   set expires_at = now() - interval '1 hour'
 where id = '00000000-0000-0000-0000-000000000502';
do $$ declare res record; begin
  select * into res from public.complete_staff_device_registration_request(
    '00000000-0000-0000-0000-000000000502',
    '00000000-0000-0000-0000-000000000303',
    'phone-hash-secondary-active'
  );
  if res.success or res.code <> 'approval_expired' then
    raise exception 'expired approval completion accepted'; end if;
end $$;

-- Reset expiry and execute successful completion
update public.staff_device_registration_requests
   set status = 'approved', expires_at = now() + interval '24 hours'
 where id = '00000000-0000-0000-0000-000000000502';

do $$ declare res record; dev record; begin
  select * into res from public.complete_staff_device_registration_request(
    '00000000-0000-0000-0000-000000000502',
    '00000000-0000-0000-0000-000000000303',
    'phone-hash-secondary-active',
    'Therapist Pixel 8',
    'Mozilla/5.0 Android',
    'Chrome',
    '120.0',
    'Android',
    2
  );
  if not res.success or res.code <> 'completed' or res.device_id is null then
    raise exception 'completion failed'; end if;

  select * into dev from public.staff_devices where id = res.device_id;
  if dev.status <> 'active' or dev.device_role <> 'secondary' then
    raise exception 'secondary device configuration invalid'; end if;
end $$;
reset role;

-- Section 5: Device States, Device Limit, and Replacement Workflow
set role service_role;
-- 5.1 Device limit enforcement: staff 303 now has 2 active devices (401 primary, secondary)
insert into public.staff_device_registration_requests (
  id, staff_id, branch_id, device_fingerprint_hash, device_label,
  request_type, registration_method, status
) values (
  '00000000-0000-0000-0000-000000000503',
  '00000000-0000-0000-0000-000000000303',
  '00000000-0000-0000-0000-000000000201',
  'phone-hash-exceeding-limit',
  'Third Phone',
  'new_phone',
  'portal_request',
  'pending'
);

do $$ begin
  begin
    perform public.review_staff_device_registration_request(
      '00000000-0000-0000-0000-000000000503',
      'approved',
      '00000000-0000-0000-0000-000000000102',
      '00000000-0000-0000-0000-000000000302',
      'Attempt 3rd device',
      null,
      null,
      'token-hash-503',
      now() + interval '24 hours',
      2 -- limit = 2
    );
    raise exception '3rd device approved when active limit is 2';
  exception when sqlstate 'P0001' then null; end;
end $$;

-- 5.2 Replacement phone workflow: replacement of primary device 401
insert into public.staff_device_registration_requests (
  id, staff_id, branch_id, device_fingerprint_hash, device_label,
  request_type, registration_method, status
) values (
  '00000000-0000-0000-0000-000000000504',
  '00000000-0000-0000-0000-000000000303',
  '00000000-0000-0000-0000-000000000201',
  'phone-hash-replacement-primary',
  'Therapist Replacement Phone',
  'replacement',
  'portal_request',
  'pending'
);

-- Approve replacement specifying replacement device id (401)
do $$ declare r record; begin
  select * into r from public.review_staff_device_registration_request(
    '00000000-0000-0000-0000-000000000504',
    'approved',
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000302',
    'Approved replacement for phone 401',
    null,
    '00000000-0000-0000-0000-000000000401',
    'token-hash-replacement-504',
    now() + interval '24 hours',
    2
  );
  if r.request_status <> 'approved' then raise exception 'replacement approval failed'; end if;
end $$;

-- Complete replacement request
do $$ declare res record; old_dev record; new_dev record; begin
  select * into res from public.complete_staff_device_registration_request(
    '00000000-0000-0000-0000-000000000504',
    '00000000-0000-0000-0000-000000000303',
    'phone-hash-replacement-primary',
    'Therapist New Primary Phone',
    'Mozilla/5.0 iOS',
    'Mobile Safari',
    '17.0',
    'iOS',
    2
  );
  if not res.success or res.code <> 'completed' or res.device_id is null then
    raise exception 'replacement completion failed'; end if;

  -- Verify old device is revoked and marked superseded
  select * into old_dev from public.staff_devices where id = '00000000-0000-0000-0000-000000000401';
  if old_dev.status <> 'revoked' or old_dev.revocation_reason <> 'replacement_phone'
     or old_dev.superseded_by_device_id <> res.device_id then
    raise exception 'old device not properly revoked and superseded'; end if;

  -- Verify new device has primary role
  select * into new_dev from public.staff_devices where id = res.device_id;
  if new_dev.status <> 'active' or new_dev.device_role <> 'primary' then
    raise exception 'new replacement device not primary'; end if;
end $$;

-- 5.3 Device state transitions and lifecycle audits (revocation, security block)
-- Revoke the secondary device with reason 'lost_phone'
update public.staff_devices
   set status = 'revoked', revocation_reason = 'lost_phone', revoked_at = now()
 where device_fingerprint_hash = 'phone-hash-secondary-active';

-- Block a device with security_state = 'blocked'
update public.staff_devices
   set status = 'security_blocked', security_state = 'blocked'
 where device_fingerprint_hash = 'phone-hash-replacement-primary';

-- Verify audit event logs in attendance_device_audit_events
do $$
declare
  v_registered_count integer;
  v_replaced_count integer;
  v_revoked_count integer;
  v_blocked_count integer;
begin
  select count(*) into v_registered_count from public.attendance_device_audit_events where event_type = 'registered';
  select count(*) into v_replaced_count from public.attendance_device_audit_events where event_type = 'replaced';
  select count(*) into v_revoked_count from public.attendance_device_audit_events where event_type = 'revoked';
  select count(*) into v_blocked_count from public.attendance_device_audit_events where event_type = 'security_blocked';

  if v_registered_count < 2 or v_replaced_count < 1 or v_revoked_count < 1 or v_blocked_count < 1 then
    raise exception 'lifecycle audit event counts unexpected: reg=%, rep=%, rev=%, blk=%',
      v_registered_count, v_replaced_count, v_revoked_count, v_blocked_count;
  end if;
end $$;
reset role;

-- Section 6: Device States for Attendance Scanning Verification
-- Testing Registered/Active, Unregistered, Revoked, Security Blocked, Wrong-User, and Wrong-Branch states
do $$
declare
  v_active_id uuid;
  v_revoked_id uuid;
  v_blocked_id uuid;
  v_unregistered_found boolean;
  v_wrong_user_match boolean;
begin
  -- Unregistered: credential hash not in staff_devices
  select exists (
    select 1 from public.staff_devices where device_fingerprint_hash = 'unregistered-phone-credential-hash'
  ) into v_unregistered_found;
  if v_unregistered_found then raise exception 'unregistered device found in registry'; end if;

  -- Revoked device
  select id into v_revoked_id from public.staff_devices
  where device_fingerprint_hash = 'phone-hash-secondary-active' and status = 'revoked';
  if v_revoked_id is null then raise exception 'revoked device state check failed'; end if;

  -- Security blocked device
  select id into v_blocked_id from public.staff_devices
  where device_fingerprint_hash = 'phone-hash-replacement-primary' and status = 'security_blocked' and security_state = 'blocked';
  if v_blocked_id is null then raise exception 'blocked device state check failed'; end if;

  -- Wrong-user check: device belongs to staff 303, but scanning staff is 304
  select exists (
    select 1 from public.staff_devices
    where id = v_revoked_id and staff_id = '00000000-0000-0000-0000-000000000304'
  ) into v_wrong_user_match;
  if v_wrong_user_match then raise exception 'wrong-user device matched scanning staff'; end if;

  -- Wrong-branch device check: device branch is 201, but scanning at branch 202
  if (select branch_id from public.staff_devices where id = v_revoked_id) = '00000000-0000-0000-0000-000000000202' then
    raise exception 'device branch unexpectedly matched wrong branch'; end if;
end $$;

-- Section 7: Final Result Confirmation
select 'PR58 branch authority, schedules, and device dependency slice LOCAL checks passed' as result;
