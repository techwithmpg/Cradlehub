-- Reconcile confirmed local/live schema drift without replaying historical
-- seed migrations. Data repairs below are deterministic and write before-state
-- rows to schedule_repair_backups before changing active group defaults.

begin;

do $group_schedule_repair$
declare
  v_batch_id uuid := gen_random_uuid();
begin
-- Group defaults are fallback assignments. Opening and Closing times may be
  -- preserved as inactive templates, but both cannot be active fallback windows
  -- when they overlap.
  with stale_group_rows as (
    select distinct later_rule.id
    from public.staff_group_schedule_rules earlier_rule
    join public.staff_group_schedule_rules later_rule
      on later_rule.group_id = earlier_rule.group_id
     and later_rule.day_of_week = earlier_rule.day_of_week
     and later_rule.id <> earlier_rule.id
     and later_rule.is_active = true
     and later_rule.is_day_off is not true
    join public.staff_schedule_groups sg on sg.id = earlier_rule.group_id
    where earlier_rule.is_active = true
      and earlier_rule.is_day_off is not true
      and earlier_rule.start_time is not null
      and earlier_rule.end_time is not null
      and later_rule.start_time is not null
      and later_rule.end_time is not null
      and public.schedule_time_ranges_overlap(
        earlier_rule.start_time,
        earlier_rule.end_time,
        later_rule.start_time,
        later_rule.end_time
      )
      and (
        -- Opening/closing-capable groups default to Opening unless a user
        -- explicitly saves a non-overlapping Split Shift later.
        (sg.group_key in ('therapist', 'csr') and later_rule.shift_type = 'closing')
        or
        -- Regular-only groups should not have active opening/closing fallbacks.
        (sg.group_key in ('driver', 'utility', 'nail_tech', 'aesthetician', 'managerial')
          and later_rule.shift_type in ('opening', 'closing'))
      )
  )
  insert into public.schedule_repair_backups (
    batch_id,
    source_table,
    source_pk,
    original_row,
    reason
  )
  select
    v_batch_id,
    'staff_group_schedule_rules',
    sgr.id::text,
    to_jsonb(sgr),
    'deactivate_overlapping_group_default_template'
  from public.staff_group_schedule_rules sgr
  join stale_group_rows stale on stale.id = sgr.id
  where not exists (
    select 1
    from public.schedule_repair_backups b
    where b.source_table = 'staff_group_schedule_rules'
      and b.source_pk = sgr.id::text
      and b.reason = 'deactivate_overlapping_group_default_template'
  );

  with stale_group_rows as (
    select distinct later_rule.id
    from public.staff_group_schedule_rules earlier_rule
    join public.staff_group_schedule_rules later_rule
      on later_rule.group_id = earlier_rule.group_id
     and later_rule.day_of_week = earlier_rule.day_of_week
     and later_rule.id <> earlier_rule.id
     and later_rule.is_active = true
     and later_rule.is_day_off is not true
    join public.staff_schedule_groups sg on sg.id = earlier_rule.group_id
    where earlier_rule.is_active = true
      and earlier_rule.is_day_off is not true
      and earlier_rule.start_time is not null
      and earlier_rule.end_time is not null
      and later_rule.start_time is not null
      and later_rule.end_time is not null
      and public.schedule_time_ranges_overlap(
        earlier_rule.start_time,
        earlier_rule.end_time,
        later_rule.start_time,
        later_rule.end_time
      )
      and (
        (sg.group_key in ('therapist', 'csr') and later_rule.shift_type = 'closing')
        or
        (sg.group_key in ('driver', 'utility', 'nail_tech', 'aesthetician', 'managerial')
          and later_rule.shift_type in ('opening', 'closing'))
      )
  )
  update public.staff_group_schedule_rules sgr
  set
    is_active = false,
    updated_at = now()
  from stale_group_rows stale
  where sgr.id = stale.id;

  -- Driver group had opening/closing fallback rows but no regular rows. Preserve
  -- the regular-only default by creating single rows from the non-overlapping
  -- 14:00-22:00 opening rows, then deactivate the opening/closing templates.
  insert into public.staff_group_schedule_rules (
    group_id,
    day_of_week,
    shift_type,
    start_time,
    end_time,
    is_active,
    is_day_off
  )
  select
    sgr.group_id,
    sgr.day_of_week,
    'single',
    sgr.start_time,
    sgr.end_time,
    true,
    false
  from public.staff_group_schedule_rules sgr
  join public.staff_schedule_groups sg on sg.id = sgr.group_id
  where sg.group_key = 'driver'
    and sgr.shift_type = 'opening'
    and sgr.start_time is not null
    and sgr.end_time is not null
    and not exists (
      select 1
      from public.staff_group_schedule_rules existing
      where existing.group_id = sgr.group_id
        and existing.day_of_week = sgr.day_of_week
        and existing.shift_type = 'single'
    )
  on conflict (group_id, day_of_week, shift_type) do nothing;
end
$group_schedule_repair$;

-- Home Service distance policy belongs on branch_booking_rules in application
-- code. Some live state had the values only on branches, so reconcile columns
-- and backfill without dropping the legacy branch copy.
alter table public.branch_booking_rules
  add column if not exists home_service_free_km numeric(6,2) not null default 5,
  add column if not exists home_service_extra_km_fee numeric(10,2) not null default 100;

alter table public.branch_booking_rules
  drop constraint if exists branch_booking_rules_home_service_free_km_range,
  drop constraint if exists branch_booking_rules_home_service_extra_km_fee_range;

alter table public.branch_booking_rules
  add constraint branch_booking_rules_home_service_free_km_range
    check (home_service_free_km >= 0 and home_service_free_km <= 100),
  add constraint branch_booking_rules_home_service_extra_km_fee_range
    check (home_service_extra_km_fee >= 0 and home_service_extra_km_fee <= 10000);

update public.branch_booking_rules bbr
set
  home_service_free_km = coalesce(br.home_service_free_km, bbr.home_service_free_km, 5),
  home_service_extra_km_fee = coalesce(
    br.home_service_extra_km_fee,
    bbr.home_service_extra_km_fee,
    100
  )
from public.branches br
where br.id = bbr.branch_id;

alter table public.branches
  drop constraint if exists branches_latitude_range,
  drop constraint if exists branches_longitude_range;

alter table public.branches
  add constraint branches_latitude_range
    check (latitude is null or (latitude >= -90 and latitude <= 90)),
  add constraint branches_longitude_range
    check (longitude is null or (longitude >= -180 and longitude <= 180));

create or replace function public.validate_group_schedule_rule_window()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_active is not true then
    return new;
  end if;

  if new.is_day_off is true then
    if exists (
      select 1
      from public.staff_group_schedule_rules existing
      where existing.group_id = new.group_id
        and existing.day_of_week = new.day_of_week
        and existing.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and existing.is_active = true
        and existing.is_day_off is not true
    ) then
      raise exception 'A group day cannot be both day off and scheduled.'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if new.start_time is null or new.end_time is null or new.start_time = new.end_time then
    raise exception 'Active group schedule windows need a valid non-zero time range.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.staff_group_schedule_rules existing
    where existing.group_id = new.group_id
      and existing.day_of_week = new.day_of_week
      and existing.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and existing.is_active = true
      and (
        existing.is_day_off = true
        or (
          existing.start_time is not null
          and existing.end_time is not null
          and public.schedule_time_ranges_overlap(
            existing.start_time,
            existing.end_time,
            new.start_time,
            new.end_time
          )
        )
      )
  ) then
    raise exception 'Active group schedule rules cannot overlap or mix day-off with working windows for the same weekday.'
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_group_schedule_rule_window_trigger
  on public.staff_group_schedule_rules;
create trigger validate_group_schedule_rule_window_trigger
  before insert or update on public.staff_group_schedule_rules
  for each row
  execute function public.validate_group_schedule_rule_window();

create or replace function public.replace_group_weekly_schedule(
  p_group_id uuid,
  p_rows jsonb
)
returns setof public.staff_group_schedule_rules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid := gen_random_uuid();
  v_count integer;
  v_distinct_count integer;
  v_branch_id uuid;
begin
  select branch_id
  into v_branch_id
  from public.staff_schedule_groups
  where id = p_group_id
    and is_active = true
  for update;

  if v_branch_id is null then
    raise exception 'Schedule group was not found.'
      using errcode = '23514';
  end if;

  if public.can_mutate_schedule_for_branch(v_branch_id) is not true then
    raise exception 'You do not have permission to update schedule rules for this branch.'
      using errcode = '42501';
  end if;

  with parsed as (
    select *
    from jsonb_to_recordset(p_rows) as row_data(
      day_of_week integer,
      shift_type text,
      start_time text,
      end_time text,
      is_active boolean,
      is_day_off boolean
    )
  )
  select
    count(*),
    count(distinct (day_of_week, shift_type))
  into v_count, v_distinct_count
  from parsed;

  if v_count <> 21 or v_distinct_count <> 21 then
    raise exception 'A complete weekly group schedule must contain exactly 21 unique day/shift rows.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as row_data(
      day_of_week integer,
      shift_type text,
      start_time text,
      end_time text,
      is_active boolean,
      is_day_off boolean
    )
    where day_of_week < 0
       or day_of_week > 6
       or shift_type not in ('single', 'opening', 'closing')
       or (
         is_active = true
         and is_day_off is not true
         and (
           start_time is null
           or end_time is null
           or start_time::time = end_time::time
         )
       )
  ) then
    raise exception 'Group schedule rows contain an invalid day, shift type, or time range.'
      using errcode = '23514';
  end if;

  if exists (
    with active_rows as (
      select
        row_number() over () as rn,
        day_of_week,
        shift_type,
        start_time::time as start_time,
        end_time::time as end_time,
        coalesce(is_day_off, false) as is_day_off
      from jsonb_to_recordset(p_rows) as row_data(
        day_of_week integer,
        shift_type text,
        start_time text,
        end_time text,
        is_active boolean,
        is_day_off boolean
      )
      where is_active = true
    )
    select 1
    from active_rows first_row
    join active_rows second_row
      on second_row.day_of_week = first_row.day_of_week
     and second_row.rn > first_row.rn
    where first_row.is_day_off = true
       or second_row.is_day_off = true
       or public.schedule_time_ranges_overlap(
         first_row.start_time,
         first_row.end_time,
         second_row.start_time,
         second_row.end_time
       )
  ) then
    raise exception 'Active group schedule windows cannot overlap or mix with a day-off marker for the same weekday.'
      using errcode = '23P01';
  end if;

  insert into public.schedule_repair_backups (
    batch_id,
    source_table,
    source_pk,
    original_row,
    reason
  )
  select
    v_batch_id,
    'staff_group_schedule_rules',
    sgr.id::text,
    to_jsonb(sgr),
    'replace_group_weekly_schedule_before_state'
  from public.staff_group_schedule_rules sgr
  where sgr.group_id = p_group_id;

  update public.staff_group_schedule_rules
  set
    is_active = false,
    updated_at = now()
  where group_id = p_group_id;

  return query
  insert into public.staff_group_schedule_rules (
    group_id,
    day_of_week,
    shift_type,
    start_time,
    end_time,
    is_active,
    is_day_off
  )
  select
    p_group_id,
    row_data.day_of_week::smallint,
    row_data.shift_type,
    row_data.start_time::time,
    row_data.end_time::time,
    row_data.is_active,
    coalesce(row_data.is_day_off, false)
  from jsonb_to_recordset(p_rows) as row_data(
    day_of_week integer,
    shift_type text,
    start_time text,
    end_time text,
    is_active boolean,
    is_day_off boolean
  )
  on conflict (group_id, day_of_week, shift_type)
  do update set
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    is_active = excluded.is_active,
    is_day_off = excluded.is_day_off,
    updated_at = now()
  returning *;
end;
$$;

grant execute on function public.replace_group_weekly_schedule(uuid, jsonb)
  to authenticated, service_role;

create index if not exists staff_operational_branch_idx
  on public.staff (branch_id, is_active)
  where archived_at is null
    and merged_into_staff_id is null;

create index if not exists staff_group_schedule_rules_active_group_day_idx
  on public.staff_group_schedule_rules (group_id, day_of_week, shift_type)
  where is_active = true;

alter table public.coverage_requirements enable row level security;
alter table public.schedule_repair_backups enable row level security;
alter table public.staff_deletion_backups enable row level security;
alter table public.staff_duty_assignments enable row level security;
alter table public.staff_identity_merge_backups enable row level security;
alter table public.staff_merge_map_work enable row level security;
alter table public.staff_schedules_merge_backup_20260712 enable row level security;

revoke all privileges on table public.coverage_requirements
  from public, anon, authenticated;
revoke all privileges on table public.schedule_repair_backups
  from public, anon, authenticated;
revoke all privileges on table public.staff_deletion_backups
  from public, anon, authenticated;
revoke all privileges on table public.staff_duty_assignments
  from public, anon, authenticated;
revoke all privileges on table public.staff_identity_merge_backups
  from public, anon, authenticated;
revoke all privileges on table public.staff_merge_map_work
  from public, anon, authenticated;
revoke all privileges on table public.staff_schedules_merge_backup_20260712
  from public, anon, authenticated;

revoke all privileges on sequence public.schedule_repair_backups_id_seq
  from public, anon, authenticated;

-- Restore the metadata lookup index declared by the historical local chain.
create index if not exists staff_metadata_gin_idx
  on public.staff using gin (metadata);

notify pgrst, 'reload schema';

commit;
