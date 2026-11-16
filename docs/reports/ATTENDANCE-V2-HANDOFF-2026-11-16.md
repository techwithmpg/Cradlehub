# Attendance V2 handoff — 2026-11-16

**Recommendation: CORRECTION REQUIRED FOR RELEASE.** This is an inactive review
candidate, not a production release or operational sign-off.

## Repository, authority and policy

- Repository: `https://github.com/techwithmpg/Cradlehub.git`, Web only.
- Branch: `stage/web-attendance-v2-automation-20261116`.
- Initial fetched/remote-verified base: `a9ff58e9da53bc10a71a714839ce6d77dc895bb0`.
- Final reconciliation target: `6c5380e96290edd93077b1c6a318e537f89453e3`.
- Implementation commit: `947da17e6aa6ff0b4d86a9b3c0679e70267826cd`.
- Accepted-main integration head: `0126d1472fa310eacca14de0292cc00af9a87414`.
- Final validated implementation head: `fc4901c93908a2ee8ffc0c6088ee3777bd89dda7`.
- The final documentation/test closeout head is reported in the final response;
  no branch push was performed.
- Latest owner policy: one scan up to 120 minutes early, actual arrival retained,
  credited start at scheduled shift start, no second scan. Earlier second-scan
  wording is superseded. Earlier work needs separate auditable authorization.
- No production data/schema execution, RLS/Auth changes, migration ledger repair,
  Cron activation, notification send, deployment, push or main merge authorized.

Read the [audit and contract](ATTENDANCE-V2-AUDIT-AND-CONTRACT-2026-11-16.md) for
the dependency map, baseline defects, frozen semantics and release constraints.
Prior live statements in older reports are **REPOSITORY-RECORDED PRODUCTION
EVIDENCE**, not live verification by this task. Owner-supplied November 16
aggregate findings were not re-queried. No production query was performed.

## Candidate behavior

An 11:54 arrival for 13:00–20:00 is retained as 11:54, starts credit at 13:00,
and produces 420 ordinary credited minutes after a verified 20:00 clock-out.
Late arrival starts credit at actual arrival; departure before shift start
credits zero. The database independently enforces bounded eligibility and the
credited-time contract for enrolled V2 rows. The two-device limit is unchanged.

The existing session, scan transaction and correction audit remain authoritative.
An additive V2 snapshot separates credited time, actual departure, state and
revision. Payroll Export excludes preliminary/unconfirmed/disputed credit from
approved payable minutes. Fixed-monthly payroll is unchanged. Open counters are
bounded and do not accrue merely because clock-out is null.

Due work reuses dynamic assignments, verified completion, configured cleanup and
return buffers, and existing Front Desk cash custody/close/handover evidence.
Active duties defer reminders and closure; completed service alone does not
clock out staff. Ordinary expired shifts can be provisionally closed at local
midnight/catch-up without a QR departure event; genuine overnight duty stays
open. Unknown evidence goes to review; historical rows are not backfilled.

Reminders start at eligible end +5 minutes, repeat every five minutes, dedupe by
deadline generation/interval, stop at completion and resolve in-app state.
Durable push leases and per-endpoint attempt evidence reuse existing transport.
Provider acceptance is distinguished from phone receipt. Exactly-once network
delivery is not promised across a crash after provider acceptance and before
durable acknowledgment; stable IDs and endpoint dedupe mitigate that boundary.

Canonical staff/row/advisory locks prevent competing opens and close/correction
races. Identity-bound replay, cross-device rapid retries, closed-shift no-ops and
older-revision suppression provide deterministic recovery. Focused Today,
History, Staff PWA and export changes retain the four existing module tabs and
recover known shift labels from captured scan metadata.

## Database and scheduler state

`supabase/migrations/20261116094630_attendance_v2_automation.sql` is a forward
candidate executed only in newly created **LOCAL TEST** PostgreSQL databases.
It is **UNAPPLIED to PRODUCTION/Supabase**, and no migration-history version was
marked applied. No historical migration file changed or historical chain replayed.

It creates private activation/due/delivery state, storage/audit triggers and
service-only processors, and forward canonical scan/Closing/correction/
reconciliation definitions. The default database activation is null and the
application switch defaults false. It changes no existing RLS/Auth policy.
Prerequisites include the exact dynamic/insert guard/reminder-helper schema;
verify actual installed definitions before proposing any target execution.

`supabase/operations/enable-attendance-v2.sql` is **INACTIVE / NOT EXECUTED**.
It proposes a separately reviewed, Vault-backed Supabase Cron owner invoking the
protected POST once per minute; due-time logic supplies five-minute reminder
intervals. The four existing Closing job names/schedules/commands are unchanged.
The guarded Closing function excludes V2 rows only after explicit ownership
handoff. An existing active hourly reminder job causes activation preflight to
stop. Do not apply the older hourly proposal or its RLS edits wholesale.

## Verification and limits

Accepted toolchain: Node 24.14.0, pnpm 10.33.2. The isolated lockfile dependency
tree was installed from the offline cache; package and lock files are unchanged.
Test-only PostgreSQL 17.11 binaries and pg 8.16.3 live under ignored `.tmp/`.
No production environment file was copied.

The native cluster is classified **LOCAL TEST**, bound to `127.0.0.1:55439`,
with data under this worktree's `.tmp/attendance-v2-pgdata`. The harness checks
address, port, data directory and server version before creating a new test DB.
It never reads `.env`, linked project credentials or a remote DSN. Its synthetic
schema loads exact accepted dynamic, canonical scan/correction/reconciliation,
and booking-lifecycle/locking SQL; these are not mocked policy resolvers.
This does not establish Supabase Auth, RLS, PostgREST or live grant parity.

Exact commands and final results are in the closeout below. Initial broad
Attendance regression found baseline scanner/test failures. The exact accepted
base was archived into a disposable fixture and the failure categories repeated;
that temporary copy was then removed. Baseline-only evidence is not a waiver for
release. Mobile component tests are simulations, not real installed-device or
authenticated end-to-end browser acceptance. No real phone push or actual payroll
payment/reconciliation was tested.

## Release and rollback gate

Next permitted work: independent review and corrections on this branch; compare
the exact installed schema, functions, privileges and four-job catalog; verify
on classified Supabase TEST; complete real browser/device/push/payroll acceptance.
Production migration, Cron activation, merge/deploy and operational sign-off
need separate owner release approval after those gates pass.

Rollback planning must preserve evidence and V2 payable-finalization gates.
Stop the verified new job and disable activation before application rollback.
Do not drop snapshots/delivery audit, restore raw-duration pay for enrolled
records, or hand open V2 work back to legacy Closing without reviewed
reconciliation. Schema removal, ownership reversal and any data correction
require separate reviewed operations. No rollback was executed.

## Final closeout

Accepted `origin/main` advanced during implementation. Its seven commits were
inspected and merged locally into the review branch without conflicts. The
accepted integration target `6c5380e96290edd93077b1c6a318e537f89453e3` is an
ancestor of the candidate. The main worktree and other branches were not edited.
No production merge or push was performed.

All commands below used `fnm exec --using=24.14.0` in this isolated worktree:

| Command / target | Actual final result |
| --- | --- |
| `node tests/database/attendance-v2-local-test.mjs` | **PASS**, 30 scenario groups; assertions cover stored minutes, raw/credited timestamps, audit, request replay, distinct connections, due interval uniqueness, duty buffers, midnight, manual correction and service-completion races, retained legacy Closing reminder and failed delivery evidence. Largest measured bounded batch: **26.80 ms** in this small synthetic fixture, not a production benchmark. |
| `node node_modules/vitest/vitest.mjs run tests/lib/attendance/v2-policy.test.ts tests/lib/attendance/v2-processor.test.ts tests/app/attendance/automation-route.test.ts tests/components/attendance/attendance-v2-credit-details.test.tsx tests/lib/attendance/attendance-workspace-realtime-merge.test.ts --maxWorkers=4` | **PASS**, 5 files / 41 tests. |
| `node node_modules/vitest/vitest.mjs run tests/lib/attendance src/lib/attendance tests/lib/staff-portal/attendance.test.ts tests/lib/notifications/push-delivery-targeting.test.ts tests/components/attendance tests/app/attendance --maxWorkers=4` | **NOT PASS**, 85 files passed / 5 failed; **646 tests passed / 8 failed**. See baseline comparison below. |
| `node node_modules/eslint/bin/eslint.js <changed .ts/.tsx/.mjs paths>` | **PASS**, scoped to candidate changes relative to accepted main. |
| `node node_modules/next/dist/bin/next build --webpack` | **PASS** after reconciliation. Compiled, type-checked and prerendered with explicitly LOCAL unavailable placeholders (`127.0.0.1:65499`, verified no listener), `DEV_AUTH_BYPASS=false`, production-mode bypass protection and V2 false. Expected local fetch failures were logged; this is compilation/build evidence, not connected runtime acceptance. |
| `pnpm type-check` | **PASS**, executed serially after the completed build. An earlier concurrent attempt raced `.next/types`; that result is not counted as a source-code failure or a pass. |
| `git diff --check` / changed-path, UTF-8 and link audit | **PASS**; 65 relative Markdown links resolved, added text checked for credential patterns, UTF-8 verified, only one new migration and one new activation operation relative to accepted main. |

The accepted-base reproduction used the original verified SHA
`a9ff58e9da53bc10a71a714839ce6d77dc895bb0`, the same dependency tree and Node
24, and six implicated test files (73 tests). Nine assertions failed there,
including one varying mobile assertion. The final eight failures occur in:

- `tests/components/attendance/public-scan-processor.test.tsx` (1);
- `tests/components/attendance/staff-scan-location-readiness.test.tsx` (3);
- `tests/lib/attendance/crm-closing-policy-migration.test.ts` (1; broad global
  five-minute Vercel assertion also matches the accepted unrelated booking job);
- `tests/lib/attendance/public-scan-simplification-contract.test.ts` (1; stale
  minimum-duration source expectation); and
- `tests/lib/attendance/scan-error-paths.test.ts` (2; settings mocks lack the
  accepted rule-version query chain).

These categories reproduce on the accepted base. They remain release issues;
no scanner runtime behavior was changed to make stale tests pass. Two related
Closing/dynamic schedule tests touched by this work now scope their scheduler
assertions to Attendance instead of forbidding unrelated accepted booking Cron.
The roster regression introduced during development was fixed and its tests
passed. A build-discovered source encoding issue was corrected to UTF-8 before
the final successful build.

Payroll evidence is synthetic: 66 early minutes excluded (486 raw vs 420
credited), on-time 420, 15-minute late arrival 405, and departure before start
zero; preliminary/review credit is excluded from approved export. No real
payroll/customer/staff record was reconciled. Notification transport assertions
use mocks; native SQL verifies durable failed attempt records, not phone receipt.
The LOCAL TEST cluster was stopped after verification; synthetic files and logs
remain ignored under `.tmp/`. No external Supabase execution or ledger entry.

The final SQL-only correction also verifies that a successful retry automatically resolves its own unreviewed transient evidence issue while preserving the original issue and resolution audit. Explicit human review remains intact. The application build/type results are unchanged by this SQL correction, which is covered by the final native database run.

Independent review: **NOT PERFORMED**. Browser/device/actual-push, installed
Supabase parity and production payroll acceptance: **NOT VERIFIED**. The
recommendation remains **CORRECTION REQUIRED FOR RELEASE**.

### Changed files relative to reconciled accepted main


- `.env.example`
- `AI_CONTEXT.md`
- `docs/11-DECISION-LOG.md`
- `docs/12-KNOWN-ISSUES-REGISTER.md`
- `docs/13-PROJECT-STATUS.md`
- `docs/20-CHATGPT-LIVE-CONTEXT.md`
- `docs/reports/ATTENDANCE-V2-AUDIT-AND-CONTRACT-2026-11-16.md`
- `docs/reports/ATTENDANCE-V2-HANDOFF-2026-11-16.md`
- `src/app/api/attendance/automation/route.ts`
- `src/components/features/attendance/history/attendance-history-view.tsx`
- `src/components/features/attendance/records/attendance-records-tab.tsx`
- `src/components/features/attendance/shared/attendance-credit-details.tsx`
- `src/components/features/attendance/shared/live-shift-clock.tsx`
- `src/components/features/attendance/today/attendance-today-view.tsx`
- `src/components/features/staff-portal/staff-attendance-history.tsx`
- `src/lib/attendance/attendance-intent-engine.ts`
- `src/lib/attendance/attendance-workspace-realtime-merge.ts`
- `src/lib/attendance/clock-in-authority.ts`
- `src/lib/attendance/crm-review.ts`
- `src/lib/attendance/day-model.ts`
- `src/lib/attendance/recent-scan-event.ts`
- `src/lib/attendance/recent-scans-map.ts`
- `src/lib/attendance/recent-scans.ts`
- `src/lib/attendance/reports.ts`
- `src/lib/attendance/scan-engine.ts`
- `src/lib/attendance/scan-shift-label.ts`
- `src/lib/attendance/staff-diagnostics.ts`
- `src/lib/attendance/time.ts`
- `src/lib/attendance/types.ts`
- `src/lib/attendance/v2-policy.ts`
- `src/lib/attendance/v2-processor.ts`
- `src/lib/attendance/v2-server.ts`
- `src/lib/staff-portal/attendance.ts`
- `supabase/migrations/20261116094630_attendance_v2_automation.sql`
- `supabase/operations/enable-attendance-v2.sql`
- `tests/app/attendance/automation-route.test.ts`
- `tests/components/attendance/attendance-v2-credit-details.test.tsx`
- `tests/database/attendance-v2-fixture.sql`
- `tests/database/attendance-v2-local-test.mjs`
- `tests/lib/attendance/attendance-workspace-realtime-merge.test.ts`
- `tests/lib/attendance/hybrid-closing-automation.test.ts`
- `tests/lib/attendance/smart-dynamic-clock-out.test.ts`
- `tests/lib/attendance/v2-policy.test.ts`
- `tests/lib/attendance/v2-processor.test.ts`
