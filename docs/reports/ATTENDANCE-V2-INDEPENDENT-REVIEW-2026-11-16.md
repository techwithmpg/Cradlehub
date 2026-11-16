# Attendance V2 independent review — 2026-11-16

**Verdict: PASS for the local implementation. Release acceptance remains pending.**

The owner requested completion of the remaining Attendance tests and independent
review, retaining one scan up to 120 minutes early and stopping before production.
The read-only reviewer was a separate agent, `attendance_independent_review`.
It inspected the candidate against accepted `origin/main`
`6c5380e96290edd93077b1c6a318e537f89453e3`, including corrected working changes
subsequently committed as `e0ba79671f8966b29f9d950c1f987e98a5251478` on
`stage/web-attendance-v2-automation-20261116`. Main was refetched and remains an
ancestor. The reviewer made no edits or production operations.

## Findings and disposition

| Finding | Severity | Verified correction |
| --- | --- | --- |
| Later cash sessions/handovers could authorize an earlier attendance period | P1 | Cash close, handover-parent and custody evidence is scoped to the attendance business day; observed completion has time bounds. Native regression includes next-day closure, handover and custody. |
| Home-branch equality skipped valid temporary/cross-branch sessions | P1 | Due processing uses the accepted effective-branch resolver. The validated personal push path retains active account/workspace and exact recipient checks while allowing the assigned branch. Generic notification matching is preserved. |
| Old queued reminders survived renewed duties or extended deadlines | P1 | Resolve/suppress obsolete notices, preserve delivery history, and revalidate current dynamic/cash duties immediately before dispatch under canonical lock order. Reload credit after policy refresh. Positive and negative native validation cases pass. |
| Provider TTL allowed offline reminder backlog | P1 | V2 reminders use zero TTL and a stable session topic/tag; ordinary notification defaults remain unchanged. No offline provider queue is requested. |
| Clock-in-only correction erased actual QR departure projection | P2 | Preserve departure method when actual out is unchanged; explicit provisional confirmation still records manual provenance. |
| Training TS120 versus SQL60 mismatch | P2 | Training QR rows receive the same early credit boundary but never enroll real due work, reminders or automated closure. |
| Malformed/falsy or incomplete final credit could enter approved export | P2 | Presence of the V2 key invokes fail-closed validation; finalized credit requires a closed record, bounded endpoints and matching stored minutes. |
| Reconciliation replay lacked full operation identity binding | P2 | Bind staff, branch, device, test mode and checkin before returning a replay. Canonical scan replay also verifies supplied test/checkin identity. |
| Recent feed compared credited minutes against raw early arrival | P2 | Carry parsed credit through stored/fallback feed mapping and compare credited boundaries; retain raw evidence and legacy anomaly checks. |

The remaining baseline tests were corrected without changing the 120-minute
policy: stale accepted UI/timing/Cron expectations were updated, incomplete
query mocks repaired, and settings initialization now rejects rule-version read
errors before creating defaults. The scanner again releases active or pending
camera acquisition on hide, requires explicit foreground resume, and cancels
delayed decode on hide/unmount. Initial start uses cancellable deferred setup.

## Independent evidence

The reviewer independently ran eight focused files / **111 passing tests**, then
after the final scanner mount adjustment ran two scanner files / **48 passing
tests**, scoped hook ESLint and `git diff --check`. These runs overlap and are
not an additive test count. It re-read SQL, transport, payroll, feed, replay,
settings and scanner code and reported **no remaining actionable P0/P1/P2
finding in the reviewed scope**. A final type-only change uses Supabase `Json`
for stored public credit without changing runtime behavior. The reviewer explicitly reaffirmed the PASS against final implementation commit `e0ba79671f8966b29f9d950c1f987e98a5251478`.

Root verification separately passed **90 files / 671 tests**, scoped lint,
TypeScript checking, the production-mode build with LOCAL placeholders, and **39 LOCAL TEST PostgreSQL scenario groups**. The
reviewer inspected native evidence but did not independently rerun that writable
harness. See [handoff](ATTENDANCE-V2-HANDOFF-2026-11-16.md) for complete target
classification and build/browser results.

## Acceptance limits

This is code-review approval, not production authorization. Synthetic native
PostgreSQL does not prove installed Supabase function/ACL/Auth/RLS/PostgREST,
Vault, pg_net or scheduler parity. Browser QA used the actual scanner in a
LOCAL harness with a simulated camera and mocked actions; it is not
physical-device or authenticated attendance acceptance. Push provider acceptance
is not phone receipt; no actual push was sent. Platform auto-due service
completion is treated as platform evidence, not proof of physical departure or
driver return. Real payroll and installed-PWA acceptance remain outstanding.

One scan within 120 minutes is sufficient. Arrival remains raw evidence;
credited start is the later of arrival and shift start. No production SQL,
migration ledger change, notification send, Cron activation, push, merge or
deployment was performed or authorized by this review.
