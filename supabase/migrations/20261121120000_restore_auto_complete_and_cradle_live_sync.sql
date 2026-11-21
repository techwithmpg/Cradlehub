-- Restore automatic completion for due sessions after a 15-minute grace buffer
-- and ensure bookings + staff_shift_checkins + branch_resources are in supabase_realtime publication.

create or replace function public.complete_due_service_sessions(
  p_limit integer default 100
)
returns table (
  booking_id uuid,
  branch_id uuid,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $func$
declare
  v_now timestamptz := clock_timestamp();
  v_row record;
begin
  for v_row in
    select b.id, b.branch_id, b.status
    from public.bookings b
    where b.status = 'in_progress'
      and b.session_completed_at is null
      and (
        (b.session_due_at is not null and b.session_due_at + interval '15 minutes' <= v_now)
        or (b.session_due_at is null and b.booking_date < (v_now at time zone 'Asia/Manila')::date)
      )
    order by coalesce(b.session_due_at, b.updated_at) asc
    limit greatest(1, least(coalesce(p_limit, 100), 500))
    for update skip locked
  loop
    update public.bookings as b
    set
      status = 'completed',
      booking_progress_status = 'completed',
      home_service_tracking_status = case
        when b.delivery_type = 'home_service' or b.type = 'home_service' then 'completed'
        else b.home_service_tracking_status
      end,
      session_completed_at = v_now,
      completed_at = coalesce(b.completed_at, v_now),
      session_auto_completed_at = v_now,
      session_completion_source = 'auto_due',
      updated_at = v_now
    where b.id = v_row.id;

    insert into public.booking_events (booking_id, from_status, to_status, notes)
    values (
      v_row.id,
      v_row.status,
      'completed',
      'Auto-completed due service session (15m grace elapsed)'
    );

    booking_id := v_row.id;
    branch_id := v_row.branch_id;
    completed_at := v_now;
    return next;
  end loop;
end;
$func$;

do $pub$
declare
  v_tbl text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_tbl in array array['bookings', 'staff_shift_checkins', 'branch_resources'] loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = v_tbl
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_tbl);
      end if;
    end loop;
  end if;
end;
$pub$;
