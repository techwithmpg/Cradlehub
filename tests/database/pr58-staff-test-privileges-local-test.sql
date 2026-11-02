-- Execute after the passing staff contract suite and the TEST privilege overlay,
-- in the same disposable LOCAL database transaction.
do $$
declare rname text; pname text;
begin
  foreach rname in array array['anon','authenticated','service_role'] loop
    foreach pname in array array['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] loop
      if has_table_privilege(rname,'public.staff',pname) then
        raise exception 'unexpected TEST privilege: % %',rname,pname;
      end if;
    end loop;
  end loop;
  foreach pname in array array['SELECT','INSERT','UPDATE','DELETE'] loop
    if has_table_privilege('anon','public.staff',pname) then
      raise exception 'anon retained staff %',pname;
    end if;
    if not has_table_privilege('authenticated','public.staff',pname)
      or not has_table_privilege('service_role','public.staff',pname) then
      raise exception 'required TEST CRUD privilege missing: %',pname;
    end if;
  end loop;
  if (select count(*) from pg_catalog.pg_policy
      where polrelid='public.staff'::regclass)<>7
    or (select count(*) from pg_catalog.pg_trigger
      where tgrelid='public.staff'::regclass and not tgisinternal)<>3
    or not (select relrowsecurity from pg_catalog.pg_class
      where oid='public.staff'::regclass) then
    raise exception 'RLS or trigger contract changed';
  end if;
end $$;

set role anon;
do $$ begin
  begin
    perform count(*) from public.staff;
    raise exception 'anon SELECT succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.staff (id,branch_id,full_name)
    values ('00000000-0000-0000-0000-000000000399',
            '00000000-0000-0000-0000-000000000201','Denied Anon Insert');
    raise exception 'anon INSERT succeeded';
  exception when insufficient_privilege then null; end;
  begin
    update public.staff set phone='denied' where id='00000000-0000-0000-0000-000000000301';
    raise exception 'anon UPDATE succeeded';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.staff where id='00000000-0000-0000-0000-000000000301';
    raise exception 'anon DELETE succeeded';
  exception when insufficient_privilege then null; end;
  begin
    execute 'truncate public.staff';
    raise exception 'anon TRUNCATE succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
set role authenticated;
do $$ declare n integer; begin
  if public.get_auth_role()<>'owner' then raise exception 'owner auth helper failed'; end if;
  insert into public.staff (id,branch_id,full_name,system_role,staff_type)
  values ('00000000-0000-0000-0000-000000000307',
          '00000000-0000-0000-0000-000000000201','TEST Privilege Target','staff','therapist');
  update public.staff set phone='owner edit' where id='00000000-0000-0000-0000-000000000307';
  if not found then raise exception 'owner UPDATE blocked'; end if;
  delete from public.staff where id='00000000-0000-0000-0000-000000000307';
  if not found then raise exception 'owner DELETE blocked'; end if;
  begin
    execute 'truncate public.staff';
    raise exception 'authenticated TRUNCATE succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

insert into public.staff (id,branch_id,full_name,system_role,staff_type)
values ('00000000-0000-0000-0000-000000000307',
        '00000000-0000-0000-0000-000000000201','TEST Manager Target','staff','therapist');
insert into public.staff_devices (id,staff_id,branch_id,status)
values ('00000000-0000-0000-0000-000000000402',
        '00000000-0000-0000-0000-000000000307',
        '00000000-0000-0000-0000-000000000201','active');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',false);
set role authenticated;
do $$ begin
  if public.get_auth_role()<>'manager'
    or public.get_auth_branch_id()<>'00000000-0000-0000-0000-000000000201'::uuid then
    raise exception 'manager auth helper failed'; end if;
  update public.staff set phone='manager edit' where id='00000000-0000-0000-0000-000000000307';
  if not found then raise exception 'branch manager UPDATE blocked'; end if;
  update public.staff set phone='bad edit' where id='00000000-0000-0000-0000-000000000301';
  if found then raise exception 'manager updated protected owner'; end if;
  begin
    insert into public.staff (id,branch_id,full_name)
    values ('00000000-0000-0000-0000-000000000309',
            '00000000-0000-0000-0000-000000000201','Unauthorized Manager Insert');
    raise exception 'manager INSERT succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',false);
set role authenticated;
update public.staff set branch_id='00000000-0000-0000-0000-000000000202'
  where id='00000000-0000-0000-0000-000000000307';
reset role;
do $$ begin
  if (select branch_id from public.staff_devices
      where staff_id='00000000-0000-0000-0000-000000000307')
     <>'00000000-0000-0000-0000-000000000202'::uuid then
    raise exception 'device branch sync failed after privilege reduction'; end if;
  insert into public.staff_schedules (id,staff_id,day_of_week,start_time,end_time)
  values ('00000000-0000-0000-0000-000000000505',
          '00000000-0000-0000-0000-000000000307',4,'09:00','17:00');
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',false);
set role authenticated;
do $$ begin
  update public.staff set phone='wrong branch' where id='00000000-0000-0000-0000-000000000307';
  if found then raise exception 'manager updated other branch'; end if;
end $$;
reset role;

set role service_role;
do $$ begin
  insert into public.staff (id,branch_id,full_name,system_role,staff_type)
  values ('00000000-0000-0000-0000-000000000308',
          '00000000-0000-0000-0000-000000000201','TEST Server Staff','staff','therapist');
  update public.staff set phone='server edit' where id='00000000-0000-0000-0000-000000000308';
  if not found then raise exception 'service role UPDATE blocked'; end if;
  delete from public.staff where id='00000000-0000-0000-0000-000000000308';
  if not found then raise exception 'service role DELETE blocked'; end if;
  begin
    execute 'truncate public.staff';
    raise exception 'service_role TRUNCATE succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select 'PR58 TEST privilege overlay LOCAL checks passed' as result;
