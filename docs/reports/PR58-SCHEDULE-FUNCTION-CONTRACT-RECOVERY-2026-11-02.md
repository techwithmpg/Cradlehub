# PR #58 schedule function contract recovery — 2026-11-02

**Scope:** read-only PRODUCTION catalog inspection of three owner-named objects; LOCAL PostgreSQL 17.11 correction/test only. No production function execution or writes, remote provisioning, migration application, push, deploy, or merge.

## Repository and provenance

- Branch: `fix/attendance-qr-flow-20261101`; initial HEAD `86d17c2b6f1626f2312f15a060349d2c62dd109e`, initially clean. `git fetch origin main` resolved accepted `origin/main` and `FETCH_HEAD` to `18bfb406bdfbd94c0a56581446bce9b74e131162`; merge base `f3291826a1fb1a61107e5ce87591cd9e0b7524ef`.
- `supabase/migrations/20260712165012_backend_stabilization_schedule_repair.sql:49-92` first defines `staff_metadata_flag` and `staff_is_operational`. Its schedule validator/trigger are at `:448-507`.
- `supabase/migrations/20260713035024_schedule_update_integration_repair.sql:21-64` repeats the metadata and operational functions (same unparenthesized composite dereferences); `:77-149` supplies time-window helpers; `:401-496` replaces the schedule validator and trigger with explicit overnight, day-off, order, and duration checks. The later definition is accepted/current.
- `supabase/migrations/20260429000001_core_tables.sql:59-106`, the May/June schedule migrations, and `src/types/supabase.ts:4229,6082` establish the LOCAL fixture's narrow table-column projection. It is **not** a full production or Supabase TEST schema baseline.

## Classified PRODUCTION catalog evidence

Supabase `get_project` for `lsrbwqhvzjfpiabeolkv` on the Primary link returned CradleHub project `Creadlehub`, organization `vjjgnftdpdpqbwilmqzm`, region `ap-northeast-1`, status `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.111`. The SQL connector reported `current_user=postgres` and `transaction_read_only=off`; therefore **only catalog SELECT statements** were submitted. No operational table rows were read.

The three exact catalog SELECT statements submitted through `execute_sql` were:

```sql
select current_user as inspector_role, current_setting('transaction_read_only') as transaction_read_only, p.oid::regprocedure::text as signature, l.lanname as language, pg_catalog.pg_get_userbyid(p.proowner) as owner, p.provolatile as volatility, p.prosecdef as security_definer, p.proconfig as settings, p.proacl::text as explicit_acl, has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute, has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute, has_function_privilege('service_role',p.oid,'EXECUTE') as service_role_execute, pg_catalog.pg_get_functiondef(p.oid) as definition from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace join pg_catalog.pg_language l on l.oid=p.prolang where n.nspname='public' and p.proname in ('staff_is_operational','validate_staff_schedule_window') order by p.oid::regprocedure::text;
```

```sql
select t.tgname, t.tgenabled, t.tgisinternal, t.tgfoid::regprocedure::text as trigger_function, pg_catalog.pg_get_triggerdef(t.oid,true) as definition, pg_catalog.pg_get_userbyid(c.relowner) as table_owner from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='staff_schedules' and t.tgname='validate_staff_schedule_window_trigger';
```

```sql
select p.oid::regprocedure::text as function_signature, p.prosqlbody is not null as parsed_sql_body, d.deptype, d.refclassid::regclass::text as referenced_catalog, pg_catalog.pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid) as referenced_object from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace left join pg_catalog.pg_depend d on d.classid='pg_catalog.pg_proc'::regclass and d.objid=p.oid where n.nspname='public' and p.proname in ('staff_is_operational','validate_staff_schedule_window') order by function_signature,referenced_catalog,referenced_object;
```

Results: `staff_is_operational(staff)` is SQL/STABLE/SECURITY INVOKER, owner `postgres`, `search_path=public`. Its stored `pg_get_functiondef` contains the **same** eight unparenthesized `p_staff.field` references and all the same flags and predicates as both repository versions. `validate_staff_schedule_window()` is PL/pgSQL/VOLATILE/SECURITY INVOKER, owner `postgres`, `search_path=public`; its stored definition matches the later repository validator, including the call to `staff_is_operational(v_staff)`. Both functions have explicit ACL `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` and effective EXECUTE true for anon, authenticated, and service_role. Both have `prosqlbody` null. Catalog dependencies: operational function → `public` schema and `staff` type; validator → `public` schema and PL/pgSQL language. PL/pgSQL body references are not fully captured by `pg_depend`.

The `validate_staff_schedule_window_trigger` exists on `public.staff_schedules`, is non-internal, enabled `O`, and is `BEFORE INSERT OR UPDATE FOR EACH ROW EXECUTE FUNCTION validate_staff_schedule_window()`. Table owner is `postgres`. Production stores **no corrected composite-field variant**. Its mere catalog presence is not evidence that its SQL body executes successfully.

## LOCAL-only correction and validation

The original source's `p_staff.archived_at` etc. are parsed as relation-qualified columns; LOCAL PostgreSQL 17.11 failed to compile the previous full baseline at `tests/database/pr58-attendance-qr-baseline-candidate.sql:5152` with `missing FROM-clause entry for table "p_staff"`. The LOCAL correction changes all and only eight dereferences to `(p_staff).field`, which selects the same fields of the composite argument. Every boolean condition, metadata flag/default, function attribute, helper body, schedule validator body, and trigger definition remains byte-for-byte the accepted later source. No accepted migration or production object was edited. Effective LOCAL EXECUTE privileges match the named production roles through PostgreSQL's default PUBLIC grant plus accepted authenticated/service_role grants; the LOCAL fixture does not reproduce the production ACL text byte-for-byte.

Files and SHA-256:

| File | SHA-256 |
|---|---|
| `tests/database/pr58-schedule-local-fixture.sql` | `26778E1E7B550DC1EC90E22548F1C2E825A9F9BADFCDCE023A7F9381EDD1CF00` |
| `tests/database/pr58-schedule-local-correction.sql` | `A4B7B0BDC4B54E4F1C1FF0FC4C2340A73863DC49E414A9BFF5E3E46FFD6ABDC0` |
| `tests/database/pr58-schedule-local-tests.sql` | `928FD6B67101167A89015DD4B03A623EF7BDA0E004067CA88F31F644AFF725E8` |

Relevant exact commands (all LOCAL, `E:\cradlehub\.tmp\attendance-qr-flow-20261101` worktree; binaries at `E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin`):

```powershell
git fetch origin main
git rev-parse HEAD
git rev-parse origin/main
git rev-parse FETCH_HEAD
git merge-base HEAD origin/main
& 'E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin\postgres.exe' -D 'E:\cradlehub\.tmp\pr58-duty-pg17-data' -h 127.0.0.1 -p 55441
& 'E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin\createdb.exe' -h 127.0.0.1 -p 55441 -U postgres pr58_schedule_final_20261102
& 'E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin\psql.exe' -X -v ON_ERROR_STOP=1 -1 -h 127.0.0.1 -p 55441 -U postgres -d pr58_schedule_final_20261102 -f 'tests/database/pr58-schedule-local-fixture.sql' -f 'tests/database/pr58-schedule-local-correction.sql' -f 'tests/database/pr58-schedule-local-tests.sql'
Get-FileHash tests/database/pr58-schedule-local-fixture.sql,tests/database/pr58-schedule-local-correction.sql,tests/database/pr58-schedule-local-tests.sql -Algorithm SHA256
git diff --check
```

The final `psql` run exited 0 with `ON_ERROR_STOP=1` and one transaction. The six functions and trigger compiled. The test DO block passed: operational/disabled staff flags; normal, overnight, and inactive day-off schedules; and rejection of overlap, unflagged overnight, invalid day-off, test staff, driver opening shift, 22-hour shift, and window order 13. Catalog checks showed corrected functions owned by postgres, expected language/volatility/invoker/search path/effective execute permissions; trigger enabled `O`; LOCAL fixture staff and schedules RLS enabled with zero policies. `git diff --check` passed.

Independent read-only reviewer verdict: **PASS for this scoped LOCAL schedule contract**. Reviewer verified all six function bodies and trigger against accepted source, with only the eight parenthesized field references changed, and reviewed the final negative tests. This does **not** establish full dependency-closed attendance TEST baseline, production function execution, production RLS behavior, or authenticated Supabase TEST acceptance. Those remain separate gates. No historical migration was bulk replayed or marked applied.
