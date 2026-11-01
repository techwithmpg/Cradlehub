# PR #58 — classified production metadata recovery and LOCAL duty contract validation

**Scoped verdict:** PASS for recovering `public.staff_duty_assignments` and validating its schema plus the existing scanner-grant ledger on disposable LOCAL PostgreSQL 17. **Full attendance QR integration remains NOT VERIFIED.** This record supersedes the missing-contract blocker for this one table; it does not make the object inventory in [the TEST manifest](PR58-TEST-SCHEMA-MANIFEST-2026-11-01.md) an executable full scanner baseline.

## Target and read-only boundary

- The Supabase `get_project` metadata call on the connected `Primary` account (`link_6ad23eea34d88191b02525c6eab09451`) returned ref `lsrbwqhvzjfpiabeolkv`, name `Creadlehub`, organization `vjjgnftdpdpqbwilmqzm`, region `ap-northeast-1`, status `ACTIVE_HEALTHY`, database host under that ref, and PostgreSQL engine 17. This project is classified **PRODUCTION**. No TEST project was touched or created.
- The first catalog query confirmed that `public.staff_duty_assignments` exists as an ordinary table. It also returned `current_user=postgres` and `transaction_read_only=off`. Thus the connector did **not** enforce a read-only database role. The audit boundary was enforced by issuing only the exact catalog `SELECT` statements below. No table-row SELECT, production RPC call, DML, DDL, migration, configuration change, credential read, or export was executed.
- Production reported PostgreSQL `17.6.1.111`; the disposable LOCAL binary was PostgreSQL `17.11`. Minor-version equivalence for the whole application is not established by this focused test.

## Recovered table contract

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |
| `staff_id` | `uuid` | no | none |
| `branch_id` | `uuid` | no | none |
| `day_of_week` | `smallint` | no | none |
| `duty_type` | `text` | no | none |
| `is_active` | `boolean` | no | `true` |
| `created_at` | `timestamptz` | no | `now()` |

Catalog constraints are primary key `id`; unique `(staff_id, day_of_week, duty_type)`; weekday check `0..6`; duty type check `opening`/`closing`; foreign keys from `staff_id` to `public.staff(id)` and `branch_id` to `public.branches(id)`, both `ON UPDATE/DELETE NO ACTION`. The two indexes are exactly the primary-key and unique-constraint btree indexes. There are no user-defined triggers, table policies, column-level ACLs, or table options. The table is permanent with default replica identity. Owner is `postgres`; RLS is enabled and not forced; the explicit ACL grants all table privileges only to `postgres` and `service_role`. Client roles have no table grant.

All seven columns agree with `src/types/supabase.ts:5498-5548`; that generated relationship list also names the `operational_staff` view, while the actual FK targets `public.staff`. The accepted migrations never create this table. They reference it in `20260821034409_repair_attendance_branch_authority.sql:534-566` and assume it exists in `20260821020651_reconcile_live_schema_and_secure_internal_tables.sql:439-450`. The production `resolve_effective_attendance_branch(uuid,uuid,date,boolean)` definition returned by `pg_get_functiondef` matches the accepted duty lookup/conflict path: it is `SECURITY DEFINER`, `search_path=public`, and reads duty rows after temporary branch authorization. The second catalog-matched referencing function is `resolve_staff_branch_assignment_issue(...)`; neither function was executed on production.

## Exact production catalog queries

Each statement below was passed to `supabase_execute_sql` with `link_id=link_6ad23eea34d88191b02525c6eab09451` and `project_id=lsrbwqhvzjfpiabeolkv`. All statements query `pg_catalog` or server identity metadata only.

```sql
select current_database() as database_name, current_user as inspector_role, current_setting('transaction_read_only') as transaction_read_only, c.oid::regclass::text as relation, c.relkind, n.nspname as schema_name from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='staff_duty_assignments';

select a.attnum, a.attname, pg_catalog.format_type(a.atttypid,a.atttypmod) as data_type, a.attnotnull as not_null, pg_catalog.pg_get_expr(d.adbin,d.adrelid) as default_expression, a.attidentity, a.attgenerated, a.attcollation::regcollation::text as collation from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where n.nspname='public' and c.relname='staff_duty_assignments' and a.attnum>0 and not a.attisdropped order by a.attnum;

select con.conname, con.contype, pg_catalog.pg_get_constraintdef(con.oid,true) as definition, con.condeferrable, con.condeferred, con.convalidated, con.confdeltype, con.confupdtype from pg_catalog.pg_constraint con where con.conrelid='public.staff_duty_assignments'::regclass order by con.conname;

select i.indexrelid::regclass::text as index_name, i.indisprimary, i.indisunique, i.indisvalid, pg_catalog.pg_get_indexdef(i.indexrelid) as definition from pg_catalog.pg_index i where i.indrelid='public.staff_duty_assignments'::regclass order by i.indexrelid::regclass::text;

select c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity, r.rolname as owner, c.relacl::text as explicit_acl, t.tgname, t.tgenabled, pg_catalog.pg_get_triggerdef(t.oid,true) as trigger_definition from pg_catalog.pg_class c join pg_catalog.pg_roles r on r.oid=c.relowner left join pg_catalog.pg_trigger t on t.tgrelid=c.oid and not t.tgisinternal where c.oid='public.staff_duty_assignments'::regclass order by t.tgname;

select p.polname, p.polcmd, p.polpermissive, (select pg_catalog.array_agg(coalesce(r.rolname,'PUBLIC') order by coalesce(r.rolname,'PUBLIC')) from unnest(p.polroles) x(role_oid) left join pg_catalog.pg_roles r on r.oid=x.role_oid) as roles, pg_catalog.pg_get_expr(p.polqual,p.polrelid) as using_expression, pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid) as check_expression from pg_catalog.pg_policy p where p.polrelid='public.staff_duty_assignments'::regclass order by p.polname;

select a.attname, a.attacl::text as explicit_column_acl from pg_catalog.pg_attribute a where a.attrelid='public.staff_duty_assignments'::regclass and a.attnum>0 and not a.attisdropped order by a.attnum;

select p.oid::regprocedure::text as function_signature, p.prosecdef as security_definer, p.provolatile as volatility, p.proconfig as settings, pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)) as definition_md5 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosrc ilike '%staff_duty_assignments%' order by p.oid::regprocedure::text;

select pg_catalog.pg_get_functiondef('public.resolve_effective_attendance_branch(uuid,uuid,date,boolean)'::regprocedure) as definition;

select c.relpersistence, c.relreplident, c.reloptions, pg_catalog.obj_description(c.oid,'pg_class') as table_comment from pg_catalog.pg_class c where c.oid='public.staff_duty_assignments'::regclass;
```

## LOCAL files and exact validation

- Schema-only correction: `tests/database/pr58-staff-duty-assignments-baseline.sql`, SHA-256 `C13D3F16AA2D800FB633CCA08AB28B77C80E1B640740BCD7ADC39CE8C76E0AC6`. It is **not** a migration and must not be applied to production. It requires the accepted `branches`/`staff` parents and platform roles.
- Existing dedicated ledger migration: `supabase/migrations/20261101043000_staff_scan_grant_ledger.sql`, SHA-256 `05ABD4BD5EBC41FD9B6B93DA5E10395D19DDF25F1FB3AA4A7D924E0FC495C492`; unchanged.
- LOCAL test files: `tests/database/pr58-duty-contract-local-test.sql`, `tests/database/pr58-duty-ledger-local-test.sql`, `tests/database/pr58-duty-ledger-concurrency.mjs`.
- Disposable cluster: `E:\cradlehub\.tmp\pr58-duty-pg17-data`, loopback `127.0.0.1:55439`; final fresh database `pr58_duty_review_test`. The harness copies the accepted initial `branches` and `staff` definitions from `20260429000001_core_tables.sql` and uses a minimal LOCAL `auth.users` prerequisite. It is not a complete Supabase Auth or full scanner schema.

Successful commands from `E:\cradlehub\.tmp\attendance-qr-flow-20261101`:

```powershell
$bin='E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin'
& "$bin\initdb.exe" -D 'E:\cradlehub\.tmp\pr58-duty-pg17-data' -U postgres -A trust -E UTF8
& "$bin\postgres.exe" -D 'E:\cradlehub\.tmp\pr58-duty-pg17-data' -h 127.0.0.1 -p 55439
& "$bin\createdb.exe" -h 127.0.0.1 -p 55439 -U postgres pr58_duty_review_test
& "$bin\psql.exe" -X -1 -h 127.0.0.1 -p 55439 -U postgres -d pr58_duty_review_test -v ON_ERROR_STOP=1 -f 'tests/database/pr58-duty-contract-local-test.sql'
& "$bin\psql.exe" -X -1 -h 127.0.0.1 -p 55439 -U postgres -d pr58_duty_review_test -v ON_ERROR_STOP=1 -f 'supabase/migrations/20261101043000_staff_scan_grant_ledger.sql'
& "$bin\psql.exe" -X -1 -h 127.0.0.1 -p 55439 -U postgres -d pr58_duty_review_test -v ON_ERROR_STOP=1 -f 'tests/database/pr58-duty-ledger-local-test.sql'
$env:PGHOST='127.0.0.1'; $env:PGPORT='55439'; $env:PGUSER='postgres'; $env:PGDATABASE='pr58_duty_review_test'; $env:PSQL_PATH="$bin\psql.exe"
node tests/database/pr58-duty-ledger-concurrency.mjs
node --check tests/database/pr58-duty-ledger-concurrency.mjs
git diff --check
```

The final fresh database run returned exit 0 for each SQL/Node command and printed `PR58 duty contract LOCAL SQL passed`, `PR58 duty plus ledger LOCAL SQL passed`, and `PR58 duty plus ledger LOCAL parallel claim passed`. Tests verified exact seven column types/defaults, six named constraint definitions, NO ACTION FK metadata, both constraint indexes, owner/RLS/no-policy/no-trigger state, client grants denied, invalid weekday/type/duplicate/unknown FK rejection, `service_role` RPC claim, wrong-user/code/operation and expiry rejection, replay rejection, transaction rollback behavior, and one winner from parallel claims. The initial ledger test failed because the test expected PostgreSQL to serialize empty `search_path` as `search_path=`; PostgreSQL 17 returned `search_path=""`. The assertion was corrected and the entire sequence passed on a fresh database. The migration itself was unchanged.

The foreground LOCAL server was stopped after testing; a final `pg_isready -h 127.0.0.1 -p 55439` returned `no response`. No listener was left running for the test cluster.

**Independent review:** PASS for the recovered duty DDL and these scoped LOCAL tests after the exact metadata and `service_role` assertions were added. The reviewer found no remaining actionable defect in the four new test/schema files. The complete attendance QR scanner, final branch resolver, attendance transaction RPC, real Supabase Auth/PostgREST, and installed-PWA behavior were not executed in this narrow fixture. Those remain outside the scope of this recovered table's PASS and require the dependency-closed full baseline and classified TEST acceptance before release.
