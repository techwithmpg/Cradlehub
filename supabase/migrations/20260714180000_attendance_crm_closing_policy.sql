-- CRM closing attendance policy
--
-- Adds effective-dated branch/category rules, immutable per-record policy
-- snapshots, a durable intervention outbox, provisional auto-close, and an
-- atomic real-QR reconciliation path. Raw assigned schedule timestamps remain
-- unchanged and no synthetic qr_scan_events are created by the scheduler.

alter table public.attendance_settings
  add column if not exists branch_operating_close_time time not null default '22:30:00',
  add column if not exists crm_closing_policy_enabled boolean not null default true,
  add column if not exists crm_closing_buffer_minutes integer not null default 30,
  add column if not exists crm_manager_escalation_delay_minutes integer not null default 30,
  add column if not exists crm_hard_cutoff_delay_minutes integer not null default 60,
  add column if not exists closing_intervention_last_run_at timestamptz,
  add column if not exists closing_intervention_last_error text;

alter table public.attendance_settings
  drop constraint if exists attendance_settings_crm_closing_buffer_check,
  add constraint attendance_settings_crm_closing_buffer_check
    check (crm_closing_buffer_minutes between 0 and 240),
  drop constraint if exists attendance_settings_crm_escalation_delay_check,
  add constraint attendance_settings_crm_escalation_delay_check
    check (crm_manager_escalation_delay_minutes between 1 and 240),
  drop constraint if exists attendance_settings_crm_hard_cutoff_delay_check,
  add constraint attendance_settings_crm_hard_cutoff_delay_check
    check (
      crm_hard_cutoff_delay_minutes between 1 and 360
      and crm_hard_cutoff_delay_minutes > crm_manager_escalation_delay_minutes
    );

create table if not exists public.attendance_rule_versions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  effective_from timestamptz not null,
  rule_values jsonb not null default '{}'::jsonb,
  previous_values jsonb not null default '{}'::jsonb,
  reason text not null,
  changed_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (branch_id, effective_from)
);

create index if not exists attendance_rule_versions_effective_idx
  on public.attendance_rule_versions (branch_id, effective_from desc);

create table if not exists public.attendance_staff_category_rules (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  staff_category text not null check (
    staff_category in (
      'crm_front_desk', 'therapists', 'salon', 'drivers', 'utility', 'managers', 'other'
    )
  ),
  effective_from timestamptz not null,
  effective_until timestamptz,
  late_grace_minutes integer check (late_grace_minutes between 0 and 240),
  early_leave_threshold_minutes integer check (early_leave_threshold_minutes between 0 and 240),
  overtime_threshold_minutes integer check (overtime_threshold_minutes between 0 and 240),
  active_service_blocks_clock_out boolean,
  crm_closing_policy_enabled boolean,
  reason text not null,
  changed_by uuid references public.staff(id) on delete set null,
  previous_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint attendance_staff_category_rules_period_check
    check (effective_until is null or effective_until > effective_from),
  unique (branch_id, staff_category, effective_from)
);

create index if not exists attendance_category_rules_effective_idx
  on public.attendance_staff_category_rules
    (branch_id, staff_category, effective_from desc, effective_until);

alter table public.staff_shift_checkins
  add column if not exists attendance_expected_end_at timestamptz,
  add column if not exists earliest_normal_clock_out_at timestamptz,
  add column if not exists latest_normal_clock_out_at timestamptz,
  add column if not exists clock_out_reminder_at timestamptz,
  add column if not exists manager_escalation_at timestamptz,
  add column if not exists hard_cutoff_at timestamptz,
  add column if not exists provisional_clock_out_at timestamptz,
  add column if not exists attendance_policy_source text not null default 'schedule',
  add column if not exists attendance_policy_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists provisional_auto_closed_at timestamptz,
  add column if not exists clock_out_confirmation_required boolean not null default false,
  add column if not exists actual_clock_out_reconciled_at timestamptz;

alter table public.staff_shift_checkins
  drop constraint if exists staff_shift_checkins_policy_source_check,
  add constraint staff_shift_checkins_policy_source_check
    check (attendance_policy_source in ('schedule', 'crm_closing'));

create index if not exists staff_shift_checkins_closing_intervention_idx
  on public.staff_shift_checkins (hard_cutoff_at, status)
  where attendance_policy_source = 'crm_closing'
    and status = 'checked_in'
    and checked_out_at is null
    and is_test = false;

create index if not exists staff_shift_checkins_provisional_confirmation_idx
  on public.staff_shift_checkins (staff_id, branch_id, provisional_auto_closed_at desc)
  where clock_out_confirmation_required = true
    and clock_out_method = 'system_auto_close';

create table if not exists public.attendance_closing_interventions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  checkin_id uuid not null references public.staff_shift_checkins(id) on delete cascade,
  attendance_business_date date not null,
  stage text not null check (
    stage in ('reminder', 'manager_escalation', 'active_service_blocked', 'auto_close')
  ),
  dedupe_key text not null unique,
  due_at timestamptz not null,
  policy_snapshot jsonb not null default '{}'::jsonb,
  notification_sent_at timestamptz,
  workflow_task_sent_at timestamptz,
  delivery_attempts integer not null default 0 check (delivery_attempts >= 0),
  last_delivery_error text,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (checkin_id, stage)
);

create index if not exists attendance_closing_interventions_pending_idx
  on public.attendance_closing_interventions (created_at)
  where notification_sent_at is null;

alter table public.attendance_rule_versions enable row level security;
alter table public.attendance_staff_category_rules enable row level security;
alter table public.attendance_closing_interventions enable row level security;

drop policy if exists "attendance rule versions branch read" on public.attendance_rule_versions;
create policy "attendance rule versions branch read"
  on public.attendance_rule_versions for select to authenticated
  using (
    public.get_auth_role() = 'owner'
    or (
      public.get_auth_role() in ('manager', 'assistant_manager', 'store_manager')
      and branch_id = public.get_auth_branch_id()
    )
  );

drop policy if exists "attendance category rules branch read" on public.attendance_staff_category_rules;
create policy "attendance category rules branch read"
  on public.attendance_staff_category_rules for select to authenticated
  using (
    public.get_auth_role() = 'owner'
    or (
      public.get_auth_role() in ('manager', 'assistant_manager', 'store_manager')
      and branch_id = public.get_auth_branch_id()
    )
  );

drop policy if exists "attendance closing interventions branch read" on public.attendance_closing_interventions;
create policy "attendance closing interventions branch read"
  on public.attendance_closing_interventions for select to authenticated
  using (
    public.get_auth_role() = 'owner'
    or (
      public.get_auth_role() in (
        'manager', 'assistant_manager', 'store_manager',
        'crm', 'csr', 'csr_head', 'csr_staff'
      )
      and branch_id = public.get_auth_branch_id()
    )
  );

revoke all on public.attendance_rule_versions from anon;
revoke all on public.attendance_staff_category_rules from anon;
revoke all on public.attendance_closing_interventions from anon;
grant select on public.attendance_rule_versions to authenticated;
grant select on public.attendance_staff_category_rules to authenticated;
grant select on public.attendance_closing_interventions to authenticated;
grant all on public.attendance_rule_versions to service_role;
grant all on public.attendance_staff_category_rules to service_role;
grant all on public.attendance_closing_interventions to service_role;

create or replace function public.save_attendance_branch_rule_version(
  p_branch_id uuid,
  p_actor_staff_id uuid,
  p_effective_from timestamptz,
  p_rule_values jsonb,
  p_reason text
)
returns table (success boolean, code text, message text, rule_version_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_previous jsonb;
  v_id uuid;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_settings public.attendance_settings%rowtype;
  v_timezone text;
  v_boundary time;
  v_close_time time;
  v_buffer integer;
  v_escalation integer;
  v_hard integer;
  v_hard_at timestamptz;
  v_next_boundary timestamptz;
begin
  if p_branch_id is null or p_effective_from is null or v_reason is null then
    return query select false, 'invalid_request', 'Branch, effective time, and reason are required.', null::uuid;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('attendance_branch_rules'), hashtext(p_branch_id::text));
  if not exists (select 1 from public.branches where id = p_branch_id) then
    return query select false, 'branch_not_found', 'Branch was not found.', null::uuid;
    return;
  end if;

  select * into v_settings
  from public.attendance_settings
  where branch_id = p_branch_id;
  v_timezone := coalesce(nullif(p_rule_values->>'timezone', ''), v_settings.timezone, 'Asia/Manila');
  v_boundary := coalesce(
    nullif(p_rule_values->>'attendance_day_boundary', '')::time,
    v_settings.attendance_day_boundary,
    '06:00:00'::time
  );
  v_close_time := coalesce(
    nullif(p_rule_values->>'branch_operating_close_time', '')::time,
    v_settings.branch_operating_close_time,
    '22:30:00'::time
  );
  v_buffer := coalesce(
    (p_rule_values->>'crm_closing_buffer_minutes')::integer,
    v_settings.crm_closing_buffer_minutes,
    30
  );
  v_escalation := coalesce(
    (p_rule_values->>'crm_manager_escalation_delay_minutes')::integer,
    v_settings.crm_manager_escalation_delay_minutes,
    30
  );
  v_hard := coalesce(
    (p_rule_values->>'crm_hard_cutoff_delay_minutes')::integer,
    v_settings.crm_hard_cutoff_delay_minutes,
    60
  );
  if v_buffer not between 0 and 240
     or v_escalation not between 1 and 240
     or v_hard not between 1 and 360
     or v_hard <= v_escalation then
    return query select false, 'invalid_timeline', 'CRM reminder, escalation, or hard-cutoff values are invalid.', null::uuid;
    return;
  end if;
  v_hard_at :=
    ('2026-01-15 ' || v_close_time::text)::timestamp at time zone v_timezone
    + make_interval(mins => v_buffer + v_hard);
  v_next_boundary :=
    ('2026-01-16 ' || v_boundary::text)::timestamp at time zone v_timezone;
  if v_hard_at >= v_next_boundary then
    return query select false, 'invalid_timeline', 'The CRM hard cutoff must remain before the next Attendance day boundary.', null::uuid;
    return;
  end if;

  select version.rule_values into v_previous
  from public.attendance_rule_versions as version
  where version.branch_id = p_branch_id
    and version.effective_from < p_effective_from
  order by version.effective_from desc
  limit 1;

  if v_previous is null then
    select to_jsonb(settings) into v_previous
    from public.attendance_settings as settings
    where settings.branch_id = p_branch_id;
  end if;

  insert into public.attendance_rule_versions (
    branch_id, effective_from, rule_values, previous_values, reason, changed_by
  ) values (
    p_branch_id, p_effective_from, coalesce(p_rule_values, '{}'::jsonb),
    coalesce(v_previous, '{}'::jsonb), v_reason, p_actor_staff_id
  ) returning id into v_id;

  if p_effective_from <= now() then
    insert into public.attendance_settings (branch_id, updated_by)
    values (p_branch_id, p_actor_staff_id)
    on conflict (branch_id) do nothing;

    update public.attendance_settings
    set timezone = coalesce(nullif(p_rule_values->>'timezone', ''), timezone),
        attendance_day_boundary = coalesce(nullif(p_rule_values->>'attendance_day_boundary', '')::time, attendance_day_boundary),
        late_grace_minutes = coalesce((p_rule_values->>'late_grace_minutes')::integer, late_grace_minutes),
        early_leave_threshold_minutes = coalesce((p_rule_values->>'early_leave_threshold_minutes')::integer, early_leave_threshold_minutes),
        overtime_threshold_minutes = coalesce((p_rule_values->>'overtime_threshold_minutes')::integer, overtime_threshold_minutes),
        duplicate_scan_window_seconds = coalesce((p_rule_values->>'duplicate_scan_window_seconds')::integer, duplicate_scan_window_seconds),
        active_service_blocks_clock_out = coalesce((p_rule_values->>'active_service_blocks_clock_out')::boolean, active_service_blocks_clock_out),
        branch_operating_close_time = coalesce(nullif(p_rule_values->>'branch_operating_close_time', '')::time, branch_operating_close_time),
        crm_closing_policy_enabled = coalesce((p_rule_values->>'crm_closing_policy_enabled')::boolean, crm_closing_policy_enabled),
        crm_closing_buffer_minutes = coalesce((p_rule_values->>'crm_closing_buffer_minutes')::integer, crm_closing_buffer_minutes),
        crm_manager_escalation_delay_minutes = coalesce((p_rule_values->>'crm_manager_escalation_delay_minutes')::integer, crm_manager_escalation_delay_minutes),
        crm_hard_cutoff_delay_minutes = coalesce((p_rule_values->>'crm_hard_cutoff_delay_minutes')::integer, crm_hard_cutoff_delay_minutes),
        updated_by = p_actor_staff_id,
        updated_at = now()
    where branch_id = p_branch_id;
  end if;

  return query select true, 'saved', 'Attendance rules saved.', v_id;
exception
  when unique_violation then
    return query select false, 'effective_time_conflict', 'A branch rule already starts at that effective time.', null::uuid;
end;
$$;

create or replace function public.save_attendance_category_rule(
  p_branch_id uuid,
  p_actor_staff_id uuid,
  p_staff_category text,
  p_effective_from timestamptz,
  p_rule_values jsonb,
  p_reason text
)
returns table (success boolean, code text, message text, category_rule_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_next_effective timestamptz;
  v_previous jsonb := '{}'::jsonb;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if p_branch_id is null or p_effective_from is null or v_reason is null
     or p_staff_category not in ('crm_front_desk', 'therapists', 'salon', 'drivers', 'utility', 'managers', 'other') then
    return query select false, 'invalid_request', 'Branch, category, effective time, and reason are required.', null::uuid;
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtext('attendance_category_rules'),
    hashtext(concat_ws(':', p_branch_id::text, p_staff_category))
  );

  select to_jsonb(rule_row) into v_previous
  from public.attendance_staff_category_rules as rule_row
  where rule_row.branch_id = p_branch_id
    and rule_row.staff_category = p_staff_category
    and rule_row.effective_from < p_effective_from
  order by rule_row.effective_from desc
  limit 1;

  select min(rule_row.effective_from) into v_next_effective
  from public.attendance_staff_category_rules as rule_row
  where rule_row.branch_id = p_branch_id
    and rule_row.staff_category = p_staff_category
    and rule_row.effective_from > p_effective_from;

  update public.attendance_staff_category_rules
  set effective_until = p_effective_from
  where branch_id = p_branch_id
    and staff_category = p_staff_category
    and effective_from < p_effective_from
    and (effective_until is null or effective_until > p_effective_from);

  insert into public.attendance_staff_category_rules (
    branch_id, staff_category, effective_from, effective_until,
    late_grace_minutes, early_leave_threshold_minutes, overtime_threshold_minutes,
    active_service_blocks_clock_out, crm_closing_policy_enabled,
    reason, changed_by, previous_values
  ) values (
    p_branch_id, p_staff_category, p_effective_from, v_next_effective,
    nullif(p_rule_values->>'late_grace_minutes', '')::integer,
    nullif(p_rule_values->>'early_leave_threshold_minutes', '')::integer,
    nullif(p_rule_values->>'overtime_threshold_minutes', '')::integer,
    nullif(p_rule_values->>'active_service_blocks_clock_out', '')::boolean,
    nullif(p_rule_values->>'crm_closing_policy_enabled', '')::boolean,
    v_reason, p_actor_staff_id, coalesce(v_previous, '{}'::jsonb)
  ) returning id into v_id;

  return query select true, 'saved', 'Category override saved.', v_id;
exception
  when unique_violation then
    return query select false, 'effective_time_conflict', 'A category rule already starts at that effective time.', null::uuid;
end;
$$;

create or replace function public.snapshot_attendance_policy()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_settings public.attendance_settings%rowtype;
  v_version public.attendance_rule_versions%rowtype;
  v_category_rule public.attendance_staff_category_rules%rowtype;
  v_staff public.staff%rowtype;
  v_values jsonb := '{}'::jsonb;
  v_category text := 'other';
  v_timezone text;
  v_enabled boolean;
  v_close_time time;
  v_buffer integer;
  v_escalation_delay integer;
  v_hard_delay integer;
  v_close_at timestamptz;
  v_latest_at timestamptz;
  v_business_date date;
  v_effective_at timestamptz;
  v_active_service_blocks boolean;
begin
  if new.attendance_policy_snapshot <> '{}'::jsonb then
    return new;
  end if;

  v_effective_at := coalesce(new.checked_in_at, now());
  v_business_date := coalesce(new.attendance_business_date, new.shift_date);
  select * into v_settings from public.attendance_settings where branch_id = new.branch_id;
  select * into v_staff from public.staff where id = new.staff_id;
  select * into v_version
  from public.attendance_rule_versions
  where branch_id = new.branch_id and effective_from <= v_effective_at
  order by effective_from desc limit 1;

  v_values := case when v_version.id is null then '{}'::jsonb else v_version.rule_values end;
  if lower(coalesce(v_staff.system_role, '')) in ('crm', 'csr', 'csr_head', 'csr_staff')
     or lower(coalesce(v_staff.staff_type, '')) = 'csr' then
    v_category := 'crm_front_desk';
  elsif lower(coalesce(v_staff.system_role, '')) in ('owner', 'manager', 'assistant_manager', 'store_manager', 'branch_manager', 'super_admin', 'platform_admin')
     or lower(coalesce(v_staff.staff_type, '')) = 'managerial' then
    v_category := 'managers';
  elsif lower(coalesce(v_staff.staff_type, '')) = 'therapist' then
    v_category := 'therapists';
  elsif lower(coalesce(v_staff.staff_type, '')) in ('nail_tech', 'aesthetician', 'salon_head') then
    v_category := 'salon';
  elsif lower(coalesce(v_staff.system_role, '')) = 'driver'
     or lower(coalesce(v_staff.staff_type, '')) = 'driver' then
    v_category := 'drivers';
  elsif lower(coalesce(v_staff.system_role, '')) = 'utility'
     or lower(coalesce(v_staff.staff_type, '')) = 'utility' then
    v_category := 'utility';
  end if;

  select * into v_category_rule
  from public.attendance_staff_category_rules
  where branch_id = new.branch_id
    and staff_category = v_category
    and effective_from <= v_effective_at
    and (effective_until is null or effective_until > v_effective_at)
  order by effective_from desc limit 1;

  v_timezone := coalesce(nullif(v_values->>'timezone', ''), v_settings.timezone, new.branch_timezone, 'Asia/Manila');
  v_enabled := coalesce(
    v_category_rule.crm_closing_policy_enabled,
    (v_values->>'crm_closing_policy_enabled')::boolean,
    v_settings.crm_closing_policy_enabled,
    true
  );
  v_close_time := coalesce(
    nullif(v_values->>'branch_operating_close_time', '')::time,
    v_settings.branch_operating_close_time,
    '22:30:00'::time
  );
  v_buffer := coalesce((v_values->>'crm_closing_buffer_minutes')::integer, v_settings.crm_closing_buffer_minutes, 30);
  v_escalation_delay := coalesce((v_values->>'crm_manager_escalation_delay_minutes')::integer, v_settings.crm_manager_escalation_delay_minutes, 30);
  v_hard_delay := coalesce((v_values->>'crm_hard_cutoff_delay_minutes')::integer, v_settings.crm_hard_cutoff_delay_minutes, 60);
  v_active_service_blocks := coalesce(
    v_category_rule.active_service_blocks_clock_out,
    (v_values->>'active_service_blocks_clock_out')::boolean,
    v_settings.active_service_blocks_clock_out,
    true
  );

  new.attendance_expected_end_at := new.scheduled_end_at;
  new.attendance_policy_source := 'schedule';

  if v_category = 'crm_front_desk'
     and lower(coalesce(new.shift_type, '')) = 'closing'
     and v_enabled then
    v_close_at := (v_business_date::text || ' ' || v_close_time::text)::timestamp at time zone v_timezone;
    v_latest_at := v_close_at + make_interval(mins => v_buffer);
    new.attendance_policy_source := 'crm_closing';
    new.attendance_expected_end_at := v_latest_at;
    new.earliest_normal_clock_out_at := v_close_at;
    new.latest_normal_clock_out_at := v_latest_at;
    new.clock_out_reminder_at := v_latest_at;
    new.manager_escalation_at := v_latest_at + make_interval(mins => v_escalation_delay);
    new.hard_cutoff_at := v_latest_at + make_interval(mins => v_hard_delay);
    new.provisional_clock_out_at := v_latest_at;
  end if;

  new.attendance_policy_snapshot := jsonb_build_object(
    'kind', new.attendance_policy_source,
    'staffCategory', v_category,
    'branchRuleVersionId', v_version.id,
    'categoryRuleId', v_category_rule.id,
    'effectiveAt', v_effective_at,
    'timezone', v_timezone,
    'attendanceDayBoundary', coalesce(
      nullif(v_values->>'attendance_day_boundary', '')::time,
      v_settings.attendance_day_boundary,
      '06:00:00'::time
    ),
    'rawScheduledStartAt', new.scheduled_start_at,
    'rawScheduledEndAt', new.scheduled_end_at,
    'expectedEndAt', new.attendance_expected_end_at,
    'earliestNormalClockOutAt', new.earliest_normal_clock_out_at,
    'latestNormalClockOutAt', new.latest_normal_clock_out_at,
    'reminderAt', new.clock_out_reminder_at,
    'managerEscalationAt', new.manager_escalation_at,
    'hardCutoffAt', new.hard_cutoff_at,
    'provisionalClockOutAt', new.provisional_clock_out_at,
    'lateGraceMinutes', coalesce(v_category_rule.late_grace_minutes, (v_values->>'late_grace_minutes')::integer, v_settings.late_grace_minutes, 10),
    'earlyLeaveThresholdMinutes', coalesce(v_category_rule.early_leave_threshold_minutes, (v_values->>'early_leave_threshold_minutes')::integer, v_settings.early_leave_threshold_minutes, 5),
    'overtimeThresholdMinutes', coalesce(v_category_rule.overtime_threshold_minutes, (v_values->>'overtime_threshold_minutes')::integer, v_settings.overtime_threshold_minutes, 15),
    'activeServiceBlocksClockOut', v_active_service_blocks
  );
  return new;
end;
$$;

drop trigger if exists staff_shift_checkins_snapshot_attendance_policy on public.staff_shift_checkins;
create trigger staff_shift_checkins_snapshot_attendance_policy
  before insert on public.staff_shift_checkins
  for each row execute function public.snapshot_attendance_policy();

alter table public.attendance_corrections
  drop constraint if exists attendance_corrections_correction_type_check;
alter table public.attendance_corrections
  add constraint attendance_corrections_correction_type_check
  check (correction_type in (
    'manual_clock_in', 'manual_clock_out', 'void', 'adjust_times', 'note',
    'reclassify_scan', 'set_manual_clock_in', 'set_manual_clock_out',
    'reset_staff_day', 'reset_attendance_state', 'rebuild_from_scans',
    'ignore_scan', 'apply_launch_recovery', 'update_attendance_rules',
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
    'reset_staff_day', 'reset_attendance_state', 'rebuild_from_scans',
    'ignore_scan', 'apply_launch_recovery', 'update_attendance_rules',
    'archive_test_data', 'revert_correction', 'system_auto_close',
    'reconcile_provisional_clock_out'
  ));

create or replace function public.process_crm_closing_attendance_interventions(
  p_now timestamptz default now(),
  p_limit integer default 100
)
returns table (
  processed_open_records integer,
  created_interventions integer,
  auto_closed_records integer,
  active_service_blocks integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_record public.staff_shift_checkins%rowtype;
  v_processed integer := 0;
  v_created integer := 0;
  v_closed integer := 0;
  v_blocked integer := 0;
  v_row_count integer;
  v_active_service boolean;
  v_exception_id uuid;
  v_previous jsonb;
  v_worked integer;
begin
  for v_record in
    select checkin.*
    from public.staff_shift_checkins as checkin
    where checkin.attendance_policy_source = 'crm_closing'
      and checkin.status = 'checked_in'
      and checkin.checked_out_at is null
      and checkin.is_test = false
      and checkin.clock_out_reminder_at <= p_now
      and exists (
        select 1
        from public.branches as branch
        where branch.id = checkin.branch_id
          and branch.is_active = true
      )
    order by checkin.clock_out_reminder_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  loop
    v_processed := v_processed + 1;

    insert into public.attendance_closing_interventions (
      branch_id, staff_id, checkin_id, attendance_business_date, stage,
      dedupe_key, due_at, policy_snapshot, applied_at
    ) values (
      v_record.branch_id, v_record.staff_id, v_record.id,
      coalesce(v_record.attendance_business_date, v_record.shift_date), 'reminder',
      concat_ws(':', 'crm-closing', v_record.branch_id, v_record.staff_id,
        coalesce(v_record.attendance_business_date, v_record.shift_date), 'reminder'),
      v_record.clock_out_reminder_at, v_record.attendance_policy_snapshot, p_now
    ) on conflict (checkin_id, stage) do nothing;
    get diagnostics v_row_count = row_count;
    v_created := v_created + v_row_count;

    if v_record.manager_escalation_at <= p_now then
      insert into public.attendance_closing_interventions (
        branch_id, staff_id, checkin_id, attendance_business_date, stage,
        dedupe_key, due_at, policy_snapshot, applied_at
      ) values (
        v_record.branch_id, v_record.staff_id, v_record.id,
        coalesce(v_record.attendance_business_date, v_record.shift_date), 'manager_escalation',
        concat_ws(':', 'crm-closing', v_record.branch_id, v_record.staff_id,
          coalesce(v_record.attendance_business_date, v_record.shift_date), 'manager-escalation'),
        v_record.manager_escalation_at, v_record.attendance_policy_snapshot, p_now
      ) on conflict (checkin_id, stage) do nothing;
      get diagnostics v_row_count = row_count;
      v_created := v_created + v_row_count;
    end if;

    if v_record.hard_cutoff_at <= p_now then
      select exists (
        select 1 from public.bookings as booking
        where booking.branch_id = v_record.branch_id
          and booking.staff_id = v_record.staff_id
          and booking.status = 'in_progress'
          and booking.booking_progress_status = 'session_started'
          and booking.session_completed_at is null
      ) and coalesce((v_record.attendance_policy_snapshot->>'activeServiceBlocksClockOut')::boolean, true)
      into v_active_service;

      if v_active_service then
        insert into public.attendance_closing_interventions (
          branch_id, staff_id, checkin_id, attendance_business_date, stage,
          dedupe_key, due_at, policy_snapshot, applied_at
        ) values (
          v_record.branch_id, v_record.staff_id, v_record.id,
          coalesce(v_record.attendance_business_date, v_record.shift_date), 'active_service_blocked',
          concat_ws(':', 'crm-closing', v_record.branch_id, v_record.staff_id,
            coalesce(v_record.attendance_business_date, v_record.shift_date), 'active-service-blocked'),
          v_record.hard_cutoff_at, v_record.attendance_policy_snapshot, p_now
        ) on conflict (checkin_id, stage) do nothing;
        get diagnostics v_row_count = row_count;
        v_created := v_created + v_row_count;
        v_blocked := v_blocked + 1;

        select exception_row.id into v_exception_id
        from public.attendance_exceptions as exception_row
        where exception_row.branch_id = v_record.branch_id
          and exception_row.dedupe_key = concat_ws('|', v_record.staff_id, v_record.id, 'active_service_at_closing_cutoff', 'live')
          and exception_row.status = 'open'
        limit 1 for update;
        if v_exception_id is null then
          insert into public.attendance_exceptions (
            branch_id, staff_id, checkin_id, exception_type, severity, message,
            metadata, dedupe_key, recommended_action, priority,
            staff_response_required, related_checkin_ids
          ) values (
            v_record.branch_id, v_record.staff_id, v_record.id, 'active_service', 'warning',
            'Active service prevented the CRM closing attendance auto-close.',
            jsonb_build_object('internalExceptionType', 'active_service_at_closing_cutoff', 'policySnapshot', v_record.attendance_policy_snapshot),
            concat_ws('|', v_record.staff_id, v_record.id, 'active_service_at_closing_cutoff', 'live'),
            'review_active_service', 'high', false, array[v_record.id]
          );
        end if;
      else
        v_previous := to_jsonb(v_record);
        v_worked := greatest(0, round(extract(epoch from (v_record.provisional_clock_out_at - v_record.checked_in_at)) / 60.0)::integer);
        update public.staff_shift_checkins
        set checked_out_at = provisional_clock_out_at,
            status = 'checked_out',
            clock_out_method = 'system_auto_close',
            clock_out_scan_event_id = null,
            worked_minutes = v_worked,
            early_leave_minutes = 0,
            overtime_minutes = 0,
            attendance_status = case when late_minutes > 0 then 'late' else 'present' end,
            exception_state = 'open',
            provisional_auto_closed_at = p_now,
            clock_out_confirmation_required = true,
            notes = format(
              'Auto-closed at %s · Confirmation required',
              to_char(
                v_record.provisional_clock_out_at at time zone coalesce(v_record.attendance_policy_snapshot->>'timezone', 'Asia/Manila'),
                'FMHH12:MI AM'
              )
            ),
            updated_at = p_now
        where id = v_record.id;

        insert into public.attendance_exceptions (
          branch_id, staff_id, checkin_id, exception_type, severity, message,
          metadata, dedupe_key, recommended_action, priority,
          staff_response_required, related_checkin_ids
        ) values (
          v_record.branch_id, v_record.staff_id, v_record.id, 'missed_checkout', 'warning',
          format(
            'Auto-closed at %s · Confirmation required',
            to_char(
              v_record.provisional_clock_out_at at time zone coalesce(v_record.attendance_policy_snapshot->>'timezone', 'Asia/Manila'),
              'FMHH12:MI AM'
            )
          ),
          jsonb_build_object(
            'internalExceptionType', 'missing_clock_out',
            'provisionalClockOutAt', v_record.provisional_clock_out_at,
            'autoClosedAt', p_now,
            'policySnapshot', v_record.attendance_policy_snapshot
          ),
          concat_ws('|', v_record.staff_id, v_record.id, 'missing_clock_out', 'live'),
          'confirm_actual_clock_out', 'high', true, array[v_record.id]
        ) returning id into v_exception_id;

        insert into public.attendance_corrections (
          branch_id, staff_id, checkin_id, exception_id, attendance_date,
          correction_type, action_type, previous_values, new_values, reason,
          status, applied_at, corrected_at, is_test
        ) values (
          v_record.branch_id, v_record.staff_id, v_record.id, v_exception_id,
          coalesce(v_record.attendance_business_date, v_record.shift_date),
          'system_auto_close', 'system_auto_close', v_previous,
          jsonb_build_object(
            'checkedOutAt', v_record.provisional_clock_out_at,
            'clockOutMethod', 'system_auto_close',
            'confirmationRequired', true
          ),
          'CRM closing hard cutoff reached without a real clock-out scan.',
          'applied', p_now, p_now, false
        );

        insert into public.attendance_closing_interventions (
          branch_id, staff_id, checkin_id, attendance_business_date, stage,
          dedupe_key, due_at, policy_snapshot, applied_at
        ) values (
          v_record.branch_id, v_record.staff_id, v_record.id,
          coalesce(v_record.attendance_business_date, v_record.shift_date), 'auto_close',
          concat_ws(':', 'crm-closing', v_record.branch_id, v_record.staff_id,
            coalesce(v_record.attendance_business_date, v_record.shift_date), 'auto-close'),
          v_record.hard_cutoff_at, v_record.attendance_policy_snapshot, p_now
        ) on conflict (checkin_id, stage) do nothing;
        get diagnostics v_row_count = row_count;
        v_created := v_created + v_row_count;
        v_closed := v_closed + 1;
      end if;
    end if;
  end loop;

  update public.attendance_settings
  set closing_intervention_last_run_at = p_now,
      closing_intervention_last_error = null
  where crm_closing_policy_enabled = true;

  return query select v_processed, v_created, v_closed, v_blocked;
end;
$$;

create or replace function public.reconcile_provisional_attendance_clock_out(
  p_request_id text,
  p_checkin_id uuid,
  p_branch_id uuid,
  p_staff_id uuid,
  p_qr_point_id uuid,
  p_device_id uuid,
  p_actual_clock_out_at timestamptz,
  p_public_result jsonb,
  p_user_agent text default null,
  p_ip_address text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_is_test boolean default false
)
returns table (
  success boolean,
  code text,
  scan_event_id uuid,
  checkin_id uuid,
  operation_result jsonb,
  message text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_checkin public.staff_shift_checkins%rowtype;
  v_existing_event public.qr_scan_events%rowtype;
  v_event_id uuid;
  v_exception_id uuid;
  v_result jsonb := coalesce(p_public_result, '{}'::jsonb);
  v_worked integer;
  v_early integer := 0;
  v_overtime integer := 0;
  v_status text;
  v_ip inet;
  v_boundary time;
  v_actual_business_date date;
begin
  if p_request_id is null or p_checkin_id is null or p_actual_clock_out_at is null then
    return query select false, 'invalid_request', null::uuid, p_checkin_id, null::jsonb, 'Reconciliation identity and actual time are required.';
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('attendance_scan_request'), hashtext(p_request_id));
  perform pg_advisory_xact_lock(hashtext('attendance_scan_staff'), hashtext(concat_ws(':', p_branch_id, p_staff_id, p_is_test)));

  select * into v_existing_event
  from public.qr_scan_events where request_id = p_request_id
  order by created_at limit 1 for update;
  if found and v_existing_event.operation_result is not null then
    return query select true, 'replayed', v_existing_event.id, v_existing_event.checkin_id,
      v_existing_event.operation_result, 'Reconciled scan result replayed.';
    return;
  end if;

  select * into v_checkin
  from public.staff_shift_checkins
  where id = p_checkin_id and branch_id = p_branch_id and staff_id = p_staff_id
    and is_test = p_is_test
  for update;

  if not found or v_checkin.status <> 'checked_out'
     or v_checkin.clock_out_method <> 'system_auto_close'
     or v_checkin.clock_out_confirmation_required is not true then
    return query select false, 'provisional_checkin_not_found', null::uuid, p_checkin_id, null::jsonb,
      'The provisional Attendance record is no longer awaiting confirmation.';
    return;
  end if;

  v_boundary := coalesce(
    nullif(v_checkin.attendance_policy_snapshot->>'attendanceDayBoundary', '')::time,
    '06:00:00'::time
  );
  v_actual_business_date := (p_actual_clock_out_at at time zone coalesce(
    v_checkin.attendance_policy_snapshot->>'timezone',
    v_checkin.branch_timezone,
    'Asia/Manila'
  ))::date;
  if (p_actual_clock_out_at at time zone coalesce(
    v_checkin.attendance_policy_snapshot->>'timezone',
    v_checkin.branch_timezone,
    'Asia/Manila'
  ))::time < v_boundary then
    v_actual_business_date := v_actual_business_date - 1;
  end if;
  if v_actual_business_date <> coalesce(v_checkin.attendance_business_date, v_checkin.shift_date) then
    return query select false, 'outside_attendance_business_day', null::uuid, p_checkin_id, null::jsonb,
      'The real QR scan is outside the provisional Attendance business day and requires review.';
    return;
  end if;

  begin
    v_ip := nullif(trim(split_part(coalesce(p_ip_address, ''), ',', 1)), '')::inet;
  exception when others then
    v_ip := null;
  end;

  insert into public.qr_scan_events (
    branch_id, qr_point_id, staff_id, device_id, checkin_id, scan_type,
    action, outcome, reason_code, message, request_id, operation_id,
    user_agent, ip_address, metadata, is_test
  ) values (
    p_branch_id, p_qr_point_id, p_staff_id, p_device_id, p_checkin_id, 'attendance',
    'clock_out_reconciled', 'success', 'provisional_clock_out_reconciled',
    'Actual QR clock-out replaced the provisional system auto-close.',
    p_request_id, p_request_id, p_user_agent, v_ip,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'provisionalClockOutAt', v_checkin.checked_out_at,
      'actualClockOutAt', p_actual_clock_out_at
    ), p_is_test
  ) returning id into v_event_id;

  v_worked := greatest(0, round(extract(epoch from (p_actual_clock_out_at - v_checkin.checked_in_at)) / 60.0)::integer);
  if v_checkin.earliest_normal_clock_out_at is not null
     and p_actual_clock_out_at < v_checkin.earliest_normal_clock_out_at then
    v_early := round(extract(epoch from (v_checkin.earliest_normal_clock_out_at - p_actual_clock_out_at)) / 60.0)::integer;
  end if;
  if v_checkin.latest_normal_clock_out_at is not null
     and p_actual_clock_out_at > v_checkin.latest_normal_clock_out_at then
    v_overtime := round(extract(epoch from (p_actual_clock_out_at - v_checkin.latest_normal_clock_out_at)) / 60.0)::integer;
  end if;
  v_status := case
    when v_checkin.late_minutes > 0 then 'late'
    when v_early > 0 then 'early_leave'
    when v_overtime > 0 then 'overtime'
    else 'present'
  end;

  select id into v_exception_id
  from public.attendance_exceptions
  where checkin_id = p_checkin_id and status = 'open'
    and (metadata->>'internalExceptionType' = 'missing_clock_out' or exception_type = 'missed_checkout')
  order by created_at desc limit 1 for update;

  update public.staff_shift_checkins
  set checked_out_at = p_actual_clock_out_at,
      clock_out_method = 'qr',
      clock_out_scan_event_id = v_event_id,
      worked_minutes = v_worked,
      early_leave_minutes = v_early,
      overtime_minutes = v_overtime,
      attendance_status = v_status,
      exception_state = case when late_minutes > 0 or v_early > 0 or v_overtime > 0 then 'open' else 'none' end,
      clock_out_confirmation_required = false,
      actual_clock_out_reconciled_at = v_now,
      notes = null,
      updated_at = v_now
  where id = p_checkin_id;

  if v_exception_id is not null then
    update public.attendance_exceptions
    set status = 'resolved', resolution_status = 'resolved',
        resolution_action = 'actual_qr_reconciliation',
        resolution_note = 'A real QR clock-out replaced the provisional system auto-close.',
        resolved_at = v_now, updated_at = v_now, latest_scan_event_id = v_event_id
    where id = v_exception_id;
  end if;

  if v_early > 0 or v_overtime > 0 then
    insert into public.attendance_exceptions (
      branch_id, staff_id, checkin_id, scan_event_id, latest_scan_event_id,
      exception_type, severity, message, metadata, dedupe_key,
      recommended_action, priority, related_checkin_ids
    ) values (
      p_branch_id, p_staff_id, p_checkin_id, v_event_id, v_event_id,
      case when v_early > 0 then 'early_leave' else 'overtime' end,
      'warning',
      case
        when v_early > 0 then format('Actual QR clock-out was %s minutes before the normal closing window.', v_early)
        else format('Actual QR clock-out was %s minutes after the normal closing window.', v_overtime)
      end,
      jsonb_build_object(
        'internalExceptionType', case when v_early > 0 then 'early_clock_out' else 'overtime_clock_out' end,
        'earlyLeaveMinutes', v_early,
        'overtimeMinutes', v_overtime,
        'reconciledFromProvisional', true
      ),
      concat_ws('|', p_staff_id, p_checkin_id,
        case when v_early > 0 then 'early_clock_out' else 'overtime_clock_out' end,
        case when p_is_test then 'test' else 'live' end),
      'review_clock_out', 'normal', array[p_checkin_id]
    );
  end if;

  insert into public.attendance_corrections (
    branch_id, staff_id, checkin_id, exception_id, attendance_date,
    correction_type, action_type, previous_values, new_values, reason,
    status, scan_event_ids, applied_at, corrected_at, is_test
  ) values (
    p_branch_id, p_staff_id, p_checkin_id, v_exception_id,
    coalesce(v_checkin.attendance_business_date, v_checkin.shift_date),
    'reconcile_provisional_clock_out', 'reconcile_provisional_clock_out',
    jsonb_build_object('checkedOutAt', v_checkin.checked_out_at, 'clockOutMethod', v_checkin.clock_out_method, 'confirmationRequired', true),
    jsonb_build_object('checkedOutAt', p_actual_clock_out_at, 'clockOutMethod', 'qr', 'scanEventId', v_event_id),
    'A real QR scan replaced the provisional system auto-close.', 'applied',
    jsonb_build_array(v_event_id), v_now, v_now, p_is_test
  );

  update public.staff_devices
  set last_seen_at = v_now, last_attendance_scan_at = v_now, updated_at = v_now
  where id = p_device_id;

  v_result := v_result || jsonb_build_object('scanEventId', v_event_id::text);
  if v_result ? 'attendance' then
    v_result := jsonb_set(v_result, '{attendance,attendanceId}', to_jsonb(p_checkin_id::text), true);
  end if;
  update public.qr_scan_events
  set operation_result = v_result, operation_result_recorded_at = v_now
  where id = v_event_id;

  return query select true, 'committed', v_event_id, p_checkin_id, v_result,
    'Provisional clock-out reconciled with the actual QR scan.';
end;
$$;

revoke all on function public.save_attendance_branch_rule_version(uuid, uuid, timestamptz, jsonb, text) from public, anon, authenticated;
revoke all on function public.save_attendance_category_rule(uuid, uuid, text, timestamptz, jsonb, text) from public, anon, authenticated;
revoke all on function public.process_crm_closing_attendance_interventions(timestamptz, integer) from public, anon, authenticated;
revoke all on function public.reconcile_provisional_attendance_clock_out(text, uuid, uuid, uuid, uuid, uuid, timestamptz, jsonb, text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.save_attendance_branch_rule_version(uuid, uuid, timestamptz, jsonb, text) to service_role;
grant execute on function public.save_attendance_category_rule(uuid, uuid, text, timestamptz, jsonb, text) to service_role;
grant execute on function public.process_crm_closing_attendance_interventions(timestamptz, integer) to service_role;
grant execute on function public.reconcile_provisional_attendance_clock_out(text, uuid, uuid, uuid, uuid, uuid, timestamptz, jsonb, text, text, jsonb, boolean) to service_role;

comment on table public.attendance_rule_versions is
  'Append-only effective-dated branch Attendance rule history and audit trail.';
comment on table public.attendance_staff_category_rules is
  'Non-overlapping effective periods for staff-category Attendance overrides; null means inherit branch rule.';
comment on table public.attendance_closing_interventions is
  'Durable deduplicated outbox for CRM closing reminders, escalations, active-service blocks, and provisional auto-close.';
comment on column public.staff_shift_checkins.attendance_policy_snapshot is
  'Immutable effective Attendance policy captured transactionally when the official record is inserted.';
comment on column public.staff_shift_checkins.scheduled_end_at is
  'Raw assigned schedule end. CRM closing policy never rewrites this value.';
comment on function public.process_crm_closing_attendance_interventions(timestamptz, integer) is
  'Idempotent CRM closing intervention processor. Auto-close writes no synthetic qr_scan_event.';
comment on function public.reconcile_provisional_attendance_clock_out(text, uuid, uuid, uuid, uuid, uuid, timestamptz, jsonb, text, text, jsonb, boolean) is
  'Atomically replaces a provisional system auto-close with the actual real QR event on the same Attendance row.';
