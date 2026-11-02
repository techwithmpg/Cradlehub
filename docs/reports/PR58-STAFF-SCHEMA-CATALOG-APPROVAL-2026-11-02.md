# PR #58 `public.staff` contract recovery — approval checkpoint

**State: production catalog access NOT AUTHORIZED for this turn.** This document prepares a read-only inspection; no query below has been executed. No production rows, functions, or configuration were accessed. The requested LOCAL correction and review depend on the owner approving this exact metadata scope.

## Verified local state and source

- Worktree `fix/attendance-qr-flow-20261101` is clean at `247f33c7ec6b21dc12e3854a28ebafc9852d0f68`. A fresh `git fetch origin main` resolved `FETCH_HEAD` and `origin/main` to `18bfb406bdfbd94c0a56581446bce9b74e131162`. Existing `safety/pr58-pre-main-integration-20261101` remains present.
- `supabase/migrations/20260429000001_core_tables.sql:59-78` creates `public.staff` without `archived_at` or `merged_into_staff_id`. A repository-wide migration SQL search found uses but no DDL defining either field. `src/types/supabase.ts:4233,4245,4317-4326` lists both as nullable and reports a self-FK name but does not establish defaults, constraints, FK actions, indexes, ACL, or RLS.
- `src/lib/attendance/scan-engine.ts:936-938,1273-1275,1824-1826,3398-3400,4298-4300` selects these fields in staff/device authorization paths. The accepted `staff_is_operational` definitions at `20260712165012_backend_stabilization_schedule_repair.sql:74-91` and `20260713035024_schedule_update_integration_repair.sql:46-63` also reference both; the accepted schedule validator calls it. The prior LOCAL attempt failed at missing `archived_at` after applying the reviewed composite-field syntax in a disposable candidate.
- The recovered duty table SQL remains unchanged, SHA-256 `C13D3F16AA2D800FB633CCA08AB28B77C80E1B640740BCD7ADC39CE8C76E0AC6`. The schedule LOCAL-only overlay remains unchanged, SHA-256 `A4B7B0BDC4B54E4F1C1FF0FC4C2340A73863DC49E414A9BFF5E3E46FFD6ABDC0`. Prior focused LOCAL tests passed; neither is production release evidence.

## Remaining dependency inventory before another baseline attempt

| Category | Evidence and status |
|---|---|
| Authoritatively established | Base `branches`, `staff`, `staff_schedules`, `staff_shift_checkins`, `qr_points`, `staff_devices`, `qr_scan_events`, and `branch_resources` have repository `CREATE TABLE` sources; later final column/constraint/policy closure remains to be curated and tested. `staff_duty_assignments` has a scoped catalog-recovered, LOCAL-tested definition. Schedule functions/trigger have scoped production catalog evidence and a separate reviewed LOCAL syntax overlay. The dedicated scanner-grant migration is source-defined and previously tested only with a narrow LOCAL fixture; it must follow the complete prerequisite schema. |
| LOCAL fixtures only | `auth.users`, `auth.uid()`, `auth.role()`, and platform roles in the prior local prerequisite file are test stubs, not authenticated Supabase Auth/PostgREST. The schedule and duty tests use narrow table projections. These cannot establish production table permissions or full QR integration. |
| Missing accepted source contract | `public.staff.archived_at` and `public.staff.merged_into_staff_id` are required by the scanner but have no migration DDL. Generated types additionally list `access_notes`, `archive_reason`, `identity_verified_at`, `temporary_access_expires_at`, and `workspace_access` without corresponding repository migration definitions found by the scoped search; whether those are present and relevant to the complete staff contract requires the same catalog inspection. The generated type relationship list and historical staff DDL also differ in column inventory. |
| Source present, final integration unverified | The scanner's branch resolver, device registration, geofence, transactional attendance RPC, booking/session, and room/resource paths span later migrations and conditional DDL. The prior 1,302-statement generator skipped conditional blocks and repeated historical DDL; it is discarded. Final RLS/policy/grant closure and source-selected definition order have not been proven. No further full compile should start until staff contract recovery and a curated object inventory. |

## Proposed production read-only catalog boundary

**Target if approved:** connected Primary Supabase project ref `lsrbwqhvzjfpiabeolkv`, classified PRODUCTION. First verify that exact project ref, name, organization, and region with `get_project`; stop on mismatch. The prior connector exposed `postgres` with `transaction_read_only=off`, so do not rely on enforced read-only access. Submit only the following `pg_catalog` SELECT statements. They read metadata for `public.staff` and its directly attached objects, not operational table rows. Do not execute `public` functions, DML, DDL, migrations, or maintenance.

```sql
select current_database() as database_name, current_user as inspector_role,
       current_setting('transaction_read_only') as transaction_read_only,
       c.oid::regclass::text as relation, c.relkind,
       pg_catalog.pg_get_userbyid(c.relowner) as owner,
       c.relrowsecurity, c.relforcerowsecurity, c.relacl::text as table_acl,
       n.nspacl::text as schema_acl
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='staff';

select a.attnum, a.attname,
       pg_catalog.format_type(a.atttypid,a.atttypmod) as data_type,
       a.attnotnull as not_null,
       pg_catalog.pg_get_expr(d.adbin,d.adrelid) as default_expression,
       a.attidentity, a.attgenerated, a.attacl::text as column_acl
from pg_catalog.pg_attribute a
join pg_catalog.pg_class c on c.oid=a.attrelid
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
where n.nspname='public' and c.relname='staff'
  and a.attnum>0 and not a.attisdropped
order by a.attnum;

select con.conname, con.contype,
       pg_catalog.pg_get_constraintdef(con.oid,true) as definition,
       con.condeferrable, con.condeferred, con.convalidated,
       con.confrelid::regclass::text as referenced_relation,
       con.confupdtype, con.confdeltype, con.confmatchtype
from pg_catalog.pg_constraint con
where con.conrelid='public.staff'::regclass
order by con.conname;

select i.indexrelid::regclass::text as index_name,
       i.indisprimary, i.indisunique, i.indisvalid,
       pg_catalog.pg_get_indexdef(i.indexrelid) as definition,
       pg_catalog.pg_get_expr(i.indpred,i.indrelid) as predicate
from pg_catalog.pg_index i
where i.indrelid='public.staff'::regclass
order by index_name;

select p.polname, p.polcmd, p.polpermissive,
       array(select r.rolname from pg_catalog.pg_roles r
             where r.oid=any(p.polroles) order by r.rolname) as roles,
       pg_catalog.pg_get_expr(p.polqual,p.polrelid) as using_expression,
       pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid) as check_expression
from pg_catalog.pg_policy p
where p.polrelid='public.staff'::regclass
order by p.polname;

select t.tgname, t.tgenabled, t.tgisinternal,
       t.tgfoid::regprocedure::text as function_signature,
       pg_catalog.pg_get_triggerdef(t.oid,true) as definition
from pg_catalog.pg_trigger t
where t.tgrelid='public.staff'::regclass
order by t.tgname;

select d.classid::regclass::text as dependent_catalog,
       pg_catalog.pg_describe_object(d.classid,d.objid,d.objsubid) as dependent_object,
       d.deptype, d.refobjsubid,
       pg_catalog.pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid) as referenced_object
from pg_catalog.pg_depend d
where d.refclassid='pg_catalog.pg_class'::regclass
  and d.refobjid='public.staff'::regclass
  and d.classid in ('pg_catalog.pg_constraint'::regclass,
                    'pg_catalog.pg_trigger'::regclass,
                    'pg_catalog.pg_attrdef'::regclass,
                    'pg_catalog.pg_class'::regclass)
order by dependent_catalog, dependent_object;
```

The table-level and column-level ACLs, RLS flags, and policy expressions are included because a LOCAL schema correction must preserve authorization. The query set returns direct metadata only; it does not inspect dependent function bodies or any operational rows. If an attached trigger/function or dependency needs a broader inspection, stop and seek a separate scope decision.

## Decision and next step

Owner approval is required **before** invoking `get_project` or any production catalog SELECT for this task. After approval, compare catalog results with accepted source; stop on material drift. Only then prepare narrowly scoped LOCAL SQL, test in disposable PostgreSQL 17, and obtain independent review. No executable LOCAL correction SQL or SHA-256 can honestly be reported yet. Complete attendance integration, authenticated Supabase TEST, physical-device acceptance, and production release remain unverified/unapproved.

An independent read-only reviewer passed this **query-scope proposal only**: all seven statements are catalog SELECTs within the table/dependency scope, and the repository gap is supported. The dependency query may expose inbound foreign-key metadata for other tables that reference `staff`; inspect results before sharing and stop if any output exceeds the authorized contract. No production access or LOCAL correction was performed during that review.
