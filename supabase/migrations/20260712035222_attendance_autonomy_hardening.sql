-- Attendance Autonomy Hardening
--
-- Add immutable shift-instance snapshots, idempotent scan result replay,
-- deduplicated Recovery cases, and explicit device policy metadata.
-- This migration is additive/idempotent and does not mutate raw scan history.

-- ─── Stable shift-instance snapshots ────────────────────────────────────────

alter table public.staff_shift_checkins
  add column if not exists shift_instance_key text,
  add column if not exists schedule_source text,
  add column if not exists schedule_source_id text,
  add column if not exists branch_timezone text not null default 'Asia/Manila',
  add column if not exists attendance_business_date date;

update public.staff_shift_checkins
set
  branch_timezone = coalesce(nullif(branch_timezone, ''), 'Asia/Manila'),
  attendance_business_date = coalesce(attendance_business_date, shift_date),
  schedule_source = coalesce(schedule_source, 'weekly_schedule'),
  shift_instance_key = coalesce(
    shift_instance_key,
    concat_ws(
      '|',
      staff_id::text,
      branch_id::text,
      shift_date::text,
      shift_type,
      coalesce(to_char(scheduled_start_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'), 'none'),
      coalesce(to_char(scheduled_end_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'), 'none'),
      coalesce(schedule_source, 'weekly_schedule'),
      coalesce(schedule_source_id, 'none')
    )
  )
where status <> 'voided';

alter table public.staff_shift_checkins
  drop constraint if exists staff_shift_checkins_unique_day_shift;

alter table public.staff_shift_checkins
  drop constraint if exists staff_shift_checkins_schedule_source_check;

alter table public.staff_shift_checkins
  add constraint staff_shift_checkins_schedule_source_check
  check (
    schedule_source is null or schedule_source in (
      'weekly_schedule',
      'override',
      'temporary_branch_assignment',
      'manual_authorized_shift'
    )
  );

create unique index if not exists staff_shift_checkins_unique_shift_instance
  on public.staff_shift_checkins(staff_id, branch_id, shift_instance_key, is_test)
  where status <> 'voided' and shift_instance_key is not null;

create unique index if not exists staff_shift_checkins_unique_legacy_day_shift
  on public.staff_shift_checkins(staff_id, branch_id, shift_date, shift_type, is_test)
  where status <> 'voided' and shift_instance_key is null;

create index if not exists staff_shift_checkins_business_date_idx
  on public.staff_shift_checkins(branch_id, attendance_business_date, status)
  where attendance_business_date is not null;

create index if not exists staff_shift_checkins_shift_instance_idx
  on public.staff_shift_checkins(shift_instance_key)
  where shift_instance_key is not null;

comment on column public.staff_shift_checkins.shift_instance_key is
  'Immutable application key for the resolved scheduled shift instance captured at clock-in.';
comment on column public.staff_shift_checkins.schedule_source is
  'Resolved schedule source captured at clock-in: weekly_schedule, override, temporary_branch_assignment, or manual_authorized_shift.';
comment on column public.staff_shift_checkins.branch_timezone is
  'Branch timezone used when resolving the attendance business day and schedule snapshot.';
comment on column public.staff_shift_checkins.attendance_business_date is
  'Branch attendance business date after applying attendance_day_boundary.';

-- ─── Idempotent scan result replay metadata ─────────────────────────────────

alter table public.qr_scan_events
  add column if not exists operation_id text,
  add column if not exists operation_result jsonb,
  add column if not exists operation_result_recorded_at timestamptz;

update public.qr_scan_events
set operation_id = coalesce(operation_id, request_id)
where request_id is not null;

create index if not exists qr_scan_events_operation_id_idx
  on public.qr_scan_events(operation_id)
  where operation_id is not null;

comment on column public.qr_scan_events.operation_result is
  'Sanitized final public scan result for idempotent request replay. Does not contain raw device credentials or auth tokens.';

-- ─── Deduplicated Recovery cases ────────────────────────────────────────────

alter table public.attendance_exceptions
  add column if not exists dedupe_key text,
  add column if not exists occurrence_count integer not null default 1,
  add column if not exists first_detected_at timestamptz,
  add column if not exists last_detected_at timestamptz,
  add column if not exists latest_scan_event_id uuid references public.qr_scan_events(id) on delete set null,
  add column if not exists related_checkin_ids uuid[] not null default '{}'::uuid[],
  add column if not exists recommended_action text,
  add column if not exists priority text not null default 'normal';

update public.attendance_exceptions
set
  dedupe_key = coalesce(
    dedupe_key,
    concat_ws(
      '|',
      coalesce(staff_id::text, 'unknown_staff'),
      coalesce(checkin_id::text, 'no_checkin'),
      exception_type,
      case when is_test then 'test' else 'live' end
    )
  ),
  occurrence_count = greatest(1, occurrence_count),
  first_detected_at = coalesce(first_detected_at, detected_at, created_at),
  last_detected_at = coalesce(last_detected_at, detected_at, created_at),
  latest_scan_event_id = coalesce(latest_scan_event_id, scan_event_id),
  related_checkin_ids = case
    when checkin_id is null then related_checkin_ids
    when checkin_id = any(related_checkin_ids) then related_checkin_ids
    else array_append(related_checkin_ids, checkin_id)
  end;

alter table public.attendance_exceptions
  drop constraint if exists attendance_exceptions_occurrence_count_check;

alter table public.attendance_exceptions
  add constraint attendance_exceptions_occurrence_count_check
  check (occurrence_count >= 1);

alter table public.attendance_exceptions
  drop constraint if exists attendance_exceptions_priority_check;

alter table public.attendance_exceptions
  add constraint attendance_exceptions_priority_check
  check (priority in ('low', 'normal', 'high', 'urgent'));

create index if not exists attendance_exceptions_open_dedupe_idx
  on public.attendance_exceptions(branch_id, dedupe_key, is_test)
  where status = 'open' and dedupe_key is not null;

create index if not exists attendance_exceptions_latest_scan_idx
  on public.attendance_exceptions(latest_scan_event_id)
  where latest_scan_event_id is not null;

comment on column public.attendance_exceptions.dedupe_key is
  'Branch-scoped active Recovery case key. Repeated raw scans increment occurrence_count instead of creating new cases.';
comment on column public.attendance_exceptions.occurrence_count is
  'Number of times this active Recovery case has been observed.';

-- ─── Explicit Attendance device policy metadata ─────────────────────────────

alter table public.staff_devices
  add column if not exists device_role text not null default 'primary',
  add column if not exists superseded_by_device_id uuid references public.staff_devices(id) on delete set null,
  add column if not exists security_state text not null default 'clear',
  add column if not exists replacement_confirmed_at timestamptz,
  add column if not exists replacement_confirmed_by uuid references public.staff(id) on delete set null;

alter table public.staff_devices
  drop constraint if exists staff_devices_status_check;

alter table public.staff_devices
  add constraint staff_devices_status_check
  check (status in ('active', 'revoked', 'expired', 'lost', 'stolen', 'security_blocked'));

alter table public.staff_devices
  drop constraint if exists staff_devices_device_role_check;

alter table public.staff_devices
  add constraint staff_devices_device_role_check
  check (device_role in ('primary', 'secondary', 'replacement_pending'));

alter table public.staff_devices
  drop constraint if exists staff_devices_security_state_check;

alter table public.staff_devices
  add constraint staff_devices_security_state_check
  check (security_state in ('clear', 'lost', 'stolen', 'suspicious', 'blocked'));

with ranked_active_devices as (
  select
    id,
    row_number() over (
      partition by staff_id
      order by coalesce(last_seen_at, created_at) desc, created_at desc, id
    ) as device_rank
  from public.staff_devices
  where status = 'active'
)
update public.staff_devices as device
set device_role = case
  when ranked_active_devices.device_rank = 1 then 'primary'
  else 'secondary'
end
from ranked_active_devices
where ranked_active_devices.id = device.id;

create unique index if not exists staff_devices_one_active_primary_idx
  on public.staff_devices(staff_id)
  where status = 'active' and device_role = 'primary';

create index if not exists staff_devices_staff_policy_idx
  on public.staff_devices(staff_id, status, device_role, security_state);

comment on column public.staff_devices.device_role is
  'Attendance device policy role. Default is one active primary phone per staff member; secondary phones require approval.';
comment on column public.staff_devices.security_state is
  'Security posture for Attendance device handling. Lost/stolen/blocked devices must not self-recover.';
