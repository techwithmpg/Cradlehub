-- LOCAL ONLY: accepted function definitions from 20260713035024_schedule_update_integration_repair.sql.

-- Only staff_is_operational composite-field dereferences change p_staff.field to (p_staff).field.

-- The complete validator and schedule trigger are verbatim accepted source. Not a migration.

create or replace function public.staff_metadata_flag(
  p_metadata jsonb,
  p_key text,
  p_default boolean
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case lower(coalesce(p_metadata ->> p_key, p_default::text))
    when 'true' then true
    when 't' then true
    when '1' then true
    when 'yes' then true
    when 'y' then true
    when 'false' then false
    when 'f' then false
    when '0' then false
    when 'no' then false
    when 'n' then false
    else p_default
  end
$$;

create or replace function public.staff_is_operational(p_staff public.staff)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    (p_staff).is_active = true
    and (p_staff).archived_at is null
    and (p_staff).merged_into_staff_id is null
    and public.staff_metadata_flag((p_staff).metadata, 'is_test', false) = false
    and public.staff_metadata_flag((p_staff).metadata, 'test', false) = false
    and public.staff_metadata_flag((p_staff).metadata, 'is_schedulable', true) = true
    and public.staff_metadata_flag((p_staff).metadata, 'schedulable', true) = true
    and public.staff_metadata_flag((p_staff).metadata, 'non_schedulable', false) = false
$$;

create or replace function public.schedule_time_start_min(p_time time)
returns integer
language sql
immutable
set search_path = public
as $$
  select extract(hour from p_time)::integer * 60 + extract(minute from p_time)::integer
$$;

create or replace function public.schedule_explicit_time_end_min(
  p_start time,
  p_end time,
  p_ends_next_day boolean
)
returns integer
language sql
immutable
set search_path = public
as $$
  select public.schedule_time_start_min(p_end)
    + case when p_ends_next_day is true then 1440 else 0 end
$$;

create or replace function public.schedule_explicit_time_ranges_overlap(
  p_first_start time,
  p_first_end time,
  p_first_ends_next_day boolean,
  p_second_start time,
  p_second_end time,
  p_second_ends_next_day boolean
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    public.schedule_time_start_min(p_first_start)
      < public.schedule_explicit_time_end_min(p_second_start, p_second_end, p_second_ends_next_day)
    and public.schedule_time_start_min(p_second_start)
      < public.schedule_explicit_time_end_min(p_first_start, p_first_end, p_first_ends_next_day)
$$;

create or replace function public.validate_staff_schedule_window()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_staff public.staff%rowtype;
  v_start_min integer;
  v_end_min integer;
begin
  if new.window_order < 1 or new.window_order > 12 then
    raise exception 'Staff schedule window order must be between 1 and 12.'
      using errcode = '23514';
  end if;

  if new.is_active is not true then
    if new.shift_type <> 'single'
      or new.window_order <> 1
      or new.start_time <> time '00:00'
      or new.end_time <> time '00:01'
      or new.ends_next_day is true then
      raise exception 'Inactive staff schedule rows must use the standard day-off marker.'
        using errcode = '23514';
    end if;
    return new;
  end if;

  select *
  into v_staff
  from public.staff
  where id = new.staff_id;

  if not found or public.staff_is_operational(v_staff) is not true then
    raise exception 'Cannot save an active schedule for inactive, archived, merged, test, or non-schedulable staff.'
      using errcode = '23514';
  end if;

  if new.shift_type in ('opening', 'closing')
    and coalesce(v_staff.staff_type, '') <> 'therapist'
    and coalesce(v_staff.system_role, '') not in ('crm', 'csr', 'csr_head', 'csr_staff') then
    raise exception 'Opening and Closing shifts are only available to therapists and CRM staff.'
      using errcode = '23514';
  end if;

  if new.start_time is null or new.end_time is null or new.start_time = new.end_time then
    raise exception 'Active schedule windows need a valid non-zero time range.'
      using errcode = '23514';
  end if;

  if new.ends_next_day is not true and new.end_time <= new.start_time then
    raise exception 'Enable Ends next day when a staff schedule window crosses midnight.'
      using errcode = '23514';
  end if;

  if new.ends_next_day is true and new.end_time > new.start_time then
    raise exception 'Ends next day can only be enabled when a staff schedule window crosses midnight.'
      using errcode = '23514';
  end if;

  v_start_min := public.schedule_time_start_min(new.start_time);
  v_end_min := public.schedule_explicit_time_end_min(new.start_time, new.end_time, new.ends_next_day);

  if v_end_min <= v_start_min or v_end_min - v_start_min > 16 * 60 then
    raise exception 'Shift times must span 1 minute to 16 hours.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.staff_schedules existing
    where existing.staff_id = new.staff_id
      and existing.day_of_week = new.day_of_week
      and existing.is_active = true
      and existing.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and public.schedule_explicit_time_ranges_overlap(
        existing.start_time,
        existing.end_time,
        existing.ends_next_day,
        new.start_time,
        new.end_time,
        new.ends_next_day
      )
  ) then
    raise exception 'Active staff schedule windows cannot overlap for the same staff member and weekday.'
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_staff_schedule_window_trigger on public.staff_schedules;
create trigger validate_staff_schedule_window_trigger
  before insert or update on public.staff_schedules
  for each row
  execute function public.validate_staff_schedule_window();

grant execute on function public.staff_metadata_flag(jsonb, text, boolean) to authenticated, service_role;

grant execute on function public.staff_is_operational(public.staff) to authenticated, service_role;

grant execute on function public.validate_staff_schedule_window() to authenticated, service_role;
