# Attendance geofence review handoff — updated 2026-10-31

**Result: REVIEW BRANCH ONLY.** The Owner authorized committing and pushing the isolated Attendance Geofencing branch for independent code and SQL review. This is not approval to merge, deploy, apply SQL, or enable production enforcement. Release remains gated by a classified LOCAL/TEST database, migration verification, indoor mobile evidence, independent review, and the Owner's later approvals.

## Scope and baseline

- Repository: `E:\cradlehub`; P0 attendance integrity correction published for independent review.
- Review worktree: `E:\cradlehub\.tmp\attendance-geofence`; branch: `fix/attendance-geofence-20261029`.
- Verified feature base: `30173eda8872dfed7675c4d6700198beb507ceb8`.
- Implementation commit: `ac912aa74e721494f394363cb3ecefb0f751b385`.
- Previous local handoff commit: `94be537f2dd21ce36d28f050e442af6cfb2810ae`. The published remote HEAD is verified separately in the owner-facing review handoff because a commit cannot record its own SHA.
- On 2026-10-31, local `main` and GitHub `main` both pointed to `82406113ffa750ca75d5f0d500ef6f558b66ad5a`, four unrelated commits after the feature base. Reconciliation is reserved for the later Owner-approved integration phase. No unrelated changes were copied into this branch.

## Implementation

- `src/lib/attendance/geofence.ts` validates coordinate ranges, finite positive accuracy, a maximum 75 m reported accuracy, a maximum 20 s reading age, and Haversine distance from the QR's branch.
- `src/lib/attendance/geofence-server.ts` loads the QR branch's stored coordinates by branch ID and fails closed for missing/invalid configuration. `ATTENDANCE_GEOFENCE_MODE=enabled` enables enforcement for the two explicit branch IDs; unset/`disabled` leaves production behavior unchanged. Optional server-only radius overrides fail closed if malformed.
- `src/lib/attendance/scan-engine.ts` checks location before idempotent replay and normal attendance processing, binds replay to the same QR point, and blocks replay of an inactive QR. Existing device, branch, shift, schedule, and duplicate-scan checks remain in place.
- The public scan API, direct server action, and first-time registration continuation pass the reading to the same scan engine. The Staff Portal's dedicated policy-backed off-site clock-out was not changed.
- The browser uses `getCurrentPosition` with high accuracy, zero maximum age, and a 15 s timeout for each new attendance scan. It explains the first permission request, reports denied/unavailable readings, and refreshes only on visible attendance pages after permission is granted. No continuous location upload or watch is added.
- `.env.example` documents the disabled default and local test configuration.
- `supabase/migrations/20261029065202_attendance_geofence_branch_coordinates.sql` prepares the Owner-confirmed branch-coordinate update. It was **not applied**. Existing `numeric(9,6)` columns round the supplied coordinates to six decimal places.

## Branch values and enforcement

| Branch ID                                        | Owner-confirmed latitude | Owner-confirmed longitude | Initial radius |
| ------------------------------------------------ | -----------------------: | ------------------------: | -------------: |
| Main Spa `c1000000-0000-0000-0000-000000000001`  |               10.7024485 |               122.9619465 |          100 m |
| SM Branch `c1000000-0000-0000-0000-000000000002` |       10.671561584942413 |        122.94369105292084 |          150 m |

The radii are configurable server-side and are provisional pending indoor calibration. The current review configuration is `ATTENDANCE_GEOFENCE_MODE=disabled`; no production enforcement was silently enabled. An enabled branch with missing database coordinates blocks attendance.

## Authorization and bypass review

- Ordinary attendance writes through the public API, direct scan action, and first-scan continuation converge on `processQrScan`. With the server gate enabled, a missing, stale, inaccurate, malformed, or out-of-radius reading blocks before idempotent replay and normal attendance processing.
- Repository migrations revoke `EXECUTE` on `commit_attendance_scan_transaction`, `recover_stale_attendance_and_clock_in`, and `reconcile_provisional_attendance_clock_out` from `public`, `anon`, and `authenticated`, granting the service role. Live grants were not verified against a database.
- The database commit RPC accepts no GPS proof and relies on its service-role-only grant and the server scan engine for geofence enforcement. Direct service-role calls and actual live grants require independent review. Client-provided coordinates and timestamps can be spoofed; the server validates plausibility and freshness, not cryptographic physical presence.
- The dedicated Staff Portal clock-out remains separate, with registered-device and server-side schedule/assignment policy checks in `commit_attendance_portal_clock_out`. The new geofence adds no manager or staff-selectable bypass.
- Browser GPS can be spoofed. These checks reject absent, malformed, stale, inaccurate, and distant readings; they cannot prove physical presence cryptographically.

## Checks and limits

- On 2026-10-31, `vitest run --maxWorkers=4 tests/lib/attendance tests/app/attendance tests/components/attendance src/lib/scanner/__tests__`: **75 files, 552 tests passed**. A first sandboxed attempt executed no tests because Vitest could not rename files in sandbox Temp; a retry with `TEMP`/`TMP` in an ignored writable folder passed.
- Full ESLint (`eslint . --quiet`): **passed**. Direct Prettier check of 18 changed TypeScript files: **passed**. The review handoff Markdown needed formatting and is checked again before publication.
- TypeScript `tsc --noEmit`: **failed with 958 repository errors**. Eight occur in changed files, all on lines traced by `git blame` to commits predating the geofence implementation; no error names a newly added geofence or browser-location file. A clean exact-base type-check was not run, so the global gate is **not green**.
- `git diff --check` passed before this handoff update and must be rerun for the final commit.
- No classified database target or real Android/iOS device was used. The coordinate migration was not applied. No production query, synthetic attendance write, main merge, or deployment was performed.

## Rollback and next gate

The code gate can be disabled with `ATTENDANCE_GEOFENCE_MODE=disabled`; the feature commits can be reverted if needed. The coordinate migration has not run, so it currently needs no database rollback. The migration writes existing `public.branches.latitude` and `longitude` values, which also serve CRM Home Service distance calculations. Before any later application, capture each branch's prior values so an approved rollback can restore them.

The next permitted step is independent review of the published branch and SQL. The review should inspect server authorization, every attendance-writing path, direct RPC grants, GPS spoofing limits, migration dependencies, branch coordinates, feature flags, Home Service clock-out, tests, and rollback. After corrections and separate Owner approval, use a classified LOCAL/TEST database for migration and mobile validation. Production SQL, enforcement, deployment, and `main` integration require later explicit authorization.
