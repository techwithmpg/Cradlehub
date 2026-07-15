-- Smart, schedule-backed dynamic Attendance clock-out
--
-- The assigned schedule remains the foundation. This migration recalculates
-- only the expected clock-out window from the final relevant booking/trip and
-- stores non-customer evidence in the existing Attendance policy snapshot.
-- Booking/schedule triggers touch affected open records only. Portal clock-out
-- is a restricted, device-bound transaction sharing the QR staff lock.

alter table public.attendance_staff_category_rules
  add column if not exists service_cleanup_buffer_minutes integer,
  add column if not exists home_service_wrap_up_buffer_minutes integer,
  add column if not exists driver_return_buffer_minutes integer,
  add column if not exists final_client_release_enabled boolean,
  add column if not exists portal_closing_shift_enabled boolean;

alter table public.attendance_staff_category_rules
  drop constraint if exists attendance_category_service_cleanup_buffer_check,
  add constraint attendance_category_service_cleanup_buffer_check
    check (service_cleanup_buffer_minutes between 0 and 240),
  drop constraint if exists attendance_category_home_wrap_buffer_check,
  add constraint attendance_category_home_wrap_buffer_check
    check (home_service_wrap_up_buffer_minutes between 0 and 240),
  drop constraint if exists attendance_category_driver_return_buffer_check,
  add constraint attendance_category_driver_return_buffer_check
    check (driver_return_buffer_minutes between 0 and 360);

comment on column public.attendance_staff_category_rules.service_cleanup_buffer_minutes is
  'Minutes added to a service provider final relevant service completion.';
comment on column public.attendance_staff_category_rules.home_service_wrap_up_buffer_minutes is
  'Minutes added after a therapist final completed home-service assignment.';
comment on column public.attendance_staff_category_rules.driver_return_buffer_minutes is
  'Minutes added after a driver final completed trip; zero means no return requirement.';
comment on column public.attendance_staff_category_rules.final_client_release_enabled is
  'Allows an ordinary service provider final service plus buffer to precede scheduled shift end.';
comment on column public.attendance_staff_category_rules.portal_closing_shift_enabled is
  'Allows an explicitly assigned therapist/CRM closing shift to use controlled portal clock-out.';

alter table public.staff_shift_checkins
  drop constraint if exists staff_shift_checkins_policy_source_check,
  add constraint staff_shift_checkins_policy_source_check
    check (attendance_policy_source in (
      'schedule', 'crm_closing', 'service_completion', 'home_service', 'driver_trip'
    ));

create index if not exists bookings_attendance_staff_business_date_idx
  on public.bookings (staff_id, booking_date, start_time, end_time)
  where status not in ('cancelled', 'no_show');

create index if not exists bookings_attendance_branch_business_date_idx
  on public.bookings (branch_id, booking_date, delivery_type, start_time, end_time)
  where status not in ('cancelled', 'no_show');

create index if not exists bookings_attendance_driver_business_date_idx
  on public.bookings (driver_id, booking_date, start_time, end_time)
  where driver_id is not null
    and delivery_type = 'home_service'
    and status not in ('cancelled', 'no_show');

create or replace function public.resolve_attendance_staff_category(p_staff public.staff)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case
    when lower(coalesce(p_staff.system_role, '')) in ('crm', 'csr', 'csr_head', 'csr_staff')
      or lower(coalesce(p_staff.staff_type, '')) = 'csr' then 'crm_front_desk'
    when lower(coalesce(p_staff.system_role, '')) in (
      'owner', 'manager', 'assistant_manager', 'store_manager', 'branch_manager',
      'super_admin', 'platform_admin'
    ) or lower(coalesce(p_staff.staff_type, '')) = 'managerial' then 'managers'
    when lower(coalesce(p_staff.staff_type, '')) = 'therapist' then 'therapists'
    when lower(coalesce(p_staff.staff_type, '')) in (
      'nail_tech', 'nail_technician', 'aesthetician', 'salon_head', 'salon'
    ) then 'salon'
    when lower(coalesce(p_staff.system_role, '')) = 'driver'
      or lower(coalesce(p_staff.staff_type, '')) = 'driver' then 'drivers'
    when lower(coalesce(p_staff.system_role, '')) = 'utility'
      or lower(coalesce(p_staff.staff_type, '')) = 'utility' then 'utility'
    else 'other'
  end
$$;

comment on function public.resolve_attendance_staff_category(public.staff) is
  'Canonical Attendance policy category mapping. Contains no authorization decision.';

create or replace function public.recalculate_attendance_clock_out_policy(
  p_checkin_id uuid,
  p_calculated_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := coalesce(p_calculated_at, now());
  v_checkin public.staff_shift_checkins%rowtype;
  v_staff public.staff%rowtype;
  v_settings public.attendance_settings%rowtype;
  v_rule public.attendance_staff_category_rules%rowtype;
  v_rule_version public.attendance_rule_versions%rowtype;
  v_values jsonb := '{}'::jsonb;
  v_category text := 'other';
  v_timezone text;
  v_boundary time;
  v_business_date date;
  v_scope_start timestamptz;
  v_scope_end timestamptz;
  v_schedule_end timestamptz;
  v_override_end timestamptz;
  v_override_id uuid;
  v_source text := 'schedule';
  v_source_booking_id uuid;
  v_source_dispatch_id uuid;
  v_source_trip_id uuid;
  v_source_completion timestamptz;
  v_source_scheduled_start timestamptz;
  v_source_delivery_type text;
  v_source_progress text;
  v_source_status text;
  v_buffer integer := 0;
  v_service_buffer integer;
  v_home_buffer integer;
  v_driver_buffer integer;
  v_crm_buffer integer;
  v_late_grace integer;
  v_early_tolerance integer;
  v_escalation_delay integer;
  v_hard_delay integer;
  v_final_release boolean;
  v_portal_closing_enabled boolean;
  v_is_service_provider boolean := false;
  v_has_active boolean := false;
  v_has_upcoming boolean := false;
  v_next_assignment_at timestamptz;
  v_expected timestamptz;
  v_earliest timestamptz;
  v_latest timestamptz;
  v_reminder timestamptz;
  v_escalation timestamptz;
  v_hard timestamptz;
  v_provisional timestamptz;
  v_safety_enabled boolean := false;
  v_portal_eligible boolean := false;
  v_portal_reason text := 'use_branch_qr';
  v_portal_method text;
  v_candidate_snapshot jsonb;
  v_snapshot jsonb;
  v_changed boolean := false;
begin
  if p_checkin_id is null then
    raise exception using errcode = '22023', message = 'Attendance record is required.';
  end if;

  select checkin.* into v_checkin
  from public.staff_shift_checkins as checkin
  where checkin.id = p_checkin_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Attendance record was not found.';
  end if;

  select staff.* into v_staff from public.staff as staff where staff.id = v_checkin.staff_id;
  select settings.* into v_settings
  from public.attendance_settings as settings
  where settings.branch_id = v_checkin.branch_id;

  if v_staff.id is null or v_settings.branch_id is null then
    raise exception using errcode = 'P0002', message = 'Attendance policy context was not found.';
  end if;

  v_category := public.resolve_attendance_staff_category(v_staff);
  v_business_date := coalesce(v_checkin.attendance_business_date, v_checkin.shift_date);
  v_timezone := coalesce(v_settings.timezone, nullif(v_checkin.branch_timezone, ''), 'Asia/Manila');
  v_boundary := coalesce(v_settings.attendance_day_boundary, '06:00:00'::time);
  v_scope_start := (v_business_date::text || ' ' || v_boundary::text)::timestamp at time zone v_timezone;
  v_scope_end := v_scope_start + interval '24 hours';
  v_schedule_end := v_checkin.scheduled_end_at;

  select version.* into v_rule_version
  from public.attendance_rule_versions as version
  where version.branch_id = v_checkin.branch_id
    and version.effective_from <= v_now
  order by version.effective_from desc
  limit 1;
  v_values := case when v_rule_version.id is null then '{}'::jsonb else v_rule_version.rule_values end;

  select rule.* into v_rule
  from public.attendance_staff_category_rules as rule
  where rule.branch_id = v_checkin.branch_id
    and rule.staff_category = v_category
    and rule.effective_from <= v_now
    and (rule.effective_until is null or rule.effective_until > v_now)
  order by rule.effective_from desc
  limit 1;

  v_service_buffer := coalesce(
    v_rule.service_cleanup_buffer_minutes,
    nullif(v_values->>'service_cleanup_buffer_minutes', '')::integer,
    15
  );
  v_home_buffer := coalesce(
    v_rule.home_service_wrap_up_buffer_minutes,
    nullif(v_values->>'home_service_wrap_up_buffer_minutes', '')::integer,
    v_service_buffer
  );
  v_driver_buffer := coalesce(
    v_rule.driver_return_buffer_minutes,
    nullif(v_values->>'driver_return_buffer_minutes', '')::integer,
    0
  );
  v_crm_buffer := coalesce(
    nullif(v_values->>'crm_closing_buffer_minutes', '')::integer,
    v_settings.crm_closing_buffer_minutes,
    30
  );
  v_late_grace := coalesce(
    v_rule.late_grace_minutes,
    nullif(v_values->>'late_grace_minutes', '')::integer,
    v_settings.late_grace_minutes,
    10
  );
  v_early_tolerance := coalesce(
    v_rule.early_leave_threshold_minutes,
    nullif(v_values->>'early_leave_threshold_minutes', '')::integer,
    v_settings.early_leave_threshold_minutes,
    5
  );
  v_escalation_delay := coalesce(
    nullif(v_values->>'crm_manager_escalation_delay_minutes', '')::integer,
    v_settings.crm_manager_escalation_delay_minutes,
    30
  );
  v_hard_delay := coalesce(
    nullif(v_values->>'crm_hard_cutoff_delay_minutes', '')::integer,
    v_settings.crm_hard_cutoff_delay_minutes,
    60
  );
  v_final_release := coalesce(
    v_rule.final_client_release_enabled,
    nullif(v_values->>'final_client_release_enabled', '')::boolean,
    false
  );
  v_portal_closing_enabled := coalesce(
    v_rule.portal_closing_shift_enabled,
    nullif(v_values->>'portal_closing_shift_enabled', '')::boolean,
    v_category in ('crm_front_desk', 'therapists')
  );

  -- An approved date override is the authoritative schedule fallback. Raw
  -- assigned timestamps remain untouched for audit/reconstruction.
  select
    (override.override_date::text || ' ' || override.end_time::text)::timestamp
      at time zone v_timezone
      + case when override.ends_next_day then interval '1 day' else interval '0' end,
    override.id
  into v_override_end, v_override_id
  from public.schedule_overrides as override
  where override.staff_id = v_checkin.staff_id
    and override.override_date = v_business_date
    and override.is_day_off = false
    and override.end_time is not null
    and override.created_by is not null
  order by override.created_at desc
  limit 1;

  if v_override_end is not null then
    v_schedule_end := v_override_end;
  elsif v_checkin.schedule_source = 'weekly' and v_checkin.schedule_source_id is not null then
    select
      (v_business_date::text || ' ' || schedule.end_time::text)::timestamp
        at time zone v_timezone
        + case when schedule.ends_next_day then interval '1 day' else interval '0' end
    into v_override_end
    from public.staff_schedules as schedule
    where schedule.id::text = v_checkin.schedule_source_id
      and schedule.staff_id = v_checkin.staff_id
      and schedule.is_active = true;
    v_schedule_end := coalesce(v_override_end, v_schedule_end);
  end if;

  if v_schedule_end is null then
    v_schedule_end := v_scope_end;
  end if;

  v_is_service_provider := v_category in ('therapists', 'salon')
    or exists (
      select 1 from public.staff_services as capability
      where capability.staff_id = v_checkin.staff_id
    );

  if v_category = 'crm_front_desk'
     and lower(coalesce(v_checkin.shift_type, '')) = 'closing'
     and coalesce(
       v_rule.crm_closing_policy_enabled,
       nullif(v_values->>'crm_closing_policy_enabled', '')::boolean,
       v_settings.crm_closing_policy_enabled,
       true
     ) then
    select candidate.id,
           candidate.completion_at,
           candidate.scheduled_start_at,
           candidate.delivery_type,
           candidate.booking_progress_status,
           candidate.status
    into v_source_booking_id, v_source_completion, v_source_scheduled_start,
         v_source_delivery_type, v_source_progress, v_source_status
    from (
      select booking.id,
             booking.delivery_type,
             booking.booking_progress_status,
             booking.status,
             (booking.booking_date::text || ' ' || booking.start_time::text)::timestamp
               at time zone v_timezone as scheduled_start_at,
             coalesce(
               booking.session_completed_at,
               booking.completed_at,
               booking.session_due_at,
               case when booking.session_started_at is not null then
                 booking.session_started_at + make_interval(
                   mins => coalesce(booking.session_duration_minutes_snapshot, service.duration_minutes, 60)
                 )
               end,
               (booking.booking_date::text || ' ' || booking.end_time::text)::timestamp
                 at time zone v_timezone
                 + case when booking.end_time <= booking.start_time then interval '1 day' else interval '0' end
             ) as completion_at
      from public.bookings as booking
      left join public.services as service on service.id = booking.service_id
      where booking.branch_id = v_checkin.branch_id
        and booking.delivery_type = 'in_spa'
        and booking.status not in ('cancelled', 'no_show')
        and coalesce(booking.booking_progress_status, '') <> 'no_show'
        and booking.booking_date between v_business_date and v_business_date + 1
        and (
          (v_checkin.is_test and lower(coalesce(
            booking.metadata->>'isTest', booking.metadata->>'is_test',
            booking.metadata->>'test_mode', 'false'
          )) in ('true', '1', 'yes'))
          or (not v_checkin.is_test and lower(coalesce(
            booking.metadata->>'isTest', booking.metadata->>'is_test',
            booking.metadata->>'test_mode', 'false'
          )) not in ('true', '1', 'yes'))
        )
    ) as candidate
    where candidate.scheduled_start_at >= v_scope_start
      and candidate.scheduled_start_at < v_scope_end
    order by candidate.completion_at desc, candidate.id
    limit 1;

    v_source := case when v_source_booking_id is null then 'schedule' else 'crm_closing' end;
    v_buffer := case when v_source_booking_id is null then 0 else v_crm_buffer end;
  elsif v_category = 'drivers' then
    select candidate.id,
           candidate.id,
           candidate.completion_at,
           candidate.scheduled_start_at,
           candidate.delivery_type,
           candidate.booking_progress_status,
           candidate.status
    into v_source_booking_id, v_source_trip_id, v_source_completion,
         v_source_scheduled_start, v_source_delivery_type, v_source_progress, v_source_status
    from (
      select booking.id,
             booking.delivery_type,
             booking.booking_progress_status,
             booking.status,
             (booking.booking_date::text || ' ' || booking.start_time::text)::timestamp
               at time zone v_timezone as scheduled_start_at,
             coalesce(
               booking.completed_at,
               booking.session_completed_at,
               booking.session_due_at,
               (booking.booking_date::text || ' ' || booking.end_time::text)::timestamp
                 at time zone v_timezone
                 + case when booking.end_time <= booking.start_time then interval '1 day' else interval '0' end
             ) as completion_at
      from public.bookings as booking
      where booking.branch_id = v_checkin.branch_id
        and booking.driver_id = v_checkin.staff_id
        and booking.delivery_type = 'home_service'
        and booking.status not in ('cancelled', 'no_show')
        and coalesce(booking.booking_progress_status, '') <> 'no_show'
        and booking.booking_date between v_business_date and v_business_date + 1
        and (
          (v_checkin.is_test and lower(coalesce(
            booking.metadata->>'isTest', booking.metadata->>'is_test',
            booking.metadata->>'test_mode', 'false'
          )) in ('true', '1', 'yes'))
          or (not v_checkin.is_test and lower(coalesce(
            booking.metadata->>'isTest', booking.metadata->>'is_test',
            booking.metadata->>'test_mode', 'false'
          )) not in ('true', '1', 'yes'))
        )
    ) as candidate
    where candidate.scheduled_start_at >= v_scope_start
      and candidate.scheduled_start_at < v_scope_end
    order by candidate.completion_at desc, candidate.id
    limit 1;

    v_source := case when v_source_booking_id is null then 'schedule' else 'driver_trip' end;
    v_buffer := case when v_source_booking_id is null then 0 else v_driver_buffer end;
  elsif v_is_service_provider then
    select candidate.id,
           case when candidate.delivery_type = 'home_service' then candidate.id else null end,
           candidate.completion_at,
           candidate.scheduled_start_at,
           candidate.delivery_type,
           candidate.booking_progress_status,
           candidate.status
    into v_source_booking_id, v_source_dispatch_id, v_source_completion,
         v_source_scheduled_start, v_source_delivery_type, v_source_progress, v_source_status
    from (
      select booking.id,
             booking.delivery_type,
             booking.booking_progress_status,
             booking.status,
             (booking.booking_date::text || ' ' || booking.start_time::text)::timestamp
               at time zone v_timezone as scheduled_start_at,
             coalesce(
               booking.session_completed_at,
               booking.completed_at,
               booking.session_due_at,
               case when booking.session_started_at is not null then
                 booking.session_started_at + make_interval(
                   mins => coalesce(booking.session_duration_minutes_snapshot, service.duration_minutes, 60)
                 )
               end,
               (booking.booking_date::text || ' ' || booking.end_time::text)::timestamp
                 at time zone v_timezone
                 + case when booking.end_time <= booking.start_time then interval '1 day' else interval '0' end
             ) as completion_at
      from public.bookings as booking
      left join public.services as service on service.id = booking.service_id
      where booking.branch_id = v_checkin.branch_id
        and booking.staff_id = v_checkin.staff_id
        and booking.status not in ('cancelled', 'no_show')
        and coalesce(booking.booking_progress_status, '') <> 'no_show'
        and booking.booking_date between v_business_date and v_business_date + 1
        and (
          (v_checkin.is_test and lower(coalesce(
            booking.metadata->>'isTest', booking.metadata->>'is_test',
            booking.metadata->>'test_mode', 'false'
          )) in ('true', '1', 'yes'))
          or (not v_checkin.is_test and lower(coalesce(
            booking.metadata->>'isTest', booking.metadata->>'is_test',
            booking.metadata->>'test_mode', 'false'
          )) not in ('true', '1', 'yes'))
        )
    ) as candidate
    where candidate.scheduled_start_at >= v_scope_start
      and candidate.scheduled_start_at < v_scope_end
    order by candidate.completion_at desc, candidate.id
    limit 1;

    v_source := case
      when v_source_booking_id is null then 'schedule'
      when v_source_delivery_type = 'home_service' then 'home_service'
      else 'service_completion'
    end;
    v_buffer := case
      when v_source_booking_id is null then 0
      when v_source_delivery_type = 'home_service' then v_home_buffer
      else v_service_buffer
    end;
  end if;

  -- Active/upcoming checks mirror the selected strategy and contain no customer data.
  select coalesce(bool_or(candidate.is_active), false),
         coalesce(bool_or(candidate.is_upcoming), false),
         min(candidate.scheduled_start_at) filter (where candidate.is_upcoming)
  into v_has_active, v_has_upcoming, v_next_assignment_at
  from (
    select
      (booking.booking_date::text || ' ' || booking.start_time::text)::timestamp
        at time zone v_timezone as scheduled_start_at,
      (
        booking.status = 'in_progress'
        or booking.booking_progress_status in (
          'checked_in', 'travel_started', 'arrived', 'session_started'
        )
      ) and coalesce(booking.booking_progress_status, '') <> 'completed'
        and booking.session_completed_at is null
        and booking.completed_at is null as is_active,
      (
        (booking.booking_date::text || ' ' || booking.start_time::text)::timestamp
          at time zone v_timezone > v_now
        and booking.status in ('pending', 'pending_payment', 'pending_crm_confirmation', 'confirmed', 'in_progress')
        and coalesce(booking.booking_progress_status, 'not_started') not in ('completed', 'no_show')
      ) as is_upcoming
    from public.bookings as booking
    where booking.branch_id = v_checkin.branch_id
      and booking.status not in ('cancelled', 'no_show')
      and coalesce(booking.booking_progress_status, '') <> 'no_show'
      and booking.booking_date between v_business_date and v_business_date + 1
      and (
        (v_category = 'crm_front_desk'
          and lower(coalesce(v_checkin.shift_type, '')) = 'closing'
          and booking.delivery_type = 'in_spa')
        or (v_category = 'drivers'
          and booking.driver_id = v_checkin.staff_id
          and booking.delivery_type = 'home_service')
        or (v_category <> 'crm_front_desk'
          and v_category <> 'drivers'
          and v_is_service_provider
          and booking.staff_id = v_checkin.staff_id)
      )
      and (
        (v_checkin.is_test and lower(coalesce(
          booking.metadata->>'isTest', booking.metadata->>'is_test',
          booking.metadata->>'test_mode', 'false'
        )) in ('true', '1', 'yes'))
        or (not v_checkin.is_test and lower(coalesce(
          booking.metadata->>'isTest', booking.metadata->>'is_test',
          booking.metadata->>'test_mode', 'false'
        )) not in ('true', '1', 'yes'))
      )
  ) as candidate
  where candidate.scheduled_start_at >= v_scope_start
    and candidate.scheduled_start_at < v_scope_end;

  v_expected := v_schedule_end;
  if v_source_completion is not null and v_source <> 'schedule' then
    v_expected := v_source_completion + make_interval(mins => v_buffer);
    if v_source in ('service_completion', 'home_service')
       and v_expected < v_schedule_end
       and not v_final_release
       and lower(coalesce(v_checkin.shift_type, '')) <> 'closing' then
      v_expected := v_schedule_end;
    end if;
  end if;

  v_earliest := v_expected - make_interval(mins => v_early_tolerance);
  v_latest := v_expected + make_interval(mins => v_late_grace);
  v_safety_enabled := v_category = 'crm_front_desk'
    and lower(coalesce(v_checkin.shift_type, '')) = 'closing';
  if v_safety_enabled then
    v_reminder := v_latest;
    v_escalation := v_latest + make_interval(mins => v_escalation_delay);
    v_hard := v_latest + make_interval(mins => v_hard_delay);
    v_provisional := v_latest;
  end if;

  if v_checkin.status <> 'checked_in' or v_checkin.checked_out_at is not null then
    v_portal_reason := 'already_clocked_out';
  elsif v_has_active then
    v_portal_reason := 'active_assignment';
  elsif v_has_upcoming then
    v_portal_reason := 'upcoming_assignment';
  elsif v_category = 'drivers'
     and v_source = 'driver_trip'
     and v_source_status = 'completed'
     and v_source_progress = 'completed'
     and v_source_completion is not null then
    v_portal_eligible := true;
    v_portal_reason := 'final_trip_complete';
    v_portal_method := 'driver_portal_final_trip';
  elsif v_category = 'therapists'
     and v_source = 'home_service'
     and v_source_status = 'completed'
     and v_source_progress = 'completed'
     and v_source_completion is not null then
    v_portal_eligible := true;
    v_portal_reason := 'final_home_service_complete';
    v_portal_method := 'staff_portal_home_service';
  elsif lower(coalesce(v_checkin.shift_type, '')) = 'closing'
     and v_category in ('crm_front_desk', 'therapists')
     and v_portal_closing_enabled
     and v_now >= v_earliest then
    v_portal_eligible := true;
    v_portal_reason := 'eligible_closing_shift';
    v_portal_method := 'staff_portal_closing_shift';
  elsif lower(coalesce(v_checkin.shift_type, '')) = 'closing'
     and v_category in ('crm_front_desk', 'therapists')
     and v_portal_closing_enabled then
    v_portal_reason := 'closing_duties_remain';
  else
    v_portal_reason := 'use_branch_qr';
  end if;

  v_candidate_snapshot := jsonb_build_object(
    'kind', v_source,
    'staffCategory', v_category,
    'branchRuleVersionId', v_rule_version.id,
    'categoryRuleId', v_rule.id,
    'timezone', v_timezone,
    'attendanceDayBoundary', v_boundary,
    'attendanceBusinessDate', v_business_date,
    'rawScheduledStartAt', v_checkin.scheduled_start_at,
    'rawScheduledEndAt', v_checkin.scheduled_end_at,
    'resolvedScheduleEndAt', v_schedule_end,
    'managerOverrideId', v_override_id,
    'expectedEndAt', v_expected,
    'earliestNormalClockOutAt', v_earliest,
    'latestNormalClockOutAt', v_latest,
    'reminderAt', v_reminder,
    'managerEscalationAt', v_escalation,
    'hardCutoffAt', v_hard,
    'provisionalClockOutAt', v_provisional,
    'sourceBookingId', v_source_booking_id,
    'sourceDispatchId', v_source_dispatch_id,
    'sourceTripId', v_source_trip_id,
    'sourceCompletionAt', v_source_completion,
    'sourceScheduledStartAt', v_source_scheduled_start,
    'appliedBufferMinutes', v_buffer,
    'lateGraceMinutes', v_late_grace,
    'earlyLeaveThresholdMinutes', v_early_tolerance,
    'activeServiceBlocksClockOut', true,
    'hasActiveAssignment', v_has_active,
    'hasUpcomingAssignment', v_has_upcoming,
    'nextAssignmentAt', v_next_assignment_at,
    'portalClockOutEligible', v_portal_eligible,
    'portalEligibilityReason', v_portal_reason,
    'portalClockOutMethod', v_portal_method,
    'safetyProcessingEnabled', v_safety_enabled
  );

  v_changed :=
    v_checkin.attendance_expected_end_at is distinct from v_expected
    or v_checkin.earliest_normal_clock_out_at is distinct from v_earliest
    or v_checkin.latest_normal_clock_out_at is distinct from v_latest
    or v_checkin.clock_out_reminder_at is distinct from v_reminder
    or v_checkin.manager_escalation_at is distinct from v_escalation
    or v_checkin.hard_cutoff_at is distinct from v_hard
    or v_checkin.provisional_clock_out_at is distinct from v_provisional
    or v_checkin.attendance_policy_source is distinct from v_source
    or (coalesce(v_checkin.attendance_policy_snapshot, '{}'::jsonb) - 'calculatedAt')
       is distinct from v_candidate_snapshot;

  if v_changed and v_checkin.status = 'checked_in' and v_checkin.checked_out_at is null then
    v_snapshot := v_candidate_snapshot || jsonb_build_object('calculatedAt', v_now);
    update public.staff_shift_checkins
    set attendance_expected_end_at = v_expected,
        earliest_normal_clock_out_at = v_earliest,
        latest_normal_clock_out_at = v_latest,
        clock_out_reminder_at = v_reminder,
        manager_escalation_at = v_escalation,
        hard_cutoff_at = v_hard,
        provisional_clock_out_at = v_provisional,
        attendance_policy_source = v_source,
        attendance_policy_snapshot = v_snapshot,
        updated_at = v_now
    where id = v_checkin.id
      and status = 'checked_in'
      and checked_out_at is null;
  else
    v_snapshot := coalesce(v_checkin.attendance_policy_snapshot, '{}'::jsonb);
  end if;

  return jsonb_build_object(
    'checkin_id', v_checkin.id,
    'scheduled_end_at', v_schedule_end,
    'attendance_expected_end_at', v_expected,
    'earliest_normal_clock_out_at', v_earliest,
    'latest_normal_clock_out_at', v_latest,
    'clock_out_reminder_at', v_reminder,
    'manager_escalation_at', v_escalation,
    'hard_cutoff_at', v_hard,
    'provisional_clock_out_at', v_provisional,
    'attendance_policy_source', v_source,
    'attendance_policy_snapshot', v_snapshot,
    'has_active_assignment', v_has_active,
    'has_upcoming_assignment', v_has_upcoming,
    'next_assignment_at', v_next_assignment_at,
    'portal_clock_out_eligible', v_portal_eligible,
    'portal_eligibility_reason', v_portal_reason,
    'portal_clock_out_method', v_portal_method,
    'changed', v_changed
  );
end;
$$;

revoke all on function public.resolve_attendance_staff_category(public.staff)
  from public, anon, authenticated, service_role;
revoke all on function public.recalculate_attendance_clock_out_policy(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.recalculate_attendance_clock_out_policy(uuid, timestamptz)
  to service_role;

comment on function public.recalculate_attendance_clock_out_policy(uuid, timestamptz) is
  'Authoritative schedule-backed dynamic expected clock-out resolver. Service-role only.';

-- Preserve the effective-dated category save RPC while accepting the new
-- dynamic buffer/release settings through its existing JSON input.
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
     or p_staff_category not in (
       'crm_front_desk', 'therapists', 'salon', 'drivers', 'utility', 'managers', 'other'
     ) then
    return query select false, 'invalid_request',
      'Branch, category, effective time, and reason are required.', null::uuid;
    return;
  end if;

  if nullif(p_rule_values->>'service_cleanup_buffer_minutes', '')::integer not between 0 and 240
     or nullif(p_rule_values->>'home_service_wrap_up_buffer_minutes', '')::integer not between 0 and 240
     or nullif(p_rule_values->>'driver_return_buffer_minutes', '')::integer not between 0 and 360 then
    return query select false, 'invalid_dynamic_buffer',
      'Dynamic clock-out buffers are outside the allowed range.', null::uuid;
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
    service_cleanup_buffer_minutes, home_service_wrap_up_buffer_minutes,
    driver_return_buffer_minutes, final_client_release_enabled,
    portal_closing_shift_enabled,
    reason, changed_by, previous_values
  ) values (
    p_branch_id, p_staff_category, p_effective_from, v_next_effective,
    nullif(p_rule_values->>'late_grace_minutes', '')::integer,
    nullif(p_rule_values->>'early_leave_threshold_minutes', '')::integer,
    nullif(p_rule_values->>'overtime_threshold_minutes', '')::integer,
    nullif(p_rule_values->>'active_service_blocks_clock_out', '')::boolean,
    nullif(p_rule_values->>'crm_closing_policy_enabled', '')::boolean,
    nullif(p_rule_values->>'service_cleanup_buffer_minutes', '')::integer,
    nullif(p_rule_values->>'home_service_wrap_up_buffer_minutes', '')::integer,
    nullif(p_rule_values->>'driver_return_buffer_minutes', '')::integer,
    nullif(p_rule_values->>'final_client_release_enabled', '')::boolean,
    nullif(p_rule_values->>'portal_closing_shift_enabled', '')::boolean,
    v_reason, p_actor_staff_id, coalesce(v_previous, '{}'::jsonb)
  ) returning id into v_id;

  return query select true, 'saved', 'Category override saved.', v_id;
exception
  when unique_violation then
    return query select false, 'effective_time_conflict',
      'A category rule already starts at that effective time.', null::uuid;
  when invalid_text_representation then
    return query select false, 'invalid_dynamic_rule',
      'One or more dynamic category values are invalid.', null::uuid;
end;
$$;

revoke all on function public.save_attendance_category_rule(
  uuid, uuid, text, timestamptz, jsonb, text
) from public, anon, authenticated;
grant execute on function public.save_attendance_category_rule(
  uuid, uuid, text, timestamptz, jsonb, text
) to service_role;

create or replace function public.recalculate_attendance_after_checkin_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.recalculate_attendance_clock_out_policy(new.id, coalesce(new.checked_in_at, now()));
  return null;
end;
$$;

drop trigger if exists staff_shift_checkins_dynamic_policy_after_insert
  on public.staff_shift_checkins;
create trigger staff_shift_checkins_dynamic_policy_after_insert
  after insert on public.staff_shift_checkins
  for each row execute function public.recalculate_attendance_after_checkin_insert();

create or replace function public.recalculate_attendance_after_booking_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_old_staff uuid := case when tg_op = 'INSERT' then null else old.staff_id end;
  v_new_staff uuid := case when tg_op = 'DELETE' then null else new.staff_id end;
  v_old_driver uuid := case when tg_op = 'INSERT' then null else old.driver_id end;
  v_new_driver uuid := case when tg_op = 'DELETE' then null else new.driver_id end;
  v_old_branch uuid := case when tg_op = 'INSERT' then null else old.branch_id end;
  v_new_branch uuid := case when tg_op = 'DELETE' then null else new.branch_id end;
  v_old_date date := case when tg_op = 'INSERT' then null else old.booking_date end;
  v_new_date date := case when tg_op = 'DELETE' then null else new.booking_date end;
  v_checkin record;
begin
  if tg_op = 'UPDATE'
     and row(
       old.branch_id, old.staff_id, old.driver_id, old.booking_date,
       old.start_time, old.end_time, old.delivery_type, old.status,
       old.booking_progress_status, old.session_started_at, old.session_due_at,
       old.session_completed_at, old.session_duration_minutes_snapshot,
       old.session_extended_at, old.completed_at, old.metadata
     ) is not distinct from row(
       new.branch_id, new.staff_id, new.driver_id, new.booking_date,
       new.start_time, new.end_time, new.delivery_type, new.status,
       new.booking_progress_status, new.session_started_at, new.session_due_at,
       new.session_completed_at, new.session_duration_minutes_snapshot,
       new.session_extended_at, new.completed_at, new.metadata
     ) then
    return null;
  end if;

  for v_checkin in
    select distinct checkin.id
    from public.staff_shift_checkins as checkin
    join public.staff as staff on staff.id = checkin.staff_id
    where checkin.status = 'checked_in'
      and checkin.checked_out_at is null
      and coalesce(checkin.attendance_business_date, checkin.shift_date)
        between least(coalesce(v_old_date, v_new_date), coalesce(v_new_date, v_old_date)) - 1
            and greatest(coalesce(v_old_date, v_new_date), coalesce(v_new_date, v_old_date))
      and (
        checkin.staff_id in (
          coalesce(v_old_staff, '00000000-0000-0000-0000-000000000000'::uuid),
          coalesce(v_new_staff, '00000000-0000-0000-0000-000000000000'::uuid),
          coalesce(v_old_driver, '00000000-0000-0000-0000-000000000000'::uuid),
          coalesce(v_new_driver, '00000000-0000-0000-0000-000000000000'::uuid)
        )
        or (
          checkin.branch_id in (
            coalesce(v_old_branch, '00000000-0000-0000-0000-000000000000'::uuid),
            coalesce(v_new_branch, '00000000-0000-0000-0000-000000000000'::uuid)
          )
          and lower(coalesce(checkin.shift_type, '')) = 'closing'
          and public.resolve_attendance_staff_category(staff) = 'crm_front_desk'
        )
      )
  loop
    perform public.recalculate_attendance_clock_out_policy(v_checkin.id, now());
  end loop;
  return null;
end;
$$;

drop trigger if exists bookings_recalculate_attendance_clock_out on public.bookings;
create trigger bookings_recalculate_attendance_clock_out
  after insert or update or delete on public.bookings
  for each row execute function public.recalculate_attendance_after_booking_event();

create or replace function public.recalculate_attendance_after_schedule_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_old_staff uuid := case when tg_op = 'INSERT' then null else old.staff_id end;
  v_new_staff uuid := case when tg_op = 'DELETE' then null else new.staff_id end;
  v_checkin record;
begin
  for v_checkin in
    select checkin.id
    from public.staff_shift_checkins as checkin
    where checkin.status = 'checked_in'
      and checkin.checked_out_at is null
      and checkin.staff_id in (
        coalesce(v_old_staff, '00000000-0000-0000-0000-000000000000'::uuid),
        coalesce(v_new_staff, '00000000-0000-0000-0000-000000000000'::uuid)
      )
  loop
    perform public.recalculate_attendance_clock_out_policy(v_checkin.id, now());
  end loop;
  return null;
end;
$$;

drop trigger if exists schedule_overrides_recalculate_attendance_clock_out
  on public.schedule_overrides;
create trigger schedule_overrides_recalculate_attendance_clock_out
  after insert or update or delete on public.schedule_overrides
  for each row execute function public.recalculate_attendance_after_schedule_event();

drop trigger if exists staff_schedules_recalculate_attendance_clock_out
  on public.staff_schedules;
create trigger staff_schedules_recalculate_attendance_clock_out
  after insert or update or delete on public.staff_schedules
  for each row execute function public.recalculate_attendance_after_schedule_event();

revoke all on function public.recalculate_attendance_after_checkin_insert()
  from public, anon, authenticated, service_role;
revoke all on function public.recalculate_attendance_after_booking_event()
  from public, anon, authenticated, service_role;
revoke all on function public.recalculate_attendance_after_schedule_event()
  from public, anon, authenticated, service_role;

create or replace function public.write_attendance_portal_audit(
  p_branch_id uuid,
  p_staff_id uuid,
  p_device_id uuid,
  p_checkin_id uuid,
  p_request_id text,
  p_outcome text,
  p_reason_code text,
  p_message text,
  p_result jsonb,
  p_is_test boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_event_id uuid := gen_random_uuid();
  v_result jsonb := coalesce(p_result, '{}'::jsonb)
    || jsonb_build_object('scan_event_id', v_event_id);
begin
  insert into public.qr_scan_events (
    id, branch_id, qr_point_id, staff_id, device_id, checkin_id,
    scan_type, action, outcome, reason_code, message, request_id,
    metadata, operation_id, operation_result, operation_result_recorded_at, is_test
  ) values (
    v_event_id, p_branch_id, null, p_staff_id, p_device_id, p_checkin_id,
    'attendance', 'portal_clock_out', p_outcome, p_reason_code, p_message,
    p_request_id, jsonb_build_object(
      'channel', 'staff_portal',
      'safeReasonCode', p_reason_code,
      'isTest', coalesce(p_is_test, false)
    ), p_request_id, v_result, now(), coalesce(p_is_test, false)
  );
  return v_result;
end;
$$;

revoke all on function public.write_attendance_portal_audit(
  uuid, uuid, uuid, uuid, text, text, text, text, jsonb, boolean
) from public, anon, authenticated, service_role;

create or replace function public.commit_attendance_portal_clock_out(
  p_auth_user_id uuid,
  p_device_fingerprint_hash text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_now timestamptz := now();
  v_staff public.staff%rowtype;
  v_device public.staff_devices%rowtype;
  v_checkin public.staff_shift_checkins%rowtype;
  v_settings public.attendance_settings%rowtype;
  v_policy jsonb;
  v_existing jsonb;
  v_result jsonb;
  v_event_id uuid;
  v_open_count integer := 0;
  v_method text;
  v_reason text;
  v_eligible boolean := false;
  v_earliest timestamptz;
  v_latest timestamptz;
  v_expected timestamptz;
  v_early_minutes integer := 0;
  v_overtime_minutes integer := 0;
  v_worked_minutes integer := 0;
  v_classification text := 'normal';
  v_attendance_status text;
  v_exception_type text;
  v_exception_message text;
  v_dedupe_key text;
  v_nickname text;
  v_local_time text;
begin
  if p_auth_user_id is null
     or nullif(trim(coalesce(p_device_fingerprint_hash, '')), '') is null
     or nullif(trim(coalesce(p_request_id, '')), '') is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_request',
      'title', 'Clock-out unavailable',
      'message', 'Sign in again and retry from your registered device.'
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtext('attendance_scan_request'), hashtext(p_request_id)
  );
  select event.operation_result into v_existing
  from public.qr_scan_events as event
  where event.request_id = p_request_id
    and event.operation_result is not null
  order by event.created_at
  limit 1;
  if v_existing is not null then
    return v_existing || jsonb_build_object('replayed', true);
  end if;

  select staff.* into v_staff
  from public.staff as staff
  where staff.auth_user_id = p_auth_user_id
    and staff.is_active = true
    and staff.archived_at is null
    and staff.merged_into_staff_id is null
  limit 1
  for update;

  if v_staff.id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'unauthorized',
      'title', 'Clock-out unavailable',
      'message', 'Your active staff profile could not be verified.'
    );
  end if;

  select settings.* into v_settings
  from public.attendance_settings as settings
  where settings.branch_id = v_staff.branch_id;

  select count(*)::integer into v_open_count
  from public.staff_shift_checkins as checkin
  where checkin.staff_id = v_staff.id
    and checkin.status = 'checked_in'
    and checkin.checked_out_at is null
    and checkin.is_test = coalesce(v_settings.test_mode_enabled, false);

  select checkin.* into v_checkin
  from public.staff_shift_checkins as checkin
  where checkin.staff_id = v_staff.id
    and checkin.status = 'checked_in'
    and checkin.checked_out_at is null
    and checkin.is_test = coalesce(v_settings.test_mode_enabled, false)
  order by checkin.checked_in_at desc
  limit 1
  for update;

  if v_open_count <> 1 or v_checkin.id is null then
    v_reason := case when v_open_count > 1 then 'conflicting_open_attendance' else 'no_open_attendance' end;
    v_result := jsonb_build_object(
      'ok', false,
      'code', v_reason,
      'title', case when v_open_count > 1 then 'Attendance needs CRM review' else 'No open shift' end,
      'message', case
        when v_open_count > 1 then 'Ask CRM to resolve the open Attendance records before clocking out.'
        else 'There is no open Attendance shift to clock out.'
      end
    );
    return public.write_attendance_portal_audit(
      v_staff.branch_id, v_staff.id, null, null, p_request_id,
      'blocked', v_reason, 'Portal clock-out was rejected.', v_result,
      coalesce(v_settings.test_mode_enabled, false)
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtext('attendance_scan_staff'),
    hashtext(concat_ws(
      ':', v_checkin.branch_id::text, v_staff.id::text, v_checkin.is_test::text
    ))
  );

  -- Recheck after taking the same final staff lock used by branch QR.
  select checkin.* into v_checkin
  from public.staff_shift_checkins as checkin
  where checkin.id = v_checkin.id
    and checkin.staff_id = v_staff.id
    and checkin.status = 'checked_in'
    and checkin.checked_out_at is null
  for update;
  if v_checkin.id is null then
    v_result := jsonb_build_object(
      'ok', false,
      'code', 'already_clocked_out',
      'title', 'Already clocked out',
      'message', 'This Attendance shift is already complete.'
    );
    return public.write_attendance_portal_audit(
      v_staff.branch_id, v_staff.id, null, null, p_request_id,
      'noop', 'already_clocked_out', 'Portal clock-out was already complete.',
      v_result, coalesce(v_settings.test_mode_enabled, false)
    );
  end if;

  select device.* into v_device
  from public.staff_devices as device
  where device.device_fingerprint_hash = p_device_fingerprint_hash
    and device.staff_id = v_staff.id
    and device.branch_id = v_checkin.branch_id
    and device.status = 'active'
    and device.trusted_after <= v_now
    and device.revoked_at is null
  limit 1
  for update;

  if v_device.id is null then
    v_result := jsonb_build_object(
      'ok', false,
      'code', 'unregistered_device',
      'title', 'Registered device required',
      'message', 'Use your registered Attendance device or ask CRM for help.'
    );
    return public.write_attendance_portal_audit(
      v_checkin.branch_id, v_staff.id, null, v_checkin.id, p_request_id,
      'blocked', 'unregistered_device', 'Portal clock-out requires a registered device.',
      v_result, v_checkin.is_test
    );
  end if;

  v_policy := public.recalculate_attendance_clock_out_policy(v_checkin.id, v_now);
  v_eligible := coalesce((v_policy->>'portal_clock_out_eligible')::boolean, false);
  v_reason := coalesce(v_policy->>'portal_eligibility_reason', 'use_branch_qr');
  v_method := nullif(v_policy->>'portal_clock_out_method', '');

  if not v_eligible or v_method is null then
    v_result := jsonb_build_object(
      'ok', false,
      'code', v_reason,
      'title', case
        when v_reason = 'active_assignment' then 'Complete your current assignment'
        when v_reason = 'upcoming_assignment' then 'Another assignment is still scheduled'
        when v_reason = 'closing_duties_remain' then 'Closing duties remain'
        else 'Use the branch QR'
      end,
      'message', case
        when v_reason = 'active_assignment' then 'Complete the active service or dispatch before clocking out.'
        when v_reason = 'upcoming_assignment' then 'You can clock out after completing your final service.'
        when v_reason = 'closing_duties_remain' then 'Clock-out becomes available after the closing completion window.'
        else 'Branch QR remains the normal clock-out method for this shift.'
      end,
      'next_assignment_at', v_policy->'next_assignment_at',
      'expected_clock_out_at', v_policy->'attendance_expected_end_at'
    );
    return public.write_attendance_portal_audit(
      v_checkin.branch_id, v_staff.id, v_device.id, v_checkin.id, p_request_id,
      'blocked', v_reason, 'Portal clock-out was not eligible.', v_result, v_checkin.is_test
    );
  end if;

  v_expected := nullif(v_policy->>'attendance_expected_end_at', '')::timestamptz;
  v_earliest := nullif(v_policy->>'earliest_normal_clock_out_at', '')::timestamptz;
  v_latest := nullif(v_policy->>'latest_normal_clock_out_at', '')::timestamptz;
  v_worked_minutes := greatest(
    0, round(extract(epoch from (v_now - v_checkin.checked_in_at)) / 60.0)::integer
  );
  if v_earliest is not null and v_now < v_earliest then
    v_classification := 'early';
    v_early_minutes := round(extract(epoch from (v_earliest - v_now)) / 60.0)::integer;
  elsif v_latest is not null and v_now > v_latest then
    v_classification := 'overtime';
    v_overtime_minutes := round(extract(epoch from (v_now - v_latest)) / 60.0)::integer;
  end if;

  v_attendance_status := case
    when v_checkin.late_minutes > 0 then 'late'
    when v_classification = 'early' then 'early_leave'
    when v_classification = 'overtime' then 'overtime'
    else 'present'
  end;
  v_nickname := coalesce(nullif(v_staff.nickname, ''), split_part(v_staff.full_name, ' ', 1), 'there');
  v_local_time := to_char(
    v_now at time zone coalesce(v_checkin.branch_timezone, v_settings.timezone, 'Asia/Manila'),
    'FMHH12:MI AM'
  );

  update public.staff_shift_checkins
  set checked_out_at = v_now,
      status = 'checked_out',
      clock_out_method = v_method,
      worked_minutes = v_worked_minutes,
      early_leave_minutes = v_early_minutes,
      overtime_minutes = v_overtime_minutes,
      attendance_status = v_attendance_status,
      exception_state = case when v_classification = 'normal' then exception_state else 'open' end,
      attendance_policy_snapshot = attendance_policy_snapshot || jsonb_build_object(
        'clockOutMethod', v_method,
        'portalEligibilityReason', v_reason,
        'actualClockOutAt', v_now,
        'classification', v_classification
      ),
      updated_at = v_now
  where id = v_checkin.id
    and status = 'checked_in'
    and checked_out_at is null;

  if not found then
    raise exception using errcode = '40001', message = 'Attendance was completed concurrently.';
  end if;

  v_result := jsonb_build_object(
    'ok', true,
    'code', 'clocked_out',
    'title', case
      when v_classification = 'early' then 'Clocked out · For review'
      when v_classification = 'overtime' then 'Clocked out · Overtime recorded'
      else format('All done, %s', v_nickname)
    end,
    'message', case
      when v_classification = 'early' then 'Your clock-out was earlier than the expected completion window.'
      when v_classification = 'overtime' then 'Your final work completed later than expected.'
      when v_method = 'staff_portal_home_service' then
        format('Your home-service shift ended at %s.', v_local_time)
      else format('Your shift ended at %s.', v_local_time)
    end,
    'classification', v_classification,
    'checkin_id', v_checkin.id,
    'clock_out_method', v_method,
    'checked_out_at', v_now,
    'expected_clock_out_at', v_expected,
    'early_leave_minutes', v_early_minutes,
    'overtime_minutes', v_overtime_minutes,
    'is_test', v_checkin.is_test
  );
  v_result := public.write_attendance_portal_audit(
    v_checkin.branch_id, v_staff.id, v_device.id, v_checkin.id, p_request_id,
    'success', v_classification, 'Portal clock-out recorded.', v_result, v_checkin.is_test
  );
  v_event_id := (v_result->>'scan_event_id')::uuid;

  update public.staff_shift_checkins
  set clock_out_scan_event_id = v_event_id
  where id = v_checkin.id;
  update public.staff_devices
  set last_seen_at = v_now,
      updated_at = v_now
  where id = v_device.id;

  if v_classification <> 'normal' then
    v_exception_type := case when v_classification = 'early' then 'early_leave' else 'overtime' end;
    v_exception_message := case
      when v_classification = 'early' then
        format('%s clocked out %s minutes before the dynamic completion window.', v_staff.full_name, v_early_minutes)
      else format('%s clocked out %s minutes after the dynamic completion window.', v_staff.full_name, v_overtime_minutes)
    end;
    v_dedupe_key := concat_ws(
      '|', v_staff.id, v_checkin.id, v_exception_type,
      case when v_checkin.is_test then 'test' else 'live' end
    );
    insert into public.attendance_exceptions (
      branch_id, staff_id, checkin_id, scan_event_id, latest_scan_event_id,
      exception_type, severity, message, metadata, dedupe_key,
      recommended_action, priority, related_checkin_ids, is_test
    ) values (
      v_checkin.branch_id, v_staff.id, v_checkin.id, v_event_id, v_event_id,
      v_exception_type, 'warning', v_exception_message,
      jsonb_build_object(
        'internalExceptionType', v_exception_type || '_portal_clock_out',
        'clockOutMethod', v_method,
        'classification', v_classification,
        'expectedClockOutAt', v_expected,
        'actualClockOutAt', v_now,
        'policySnapshot', v_policy->'attendance_policy_snapshot'
      ),
      v_dedupe_key, 'review_clock_out', 'normal', array[v_checkin.id], v_checkin.is_test
    ) on conflict do nothing;
  end if;

  return v_result;
end;
$$;

revoke all on function public.commit_attendance_portal_clock_out(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.commit_attendance_portal_clock_out(uuid, text, text)
  to service_role;

comment on function public.commit_attendance_portal_clock_out(uuid, text, text) is
  'Server-only authenticated/device-bound portal clock-out. Client identity, branch, timing, and eligibility are ignored and resolved in-database.';

-- Serialize assignment mutations with the same per-staff Attendance lock used
-- by QR and portal commits. This closes the final-assignment race without a
-- global booking lock or polling.
create or replace function public.lock_attendance_for_booking_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_old_staff uuid := case when tg_op = 'INSERT' then null else old.staff_id end;
  v_new_staff uuid := case when tg_op = 'DELETE' then null else new.staff_id end;
  v_old_driver uuid := case when tg_op = 'INSERT' then null else old.driver_id end;
  v_new_driver uuid := case when tg_op = 'DELETE' then null else new.driver_id end;
  v_old_branch uuid := case when tg_op = 'INSERT' then null else old.branch_id end;
  v_new_branch uuid := case when tg_op = 'DELETE' then null else new.branch_id end;
  v_checkin record;
begin
  for v_checkin in
    select distinct checkin.branch_id, checkin.staff_id, checkin.is_test
    from public.staff_shift_checkins as checkin
    join public.staff as staff on staff.id = checkin.staff_id
    where checkin.status = 'checked_in'
      and checkin.checked_out_at is null
      and (
        checkin.staff_id in (
          coalesce(v_old_staff, '00000000-0000-0000-0000-000000000000'::uuid),
          coalesce(v_new_staff, '00000000-0000-0000-0000-000000000000'::uuid),
          coalesce(v_old_driver, '00000000-0000-0000-0000-000000000000'::uuid),
          coalesce(v_new_driver, '00000000-0000-0000-0000-000000000000'::uuid)
        )
        or (
          checkin.branch_id in (
            coalesce(v_old_branch, '00000000-0000-0000-0000-000000000000'::uuid),
            coalesce(v_new_branch, '00000000-0000-0000-0000-000000000000'::uuid)
          )
          and lower(coalesce(checkin.shift_type, '')) = 'closing'
          and public.resolve_attendance_staff_category(staff) = 'crm_front_desk'
        )
      )
    order by checkin.branch_id, checkin.staff_id, checkin.is_test
  loop
    perform pg_advisory_xact_lock(
      hashtext('attendance_scan_staff'),
      hashtext(concat_ws(
        ':', v_checkin.branch_id::text, v_checkin.staff_id::text, v_checkin.is_test::text
      ))
    );
  end loop;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_lock_attendance_clock_out on public.bookings;
create trigger bookings_lock_attendance_clock_out
  before insert or update or delete on public.bookings
  for each row execute function public.lock_attendance_for_booking_mutation();

create or replace function public.lock_attendance_for_schedule_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_old_staff uuid := case when tg_op = 'INSERT' then null else old.staff_id end;
  v_new_staff uuid := case when tg_op = 'DELETE' then null else new.staff_id end;
  v_checkin record;
begin
  for v_checkin in
    select checkin.branch_id, checkin.staff_id, checkin.is_test
    from public.staff_shift_checkins as checkin
    where checkin.status = 'checked_in'
      and checkin.checked_out_at is null
      and checkin.staff_id in (
        coalesce(v_old_staff, '00000000-0000-0000-0000-000000000000'::uuid),
        coalesce(v_new_staff, '00000000-0000-0000-0000-000000000000'::uuid)
      )
    order by checkin.branch_id, checkin.staff_id, checkin.is_test
  loop
    perform pg_advisory_xact_lock(
      hashtext('attendance_scan_staff'),
      hashtext(concat_ws(
        ':', v_checkin.branch_id::text, v_checkin.staff_id::text, v_checkin.is_test::text
      ))
    );
  end loop;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists schedule_overrides_lock_attendance_clock_out
  on public.schedule_overrides;
create trigger schedule_overrides_lock_attendance_clock_out
  before insert or update or delete on public.schedule_overrides
  for each row execute function public.lock_attendance_for_schedule_mutation();

drop trigger if exists staff_schedules_lock_attendance_clock_out
  on public.staff_schedules;
create trigger staff_schedules_lock_attendance_clock_out
  before insert or update or delete on public.staff_schedules
  for each row execute function public.lock_attendance_for_schedule_mutation();

create or replace function public.recalculate_attendance_after_policy_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_branch_id uuid := case
    when tg_op = 'DELETE' then old.branch_id
    else new.branch_id
  end;
  v_category text := case
    when tg_table_name = 'attendance_staff_category_rules' and tg_op = 'DELETE'
      then to_jsonb(old)->>'staff_category'
    when tg_table_name = 'attendance_staff_category_rules'
      then to_jsonb(new)->>'staff_category'
    else null
  end;
  v_checkin record;
begin
  for v_checkin in
    select checkin.id
    from public.staff_shift_checkins as checkin
    join public.staff as staff on staff.id = checkin.staff_id
    where checkin.branch_id = v_branch_id
      and checkin.status = 'checked_in'
      and checkin.checked_out_at is null
      and (v_category is null or public.resolve_attendance_staff_category(staff) = v_category)
  loop
    perform public.recalculate_attendance_clock_out_policy(v_checkin.id, now());
  end loop;
  return null;
end;
$$;

drop trigger if exists attendance_category_rules_recalculate_open_attendance
  on public.attendance_staff_category_rules;
create trigger attendance_category_rules_recalculate_open_attendance
  after insert or update or delete on public.attendance_staff_category_rules
  for each row execute function public.recalculate_attendance_after_policy_event();

drop trigger if exists attendance_rule_versions_recalculate_open_attendance
  on public.attendance_rule_versions;
create trigger attendance_rule_versions_recalculate_open_attendance
  after insert or update or delete on public.attendance_rule_versions
  for each row execute function public.recalculate_attendance_after_policy_event();

revoke all on function public.lock_attendance_for_booking_mutation()
  from public, anon, authenticated, service_role;
revoke all on function public.lock_attendance_for_schedule_mutation()
  from public, anon, authenticated, service_role;
revoke all on function public.recalculate_attendance_after_policy_event()
  from public, anon, authenticated, service_role;
