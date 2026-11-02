-- Run only after prereqs, current staff contract, local dependencies, unchanged
-- recovered duty table, and unchanged schedule compatibility overlay.
insert into public.branches (id,name,address) values
  ('00000000-0000-0000-0000-000000000201','TEST Main','Synthetic Main'),
  ('00000000-0000-0000-0000-000000000202','TEST SM','Synthetic SM');
insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000102'),
  ('00000000-0000-0000-0000-000000000103'),
  ('00000000-0000-0000-0000-000000000104');
insert into public.staff (id,branch_id,auth_user_id,full_name,system_role,staff_type) values
  ('00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000101','Synthetic Owner','owner','managerial'),
  ('00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000102','Synthetic Manager','manager','managerial'),
  ('00000000-0000-0000-0000-000000000303','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000103','Synthetic Therapist','staff','therapist'),
  ('00000000-0000-0000-0000-000000000304','00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000104','Synthetic Driver','driver','driver');

insert into public.staff_devices (id,staff_id,branch_id,status)
values ('00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000303','00000000-0000-0000-0000-000000000201','active');

do $$
declare s public.staff%rowtype; n integer; rname text; pname text;
begin
  if exists (select 1 from pg_catalog.pg_attribute
    where attrelid='public.staff'::regclass and attname in ('department_id','job_title')
      and not attisdropped) then raise exception 'excluded historical columns present'; end if;
  if (select count(*) from pg_catalog.pg_attribute
    where attrelid='public.staff'::regclass and attnum>0 and not attisdropped) <> 24 then
    raise exception 'staff column count differs from catalog';
  end if;
  if (select count(*) from pg_catalog.pg_constraint
    where conrelid='public.staff'::regclass) <> 8 then
    raise exception 'staff constraints differ from catalog'; end if;
  if (select count(*) from pg_catalog.pg_index
    where indrelid='public.staff'::regclass) <> 8 then
    raise exception 'staff indexes differ from catalog'; end if;
  if (select count(*) from pg_catalog.pg_policy
    where polrelid='public.staff'::regclass) <> 7 then
    raise exception 'staff policies differ from catalog'; end if;
  if (select count(*) from pg_catalog.pg_trigger
    where tgrelid='public.staff'::regclass and not tgisinternal) <> 3 then
    raise exception 'staff user triggers differ from catalog'; end if;
  if not (select relrowsecurity from pg_catalog.pg_class
    where oid='public.staff'::regclass) then raise exception 'staff RLS disabled'; end if;
  foreach rname in array array['anon','authenticated','service_role'] loop
    foreach pname in array array['SELECT','INSERT','UPDATE','DELETE',
                                  'TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] loop
      if not has_table_privilege(rname,'public.staff',pname) then
        raise exception 'staff table grant missing: % %',rname,pname;
      end if;
    end loop;
  end loop;

  begin
    insert into public.staff (id,branch_id,full_name,staff_type)
    values ('00000000-0000-0000-0000-000000000305','00000000-0000-0000-0000-000000000201','Invalid Type','unknown');
    raise exception 'invalid staff type accepted';
  exception when check_violation then null; end;
  begin
    insert into public.staff (id,branch_id,full_name,system_role)
    values ('00000000-0000-0000-0000-000000000306','00000000-0000-0000-0000-000000000201','Invalid Role','unknown');
    raise exception 'invalid system role accepted';
  exception when check_violation then null; end;
  begin
    delete from public.branches where id='00000000-0000-0000-0000-000000000201';
    raise exception 'referenced branch deletion accepted';
  exception when foreign_key_violation then null; end;
  begin
    update public.staff set merged_into_staff_id='00000000-0000-0000-0000-000000000399'
      where id='00000000-0000-0000-0000-000000000303';
    raise exception 'invalid merged-staff reference accepted';
  exception when foreign_key_violation then null; end;
  insert into auth.users (id) values ('00000000-0000-0000-0000-000000000105');
  insert into public.staff (id,branch_id,auth_user_id,full_name)
  values ('00000000-0000-0000-0000-000000000305','00000000-0000-0000-0000-000000000201',
          '00000000-0000-0000-0000-000000000105','Transient Synthetic');
  delete from auth.users where id='00000000-0000-0000-0000-000000000105';
  if (select auth_user_id from public.staff where id='00000000-0000-0000-0000-000000000305') is not null then
    raise exception 'auth deletion did not clear staff reference'; end if;
  delete from public.staff where id='00000000-0000-0000-0000-000000000305';

  select * into s from public.staff where id='00000000-0000-0000-0000-000000000303';
  if public.staff_is_operational(s) is not true then raise exception 'active staff rejected'; end if;
  update public.staff set archived_at=now() where id=s.id;
  select * into s from public.staff where id=s.id;
  if public.staff_is_operational(s) is not false then raise exception 'archived staff accepted'; end if;
  update public.staff set archived_at=null, merged_into_staff_id='00000000-0000-0000-0000-000000000301' where id=s.id;
  select * into s from public.staff where id=s.id;
  if public.staff_is_operational(s) is not false then raise exception 'merged staff accepted'; end if;
  update public.staff set merged_into_staff_id=null, metadata='{"is_test":true}'::jsonb where id=s.id;
  select * into s from public.staff where id=s.id;
  if public.staff_is_operational(s) is not false then raise exception 'test staff accepted'; end if;
  update public.staff set metadata='{}'::jsonb where id=s.id;

  insert into public.staff_schedules (id,staff_id,day_of_week,start_time,end_time)
  values ('00000000-0000-0000-0000-000000000501',s.id,1,'09:00','17:00');
  insert into public.staff_schedules (id,staff_id,day_of_week,start_time,end_time,ends_next_day)
  values ('00000000-0000-0000-0000-000000000502',s.id,2,'18:00','02:00',true);
  begin
    insert into public.staff_schedules (id,staff_id,day_of_week,start_time,end_time,shift_type)
    values ('00000000-0000-0000-0000-000000000503','00000000-0000-0000-0000-000000000304',1,'09:00','17:00','opening');
    raise exception 'driver opening shift accepted';
  exception when check_violation then null; end;
  update public.staff set archived_at=now() where id=s.id;
  begin
    insert into public.staff_schedules (id,staff_id,day_of_week,start_time,end_time)
    values ('00000000-0000-0000-0000-000000000504',s.id,3,'09:00','17:00');
    raise exception 'archived staff schedule accepted';
  exception when check_violation then null; end;
  update public.staff set archived_at=null where id=s.id;
  select count(*) into n from public.staff_schedules;
  if n<>2 then raise exception 'unexpected schedule count %',n; end if;

  update public.staff set system_role='csr' where id=s.id;
  if (select system_role from public.staff where id=s.id)<>'crm' then
    raise exception 'front desk normalization trigger failed'; end if;
  update public.staff set branch_id='00000000-0000-0000-0000-000000000202', updated_at='2000-01-01'
    where id=s.id;
  if (select branch_id from public.staff_devices where staff_id=s.id)
      <>'00000000-0000-0000-0000-000000000202'::uuid then
    raise exception 'device branch sync trigger failed'; end if;
  if (select updated_at from public.staff where id=s.id)<='2000-01-01'::timestamptz then
    raise exception 'updated_at trigger failed'; end if;
end $$;

set role anon;
do $$ begin
  if (select count(*) from public.staff)<>0 then raise exception 'anon staff row visible'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',false);
set role authenticated;
do $$ declare n integer; begin
  select count(*) into n from public.staff;
  if n<>2 then raise exception 'manager RLS row count %, expected 2',n; end if;
  update public.staff set phone='synthetic' where id='00000000-0000-0000-0000-000000000301';
  if found then raise exception 'manager updated protected owner row'; end if;
  update public.staff set phone='synthetic' where id='00000000-0000-0000-0000-000000000303';
  if found then raise exception 'manager updated staff in another branch'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000104',false);
set role authenticated;
do $$ declare n integer; begin
  select count(*) into n from public.staff;
  if n<>2 then raise exception 'driver RLS row count %, expected 2',n; end if;
end $$;
reset role;

select 'PR58 current staff contract LOCAL checks passed' as result;
