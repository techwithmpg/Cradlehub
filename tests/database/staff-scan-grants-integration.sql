\set ON_ERROR_STOP on

-- Run only in a disposable LOCAL TEST database created for this fixture.
create schema auth;
create table auth.users (id uuid primary key);
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

\ir ../../supabase/migrations/20261101043000_staff_scan_grant_ledger.sql

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');

do $$ begin
  if not (select relrowsecurity from pg_class where oid = 'public.staff_scan_grants'::regclass) then
    raise exception 'scanner grant RLS is disabled';
  end if;
  if has_table_privilege('anon', 'public.staff_scan_grants', 'SELECT')
    or has_table_privilege('authenticated', 'public.staff_scan_grants', 'SELECT')
    or has_table_privilege('authenticated', 'public.staff_scan_grants', 'INSERT')
    or has_table_privilege('authenticated', 'public.staff_scan_grants', 'UPDATE') then
    raise exception 'client role can access scanner grants';
  end if;
  if not has_table_privilege('service_role', 'public.staff_scan_grants', 'SELECT,INSERT,UPDATE') then
    raise exception 'server role lacks scanner grant access';
  end if;
  if has_function_privilege('anon', 'public.claim_staff_scan_grant(text,uuid,text,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.claim_staff_scan_grant(text,uuid,text,uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.claim_staff_scan_grant(text,uuid,text,uuid)', 'EXECUTE') then
    raise exception 'scanner grant claim RPC privileges are wrong';
  end if;
end $$;

insert into public.staff_scan_grants (token_hash, user_id, public_code, operation_id, expires_at) values
  ('parallel', '00000000-0000-0000-0000-000000000001', 'att_main', '00000000-0000-0000-0000-000000000011', now() + interval '2 minutes'),
  ('wrong-user', '00000000-0000-0000-0000-000000000001', 'att_main', '00000000-0000-0000-0000-000000000012', now() + interval '2 minutes'),
  ('expired', '00000000-0000-0000-0000-000000000001', 'att_main', '00000000-0000-0000-0000-000000000013', now() + interval '1 second');
update public.staff_scan_grants
  set created_at = now() - interval '3 minutes', expires_at = now() - interval '1 second'
  where token_hash = 'expired';

do $$ declare claimed uuid; begin
  select public.claim_staff_scan_grant(
    'wrong-user', '00000000-0000-0000-0000-000000000002', 'att_main',
    '00000000-0000-0000-0000-000000000012'
  ) into claimed;
  if claimed is not null then raise exception 'wrong user claimed grant'; end if;

  select public.claim_staff_scan_grant(
    'wrong-user', '00000000-0000-0000-0000-000000000001', 'att_other',
    '00000000-0000-0000-0000-000000000012'
  ) into claimed;
  if claimed is not null then raise exception 'wrong QR claimed grant'; end if;

  select public.claim_staff_scan_grant(
    'wrong-user', '00000000-0000-0000-0000-000000000001', 'att_main',
    '00000000-0000-0000-0000-000000000099'
  ) into claimed;
  if claimed is not null then raise exception 'wrong operation claimed grant'; end if;

  select public.claim_staff_scan_grant(
    'expired', '00000000-0000-0000-0000-000000000001', 'att_main',
    '00000000-0000-0000-0000-000000000013'
  ) into claimed;
  if claimed is not null then raise exception 'expired grant claimed'; end if;
end $$;

-- Minimal synthetic relations to execute the established attendance commit RPC.
-- These stand-ins are LOCAL TEST fixtures, not a copy of production schema/data.
create table public.staff (id uuid primary key);
create table public.staff_shift_checkins (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid, branch_id uuid, shift_date date, shift_type text,
  shift_instance_key text, checked_in_at timestamptz, checked_out_at timestamptz,
  status text, source_qr_point_id uuid, clock_in_method text,
  scheduled_start_at timestamptz, scheduled_end_at timestamptz,
  schedule_source text, schedule_source_id text, branch_timezone text,
  attendance_business_date date, late_minutes integer, attendance_status text,
  exception_state text, is_test boolean, notes text,
  clock_in_scan_event_id uuid, updated_at timestamptz
);
create table public.qr_scan_events (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid, qr_point_id uuid, staff_id uuid, device_id uuid, checkin_id uuid,
  scan_type text, action text, outcome text, reason_code text, message text,
  request_id text unique, user_agent text, ip_address inet, metadata jsonb,
  is_test boolean, operation_id text, operation_result jsonb,
  operation_result_recorded_at timestamptz, created_at timestamptz default now()
);
\ir ../../supabase/migrations/20260712044527_attendance_transactional_scan_rpc.sql
insert into public.staff (id) values ('00000000-0000-0000-0000-000000000001');

do $$ declare first_result text; replay_result text; begin
  select code into first_result from public.commit_attendance_scan_transaction(
    p_request_id => '00000000-0000-0000-0000-000000000011',
    p_branch_id => '00000000-0000-0000-0000-000000000021',
    p_qr_point_id => '00000000-0000-0000-0000-000000000031',
    p_staff_id => '00000000-0000-0000-0000-000000000001',
    p_device_id => null, p_scan_type => 'attendance', p_action => 'clock_in',
    p_outcome => 'success', p_is_test => true,
    p_public_result => '{"ok":true,"outcome":"success","attendance":{"action":"clock_in"}}'::jsonb,
    p_checkin_insert => '{"shift_date":"2026-11-01","shift_type":"single","shift_instance_key":"grant-test-shift","checked_in_at":"2026-11-01T04:00:00Z"}'::jsonb
  );
  select code into replay_result from public.commit_attendance_scan_transaction(
    p_request_id => '00000000-0000-0000-0000-000000000011',
    p_branch_id => '00000000-0000-0000-0000-000000000021',
    p_qr_point_id => '00000000-0000-0000-0000-000000000031',
    p_staff_id => '00000000-0000-0000-0000-000000000001',
    p_device_id => null, p_scan_type => 'attendance', p_action => 'clock_in',
    p_outcome => 'success', p_is_test => true,
    p_public_result => '{"ok":true,"outcome":"success","attendance":{"action":"clock_in"}}'::jsonb,
    p_checkin_insert => '{"shift_date":"2026-11-01","shift_type":"single","shift_instance_key":"grant-test-shift","checked_in_at":"2026-11-01T04:00:00Z"}'::jsonb
  );
  if first_result <> 'committed' or replay_result <> 'replayed' then
    raise exception 'attendance commit/replay mismatch: %, %', first_result, replay_result;
  end if;
  if (select count(*) from public.staff_shift_checkins) <> 1
    or (select count(*) from public.qr_scan_events) <> 1 then
    raise exception 'duplicate attendance transaction or scan event';
  end if;
end $$;

select 'scanner grant LOCAL TEST integration passed' as result;
