# Attendance Geofencing P0 correction — independent-review handoff

**Verdict: CORRECTION REQUIRED.** The repository correction is committed for review, but no authorized CradleHub LOCAL/TEST Supabase database was available for authenticated mutation tests. The full repository test and formatting gates also fail on accepted `main`. Do not apply the SQL or enable enforcement until the database, mobile, and governance gates are complete.

## Authority and Git state

- Owner authorization: the P0 attendance correction instruction of 2026-10-31. Scope is the existing geofencing branch, its attendance SQL, Staff PWA location readiness, tests, and handoff evidence.
- Repository: `E:\cradlehub`; isolated worktree: `E:\cradlehub\.tmp\attendance-geofence`; branch: `fix/attendance-geofence-20261029`.
- Exact feature base: `30173eda8872dfed7675c4d6700198beb507ceb8`; previously reviewed HEAD: `19f7cc2e3cd59710368aeda394f2a060d0f2684c`.
- P0 implementation commit: `cb8d35abe7fac08c5da7b57f42d88a7ce80902ca`. Accepted `origin/main` observed at `82406113ffa750ca75d5f0d500ef6f558b66ad5a`. This feature branch has not been rebased or merged with the later unrelated main commits.
- Final handoff commit and verified remote HEAD are recorded in the Owner-facing response, since a commit cannot contain its own SHA.

## Exact P0 correction files

1. `supabase/migrations/20261031021708_attendance_checkins_server_only.sql` — table privileges and RLS.
2. `src/lib/actions/staff-checkins.ts` — retires unverified one-click clock-in/out writes while retaining read helpers.
3. `src/components/features/staff-portal/staff-checkin-widget.tsx` and `src/app/(dashboard)/staff-portal/page.tsx` — attendance status and physical QR guidance.
4. `src/components/features/staff-pwa/attendance-location-refresh.tsx`, `src/app/(dashboard)/staff/layout.tsx`, and `src/app/(dashboard)/staff-portal/layout.tsx` — permission-aware foreground readiness refresh.
5. `supabase/migrations/20261029065202_attendance_geofence_branch_coordinates.sql` and `docs/reports/ATTENDANCE-GEOFENCE-LOCAL-HANDOFF-2026-10-29.md` — correct the coordinate-column precision assumption.
6. `tests/lib/attendance/legacy-checkin-actions.test.ts`, `tests/components/attendance/attendance-location-refresh.test.tsx`, `tests/lib/attendance/geofence.test.ts`, and `tests/lib/pwa/staff-scanner-shell.test.tsx` — fail-closed, foreground, boundary, and scanner regressions.

No CRM Services authorization, Desktop repository, Cash Flow, or Cradle Live files changed. The earlier accepted geofence engine, public scan route, QR scanner, registration continuation, and dedicated Home Service clock-out remain in place.

## Database authorization contract

The 2026-05-23 migration granted `SELECT, INSERT, UPDATE, DELETE` on `staff_shift_checkins` to `authenticated` and `service_role`. It created permissive `FOR ALL` policies for Owner, same-branch management, and same-branch CRM/CSR; a staff-own `INSERT`; a staff-own `UPDATE`; and staff-own `SELECT`. The independent read-only live review additionally reported broad `anon` privileges, but their exact live values were not captured in this task. These policies allow Data API writes without QR/device/GPS verification.

The new migration drops the five reported write-capable policies and replaces the Owner, management, and CRM/CSR `FOR ALL` policies with `FOR SELECT` equivalents. It keeps `checkins_staff_read_own`. It revokes `INSERT, UPDATE, DELETE` from `PUBLIC`, `anon`, and `authenticated`, grants `SELECT` to `authenticated`, and explicitly preserves `SELECT, INSERT, UPDATE, DELETE` for `service_role`. RLS stays enabled. Even an undiscovered permissive write policy cannot restore direct Data API mutations while the table grants remain revoked. Live policy/grant drift still requires inspection before application.

| Caller | Direct table read after migration | Direct INSERT/UPDATE/DELETE after migration | Approved write path |
| --- | --- | --- | --- |
| Ordinary active staff | Own records | Denied | Physical branch QR through `processQrScan`; eligible Home Service clock-out through the dedicated server action/RPC |
| CRM / CSR Head / CSR Staff | Existing same-branch read scope | Denied | Authorized CRM Attendance Review and recovery operations, with actor, reason, and audit |
| Manager / assistant / store manager | Existing same-branch read scope | Denied | Approved server-side attendance correction workflow |
| Owner | Existing cross-branch read scope | Denied | Approved server-side correction workflow with audit |
| `anon` / unauthenticated | No new read access | Denied | None |
| `service_role` server code | All records | Permitted | Scan commit, portal clock-out, correction, and scheduled reconciliation under their existing server authorization |

The SQL is the complete new migration:

```sql
-- Staff attendance truth is written by the server-side scan transaction,
-- dedicated portal clock-out, and audited correction/reconciliation operations.
-- Authenticated Data API clients retain their existing scoped reads only.
-- Apply to a classified target after comparing its live policies and grants.

begin;

alter table public.staff_shift_checkins enable row level security;

drop policy if exists "checkins_owner_all" on public.staff_shift_checkins;
drop policy if exists "checkins_manager_branch_all" on public.staff_shift_checkins;
drop policy if exists "checkins_csr_branch_all" on public.staff_shift_checkins;
drop policy if exists "checkins_staff_self_insert" on public.staff_shift_checkins;
drop policy if exists "checkins_staff_self_update" on public.staff_shift_checkins;

-- Preserve the read side of the former FOR ALL policies. The separate
-- checkins_staff_read_own policy continues to serve staff self-service reads.
create policy "checkins_owner_read" on public.staff_shift_checkins
  for select to authenticated
  using (get_auth_role() = 'owner');

create policy "checkins_manager_branch_read" on public.staff_shift_checkins
  for select to authenticated
  using (
    get_auth_role() in ('manager', 'assistant_manager', 'store_manager')
    and branch_id = get_auth_branch_id()
  );

create policy "checkins_csr_branch_read" on public.staff_shift_checkins
  for select to authenticated
  using (
    get_auth_role() in ('crm', 'csr_head', 'csr_staff')
    and branch_id = get_auth_branch_id()
  );

-- Grants and RLS must both deny direct mutations. Revoking PUBLIC also
-- prevents inherited table privileges from silently reopening Data API writes.
revoke insert, update, delete on table public.staff_shift_checkins
  from public, anon, authenticated;
grant select on table public.staff_shift_checkins to authenticated;
grant select, insert, update, delete on table public.staff_shift_checkins to service_role;

commit;
```

The migration depends on `public.staff_shift_checkins`, `get_auth_role()`, `get_auth_branch_id()`, and the existing `checkins_staff_read_own` policy. It does not rewrite history, timestamps, or branch data. Existing `updated_at`, attendance-policy snapshot, single-open guard, and policy-recalculation triggers are unchanged. Repository SQL grants the scan commit, stale recovery, audited correction, closing/reconciliation, and dedicated portal clock-out RPCs to `service_role` only; direct authenticated RPC rejection still needs runtime verification. Existing `SECURITY DEFINER` trigger functions were not broadened. No RLS disable or new definer function was introduced.

The legacy `checkInStaffForShiftAction` and `checkOutStaffForShiftAction` now reject every request before opening a database client. The Staff Portal one-click controls were replaced with status and QR guidance. Legacy CRM Availability buttons still receive a clear rejection directing operators to CRM Attendance Review; that interface remains the audited correction path and should be checked in the independent UX review. The correction path uses the existing service-role transaction and records actor, reason, previous values, and new values. Ordinary QR scans still use `processQrScan`, which verifies the location before replay or mutation.

## Isolated database and runtime evidence

Docker Desktop was initially stopped. It started locally, but the only running Supabase stack was named `MPG-Reputation`, unrelated to CradleHub. Stopped CradleHub-named containers were not identifiable as an authorized isolated Supabase test stack. No CradleHub LOCAL/TEST target was classified. No database connection, mutation, migration replay, or SQL application was performed. The live database remains **PRODUCTION** and was not contacted.

Therefore the required actual authenticated-role tests are **BLOCKED**, not passed: ordinary staff insert/update/delete; another employee and cross-branch writes; CRM/management/Owner direct writes; direct RPC grants; audited Owner/CRM corrections; automatic recovery/closing; and Home Service clock-out against a real test database. Before any test SQL, capture target schema, table privileges, policy expressions and modes, function ACLs, triggers, branch coordinates, and attendance-writing dependencies. Apply only the targeted test migrations to an authorized isolated CradleHub database. Do not bulk-replay historical local-only migrations.

## Coordinates, location, and Home Service

| Branch | ID | Latitude | Longitude | Initial radius |
| --- | --- | ---: | ---: | ---: |
| Main Spa | `c1000000-0000-0000-0000-000000000001` | 10.7024485 | 122.9619465 | 100 m |
| SM Branch | `c1000000-0000-0000-0000-000000000002` | 10.671561584942413 | 122.94369105292084 | 150 m |

The coordinate migration remains unapplied. It changes only those two branches' latitude/longitude, which also feed Home Service travel-distance pricing. The read-only live review found unconstrained `numeric` columns; repository history had declared `numeric(9,6)`. Verify the actual target precision and capture both old coordinate pairs before any application. The distance-fee and Home Service pricing regressions passed locally, but no database-backed price comparison or physical route test occurred.

The geofence retains a 75 m maximum reported accuracy, 20 s maximum age, fresh high-accuracy scan reading, and point-distance check. A unit test covers readings at 99 m and 101 m with 75 m reported accuracy; the approved radius was not widened for uncertainty. Indoor edge behavior needs real Android/iOS trials and Owner approval before threshold changes. Browser GPS can be spoofed and is not cryptographic proof of presence. The Staff PWA quietly warms location on open and visible return only after permission was granted; the warm reading is never scan evidence. No background tracking was added. The existing Home Service clock-out continues to use a registered-device-bound, policy-backed server RPC with assignment and timing checks; its code was not changed.

## Exact quality results

| Command / target | Result |
| --- | --- |
| `pnpm type-check` at exact feature base `30173eda...` | Exit 0; 0 TS errors |
| `pnpm type-check` at accepted main `82406113...` | Exit 0; 0 TS errors |
| `pnpm type-check` at P0 correction | Exit 0; 0 TS errors. The earlier 958-error report was not reproduced in clean baseline worktrees. |
| `pnpm exec vitest run tests/lib/attendance tests/app/attendance tests/components/attendance tests/lib/home-service/distance-fee.test.ts tests/lib/home-service/home-service-pricing.test.ts src/lib/scanner/__tests__ --maxWorkers=4` | 78 files, 619 tests passed |
| `pnpm exec vitest run --maxWorkers=4` at P0 correction | 442 files passed, 2 failed, 2 skipped; 3,326 tests passed, 2 failed, 2 skipped |
| Same bounded full command at accepted main | 441 files passed, 2 failed, 2 skipped; 3,368 tests passed, 2 failed, 2 skipped |
| Unbounded `pnpm exec vitest run` before scanner-contract test repair | P0 branch: 438 files passed, 5 failed, 2 skipped; 3,320 tests passed, 6 failed, 2 skipped. Accepted main: 439 files passed, 4 failed, 2 skipped; 3,366 tests passed, 4 failed, 2 skipped. The extra scanner assertion was stale and repaired; two extra booking failures passed in isolation. |
| `pnpm lint` on final implementation commit | Exit 0; 0 errors, 22 warnings |
| Changed-file `pnpm exec prettier --check ...` | Passed for all changed TypeScript/TSX files |
| `pnpm format:check` on final implementation commit | Exit 1; 464 warning paths, none among the P0 correction files. Accepted main also exits 1 with 473 warning paths. |
| `pnpm build` | Exit 1: Turbopack rejected the existing `node_modules` junction outside its root. |
| `pnpm exec next build --webpack` | Compiled and TypeScript passed; exit 1 while prerendering `/owner/marketing` because no Supabase URL is configured in the isolated worktree. No production URL was supplied. |
| `git diff --check`; staged-secret pattern scan | Passed; 0 potential secret lines in P0 implementation commit |

Both bounded full-suite failures match accepted main exactly: `tests/api/desktop-v1-home-service-operations.test.ts` rejects the expected Home Service reschedule status, and `tests/lib/crm/crm-staff-retained-mutation-contract.test.ts` rejects an existing Owner Staff revalidation call. The correction did not edit those subsystems. The unbounded CRM booking preview timeout is load-sensitive; the bounded run passed it. The repository gate remains red and requires governance acceptance or separate fixes before an unconditional review PASS.

## Production impact, rollback, and next gate

Production impact from this branch is **none**: no production SQL, merge, deployment, or geofence enablement. Until a reviewed migration closes the live table privileges and policies, direct Data API attendance mutation remains a P0 risk; do not enable geofence enforcement based on code alone.

If a later authorized deployment fails, disable the server geofence flag while retaining the direct-write lockout; route clock-ins through the existing QR path and corrections through Attendance Review. Reverting the new table privileges/policies alone would reopen the bypass and needs a separate Owner security decision. For a coordinate rollback, use the captured prechange Main Spa and SM Branch values in a targeted transaction, then verify Home Service distance fees. The P0 implementation commit can be reverted on the feature branch before integration. No database rollback is needed now because no SQL was applied.

Independent review should inspect the SQL against live policy and privilege snapshots, verify authenticated LOCAL/TEST role sessions and RPC denial, exercise Owner/CRM correction and Home Service clock-out, test indoor phones at both branches, review the legacy CRM Availability guidance, and resolve or formally accept the full-suite and formatting gates. The next authorized action is review and isolated testing; production SQL, merge to `main`, deployment, and production enablement need later Owner authorization.
