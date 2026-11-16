# Attendance V2 handoff — 2026-11-16

**LOCAL IMPLEMENTATION AND INDEPENDENT REVIEW: PASS. RELEASE ACCEPTANCE PENDING.**
The review candidate remains inactive; no production release or operational
sign-off is claimed.

## Owner follow-up: local main integration

The owner subsequently requested **merge to local main**. Local integration of
the reviewed implementation and documentation closeout `a4cbf29f` is authorized;
this does not authorize a remote push, deployment, production database operation
or Attendance activation. The implementation remains `e0ba7967`; recorded test
and review evidence is unchanged. Local merge identity is recorded in Git and
the completion response. Existing main-worktree assets must be preserved.

## Authority, branch and policy

- Owner authorized remaining test corrections and independent review, explicitly
  retaining one-scan 120-minute early arrival and stopping before production.
- Worktree: `E:/cradlehub/.worktrees/web-attendance-v2`.
- Branch: `stage/web-attendance-v2-automation-20261116`.
- Original verified base: `a9ff58e9da53bc10a71a714839ce6d77dc895bb0`.
- Reconciled accepted `origin/main`: `6c5380e96290edd93077b1c6a318e537f89453e3`;
  refetched at closeout, already an ancestor, no further integration needed.
- Final implementation: `e0ba79671f8966b29f9d950c1f987e98a5251478`.
- Documentation closeout commit is reported in the final response. No push.

An 11:54 arrival for 13:00–20:00 is retained as 11:54; credit begins at 13:00
and totals 420 minutes after verified 20:00 departure. Late arrivals credit from
actual arrival; departure before shift start credits zero. **No second scan.**
Two-device limits and historical unenrolled records are preserved. Read the
[audit/contract](ATTENDANCE-V2-AUDIT-AND-CONTRACT-2026-11-16.md) and
[independent review](ATTENDANCE-V2-INDEPENDENT-REVIEW-2026-11-16.md).

## Result and corrections

The V2 snapshot keeps arrival, credited bounds, actual departure, revision and
preliminary/final/review state distinct. Payroll Export rejects preliminary,
disputed, malformed or inconsistent V2 credit from approved payable minutes.
Recent feed now compares credited duration while retaining raw arrival/out.
Clock-in-only review preserves actual QR departure provenance; manual
confirmation of a provisional close remains explicitly manual.

Due work reuses authorized schedules, dynamic assignments, platform completion,
cleanup/return buffers and Front Desk cash custody/close/handover evidence.
Business-day and observed-time bounds isolate cash evidence. Effective branch
authority supports temporary/cross-branch staff. Active duties defer reminders
and midnight closure. Unknown evidence goes to review; no historical backfill.
Training scans use 120-minute eligibility/credit but enroll no real automation.

Eligible reminders begin at end+5 minutes and repeat every five minutes.
Renewed duties or changed deadlines retire old notices/deliveries; fresh
server validation runs immediately before dispatch. Push retains per-endpoint
attempt evidence, uses zero provider TTL and stable session collapse identity.
Provider acceptance remains distinct from phone receipt; exactly-once delivery
across a network crash is not promised. In-app notices remain durable.

Original eight test failures are resolved. Accepted UI, fast-path timing and
Attendance-only Cron expectations were corrected; query mocks include the
existing parallel rule-version read. Settings errors fail closed before default
creation. Scanner backgrounding stops active/pending acquisition, cancels decode
and requires an explicit Resume Camera tap after foreground return.

## Targets and inactive operations

The candidate migration `20261116094630_attendance_v2_automation.sql` was run
only in new disposable **LOCAL TEST** PostgreSQL databases. It remains
**UNAPPLIED to PRODUCTION/Supabase**, with no migration-history marking.
No old migration was edited/replayed and no RLS/Auth policy was changed.
Application activation defaults false; database activation defaults null.

`supabase/operations/enable-attendance-v2.sql` remains **NOT EXECUTED**. It
proposes a separate Vault-backed one-minute Supabase Cron caller; reminder
due intervals remain five minutes. Four existing Closing job definitions remain
unchanged; V2 ownership handoff requires separate approval and target checks.
No competing Attendance Vercel job was introduced.

The native harness targets only `127.0.0.1:55439` and validates address, port,
worktree data directory and PostgreSQL 17 before creating a synthetic test DB.
It never reads `.env`, remote DSNs or linked project credentials. Exact accepted
policy, branch resolver, scan/correction/reconcile and booking-lock/lifecycle
functions are loaded against a synthetic schema. This proves LOCAL behavior,
not installed Supabase ACL/Auth/RLS/PostgREST parity. No production query or
mutation was performed. No production environment file was copied.

## Verification

Node 24.14.0 and pnpm 10.33.2; package/lock files unchanged. All commands run
under `fnm exec --using=24.14.0` in the isolated worktree.

| Check | Result |
| --- | --- |
| `node node_modules/vitest/vitest.mjs run tests/lib/attendance src/lib/attendance tests/lib/staff-portal/attendance.test.ts tests/lib/notifications/push-delivery-targeting.test.ts tests/components/attendance tests/app/attendance tests/lib/staff-pwa --maxWorkers=2` | **PASS: 90 files / 671 tests**, final source. |
| `node tests/database/attendance-v2-local-test.mjs` | **PASS: 39 scenario groups**. Includes one-scan early/late/zero credit, concurrency, buffers, midnight, real-vs-manual provenance, training, temporary branch, cash-day isolation, queued/fresh dispatch and replay identity. Largest bounded batch 31.99 ms in this small fixture, not a production benchmark. |
| Scoped ESLint on changed `.ts/.tsx/.mjs` | **PASS**, no warnings/errors. |
| `pnpm type-check` | **PASS** on final source and serially after the completed build. |
| `node node_modules/next/dist/bin/next build --webpack` | **PASS**, compiled/type-checked/prerendered with unavailable LOCAL `127.0.0.1:65499` placeholders, both authorization bypasses false and V2 inactive. Transient TLS fetch retries were logged; no connected runtime acceptance claimed. |
| `git diff --check` | **PASS**. |
| Separate read-only review | **PASS**, no remaining actionable P0/P1/P2 finding; independently 111 tests, then 48 overlapping scanner tests after final hook delta. |
| Browser smoke | **PASS for LOCAL simulation only**: actual scanner, mocked actions and generated MediaStream; mobile 390×844 and desktop 1280×800; hide stopped track, foreground did not reacquire, Resume reacquired; no action resolution/navigation, no horizontal overflow, zero current-page console errors/warnings. Screenshots inspected. |

Browser plugin was unavailable; regular Playwright was used. The harness is
outside the repo under the Codex visualization workspace. Screenshots/logs stay
ignored under worktree `.tmp/`; no app API/database mutation was possible.
The first harness load had a harmless missing-favicon 404; after adding an inline
favicon the final page had zero errors/warnings. This is not installed-device
camera, OS backgrounding or authenticated attendance acceptance.

Prior baseline reproduction (eight failures, 646 passes) is preserved in Git
history; it is superseded by the final green suite. Original governance and
main worktrees remain unchanged. No real phone push, actual staff/customer
mutation or payroll payment/reconciliation was attempted.

## Remaining release gates and next action

The requested local corrections/review are complete. Next release verification
requires separately authorized classified Supabase TEST parity and authenticated
browser/installed-PWA, actual push/receipt and payroll acceptance. Platform
`auto_due` completion is policy evidence; physical work completion/driver return
cannot be inferred from the synthetic test. Owner release approval remains
required before any production execution, Cron ownership change, push, merge or
deployment. Do not query/alter an unknown target or replay historical migrations.

Rollback planning must first stop the verified new job and disable activation,
retain snapshots/delivery/correction evidence and payable-finalization guards,
and reconcile open V2 sessions before changing Closing ownership. No rollback
or activation was executed. Temporary LOCAL services are stopped at closeout.

### Changed files relative to reconciled accepted main

- `.env.example`
- `AI_CONTEXT.md`
- `docs/11-DECISION-LOG.md`
- `docs/12-KNOWN-ISSUES-REGISTER.md`
- `docs/13-PROJECT-STATUS.md`
- `docs/20-CHATGPT-LIVE-CONTEXT.md`
- `docs/reports/ATTENDANCE-V2-AUDIT-AND-CONTRACT-2026-11-16.md`
- `docs/reports/ATTENDANCE-V2-HANDOFF-2026-11-16.md`
- `docs/reports/ATTENDANCE-V2-INDEPENDENT-REVIEW-2026-11-16.md`
- `src/app/api/attendance/automation/route.ts`
- `src/components/features/attendance/history/attendance-history-view.tsx`
- `src/components/features/attendance/records/attendance-records-tab.tsx`
- `src/components/features/attendance/shared/attendance-credit-details.tsx`
- `src/components/features/attendance/shared/live-shift-clock.tsx`
- `src/components/features/attendance/today/attendance-today-view.tsx`
- `src/components/features/scanner/use-staff-scanner.ts`
- `src/components/features/staff-portal/staff-attendance-history.tsx`
- `src/lib/attendance/attendance-intent-engine.ts`
- `src/lib/attendance/attendance-workspace-realtime-merge.ts`
- `src/lib/attendance/clock-in-authority.ts`
- `src/lib/attendance/crm-review.ts`
- `src/lib/attendance/day-model.ts`
- `src/lib/attendance/queries.ts`
- `src/lib/attendance/recent-scan-event.ts`
- `src/lib/attendance/recent-scans-map.ts`
- `src/lib/attendance/recent-scans.ts`
- `src/lib/attendance/reports.ts`
- `src/lib/attendance/scan-engine.ts`
- `src/lib/attendance/scan-feed.ts`
- `src/lib/attendance/scan-shift-label.ts`
- `src/lib/attendance/staff-diagnostics.ts`
- `src/lib/attendance/time.ts`
- `src/lib/attendance/types.ts`
- `src/lib/attendance/v2-policy.ts`
- `src/lib/attendance/v2-processor.ts`
- `src/lib/attendance/v2-server.ts`
- `src/lib/notifications/push/delivery.ts`
- `src/lib/staff-portal/attendance.ts`
- `supabase/migrations/20261116094630_attendance_v2_automation.sql`
- `supabase/operations/enable-attendance-v2.sql`
- `tests/app/attendance/automation-route.test.ts`
- `tests/components/attendance/attendance-v2-credit-details.test.tsx`
- `tests/components/attendance/public-scan-processor.test.tsx`
- `tests/components/attendance/staff-scan-location-readiness.test.tsx`
- `tests/database/attendance-v2-fixture.sql`
- `tests/database/attendance-v2-local-test.mjs`
- `tests/lib/attendance/attendance-workspace-realtime-merge.test.ts`
- `tests/lib/attendance/crm-closing-policy-migration.test.ts`
- `tests/lib/attendance/hybrid-closing-automation.test.ts`
- `tests/lib/attendance/public-scan-simplification-contract.test.ts`
- `tests/lib/attendance/pure-attendance-reader.test.ts`
- `tests/lib/attendance/reports.test.ts`
- `tests/lib/attendance/scan-error-paths.test.ts`
- `tests/lib/attendance/scan-feed.test.ts`
- `tests/lib/attendance/smart-dynamic-clock-out.test.ts`
- `tests/lib/attendance/v2-policy.test.ts`
- `tests/lib/attendance/v2-processor.test.ts`
- `tests/lib/notifications/push-delivery-targeting.test.ts`
