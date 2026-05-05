-- Migration: update_get_daily_schedule RPC
-- Purpose: Include assigned resource (room/bed) information in the daily schedule.

drop function if exists public.get_daily_schedule(uuid, date);

create function public.get_daily_schedule(
  p_branch_id uuid,
  p_date date
)
returns table (
  staff_id uuid,
  staff_name text,
  staff_tier text,
  work_start time,
  work_end time,
  bookings jsonb,
  blocks jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dow int := extract(dow from p_date);
begin
  return query
  with active_staff as (
    select
      s.id as sid,
      s.full_name as sname,
      s.tier as stier
    from public.staff s
    where s.branch_id = p_branch_id
      and s.is_active = true
    order by s.tier, s.full_name
  ),
  work_hours as (
    select
      ast.sid,
      case
        when so.is_day_off then null
        when so.start_time is not null and so.end_time is not null then so.start_time
        when ss.start_time is not null then ss.start_time
        else null
      end as wh_start,
      case
        when so.is_day_off then null
        when so.start_time is not null and so.end_time is not null then so.end_time
        when ss.end_time is not null then ss.end_time
        else null
      end as wh_end
    from active_staff ast
    left join public.schedule_overrides so
      on so.staff_id = ast.sid
      and so.override_date = p_date
    left join public.staff_schedules ss
      on ss.staff_id = ast.sid
      and ss.day_of_week = v_dow
      and ss.is_active = true
  ),
  staff_bookings as (
    select
      b.staff_id as sid,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', b.id,
            'start_time', b.start_time,
            'end_time', b.end_time,
            'service', coalesce(srv.name, 'Service'),
            'customer', coalesce(c.full_name, '—'),
            'status', b.status,
            'type', b.type,
            'resource_id', b.resource_id,
            'resource_name', res.name
          )
          order by b.start_time
        )
        filter (where b.id is not null),
        '[]'::jsonb
      ) as booking_list
    from public.bookings b
    left join public.services srv on srv.id = b.service_id
    left join public.customers c on c.id = b.customer_id
    left join public.branch_resources res on res.id = b.resource_id
    where b.branch_id = p_branch_id
      and b.booking_date = p_date
      and b.status not in ('cancelled', 'no_show')
    group by b.staff_id
  ),
  staff_blocks as (
    select
      bt.staff_id as sid,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'start_time', bt.start_time,
            'end_time', bt.end_time,
            'reason', bt.reason
          )
          order by bt.start_time
        )
        filter (where bt.id is not null),
        '[]'::jsonb
      ) as block_list
    from public.blocked_times bt
    where bt.block_date = p_date
    group by bt.staff_id
  )
  select
    ast.sid::uuid as staff_id,
    ast.sname::text as staff_name,
    ast.stier::text as staff_tier,
    wh.wh_start as work_start,
    wh.wh_end as work_end,
    coalesce(sb.booking_list, '[]'::jsonb) as bookings,
    coalesce(stb.block_list, '[]'::jsonb) as blocks
  from active_staff ast
  left join work_hours wh on wh.sid = ast.sid
  left join staff_bookings sb on sb.sid = ast.sid
  left join staff_blocks stb on stb.sid = ast.sid
  order by ast.stier, ast.sname;
end;
$$;
