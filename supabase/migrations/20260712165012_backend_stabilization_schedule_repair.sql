-- =============================================================================
-- CradleHub — backend stabilization and schedule repair
-- =============================================================================
-- This migration reconciles the current Schedule Setup contract with the
-- database layer:
--   * operational staff is defined once for SQL consumers;
--   * complete weekly staff/group schedule saves are transactional RPCs;
--   * active overlapping weekly windows are rejected by triggers;
--   * deterministic stale schedule rows are backed up and deactivated;
--   * corrupted coverage defaults and Home Service rule columns are repaired.
--
-- Ambiguous individual overlaps are intentionally left active so the resolver
-- continues to return "conflict" until an authorized user chooses the correct
-- assignment.
-- =============================================================================

-- ── Structured repair/audit backups ─────────────────────────────────────────

create table if not exists public.schedule_repair_backups (
  id bigserial primary key,
  batch_id uuid not null,
  source_table text not null,
  source_pk text not null,
  original_row jsonb not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists schedule_repair_backups_batch_idx
  on public.schedule_repair_backups (batch_id, source_table);

grant select, insert on public.schedule_repair_backups to authenticated, service_role;
grant usage, select on sequence public.schedule_repair_backups_id_seq to authenticated, service_role;

-- Keep the live manual merge-map artifact represented in migrations without
-- applying merge side effects in this schedule repair migration.
create table if not exists public.staff_merge_map_work (
  source_staff_id uuid primary key references public.staff(id),
  canonical_staff_id uuid not null references public.staff(id),
  identity_name text not null,
  created_at timestamptz not null default now(),
  constraint staff_merge_map_different_ids check (source_staff_id <> canonical_staff_id)
);

grant select, insert, update, delete on public.staff_merge_map_work to authenticated, service_role;

-- ── Operational staff contract ──────────────────────────────────────────────

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
    p_staff.is_active = true
    and p_staff.archived_at is null
    and p_staff.merged_into_staff_id is null
    and public.staff_metadata_flag(p_staff.metadata, 'is_test', false) = false
    and public.staff_metadata_flag(p_staff.metadata, 'test', false) = false
    and public.staff_metadata_flag(p_staff.metadata, 'is_schedulable', true) = true
    and public.staff_metadata_flag(p_staff.metadata, 'schedulable', true) = true
    and public.staff_metadata_flag(p_staff.metadata, 'non_schedulable', false) = false
$$;

create or replace view public.operational_staff
with (security_invoker = true)
as
select s.*
from public.staff s
where public.staff_is_operational(s);

grant select on public.operational_staff to authenticated, service_role;
grant execute on function public.staff_metadata_flag(jsonb, text, boolean)
  to authenticated, service_role;
grant execute on function public.staff_is_operational(public.staff)
  to authenticated, service_role;

-- ── Shared time-window helpers ──────────────────────────────────────────────

create or replace function public.schedule_time_start_min(p_time time)
returns integer
language sql
immutable
set search_path = public
as $$
  select extract(hour from p_time)::integer * 60 + extract(minute from p_time)::integer
$$;

create or replace function public.schedule_time_end_min(p_start time, p_end time)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when public.schedule_time_start_min(p_end) <= public.schedule_time_start_min(p_start)
      then public.schedule_time_start_min(p_end) + 1440
    else public.schedule_time_start_min(p_end)
  end
$$;

create or replace function public.schedule_time_ranges_overlap(
  p_first_start time,
  p_first_end time,
  p_second_start time,
  p_second_end time
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    public.schedule_time_start_min(p_first_start)
      < public.schedule_time_end_min(p_second_start, p_second_end)
    and public.schedule_time_start_min(p_second_start)
      < public.schedule_time_end_min(p_first_start, p_first_end)
$$;

grant execute on function public.schedule_time_start_min(time) to authenticated, service_role;
grant execute on function public.schedule_time_end_min(time, time) to authenticated, service_role;
grant execute on function public.schedule_time_ranges_overlap(time, time, time, time)
  to authenticated, service_role;

-- ── Deterministic data repair before strict validation ──────────────────────

do $$
declare
  v_batch_id uuid := gen_random_uuid();
begin
  -- Coverage values matching the known corrupted seeded roster totals are
  -- restored to schema defaults. Branch-specific business coverage can still
  -- be configured through the existing Schedule Rules UI.
  insert into public.schedule_repair_backups (
    batch_id,
    source_table,
    source_pk,
    original_row,
    reason
  )
  select
    v_batch_id,
    'scheduling_rules',
    sr.id::text,
    to_jsonb(sr),
    'restore_corrupted_coverage_roster_totals_to_schema_defaults'
  from public.scheduling_rules sr
  where sr.min_daily_staff = 29
    and sr.min_daily_therapists = 29
    and sr.min_daily_csr = 4
    and sr.min_daily_drivers = 3
    and sr.min_daily_utility = 2
    and not exists (
      select 1
      from public.schedule_repair_backups b
      where b.source_table = 'scheduling_rules'
        and b.source_pk = sr.id::text
        and b.reason = 'restore_corrupted_coverage_roster_totals_to_schema_defaults'
    );

  update public.scheduling_rules sr
  set
    min_daily_staff = 1,
    min_daily_therapists = 1,
    min_daily_csr = 1,
    min_daily_drivers = 0,
    min_daily_utility = 0,
    updated_at = now()
  where sr.min_daily_staff = 29
    and sr.min_daily_therapists = 29
    and sr.min_daily_csr = 4
    and sr.min_daily_drivers = 3
    and sr.min_daily_utility = 2;

  -- Stale individual rows: a newer active opening/closing row replaced an
  -- older active single row for the same staff/day, but the old row remained
  -- active. Deactivate only that older overlapping single row.
  with stale_single_rows as (
    select distinct single_row.id
    from public.staff_schedules single_row
    join public.staff_schedules replacement_row
      on replacement_row.staff_id = single_row.staff_id
     and replacement_row.day_of_week = single_row.day_of_week
     and replacement_row.id <> single_row.id
     and replacement_row.is_active = true
     and replacement_row.shift_type in ('opening', 'closing')
     and replacement_row.created_at > single_row.created_at
    where single_row.is_active = true
      and single_row.shift_type = 'single'
      and public.schedule_time_ranges_overlap(
        single_row.start_time,
        single_row.end_time,
        replacement_row.start_time,
        replacement_row.end_time
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
    'staff_schedules',
    ss.id::text,
    to_jsonb(ss),
    'deactivate_stale_single_row_superseded_by_newer_shift'
  from public.staff_schedules ss
  join stale_single_rows stale on stale.id = ss.id
  where not exists (
    select 1
    from public.schedule_repair_backups b
    where b.source_table = 'staff_schedules'
      and b.source_pk = ss.id::text
      and b.reason = 'deactivate_stale_single_row_superseded_by_newer_shift'
  );

  with stale_single_rows as (
    select distinct single_row.id
    from public.staff_schedules single_row
    join public.staff_schedules replacement_row
      on replacement_row.staff_id = single_row.staff_id
     and replacement_row.day_of_week = single_row.day_of_week
     and replacement_row.id <> single_row.id
     and replacement_row.is_active = true
     and replacement_row.shift_type in ('opening', 'closing')
     and replacement_row.created_at > single_row.created_at
    where single_row.is_active = true
      and single_row.shift_type = 'single'
      and public.schedule_time_ranges_overlap(
        single_row.start_time,
        single_row.end_time,
        replacement_row.start_time,
        replacement_row.end_time
      )
  )
  update public.staff_schedules ss
  set is_active = false
  from stale_single_rows stale
  where ss.id = stale.id;

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
end $$;

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

-- ── Ordered weekly windows ─────────────────────────────────────────────────

alter table public.staff_schedules
  add column if not exists window_order integer not null default 1,
  add column if not exists ends_next_day boolean not null default false;

alter table public.staff_schedules
  drop constraint if exists staff_schedules_staff_day_shift_unique,
  drop constraint if exists staff_schedules_staff_day_window_unique,
  add constraint staff_schedules_staff_day_window_unique
    unique (staff_id, day_of_week, window_order);

comment on column public.staff_schedules.window_order is
  'Ordered work window within the staff member weekday. Supports explicit split shifts.';

comment on column public.staff_schedules.ends_next_day is
  'True when this staff schedule window intentionally ends on the following calendar day.';

-- ── Validation triggers ─────────────────────────────────────────────────────

create or replace function public.validate_staff_schedule_window()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_staff public.staff%rowtype;
begin
  if new.is_active is not true then
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
    raise exception 'Opening and Closing shifts are only available to therapists and CRM/front-desk staff.'
      using errcode = '23514';
  end if;

  if new.start_time is null or new.end_time is null or new.start_time = new.end_time then
    raise exception 'Active schedule windows need a valid non-zero time range.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.staff_schedules existing
    where existing.staff_id = new.staff_id
      and existing.day_of_week = new.day_of_week
      and existing.is_active = true
      and existing.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and public.schedule_time_ranges_overlap(
        existing.start_time,
        existing.end_time,
        new.start_time,
        new.end_time
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

-- ── Transactional schedule save RPCs ────────────────────────────────────────

create or replace function public.can_mutate_schedule_for_branch(p_branch_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor public.staff%rowtype;
  v_role text := auth.role();
begin
  if v_role = 'service_role' then
    return true;
  end if;

  if auth.uid() is null then
    return false;
  end if;

  select *
  into v_actor
  from public.staff actor
  where actor.auth_user_id = auth.uid()
    and public.staff_is_operational(actor)
  limit 1;

  if not found then
    return false;
  end if;

  if v_actor.system_role in ('owner', 'admin', 'super_admin') then
    return true;
  end if;

  if v_actor.system_role in ('manager', 'crm', 'csr', 'front_desk') then
    return v_actor.branch_id = p_branch_id;
  end if;

  return false;
end;
$$;

grant execute on function public.can_mutate_schedule_for_branch(uuid)
  to authenticated, service_role;

create or replace function public.replace_staff_weekly_schedule(
  p_staff_id uuid,
  p_branch_id uuid,
  p_rows jsonb
)
returns setof public.staff_schedules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid := gen_random_uuid();
  v_count integer;
  v_distinct_count integer;
  v_staff public.staff%rowtype;
begin
  if public.can_mutate_schedule_for_branch(p_branch_id) is not true then
    raise exception 'You do not have permission to update this staff schedule.'
      using errcode = '42501';
  end if;

  select *
  into v_staff
  from public.staff
  where id = p_staff_id
    and branch_id = p_branch_id
  for update;

  if not found or public.staff_is_operational(v_staff) is not true then
    raise exception 'Staff member is not operational in this branch.'
      using errcode = '23514';
  end if;

  with parsed as (
    select *
    from jsonb_to_recordset(p_rows) as row_data(
      day_of_week integer,
      shift_type text,
      start_time text,
      end_time text,
      is_active boolean,
      window_order integer,
      ends_next_day boolean
    )
  )
  select
    count(*),
    count(distinct (day_of_week, window_order))
  into v_count, v_distinct_count
  from parsed;

  if v_count <> v_distinct_count then
    raise exception 'A weekly staff schedule cannot repeat a weekday/window order.'
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
      window_order integer,
      ends_next_day boolean
    )
    where day_of_week < 0
       or day_of_week > 6
       or window_order < 1
       or shift_type not in ('single', 'opening', 'closing')
       or start_time is null
       or end_time is null
       or start_time::time = end_time::time
  ) then
    raise exception 'Staff schedule rows contain an invalid day, shift type, or time range.'
      using errcode = '23514';
  end if;

  if exists (
    with active_rows as (
      select
        row_number() over () as rn,
        day_of_week,
        shift_type,
        start_time::time as start_time,
        end_time::time as end_time
      from jsonb_to_recordset(p_rows) as row_data(
        day_of_week integer,
        shift_type text,
        start_time text,
        end_time text,
        is_active boolean,
        window_order integer,
        ends_next_day boolean
      )
      where is_active = true
    )
    select 1
    from active_rows first_row
    join active_rows second_row
      on second_row.day_of_week = first_row.day_of_week
     and second_row.rn > first_row.rn
    where public.schedule_time_ranges_overlap(
      first_row.start_time,
      first_row.end_time,
      second_row.start_time,
      second_row.end_time
    )
  ) then
    raise exception 'Active staff schedule windows cannot overlap for the same weekday.'
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
    'staff_schedules',
    ss.id::text,
    to_jsonb(ss),
    'replace_staff_weekly_schedule_before_state'
  from public.staff_schedules ss
  where ss.staff_id = p_staff_id;

  update public.staff_schedules
  set is_active = false
  where staff_id = p_staff_id;

  return query
  insert into public.staff_schedules (
    staff_id,
    day_of_week,
    shift_type,
    start_time,
    end_time,
    is_active,
    window_order,
    ends_next_day
  )
  select
    p_staff_id,
    row_data.day_of_week::smallint,
    row_data.shift_type,
    row_data.start_time::time,
    row_data.end_time::time,
    row_data.is_active,
    row_data.window_order,
    row_data.ends_next_day
  from jsonb_to_recordset(p_rows) as row_data(
    day_of_week integer,
    shift_type text,
    start_time text,
    end_time text,
    is_active boolean,
    window_order integer,
    ends_next_day boolean
  )
  on conflict (staff_id, day_of_week, window_order)
  do update set
    shift_type = excluded.shift_type,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    is_active = excluded.is_active,
    ends_next_day = excluded.ends_next_day
  returning *;
end;
$$;

grant execute on function public.replace_staff_weekly_schedule(uuid, uuid, jsonb)
  to authenticated, service_role;

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

-- ── Operational indexes for current query paths ─────────────────────────────

create index if not exists staff_operational_branch_idx
  on public.staff (branch_id, is_active)
  where archived_at is null
    and merged_into_staff_id is null;

create index if not exists staff_schedules_active_staff_day_idx
  on public.staff_schedules (staff_id, day_of_week, window_order)
  where is_active = true;

create index if not exists staff_group_schedule_rules_active_group_day_idx
  on public.staff_group_schedule_rules (group_id, day_of_week, shift_type)
  where is_active = true;
