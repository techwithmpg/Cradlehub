\set ON_ERROR_STOP on

-- Run only after pr58-duty-contract-local-test.sql and the dedicated scanner
-- grant migration, in the same disposable LOCAL PostgreSQL 17 database.
do $$ declare claim_oid oid; begin
  if not (select relrowsecurity from pg_catalog.pg_class
      where oid='public.staff_scan_grants'::regclass) then
    raise exception 'scanner grant RLS disabled';
  end if;
  if has_table_privilege('anon','public.staff_scan_grants','SELECT')
    or has_table_privilege('authenticated','public.staff_scan_grants','SELECT')
    or has_table_privilege('authenticated','public.staff_scan_grants','INSERT')
    or has_function_privilege('anon','public.claim_staff_scan_grant(text,uuid,text,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.claim_staff_scan_grant(text,uuid,text,uuid)','EXECUTE') then
    raise exception 'browser role can access scanner grants';
  end if;
  if not has_table_privilege('service_role','public.staff_scan_grants','SELECT,INSERT,UPDATE')
    or not has_function_privilege('service_role','public.claim_staff_scan_grant(text,uuid,text,uuid)','EXECUTE') then
    raise exception 'server role lacks scanner grant access';
  end if;
  select 'public.claim_staff_scan_grant(text,uuid,text,uuid)'::regprocedure::oid
    into claim_oid;
  if (select prosecdef from pg_catalog.pg_proc where oid=claim_oid)
    or coalesce((select proconfig[1] from pg_catalog.pg_proc where oid=claim_oid), '')
       not in ('search_path=', 'search_path=""') then
    raise exception 'claim RPC invoker/search path changed';
  end if;
end $$;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');

insert into public.staff_scan_grants
  (token_hash,user_id,public_code,operation_id,created_at,expires_at) values
  ('wrong','00000000-0000-0000-0000-000000000001','att_main',
   '00000000-0000-0000-0000-000000000011',now(),now()+interval '2 minutes'),
  ('replay','00000000-0000-0000-0000-000000000001','att_main',
   '00000000-0000-0000-0000-000000000012',now(),now()+interval '2 minutes'),
  ('expired','00000000-0000-0000-0000-000000000001','att_main',
   '00000000-0000-0000-0000-000000000013',now()-interval '3 minutes',now()-interval '1 second'),
  ('rollback','00000000-0000-0000-0000-000000000001','att_main',
   '00000000-0000-0000-0000-000000000014',now(),now()+interval '2 minutes'),
  ('parallel','00000000-0000-0000-0000-000000000001','att_main',
   '00000000-0000-0000-0000-000000000015',now(),now()+interval '2 minutes');

set role service_role;
do $$ declare claimed uuid; begin
  select public.claim_staff_scan_grant('wrong',
    '00000000-0000-0000-0000-000000000002','att_main',
    '00000000-0000-0000-0000-000000000011') into claimed;
  if claimed is not null then raise exception 'wrong user accepted'; end if;
  select public.claim_staff_scan_grant('wrong',
    '00000000-0000-0000-0000-000000000001','room_main',
    '00000000-0000-0000-0000-000000000011') into claimed;
  if claimed is not null then raise exception 'wrong code accepted'; end if;
  select public.claim_staff_scan_grant('wrong',
    '00000000-0000-0000-0000-000000000001','att_main',
    '00000000-0000-0000-0000-000000000099') into claimed;
  if claimed is not null then raise exception 'wrong operation accepted'; end if;
  select public.claim_staff_scan_grant('expired',
    '00000000-0000-0000-0000-000000000001','att_main',
    '00000000-0000-0000-0000-000000000013') into claimed;
  if claimed is not null then raise exception 'expired token accepted'; end if;

  select public.claim_staff_scan_grant('replay',
    '00000000-0000-0000-0000-000000000001','att_main',
    '00000000-0000-0000-0000-000000000012') into claimed;
  if claimed is distinct from '00000000-0000-0000-0000-000000000012'::uuid then
    raise exception 'valid claim failed';
  end if;
  select public.claim_staff_scan_grant('replay',
    '00000000-0000-0000-0000-000000000001','att_main',
    '00000000-0000-0000-0000-000000000012') into claimed;
  if claimed is not null then raise exception 'replay accepted'; end if;

  begin
    perform public.claim_staff_scan_grant('rollback',
      '00000000-0000-0000-0000-000000000001','att_main',
      '00000000-0000-0000-0000-000000000014');
    raise exception 'simulated interruption';
  exception when raise_exception then null; end;
  select public.claim_staff_scan_grant('rollback',
    '00000000-0000-0000-0000-000000000001','att_main',
    '00000000-0000-0000-0000-000000000014') into claimed;
  if claimed is distinct from '00000000-0000-0000-0000-000000000014'::uuid then
    raise exception 'rolled-back claim stayed consumed';
  end if;
end $$;
reset role;

do $$ begin
  if (select count(*) from public.staff_duty_assignments) <> 2
    or (select count(*) from public.staff) <> 1 then
    raise exception 'grant claims mutated existing attendance dependencies';
  end if;
end $$;

\echo 'PR58 duty plus ledger LOCAL SQL passed'
