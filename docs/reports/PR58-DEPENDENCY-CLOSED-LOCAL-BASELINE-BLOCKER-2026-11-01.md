# PR #58 dependency-closed LOCAL attendance QR baseline — second source-contract blocker

**Verdict: CORRECTION REQUIRED.** No authoritative executable full attendance QR baseline was produced. The recovered `staff_duty_assignments` definition remains intact at SHA-256 `C13D3F16AA2D800FB633CCA08AB28B77C80E1B640740BCD7ADC39CE8C76E0AC6`. Compilation of a disposable LOCAL schema-only candidate reached `public.staff_is_operational(public.staff)` and failed on the accepted function body. Substituting a rewritten function or omitting its active schedule-validation trigger would change the accepted schedule contract. No additional PRODUCTION query is authorized or was made in this pass.

## Repository and main interaction

- Worktree: clean `fix/attendance-qr-flow-20261101` at pre-report HEAD `ab09c33bcf8fbacbd75899e47fe008f1b724fb40`; safety branch `safety/pr58-pre-main-integration-20261101` remains present. The QR correction commits were not rewritten.
- Fetched `origin/main` is `18bfb406bdfbd94c0a56581446bce9b74e131162`; the merge base with this branch remains `f3291826a1fb1a61107e5ce87591cd9e0b7524ef`. No merge or rebase was performed.
- Since `f3291826`, main adds PRs #60/#61 for CRM booking failure diagnostics and retry safety. Eleven changed files are booking UI/engine/action, availability, branch booking rules, errors, and related tests. There is no changed scanner file, SQL migration, or attendance RPC. Shared booking creation/availability behavior needs later integration regression checks for room/resource fixtures; it was not incorporated into this LOCAL branch.

## Actual source dependency and blocker

The attendance scan engine reads resolved schedules at `src/lib/attendance/scan-engine.ts:2316` and calls `resolve_effective_attendance_branch` at `:974`. The latter depends on the recovered duty table. A full integration fixture must create active `staff_schedules` rows. The accepted final `validate_staff_schedule_window()` at `supabase/migrations/20260713035024_schedule_update_integration_repair.sql:401-490` calls `public.staff_is_operational(v_staff)` and is installed as a `BEFORE INSERT OR UPDATE` trigger on `public.staff_schedules` at `:492-496`.

The only repository definitions of `staff_is_operational(p_staff public.staff)` are in `20260712165012_backend_stabilization_schedule_repair.sql:74-91` and `20260713035024_schedule_update_integration_repair.sql:46-63`. Both are `LANGUAGE sql` and use `p_staff.is_active`, `p_staff.archived_at`, and other `p_staff.column` expressions without a composite argument dereference. PostgreSQL 17.11 rejected the first definition with **`missing FROM-clause entry for table "p_staff"`** at candidate line 5152. The later source definition repeats the same expression. No later accepted migration definition was found. The actual deployed function/trigger contract is therefore not reconstructible from the allowed source and metadata.

The exploratory static closure reached 38 source-created tables plus the recovered duty table and 55 functions. It exposed two additional reasons the generated candidate could not be promoted as an authoritative baseline: it retained repeated historical DDL and skipped conditional schema `DO` blocks. An older selected `CREATE POLICY IF NOT EXISTS` statement also failed PostgreSQL parsing; that historical statement was excluded from the exploratory retry, but final RLS policy fidelity has not been established. No broad historical migration file was executed, no migration history was marked, and no fixture or production rows were copied.

## Exact LOCAL commands and outcomes

The source audit used `rg` on `src` and `supabase/migrations`, a local DDL-selection script in `E:\cradlehub\.tmp`, and a disposable PostgreSQL 17.11 database `pr58_full_test` on `127.0.0.1:55440`. A separate LOCAL prerequisite file created only `auth.users(id)` and the `anon`, `authenticated`, and `service_role` roles/functions needed for SQL compilation; it cannot prove real Supabase Auth/PostgREST behavior. The candidate was never committed and was deleted after failure.

```powershell
git status --short --branch
git rev-parse HEAD
git fetch origin main
git rev-parse origin/main
git log --oneline f3291826a1fb1a61107e5ce87591cd9e0b7524ef..origin/main
git diff --name-only f3291826a1fb1a61107e5ce87591cd9e0b7524ef..origin/main
git merge-base HEAD origin/main
(Get-FileHash -LiteralPath 'tests/database/pr58-staff-duty-assignments-baseline.sql' -Algorithm SHA256).Hash
python E:\cradlehub\.tmp\pr58_build_baseline.py
& 'E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin\postgres.exe' -D 'E:\cradlehub\.tmp\pr58-duty-pg17-data' -h 127.0.0.1 -p 55440
& 'E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin\createdb.exe' -h 127.0.0.1 -p 55440 -U postgres pr58_full_test
& 'E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin\psql.exe' -X -1 -h 127.0.0.1 -p 55440 -U postgres -d pr58_full_test -v ON_ERROR_STOP=1 -f 'E:\cradlehub\.tmp\pr58-full-prereqs.sql'
& 'E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin\psql.exe' -X -1 -q -h 127.0.0.1 -p 55440 -U postgres -d pr58_full_test -v ON_ERROR_STOP=1 -f 'tests/database/pr58-attendance-qr-baseline-candidate.sql'
```

The prerequisite SQL exited **0**. Each candidate run used `-1` and `ON_ERROR_STOP=1`, so its schema changes rolled back on the first error. Iterative source-closure checks found `departments` and `blocked_times` parent dependencies and the PostgreSQL-invalid historical policy syntax; the final compilation stopped at the function error above, exit **3**. No final baseline SQL filename or SHA-256 exists, and the dedicated scanner-grant migration was **not** applied to `pr58_full_test`. No full-baseline RLS, branch, grant, attendance-commit, device, or room/resource SQL test can be claimed. The LOCAL server was stopped after the attempt.

## Narrow metadata recovery needed before resuming

Separate owner authorization is needed for **catalog-only**, read-only metadata on the classified PRODUCTION project, limited to:

1. `pg_get_functiondef` plus owner, argument identity, volatility, security mode, search path, and function ACL for `public.staff_is_operational(public.staff)` and `public.validate_staff_schedule_window()`.
2. `pg_get_triggerdef`, enabled state, and trigger-function identity for `public.validate_staff_schedule_window_trigger` on `public.staff_schedules`.
3. Only if the returned function depends on it, `pg_get_viewdef` and `security_invoker`/grants for `public.operational_staff`.

No function execution or business-row query is requested. If the catalog shows the same unexecutable function, that is a production schema-contract defect requiring a separately authorized correction; the LOCAL baseline must not conceal it. If it shows an accepted executable definition, document its provenance and review its exact SQL before adding it to a new curated baseline.

**Independent review:** CORRECTION REQUIRED. The reviewer confirmed both accepted function definitions fail LOCAL PostgreSQL 17 compilation, the schedule trigger is on the fixture path, and the exploratory candidate is too broad and incomplete to present as a reviewed dependency-closed baseline. Authenticated Supabase TEST and installed-PWA acceptance remain **NOT VERIFIED**. No remote publication, deployment, or production operation occurred.
