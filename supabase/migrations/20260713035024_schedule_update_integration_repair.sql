-- CRADLE-SCHEDULE-UPDATE-INTEGRATION-REPAIR-006
-- Repair the staff weekly schedule write contract used by Schedule Setup and
-- the Adjust Schedule modal.

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

grant execute on function public.schedule_time_start_min(time) to authenticated, service_role;
grant execute on function public.schedule_time_end_min(time, time) to authenticated, service_role;
grant execute on function public.schedule_time_ranges_overlap(time, time, time, time)
  to authenticated, service_role;
grant execute on function public.schedule_explicit_time_end_min(time, time, boolean)
  to authenticated, service_role;
grant execute on function public.schedule_explicit_time_ranges_overlap(time, time, boolean, time, time, boolean)
  to authenticated, service_role;

alter table public.staff_schedules
  add column if not exists window_order smallint not null default 1,
  add column if not exists ends_next_day boolean not null default false;

do $$
declare
  v_batch_id uuid := gen_random_uuid();
begin
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
    'schedule_update_integration_repair_before_window_order_backfill'
  from public.staff_schedules ss
  where exists (
    select 1
    from public.staff_schedules duplicate_row
    where duplicate_row.staff_id = ss.staff_id
      and duplicate_row.day_of_week = ss.day_of_week
      and duplicate_row.id <> ss.id
  )
  and not exists (
    select 1
    from public.schedule_repair_backups backup
    where backup.source_table = 'staff_schedules'
      and backup.source_pk = ss.id::text
      and backup.reason = 'schedule_update_integration_repair_before_window_order_backfill'
  );

  with ranked as (
    select
      ss.id,
      row_number() over (
        partition by ss.staff_id, ss.day_of_week
        order by
          ss.is_active desc,
          ss.start_time,
          ss.end_time,
          case ss.shift_type
            when 'opening' then 1
            when 'single' then 2
            when 'closing' then 3
            else 4
          end,
          ss.id
      )::smallint as next_window_order,
      case
        when ss.is_active = true and ss.end_time <= ss.start_time then true
        else ss.ends_next_day
      end as next_ends_next_day
    from public.staff_schedules ss
  )
  update public.staff_schedules ss
  set
    window_order = ranked.next_window_order,
    ends_next_day = ranked.next_ends_next_day
  from ranked
  where ss.id = ranked.id
    and (
      ss.window_order is distinct from ranked.next_window_order
      or ss.ends_next_day is distinct from ranked.next_ends_next_day
    );

  if exists (
    select 1
    from (
      select staff_id, day_of_week, count(*) as row_count
      from public.staff_schedules
      group by staff_id, day_of_week
      having count(*) > 12
    ) too_many_windows
  ) then
    raise exception 'Cannot repair staff_schedules: at least one staff weekday has more than 12 windows.'
      using errcode = '23514';
  end if;
end;
$$;

do $$
declare
  v_batch_id uuid := gen_random_uuid();
begin
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
    'schedule_update_integration_repair_stale_inactive_placeholder'
  from public.staff_schedules ss
  where ss.is_active = false
    and (
      ss.shift_type <> 'single'
      or ss.window_order <> 1
      or ss.start_time <> time '00:00'
      or ss.end_time <> time '00:01'
      or ss.ends_next_day is true
      or exists (
        select 1
        from public.staff_schedules active_row
        where active_row.staff_id = ss.staff_id
          and active_row.day_of_week = ss.day_of_week
          and active_row.is_active = true
      )
    )
    and not exists (
      select 1
      from public.schedule_repair_backups backup
      where backup.source_table = 'staff_schedules'
        and backup.source_pk = ss.id::text
        and backup.reason = 'schedule_update_integration_repair_stale_inactive_placeholder'
    );

  delete from public.staff_schedules ss
  where ss.is_active = false
    and exists (
      select 1
      from public.staff_schedules active_row
      where active_row.staff_id = ss.staff_id
        and active_row.day_of_week = ss.day_of_week
        and active_row.is_active = true
    );

  with inactive_ranked as (
    select
      ss.id,
      row_number() over (
        partition by ss.staff_id, ss.day_of_week
        order by ss.created_at, ss.id
      ) as rn
    from public.staff_schedules ss
    where ss.is_active = false
      and not exists (
        select 1
        from public.staff_schedules active_row
        where active_row.staff_id = ss.staff_id
          and active_row.day_of_week = ss.day_of_week
          and active_row.is_active = true
      )
  )
  delete from public.staff_schedules ss
  using inactive_ranked ranked
  where ss.id = ranked.id
    and ranked.rn > 1;

  update public.staff_schedules ss
  set
    shift_type = 'single',
    start_time = time '00:00',
    end_time = time '00:01',
    ends_next_day = false,
    window_order = 1
  where ss.is_active = false
    and (
      ss.shift_type <> 'single'
      or ss.window_order <> 1
      or ss.start_time <> time '00:00'
      or ss.end_time <> time '00:01'
      or ss.ends_next_day is true
    );
end;
$$;

alter table public.staff_schedules
  drop constraint if exists staff_schedules_window_order_check,
  add constraint staff_schedules_window_order_check
    check (window_order >= 1 and window_order <= 12);

alter table public.staff_schedules
  drop constraint if exists staff_schedules_staff_day_shift_unique,
  drop constraint if exists staff_schedules_staff_day_window_unique;

alter table public.staff_schedules
  add constraint staff_schedules_staff_day_window_unique
    unique (staff_id, day_of_week, window_order);

comment on column public.staff_schedules.window_order is
  'Ordered work window within the staff member weekday. Supports explicit split shifts.';

comment on column public.staff_schedules.ends_next_day is
  'True when this staff schedule window intentionally ends on the following calendar day.';

create or replace function public.can_mutate_schedule_for_branch(p_branch_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor public.staff%rowtype;
  v_role text;
begin
  if auth.role() = 'service_role' then
    return true;
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

  v_role := case
    when v_actor.system_role in ('csr', 'csr_head', 'csr_staff') then 'crm'
    else coalesce(v_actor.system_role, '')
  end;

  if v_role in ('owner', 'admin', 'super_admin') then
    return true;
  end if;

  if v_role in ('manager', 'assistant_manager', 'store_manager', 'crm', 'front_desk') then
    return v_actor.branch_id = p_branch_id;
  end if;

  return false;
end;
$$;

grant execute on function public.can_mutate_schedule_for_branch(uuid)
  to authenticated, service_role;

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
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Schedule rows must be submitted as a JSON array.'
      using errcode = '23514';
  end if;

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
      staff_id uuid,
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
      staff_id uuid,
      day_of_week integer,
      shift_type text,
      start_time text,
      end_time text,
      is_active boolean,
      window_order integer,
      ends_next_day boolean
    )
    where (staff_id is not null and staff_id <> p_staff_id)
       or day_of_week < 0
       or day_of_week > 6
       or window_order < 1
       or window_order > 12
       or shift_type not in ('single', 'opening', 'closing')
       or start_time is null
       or end_time is null
       or start_time::time = end_time::time
       or is_active is null
       or ends_next_day is null
  ) then
    raise exception 'Staff schedule rows contain an invalid staff, day, shift type, window order, or time range.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as row_data(
      staff_id uuid,
      day_of_week integer,
      shift_type text,
      start_time text,
      end_time text,
      is_active boolean,
      window_order integer,
      ends_next_day boolean
    )
    where is_active = false
      and (
        shift_type <> 'single'
        or window_order <> 1
        or start_time::time <> time '00:00'
        or end_time::time <> time '00:01'
        or ends_next_day <> false
      )
  ) then
    raise exception 'Inactive staff schedule rows must use the standard day-off marker.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as row_data(
      staff_id uuid,
      day_of_week integer,
      shift_type text,
      start_time text,
      end_time text,
      is_active boolean,
      window_order integer,
      ends_next_day boolean
    )
    where is_active = true
      and (
        (shift_type in ('opening', 'closing')
          and coalesce(v_staff.staff_type, '') <> 'therapist'
          and coalesce(v_staff.system_role, '') not in ('crm', 'csr', 'csr_head', 'csr_staff'))
        or (ends_next_day = false and end_time::time <= start_time::time)
        or (ends_next_day = true and end_time::time > start_time::time)
        or (
          public.schedule_explicit_time_end_min(start_time::time, end_time::time, ends_next_day)
            - public.schedule_time_start_min(start_time::time)
        ) <= 0
        or (
          public.schedule_explicit_time_end_min(start_time::time, end_time::time, ends_next_day)
            - public.schedule_time_start_min(start_time::time)
        ) > 16 * 60
      )
  ) then
    raise exception 'Staff schedule rows contain an invalid shift type, overnight flag, or duration.'
      using errcode = '23514';
  end if;

  if exists (
    with active_rows as (
      select
        row_number() over () as rn,
        day_of_week,
        start_time::time as start_time,
        end_time::time as end_time,
        ends_next_day
      from jsonb_to_recordset(p_rows) as row_data(
        staff_id uuid,
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
    where public.schedule_explicit_time_ranges_overlap(
      first_row.start_time,
      first_row.end_time,
      first_row.ends_next_day,
      second_row.start_time,
      second_row.end_time,
      second_row.ends_next_day
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

  delete from public.staff_schedules
  where staff_id = p_staff_id;

  if v_count = 0 then
    return;
  end if;

  return query
  with inserted as (
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
      row_data.window_order::smallint,
      row_data.ends_next_day
    from jsonb_to_recordset(p_rows) as row_data(
      staff_id uuid,
      day_of_week integer,
      shift_type text,
      start_time text,
      end_time text,
      is_active boolean,
      window_order integer,
      ends_next_day boolean
    )
    order by row_data.day_of_week, row_data.window_order
    returning *
  )
  select *
  from inserted
  order by day_of_week, window_order;
end;
$$;

revoke all on function public.replace_staff_weekly_schedule(uuid, uuid, jsonb)
  from public, anon;
grant execute on function public.replace_staff_weekly_schedule(uuid, uuid, jsonb)
  to authenticated, service_role;

create index if not exists staff_schedules_active_staff_day_idx
  on public.staff_schedules (staff_id, day_of_week, window_order)
  where is_active = true;

notify pgrst, 'reload schema';
