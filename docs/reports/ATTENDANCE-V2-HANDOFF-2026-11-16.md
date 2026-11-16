# Attendance V2 handoff — 2026-11-16

**Recommendation: CORRECTION REQUIRED FOR RELEASE.** This is an inactive review
candidate, not a production release or operational sign-off.

## Repository, authority and policy

- Repository: `https://github.com/techwithmpg/Cradlehub.git`, Web only.
- Branch: `stage/web-attendance-v2-automation-20261116`.
- Initial fetched/remote-verified base: `a9ff58e9da53bc10a71a714839ce6d77dc895bb0`.
- Final reconciliation target: `6c5380e96290edd93077b1c6a318e537f89453e3`.
- Implementation/final head and final verification are recorded in the closeout
  below and the final response; this handoff is not evidence of a pushed branch.
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

Final source head, reconciled base, command outcomes, changed-path inventory and
remaining gates will be completed after reconciliation and final checks.
