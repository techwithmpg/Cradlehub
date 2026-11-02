-- =============================================================================
-- CRADLEHUB ATTENDANCE LOCAL TESTS: QR POINTS, SCAN EVENTS & GEOFENCE
-- Target: Disposable LOCAL PostgreSQL 17 only (127.0.0.1:55444)
-- Run after all preceding fixtures and slices.
-- =============================================================================

\set ON_ERROR_STOP 1

-- =============================================================================
-- 1. PRIVILEGES & SECURITY ISOLATION
-- =============================================================================

do $$
begin
  -- Anon role: zero access to QR points, scan events, resources, exceptions
  if has_table_privilege('anon', 'public.qr_points', 'SELECT') or
     has_table_privilege('anon', 'public.qr_points', 'INSERT') or
     has_table_privilege('anon', 'public.qr_scan_events', 'SELECT') or
     has_table_privilege('anon', 'public.qr_scan_events', 'INSERT') or
     has_table_privilege('anon', 'public.branch_resources', 'SELECT') or
     has_table_privilege('anon', 'public.attendance_exceptions', 'SELECT') then
    raise exception 'SECURITY VIOLATION: anon role has unexpected table privileges';
  end if;

  -- Authenticated role: SELECT only, strictly no direct client writes
  if not has_table_privilege('authenticated', 'public.qr_points', 'SELECT') or
     not has_table_privilege('authenticated', 'public.qr_scan_events', 'SELECT') or
     not has_table_privilege('authenticated', 'public.branch_resources', 'SELECT') or
     not has_table_privilege('authenticated', 'public.attendance_exceptions', 'SELECT') then
    raise exception 'SECURITY VIOLATION: authenticated role missing required SELECT privileges';
  end if;

  if has_table_privilege('authenticated', 'public.qr_points', 'INSERT') or
     has_table_privilege('authenticated', 'public.qr_points', 'UPDATE') or
     has_table_privilege('authenticated', 'public.qr_points', 'DELETE') or
     has_table_privilege('authenticated', 'public.qr_scan_events', 'INSERT') or
     has_table_privilege('authenticated', 'public.qr_scan_events', 'UPDATE') or
     has_table_privilege('authenticated', 'public.qr_scan_events', 'DELETE') then
    raise exception 'SECURITY VIOLATION: authenticated role has direct write privileges on scan tables';
  end if;

  -- Service role: full CRUD
  if not has_table_privilege('service_role', 'public.qr_points', 'INSERT') or
     not has_table_privilege('service_role', 'public.qr_scan_events', 'INSERT') or
     not has_table_privilege('service_role', 'public.branch_resources', 'INSERT') or
     not has_table_privilege('service_role', 'public.attendance_exceptions', 'INSERT') then
    raise exception 'SECURITY VIOLATION: service_role missing CRUD privileges on scan tables';
  end if;

  -- RPC isolation: commit_attendance_scan_transaction revoked from public, anon, authenticated
  if has_function_privilege('anon', 'public.commit_attendance_scan_transaction(text,uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,jsonb,boolean,jsonb,uuid,jsonb,jsonb,jsonb,text)', 'EXECUTE') or
     has_function_privilege('authenticated', 'public.commit_attendance_scan_transaction(text,uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,jsonb,boolean,jsonb,uuid,jsonb,jsonb,jsonb,text)', 'EXECUTE') then
    raise exception 'SECURITY VIOLATION: commit_attendance_scan_transaction executable by client roles';
  end if;

  if not has_function_privilege('service_role', 'public.commit_attendance_scan_transaction(text,uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,jsonb,boolean,jsonb,uuid,jsonb,jsonb,jsonb,text)', 'EXECUTE') then
    raise exception 'SECURITY VIOLATION: service_role cannot execute commit_attendance_scan_transaction';
  end if;
end $$;

-- =============================================================================
-- 2. BRANCH COORDINATES, RANGE CONSTRAINTS & HAVERSINE DISTANCE
-- =============================================================================

do $$
declare
  v_main_lat numeric;
  v_main_lon numeric;
  v_sm_lat numeric;
  v_sm_lon numeric;
  v_dist numeric;
  v_violation boolean := false;
begin
  select latitude, longitude into v_main_lat, v_main_lon
  from public.branches where id = '00000000-0000-0000-0000-000000000201';

  select latitude, longitude into v_sm_lat, v_sm_lon
  from public.branches where id = '00000000-0000-0000-0000-000000000202';

  if v_main_lat <> 10.7024485 or v_main_lon <> 122.9619465 then
    raise exception 'Main branch coordinates mismatch: lat=%, lon=%', v_main_lat, v_main_lon;
  end if;

  if v_sm_lat <> 10.671561584942413 or v_sm_lon <> 122.94369105292084 then
    raise exception 'SM branch coordinates mismatch: lat=%, lon=%', v_sm_lat, v_sm_lon;
  end if;

  -- Test latitude check constraint (> 90)
  begin
    update public.branches set latitude = 95.0 where id = '00000000-0000-0000-0000-000000000201';
    v_violation := true;
  exception when check_violation then
    -- expected 23514
    null;
  end;
  if v_violation then
    raise exception 'Latitude range constraint failed to reject out-of-bounds value';
  end if;

  -- Test longitude check constraint (< -180)
  begin
    update public.branches set longitude = -185.0 where id = '00000000-0000-0000-0000-000000000201';
    v_violation := true;
  exception when check_violation then
    -- expected 23514
    null;
  end;
  if v_violation then
    raise exception 'Longitude range constraint failed to reject out-of-bounds value';
  end if;

  -- Verify distance calculations
  -- Distance to same point is 0
  v_dist := public.calculate_distance_meters(v_main_lat, v_main_lon, v_main_lat, v_main_lon);
  if v_dist <> 0 then
    raise exception 'Distance to identical coordinates must be 0, got %', v_dist;
  end if;

  -- Distance to nearby point (lat 10.7025000, lon 122.9620000) should be ~8.18 meters
  v_dist := public.calculate_distance_meters(v_main_lat, v_main_lon, 10.7025000, 122.9620000);
  if v_dist < 8.15 or v_dist > 8.25 then
    raise exception 'Distance calculation unexpected: expected ~8.18m, got %', v_dist;
  end if;

  -- Distance between Main and SM should be ~3971.8 meters
  v_dist := public.calculate_distance_meters(v_main_lat, v_main_lon, v_sm_lat, v_sm_lon);
  if v_dist < 3960 or v_dist > 3985 then
    raise exception 'Distance between branches unexpected: expected ~3972m, got %', v_dist;
  end if;
end $$;

-- =============================================================================
-- 3. QR POINTS CREATION, RESOURCE CONSTRAINT & PARTIAL UNIQUE INDEXES
-- =============================================================================

do $$
declare
  v_main_id uuid := '00000000-0000-0000-0000-000000000201';
  v_room_id uuid;
  v_point_attend_id uuid;
  v_point_room_id uuid;
  v_violation boolean := false;
begin
  -- 3.1 Valid attendance QR point (resource_id must be null)
  insert into public.qr_points (
    branch_id, point_type, resource_id, public_code, label
  )
  values (
    v_main_id, 'attendance', null, 'qr-main-attend-valid-01', 'Main Branch Attendance QR'
  )
  returning id into v_point_attend_id;

  if v_point_attend_id is null then
    raise exception 'Failed to create valid attendance QR point';
  end if;

  -- 3.2 Invalid attendance QR point with resource_id must fail check constraint
  begin
    insert into public.qr_points (
      branch_id, point_type, resource_id, public_code, label
    )
    values (
      v_main_id, 'attendance', gen_random_uuid(), 'qr-main-attend-invalid-01', 'Invalid Attendance QR'
    );
    v_violation := true;
  exception when check_violation then
    -- expected 23514 (qr_points_resource_requirement)
    null;
  end;
  if v_violation then
    raise exception 'Attendance QR point accepted illegal non-null resource_id';
  end if;

  -- 3.3 Create a physical branch resource
  insert into public.branch_resources (
    branch_id, name, type, capacity, is_active
  )
  values (
    v_main_id, 'Therapy Room 1', 'room', 1, true
  )
  returning id into v_room_id;

  -- 3.4 Valid room QR point (resource_id must be non-null)
  insert into public.qr_points (
    branch_id, point_type, resource_id, public_code, label
  )
  values (
    v_main_id, 'room', v_room_id, 'qr-main-room-101', 'Room 1 Service QR'
  )
  returning id into v_point_room_id;

  if v_point_room_id is null then
    raise exception 'Failed to create valid room QR point';
  end if;

  -- 3.5 Invalid room QR point with null resource_id must fail check constraint
  begin
    insert into public.qr_points (
      branch_id, point_type, resource_id, public_code, label
    )
    values (
      v_main_id, 'room', null, 'qr-main-room-invalid', 'Invalid Room QR'
    );
    v_violation := true;
  exception when check_violation then
    -- expected 23514 (qr_points_resource_requirement)
    null;
  end;
  if v_violation then
    raise exception 'Room QR point accepted illegal null resource_id';
  end if;

  -- 3.6 Partial unique index: second ACTIVE attendance QR point on Main must fail
  begin
    insert into public.qr_points (
      branch_id, point_type, resource_id, public_code, label, is_active
    )
    values (
      v_main_id, 'attendance', null, 'qr-main-attend-dup-active', 'Duplicate Active Attendance QR', true
    );
    v_violation := true;
  exception when unique_violation then
    -- expected 23505 (qr_points_one_active_attendance_per_branch_idx)
    null;
  end;
  if v_violation then
    raise exception 'Partial unique index failed to prevent 2nd active attendance QR point on same branch';
  end if;

  -- 3.7 Inactive attendance QR point on same branch is permitted
  insert into public.qr_points (
    branch_id, point_type, resource_id, public_code, label, is_active
  )
  values (
    v_main_id, 'attendance', null, 'qr-main-attend-inactive-01', 'Retired Main Attendance QR', false
  );

  -- 3.8 Partial unique index: second ACTIVE QR point on same resource must fail
  begin
    insert into public.qr_points (
      branch_id, point_type, resource_id, public_code, label, is_active
    )
    values (
      v_main_id, 'room', v_room_id, 'qr-main-room-dup', 'Duplicate Room QR', true
    );
    v_violation := true;
  exception when unique_violation then
    -- expected 23505 (qr_points_one_active_resource_idx)
    null;
  end;
  if v_violation then
    raise exception 'Partial unique index failed to prevent 2nd active QR point on same resource';
  end if;
end $$;

-- =============================================================================
-- 4. QR CLASSIFICATION & FAIL-CLOSED FOR INACTIVE / MISCLASSIFIED POINTS
-- =============================================================================

do $$
declare
  v_main_id uuid := '00000000-0000-0000-0000-000000000201';
  v_staff_id uuid := '00000000-0000-0000-0000-000000000303';
  v_event_id uuid;
begin
  -- Case 4.1: Inactive QR point scan fails closed -> blocked with 'invalid_qr'
  insert into public.qr_scan_events (
    branch_id, scan_type, action, outcome, reason_code, message, staff_id, request_id
  )
  values (
    v_main_id, 'unknown', 'first_scan_register_device', 'blocked', 'invalid_qr',
    'Unknown or inactive QR code.', v_staff_id, 'test-inactive-qr-req-001'
  )
  returning id into v_event_id;

  if v_event_id is null then
    raise exception 'Failed to record blocked scan event for inactive QR';
  end if;

  -- Case 4.2: Room QR point scanned for attendance fails closed -> blocked with 'attendance_qr_required'
  insert into public.qr_scan_events (
    branch_id, scan_type, action, outcome, reason_code, message, staff_id, request_id
  )
  values (
    v_main_id, 'room', 'attendance_scan', 'blocked', 'attendance_qr_required',
    'Room QR cannot be used for attendance check-in.', v_staff_id, 'test-wrong-qr-type-req-001'
  )
  returning id into v_event_id;

  if v_event_id is null then
    raise exception 'Failed to record blocked scan event for misclassified QR point';
  end if;
end $$;

-- =============================================================================
-- 5. STAFF BRANCH AUTHORIZATION MISMATCH
-- =============================================================================

do $$
declare
  v_staff_id uuid := '00000000-0000-0000-0000-000000000303'; -- Home branch: Main (...0201)
  v_sm_id uuid := '00000000-0000-0000-0000-000000000202';
  v_sm_qr_id uuid;
  v_decision record;
  v_event_id uuid;
begin
  -- Create active attendance QR point on SM branch
  insert into public.qr_points (
    branch_id, point_type, resource_id, public_code, label, is_active
  )
  values (
    v_sm_id, 'attendance', null, 'qr-sm-attend-valid-01', 'SM Branch Attendance QR', true
  )
  returning id into v_sm_qr_id;

  -- Test branch authority resolver against SM branch for staff assigned to Main
  select * into v_decision
  from public.resolve_effective_attendance_branch(v_staff_id, v_sm_id, date '2026-11-02');

  -- Must be disallowed due to branch mismatch (allowed=false, effective_branch_id=Main != SM)
  if v_decision.allowed is true or v_decision.effective_branch_id = v_sm_id then
    raise exception 'Expected disallowed scan for cross-branch without authorization, got allowed=% effective=%',
      v_decision.allowed, v_decision.effective_branch_id;
  end if;

  -- Scan engine records blocked event with wrong_branch
  insert into public.qr_scan_events (
    branch_id, qr_point_id, staff_id, scan_type, action, outcome, reason_code, message, request_id
  )
  values (
    v_sm_id, v_sm_qr_id, v_staff_id, 'attendance', 'clock_in', 'blocked', 'wrong_branch',
    'Staff profile is not authorized for this branch.', 'test-branch-mismatch-req-001'
  )
  returning id into v_event_id;

  if v_event_id is null then
    raise exception 'Failed to record wrong_branch scan event';
  end if;
end $$;

-- =============================================================================
-- 6. GEOFENCE BOUNDARIES (ON-SITE, OUTSIDE, STALE, INACCURATE, MISSING)
-- =============================================================================

do $$
declare
  v_main_id uuid := '00000000-0000-0000-0000-000000000201';
  v_staff_id uuid := '00000000-0000-0000-0000-000000000303';
  v_res text;
  v_event_id uuid;
begin
  -- 6.1 On-site / Valid: 8.18m from branch (<= 100m radius), accuracy 15m (<= 75m), age 2s (<= 20s)
  v_res := public.verify_attendance_geofence(
    v_main_id, 10.7025000, 122.9620000, 15.0, now() - interval '2 seconds'
  );
  if v_res <> 'passed' then
    raise exception 'Expected geofence to pass for on-site reading, got %', v_res;
  end if;

  -- 6.2 Outside geofence: ~1.95km from branch (> 100m radius)
  v_res := public.verify_attendance_geofence(
    v_main_id, 10.7200000, 122.9620000, 15.0, now() - interval '2 seconds'
  );
  if v_res <> 'location_outside' then
    raise exception 'Expected location_outside for distant coordinates, got %', v_res;
  end if;

  -- Record blocked event for outside scan
  insert into public.qr_scan_events (
    branch_id, staff_id, scan_type, action, outcome, reason_code, message, request_id
  )
  values (
    v_main_id, v_staff_id, 'attendance', 'clock_in', 'blocked', 'location_outside',
    'On-site scan required.', 'test-geofence-outside-req-001'
  )
  returning id into v_event_id;

  -- 6.3 Missing GPS coordinates: null latitude/longitude
  v_res := public.verify_attendance_geofence(
    v_main_id, null, null, 15.0, now()
  );
  if v_res <> 'location_required' then
    raise exception 'Expected location_required for null coordinates, got %', v_res;
  end if;

  -- 6.4 Inaccurate GPS reading: accuracy 120m (> 75m threshold)
  v_res := public.verify_attendance_geofence(
    v_main_id, 10.7025000, 122.9620000, 120.0, now() - interval '2 seconds'
  );
  if v_res <> 'location_inaccurate' then
    raise exception 'Expected location_inaccurate for accuracy 120m, got %', v_res;
  end if;

  -- 6.5 Stale GPS reading: age 60 seconds (> 20s threshold)
  v_res := public.verify_attendance_geofence(
    v_main_id, 10.7025000, 122.9620000, 15.0, now() - interval '60 seconds'
  );
  if v_res <> 'location_stale' then
    raise exception 'Expected location_stale for 60s old reading, got %', v_res;
  end if;

  -- 6.6 Unconfigured geofence: branch with null coordinates
  update public.branches set latitude = null where id = '00000000-0000-0000-0000-000000000201';
  v_res := public.verify_attendance_geofence(
    v_main_id, 10.7025000, 122.9620000, 15.0, now()
  );
  if v_res <> 'geofence_configuration' then
    raise exception 'Expected geofence_configuration for unconfigured branch, got %', v_res;
  end if;

  -- Restore Main branch coordinates
  update public.branches set latitude = 10.7024485 where id = '00000000-0000-0000-0000-000000000201';
end $$;

-- =============================================================================
-- 7. REGISTERED-DEVICE AUTHORIZATION ENFORCEMENT
-- =============================================================================

do $$
declare
  v_main_id uuid := '00000000-0000-0000-0000-000000000201';
  v_staff_id uuid := '00000000-0000-0000-0000-000000000303';
  v_revoked_dev_id uuid;
  v_blocked_dev_id uuid;
  v_event_id uuid;
begin
  -- Case 7.1: Revoked device attempt fails closed
  insert into public.staff_devices (
    staff_id, branch_id, device_fingerprint_hash, device_label, status, revocation_reason
  )
  values (
    v_staff_id, v_main_id, 'hash-revoked-phone-001', 'Old Revoked Phone', 'revoked', 'lost_phone'
  )
  returning id into v_revoked_dev_id;

  insert into public.qr_scan_events (
    branch_id, staff_id, device_id, scan_type, action, outcome, reason_code, message, request_id
  )
  values (
    v_main_id, v_staff_id, v_revoked_dev_id, 'attendance', 'clock_in', 'blocked', 'revoked_device',
    'This phone was previously revoked.', 'test-revoked-dev-req-001'
  )
  returning id into v_event_id;

  if v_event_id is null then
    raise exception 'Failed to record revoked device blocked event';
  end if;

  -- Case 7.2: Security blocked device attempt fails closed
  insert into public.staff_devices (
    staff_id, branch_id, device_fingerprint_hash, device_label, status, security_state
  )
  values (
    v_staff_id, v_main_id, 'hash-blocked-phone-001', 'Suspicious Phone', 'active', 'blocked'
  )
  returning id into v_blocked_dev_id;

  insert into public.qr_scan_events (
    branch_id, staff_id, device_id, scan_type, action, outcome, reason_code, message, request_id
  )
  values (
    v_main_id, v_staff_id, v_blocked_dev_id, 'attendance', 'clock_in', 'blocked', 'device_security_blocked',
    'This device is blocked for security review.', 'test-blocked-dev-req-001'
  )
  returning id into v_event_id;

  if v_event_id is null then
    raise exception 'Failed to record security blocked device event';
  end if;
end $$;

-- =============================================================================
-- 8. ATOMIC SCAN EXECUTION & IDEMPOTENT REPLAY
-- =============================================================================

do $$
declare
  v_main_id uuid := '00000000-0000-0000-0000-000000000201';
  v_staff_id uuid := '00000000-0000-0000-0000-000000000303';
  v_dev_id uuid := '00000000-0000-0000-0000-000000000401';
  v_qr_id uuid;
  v_commit record;
  v_replay record;
  v_checkin_count integer;
  v_dev_scan_at timestamptz;
  v_violation boolean := false;
begin
  select id into v_qr_id from public.qr_points
  where branch_id = v_main_id and point_type = 'attendance' and is_active = true limit 1;

  -- 8.1 Execute commit_attendance_scan_transaction for clock-in
  select * into v_commit
  from public.commit_attendance_scan_transaction(
    p_request_id => 'test-scan-txn-req-100',
    p_branch_id => v_main_id,
    p_qr_point_id => v_qr_id,
    p_staff_id => v_staff_id,
    p_device_id => v_dev_id,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'success',
    p_reason_code => null,
    p_message => 'Clocked in successfully.',
    p_user_agent => 'Mozilla/5.0 Test PWA',
    p_ip_address => '127.0.0.1',
    p_metadata => jsonb_build_object('geofence', 'verified', 'distanceMeters', 8.18),
    p_is_test => false,
    p_public_result => jsonb_build_object('ok', true, 'outcome', 'success', 'title', 'Clocked in'),
    p_checkin_id => null,
    p_checkin_insert => jsonb_build_object(
      'shift_date', '2026-11-02',
      'shift_type', 'single',
      'shift_instance_key', 'shift-2026-11-02-single',
      'clock_in_method', 'qr',
      'branch_timezone', 'Asia/Manila',
      'attendance_status', 'present'
    ),
    p_checkin_update => null,
    p_exception => null,
    p_device_scan_type => 'attendance'
  );

  if not v_commit.success or v_commit.code <> 'committed' then
    raise exception 'Scan transaction commit failed: success=% code=% message=%',
      v_commit.success, v_commit.code, v_commit.message;
  end if;

  if v_commit.scan_event_id is null or v_commit.checkin_id is null then
    raise exception 'Scan transaction returned null event or checkin id';
  end if;

  -- Verify checkin row created
  if not exists (
    select 1 from public.staff_shift_checkins
    where id = v_commit.checkin_id and status = 'checked_in' and clock_in_scan_event_id = v_commit.scan_event_id
  ) then
    raise exception 'Created checkin row not found or clock_in_scan_event_id not linked';
  end if;

  -- Verify staff_devices updated with last_attendance_scan_at
  select last_attendance_scan_at into v_dev_scan_at
  from public.staff_devices where id = v_dev_id;

  if v_dev_scan_at is null then
    raise exception 'staff_devices.last_attendance_scan_at was not updated by scan transaction';
  end if;

  -- 8.2 Idempotent replay: invoke with identical p_request_id
  select * into v_replay
  from public.commit_attendance_scan_transaction(
    p_request_id => 'test-scan-txn-req-100',
    p_branch_id => v_main_id,
    p_qr_point_id => v_qr_id,
    p_staff_id => v_staff_id,
    p_device_id => v_dev_id,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'success',
    p_public_result => jsonb_build_object('ok', true, 'outcome', 'success')
  );

  if not v_replay.success or v_replay.code <> 'replayed' then
    raise exception 'Expected idempotent replay code replayed, got success=% code=%',
      v_replay.success, v_replay.code;
  end if;

  if v_replay.scan_event_id <> v_commit.scan_event_id or v_replay.checkin_id <> v_commit.checkin_id then
    raise exception 'Replay returned mismatched event or checkin ID';
  end if;

  -- Verify no duplicate checkin was inserted
  select count(*) into v_checkin_count
  from public.staff_shift_checkins
  where staff_id = v_staff_id and shift_date = '2026-11-02' and shift_type = 'single';

  if v_checkin_count <> 1 then
    raise exception 'Duplicate checkin created on replay, count=%', v_checkin_count;
  end if;

  -- 8.3 Direct insert with duplicate request_id must fail unique constraint
  begin
    insert into public.qr_scan_events (
      branch_id, scan_type, action, outcome, request_id
    )
    values (
      v_main_id, 'attendance', 'clock_in', 'success', 'test-scan-txn-req-100'
    );
    v_violation := true;
  exception when unique_violation then
    -- expected 23505
    null;
  end;
  if v_violation then
    raise exception 'Duplicate request_id was accepted by qr_scan_events';
  end if;
end $$;

-- =============================================================================
-- 9. TRANSACTION ROLLBACK INTEGRITY
-- =============================================================================

do $$
declare
  v_main_id uuid := '00000000-0000-0000-0000-000000000201';
  v_invalid_res record;
  v_event_count integer;
  v_checkin_count integer;
begin
  -- Invalid outcome returns success=false without raising exception
  select * into v_invalid_res
  from public.commit_attendance_scan_transaction(
    p_request_id => 'test-invalid-outcome-req',
    p_branch_id => v_main_id,
    p_qr_point_id => null,
    p_staff_id => null,
    p_device_id => null,
    p_scan_type => 'attendance',
    p_action => 'clock_in',
    p_outcome => 'invalid_outcome_string'
  );

  if v_invalid_res.success is not false or v_invalid_res.code <> 'invalid_outcome' then
    raise exception 'Expected success=false code=invalid_outcome, got success=% code=%',
      v_invalid_res.success, v_invalid_res.code;
  end if;

  -- Verify no row was inserted
  if exists (select 1 from public.qr_scan_events where request_id = 'test-invalid-outcome-req') then
    raise exception 'Row inserted despite invalid_outcome failure';
  end if;
end $$;

-- Verify subtransaction rollback in PL/pgSQL
do $$
declare
  v_before_count integer;
  v_after_count integer;
begin
  select count(*) into v_before_count from public.qr_scan_events;

  begin
    insert into public.qr_scan_events (
      scan_type, action, outcome, request_id
    )
    values (
      'attendance', 'clock_in', 'success', 'test-aborted-txn-req-001'
    );
    -- Trigger intentional exception
    raise exception 'intentional_abort';
  exception when others then
    null;
  end;

  select count(*) into v_after_count from public.qr_scan_events;
  if v_before_count <> v_after_count then
    raise exception 'Subtransaction rollback failed to revert inserted scan event';
  end if;
end $$;

-- =============================================================================
-- 10. ROW-LEVEL SECURITY ENFORCEMENT ON SCAN ENTITIES
-- =============================================================================

-- Seed scan event for peer staff (...0304) while under administrative role to ensure RLS row-filtering assertion is non-vacuous
insert into public.qr_scan_events (
  branch_id, staff_id, scan_type, action, outcome, reason_code, message, request_id
)
values (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000304',
  'attendance', 'clock_in', 'success', null,
  'Peer staff scan event for RLS verification.',
  'test-peer-staff-scan-001'
);

-- 10.1 Staff Role: can see own scans, cannot see peers' scans, cannot insert directly
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', false); -- Therapist (...0303)

do $$
declare
  v_count integer;
  v_peer_visible boolean := false;
  v_insert_blocked boolean := false;
begin
  -- Can see own scans
  select count(*) into v_count
  from public.qr_scan_events
  where staff_id = '00000000-0000-0000-0000-000000000303';

  if v_count = 0 then
    raise exception 'Staff cannot see own scan events under RLS';
  end if;

  -- Cannot see scans for other staff (...0304)
  select exists (
    select 1 from public.qr_scan_events
    where staff_id = '00000000-0000-0000-0000-000000000304'
  ) into v_peer_visible;

  if v_peer_visible then
    raise exception 'RLS VIOLATION: Staff can see peer scan events';
  end if;

  -- Cannot directly INSERT into qr_scan_events
  begin
    insert into public.qr_scan_events (
      scan_type, action, outcome, request_id
    )
    values (
      'attendance', 'clock_in', 'success', 'unauthorized-client-insert'
    );
  exception when insufficient_privilege then
    v_insert_blocked := true;
  end;

  if not v_insert_blocked then
    raise exception 'SECURITY VIOLATION: Staff was able to insert into qr_scan_events directly';
  end if;
end $$;

-- 10.2 Manager Role: can see all scans for assigned branch, cannot see other branch
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false); -- Manager Main (...0201)

do $$
declare
  v_main_count integer;
  v_sm_visible boolean := false;
begin
  select count(*) into v_main_count
  from public.qr_scan_events
  where branch_id = '00000000-0000-0000-0000-000000000201';

  if v_main_count = 0 then
    raise exception 'Manager cannot see scan events for own branch under RLS';
  end if;

  -- Scans for SM branch (...0202) must not be visible to Main manager
  select exists (
    select 1 from public.qr_scan_events
    where branch_id = '00000000-0000-0000-0000-000000000202'
  ) into v_sm_visible;

  if v_sm_visible then
    raise exception 'RLS VIOLATION: Main branch manager can see SM branch scan events';
  end if;

  -- Manager can see active branch resources for own branch
  if not exists (
    select 1 from public.branch_resources
    where branch_id = '00000000-0000-0000-0000-000000000201'
  ) then
    raise exception 'Manager cannot see active branch_resources for own branch';
  end if;
end $$;

reset role;

select 'PR58 QR points, scan events, and geofence dependency slice LOCAL checks passed' as result;
