do $$
declare
  schedule_table text;
begin
  foreach schedule_table in array array[
    'staff',
    'staff_schedules',
    'schedule_overrides',
    'blocked_times',
    'staff_shift_checkins',
    'bookings',
    'branch_resources'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = schedule_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', schedule_table);
    end if;
  end loop;
end $$;
