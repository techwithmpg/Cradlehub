# Attendance geofence local handoff — 2026-10-29

**Result: CORRECTION REQUIRED.** The local implementation and mocked/pure tests are ready for independent review. Release and local `main` integration remain gated by a classified LOCAL/TEST database, migration verification, indoor mobile evidence, and the Owner's merge approval.

## Scope and baseline

- Repository: `E:\cradlehub`; local-only P0 attendance integrity correction.
- Review worktree: `E:\cradlehub\.tmp\attendance-geofence`; branch: `fix/attendance-geofence-20261029`.
- Base local `main`: `30173eda8872dfed7675c4d6700198beb507ceb8`.
- Implementation commit: `ac912aa74e721494f394363cb3ecefb0f751b385`.
- Refreshed `origin/main`: `23fa84f5e5abf5d7e5bf3499b0d4c733999f29d4`; local `main` is eight commits ahead and has unrelated uncommitted CRM, bookings, Cash Flow, and service-catalog work. No part of that work was copied into this branch.

## Implementation

- `src/lib/attendance/geofence.ts` validates coordinate ranges, finite positive accuracy, a maximum 75 m reported accuracy, a maximum 20 s reading age, and Haversine distance from the QR's branch.
- `src/lib/attendance/geofence-server.ts` loads the QR branch's stored coordinates by branch ID and fails closed for missing/invalid configuration. `ATTENDANCE_GEOFENCE_MODE=enabled` enables enforcement for the two explicit branch IDs; unset/`disabled` leaves production behavior unchanged. Optional server-only radius overrides fail closed if malformed.
- `src/lib/attendance/scan-engine.ts` checks location before idempotent replay and normal attendance processing, binds replay to the same QR point, and blocks replay of an inactive QR. Existing device, branch, shift, schedule, and duplicate-scan checks remain in place.
- The public scan API, direct server action, and first-time registration continuation pass the reading to the same scan engine. The Staff Portal's dedicated policy-backed off-site clock-out was not changed.
- The browser uses `getCurrentPosition` with high accuracy, zero maximum age, and a 15 s timeout for each new attendance scan. It explains the first permission request, reports denied/unavailable readings, and refreshes only on visible attendance pages after permission is granted. No continuous location upload or watch is added.
- `.env.example` documents the disabled default and local test configuration.
- `supabase/migrations/20261029065202_attendance_geofence_branch_coordinates.sql` prepares the Owner-confirmed branch-coordinate update. It was **not applied**. Existing `numeric(9,6)` columns round the supplied coordinates to six decimal places.

## Branch values and enforcement

| Branch ID | Owner-confirmed latitude | Owner-confirmed longitude | Initial radius |
| --- | ---: | ---: | ---: |
| Main Spa `c1000000-0000-0000-0000-000000000001` | 10.7024485 | 122.9619465 | 100 m |
| SM Branch `c1000000-0000-0000-0000-000000000002` | 10.671561584942413 | 122.94369105292084 | 150 m |

The radii are configurable server-side and are provisional pending indoor calibration. The current review configuration is `ATTENDANCE_GEOFENCE_MODE=disabled`; no production enforcement was silently enabled. An enabled branch with missing database coordinates blocks attendance.

## Authorization and bypass review

- Ordinary attendance writes through the public API, direct scan action, and first-scan continuation converge on `processQrScan`. A missing, stale, inaccurate, malformed, or out-of-radius reading blocks before any normal attendance transaction.
- Repository migrations revoke `EXECUTE` on `commit_attendance_scan_transaction`, `recover_stale_attendance_and_clock_in`, and `reconcile_provisional_attendance_clock_out` from `public`, `anon`, and `authenticated`, granting the service role. Live grants were not verified against a database.
- The dedicated Staff Portal clock-out remains separate, with registered-device and server-side schedule/assignment policy checks in `commit_attendance_portal_clock_out`. The new geofence adds no manager or staff-selectable bypass.
- Browser GPS can be spoofed. These checks reject absent, malformed, stale, inaccurate, and distant readings; they cannot prove physical presence cryptographically.

## Checks and limits

- `vitest run --maxWorkers=4 tests/lib/attendance tests/app/attendance tests/components/attendance src/lib/scanner/__tests__`: **75 files, 552 tests passed**. This includes geofence boundary, browser-permission, route forwarding, device continuation, duplicate, and existing portal-clock-out coverage.
- Final focused geofence/API run: **4 files, 30 tests passed**.
- Full ESLint (`eslint . --quiet`): **passed**. Changed-file Prettier check and `git diff --check`: **passed**.
- Repository incremental format gate: **failed on numerous pre-existing files**; changed code files pass direct Prettier.
- TypeScript `tsc --noEmit`: **failed with 958 repository errors**. The existing dirty `main` checkout reports 964 of the same dependency/type pattern. No error names a new geofence or browser-location file; the global type gate is not green.
- No production build: this worktree has no classified isolated database/runtime environment. No migration, synthetic attendance write, production query, push, deployment, or real mobile test was performed.

## Rollback and next gate

The code gate can be disabled with `ATTENDANCE_GEOFENCE_MODE=disabled`; the local commit can be reverted if needed. The coordinate migration has not run, so it currently needs no database rollback. Before any later application, capture each branch's prior coordinates so an approved rollback can restore them.

An independent review should verify the code paths and live database grants against a classified LOCAL/TEST target, apply the migration only there, and test Android Chrome, iOS Safari, and installed PWA scans indoors and outside each radius. After corrections and Owner approval, reconcile with accepted `origin/main` and integrate into a clean local `main` checkout or an integration worktree. The current dirty `main` must not be force-merged or overwritten.
