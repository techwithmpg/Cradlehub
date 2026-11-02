-- LOCAL ONLY: execute after fixture and correction in a disposable database.
do $$
declare
  v_staff public.staff%rowtype;
  v_count integer;
begin
  insert into public.staff (id, branch_id, full_name)
  values ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', 'Test Therapist');
  select * into v_staff from public.staff where id = '00000000-0000-0000-0000-000000000101';
  if public.staff_is_operational(v_staff) is not true then raise exception 'operational staff rejected'; end if;
  update public.staff set metadata = '{"is_test":true}' where id = v_staff.id;
  select * into v_staff from public.staff where id = v_staff.id;
  if public.staff_is_operational(v_staff) is not false then raise exception 'test staff accepted'; end if;
  update public.staff set metadata = '{"schedulable":false}' where id = v_staff.id;
  select * into v_staff from public.staff where id = v_staff.id;
  if public.staff_is_operational(v_staff) is not false then raise exception 'non-schedulable staff accepted'; end if;
  update public.staff set metadata = '{}', archived_at = now() where id = v_staff.id;
  select * into v_staff from public.staff where id = v_staff.id;
  if public.staff_is_operational(v_staff) is not false then raise exception 'archived staff accepted'; end if;
  update public.staff set archived_at = null, merged_into_staff_id = '00000000-0000-0000-0000-000000000102' where id = v_staff.id;
  select * into v_staff from public.staff where id = v_staff.id;
  if public.staff_is_operational(v_staff) is not false then raise exception 'merged staff accepted'; end if;
  update public.staff set merged_into_staff_id = null, is_active = false where id = v_staff.id;
  select * into v_staff from public.staff where id = v_staff.id;
  if public.staff_is_operational(v_staff) is not false then raise exception 'inactive staff accepted'; end if;
  update public.staff set is_active = true where id = v_staff.id;

  insert into public.staff_schedules (id,staff_id,day_of_week,start_time,end_time)
  values ('00000000-0000-0000-0000-000000000301',v_staff.id,1,'09:00','17:00');
  insert into public.staff_schedules (id,staff_id,day_of_week,start_time,end_time,ends_next_day,window_order)
  values ('00000000-0000-0000-0000-000000000302',v_staff.id,2,'18:00','02:00',true,1);
  insert into public.staff_schedules (id,staff_id,day_of_week,start_time,end_time,is_active)
  values ('00000000-0000-0000-0000-000000000303',v_staff.id,3,'00:00','00:01',false);

  begin
    insert into public.staff_schedules (id,staff_id,day_of_week,start_time,end_time,window_order)
    values ('00000000-0000-0000-0000-000000000304',v_staff.id,1,'16:00','20:00',2);
    raise exception 'overlap incorrectly accepted';
  exception when exclusion_violation then null; end;
  begin
    insert into public.staff_schedules (id,staff_id,day_of_week,start_time,end_time)
    values ('00000000-0000-0000-0000-000000000305',v_staff.id,4,'18:00','02:00');
    raise exception 'overnight without flag accepted';
  exception when check_violation then null; end;
  begin
    insert into public.staff_schedules (id,staff_id,day_of_week,start_time,end_time,is_active)
    values ('00000000-0000-0000-0000-000000000306',v_staff.id,5,'09:00','17:00',false);
    raise exception 'invalid day-off accepted';
  exception when check_violation then null; end;
  update public.staff set metadata = '{"is_test":true}' where id = v_staff.id;
  begin
    insert into public.staff_schedules (id,staff_id,day_of_week,start_time,end_time)
    values ('00000000-0000-0000-0000-000000000307',v_staff.id,6,'09:00','17:00');
    raise exception 'test staff schedule accepted';
  exception when check_violation then null; end;
  update public.staff set metadata = '{}', staff_type = 'driver' where id = v_staff.id;
  begin
    insert into public.staff_schedules (id,staff_id,day_of_week,start_time,end_time,shift_type)
    values ('00000000-0000-0000-0000-000000000308',v_staff.id,6,'09:00','17:00','opening');
    raise exception 'driver opening shift accepted';
  exception when check_violation then null; end;
  begin
    insert into public.staff_schedules (id,staff_id,day_of_week,start_time,end_time)
    values ('00000000-0000-0000-0000-000000000309',v_staff.id,6,'01:00','23:00');
    raise exception '22-hour shift accepted';
  exception when check_violation then null; end;
  begin
    insert into public.staff_schedules (id,staff_id,day_of_week,start_time,end_time,window_order)
    values ('00000000-0000-0000-0000-000000000310',v_staff.id,6,'09:00','17:00',13);
    raise exception 'out-of-range window order accepted';
  exception when check_violation then null; end;
  select count(*) into v_count from public.staff_schedules;
  if v_count <> 3 then raise exception 'schedule count %, expected 3', v_count; end if;
end $$;

select p.oid::regprocedure::text as signature, l.lanname, p.provolatile, p.prosecdef,
       p.proconfig, pg_catalog.pg_get_userbyid(p.proowner) as owner,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') as service_role_execute
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
join pg_catalog.pg_language l on l.oid=p.prolang
where n.nspname='public' and p.proname in ('staff_is_operational','validate_staff_schedule_window')
order by signature;

select t.tgname,t.tgenabled,pg_catalog.pg_get_triggerdef(t.oid,true) as definition
from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='staff_schedules' and t.tgname='validate_staff_schedule_window_trigger';

select c.relname,c.relrowsecurity, count(p.policyname) as policy_count
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
left join pg_catalog.pg_policies p on p.schemaname=n.nspname and p.tablename=c.relname
where n.nspname='public' and c.relname in ('staff','staff_schedules')
group by c.relname,c.relrowsecurity order by c.relname;
