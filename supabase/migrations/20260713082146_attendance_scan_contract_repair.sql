-- CRADLE-ATTENDANCE-DIAGNOSTICS-AND-SCAN-REPAIR-009
-- Align the attendance scan persistence contract with the individual schedule
-- resolver. Keep Recovery exception types constrained to stable database values;
-- application code stores detailed internal scan codes in exception metadata.

alter table public.schedule_overrides
  add column if not exists ends_next_day boolean not null default false;

alter table public.schedule_overrides
  drop constraint if exists schedule_overrides_time_check;

alter table public.schedule_overrides
  add constraint schedule_overrides_time_check
  check (
    is_day_off = true
    or (
      start_time is not null
      and end_time is not null
      and start_time <> end_time
      and (
        (ends_next_day = false and end_time > start_time)
        or (ends_next_day = true and end_time < start_time)
      )
    )
  );

comment on column public.schedule_overrides.ends_next_day is
  'Authoritative marker that a date-specific override window crosses midnight.';

alter table public.staff_shift_checkins
  drop constraint if exists staff_shift_checkins_schedule_source_check;

update public.staff_shift_checkins
set schedule_source = case schedule_source
  when 'weekly_schedule' then 'weekly'
  when 'manual_authorized_shift' then 'recovery'
  when 'temporary_branch_assignment' then 'none'
  else schedule_source
end
where schedule_source in (
  'weekly_schedule',
  'manual_authorized_shift',
  'temporary_branch_assignment'
);

alter table public.staff_shift_checkins
  add constraint staff_shift_checkins_schedule_source_check
  check (
    schedule_source is null
    or schedule_source in ('weekly', 'override', 'recovery', 'none')
  );

comment on column public.staff_shift_checkins.schedule_source is
  'Attendance schedule evidence source: weekly, override, recovery, or none.';
