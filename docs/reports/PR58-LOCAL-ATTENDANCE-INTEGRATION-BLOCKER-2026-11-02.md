# PR #58 LOCAL attendance integration — staff schema stop condition

**Verdict: CORRECTION REQUIRED for the dependency-closed baseline.** This is a LOCAL schema-contract finding, not a verified production scheduling or attendance failure. No production database query or write, remote provisioning, push, merge, deployment, Cron, migration replay, or live attendance test occurred.

## State and provenance

- Worktree `fix/attendance-qr-flow-20261101` began clean at `3086977a8c25d34b608bcf8ef76d87b2fbf027f9`. `git fetch origin main` confirmed accepted `origin/main` and `FETCH_HEAD` at `18bfb406bdfbd94c0a56581446bce9b74e131162`; merge base `f3291826a1fb1a61107e5ce87591cd9e0b7524ef`. Existing safety branch `safety/pr58-pre-main-integration-20261101` was preserved.
- Reused **unchanged** `tests/database/pr58-staff-duty-assignments-baseline.sql`, SHA-256 `C13D3F16AA2D800FB633CCA08AB28B77C80E1B640740BCD7ADC39CE8C76E0AC6`, and the independently reviewed LOCAL-only `tests/database/pr58-schedule-local-correction.sql`, SHA-256 `A4B7B0BDC4B54E4F1C1FF0FC4C2340A73863DC49E414A9BFF5E3E46FFD6ABDC0`. Neither accepted historical schedule definition was edited.
- `E:\cradlehub\.tmp\pr58_build_baseline.py` selected 1,302 statements from accepted repository SQL into a **disposable exploratory candidate**. It reached 39 tables and 55 functions; it is not a curated or accepted baseline because it repeats historical DDL and skips conditional schema `DO` blocks. Only its two `staff_is_operational` bodies were replaced with the exact corrected function body from the reviewed overlay for the compilation probe. No historical migration was executed as a file or marked applied.
- Exploratory candidate was `tests/database/pr58-attendance-qr-baseline-candidate.sql`, 543,772 bytes, SHA-256 `761F567F2C8F1E09349B0F00C664047D4F080E76EF4A530F4160D6C714A82AD9` **at the failed probe**. It is not a final baseline and is discarded after recording this evidence. There is no passing full baseline SQL filename or hash.

## Exact missing contract

`supabase/migrations/20260429000001_core_tables.sql:59-78` creates `public.staff` without `archived_at` or `merged_into_staff_id`. A repository-wide SQL search found later uses but **no** `CREATE TABLE` or `ALTER TABLE ADD COLUMN` source definition for either column. `src/types/supabase.ts:4233,4245,4317-4326` reports nullable fields and a named `staff_merged_into_staff_id_fkey`, but generated types do not establish SQL defaults, nullability constraints, foreign-key actions, indexes, ownership, grants, or RLS. Local test fixtures that declare these columns are projections, not an authoritative production contract.

The reviewed `staff_is_operational(public.staff)` references both columns, and the accepted schedule trigger calls that function. PostgreSQL 17.11 rejected the exploratory baseline at line 5152:

```text
ERROR: column "archived_at" not found in data type staff
LINE 9: and (p_staff).archived_at is null
```

This is the **first unresolved dependency** after the schedule syntax overlay. Its exact SQL contract cannot be reconstructed from accepted migration DDL. Do not add guessed columns or remove the staff-operational check to advance the compile. A separate owner authorization for read-only catalog metadata of `public.staff` should identify both column definitions and the directly associated constraints, foreign-key targets/actions, indexes, owner, RLS, policies, and grants; alternatively supply another accepted authoritative schema definition. Reconcile that evidence with source and generated types before resuming the LOCAL baseline. No production catalog query was made in this task.

## LOCAL commands and results

Target: disposable LOCAL PostgreSQL 17.11 at `127.0.0.1:55442`, database `pr58_attendance_resume_20261102`; Supabase-managed prerequisites in `E:\cradlehub\.tmp\pr58-full-prereqs.sql` are LOCAL stubs and do not prove Auth/PostgREST behavior.

```powershell
git status --short --branch
git rev-parse HEAD
git fetch origin main
git rev-parse FETCH_HEAD
git rev-parse origin/main
git merge-base HEAD origin/main
python E:\cradlehub\.tmp\pr58_build_baseline.py
& 'E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin\postgres.exe' -D 'E:\cradlehub\.tmp\pr58-duty-pg17-data' -h 127.0.0.1 -p 55442
& 'E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin\createdb.exe' -h 127.0.0.1 -p 55442 -U postgres pr58_attendance_resume_20261102
& 'E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin\psql.exe' -X -1 -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 55442 -U postgres -d pr58_attendance_resume_20261102 -f 'E:\cradlehub\.tmp\pr58-full-prereqs.sql' -f 'tests/database/pr58-attendance-qr-baseline-candidate.sql'
& 'E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin\psql.exe' -X -A -t -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 55442 -U postgres -d pr58_attendance_resume_20261102 -c "select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m');"
Get-FileHash tests/database/pr58-attendance-qr-baseline-candidate.sql,tests/database/pr58-staff-duty-assignments-baseline.sql,tests/database/pr58-schedule-local-correction.sql -Algorithm SHA256
```

The `psql -1 -v ON_ERROR_STOP=1` compilation exited **1** at the missing staff column. Its transaction rolled back; a subsequent catalog count returned **0** public tables/views/materialized views. No synthetic attendance transaction was run. The unchanged dedicated `20261101043000_staff_scan_grant_ledger.sql` was **not applied**, because prerequisite compilation did not pass. Normal clock-in/out, duplicate/replay, wrong branch/device, room/resource, transaction rollback, grant RPC, and RLS integration remain untested in a dependency-closed schema.

Independent read-only review confirmed the absent authoritative staff-column DDL and that the exploratory candidate cannot be promoted. Reviewer verdict: **CORRECTION REQUIRED** for full baseline. Existing duty and focused schedule tests retain their prior LOCAL scoped PASS; authenticated Supabase TEST and physical-device acceptance remain **NOT VERIFIED**. Production release is **NOT APPROVED**. Rollback is limited to dropping this disposable LOCAL database; no production or remote rollback is needed.
