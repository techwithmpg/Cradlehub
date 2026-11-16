-- Synthetic schema only, installed by attendance-v2-local-test.mjs into a NEW
-- loopback-only database. Actual policy, canonical scan and correction functions
-- are extracted unchanged from accepted migrations, not mocked resolvers.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
create schema extensions;
create table branches(id uuid primary key default gen_random_uuid(),is_active boolean default true);
create table staff(id uuid primary key default gen_random_uuid(),branch_id uuid,system_role text default 'staff',
  staff_type text default 'therapist',full_name text default 'TEST Staff',is_active boolean default true,
  archived_at timestamptz,merged_into_staff_id uuid,auth_user_id uuid default gen_random_uuid());
create table staff_devices(id uuid primary key default gen_random_uuid(),staff_id uuid,branch_id uuid,
  last_seen_at timestamptz,last_service_scan_at timestamptz,last_attendance_scan_at timestamptz,updated_at timestamptz);
create table attendance_settings(branch_id uuid primary key,timezone text default 'Asia/Manila',
  attendance_day_boundary time default '06:00',late_grace_minutes integer default 10,
  early_leave_threshold_minutes integer default 5,crm_closing_buffer_minutes integer default 30,
  crm_closing_policy_enabled boolean default true,crm_manager_escalation_delay_minutes integer default 30,
  crm_hard_cutoff_delay_minutes integer default 60,test_mode_enabled boolean default false,
  early_clock_in_allowed_minutes integer default 60,clock_in_window_before_shift_minutes integer default 60,
  duplicate_scan_window_seconds integer default 90,updated_at timestamptz,
  closing_intervention_last_run_at timestamptz,closing_intervention_last_error text);
create table attendance_staff_category_rules(id uuid primary key default gen_random_uuid(),branch_id uuid,
  staff_category text,effective_from timestamptz,effective_until timestamptz,rule_values jsonb default '{}',
  service_cleanup_buffer_minutes integer,home_service_wrap_up_buffer_minutes integer,driver_return_buffer_minutes integer,
  crm_closing_policy_enabled boolean,late_grace_minutes integer,early_leave_threshold_minutes integer,
  final_client_release_enabled boolean,portal_closing_shift_enabled boolean);
create table attendance_rule_versions(id uuid primary key default gen_random_uuid(),branch_id uuid,
  effective_from timestamptz,rule_values jsonb default '{}');
create table staff_schedules(id uuid primary key default gen_random_uuid(),staff_id uuid,end_time time,
  ends_next_day boolean default false,is_active boolean default true);
create table schedule_overrides(id uuid primary key default gen_random_uuid(),staff_id uuid,override_date date,
  end_time time,ends_next_day boolean default false,is_day_off boolean default false,created_by uuid,created_at timestamptz default now());
create table staff_services(staff_id uuid,service_id uuid);
create table services(id uuid primary key default gen_random_uuid(),duration_minutes integer default 60);
create table bookings(id uuid primary key default gen_random_uuid(),branch_id uuid,staff_id uuid,driver_id uuid,
  service_id uuid,booking_date date,start_time time,end_time time,delivery_type text default 'in_spa',
  status text default 'confirmed',booking_progress_status text default 'not_started',session_completed_at timestamptz,
  completed_at timestamptz,session_extended_at timestamptz,session_due_at timestamptz,session_started_at timestamptz,
  session_duration_minutes_snapshot integer,metadata jsonb default '{}');
create table staff_shift_checkins(id uuid primary key default gen_random_uuid(),staff_id uuid,branch_id uuid,
  shift_date date,shift_type text default 'single',shift_instance_key text,checked_in_at timestamptz not null,
  checked_out_at timestamptz,status text default 'checked_in',source_qr_point_id uuid,clock_in_method text default 'qr',
  clock_out_method text,scheduled_start_at timestamptz,scheduled_end_at timestamptz,schedule_source text default 'weekly',
  schedule_source_id text default 'TEST-source',branch_timezone text default 'Asia/Manila',attendance_business_date date,
  late_minutes integer default 0,early_leave_minutes integer default 0,overtime_minutes integer default 0,
  attendance_status text default 'present',exception_state text default 'none',is_test boolean default false,
  notes text,worked_minutes integer default 0,clock_in_scan_event_id uuid,clock_out_scan_event_id uuid,
  attendance_expected_end_at timestamptz,earliest_normal_clock_out_at timestamptz,latest_normal_clock_out_at timestamptz,
  clock_out_reminder_at timestamptz,manager_escalation_at timestamptz,hard_cutoff_at timestamptz,provisional_clock_out_at timestamptz,
  attendance_policy_source text default 'schedule',attendance_policy_snapshot jsonb default '{}',
  provisional_auto_closed_at timestamptz,clock_out_confirmation_required boolean default false,
  actual_clock_out_reconciled_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());
create unique index test_shift_identity on staff_shift_checkins(staff_id,branch_id,shift_instance_key,is_test) where status<>'voided';
create table qr_scan_events(id uuid primary key default gen_random_uuid(),branch_id uuid,qr_point_id uuid,staff_id uuid,
  device_id uuid,checkin_id uuid,scan_type text,action text,outcome text,reason_code text,message text,request_id text,
  user_agent text,ip_address inet,metadata jsonb default '{}',is_test boolean default false,operation_id text,
  operation_result jsonb,operation_result_recorded_at timestamptz,created_at timestamptz default now());
create table attendance_exceptions(id uuid primary key default gen_random_uuid(),branch_id uuid,staff_id uuid,
  checkin_id uuid,scan_event_id uuid,latest_scan_event_id uuid,exception_type text,severity text,message text,
  metadata jsonb default '{}',dedupe_key text,occurrence_count integer default 1,first_detected_at timestamptz,
  last_detected_at timestamptz,created_at timestamptz default now(),related_checkin_ids uuid[] default '{}',recommended_action text,priority text,
  is_test boolean default false,status text default 'open',resolution_status text default 'open',reviewed_by uuid,
  reviewed_at timestamptz,detected_at timestamptz,updated_at timestamptz,staff_response_required boolean,
  resolution_action text,resolution_note text,resolved_at timestamptz,resolved_by uuid);
create table attendance_corrections(id uuid primary key default gen_random_uuid(),branch_id uuid,staff_id uuid,
  checkin_id uuid,exception_id uuid,attendance_date date,correction_type text,action_type text,previous_values jsonb,
  new_values jsonb,reason text,status text,applied_at timestamptz,corrected_at timestamptz,is_test boolean,
  requested_by uuid,approved_by uuid,corrected_by uuid,scan_event_ids jsonb default '[]');
create table workspace_notifications(id uuid primary key default gen_random_uuid(),branch_id uuid,target_workspace text,
  target_role text,recipient_staff_id uuid,actor_staff_id uuid,type text,title text,body text,entity_type text,
  entity_id uuid,action_href text,priority text,status text,requires_action boolean,dedupe_key text,
  metadata jsonb default '{}',created_at timestamptz default now(),resolved_at timestamptz,read_at timestamptz);
create unique index test_notification_open_key on workspace_notifications(dedupe_key) where status in ('unread','read');
create table attendance_staff_reminder_checks(checkin_id uuid primary key,checked_at timestamptz);
create table attendance_closing_interventions(id uuid primary key default gen_random_uuid(),branch_id uuid,staff_id uuid,
  checkin_id uuid,attendance_business_date date,stage text,dedupe_key text unique,due_at timestamptz,policy_snapshot jsonb,
  applied_at timestamptz,notification_sent_at timestamptz,workflow_task_sent_at timestamptz,
  delivery_attempts integer default 0,last_delivery_error text,updated_at timestamptz,unique(checkin_id,stage));
create table workflow_tasks(id uuid primary key default gen_random_uuid(),branch_id uuid,workspace_scope text,
  assigned_to_role text,task_type text,title text,body text,entity_type text,entity_id uuid,action_href text,
  priority text,status text,due_at timestamptz,dedupe_key text unique,metadata jsonb);
create table cash_sessions(id uuid primary key default gen_random_uuid(),branch_id uuid,opened_by uuid,
  current_custodian_id uuid,closed_by uuid,business_date date,status text default 'open',closed_at timestamptz);
create table cash_session_handovers(id uuid primary key default gen_random_uuid(),branch_id uuid,
  outgoing_custodian_id uuid,created_at timestamptz default now());
