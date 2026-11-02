# PR #58 current `public.staff` contract — LOCAL recovery

**Scoped result: PASS for LOCAL `staff` reconstruction and focused tests.** Full attendance integration is NOT VERIFIED. Authenticated Supabase TEST, physical-device acceptance, and production release are NOT VERIFIED/NOT APPROVED. This is schema-only TEST preparation, not production SQL or a migration.

## Authorization, target, and source reconciliation

The owner approved only the five remaining prepared catalog SELECTs. The connected Primary Supabase `get_project` call first verified classified PRODUCTION ref `lsrbwqhvzjfpiabeolkv`, name `Creadlehub`, organization `vjjgnftdpdpqbwilmqzm`, region `ap-northeast-1`, status `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.111`. No other production SQL was submitted this turn. The connector's earlier identity query showed privileged `postgres` with `transaction_read_only=off`; we relied on the strict SELECT-only boundary, not a read-only DB role. No operational rows or production public functions were read/executed, and no production write/configuration occurred.

The owner explicitly excludes the historical `department_id`/`job_title` expansion from the isolated attendance TEST baseline. Both fields are absent from the current production column catalog and current generated `src/types/supabase.ts` staff type. A local search found no use in `src/lib` (including the scanner's imported attendance, staff, schedule, booking, and notification paths) or in the accepted QR/attendance SQL functions checked for this task. Historical `20260429000009_staff_expansion.sql` adds them, while `20260513000002_real_staff_rbac_seed.sql` already documents live-schema divergence. Exclusion is limited to this attendance TEST schema; it changes no existing table or migration.

## Exact five executed production catalog statements

All statements below are the remaining five from `PR58-STAFF-SCHEMA-CATALOG-APPROVAL-2026-11-02.md`, submitted with `project_id=lsrbwqhvzjfpiabeolkv` and the Primary account link. Each reads `pg_catalog` only.

```sql
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

## Recovered table contract and limits

The previous two authorized column/identity queries are recorded in `PR58-STAFF-SCHEMA-CATALOG-DRIFT-2026-11-02.md`. Together, the catalog evidence establishes 24 current columns; the seven fields absent from migration DDL are `workspace_access text[] not null default '{}'`, `temporary_access_expires_at timestamptz null`, `access_notes text null`, `merged_into_staff_id uuid null`, `archived_at timestamptz null`, `archive_reason text null`, and `identity_verified_at timestamptz null`. All other current columns, types, defaults, and nullability are in the LOCAL SQL file.

The constraint query returned exactly eight validated, nondeferrable constraints: PK `id`, unique `auth_user_id`, FKs `branch_id → branches(id) ON DELETE RESTRICT`, `auth_user_id → auth.users(id) ON DELETE SET NULL`, `merged_into_staff_id → staff(id)` with default NO ACTION update/delete, and checks on staff type, system role, and tier. The index query returned exactly eight valid indexes: `staff_pkey`, `staff_auth_user_id_key`, `idx_staff_auth_user_id` (partial nonnull), `idx_staff_branch_id`, `idx_staff_role_active` (active partial), `staff_metadata_gin_idx`, `staff_operational_branch_idx` (archived/merged null partial), and `staff_unique_auth_user_id` (partial unique nonnull).

RLS is enabled, not forced. Seven permissive authenticated policies were recovered and reproduced: own read, owner all, manager branch read, driver branch read, CSR branch read, operational branch read, and operational branch update with protected-role exclusion. The LOCAL `pg_get_expr` policy output matched the production expressions. The table owner is `postgres`; table ACL `arwdDxtm` is explicitly held by `postgres`, `anon`, `authenticated`, and `service_role`; nine `authenticated=w` column ACL entries were reproduced. Three enabled user triggers attach to `staff`: front-desk role normalization, device-branch sync, and updated-at maintenance. Their helper function behavior was transcribed from accepted migration source; the approved production queries identified the attached function signatures but did **not** retrieve those function bodies.

**Security boundary:** The current production ACL includes `anon` TRUNCATE and other broad table privileges. RLS does not govern TRUNCATE. The LOCAL file mirrors the existing catalog for fidelity; its anon SELECT test only proves row visibility is denied under the fixture policies. This grant merits a separate owner/security decision before any TEST deployment or production change. It is not a new grant proposal.

The fifth catalog query returned a very large direct-dependency result, including column defaults and inbound FK metadata. The tool output could not be fully retained after parsing/truncation, so the exhaustive `pg_depend` inventory is **not verified**. No repeat or narrowed production query was run because authorization covered only the five prepared statements. The staff's own constraints/indexes/policies and three user trigger definitions were captured by their dedicated queries. Inbound FK dependencies and production trigger-function bodies remain outside the proven LOCAL staff contract.

## LOCAL SQL and execution evidence

| File | SHA-256 | Purpose |
|---|---|---|
| `tests/database/pr58-staff-current-contract-local.sql` | `87D21F48EE1EBCAF9DBA9E58A04B056D9B8CEA8AB71AB6EE4AB22262DD122F2D` | Recovered staff table, constraints, indexes, grants, policies, helper functions, three triggers. |
| `tests/database/pr58-staff-current-contract-local-prereqs.sql` | `1F9DBB7F5398E1A93C954A1E087595E34E27D63CD122F8B315766B60E836C22C` | Synthetic LOCAL Auth and branch prerequisites only. |
| `tests/database/pr58-staff-current-contract-local-dependencies.sql` | `D8001DAE1B2BC38EA1E9C76D99F62950726721AE9F2F674BE737215B6C039033` | Narrow LOCAL device/schedule projections for trigger and overlay tests. |
| `tests/database/pr58-staff-current-contract-local-test.sql` | `D62462F9BAC2A6662FF1379303ADB250876BF7CDDDA9FA98C9E2EEF368DB4BD3` | Catalog assertions and synthetic behavior/RLS checks. |

Reused unchanged `pr58-staff-duty-assignments-baseline.sql` SHA-256 `C13D3F16AA2D800FB633CCA08AB28B77C80E1B640740BCD7ADC39CE8C76E0AC6` and `pr58-schedule-local-correction.sql` SHA-256 `A4B7B0BDC4B54E4F1C1FF0FC4C2340A73863DC49E414A9BFF5E3E46FFD6ABDC0`. The original accepted schedule definitions remain untouched; the syntax overlay is LOCAL/TEST-only.

LOCAL target: disposable PostgreSQL **17.11** on `127.0.0.1:55443`, database `pr58_staff_contract_verified_20261102`. Exact final commands from the fix worktree:

```powershell
& 'E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin\postgres.exe' -D 'E:\cradlehub\.tmp\pr58-duty-pg17-data' -h 127.0.0.1 -p 55443
& 'E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin\createdb.exe' -h 127.0.0.1 -p 55443 -U postgres pr58_staff_contract_verified_20261102
& 'E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin\psql.exe' -X -q -1 -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 55443 -U postgres -d pr58_staff_contract_verified_20261102 -f 'tests/database/pr58-staff-current-contract-local-prereqs.sql' -f 'tests/database/pr58-staff-current-contract-local.sql' -f 'tests/database/pr58-staff-current-contract-local-dependencies.sql' -f 'tests/database/pr58-staff-duty-assignments-baseline.sql' -f 'tests/database/pr58-schedule-local-correction.sql' -f 'tests/database/pr58-staff-current-contract-local-test.sql'
Get-FileHash tests/database/pr58-staff-current-contract-local*.sql -Algorithm SHA256
```

These two further LOCAL `psql` calls compared the catalog outputs (the first on `pr58_staff_contract_20261102`, the second on that same disposable run):

```powershell
& 'E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin\psql.exe' -X -A -F '|' -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 55443 -U postgres -d pr58_staff_contract_20261102 -c "select c.relrowsecurity,c.relforcerowsecurity,c.relacl::text from pg_catalog.pg_class c where c.oid='public.staff'::regclass;" -c "select a.attname,a.attacl::text from pg_catalog.pg_attribute a where a.attrelid='public.staff'::regclass and a.attacl is not null order by a.attnum;" -c "select t.tgname,t.tgenabled from pg_catalog.pg_trigger t where t.tgrelid='public.staff'::regclass and not t.tgisinternal order by t.tgname;"
& 'E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin\psql.exe' -X -A -F '|' -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 55443 -U postgres -d pr58_staff_contract_20261102 -c "select polname,polcmd,pg_catalog.pg_get_expr(polqual,polrelid),pg_catalog.pg_get_expr(polwithcheck,polrelid) from pg_catalog.pg_policy where polrelid='public.staff'::regclass order by polname;"
```

Both exited **0**. The first returned RLS `true`, forced `false`, the full catalog-matching table ACL, nine `authenticated=w` column ACL rows, and all three user triggers enabled `O`. The second returned seven `pg_get_expr` policy expressions matching the captured production expressions. The final `psql` invocation exited **0** in one transaction and printed `PR58 current staff contract LOCAL checks passed`. Assertions covered 24 columns, eight constraints/indexes, seven policies, three enabled user triggers, every table privilege for three roles, role/type checks, branch RESTRICT, merged-staff FK, Auth SET NULL, active versus archived/merged/test staff, normal and overnight scheduling, driver-opening and archived-schedule rejections, role normalization, device branch sync, updated-at maintenance, anon row-read denial, manager branch/owner update denial, and driver branch reads. All fixture rows are synthetic.

Independent read-only SQL reviewer: **PASS for scoped LOCAL `staff` reconstruction** after correcting the function-source description and testing each privilege individually. No material SQL mismatch remained in the reviewed files.

## Remaining baseline dependencies

1. Auth `auth.users`/`auth.uid()` and platform role behavior are narrow LOCAL fixtures, not authenticated Supabase TEST proof. Device and schedule prerequisite tables are also narrow projections; their complete accepted contracts, triggers, and RLS remain to be assembled separately.
2. Final scanner dependencies—QR points/events, branch resolution, device registration, geofence, attendance checkins/transaction RPC, booking/session, room/resource, notifications, and related conditional schema DDL—remain unclosed as an executable curated baseline. Do not revive the discarded 1,302-statement historical candidate or bulk replay migrations.
3. The direct dependency catalog output was not fully retained; production trigger-function bodies were not inspected under this authorization. The production schedule composite-field syntax remains an unresolved compatibility concern, not a verified live failure.
4. The existing broad `anon` table ACL needs a separate security decision before TEST deployment. No staff schema or privilege change to PRODUCTION is authorized.

Rollback: the three named disposable LOCAL staff-test databases were dropped, and the LOCAL PostgreSQL server was stopped. The files are a local fix-branch commit only. There is no production rollback because production was not changed.
