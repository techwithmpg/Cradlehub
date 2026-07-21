# Repository Cleanup Report

Audit date: 2026-07-21
Branch: `main`
Baseline commit: `a2f62ad4`
Policy: evidence-based; static search alone was not treated as deletion authority.

## Baseline and result

| Measure | Before cleanup | After cleanup |
| --- | ---: | ---: |
| Source files under `src` | 1,200 | 1,200 |
| Test files | 124 | 124 |
| Runtime dependencies | 31 | 31 |
| Development dependencies | 22 | 22 |
| Production build routes/pages | 110 | 110 |
| Lint warnings | 2 | 1 |
| Full tests | 150 files / 1,137 tests | 150 files / 1,137 tests |

## Changes

- Removed one confirmed unused local `AdminClient` type alias.
- Removed two development-only CRM booking information logs and Owner staff debug logging.
- Hid the non-functional Owner service image-upload placeholder from the training surface; the automatic image behavior remains.
- No component, hook, utility, route, Server Action, script, asset, dependency, or test file was deleted during cleanup because no additional candidate met the deletion proof threshold.
- No dependency was removed. Import/configuration/script/dynamic-use review did not prove a safe candidate.
- No tracked generated build, coverage, dependency, archive, or local backup directory was identified. The untracked `supabase.zip` and backup directories were not deleted because ownership/continued recovery value was uncertain.

## Intentionally retained

- Paused Manager workspace and its activation/redirect behavior.
- Future grouped-booking implementation; this release only blocks automatic multi-person booking.
- AI Coach implementation behind configuration and role gates.
- Attendance cutover flags, stale-recovery SQL, operational SQL, historical migrations, seed data, notifications, QR/public assets, and `.context` history.
- Seven `router.refresh()` calls in legacy Availability components. A focused test imports `StaffShiftCell`, and operational/performance documentation references both files; they are uncertain/dormant, not confirmed dead.
- `applyLaunchRecovery` remains a dormant Attendance recovery helper and accounts for the one lint warning. It was not deleted without product/flow proof.

## Validation

- TypeScript: pass.
- Lint: pass, zero errors and one pre-existing unused-function warning.
- Full suite: pass, 150 files and 1,137 tests.
- Production build: pass, 110 generated pages.
- Diff check: pass (line-ending notices only).
- Linked database lint: attempted twice; the Supabase pooler timed out on port 5432.
- Frozen install: not completed because pnpm attempted to purge the existing `node_modules` in a non-interactive session. The user workspace was preserved.

## Remaining technical debt

- Reconcile repository/live migration history before a broad migration push.
- Decide the future of legacy Availability components and dormant launch-recovery helper with explicit product/runtime evidence.
- Add a durable distributed rate-limiter adapter for public endpoints.
- Complete authenticated Owner/CRM browser evidence and production device/cron/pilot checks.
