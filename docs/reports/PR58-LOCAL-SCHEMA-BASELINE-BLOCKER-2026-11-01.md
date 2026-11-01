# PR #58 LOCAL attendance QR schema baseline — source-contract blocker

**Verdict: CORRECTION REQUIRED.** This is an execution checkpoint, not an executable schema baseline. The accepted source does not contain the definition of `public.staff_duty_assignments`, which the current attendance branch-authorization RPC reads. No baseline SQL filename or SHA-256 exists; creating one from guessed table constraints would be a synthetic substitute. Consequently no LOCAL schema was applied, and the scanner-grant migration was not applied in this pass. No remote database or hosting operation was performed.

## Verified starting point

- Branch: `fix/attendance-qr-flow-20261101`; pre-report HEAD `7513f1d477c0477f3c91619e4ea4a423c23b54f7`; clean working tree before this report.
- Accepted `origin/main`: `f3291826a1fb1a61107e5ce87591cd9e0b7524ef`.
- The existing [TEST schema manifest](PR58-TEST-SCHEMA-MANIFEST-2026-11-01.md) identifies this gap. The present audit traced the actual accepted SQL and scan consumer rather than using its object list as an apply queue.
- A native LOCAL PostgreSQL binary is available at `E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin`; `psql --version` and `initdb --version` both returned **17.11**. No cluster was initialized because the required source contract could not be reconstructed.

## Blocking dependency

1. Repository search found **no `CREATE TABLE public.staff_duty_assignments`** in `supabase/migrations`, or in the local SQL worktrees searched. `git log --all -G` found only commits that *reference* this table, not its definition.
2. The generated database types at `src/types/supabase.ts:5498-5548` document seven columns (`id`, `staff_id`, `branch_id`, `day_of_week`, `duty_type`, `is_active`, `created_at`) and names of staff/branch foreign keys. They do not establish PostgreSQL column types, default expressions, checks, uniqueness, index definitions, foreign-key delete actions, ownership, or full grants/RLS policy history.
3. `supabase/migrations/20260821034409_repair_attendance_branch_authority.sql:534-566` queries duty rows in `resolve_effective_attendance_branch(uuid,uuid,date,boolean)` on the normal path after temporary authorization. `src/lib/attendance/scan-engine.ts:964-990` invokes this RPC; the accepted SQL test at `supabase/tests/20260821_attendance_branch_authority.sql:118-148` inserts duty rows and checks branch selection/conflict rejection.
4. `supabase/migrations/20260821020651_reconcile_live_schema_and_secure_internal_tables.sql:439,450` enables RLS and revokes browser-role access on the table, assuming it already exists. It does not create the missing object. Other scoped core objects checked (`qr_points`, `qr_scan_events`, `staff_devices`, `staff_shift_checkins`, `staff_attendance_branch_assignments`, policy and audit tables) do have `CREATE TABLE` provenance in the accepted migrations; their later alterations still need curation and validation after this blocker is resolved.
5. `tests/database/staff-scan-grants-integration.sql:84-94` explicitly creates minimal synthetic `staff`, `staff_shift_checkins`, and `qr_scan_events` tables. Its prior successful ledger test cannot validate an authoritative attendance QR integration baseline or fill the missing duty contract.
6. That older LOCAL fixture also creates a minimal `auth.users` stand-in and three database roles at its start. Native PostgreSQL alone does not supply Supabase-managed Auth/PostgREST prerequisites. Such a shim can test isolated SQL mechanics, but it cannot prove the requested authenticated integration or substitute for an accepted schema contract.

The exact evidence needed is an approved **schema-only** definition of `public.staff_duty_assignments` from the accepted database contract or a missing accepted migration, including column types/defaults, primary and foreign keys/actions, checks, uniqueness/indexes, ownership, and effective grants/RLS policies. No production rows, Auth users, credentials, or production SQL execution are needed for that evidence. Once available, the curated baseline can be completed and independently reviewed before LOCAL execution; only then can the dedicated ledger migration run after it.

## Commands and results

Run from `E:\cradlehub\.tmp\attendance-qr-flow-20261101` in PowerShell (read-only commands; no SQL execution):

```powershell
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
rg -n -i "create\s+table.*staff_duty_assignments" supabase/migrations
git log --all --oneline -G "CREATE TABLE.*staff_duty_assignments|create table.*staff_duty_assignments" -- supabase/migrations
rg -n "staff_duty_assignments" supabase src tests docs
& 'E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin\psql.exe' --version
& 'E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin\initdb.exe' --version
```

The `rg` create-table and `git log -G` commands returned **no definition**. The table-reference search found accepted SQL, generated types, and consumers cited above. The two version commands returned PostgreSQL **17.11**. No SQL file was executed, so SQL dependency, RLS, grant, RPC, attendance-integrity, or migration-after-baseline results are **NOT VERIFIED** in this pass. There is no SQL filename or hash to report.

An independent read-only source review reached the same **CORRECTION REQUIRED** verdict: a handwritten table inferred from generated TypeScript types would not establish the accepted database contract, and the normal scan path requires the missing object. The QR implementation and draft PR remain unchanged and unpublished.
