# Current Task - CRADLE-FLOW-001

Task ID: CRADLE-FLOW-001
Description: Redesign CRM Work Queue as CRADLE FLOW, a compact front-desk
command center that preserves the existing booking, schedule, attendance,
service-session, Home Service, payment, readiness, and Close Day workflows while
making the real Waiting → In Service → Ready to Pay → Completed sequence clear.
Status: IN PROGRESS
Started: 2026-07-23
Last updated: 2026-07-23

## Guardrails

- Keep `/crm/today`, retained-workspace identity, branch/role authorization, and
  existing source-of-truth actions; do not build parallel booking or Attendance
  engines.
- Use centered dialogs, the existing Cradle cream/forest/gold theme, and compact
  responsive ticket lists instead of a retail POS or horizontal Kanban.
- Final payment must remain unavailable until service completion. Any genuine
  advance payment must be explicit and must not be presented as normal checkout.
- Do not invent split-payment, expense, commission, receipt, or cash-drawer
  persistence that the audited schema does not currently support.
- Do not apply or repair database migrations while linked migration history is
  still 92-local-only / 5-remote-only.

## Work order

1. Audit Work Queue, Quick Booking, booking lifecycle, service sessions,
   payments, reconciliation, Home Service, Attendance, readiness, permissions,
   responsive shell, and required repository context.
2. Build the CRADLE FLOW header, unified booking actions, daily summary, search,
   four-stage workflow, useful empty state, supporting rail, activity, money
   summary, and centered operational dialogs from existing real data/actions.
3. Correct payment-at-creation defaults and final-settlement gating without
   weakening authorized advance-payment audit requirements.
4. Add focused workflow, payment-gate, unified-action, empty-state, and
   responsive presentation coverage.
5. Run focused/full test, type, lint, format, build, and authenticated browser
   verification, then update all repository context and create an atomic commit.

---

# Current Task - PRODUCTION-READINESS-REPAIR-20260723

Task ID: PRODUCTION-READINESS-REPAIR-20260723
Description: Diagnose and repair every genuine source-release blocker, validate
the repository from a frozen dependency install through production build and
available smoke tests, audit secrets/large files/Supabase migration history,
then review, commit, and safely push the intended changes without deploying the
application or applying database migrations.
Status: COMPLETE - SOURCE PUSHED; DATABASE DEPLOYMENT BLOCKED
Started: 2026-07-23
Last updated: 2026-07-23

## Guardrails

- Preserve all intentional Attendance, CRM booking, notification, and retained-
  workspace work already present in the dirty worktree.
- Keep source/Git readiness separate from database-deployment readiness; use
  read-only Supabase inspection and do not reset, push, or repair migrations.
- Do not stage or push secrets, generated output, local state, backups, browser
  profiles, test output, database dumps, or files over GitHub's hard limit.
- Do not rename duplicate migration versions without verified production history.
- Do not force-push or deploy the application.

## Work order

1. Capture Git/remote/divergence state and review the previous readiness reports.
2. Classify top-level items, possible secrets, large tracked files, install
   failure, migration duplicates, and all existing changes before editing.
3. Repair only evidence-backed blockers and preserve recent functional work.
4. Run frozen install, focused/full tests, type-check, lint, format, build, diff,
   secret, migration, path, size, and available browser smoke validation.
5. Update repository context, review every final change, fetch/reconcile remote,
   create clean commit(s), and push without force if every Git stop condition is
   cleared. Database deployment may remain explicitly blocked.

## Validated outcome

- Clean frozen installs pass with Node 24.14.0 and pnpm 10.33.2; Node 25 is
  excluded because it reproducibly terminates the Supabase postinstall with exit
  13 after the binary download.
- Full automated gates pass: 176 test files / 1,253 tests, TypeScript,
  zero-warning ESLint, 96 incremental formatted code/config files, and Next
  16.2.4 production build with 113 static generations.
- Authenticated browser smoke passed `/book`, `/crm/today`,
  `/crm/bookings/new`, and Attendance Today/Review/Setup transitions without
  console errors or tab-update loops. No form was submitted and no live record
  was changed.
- Secret, placeholder, path, case, symlink, conflict-marker, large-file, and
  tracked-artifact audits pass. Intentional media remains below 17 MiB per path.
- Local migration filenames are unique and valid after three evidence-backed
  renames. Linked history still reports 92 local-only and 5 remote-only versions;
  therefore source/Git release is ready but database deployment remains blocked.
- `origin/main` was fetched twice and remained 0 behind. Commits `9ce90656`,
  `32ed2add`, and `bd1d03ad` were pushed without force to
  `https://github.com/techwithmpg/Cradlehub.git` (`main`). This final context
  record follows as a documentation-only commit on the same branch.

---

# Previous Current Task - ATTENDANCE-PRODUCTION-AUDIT-20260722

Task ID: ATTENDANCE-PRODUCTION-AUDIT-20260722
Description: Investigate production Attendance statuses for the Main Spa on the
2026-07-22 Asia/Manila business date, repair only authoritative and auditable
data/logic defects, and report all cases requiring human confirmation.
Status: COMPLETE — CODE VERIFIED; ONE TARGETED LIVE METADATA REPAIR APPLIED
Started: 2026-07-22
Last updated: 2026-07-22

## Guardrails

- Production Supabase is live and receiving scans; confirm project identity and
  remain read-only until exact targets, backups, evidence, and rollback are ready.
- Do not fabricate Attendance, merge profiles from names, broadly delete data,
  rewrite history silently, affect payroll-finalized rows, or change the scan UI.
- Use Asia/Manila business-day boundaries and the canonical Attendance engine.
- Apply only idempotent, target-bounded, audited repairs supported by saved scans,
  approved corrections/assignments, or another authoritative system event.
- Stop for approval before destructive, identity-merging, payroll-finalized, or
  out-of-target production changes.

## Outcome

- The missing prompt table was recovered from the authenticated CRM as the 55-row
  active Main Spa roster. Exact read-only diagnostics found 7 Attendance records,
  15 scans, 81 raw open exceptions, and no July 22 corrections.
- Fixed historical-exception leakage into Today, legacy manual timing subtype
  handling, post-shift no-show classification, shared open/close coverage, and
  operational staff filtering. Correct local live-data render: 54 staff, 2
  Working, 30 Not in yet, 2 Needs review, 3 Checked out, Review count 36.
- Backed up and marked only `Codex QA Work Queue` test/non-schedulable in live
  production. No Attendance, scan, identity, schedule, booking, device, payroll,
  or exception row was rewritten. Ambiguous scans and duplicate identities remain
  human decisions.
- Full evidence and rollback are in
  `docs/attendance/ATTENDANCE-PRODUCTION-AUDIT-20260722.md`.

## Work order

1. Read mandated repository context and current Supabase/Postgres guidance.
2. Confirm the linked production project without printing secrets; snapshot the
   dirty worktree and Attendance-related rows before any possible mutation.
3. Trace QR → device → branch/schedule → Attendance → exception → CRM status and
   the canonical Review count in schema, migrations, types, actions, and queries.
4. Create a read-only Manila-bounded diagnostic SQL/report and classify duplicate,
   demo, no-scan, schedule, branch, state-machine, and exception/count cases.
5. Prepare idempotent backup/repair SQL and source/test patches only for defects
   proven by authoritative evidence; request approval at any stop condition.
6. Run focused Attendance tests, type-check, lint, build, and record exact before/
   after counts, backups, remaining human actions, validation, and rollback.

---

# Previous Current Task - ATTENDANCE-UX-001

Task ID: ATTENDANCE-UX-001
Description: Restructure the CRM Attendance workspace into Today, Fix a Scan, and Tools & History while retaining all existing Attendance functions.
Status: IN_PROGRESS
Started: 2026-07-22
Last updated: 2026-07-22

## Guardrails

- Preserve the Attendance scan engine, recovery/correction paths, QR exports,
  phone/device lifecycle, reports, permissions, RLS, Realtime, audit history,
  cron automation, and Manager workspace.
- Reuse the existing seven Attendance functional areas behind three plain-language
  primary areas; do not duplicate queries, actions, or subscriptions.
- Preserve old `?tab=` deep links while adding canonical URL-backed `view` and
  `tool` state with browser Back/Forward support.
- Keep the existing CRM shell and retained-workspace performance architecture.
- Make no database/schema/RLS changes for this presentation-only task.

## Work order

1. Complete required context, Next.js, Attendance architecture, and baseline review.
2. Add the three-area URL model and task-focused shell without changing engines.
3. Build Today, Fix a Scan, Tools & History, and the responsive staff drawer from
   existing Attendance data/actions.
4. Add focused navigation, presentation, filtering, preservation, and accessibility
   tests; document the redesign and QA matrix.
5. Run focused and full type/lint/test/build/diff gates, perform authenticated
   browser QA when available, and record exact remaining risks.

---

# Previous Current Task - NOTIFICATIONS-001

Task ID: NOTIFICATIONS-001
Description: Add immediate Realtime booking toasts and opt-in browser push notifications using the existing workspace notification system.
Status: CONDITIONAL PASS — IMPLEMENTED; MIGRATION/APPLICATION AND PRODUCTION DEVICE QA PENDING
Started: 2026-07-22
Last updated: 2026-07-22

## Guardrails

- Keep `public.workspace_notifications` as the only normal notification history.
- Preserve its role/branch/recipient RLS, action routing, deduplication, bell pages, and booking transaction behavior.
- Browser permission is requested only from an explicit user action; the VAPID private key remains server-only.
- Push, toast, or sound failure must never roll back a booking.
- Manager workspace is excluded from product/UI changes, and no production migration will be applied automatically.
- Preserve the existing dirty worktree and unrelated user changes.

## Pre-flight

- Read the supplied task brief, required repository context (using canonical `docs/` fallbacks for the missing root planning files), local Next.js 16.2.4 PWA guidance, and current Supabase Realtime/RLS guidance and changelog.
- Inspected the existing notification bell, chime, queries, central store, target routing, dashboard shell, public/in-house booking paths, RLS migration, and booking assignment call sites.
- Created `.codex-backups/NOTIFICATIONS-001-preflight.patch` before task edits.
- Baseline: `main` at `a2f62ad4`; the worktree already contains extensive unrelated tracked and untracked changes.

## Work order

1. Replace minute polling with RLS-scoped Realtime reconciliation and coordinated toast/bell/chime delivery.
2. Add own-row push subscriptions and notification preferences, service worker, authenticated APIs, and explicit settings UI.
3. Add best-effort server Web Push dispatch over persisted workspace notifications with branch/role/staff/driver targeting and failure deactivation.
4. Audit booking event coverage, add focused contracts, document operations, and run the required type/lint/test/build/diff gates without applying production migration.

## Result

- Replaced the notification bell's minute polling with authenticated,
  RLS-authorized Supabase Realtime INSERT/UPDATE reconciliation. Fresh events
  update the bell immediately and are claimed once across visible tabs for toast
  and optional chime; periodic reconciliation is five minutes plus
  visibility/reconnect recovery.
- Added opt-in Web Push subscription state, Owner booking preferences,
  same-origin authenticated APIs, server-only VAPID validation, safe
  service-worker routing, endpoint-health handling, and exact branch/role/staff
  targeting. `workspace_notifications` remains the sole notification history.
- Dispatch runs only after a winning durable insert, never for a dedupe update,
  and catches provider/configuration failures outside booking success.
- Pending bookings notify CRM only. Assigned Staff/Driver signals begin after
  payment confirmation and paid booking changes target the exact affected
  assignees.
- Added the operations/deployment/QA runbook and focused coverage for Realtime,
  toast/chime dedupe, settings, RLS migration contracts, service-worker safety,
  targeting, push failure isolation, and durable-insert dedupe.
- Validation passed: type-check; lint with one unrelated pre-existing Attendance
  warning; 161 test files / 1,180 tests; Next.js 16.2.4 production build with 113
  generated static pages; and task diff checks. Local Supabase DB lint could not
  connect because no local database runs on port 54322; migration contract tests
  and generated TypeScript usage pass.
- `20260721174547_browser_push_notifications.sql` remains unapplied. Configure
  VAPID secrets, apply the reviewed migration through the approved production
  workflow, and complete real browser/device QA before production certification.

---

# Previous Current Task - CRM-RETENTION-001

Task ID: CRM-RETENTION-001
Description: Retain recently visited CRM and Owner modules, preserve workspace state, pause hidden module effects, and refresh cached data quietly when users return.
Status: CONDITIONAL PASS — IMPLEMENTED; CRM BROWSER PASSED, OWNER/PERFORMANCE-PANEL QA PENDING
Started: 2026-07-21
Last updated: 2026-07-22

## Guardrails

- The paused Manager workspace is excluded and must remain unchanged.
- Do not apply production migrations, cron configuration, migration repairs, or destructive SQL automatically.
- Preserve existing role, branch, booking, schedule, payment, dispatch, Attendance audit, and public booking behavior except for the confirmed launch defects.
- The existing dirty worktree and unrelated branch-assignment/session work must be preserved.

## Pre-flight

- Read all required context files and the canonical `docs/ROADMAP.md` /
  `docs/PROJECT_CONTEXT.md` fallbacks (the requested root copies do not exist).
- Read the local Next.js 16.2.4 Cache Components, Activity navigation,
  stale-times, and App Router navigation guides plus the Supabase task guidance.
- Inspected package/lock/config versions, dashboard/CRM/Owner layouts, shell,
  prefetcher, SWR modules, booking events, Realtime hooks, and every requested
  CRM/Owner rollout route.
- Created `.codex-backups/CRM-RETENTION-001-preflight.patch`.
- Baseline: `main` at `a2f62ad4`; type-check passed; lint passed with one
  existing unrelated warning; 150 files / 1,137 tests passed. The prior
  CRM-PERF-002 production build was green before this continuation.

## Result

- Selected one manual identity-scoped LRU registry using React 19.2.4 Activity;
  Next Cache Components remains disabled.
- CRM retains Work Queue, Bookings, Schedule, Attendance, and Customers (limit
  four). Owner Overview, Reports, and Bookings are available under the `all`
  rollout (limit three). Default rollout is CRM-first; `off` is rollback.
- Hidden frames are Activity-hidden plus `hidden` / `aria-hidden` / `inert`;
  effect cleanup pauses existing polling, timers, and Realtime. Dirty/stale SWR
  modules reconcile once on activation while keeping current data.
- Cache and component state are scoped by user, role, and branch and stay
  in-memory only. SWR keys are scope-prefixed and purged on workspace teardown.
  LRU, draft protection, scroll restoration, cache reset,
  fresh/dirty refresh counts, and effect lifecycle have focused automated tests.
- Dispatch and Owner Schedule remain deliberately outside full DOM retention.
- Authenticated CRM QA passed retained and evicted returns, URL state,
  Back/Forward, accessibility hiding, and the four-frame LRU. The account lacks
  Owner access; exact heap/network/CLS/long-task evidence remains pending.
- Final gates pass: type-check, production build, 152 files / 1,152 tests, and
  lint with one pre-existing unrelated warning.

---

# Previous Current Task - CRM-PERF-002

Task ID: CRM-PERF-002
Description: Remove disruptive CRM and Owner workspace reloads and migrate operational interactions to retained client state, localized loading, optimistic mutations, and background cache reconciliation.
Status: IDLE — IMPLEMENTATION COMPLETE, OWNER BROWSER QA PENDING
Started: 2026-07-21
Last updated: 2026-07-21

## Result

- Conditional pass. Active CRM/Owner ordinary mutations have zero `router.refresh()` calls, all 22 CRM/Owner route loaders are removed, internal document navigation is eliminated, and retained SWR/canonical mutation patterns cover Reports, Bookings, Attendance, Dispatch, Schedule, Services, Staff, Marketing, Attendance Rules, and Payroll.
- Type checking, production build, diff check, focused tests, and the 145-file / 1,117-test complete suite pass. Lint has zero errors and two existing unrelated warnings.
- Authenticated CRM browser QA verified persistent shell navigation, Schedule Back/Forward, retained Setup selection, and zero browser console errors.
- Remaining release evidence: repeat the requested Owner Reports and Marketing/Attendance Rule click-through in an authenticated Owner session, plus the exact CRM Work Queue → Bookings → Work Queue sequence. See `docs/performance/crm-perf-002-report.md`.

---

# Previous Active Task - STAFF-BRANCH-ASSIGNMENT-INTEGRITY-RESOLVER-001

Status: IN PROGRESS
Started: 2026-07-15
Last updated: 2026-07-15

## Mission

Replace the replay-based Attendance branch-correction flow with one authoritative
Branch Assignment Integrity Resolver. It must diagnose cross-module staff branch
inconsistencies, require authorized explicit decisions for material changes,
preserve historical records, and never create, modify, or replay Attendance.

## Guardrails

- Attendance detects a wrong branch and opens or reuses an assignment issue; it
  must not repair profile, schedule, service, transfer, or access data.
- The resolver transaction owns current/future branch assignment integrity only.
  It returns an assignment decision and a next action, never an Attendance result.
- Keep the existing replay resolver temporarily for other callers, marked
  deprecated; new UI and server actions must use the assignment-only resolver.
- All branch mutations require server-side role, tenant, staff, and active-branch
  verification, reason capture, row locks, audit records, and atomic rollback.
- Preserve historical Attendance, bookings, schedules, payroll, and audit data.
  Never silently move future bookings or grant unrestricted multi-branch access.

## Work order

1. Audit the existing Branch Corrections flow, Attendance mismatch detection,
   relevant assignment data, permissions, migrations, generated types, and tests.
2. Add the assignment issue model, diagnostic summary, root-cause classification,
   assignment-only resolver transaction, and safe idempotency contract.
3. Move Staff Management to Branch Assignment Issues and call the new server
   action; retain wrong-scan confirmation and explicit repair/review paths.
4. Ensure the next ordinary scan evaluates current primary branch plus effective
   temporary access without resuming a captured failed scan.
5. Add focused contracts, documentation, context records, and verification.

---

# Previous Task - ATTENDANCE-BRANCH-RESOLUTION-TRANSACTION-FIX-003

Status: COMPLETE — CONDITIONAL SUCCESS
Started: 2026-07-15
Last updated: 2026-07-15

## Mission

Capture the exact live failure behind the generic Branch Correction retry
message, compare the application payload with the live resolver and its internal
Attendance RPCs, and repair the smallest proven contract defect without weakening
authorization, idempotency, or atomic rollback.

## Guardrails

- Treat the confirmed outer RPC as present; inspect its live body, ACL, owner,
  search path, referenced schema, constraints, internal calls, and result contract
  before replacing anything.
- Reproduce only with Test Mode or dedicated rollback-only QA data. The observed
  real pending request and source scan are read-only diagnostic evidence unless
  the user separately authorizes a real Attendance mutation.
- Preserve service-only execution, server-derived actor/branch identity, row and
  advisory locking, deterministic replay, historical snapshots, and one-transaction
  rollback across authorization/transfer, scan continuation, and final resolution.
- Map known business failures to actionable staff-safe messages while keeping raw
  SQLSTATE, tokens, device credentials, keys, and private data server-side.
- Create a new additive migration only after the exact live defect is proven; do
  not edit applied migrations, reset schema, weaken RLS, or blind-push the drifted
  migration backlog.

## Work order

1. Trace UI → server action → source-scan reconstruction → `p_scan_commit` → live
   branch resolver → internal Attendance commit and capture the real failure stage.
2. Inspect live function metadata/body/grants, tables/columns, constraints/indexes,
   pending request/source identity, actor/staff/branch/authorization/open Attendance,
   internal RPC signatures, return contract, and migration history.
3. Implement only the proven migration/application/error-mapping repair, preserving
   atomicity and safe retry behavior.
4. Verify temporary shift/day, permanent transfer, rollback, replay/concurrency,
   Test Mode, and zero-residue cleanup with dedicated data.
5. Run focused/full type, lint, test, and build gates; regenerate live types when
   schema changes; update the context, roadmap, and handoff with exact evidence.

## Implementation and verification

- Captured the exact live resolver failure as PostgreSQL `42702`
  (`ambiguous_column`). Both final `attendance_exceptions` updates used an
  unqualified `scan_event_id`, which conflicted with the resolver's `RETURNS
  TABLE` output parameter. The valid-device QA statement aborted completely.
- Applied and recorded additive migration
  `20260715113001_attendance_branch_resolution_transaction_fix.sql`. It guards
  the expected live function body, qualifies only the two exception updates,
  retains `SECURITY INVOKER`, `search_path=public, extensions`, the exact
  signature/result contract, and service-role-only execution, then refreshes
  the PostgREST schema cache.
- The supplied real request remains pending and untouched. Its source event is a
  first-login wrong-branch event with no device ID, so it cannot be resumed
  safely. Future authenticated first scans now register the verified phone
  before canonical wrong-branch capture; existing incomplete requests receive
  an explicit “ask the staff member to scan again” result.
- Rollback-only live QA passed temporary shift, business-day, permanent transfer,
  controlled missing-device failure, forced inner-commit rollback, and a second
  manager replay. Continuation events and Attendance rows were linked, replay
  created no duplicate authorization or Attendance, historical branch snapshots
  remained correct, and post-QA residue was zero across all synthetic tables.
- Live metadata after the patch: one exact 11-argument overload; volatile and
  parallel-unsafe; invoker security; safe explicit search path; service role can
  execute; `anon` and `authenticated` cannot. All referenced tables, 72 columns,
  foreign keys, checks, indexes, uniqueness guards, and internal Attendance RPC
  signatures were inspected against the linked project.
- Verification passes: regenerated live Supabase types; 4 focused files / 31
  tests; full 138 files / 1,103 tests; type-check; lint with one pre-existing
  unrelated warning; diff check; Next.js 16.2.4 production build with 110 pages;
  and `pnpm db:verify-live`.
- Final certification is conditional only because the application changes are
  not deployed from this uncommitted worktree and no authenticated production
  browser/device resolution was submitted. The live database transaction itself
  is repaired and verified with dedicated rollback-only data.

---

# Previous Task - ATTENDANCE-BRANCH-CORRECTION-RESOLUTION-001

Status: COMPLETE
Started: 2026-07-15
Last updated: 2026-07-15

## Mission

Replace the ambiguous wrong-branch Attendance approval with an explicit,
auditable resolution workflow for temporary shift/day access, permanent branch
transfer, and rejection. Approved resolutions must resume the original pending
scan through the authoritative Attendance engine, preserve historical branch
records, and prevent duplicate decisions or Attendance actions.

## Guardrails

- Extend the current Branch Corrections request, audit, scan, notification, and
  Staff Management patterns; do not redesign Staff Management or duplicate QR
  clock-in/clock-out logic in the UI action.
- Trust only server-derived tenant, actor, staff, source/target branch, scan, and
  Attendance state. Ordinary staff cannot resolve their own request.
- Keep temporary authorization branch-specific, bounded, revocable, overnight
  safe, and linked to the source request/scan; permanent transfer changes only
  current profile authority and never rewrites historical records or bookings.
- Use one short transactional resolution path with row/advisory locking,
  deterministic replay, strict grants/RLS, and current cache/realtime patterns.
- Use dedicated Test Mode or QA data for write verification. Do not perform live
  Attendance QA against real staff unless separately approved.

## Work order

1. Trace the existing Branch Corrections UI/actions/RPCs, wrong-branch scan
   creation payload, scan transaction, audit model, RBAC, notifications, and
   affected branch/schedule/booking/availability consumers.
2. Inspect local and linked schema/migration state; design the smallest additive
   authorization/decision/scan-continuation contract and impact summary.
3. Implement the compact Resolve Branch dialog, safe reject flow, server action,
   transactional persistence, authoritative scan continuation, and refreshes.
4. Add focused UI/service/migration/RBAC/idempotency/clock-in/clock-out/Test Mode
   regressions and the branch-correction operations document.
5. Run focused and full verification, apply only an approved safe migration when
   available, regenerate types, perform dedicated QA where possible, and update
   project context with exact evidence and remaining limitations.

## Implementation and verification

- Replaced generic approval with explicit shift access, business-day access,
  permanent transfer, and rejection decisions. The dialog shows validity,
  permanent-impact review, required reasons, Test Mode restrictions, reviewer,
  and the final Attendance result.
- Added one locked, service-role-only database resolver that validates actor and
  branch authority, prevents self/conflicting decisions, writes authorization or
  transfer audit, and resumes the stored source scan through the authoritative
  Attendance commit engine in the same transaction. Replay is deterministic and
  continuation failure rolls back the whole decision.
- Extended existing request, date-effective assignment, Attendance, source-event,
  audit, notification, and task patterns. Historical home/actual branches remain
  snapshotted; permanent transfer does not rewrite bookings, schedules, services,
  payroll, devices, or prior Attendance.
- The focused migration is live and version `20260715113000` is recorded. Exact
  columns, indexes, RLS state, SELECT-only browser policies/grants, restricted
  function ACLs, and a safe not-found call were verified. The broader historical
  migration backlog remains out of scope; do not blind-push it.
- Synthetic rollback QA covered Test Mode shift/day, future-day denial, permanent
  transfer, rejection, same-decision replay, closed-shift revocation, source/result
  linkage, a forced inner-commit failure with complete side-effect rollback, and
  zero residual QA rows. One real pending request was observed only in aggregate
  and was not opened or mutated.
- Verification passes: type-check; lint with one pre-existing unrelated warning;
  focused 5 files / 23 tests; full 136 files / 1,086 tests; Next.js 16.2.4 build
  with 110 generated pages; generated live Supabase types; and diff checking.
- Arbitrary date ranges are intentionally deferred. The persisted validity model
  supports a later additive range UI, but this release exposes only shift and
  target-branch business-day authorization.
- Operations and release details are in
  `docs/attendance/BRANCH_CORRECTION_RESOLUTION.md`.

---

# Previous Task - CRM-OPEN-CLOSE-SCHEDULE-NORMALIZATION-001

Status: COMPLETE
Started: 2026-07-15
Last updated: 2026-07-15

## Mission

Add a targeted Adjust Schedule repair for eligible CRM/front-desk staff whose
same-day Opening and Closing responsibility windows overlap. The repair must
normalize the Opening end to the Closing start, preserve the Closing overnight
boundary and both responsibility labels, keep global overlap validation strict,
and calculate preview/weekly totals from unique covered minutes.

## Guardrails

- Do not persist overlapping windows or weaken general overlap validation.
- Restrict the repair to current CRM/CSR/front-desk role and staff-type policy;
  do not silently expand therapist, salon, utility, driver, or managerial rules.
- Preserve split shifts with gaps, exact-boundary adjacency, overnight business
  dates, the existing weekly replacement transaction, bookings, Attendance
  records, and dynamic Attendance clock-out policy.
- Prefer local editor validation/normalization and pure coverage utilities; add
  no migration, new shift enum, subscription, job, dependency, or Vercel cron
  unless the current source proves one is required.

## Work order

1. Trace Adjust Schedule, shared weekly editor/draft, validation, preview,
   hours, save action, resolver, availability, Attendance, permissions,
   overnight handling, and focused tests.
2. Add a pure compatible Open-Close classifier/normalizer and union-based unique
   coverage calculation.
3. Surface an explicit Fix automatically action that updates the unsaved draft,
   reruns validation, and refreshes preview/totals.
4. Add focused regressions across eligible/ineligible overlaps, adjacency,
   overnight, totals, persistence payloads, availability, and Attendance.
5. Run focused tests plus type-check, lint, full test, and production build;
   update context docs with exact evidence and any remaining manual-QA limits.

## Implementation and verification

- Added an eligible CRM/CSR/front-desk-only Open-Close classifier and explicit
  `Fix automatically` action in Adjust Schedule. It changes only the Opening
  end to the Closing start, keeps both shift labels and the Closing overnight
  boundary, and requires the existing Save Adjustment transaction to persist.
- Added shared union-based coverage arithmetic. Overlapping and touching windows
  count unique minutes once and support continuous fit across an exact handoff;
  real split-shift gaps remain unavailable. Four 10:00-01:30 workdays calculate
  as 62h before and after normalization.
- The resolver marks only eligible adjacent CRM Open-Close days as continuous
  coverage. Booking/availability/conflict consumers use that coverage, while
  Attendance keeps the Opening start and Closing end/responsibility across the
  handoff and next-day business-date boundary.
- No schema, migration, enum, booking record, Attendance record, Vercel config,
  dependency, or dynamic clock-out policy changed. Existing strict database and
  server overlap rejection remains authoritative; adjacency remains valid.
- Verification passed: 93 focused tests; 135 files / 1,075 full tests;
  type-check; lint with the one pre-existing unrelated unused-function warning;
  `git diff --check`; and the Next.js 16.2.4 production build with 110 routes.
- Authenticated localhost QA used Nikki Jumiller's exact Wed-Sat regression
  fixture: warning and 62h appeared before repair, the repaired preview showed
  10:00-17:00 plus 17:00-01:30 next day, Save succeeded, the timeline refreshed
  to continuous 10:00-01:30 coverage with zero conflicts, and reopening showed
  the persisted valid 62h schedule. The selected staff had zero same-day
  bookings before and after; no positive next-day booking fixture was created.

---

# Previous Task - ATTENDANCE-SMART-DYNAMIC-CLOCK-OUT-001

Status: COMPLETE
Started: 2026-07-15
Last updated: 2026-07-15

## Mission

Extend the single existing Attendance engine with one authoritative,
schedule-backed dynamic clock-out policy. Resolve final work from staff services,
branch-closing services, home-service dispatches, and driver trips; keep the
resolved schedule as the fallback; store auditable dynamic deadlines; authorize
limited portal clock-out server-side; preserve branch QR as the default; and
recalculate only affected open Attendance records from lifecycle events.

## Guardrails

- Do not redesign Attendance or introduce a parallel engine/scheduler.
- Preserve staff scheduling permissions, record-first/flag-second QR behavior,
  Test Mode isolation, registered-device policy, tenant/branch authorization,
  and transactional/idempotent clock-out semantics.
- Ordinary in-branch staff continue to use branch QR. Portal clock-out is limited
  to final home-service therapists, eligible closing staff, and final-trip drivers.
- Never trust staff, branch, attendance, expected-time, classification, or
  eligibility values supplied by the browser.
- Keep recalculation event-driven and retain Supabase's bounded deadline safety
  processor; do not add a frequent Vercel Attendance cron.
- Add only additive, production-safe schema/index changes after inspecting the
  live and generated data model. Do not blind-push the known migration-history
  drift.

## Work order

1. Map the existing Attendance, schedules, services, bookings, dispatch, driver,
   recovery, correction, portal, event, schema, and scheduler contracts.
2. Implement a pure dynamic policy resolver plus focused authoritative loaders
   and persisted policy evidence on the existing Attendance record.
3. Reuse the resolver from QR, portal, recovery/corrections, and closing safety
   processing; recalculate affected open records on lifecycle changes.
4. Add compact Staff/Driver Portal controls backed by one server-authorized,
   device-aware, transactional clock-out endpoint/RPC.
5. Add the focused migration/types/tests/docs, run every requested gate, apply
   only verified safe database changes, then commit, push, and observe production.

## Implementation and live verification

- Added one restricted PostgreSQL resolver and one transactional portal commit
  RPC, reused by QR and portal flows. Focused lifecycle triggers recalculate only
  affected open Attendance rows and use the same staff advisory lock.
- Added configurable service, home-service, and driver buffers plus final-client
  release and closing-portal category policy fields. Generated types are updated.
- Added Staff Portal and Driver Portal controls whose availability is derived on
  the server; browser requests contain no trusted staff, branch, booking, policy,
  or timestamp values.
- Applied only migration `20260715021703_attendance_smart_dynamic_clock_out.sql`
  to linked project `lsrb...olkv` through isolated SQL. An idempotent Training
  Mode resolver probe passed; no live clock-out was submitted.
- The repository still has 81 local-only and 5 remote-only migration versions.
  The new migration is deliberately not inserted into remote migration history;
  do not run a broad `db push` until that independent drift is reconciled.
- Final automated gates pass: type-check; lint with one pre-existing warning;
  134 test files / 1,062 tests; live health; additive/config/secret checks; and
  the Next.js 16.2.4 production build with 110 routes.
- Commit `5b0ce6cb` is on `origin/main` and Vercel production deployment
  `dpl_4g7CsMzV42FVTUG8yXQcfWGy6m3k` reached READY. The public `www` domain
  returned 200 and unauthenticated `/staff-portal` safely rendered sign-in.
  Authenticated multi-role and physical-device E2E is not claimed.

---

# Previous Task - ATTENDANCE-HYBRID-CLOSING-AUTOMATION-001

Status: IN_PROGRESS
Started: 2026-07-15
Last updated: 2026-07-15

## Mission

Replace the Vercel Hobby-incompatible five-minute Attendance cron with the
existing event-driven closing deadline snapshots plus four exact Supabase Cron
safety jobs that call one bounded, idempotent PostgreSQL processor directly.

## Guardrails

- Preserve CRM/CSR closing classifications, stored deadline timestamps,
  notification/workflow-task behavior, active-service protection, provisional
  correction/exception audit, actual-scan reconciliation, and Test Mode.
- Remove only the frequent Attendance entry from `vercel.json`; retain the
  unrelated daily agent cron and the protected manual Attendance fallback route.
- Query only open, live `crm_closing` records through partial due-time indexes;
  create intervention rows only when a stage actually applies.
- Use four direct SQL Supabase Cron jobs at verified UTC times. Do not use HTTP,
  external schedulers, secrets in SQL, or a blind full migration push.

## Verified preflight

- Linked production project identity is `lsrb...olkv`; read-only health checks
  pass against Postgres 17.6 and the transaction pooler.
- Both active branches use `Asia/Manila`; the database timezone is UTC.
- The existing closing columns, intervention table, snapshot trigger, and legacy
  processor are live even though their local migration versions are absent from
  migration history. Current drift is 79 local-only / 5 remote-only.
- `pg_cron` and `cron.job` are not yet enabled, and no existing cron jobs can be
  present until the extension is enabled.

## Work order

1. Add the restricted stage processor, partial indexes, and operation SQL.
2. Make the manual route delegate to the database processor and remove the
   frequent Vercel schedule.
3. Add the 40 requested focused contracts and operations documentation.
4. Run all gates, apply only the isolated migration and scheduler setup, verify
   jobs/runs/security, then commit, push, and observe production deployment.

---

# Previous Task - LIVE-DATABASE-UI-VERIFICATION-CONNECTION-001

Status: COMPLETE — CONDITIONAL SUCCESS
Started: 2026-07-15
Last updated: 2026-07-15

## Mission

Establish and certify a secure, reusable, read-only-by-default connection to the
intended live Supabase project, add sanitized connection and QA verification
tooling, reconcile repository/live migration evidence without modifying the live
database, and match authenticated UI state to authoritative live records.

## Guardrails

- Never print, commit, screenshot, or expose passwords, service-role keys, tokens,
  cookies, or private operational data.
- Do not apply or repair migrations and do not modify live records.
- Prefer the linked CLI and direct/pooler SQL, with server-side REST as a safe
  read-only fallback.
- Keep verification tooling server-only, bounded by explicit timeouts, sanitized,
  and read-only unless a future user-approved QA run opts into writes.
- Do not claim multi-role, realtime, or write certification without direct evidence.

## Work order

1. Complete mandatory project, Supabase, environment, auth, test, and browser
   pre-flight and confirm the intended project identity without exposing secrets.
2. Add reusable connection health-check and QA verification helpers using the
   existing database tooling architecture.
3. Verify linked CLI, DNS/network, pooler/direct SQL, REST/schema, migration
   history, and generated-type parity using read-only operations.
4. Open authenticated UI and match safe UI values to live database queries.
5. Run all automated gates, document the reusable workflow and limitations,
   commit, and push.

## Completion

- Confirmed the configured, linked, and URL-derived project identity agree without
  printing secrets. Local secret files and browser auth-state paths are ignored.
- Added `pnpm db:verify-live`, a server-only reusable read-only QA helper layer,
  bounded/sanitized SQL and REST checks, anon RLS probes, transaction-pooler probe,
  QA run identification, database waits, and UI/database comparison helpers.
- Certified linked Management API SQL, Postgres 17.6, 64 public tables, all 16
  required REST tables, anonymous public branch access, anonymous staff isolation,
  migration metadata, and read-only transaction-pooler SQL on port 6543.
- Updated `db:status` to fall back from the unavailable session connection to
  official read-only Management API migration metadata. It now reports 107 unique
  local versions, 33 remote versions, 79 local-only, and 5 remote-only versions.
- Regenerated live types with no diff. Authenticated CRM Today opened at the
  configured localhost:3000 origin with no console errors; UI counts for Today and
  home service matched the live branch/date aggregate query at zero.
- Added the sanitized reuse guide and four focused tests. Type-check, lint (one
  existing Attendance-only warning), 132 files / 962 tests, and build all pass.
- No live write, migration, history repair, RLS change, or cleanup was performed.
  Final result is CONDITIONAL SUCCESS pending migration reconciliation, dedicated
  multi-role sessions, approved controlled writes, and realtime certification.

---

# Previous Task - CRADLEHUB-CORE-SYSTEMS-BETA-READINESS-001

Status: COMPLETE — NO-GO DECISION
Started: 2026-07-15
Last updated: 2026-07-15

## Mission

Perform a complete beta-readiness audit of all essential CradleHub systems outside
Attendance, exercise the critical business workflows through source, database,
automated, and browser verification, fix safe scoped defects, add regression
coverage, and return per-system plus overall readiness decisions.

## Guardrails

- Preserve the existing architecture, shared components, business rules, and
  frozen UI unless a verified workflow or usability defect requires a change.
- Do not certify authenticated roles or operational flows without direct evidence.
- Use dedicated QA/Test Mode data for controlled writes and clean only that data.
- Do not push migrations while linked migration history remains unreconciled.
- Keep authorization server-enforced and multi-write operations atomic.

## Work order

1. Complete the mandatory context, source, schema, permissions, environment, and
   test pre-flight.
2. Audit systems in the requested priority order, including database, RLS,
   realtime/cache, security, concurrency, recovery, performance, and mobile.
3. Run focused and full automated checks plus browser verification, and perform
   the controlled authenticated scenario only where safe QA identities exist.
4. Fix safe beta blockers, add regression tests, and rerun affected gates.
5. Update context records, commit and push the audit, and deliver the required
   evidence-separated readiness report.

## Completion

- Verified the linked REST schema for all configured critical tables; direct
  migration-history access remains blocked by the database pooler timeout.
- Verified type-check, 131 files / 958 tests, lint with one Attendance-only
  warning, and the Next.js production build with 110 routes.
- Used an authenticated CRM session to verify mobile CRM Today, booking entry,
  Schedule, Dispatch, Reconciliation, workspace selection, Staff Portal, and
  denial of owner/driver workspaces without horizontal overflow at 390px.
- Verified the public booking branch step on mobile and localhost Google sign-in
  on the configured port. No safe owner, manager, driver, utility, or dedicated
  transactional QA identities were available for the destructive 34-step E2E.
- The reused cross-port session also produced sanitized missing-refresh-token
  server errors, so expired/stale session recovery is not certified.
- No safe core code defect was proven by the available source, database, unit,
  build, or non-destructive browser evidence, so no speculative code change or
  redundant regression test was added.
- Final decision is NO-GO: migration history and the full multi-role, write-heavy
  controlled E2E remain uncertified despite green automated and CRM smoke gates.

---

# Previous Task - ATTENDANCE-BETA-READINESS-001

Status: COMPLETE — NO-GO DECISION
Started: 2026-07-15
Last updated: 2026-07-15

## Mission

Perform a complete beta-readiness audit of the existing Attendance QR system:
verify the clean database baseline and live schema/security state, exercise the
critical device/clock-in/clock-out/idempotency/training/recovery/browser paths,
fix safe scoped defects, add missing regression coverage, and return an honest
GO / CONDITIONAL GO / NO-GO decision.

## Guardrails

- Preserve staff, devices, QR points, schedules, branches, Attendance Rules,
  branch assignments, and authentication accounts.
- Use Test / Training Mode and dedicated QA data for controlled writes.
- Do not blind-push pending migrations while linked migration history is
  unreconciled.
- Keep security/identity failures blocked and accepted Attendance commits atomic.
- Do not certify physical-device, authenticated, scheduler, or browser behavior
  without direct evidence.

## Work order

1. Complete mandatory source/context/migration/type/test pre-flight.
2. Confirm the stated live database baseline, schema, indexes, functions, grants,
   RLS, migration state, generated-type parity, and safe insert capability.
3. Audit and test device registration, scan continuation, clock-in/out,
   outside-hours, closing policy, idempotency, schedules, wrong branch, Training
   Mode, Recovery, reporting, security, failure handling, and performance.
4. Fix safe beta blockers and add focused regression tests.
5. Run focused/full tests, type-check, lint, build, and Browser-first responsive
   verification where credentials and fixtures permit.
6. Update context records and deliver the required readiness report/checklist.

## Completion

- Confirmed the requested live baseline and returned all six operational tables
  to zero after controlled QA; devices (6) and QR points (9) remain preserved.
- Repaired the missing live `staff.is_cross_branch` column that blocked all valid
  public scans and verified the required fresh-phone login UI on mobile.
- Added visible committed Training Mode result labeling and focused tests.
- Verified atomic insert plus request-id replay, RLS/index/function contracts,
  regenerated types, type-check, 131 files / 958 tests, lint, and build.
- Final decision is NO-GO because migration history is unreconciled and no safe
  staff credentials/physical active-device credential were available to certify
  registered-device clock-in/out or one-scan credential continuation end to end.

---

# Previous Task - ATTENDANCE-SCAN-RESULTS-AND-RECORD-FIRST-001

Status: COMPLETE LOCALLY — LIVE STAFF-CREDENTIAL DEVICE E2E PENDING
Started: 2026-07-15
Last updated: 2026-07-15

## Mission

Preserve the current secure one-scan device-registration continuation and add only
the missing public Attendance behavior: ordinary outside-hours record-first
clock-ins with atomic review evidence, deterministic branch-time personalized
success copy, and a compact secondary review badge while green success remains
primary. Genuine closing ambiguity remains capture-only and security failures
remain blocked.

## Guardrails

- Do not alter CRM closing policy, Branch Attendance Rules, schedules, payroll,
  reports, Recovery UI, scanner animation, Training Mode, branch corrections, QR
  security, or the existing device-registration transaction/cookie model.
- Keep the backend committed `PublicScanResult` authoritative and idempotent.
- Reuse the existing scan transaction for raw event, official check-in, exception,
  device timestamps, and committed result; no client-side split writes.
- Use nickname/first-name/generic fallback, deterministic selection, and branch-
  local time. Never use `Math.random()` for result copy.

## Work order

1. Trace intent resolution, secure device continuation, committed result contracts,
   public result rendering, transaction RPC, exception mapping, and tests.
2. Implement only confirmed gaps in intent, greeting/result copy, and review badge.
3. Add focused regression coverage for record-first, device continuation, stable
   greetings, captured ambiguity, backend copy, and badge mappings.
4. Run focused/full type, lint, test, build, and rendered Browser-first checks.
5. Update context, decision/error/handoff, project context, and roadmap honestly.

## Completion

- Confirmed and preserved the secure first-scan continuation: `unknown_device`
  opens the sign-in form without leaking its technical result; valid staff sign-in
  connects the phone, sets the existing secure credential, and continues the same
  original scan with `nextScanRequired: false`.
- Ordinary first scans outside both normal windows now create the real clock-in and
  an open `ambiguous_scan` review exception through the existing authoritative scan
  transaction. A sole open row still clocks out, closing ambiguity remains
  capture-only, and security/identity failures remain blocked.
- Added deterministic nickname-first, branch-time-aware greetings committed in the
  backend result, backend-authoritative public copy, a compact amber review label,
  and the calm captured-closing state. The green success card remains primary.
- Staff-facing card date/time now uses the server-provided branch timezone rather
  than the browser or a fixed Manila-only display source.
- Verification passes: `pnpm type-check`; focused ESLint; 7 focused files / 70
  tests; full `pnpm test --run` at 130 files / 956 tests; and the Next.js 16.2.4
  production build with 110 static pages. Full `pnpm lint` exits 0 with one
  unrelated existing unused-function warning in
  `attendance-correction-service.ts`.
- Browser verification reached the authenticated CRM Attendance QR detail and the
  public invalid-QR blocked state with no console errors. No real staff credentials
  were entered and no live Attendance mutation was created, so physical/valid-phone
  credential E2E remains pending.

---

# Previous Task - ATTENDANCE-CRM-CLOSING-POLICY-001

Status: COMPLETE LOCALLY — MIGRATION APPLY, SCHEDULER OBSERVATION, AND AUTHENTICATED QA PENDING
Started: 2026-07-14
Last updated: 2026-07-14

## Mission

Integrate branch-specific Attendance Rules into the existing Owner branch-detail
module and connect a structured, effective-dated CRM closing policy to the current
Attendance resolver, scan/correction path, notification/task system, audit model,
and existing scheduler infrastructure. Preserve raw schedule history and QR evidence;
CRM closing Attendance uses the branch physical close through close-plus-buffer,
with idempotent reminder, escalation, provisional auto-close, and real-scan
reconciliation.

## Guardrails

- Extend `attendance_settings` and existing Attendance records; do not create a
  second settings page, Attendance engine, result table, notification system, or
  scheduler.
- Keep `staff_shift_checkins` official, `qr_scan_events` immutable, and
  `attendance_exceptions` / `attendance_corrections` authoritative for review/audit.
- Apply the special closing window only to normalized CRM/front-desk staff on a
  resolved `closing` shift; all other categories and shift types remain schedule-based.
- Use structured branch-local times, effective dates, historical policy snapshots,
  owner/server-side branch authorization, additive RLS-protected migration SQL, and
  deterministic intervention dedupe keys.
- Do not blind-push migrations while linked migration history remains unreconciled.

## Work order

1. Trace the owner Branches form/actions, Attendance settings/scan/metrics/snapshots,
   role and shift normalization, notifications/tasks, scheduler, audit, RLS, and tests.
2. Add the focused schema, policy resolver, classification, intervention transaction,
   and late-real-scan reconciliation with tests.
3. Integrate the compact Attendance Rules component and secure owner mutations into
   the existing selected-branch page.
4. Regenerate local types, run focused/full checks, and distinguish source, database,
   scheduler, and authenticated browser verification.
5. Update project context, decisions, errors, changelog, roadmap, and handoff.

## Completion

- Added the selected-branch Attendance Rules card, effective-dated branch and
  category rule writes/history, the structured CRM closing window, immutable
  per-check-in policy snapshots, transactional intervention/reconciliation RPCs,
  and the existing notification/task worker route on the existing Vercel cron.
- Preserved raw schedules and QR evidence. A system provisional close uses
  `system_auto_close`, leaves `clock_out_scan_event_id` null, opens the existing
  missing-clock-out review path, and a later real QR scan reconciles the same row.
- Local types were reconciled for the additive migration. Linked type generation
  and database/RPC verification are intentionally deferred until pending migration
  history is reconciled and migrations `20260714143000` and `20260714180000` are
  applied in order.
- Authenticated Owner visual QA remains pending because the available browser
  session redirects the protected route to `/login`.
- Verification passes locally: type-check; ESLint exit 0 (one pre-existing warning);
  4 focused files / 62 tests; 127 full files / 921 tests; Next.js production build
  with 110 static pages; and diff check. Linked DB verification intentionally fails
  the three unapplied new tables, proving deployment is still gated.

---

# Previous Task - ATTENDANCE-FLUID-OPERATIONS-001

Status: COMPLETE LOCALLY — MIGRATION APPLY AND AUTHENTICATED DEVICE QA PENDING
Started: 2026-07-14
Last updated: 2026-07-14

## Mission

Make Attendance dependable and quiet for operations: recognize the staff/device,
record clear attendance safely, and route uncertainty into one simple audited
review queue. Raw scan attempts remain permanent evidence; attendance records are
the official result; exceptions explain uncertainty; corrections retain before/
after evidence.

## Required policy

- Only genuine security/identity failures block a scan.
- Exactly one open Attendance record means the next valid scan clocks it out,
  preserving the original schedule snapshot and flagging timing/schedule anomalies.
- Multiple open records and a first scan near closing are captured without
  inventing attendance and sent to review.
- Missing schedule, scheduled off, and ordinary outside-schedule scans record first
  and flag second; legacy blocking settings are compatibility-only.
- Accepted scan persistence must be atomic and idempotent, including raw evidence,
  attendance, exception, device timestamps, and the committed result.
- Effective branch permission resolves temporary assignment, date schedule,
  approved cross-branch authorization, then home branch; device branch is metadata.
- All Attendance consumers use one branch-timezone/business-date staff-day status.
- Human intervention uses one review queue; corrections are atomic and audited.
- Only Daily Attendance, Exceptions and Corrections, and Payroll Export remain as
  operational report contracts.

## Work order

1. Trace the real scan route, engine, transaction RPC, constraints, settings,
   schedules/branches, Recovery, reports, Realtime, and tests.
2. Record root causes and compatibility constraints.
3. Implement one-open-record and record-first policy with atomic idempotency.
4. Consolidate effective branch and shared staff-day status resolution.
5. Simplify review/correction actions and repair the three report contracts.
6. Add the required focused/database contract coverage and run all checks.
7. Update architecture/context records and hand off remaining deployment/E2E risk.

## Completion

- Implemented the fixed record-first decision model, global sole-open behavior,
  date-effective branch authority, exact shared operational status, atomic audited
  review corrections, durable device lifecycle evidence, and exactly three reports.
- Added migration `20260714143000_attendance_fluid_operations.sql` and the 28-scenario
  contract in `docs/attendance/FLUID_OPERATIONS.md`.
- Passed cold TypeScript validation, ESLint, the full 123-file / 859-test suite,
  production Next.js 16.2.4 build (109 static pages generated), and `git diff --check`.
- The migration was not applied because linked migration history remains
  unreconciled and the standing project handoff forbids a blind broad push.
- Authenticated CRM/Staff Portal and physical-phone scan E2E remain pending.

---

# Previous Task - ATTENDANCE-SCAN-RESOLUTION-001

Status: COMPLETE LOCALLY — AUTHENTICATED DEVICE/ROLE QA PENDING
Started: 2026-07-14
Last updated: 2026-07-14

## Proven root causes

- The public scan boundary has structured safe error codes, but its generic catch path
  renders the shared `Attendance not confirmed` copy and places the operation id in
  the main detail text. There is no canonical staff/CRM resolution model carried by
  `PublicScanResult`.
- Recovery synthesizes incidents from static device inventory through
  `deviceRegistry.entries.map(issueForDeviceEntry)`. A normal `no_device` roster row
  becomes a high-priority `Staff has no connected phone` issue without any scan or
  support event.
- Recovery's `Mark as Reviewed` invokes `resolveAttendanceExceptionAction`, while
  non-exception cards are locally removed. Reviewed and resolved are therefore not
  distinct in the current implementation.

## Implementation scope

Add one typed scan-resolution classifier, carry it through public results, render
issue-specific safe guidance, make Recovery event-backed and deduplicated, separate
review acknowledgement from resolution, and reuse workspace notifications/tasks for
staff questions and technical escalation. Preserve the existing scan engine and
first-time registration continuation.

## Completion

- Focused migration applied and live RLS/grants verified.
- Type-check, lint, production build, full 121-file/848-test suite, and diff
  check pass.
- Remaining QA is limited to physical first-scan and authenticated CRM/Staff
  role walkthroughs plus migration-history reconciliation.

---

# Previous Task - ATTENDANCE-COMPLETE-SYSTEM-001

Status: PHASE 1 COMPLETE LOCALLY — AUTHENTICATED BROWSER QA PENDING
Started: 2026-07-14
Last updated: 2026-07-14

## Mission

Complete the existing Attendance platform phase by phase without replacing its
scan engine, schedule resolver, device registry, notification/task stores,
Recovery audit, or payroll system.

## Current phase

Phase 0 evidence is recorded in
`docs/attendance/PHASE_0_BASELINE_AND_ARCHITECTURE_MAP.md`. Phase 1's shared
model and consumer contract are recorded in
`docs/attendance/PHASE_1_AUTHORITATIVE_DAILY_MODEL.md`.

- Focused baseline: 24 files / 96 tests passed.
- Full repository type-check, lint, and production build passed for the current
  worktree.
- CRM Overview is proven to use a local incomplete interpretation and a
  first-36 roster slice.
- Staff Portal reads stored Attendance rows independently of a shared daily
  model.
- Reports, reconciliation automation, and several Recovery actions are proven
  incomplete.
- The previously pending staff self-service migration was applied through the
  linked Management API SQL path after PostgREST reported the request table was
  missing. The table, RLS, three policies, grants, RPC execution restrictions,
  schema-cache reload, and service-role REST access are verified live.
- `pnpm db:doctor` and `pnpm db:status` still time out reading linked migration
  history. The SQL effects are live, but version `20260714050554` must still be
  reconciled in migration history from a working migration connection.

## Gate

The focused device-request schema gate is cleared. Do not run a blind migration
push while migration history remains unreadable; reconcile the applied version
before a normal broad push.

## Phase 1 implementation

- Canonical schedule resolution remains `getResolvedStaffSchedulesForDate`.
- `day-model.ts` composes the daily operational state for the whole CRM/Owner
  roster and the signed-in Staff Portal member.
- Day off, later, expected soon/now, missing, conflict, complete, available,
  in-service, clocked-out, late-not-arrived, and review states are distinct.
- CRM's false Scheduled Today/Not Arrived derivation and 36-staff slice are gone.
- Focused Attendance: 25 files / 112 tests; full suite: 120 files / 835 tests.
- Type-check, lint, and production build pass.
- Authenticated CRM and Staff Portal browser QA remains pending.

---

# Previous Task - ATTENDANCE-STAFF-SELF-SERVICE-001

Status: COMPLETE LOCALLY — DEPLOYMENT/DEVICE QA BLOCKED
Started: 2026-07-14
Last updated: 2026-07-14

## Mission

Verify and repair the existing autonomous first-scan Attendance phone
registration flow, add a separate CRM-reviewed Staff Portal phone-registration
request flow using the existing device infrastructure, and add read-only staff
attendance summary/history surfaces without replacing the Attendance engine.

## Non-negotiable policy

- First-time Attendance QR registration is automatic after authenticated staff
  validation and resumes the same scan without CRM approval.
- Staff Portal phone registration requires CRM approval and activation on the
  same requesting phone.
- Both methods reuse `staff_devices`, the existing cookie/hash conventions,
  scan idempotency, schedule/attendance logic, notifications, and work queue.
- Staff attendance views are self-only and cannot mutate attendance.
- No broad Attendance workspace redesign, second attendance engine, or changes
  to booking, payroll, scheduling, recovery, or authentication behavior.

## Implementation order

1. Trace Method 1 from QR request through cookie-backed scan continuation.
2. Repair and independently verify any proven Method 1 gaps.
3. Reuse or add focused Method 2 persistence/RLS only where missing.
4. Add Staff Portal Attendance & Phone and CRM Devices review surfaces.
5. Add staff attendance summary/history and refresh wiring.
6. Run focused/full verification and update the task context.

## Completed behavior

- First-scan registration now uses a signed ten-minute continuation bound to
  the original QR and operation id, a stable temporary HttpOnly phone
  credential, retry-safe registration, operational-staff/branch/device-limit
  checks, and immediate attendance processing without a browser reload.
- Staff Portal phone registration now creates a same-phone hash-bound request;
  CRM can approve or reject it with the defined rejection taxonomy, approved
  requests expire after 24 hours, activation is single-use, and replacement
  revocation/device creation is transactional.
- Method 1 reconciles a related pending/approved Method 2 request and preserves
  replacement intent when the autonomous QR path succeeds first.
- CRM Devices includes the registration-review inbox; Staff Profile includes
  current-phone request/activation/rename/replacement controls and staff/CRM
  notification/work-task signaling.
- `/staff-portal/attendance` and the portal summary expose only the signed-in
  staff member's schedule, clock state, history, calculated attendance metrics,
  and friendly review status. The page has no attendance mutation controls and
  its Realtime filter is scoped to that staff id.

## Verification

- Focused Attendance/Staff Portal tests: 6 files / 14 tests passed.
- Full Vitest: 119 files / 819 tests passed.
- `pnpm type-check`, `pnpm lint`, and `pnpm build` passed; the production build
  includes `/staff-portal/attendance`.
- Supabase CLI/link/project identity passed. Remote migration history and schema
  application remain blocked because the linked pooler timed out repeatedly.
- The only in-app browser session redirected authenticated Staff Portal routes
  to `/login`; no safe signed-in staff/CRM session or physical phone was
  available for end-to-end certification.

---

# Previous Task - CRM-BOOKING-ACTIONS-COMPACT-001

Status: COMPLETE
Started: 2026-07-14
Last updated: 2026-07-14

## Mission

Remove the large booking follow-up modal from routine CRM booking actions, fix
the identifier/lookup defect that collapses valid action failures into `Booking
not found`, and reduce the CRM desktop booking list to Time, Customer, and
Status without horizontal scrolling.

## Completed behavior

- Confirm, Call, Message, No Answer, and Confirm Later now run directly from
  the selected-booking command center; the desktop modal stack no longer routes
  routine actions through Booking Follow-up.
- Reschedule still opens the existing reschedule modal. Cancel now opens a
  small reason-required dialog and reuses the existing status, audit,
  notification, permission, and refresh behavior.
- CRM action loading starts with the real `bookings.id` UUID and a base booking
  select. Related details load separately only where required, and missing,
  wrong-branch, RLS/permission, load, validation, final-state, and update errors
  no longer collapse into `Booking not found`.
- The desktop list is Time, Customer, and Status only, uses an approximately
  43/57 split, and has no horizontal table scrolling. Search, filters,
  pagination, selection, keyboard behavior, and refresh wiring are preserved.
- No mobile redesign, new lifecycle/status, dependency, table, migration, or
  RLS policy was introduced.

## Verification

- Focused booking tests: 6 files / 27 tests passed.
- Full Vitest: 114 files / 807 tests passed.
- `pnpm type-check`, `pnpm lint`, `pnpm build`, and `git diff --check` passed.
- In-app browser reached `http://localhost:3000/crm/bookings` but redirected to
  `/login`; the available browser has no authenticated CradleHub session, so
  live operator interaction QA remains blocked without altering the user's
  running dev server or authentication state.

---

# Previous Task - CRM-BOOKINGS-DESKTOP-REDESIGN-001

Status: COMPLETE
Started: 2026-07-14
Last updated: 2026-07-14

## Mission

Redesign only the desktop CRM Bookings workspace into the approved two-pane
booking list and selected-booking command center while preserving the existing
booking lifecycle, mutations, permissions, realtime behavior, assignment and
payment logic, countdown/auto-completion path, and all existing operational
modals.

## Completed behavior

- CRM desktop now uses the approved two-pane workspace with selected-date list,
  compact quick/exact filters, search, pagination, and legacy tab translation.
- The selected booking command pane keeps identity, status, service, summary,
  lifecycle action, quick actions, and tabs fixed while only tab content scrolls.
- Overview reuses existing assignment, payment, note, customer, warning, and
  modal/action paths; Activity derives only from loaded timestamps and metadata.
- The existing mobile workspace and shared manager/owner booking surfaces remain
  on the prior implementation.
- No booking lifecycle, server action, database, RLS, scheduling, payment, or
  permission contract was replaced.

## Verification

- Focused booking tests: 3 files / 9 tests passed.
- Full Vitest: 111 files / 789 tests passed.
- `pnpm type-check`, `pnpm lint`, `pnpm build`, and `git diff --check` passed.
- In-app browser reached the local server with no console warnings/errors, but
  `/crm/bookings` redirected to `/login`; authenticated visual/interaction QA
  remains blocked until a safe signed-in CRM session is available.

---

# Previous Task - ONLINE-STAFF-PREFERENCE-EXCEPTIONS-001

Status: COMPLETE
Started: 2026-07-13
Last updated: 2026-07-13

## Mission

Keep `Any available staff` as the explicit public-booking default and treat a
manually selected, active, branch-valid, service-qualified staff member as a
customer preference whose schedule incompatibility creates CRM review work
without changing the booking lifecycle status or silently reassigning staff.

## Completed behavior

- Public staff state initializes and resets to `DEFAULT_STAFF_PREFERENCE`
  (`auto`); recommendation badges remain display-only.
- Public preference options include every operational provider explicitly
  qualified for all selected services. Schedule-valid staff stay ranked first;
  other qualified staff remain selectable with neutral `Preference request`
  copy.
- Server validation first hard-blocks missing, inactive, archived/merged,
  wrong-branch, non-provider, unqualified, and malformed/tampered staff IDs.
- Schedule state, blocks/leave, booking overlap, shift coverage, and overrides
  are evaluated separately. A soft failure preserves `staff_id`, normal booking
  status/payment flow, and writes an open review record in booking metadata.
- Existing CRM notification and workflow-task stores receive deterministic,
  idempotent review signals. CRM Today, booking list/details, notifications,
  and work queue render amber review state.
- Keep selected staff and Mark resolved close the review directly. Existing
  reassignment and reschedule actions close it with actor/time/audit history;
  existing follow-up and schedule links provide Contact customer and Open staff
  schedule.
- No database migration, new status, or RLS change was required.

## Verification

- Focused: 7 files / 25 tests passed.
- Full: 108 files / 780 tests passed.
- `pnpm type-check`, `pnpm lint`, `pnpm build`, and `git diff --check` passed.
- Browser: public flow reached the therapist step with Any available pressed,
  a separate recommended staff badge, neutral off-schedule preferences, and a
  retained manual preference. No booking was submitted against live data.
- Authenticated CRM click-through QA was blocked by the local redirect to
  `/login`; action/component contracts remain covered by static and focused
  tests.

---

# Current Task - CRADLE-ATTENDANCE-DB-CONNECTION-AND-END-TO-END-DIAGNOSTICS-011

Status: REVIEW
Started: 2026-07-13
Last updated: 2026-07-13

## Mission

Establish the exact Supabase database target used by the local application,
compare migration history with the live Attendance schema and RPC contract,
trace one controlled database-backed Attendance scan with a single operation
ID, prove the exact failing stage and resulting database writes, and implement
only evidence-backed corrections while preserving RLS, device security, raw
scan history, and atomic attendance semantics.

## Guardrails

- Work only inside `E:\cradlehub`; do not use Vercel or deploy.
- Do not print secrets, QR credentials, tokens, cookies, access keys, or
  service-role credentials.
- Do not run a blind migration push while migration history and live schema may
  differ.
- Do not invent scan records or claim completion without a database-backed
  controlled scan attempt.

## Database-backed outcome

- Local app, linked CLI configuration, MCP config, and database scripts all
  target Supabase project `lsrbwqhvzjfpiabeolkv`.
- Linked Management SQL and service-role REST are healthy. The direct
  migration-history/pooler path still times out on TCP 5432; this is not DNS,
  authentication, project identity, or schema reachability.
- The deployed `commit_attendance_scan_transaction` signature matches generated
  types and the typed scan-engine call, is security-invoker, has a fixed safe
  search path, and is executable only by `service_role` (plus owner).
- Controlled failed attempt `998ba4f6-9499-4c76-960b-5543d67cdd6e` reached the
  route, resolved the live QR and branch, returned `unknown_device`, wrote one
  blocked scan event plus one open exception, and wrote no check-in.
- Recovery first failed with SQLSTATE `42702` because the RPC's unqualified
  `staff_id` conflicted with its `RETURNS TABLE` field. Replacement recovery
  then failed with `23505` because the old primary device was revoked after the
  replacement insert. Both are repaired transactionally in the new migration.
- Configured-secret recovery then succeeded, set the HTTP-only device cookie,
  and the next scan recognized the QA phone.
- Controlled clock-in `971879ba-a130-4df2-991c-6b5030b59ea3` wrote exactly one
  scan row and one check-in with weekly schedule source, source row ID,
  shift-instance key, `Asia/Manila`, and business date `2026-07-13`.
- Immediate rescan returned the intended duplicate no-op. Clock-out first failed
  before mutation with PostgREST `PGRST201` because three booking queries used
  an ambiguous `branch_resources` embed. Pinning
  `bookings_resource_id_fkey` repaired it.
- Controlled clock-out `fbf2bebf-2a20-4c0a-b6b0-7e25218b86e4` updated the same
  check-in, wrote one success scan event, and atomically created one valid
  `early_leave` exception. The temporary QA schedule was restored and the QA
  device was revoked after the test.
- Attendance Activity now reads all non-test attendance outcomes (success,
  blocked, exception, noop, error), retains staff-less attempts, uses the
  branch-configured timezone for date boundaries, and refreshes for every
  attendance insert. A live Realtime subscriber received the controlled
  `duplicate_scan` insert without a page reload.

## Corrective migration

- `20260713120237_attendance_recovery_rpc_and_scan_realtime_repair.sql`
  qualifies recovery RPC columns, revokes a selected primary before inserting
  its replacement, preserves service-role-only execute, and idempotently adds
  `qr_scan_events` to `supabase_realtime`.
- Applied through linked Management SQL and recorded as applied in
  `supabase_migrations.schema_migrations`. No old deployed migration was edited.

## Verification

- `pnpm db:doctor`: linked config/type generation pass; pooler history read
  warns on TCP 5432 timeout.
- `pnpm db:status`: fails only at the same pooler migration-history connection.
- `pnpm db:verify`: all real required tables pass; exit 2 only because `psql`
  is not installed.
- `pnpm db:types`, `pnpm type-check`, `pnpm lint`, `pnpm test --run`,
  `pnpm build`, and `git diff --check`: pass.
- Full Vitest result: 101 files and 755 tests passed.

## Remaining operational follow-up

- Migration history still has broad pre-existing drift: many local Attendance
  migrations have live schema effects but no history row, so do not run a blind
  `db push` until the direct pooler path is restored and history is reconciled.
- During this diagnostic window, pre-existing Attendance operational rows were
  removed by two external `DELETE` executions. `pg_stat_statements` reports 281
  deleted scan rows, 192 exceptions, 23 check-ins, and 24 devices. No command or
  code path used by this task issued those deletes, and no reset backup exists
  in this checkout. The deletion actor/timestamp cannot be recovered from
  `pg_stat_statements`; investigate the separate reset operator/process and its
  backup location before relying on historical Attendance reporting.

---

# Current Task - CRADLE-ATTENDANCE-PRODUCTION-SECRET-AND-SCAN-RECOVERY-010

Status: REVIEW
Started: 2026-07-13
Last updated: 2026-07-13

## Mission

Fix the local Attendance QR scan failure that currently renders generic "Scan
interrupted" copy. The work is now explicitly local-only: trace the local QR
scan path through `/api/attendance/public-scan`, device lookup, schedule
resolution, intent selection, shift-instance creation, transaction RPC, scan
event/check-in writes, and result UI until the exact local failure stage is
known and fixed.

## Guardrails

- Work only inside `E:\cradlehub`.
- Do not access Vercel, inspect Vercel logs, deploy, or modify production
  environment/configuration.
- Do not weaken device security, RLS, branch validation, recovery-token policy,
  or atomic attendance writes.
- Do not expose secrets, cookies, QR codes, device tokens, Supabase access
  tokens, or service-role credentials in logs, reports, or tests.
- Keep `UNKNOWN_ATTENDANCE_ERROR` only as the final unexpected fallback; known
  local failure stages must map to structured safe codes.
- Production must still fail closed when `ATTENDANCE_DEVICE_SECRET` is missing;
  local development may use only the existing explicit local-only fallback.

## Local Repair Notes

- Local generic failure paths found and repaired:
  - missing production `ATTENDANCE_DEVICE_SECRET` now maps to
    `ATTENDANCE_CONFIGURATION_MISSING`;
  - `attendance_settings` read/insert and fallback branch lookup errors now
    throw structured Attendance scan errors instead of becoming empty settings
    state or plain `Error`;
  - activation-token lookup/update failures now throw structured safe errors
    instead of collapsing into invalid-link or unchecked update behavior;
  - device recovery RPC failures now classify as `ATTENDANCE_RPC_*`,
    `ATTENDANCE_RLS_DENIED`, `ATTENDANCE_CONSTRAINT_FAILED`, or
    `ATTENDANCE_TRANSACTION_FAILED` instead of `UNKNOWN_ATTENDANCE_ERROR`.
- Verified locally with `pnpm type-check`, `pnpm lint`, `pnpm test --run`,
  `pnpm build`, focused Attendance tests, and `git diff --check`.
- Local Supabase/Docker is unavailable in this environment, so DB-backed QR scan
  simulation and local type generation from the running local database remain
  blocked until Docker/local Supabase is available.

---

# Current Task - CRADLE-ATTENDANCE-DIAGNOSTICS-AND-SCAN-REPAIR-009

Status: REVIEW
Started: 2026-07-13
Last updated: 2026-07-13

## Mission

Repair the complete public Attendance QR scan pipeline so real phone scans do
not collapse into the generic "Scan Interrupted" screen. The pipeline must keep
Attendance security intact, use individual schedules as the only schedule truth,
commit interpreted scan effects atomically through the Attendance transaction
RPC, preserve precise safe error codes, and refresh Attendance/Daily Timeline
presence without redesigning the QR page, Attendance workspace, or Daily
Timeline.

## Internal Diagnostic Matrix

| Stage | Expected result | Actual result | Code path | Database object | Safe error code | Correction | Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| QR route request | Public route returns typed scan result or setup state | Catch-all returned HTTP 200 generic `server_action_error` | `src/app/api/attendance/public-scan/route.ts` | n/a | `ATTENDANCE_*`, `SCHEDULE_*`, etc. | Structured safe errors, operation ID, non-200 for backend failures | `tests/app/attendance/public-scan-route.test.ts` |
| Public scan action/page | Phone UI renders structured known code | Non-OK responses were thrown away and replaced with generic client error | `src/app/scan/actions.ts`, public scan processor | n/a | `UNKNOWN_ATTENDANCE_ERROR` fallback only for invalid/unparseable response | Parse valid non-OK JSON; server actions return structured safe result | Route test + build |
| Device resolver | Active registered phone resolves staff/branch or setup state | Query errors could look like missing device/QR | `src/lib/attendance/scan-engine.ts` | `staff_devices`, `staff`, `branches`, `qr_points` | `ATTENDANCE_TRANSACTION_FAILED`, `ATTENDANCE_WRITE_FAILED` | Throw structured DB/query errors; keep expected missing-device result | `npx tsc --noEmit`, build |
| Schedule resolver | Individual schedule state handled deliberately | Override query lacked `ends_next_day`; conflict states could still select a window | `resolved-staff-schedules`, intent engine | `staff_schedules`, `schedule_overrides` | `SCHEDULE_SCHEMA_MISMATCH`, `SCHEDULE_QUERY_FAILED`, `SCHEDULE_STATE_UNSUPPORTED` | Added override `ends_next_day`, explicit conflict/non-operational Recovery intent | attendance intent tests |
| Intent engine | Current window selects clock-in/out/duplicate/recovery | Shift instance missed source row id/window order; overnight inferred only from time comparison | `attendance-intent-engine.ts`, `shift-instance.ts` | `staff_shift_checkins`, `attendance_settings` | `DUPLICATE_SCAN`, `SHIFT_INSTANCE_CONFLICT` | Source values `weekly/override/recovery/none`; split key includes window order/id; overnight uses authoritative flag | `shift-instance.test.ts` |
| Transaction RPC | Atomic write returns preserved success/reject code | RPC errors thrown as generic Error and hidden by route/action catch | `src/lib/attendance/db.ts`, scan engine | `commit_attendance_scan_transaction` | `ATTENDANCE_RPC_*`, `ATTENDANCE_CONSTRAINT_FAILED`, `ATTENDANCE_RLS_DENIED` | Generated DB client restored; RPC wrapper classifies db/RPC failures and preserves rejection code | route test; live invalid-request probe |
| Exception compatibility | Internal exception codes fit DB constraint or mapping | Internal codes such as `missing_schedule`, `ambiguous_scan`, `overtime_clock_out` did not match stable DB CHECK values | scan engine/db/RPC | `attendance_exceptions.exception_type` | `ATTENDANCE_CONSTRAINT_FAILED` before fix | Map internal -> stable DB values; store internal code in metadata for Recovery UI | `exception-codes.test.ts` |
| Query errors | DB query failures are not treated as empty results | Several helpers ignored `error` and returned null/empty | attendance DB helpers | multiple | `ATTENDANCE_TRANSACTION_FAILED`, `ATTENDANCE_WRITE_FAILED` | Lookup/write helpers throw structured safe errors on Supabase failures | type-check/build |
| Realtime/cache | Attendance and Daily Timeline refresh from committed changes | Cache refresh path preserved | route/actions | `qr_scan_events`, `staff_shift_checkins`, `attendance_exceptions` | n/a | Revalidation still fires on scan event/attendance/countdown/device restore | build |

## Guardrails

- Do not weaken Attendance security, RLS, device trust, or branch checks.
- Do not expose service-role credentials or raw SQL/stack traces to the phone.
- Do not reintroduce group schedule fallback or schedule-from-attendance
  behavior.
- Do not bypass `commit_attendance_scan_transaction` for interpreted
  clock-in/out/recovery commits.
- Do not redesign the QR scan screen, Attendance workspace, or Daily Timeline.

## Completion Notes

- Live linked schema confirmed `commit_attendance_scan_transaction` exists,
  RLS remains enabled on attendance/schedule tables, service-role execute is
  the only RPC app grant, and `attendance_exceptions.exception_type` still uses
  stable DB CHECK values.
- Root cause was not one single frontend issue: backend errors were swallowed,
  while internal Recovery exception codes did not match the stable DB exception
  constraint. The public route then converted the failure into generic Scan
  Interrupted.
- Added and live-applied
  `supabase/migrations/20260713082146_attendance_scan_contract_repair.sql`
  through linked SQL because `db push` still times out on the direct pooler.
- Live verification after apply: `schedule_overrides.ends_next_day` exists;
  `staff_shift_checkins.schedule_source` allows `weekly`, `override`,
  `recovery`, `none`; existing `weekly_schedule` rows are migrated to `weekly`;
  migration record `20260713082146` exists.
- Safe no-mutation RPC probe returned `success=false`, `code=invalid_request`,
  preserving the rejection code.
- Verification passed: `npx tsc --noEmit`, focused attendance tests
  (5 files / 28 tests), and `pnpm build`.
- Remaining caveat: I did not certify a physical phone scan in this turn. A
  real device scan should now show a precise safe code/result or commit
  attendance, but final operator QA still needs a live phone/browser session.

---

# Current Task - CRADLE-SCHEDULE-LEFTOVER-CLEANUP-008

Status: REVIEW
Started: 2026-07-13
Last updated: 2026-07-13

## Mission

Clean up leftover legacy schedule-health behavior after the individual recurring
schedule unification. Runtime warnings must come only from the authoritative
individual schedule/resource/coverage contracts:
`staff_schedules`, `schedule_overrides`, `blocked_times`, and
`staff_shift_checkins` for schedule truth, plus existing booking/service/resource
configuration for room/resource requirements.

## Internal Audit Matrix

| Visible warning | Source generator | Data queried | Resolver state | Actual root cause | Correction | Tests |
| --- | --- | --- | --- | --- | --- | --- |
| Dante Depaloma "Conflicting staff schedule" / Time: All day | `buildLiveScheduleConflicts` schedule-state mapper and conflict card time fallback | `staff_schedules` for staff `a384447d-5e71-4ee2-809b-d91ef4cfe44b`; Mon-Sat active `single` windows `02:00-22:00` | `INVALID_TIME_WINDOW` | Real invalid 20-hour individual windows, previously collapsed to generic `schedule_rule_conflict` and `All day` | Emit `schedule_invalid_time_window` with `INVALID_TIME_WINDOW`, exact `02:00:00-22:00:00`, source row ids, and stable fingerprint; fallback label is `Time not set`, not `All day` | `tests/lib/schedule/live-schedule-conflicts.test.ts` |
| Angels Massage "Missing room assignment" | Schedule/Today/Spaces missing-resource checks | Booking `1ea3ce31-6ead-49e0-9ff4-43501d5cf20d`; service `Angels Massage`; `service_metadata={}`, `requires_special_setup=false`, `resource_id=null`, `delivery_type=in_spa` | n/a | Broad `!resource_id && in_spa` rule treated ordinary unassigned resource as missing room even without explicit service/resource requirement | Missing room/resource warning now requires service metadata such as `requires_room` or `required_resource_type`; Manager Today selects service metadata too | `tests/lib/schedule/daily-timeline-operations.test.ts`, `tests/lib/schedule/live-schedule-conflicts.test.ts`, `tests/components/manager-today/manager-today-utils.test.ts` |
| Coverage gap "Only 27 staff are scheduled today. Minimum required is 29." | `buildCoverageGapConflict` using roster count vs `scheduling_rules.min_daily_staff` | Main Spa `scheduling_rules`: `min_daily_staff=29`, `min_daily_therapists=29`, `min_daily_csr=4`, `min_daily_drivers=3`, `min_daily_utility=2` before cleanup | n/a | Corrupted roster-total minima were used as a live gap rule without time window/category contract | Backed up and restored Main Spa minima to defaults `1/1/1/0/0`; code now requires explicit `coverageRequirement` with category/time/minimum before emitting coverage gap | `tests/lib/schedule/live-schedule-conflicts.test.ts` |

## Guardrails

- Preserve the Daily Timeline and Adjust Schedule modal designs.
- Do not revive group schedule fallback, duty assignments, imported paper
  schedules, seeded defaults, attendance history, or booking history as runtime
  staff schedule truth.
- Do not hide warnings blindly. Trace every visible warning to its exact
  generator, queried data, issue code/fingerprint, and stale-invalidation path.
- If data normalization is required, back up original rows first, preserve
  legitimate regular windows, and leave ambiguous cases for CRM review.

## Planned Verification

- Pre-flight repository/context/Next/Supabase review.
- Live schema and live data probes for the three warnings, or exact blocker.
- Focused unit tests for schedule issue mapping, resource requirement warnings,
  coverage warning gating, fingerprints, and dedupe.
- `npx tsc --noEmit`
- Focused `vitest` schedule tests.
- Broader `pnpm test`, `pnpm lint`, and `pnpm build` as time permits.

## Completion Notes

- Live data confirmed Dante/Boy still has real invalid individual schedule
  windows (`02:00-22:00`, 20 hours) and should remain a CRM review item with
  exact resolver state, not a generic conflict.
- Live data confirmed the Angels Massage booking has no explicit room/resource
  requirement, so missing-room warnings were false positives.
- Live data confirmed the 29-staff coverage warning came from corrupted Main
  Spa `scheduling_rules` minima, not a defined coverage rule.
- Added and live-applied
  `supabase/migrations/20260713090000_schedule_leftover_cleanup.sql`.
  Original affected rows were backed up in `schedule_repair_backups`.
- The cleanup restored Main Spa scheduling rule minima to defaults and removed
  7 deterministic stale active `single` windows after backup. Ambiguous
  overlapping Opening/Closing rows remain for CRM review.
- Schedule conflicts now carry exact schedule issue types/codes, source ids,
  and fingerprints. Missing resource warnings require explicit service metadata.
  Coverage gaps require an explicit `coverageRequirement`.
- Verification passed: `npx tsc --noEmit`, focused schedule/manager tests
  (5 files / 24 tests), `pnpm test --run` (95 files / 735 tests),
  `pnpm lint`, and `pnpm build`.
- Remaining caveat: linked Supabase migration-history reads still time out from
  this environment. Live effects are verified through linked SQL probes, but
  migration history still needs reconciliation from a working direct DB path.

---

# Current Task - CRADLE-SCHEDULE-SYSTEM-UNIFICATION-007

Status: REVIEW
Started: 2026-07-13
Last updated: 2026-07-13

## Mission

Complete the transition to one CRM-controlled individual scheduling system.
`staff_schedules`, `schedule_overrides`, and `blocked_times` are the runtime
schedule truth. Group schedule tables, duty assignments, paper imports,
attendance history, booking history, and seeded defaults must not generate
effective staff schedules.

## Authoritative Contract

- CRM configures recurring individual weekly windows once; the pattern repeats
  weekly until changed.
- UI shift kinds are `regular | opening | closing`; database values are
  `single | opening | closing`, with `regular <-> single` mapped only at the
  persistence boundary.
- Opening/Closing are allowed only for therapists and CRM/front-desk staff.
- Zero weekly rows means `NO_SCHEDULE_CONFIGURED`; an inactive weekly day marker
  means `CONFIGURED_DAY_OFF`.
- Date overrides replace weekly windows for that date.
- Blocked time subtracts booking availability and does not rewrite attendance
  shift boundaries.
- Daily Timeline must keep its existing layout while starting from the
  operational branch roster and rendering schedule, presence, occupancy, and
  availability separately.

## Internal Implementation Matrix

| System | Current schedule source to verify | Current defect risk | Target shared contract | Files changed | Tests required |
| --- | --- | --- | --- | --- | --- |
| Schedule Setup | Existing staff schedule editor/action | Separate DTO/save semantics from Adjust Schedule | Shared canonical draft/DTO and atomic weekly save | TBD | Shared DTO/save tests |
| Adjust Schedule | `schedule-adjustment` modal and weekly action | UI/server mappings may duplicate shift logic | Shared canonical adapter and save action | TBD | Modal DTO/action tests |
| Effective resolver | `src/lib/schedule/resolve-staff-schedule.ts` | States may not match required codes exactly | One explicit resolver result with exact windows/issues | TBD | State/split/overnight/conflict tests |
| Daily Timeline | Daily schedule queries/API/SWR | May rely on legacy RPC or conflate empty windows with day off | Operational roster + shared resolver row adapter | TBD | Timeline row/render tests |
| Attendance | `attendance-intent-engine` / `shift-instance` | Needs exact resolved window/source id for split/overnight | Effective resolver selects window and stores source snapshot | TBD | Scan/shift-instance tests |
| Public booking | availability engine / slot APIs | Old RPC may miss split/overnight/overrides | Shared availability service over effective windows | TBD | Slot generation tests |
| CRM booking | CRM availability route/actions | May independently interpret schedules | Same availability service with richer diagnostics | TBD | CRM availability tests |
| Dispatch | recommendation engine/query context | May read raw `staff_schedules` directly | Effective resolver eligibility with attendance only ranking | TBD | Recommendation tests |
| Today / readiness | CRM readiness queries | Direct schedule assumptions | Resolver states and operational staff filter | TBD | Readiness tests |
| Health / coverage | live conflicts and coverage cards | No schedule/day off may be reported as conflicts | Explicit issue codes, window-based coverage | TBD | Health/coverage tests |
| Staff portal | staff schedule view | One-row-per-weekday assumptions | Grouped day windows incl split/overnight/day off/no schedule | TBD | Portal render tests |
| Cache / Realtime | schedule refresh helpers/subscriptions | Duplicate subscriptions or partial invalidation | Central schedule invalidation contract | TBD | Helper/subscription tests |

## Planned Verification

- Pre-flight repository/doc/context review.
- Live linked database contract probes or exact blocker.
- RLS/grant/RPC/constraint/index inspection or exact blocker.
- Focused schedule domain/adapter/resolver/save/consumer tests.
- `pnpm db:types`
- `pnpm type-check`
- `pnpm lint`
- `pnpm test --run`
- `pnpm build`
- `git diff --check`

## Completion Notes

- Added shared shift adapter `src/lib/schedule/schedule-domain.ts`; UI uses
  `regular | opening | closing`, DB writes keep `single | opening | closing`,
  and active UI paths no longer display `single`.
- Resolver now exposes required non-operational state
  `STAFF_NOT_OPERATIONAL` and batch resolution carries override ids and
  operational flags.
- Daily Timeline no longer starts from the old `get_daily_schedule` RPC. It
  starts from the operational branch roster, resolves schedules through the
  shared resolver, joins bookings/blocks/overrides/check-ins, and keeps
  `NO_SCHEDULE_CONFIGURED`, `CONFIGURED_DAY_OFF`, and conflict/needs-review
  rows distinct.
- Daily Timeline layout was preserved while adding explicit Opening/Regular/
  Closing colors, split-window filtering, overnight rendering, attendance
  presence labels, and Not Configured / Day Off / Needs Review display states.
- Schedule Setup now imports the same weekly draft/editor/save path used by
  Adjust Schedule via
  `src/components/features/staff-schedule/individual-schedule-window-editor.tsx`.
- Staff portal week planning now groups same-day schedule rows and resolves
  them through the shared resolver, so split shifts no longer collapse to the
  last row.
- Live conflict generation no longer emits `missing_schedule`; missing schedule
  remains a schedule state, not a conflict.
- Added realtime subscription for `staff_shift_checkins` and migration
  `20260713064332_schedule_realtime_publication.sql`.
- Applied the realtime publication repair live with
  `supabase db query --linked --dns-resolver https --file ...`; verification
  query confirmed `staff`, `staff_schedules`, `schedule_overrides`,
  `blocked_times`, `staff_shift_checkins`, `bookings`, and `branch_resources`
  are in `supabase_realtime`.
- Verification passed: focused schedule/staff-portal tests (8 files / 41 tests),
  `npx tsc --noEmit`, `pnpm test` (94 files / 731 tests), `pnpm lint`,
  `pnpm build` (Next.js 16.2.4, 108 routes), and `git diff --check` with CRLF
  warnings only.
- Remaining caveat: linked Supabase migration-history reads were already
  failing through the direct pooler path; live schema effects are verified, but
  migration-history reconciliation is still not certified from this environment.

---

# Current Task - CRADLE-SCHEDULE-UPDATE-INTEGRATION-REPAIR-006

Status: REVIEW
Started: 2026-07-13
Last updated: 2026-07-13

## Mission

Fix the root cause of CRM staff schedule updates returning the generic
"We could not update this schedule. Please try again." failure after the
individual-schedule simplification and Adjust Schedule modal work.

The repair must keep individual `staff_schedules` authoritative, preserve the
Daily Timeline UI, avoid group schedule fallback, and align Adjust Schedule,
Schedule Setup, the effective resolver, Attendance, Dispatch, online booking,
CRM booking, Today/Work Queue, health, coverage, and staff portal around the
same ordered-window contract.

## Reproduction / Audit Checklist

| Area | What to verify | Evidence target |
| --- | --- | --- |
| Save path | Adjust Schedule modal payload, server action, normalization, RPC call, result handling | Action name, sanitized payload shape, operation id, structured code |
| Live schema | `staff_schedules.window_order`, `ends_next_day`, unique constraint, trigger/RPC definitions, grants/RLS | Catalog query results |
| Migration state | Local migrations vs linked migration history vs live catalog | `pnpm db:status`, migration list/query evidence |
| Conflict target | No active save path uses `staff_id,day_of_week,shift_type` for staff windows | `rg` output and patches |
| Payload mapping | UI `regular` maps to DB `single`; ordered windows include explicit overnight | Utility/action tests |
| Authorization | CRM/owner branch checks, operational-staff filter, no Auth/device/attendance requirement for target | Server action tests |
| Error handling | Known failure modes become structured safe codes/messages; unknown remains fallback only | Action return tests and UI handling |
| Consumers | Resolver/Attendance/booking/dispatch/Timeline/health consume same schedule semantics | Focused integration tests |

## Planned Verification

- Live schema/migration-history verification or exact blocker.
- Focused schedule action/RPC/payload/error tests.
- Resolver/Attendance/booking/dispatch/Timeline focused tests where changed.
- `pnpm db:types`
- `pnpm type-check`
- `pnpm lint`
- `pnpm test --run`
- `pnpm build`
- `git diff --check`

## Completion Notes

- Root cause reproduced against the linked database: the app called
  `public.replace_staff_weekly_schedule(uuid, uuid, jsonb)`, but the live
  schema had no RPC and still had the old
  `staff_schedules_staff_day_shift_unique` constraint.
- Added and applied corrective migration
  `supabase/migrations/20260713035024_schedule_update_integration_repair.sql`
  through `supabase db query --linked --file` because the normal migration
  history/pooler path still times out.
- Live schema now has `staff_schedules_staff_day_window_unique`, no old shift
  unique constraint, `window_order` check `1..12`,
  `validate_staff_schedule_window_trigger`, operational helper functions, and
  the `replace_staff_weekly_schedule` RPC visible through PostgREST.
- Live data cleanup backed up stale inactive placeholders, removed inactive
  sibling rows where active windows exist, normalized inactive-only days to one
  day-off marker, and verified zero duplicate staff/day/window keys.
- Adjust Schedule, Schedule Setup, and legacy manager single-day write paths now
  use the ordered-window RPC contract and structured schedule save errors.
- Resolver/booking availability/recommendation/readiness selectors now carry
  `window_order` and `ends_next_day` where needed.

## Verification Results

- Focused tests: `npx vitest run tests/lib/actions/schedule-mutation-errors.test.ts tests/lib/schedule/staff-schedule-write.test.ts tests/lib/schedule/adjust-schedule-dialog.test.tsx tests/lib/schedule/adjust-schedule-utils.test.ts tests/lib/schedule/resolve-staff-schedule.test.ts` PASS, 5 files / 38 tests.
- `pnpm db:types`: PASS after live corrective migration; generated types now include `replace_staff_weekly_schedule`.
- `npx tsc --noEmit`: PASS.
- Live schema probes: PASS for RPC/function catalog, unique/check constraints,
  trigger, active index, zero duplicate staff/day/window keys, zero invalid
  inactive placeholders.
- PostgREST RPC probe: PASS; fake-ID call returns business validation
  `23514`, not function-not-found.
- Rollbacked live RPC round-trip: PASS; `BEGIN; ... replace_staff_weekly_schedule(...); ROLLBACK;` returned 7 rows and committed no schedule changes.
- `pnpm build`: PASS, Next.js 16.2.4, 108 routes.
- `pnpm db:push --dry-run` and `pnpm db:status`: BLOCKED by direct Postgres
  pooler timeout to `aws-1-ap-northeast-1.pooler.supabase.com:5432`, including
  escalated retries. Live schema was repaired through the supported Management
  API query path, but migration history remains uncertified.

---

# Current Task - CRADLE-ADJUST-SCHEDULE-MODAL-003

Status: REVIEW
Started: 2026-07-13
Last updated: 2026-07-13

## Mission

Build the production Adjust Schedule modal for CRM Schedule Daily Timeline
without redesigning the Daily Timeline or reviving group schedule runtime
behavior. Quick Actions > Adjust Staff and the selected-staff card's Adjust
Schedule action must open the same reusable modal, data contract, save path,
validation, and refresh behavior.

## Internal Audit Matrix

| Requirement | Current implementation | Files involved | Safe change | Tests required |
| --- | --- | --- | --- | --- |
| Shared Adjust Schedule entry point | Daily Timeline currently opens the existing availability editor; selected card actions need inspection | `src/components/features/schedule/tabs/*`, CRM schedule modal components | Lift one modal target/state contract and reuse it from Quick Actions and selected-staff card | Component tests for both entry points |
| Individual schedules authoritative | Current resolver/save path is individual-only after simplification | `src/lib/schedule/*`, `src/app/(dashboard)/crm/staff-availability/actions.ts` | Reuse existing weekly save action/adapters; do not add group fallback/actions | Utility/server action coverage |
| Reference modal layout | Existing editor likely uses older availability modal tabs | `src/components/features/crm/schedule/*`, new `schedule-adjustment` folder | Build reusable dialog with sticky header/footer, left nav, matrix, preview rail, mobile stacking | Modal render/interaction tests |
| Role-aware shifts | Shift eligibility helper exists from prior task | `src/lib/schedule/shift-eligibility.ts`, staff schedule UI | Use helper/adapters so non-therapist/non-CRM see Regular only | Role eligibility utility and UI tests |
| Split/overnight/no-schedule states | Current resolver/write path supports ordered windows and day-off markers | `src/lib/schedule/staff-schedule-write.ts`, editor utils | Preserve ordered windows, explicit `ends_next_day`, and unconfigured vs day off | Duration/overlap/day-off tests |
| Overrides/blocked time/exceptions | Existing actions/components need audit | `src/lib/actions/*schedule*`, CRM schedule editor files | Reuse real override/block actions where available; show honest empty state for exceptions | Focused editor/action tests where changed |
| Booking impact protection | Existing live conflict/availability helpers exist but need audit | `src/lib/schedule/*`, `src/components/features/schedule/tabs/*` | Surface real available analysis; do not fake counts | Server/utility tests if action changes |
| Daily Timeline preservation | Daily Timeline UI must stay visually unchanged | `daily-timeline-tab.tsx`, selection/actions cards | Change only action wiring/modal mount and refresh token behavior | Existing Daily Timeline tests plus focused open/refresh test |

## Planned Verification

- Focused utility tests for shift mapping, duration, overlap, day-off, and role eligibility.
- Focused modal/entry-point tests for Quick Actions and selected-staff card.
- `pnpm type-check`
- `pnpm lint`
- `pnpm test --run`
- `pnpm build`
- `git diff --check`

## Completion Notes

- Built the reusable `schedule-adjustment` modal with sticky header/footer, staff identity strip, left adjustment navigation, weekly matrix, right status/preview/impact rail, mobile weekday cards, and honest approved-exceptions empty state.
- Replaced CRM Schedule Daily Timeline Quick Actions > Adjust Staff with the new modal in Weekly Schedule mode.
- Added Adjust Schedule to the selected-staff card beside Edit Profile, Edit Capabilities, and View Full Schedule; it uses the same modal target/state/save/refresh path.
- Kept individual `staff_schedules` authoritative and intentionally excluded group labels/actions, Copy From Group, Reset to Group, View Group, and runtime fallback behavior.
- Added role-aware shift controls: therapists and CRM/front-desk can use Opening/Regular/Closing; other staff see Regular only, with server-side validation still authoritative.
- Added split-window and explicit overnight draft handling, day-off vs not-configured preservation, preview recalculation, validation gating, and acknowledged impact review before weekly save.
- Reused existing `schedule_overrides` and `blocked_times` actions in the Date and Unavailable modes. Date range/multiple-reason expansion remains limited by the current persistence model.
- Added ordered-window weekly save action and write-helper validation using the existing `replace_staff_weekly_schedule` RPC contract. Existing booking records are not changed by schedule saves; full server-calculated affected-booking acknowledgement remains a future hardening item.

## Verification Results

- Focused tests: `pnpm test --run tests/lib/schedule/adjust-schedule-utils.test.ts tests/lib/schedule/staff-schedule-write.test.ts tests/lib/schedule/daily-timeline-selection-card.test.tsx tests/lib/schedule/adjust-schedule-dialog.test.tsx` PASS, 4 files / 21 tests.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm test --run`: PASS, 91 files / 717 tests.
- `pnpm build`: PASS, Next.js 16.2.4, 108 routes.
- `git diff --check`: PASS with existing LF/CRLF normalization warnings only.
- Authenticated browser certification was not performed in this session.

---

# Current Task - CRADLE-INDIVIDUAL-SCHEDULING-SIMPLIFICATION-005

Status: REVIEW
Started: 2026-07-13
Last updated: 2026-07-13

## Mission

Simplify and stabilize CradleHub scheduling around one CRM-controlled
individual staff schedule truth.

CRM explicitly configures each staff member's weekly work windows, recurring
day-off markers, date-specific overrides, and blocked times. All downstream
modules must consume the same effective schedule resolver instead of predicting
availability from staff type, role, branch, group rules, paper rosters,
attendance, booking history, or seeded defaults.

## Authoritative Contract

- `staff_schedules` is the recurring individual weekly source of truth.
- Active rows are real work windows; split shifts are ordered active windows.
- One inactive row may mark a configured recurring day off; zero rows means
  `NO_SCHEDULE_CONFIGURED`.
- `single` remains the stored Regular shift value where that is the existing
  stable database contract.
- Opening and Closing are real work-window shift types allowed only for
  therapists (`staff.staff_type = 'therapist'`) and CRM/front-desk staff
  according to the project role helper / `staff.system_role = 'crm'`.
- Salon hierarchy, title, tier, head status, and seniority do not affect
  scheduling priority or shift eligibility.
- Group schedule tables are dormant historical template data only. They must
  not become runtime effective staff schedules.
- Paper schedule import and name-matching schedule generation must be removed.
- Daily Timeline UI must remain visually and behaviorally unchanged; only its
  backend adapter may change if needed.
- Schedule workspace should reduce to Daily Timeline and Schedule Setup.

## Internal Audit Matrix

| Current behavior | Root cause | DB object | Affected files | Correction | Test |
| --- | --- | --- | --- | --- | --- |
| Importer/name matching can infer weekly rows and Closing classifications | Paper roster workflow encodes non-authoritative assumptions | `staff_schedules` | Import actions/routes/components/constants | Remove importer and all paper roster/name matching paths | Importer reference search/test |
| Saves may create placeholder rows instead of exact CRM-entered windows | Old identity is shift type per day, not ordered work window | `staff_schedules` | Schedule save actions/RPC/write helpers | Replace staff weekly pattern atomically with actual windows plus minimal day-off markers | Row count, exact-return, overlap tests |
| New staff can appear available or conflicting without CRM setup | Missing schedule conflated with fallback/default/conflict | `staff_schedules`, group tables | Resolver and downstream consumers | Return `NO_SCHEDULE_CONFIGURED` and exclude from availability/recommendations without conflict label | No-schedule tests |
| Opening/Closing can leak to salon/driver/utility/managerial roles | Eligibility checks are duplicated or role/tier-derived | `staff`, schedules | Resolver/save helpers/RPC/migration | Centralize shift eligibility in TS and SQL | Role eligibility tests |
| Group rules silently influence runtime availability | Runtime fallback treats group templates as effective staff schedules | `staff_group_schedule_rules` | Resolver, realtime, recommendations | Remove group fallback from effective resolver and runtime subscriptions | No source/runtime group references |
| Split/overnight/conflict output can lose exact window evidence | Resolver normalizes to empty availability too early | `staff_schedules`, `schedule_overrides` | Resolver/adapters/health | Preserve exact affected windows and states while exposing no operational slots for invalid schedules | Split/overnight/conflict tests |
| Coverage and health can use roster totals or duplicated schedule logic | Requirements and issue generation bypass shared resolver/filter | `scheduling_rules`, `schedule_health_checks` | Health/coverage modules | Route through shared resolver and operational staff filter; repair corrupted deterministic data with backup | Coverage/health tests |
| Daily Timeline and dependent modules read schedule truth differently | Multiple schedule readers/adapters exist | Schedule tables | Daily Timeline, booking, attendance, dispatch, Today, staff portal | Consolidate on one effective schedule resolver contract | Consumer integration tests |

## Planned Verification

- Supabase migration validation or exact live-database blocker report: DONE. Linked migration-history reads time out through the pooler; migration apply is not claimed.
- Generated Supabase type regeneration or exact blocker report: DONE. `pnpm db:types` regenerated `src/types/supabase.ts`; branch booking rules tolerate pending distance-fee columns until production migration apply.
- Focused schedule resolver/write/availability/attendance/dispatch/health tests: DONE.
- Importer-removal and duplicate-route redirect checks: DONE.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm test --run`: PASS, 88 files / 702 tests.
- `pnpm build`: PASS, Next.js 16.2.4, 108 routes.

## Completion Notes

- Removed paper/manual schedule importer code, paper roster constants, importer actions, and duplicate schedule UI.
- Removed group schedule runtime fallback from resolver, runtime queries, realtime subscriptions, and Schedule UI; generated DB types are the only remaining source references to group tables.
- Removed legacy group schedule action/query/test helpers because there is no active explicit-template UI.
- Reduced CRM Schedule workspace to Daily Timeline and Schedule Setup while preserving Daily Timeline behavior.
- Redirected old `/crm/staff-availability` and `/crm/availability` pages to the canonical Schedule workspace.
- Added local migration `20260712190359_individual_schedule_runtime_only.sql` for runtime RPCs that no longer join group schedule tables.

---

# Previous Task - CRADLE-SCHEDULE-CONTRACT-REPAIR-004

Status: IN PROGRESS
Started: 2026-07-13
Last updated: 2026-07-13

## Mission

Repair the existing CradleHub scheduling contract so Schedule Setup, public
booking, CRM booking, attendance, assignment recommendations, live coverage, and
persisted health all use one ordered-window recurring schedule model.

## Authoritative Contract

- `staff_schedules` remains the recurring weekly work-window source.
- Active rows are real work windows; split shifts are multiple ordered windows.
- `single` is Regular in the UI.
- Opening and Closing are valid only for `staff.staff_type = 'therapist'` or CRM
  staff identified by the project CRM role helper / `system_role = 'crm'`.
- Every other role uses Regular only; tier, head status, seniority, and salon
  titles do not affect eligibility.
- One inactive row may mark a configured recurring day off; zero rows means no
  schedule configured.
- Group rules are templates and must not silently create effective staff
  schedules.
- `staff_duty_assignments` is not an availability source.

## Repair Matrix

| Problem | Root cause | DB object | Source correction | Regression coverage |
| --- | --- | --- | --- | --- |
| Paper importer writes 21 rows and infers Closing | Importer encodes paper roster assumptions | `staff_schedules` | Delete importer, action, page wiring, readiness copy | Importer reference removal test/search |
| Direct saves write 7 x 3 placeholders | Shift-type identity drives persistence | `staff_schedules` | Save actual ordered windows plus minimal day-off markers through RPC | Direct save row-count and payload tests |
| Split shifts ignored by identity | Unique key is `staff_id,day,shift_type` | `staff_schedules` constraints | Normalize/rank legacy data, use `staff_id,day,window_order` | Split/overlap/overnight resolver tests |
| Opening/Closing allowed for salon roles | Role checks treat salon staff as therapists | `staff`, schedules, group rules | Shared eligibility helper in SQL and TS | Role eligibility tests |
| Missing individual schedule inherits group rules | Runtime fallback joins group templates | `staff_group_schedule_rules` | Group rules are templates; no fallback in effective schedule | No-schedule and group fallback tests |
| Conflict output loses evidence | Resolver returns empty windows on conflict | Schedule resolver | Preserve exact affected windows and state | Conflict window/card tests |
| Health/coverage duplicate schedule logic | Separate readers and filters | `schedule_health_checks`, suggestions | Route health/coverage through shared resolver and operational filter | Dedup/fingerprint/coverage tests |
| Test/archived/merged staff enter operations | Filters duplicated inconsistently | `staff` | Reuse `operational-staff` plus SQL helper | Operational filter tests |
| Corrupted 29-person rule | Roster totals persisted as staffing defaults | `scheduling_rules` | Backup exact signature and restore safe defaults | Migration/source guard test |
| `staff_duty_assignments` ambiguity | Experimental table exists but no runtime refs | `staff_duty_assignments` | Audit/preserve, document as deprecated | Runtime reference search |

## Planned Verification

- Supabase migration validation in rollback or local reset when available.
- Database type regeneration or exact blocker report.
- Focused schedule/availability/health tests.
- `pnpm type-check`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

---

# Current Task - CRADLE-BACKEND-STABILIZATION-AND-SCHEDULE-REPAIR-001

Status: BLOCKED ON PRODUCTION MIGRATION APPLY
Started: 2026-07-13
Last updated: 2026-07-13

## Description

Perform an audit-first backend stabilization and schedule repair pass for the current CradleHub repository and linked Supabase schema. Scope includes schedule setup, effective schedule resolution, availability, online booking, attendance, QR scanning, coverage/schedule health, booking recommendations, staff capabilities, branch-aware scheduling, duplicate/test staff operational filtering, migration history drift, and RLS/backend contract alignment.

## Guardrails

- Preserve the current UI and workflows; do not redesign or add new product surfaces.
- Audit the real repository and database state before deciding migrations or data repair.
- Represent permanent database changes as idempotent migrations.
- Do not delete operational history, booking history, attendance history, QR audit data, payroll data, or Auth users.
- Do not merge unresolved identities from names alone.
- Keep Next.js Server Actions authenticated/authorized and return narrow client payloads.

## Planned Verification

- Repository and migration audit.
- Linked/local Supabase schema and migration-history audit, or exact blocker report.
- Focused backend tests for changed contracts.
- `pnpm type-check`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- Database type regeneration and migration validation where available.

## Notes

- Root `AGENT_RULES.md`, `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `ARCHITECTURE.md` are not present in this checkout; actual equivalents are `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, and `docs/ARCHITECTURE.md`.
- Supabase changelog checked on 2026-07-13. Relevant current caution: new public tables may not be automatically exposed to the Data API; any new public table needs explicit grants plus RLS.
- Initial `git status --short --branch` shows a clean worktree on `main`.
- Local implementation is in place and verified, but the production database was not changed by this task. Migration apply remains blocked by linked migration-history timeout/drift.

## Completed Locally

- Added `supabase/migrations/20260712165012_backend_stabilization_schedule_repair.sql` with schedule repair backups, operational staff helpers/view, booking-rule column backfill, overlap validation triggers, and transactional weekly replacement RPCs for individual staff and schedule groups.
- Routed CRM weekly staff schedule saves through `replace_staff_weekly_schedule(...)`.
- Routed group weekly schedule saves through `replace_group_weekly_schedule(...)`.
- Added metadata/archive/merge-aware operational staff filtering for availability provider selection.
- Regenerated Supabase types from the linked schema and reconciled pending local migration columns required by existing code.
- Added focused operational-staff filtering coverage and updated group schedule action tests for the RPC contract.

## Verification

- Migration dry-run in an explicit rollback transaction against the linked database: PASS.
- Focused schedule/action/staff tests: PASS, 4 files / 31 tests.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm test`: PASS, 89 files / 710 tests.
- `pnpm build`: PASS, Next.js 16.2.4, 108 routes.

## Blocked / Remaining

- `pnpm db:doctor` and `pnpm db:status` still time out while reading linked Supabase migration history on `aws-1-ap-northeast-1.pooler.supabase.com:5432`; `db:status` reports `Remote schema changed: no` before failing.
- Do not run a blind `db push` from this environment: several historical migrations are missing from remote migration history even though some effects are already present live.
- Apply `20260712165012_backend_stabilization_schedule_repair.sql` from a working migration-history path, then rerun `pnpm db:types`, `pnpm type-check`, `pnpm lint`, `pnpm test`, and `pnpm build`.
- Ambiguous active Nikki opening/closing overlaps were detected but intentionally not auto-resolved because both rows share the same created timestamp.
- Manual import and group apply-to-staff save paths still need transactional RPC coverage.

---

# Current Task - SCHEDULE-DATA-OPTIMIZATION-001

Status: COMPLETE
Started: 2026-07-12
Last updated: 2026-07-12

## Description

Resume the interrupted Scheduling Data Optimization / Schedule Setup hardening pass from the existing partial edits. The immediate local objective is to make ordinary daily assignments mutually exclusive, require explicit split-shift intent for multiple windows, reject duplicate/overlapping active windows before save, deactivate stale shift rows through complete weekly replacement, and block conflict-state schedules from availability/recommendation consumers.

## Scope

- Continue from the current dirty worktree without reverting unrelated Attendance/CRM changes.
- Preserve existing scheduling tables: `staff_schedule_groups`, `staff_group_schedule_rules`, `staff_schedules`, `schedule_overrides`, and `blocked_times`.
- Complete the partial changes already present in `resolve-staff-schedule.ts`, `staff-schedule-write.ts`, `staff-availability/actions.ts`, and `schedule-rule-builder-utils.ts`.
- Avoid adding parallel schedule tables.
- Add focused tests and documentation for the completed slice; report any live database/migration-history blockers honestly.

## Planned Verification

- Focused schedule resolver/write/action tests.
- Booking/availability safety tests where touched.
- `pnpm type-check`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- Database verification or exact blocker report if live migration/history access is unavailable.

## Completed

- Added explicit resolver statuses (`resolved`, `day_off`, `missing`, `conflict`) and conflict metadata for invalid/overlapping/contradictory schedules.
- Made conflict schedules operationally empty so availability, bookings, and recommendations cannot consume unsafe windows.
- Updated individual and group schedule saves to write complete 7-day x 3-shift matrices and verify returned row content.
- Added a single transactional group-rule save action and changed group apply-to-staff to deactivate stale rows by writing complete staff matrices.
- Wired the Schedule Setup matrix so ordinary shift choices are mutually exclusive and Split Shift is the explicit path for multiple active windows.
- Propagated schedule conflict status into daily schedule, CRM availability, readiness, live schedule conflicts, and assignment recommendations.
- Added focused tests for write helpers, resolver conflicts, group rule save, recommendations, live conflicts, and affected UI fixtures.

## Verification

- `npx vitest run tests/lib/schedule/staff-schedule-write.test.ts tests/lib/schedule/resolve-staff-schedule.test.ts tests/lib/actions/staff-schedule-groups.test.ts tests/lib/assignments/recommendation-engine.test.ts tests/lib/schedule/live-schedule-conflicts.test.ts tests/components/crm/availability-staff-shift-cell.test.tsx tests/lib/schedule/daily-timeline-operations.test.ts tests/lib/schedule/daily-timeline-coverage-card.test.tsx`: PASS, 8 files / 52 tests.
- `npm run type-check`: PASS.
- `npm run lint`: PASS.
- `npx vitest run`: PASS, 88 files / 707 tests.
- `npm run build`: PASS, Next.js 16.2.4, 108 routes.

---

# Current Task - ATTENDANCE-AUTONOMY-HARDENING-001

Status: IMPLEMENTED LOCALLY - NOT PRODUCTION CLOSED
Started: 2026-07-12
Last updated: 2026-07-12

## Description

Perform the final system-wide Attendance hardening pass against the current local repository, preserving verified schedule-first and selected-record reset work while closing concrete gaps in authoritative Attendance architecture, shift-instance identity, branch time/business-day behavior, idempotency, Recovery dedupe, and operational documentation.

## Scope

- Work only from the current local repository state in `E:\cradlehub`; do not restore from or compare against any archive.
- Verify existing Attendance schedule-first scan ordering, stale/conflicting open-row isolation, and selected-record reset before changing them.
- Prefer focused extraction and typed pure services over a broad rewrite.
- Add sequential migrations only where the current schema is missing required immutable shift snapshot/idempotency/recovery-dedupe fields.
- Preserve raw QR scan events, audit history, branch authorization checks, Test Mode separation, and current CRM/Owner Attendance surfaces.

## Planned Verification

- Focused Attendance tests for intent, shift-instance, branch time/business day, persistence/idempotency helpers, corrections, and registry/recovery helpers.
- `pnpm type-check`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- Supabase migration verification or exact blocker report.

## Completed

- Added authoritative shift-instance helpers in `src/lib/attendance/shift-instance.ts` for branch-local timezone conversion, attendance business date, schedule source mapping, and stable shift keys.
- Added `src/lib/attendance/attendance-state-machine.ts` for current session state and next expected scan action.
- Extended the scan path to capture immutable schedule snapshots, use configured branch timezone/business date, replay same-request committed public results, and dedupe active Recovery issues.
- Hardened selected-record reset/correction behavior so failed updates/audits surface instead of silently succeeding, and reset now reports the actual next state-machine action.
- Updated Device Registry loading to staff-first device lookup and removed broad raw scan-event loading from registry summaries.
- Enforced `ATTENDANCE_DEVICE_SECRET` in production while preserving an explicit local-development fallback.
- Added sequential migration `supabase/migrations/20260712035222_attendance_autonomy_hardening.sql`.
- Regenerated/reconciled `src/types/supabase.ts` after linked generation, including local pending Attendance and branch-booking columns that are not yet present in the remote schema.
- Added focused tests for shift-instance/timezone/business-day behavior and the Attendance state machine.
- Added `docs/maintenance/attendance-operations-runbook.md`.

## Continuation Completed - 2026-07-12

- Added sequential migration `supabase/migrations/20260712044527_attendance_transactional_scan_rpc.sql` with `public.commit_attendance_scan_transaction(...)` for transactional interpreted Attendance scan persistence.
- Routed normal interpreted clock-in, clock-out, active-service-blocked, and Recovery-intent Attendance scan commits through the scan RPC while preserving raw scan evidence and public-result replay.
- Added sequential migration `supabase/migrations/20260712045429_attendance_transactional_corrections_rpc.sql` with `public.reset_attendance_state_transaction(...)` for selected-record Attendance State Reset.
- Routed selected-record reset through the reset RPC so the interpreted check-in void, linked open Recovery resolution, and correction audit row commit or roll back together.
- Updated generated Supabase types for the new RPCs and added migration-contract coverage in `tests/lib/attendance/transactional-scan-rpc-migration.test.ts`.
- Applied both new RPC definitions to the linked database via `supabase db query --linked --dns-resolver https --file ...`.

## Verification

- `npx vitest run tests/lib/attendance/attendance-intent-engine.test.ts tests/lib/attendance/shift-instance.test.ts tests/lib/attendance/attendance-state-machine.test.ts tests/lib/attendance/device-recovery.test.ts`: PASS, 4 files / 27 tests.
- `npx vitest run tests/lib/attendance/attendance-intent-engine.test.ts tests/lib/attendance/shift-instance.test.ts tests/lib/attendance/attendance-state-machine.test.ts tests/lib/attendance/device-recovery.test.ts tests/lib/attendance/transactional-scan-rpc-migration.test.ts`: PASS, 5 files / 30 tests.
- `npx tsc --noEmit --pretty false`: PASS.
- Linked schema verification: both new RPCs exist, are `security invoker`, and have EXECUTE only for `postgres` and `service_role`.
- Linked no-mutation probes: both RPCs return `invalid_request` without inserting data.
- Linked migration-history verification: `supabase_migrations.schema_migrations` reports `0` rows for `20260710040835`, `20260710055131`, `20260712000100`, `20260712035222`, `20260712044527`, and `20260712045429`; migration history is not reconciled.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm test`: PASS, 88 files / 699 tests.
- `pnpm build`: PASS, Next.js 16.2.4, 108 routes.
- `pnpm db:types`: PASS, but linked remote schema is behind local pending migrations; local type reconciliation was required afterward.

## Remaining Blockers

- `.\node_modules\.bin\supabase.CMD migration list --local` cannot verify local migrations because local Postgres at `127.0.0.1:54322` is not running.
- `pnpm db:status` still times out reading linked migration history at `aws-1-ap-northeast-1.pooler.supabase.com:5432`; it reports `Remote schema changed: no` before exiting.
- `pnpm db:doctor` passes CLI/link/token/pooler checks but exits with migration-history timeout.
- The main interpreted Attendance scan mutation path now has a PostgreSQL transactional RPC, but event-only/noop scan paths still need retry/concurrency QA.
- Selected-record Attendance State Reset now has a PostgreSQL transactional RPC, but manual clock-out, launch recovery, ignore-scan, rule updates, archive-test-data, and rebuild/manual-attendance workflows still need transactional RPC coverage.
- Account claim, OTP/rate-limit flow, canonical host redirect, rotating branch challenge, scheduled reconciliation, and full diagnostic modal remain incomplete.
- Authenticated CRM browser QA, Owner browser QA, and real-phone/device-cookie QA are still required.

---

# Current Task - ATTENDANCE-TODAY-ALIGNMENT-RESET-001

Status: COMPLETED
Started: 2026-07-12
Last updated: 2026-07-12

## Description

Repair the existing CradleHub Attendance QR flow so scan intent is schedule-aware for today's operational shifts, stale launch-era open rows are isolated into Recovery, and the current Recovery reset action becomes a safe Attendance State reset instead of a broad day wipe.

## Scope

- Reuse the current QR scan engine, intent engine, attendance records, Recovery Center, correction service, and CRM/Owner Attendance workspaces.
- Do not add a second attendance engine, duplicate recovery page, or experimental reset path.
- Preserve raw QR scan events, correction audit history, branch permissions, active-service clock-out protection, and local Attendance tab state.
- Add focused tests for schedule-aware active-row matching, stale-row isolation, closing-scan recovery, duplicate behavior, and reset-state safeguards.

## Planned Verification

- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm test`: PASS, 85 files / 688 tests.
- `pnpm build`: PASS, Next.js 16.2.4, 108 routes.

## Completed

- Reordered the live Attendance QR scan flow so branch time and resolved staff schedule are evaluated before any open attendance row can decide clock-in/out.
- Added pure open-row classification in `attendance-intent-engine.ts` for exact current-shift matches, legacy generic shift fallback by schedule-window overlap, stale prior rows, and same-day conflicting rows.
- The scan engine now uses only a matching current-shift open row for clock-out; stale/conflicting open rows create/update Recovery exceptions and the current scan continues through schedule-aware intent.
- Closing-window scans without a matching current shift remain Recovery-only and do not create new check-ins.
- Replaced broad Reset Staff Day behavior with selected-record Attendance State Reset: required reason, required void confirmation, raw scans preserved, related open exceptions resolved, and correction audit recorded.
- Added migration `supabase/migrations/20260712000100_attendance_state_reset.sql` for the new `reset_attendance_state` correction action name.

## Notes

- `pnpm db:doctor` and `pnpm db:status` still time out on the remote Supabase migration-history port 5432 even with unrestricted retries. `db:status` reported `Remote schema changed: no` before exiting. Apply/push the new migration from a working DB path before using `reset_attendance_state` in production.
- `git diff --check` is blocked by pre-existing unrelated blank-line-at-EOF issues in non-attendance files and line-ending warnings; no whitespace errors were reported in this task's edited attendance files.

---

# Current Task - CRM-PERFORMANCE-OPTIMIZATION-001

Status: COMPLETED
Started: 2026-07-11
Last updated: 2026-07-11

## Description

Completed the frozen CRM performance optimization program as a safe, source-level pass after the final CRM UI sweep.

## Scope

- Preserved frozen CRM UI, terminology, routes, workflows, booking lifecycle behavior, payment behavior, dispatch guards, branch/role scoping, mutation refresh behavior, and realtime updates.
- Avoided schema, migration, RLS, index, route contract, public API, and cache semantics changes.
- Focused on evidence-backed render/effect optimizations in existing client workspaces.

## Completed

- Captured baseline verification and build artifact evidence.
- Audited CRM route output, client-reference manifests, large client files, dynamic import candidates, query/realtime patterns, and source re-render hotspots.
- Memoized Today Work Queue summary derivation in `work-queue-dashboard.tsx`.
- Memoized Work Queue filter counts and visible rows in `work-queue-panel.tsx`.
- Memoized Bookings Workspace tab counts and visible rows, and made initial tab derivation lazy.
- Stabilized Dispatch Live Map marker selection callback so selected booking state does not recreate map work.
- Added `docs/performance/crm-performance-baseline.md` and `docs/performance/crm-performance-optimization-report.md`.

## Verification

- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm test -- --run --testTimeout=10000`: PASS, 83 files / 674 tests.
- `pnpm build`: PASS, Next.js 16.2.4, 108 app routes.

## Notes

- Bundle size did not decrease; final JS chunk total increased by 276 bytes due to React hook imports. The measured value is lower render/effect work, not payload reduction.
- Bookings should remain NOT CERTIFIED until authenticated browser interaction QA is completed, per the existing booking certification record.
- Broad bundle splitting, query column narrowing, and database/index work are deferred until a separately certified phase.

---

# Current Task - SCHEDULE-CONFLICT-RESOLUTION-CENTER-001

Status: COMPLETED
Started: 2026-07-09
Last updated: 2026-07-09

## Description

Optimize the Schedule Conflict Center into a professional conflict resolution center with business-impact classification, safer exception handling, search/filtering, and a three-zone desktop layout.

## Scope

- Keep existing live conflict detection, counts, timeline indicators, staff-row indicators, and safe action routing.
- Add impact groups: Must Fix, Needs Approval, Cleanup Warning, Informational, Accepted.
- Improve modal scanability with summary chips, impact groups, issue list, and resolution panel.
- Add safe-preview and accept-exception UI without introducing blind writes.
- Preserve public/online booking, CRM booking availability, QR attendance, attendance-as-live-status, and schedule setup write flows.

## Completed

- Removed the stale unused severity-count memo from the dialog wiring.
- Updated conflict tab/category typing so coverage gaps no longer point at the removed `coverage` tab.
- Narrowed accepted/active issue status typing in the impact model.
- Updated the legacy summary-list helper to compile against the new impact-group model.
- Added explicit `ReactNode` / `LucideIcon` typing in the resolution panel.
- Refreshed dialog tests to cover the reasoned accept-exception flow and accepted-tab transition.

## Verification

- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- Focused schedule tests: PASS, 12 files / 49 tests.
- Booking/availability safety tests: PASS, 8 files / 172 tests.
- `pnpm build`: PASS, Next.js 16.2.4, 108 routes.

## Notes

- Must Fix issues still cannot be accepted.
- Accepted exceptions remain local to the review-session UI/audit view; no blind schedule writes were introduced.
- Authenticated CRM browser QA against live branch data remains the final recommended operator check.

---

# Current Task - ATTENDANCE-RECOVERY-RULES-001

Status: COMPLETED
Started: 2026-07-10
Last updated: 2026-07-10

## Description

Upgrade Attendance into a schedule-aware recovery workflow so QR first scans near closing are no longer written as normal clock-ins when no earlier clock-in exists.

## Scope

- Keep the existing Attendance tab key `exceptions` for URL/backward compatibility while relabeling it as Recovery.
- Add a Smart Attendance Intent Engine that classifies clock-in, clock-out, duplicate, missing schedule, day-off, ambiguous, and likely closing-without-clock-in scans.
- Route recovery-grade scans to immutable raw scan events plus attendance exceptions instead of creating incorrect check-in records.
- Add Recovery Center views for Today Recovery, Staff Records, Rules, and Audit Log.
- Add attendance rules/corrections migration and server actions for corrections/rule updates.
- Preserve existing QR/device registration, branch validation, room scan, service session, and raw scan event flows.

## Completed

- Added `src/lib/attendance/attendance-intent-engine.ts` with pure schedule-aware scan intent classification.
- Updated `src/lib/attendance/scan-engine.ts` so first scans in clock-out/closing windows are recorded as `exception` / `likely_closing_scan_without_clock_in` and sent to Recovery instead of inserting `staff_shift_checkins`.
- Added `src/lib/attendance/attendance-correction-service.ts` plus server actions for applying launch recovery, manual clock-out, staff-day reset, ignored/reviewed scans, and rule updates.
- Added migration `supabase/migrations/20260710040835_attendance_recovery_rules.sql` for attendance rules/correction audit fields.
- Replaced the old Exceptions tab surface with `AttendanceRecoveryTab` while keeping internal key `exceptions`.
- Updated Attendance header, overview attention panel, quick actions, tabs, records entry point, workspace realtime refresh, and workspace data DTOs.
- Added focused intent-engine tests covering normal clock-in/out, duplicate scans, missing schedule, day off, first closing scan recovery, launch recovery, ambiguous scans, and overnight clock-out.

## Verification

- `npx vitest run tests/lib/attendance/attendance-intent-engine.test.ts`: PASS, 10 tests.
- `npx vitest run tests/lib/attendance`: PASS, 8 files / 41 tests.
- `npx tsc --noEmit`: PASS.
- Targeted `npx eslint` on touched Attendance files/tests: PASS.
- `pnpm build`: PASS, Next.js 16.2.4, 108 routes.
- `git diff --check`: PASS, line-ending notices only.

## Notes

- The new migration has been created locally but was not pushed/applied during this pass.
- Authenticated CRM browser QA remains recommended after the migration is applied, especially for the Recovery Rules and Apply Recovery flows.

---

# Current Task - AGENT-COACH-IDLE-LOOP-001

Status: COMPLETED
Started: 2026-07-09
Last updated: 2026-07-09

## Description

Fix the runtime `Maximum update depth exceeded` error in `AgentCoachProvider` caused by repeated idle-reset state updates from activity/scroll events.

## Scope

- CRM/Owner Agent Coach context provider idle detection.
- Preserve coach context, inline tips, chat bubble, and 45-second idle behavior.
- Do not change agent API routes or booking/schedule flows.

## Completed

- Replaced unconditional activity-event `setIsIdle(false)` calls with a ref-backed state guard.
- Moved the idle timeout handle into a ref so activity events only reschedule the timer and only trigger React state when the idle boolean actually changes.
- Added a regression test proving repeated mouse/scroll/click events while active do not re-render the provider, while the idle timeout and first follow-up activity still update correctly.

## Files Changed

- `src/components/agent/agent-context-provider.tsx`
- `tests/components/agent/agent-context-provider.test.tsx`

## Verification

- `pnpm test --run tests/components/agent/agent-context-provider.test.tsx`: PASS, 1 file / 1 test.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS, Next.js 16.2.4, 108 routes.

## Notes

- Root cause was not the schedule conflict modal itself; it exposed a brittle global idle listener path because scroll/activity events could repeatedly request the same React state.

---

# Current Task - SCHEDULE-CONFLICT-CENTER-001

Status: COMPLETED
Started: 2026-07-09
Last updated: 2026-07-09

## Description

Redesign the live Schedule conflict details UI so Coverage Overview is the single entry point and all detailed review happens inside a centered Schedule Conflict Center modal instead of a separate right-rail card.

## Scope

- Remove the independent right-rail Conflict Details card.
- Keep conflict detection, counts, timeline indicators, staff-row indicators, quick actions, and schedule-first guardrails.
- Add a modal with category tabs, grouped summary, issue cards, empty states, and safe action preview.
- Preserve public/online booking, CRM booking availability, QR attendance, and schedule setup write flows.

## Completed

- Replaced the Coverage Overview conflicts row with a compact issue summary card showing All clear / warning / critical states and a `Review Issues` entry point.
- Removed the old right-rail `Conflict Details` render path and deleted the obsolete panel/test files from the working tree.
- Added `Schedule Conflict Center` as a centered wide modal on desktop and full-height sheet on small screens.
- Added category tabs for All, Critical, Staff, Rooms, Coverage, Travel, Blocked Time, and Schedule with counts.
- Added grouped category summary navigation and filtered compact issue cards with human-friendly conflict labels.
- Added an in-modal safe action preview panel that delegates to the existing conflict action routing.
- Kept the live conflict model, SWR/realtime data path, timeline warning indicators, staff-row indicators, and booking/attendance guardrails intact.

## Files Changed

- `src/components/features/schedule/tabs/daily-timeline-coverage-card.tsx`
- `src/components/features/schedule/tabs/daily-timeline-operations-rail.tsx`
- `src/components/features/schedule/tabs/daily-timeline-tab.tsx`
- `src/components/features/schedule/tabs/schedule-conflict-center-dialog.tsx`
- `src/components/features/schedule/tabs/schedule-conflict-category-tabs.tsx`
- `src/components/features/schedule/tabs/schedule-conflict-summary-list.tsx`
- `src/components/features/schedule/tabs/schedule-conflict-issue-card.tsx`
- `src/components/features/schedule/tabs/schedule-conflict-action-panel.tsx`
- `src/components/features/schedule/tabs/schedule-conflict-center-model.ts`
- `src/components/shared/overlays/admin-dialog.tsx`
- `tests/lib/schedule/schedule-conflict-center-dialog.test.tsx`
- `tests/lib/schedule/daily-timeline-coverage-card.test.tsx`

## Verification

- `pnpm test --run tests/lib/schedule/live-schedule-conflicts.test.ts tests/lib/schedule/schedule-conflict-center-dialog.test.tsx tests/lib/schedule/daily-timeline-coverage-card.test.tsx tests/lib/schedule/daily-timeline-operations.test.ts`: PASS, 4 files / 17 tests.
- `pnpm test --run tests/lib/assignments/recommendation-engine.test.ts tests/lib/home-service/distance-fee.test.ts tests/lib/bookings/crm-booking-status.test.ts tests/components/crm/availability-staff-shift-cell.test.tsx`: PASS, 4 files / 22 tests.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS, Next.js 16.2.4, 108 routes.

## Notes

- No Supabase migration was added.
- Authenticated CRM browser QA remains recommended for final visual/operator confirmation against live branch data.

---

# Current Task - SCHEDULE-CONFLICT-CLARITY-001

Status: COMPLETED
Started: 2026-07-09
Last updated: 2026-07-09

## Description

Audit and improve the scheduling conflict logic connected to the live Schedule page so the Daily Timeline / Coverage Overview conflict count is clear, clickable/expandable, and every counted conflict explains who/what/time/rule/fix for non-technical front desk staff.

## Scope

- Live Schedule page Daily Timeline / Coverage Overview conflict calculation and display.
- Central conflict model for schedule-page conflicts.
- Timeline indicators for affected staff/booking/resource rows.
- Safe guided conflict actions that link to existing booking/schedule flows where direct writes are not safe.
- Preserve booking, attendance, online booking, CRM booking, QR attendance, and schedule setup behavior.

## Pre-flight Notes

- User requested work from attached pasted text on 2026-07-09.
- Read required project context files under `.context/` plus `docs/ROADMAP.md`, `docs/PROJECT_CONTEXT.md`, and `docs/AGENT_RULES.md`; root roadmap/context/rules files are absent in this checkout.
- Read local Next.js 16 docs for Server/Client Components and Route Handlers before source edits.
- Read Supabase and React/Next best-practice skill guidance because this task touches Supabase-backed schedule data and React/Next UI.
- Attendance/check-in must remain live status only and must not create schedule conflicts by itself.
- Online/public booking and CRM booking availability must remain separate and schedule-first.
- Resumed on 2026-07-09 after a prior interruption. The pure model files already exist; remaining work is to wire them into Daily Timeline/Coverage UI, indicators, tests, verification, and final context updates.

## Initial Plan

1. Identify where the visible `Conflicts` count is calculated and where daily timeline rows/cards receive conflict information.
2. Audit existing conflict/rule detectors across schedule, coverage, availability, CRM availability, and assignment logic.
3. Create or extend one typed conflict model for live schedule conflicts with plain-language messages, affected entities, safe actions, and admin-only debug metadata.
4. Feed the model into Daily Timeline / Coverage Overview so count and visible cards agree.
5. Add timeline/staff-row indicators for affected bookings/resources without changing public booking behavior.
6. Add focused tests for core conflict types, attendance non-conflict behavior, UI details, and quick actions.
7. Run `pnpm type-check`, `pnpm lint`, `pnpm build`, and relevant tests; update context files afterward.

## Completed

- Confirmed the previous visible Daily Timeline `Conflicts` count came from `DailyTimelineAlert` filtering in `src/components/features/schedule/tabs/daily-timeline-coverage-card.tsx`.
- Wired the central live schedule conflict model into the CRM Schedule page API payload, workspace shell, Daily Timeline tab, coverage card, summary metrics, operations rail, timeline board, and staff rows.
- Added a front-desk-friendly `Conflict Details` panel with plain-language conflict cards, severity, who/what/time/resource context, rule/fix copy, safe quick actions, and dev-only debug details.
- Added safe guided quick actions that select affected staff/bookings or open existing setup/full-schedule/availability flows instead of performing risky direct writes.
- Added timeline/staff-row indicators and booking highlighting for warning/critical conflicts.
- Preserved schedule-first booking behavior: attendance/check-in remains live status only and does not create schedule conflicts by itself.
- Preserved public/online booking, CRM booking availability, QR attendance, and schedule setup write flows.

## Files Changed

- `src/lib/schedule/live-schedule-conflict-types.ts`
- `src/lib/schedule/live-schedule-conflicts.ts`
- `src/app/(dashboard)/crm/schedule/page.tsx`
- `src/app/api/crm/schedule/route.ts`
- `src/components/features/schedule/hooks/use-live-daily-schedule.ts`
- `src/components/features/schedule/workspace/schedule-workspace-shell.tsx`
- `src/components/features/schedule/tabs/daily-timeline-tab.tsx`
- `src/components/features/schedule/tabs/daily-timeline-operations-rail.tsx`
- `src/components/features/schedule/tabs/daily-timeline-coverage-card.tsx`
- `src/components/features/schedule/tabs/daily-timeline-summary.tsx`
- `src/components/features/schedule/tabs/daily-timeline-board.tsx`
- `src/components/features/schedule/tabs/daily-timeline-staff-row.tsx`
- `src/components/features/schedule/tabs/daily-timeline-conflict-details-panel.tsx`
- `src/components/features/schedule/tabs/daily-timeline-conflict-actions.ts`
- `tests/lib/schedule/live-schedule-conflicts.test.ts`
- `tests/lib/schedule/daily-timeline-conflict-details-panel.test.tsx`
- `tests/lib/schedule/daily-timeline-coverage-card.test.tsx`

## Verification

- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS, Next.js 16.2.4, 108 routes.
- `pnpm test --run tests/lib/schedule/live-schedule-conflicts.test.ts tests/lib/schedule/daily-timeline-conflict-details-panel.test.tsx tests/lib/schedule/daily-timeline-coverage-card.test.tsx tests/lib/schedule/daily-timeline-operations.test.ts`: PASS, 4 files / 15 tests.
- `pnpm test --run tests/lib/assignments/recommendation-engine.test.ts tests/lib/home-service/distance-fee.test.ts tests/lib/bookings/crm-booking-status.test.ts tests/components/crm/availability-staff-shift-cell.test.tsx`: PASS, 4 files / 22 tests.

## Notes

- Authenticated CRM browser QA is still recommended to confirm the exact operator flow against live branch data.
- No Supabase migration was added for this task.

---

# Current Task - BRANCH-LOCATION-HOME-SERVICE-ORIGIN-001

Status: COMPLETED
Started: 2026-07-09
Last updated: 2026-07-09

## Description

Add editable branch location settings so CRM Home Service distance calculation can use the selected branch latitude/longitude as the origin and the selected customer Google Places coordinates as the destination.

## Scope

- Branch location/settings UI.
- CRM Home Service booking distance integration.
- Reuse the existing Google Places/address picker where possible.
- Do not change public booking wizard behavior.
- Do not expose server-only Google or Supabase service-role keys to client code.

## Discovery

- Branch editing lives at `/owner/branches/[branchId]`, rendered by `src/app/(dashboard)/owner/branches/[branchId]/branch-edit-form.tsx`.
- Branch create/update actions live in `src/app/(dashboard)/owner/branches/actions.ts`.
- Branch data queries live in `src/lib/queries/branches.ts`.
- `public.branches` already had `address`, `maps_embed_url`, `latitude`, and `longitude`; it did not have `place_id`, `city`, `barangay`, or `location_metadata`.
- `public.branch_booking_rules` already had `home_service_free_km` and `home_service_extra_km_fee` from `20260709103000_home_service_distance_fee.sql`.
- CRM Home Service distance already used `branches.latitude`/`branches.longitude` as origin via `src/lib/home-service/distance-service.ts`.
- The reusable Google Places picker is `src/components/public/places-autocomplete.tsx`, with address-component helpers in `src/lib/location/google-address-components.ts`.

## Completed

- Added migration `supabase/migrations/20260709114038_branch_location_settings.sql` for `branches.place_id`, `branches.city`, `branches.barangay`, and `branches.location_metadata`.
- Updated local Supabase types for the new branch columns.
- Extended branch validation to accept selected Google Places origin data and to require latitude/longitude as a pair.
- Replaced the plain owner branch edit address field with a `Branch service address` editor using the shared `PlacesAutocomplete` component.
- Branch service address selection now stores formatted address, place id, latitude, longitude, derived city/barangay, map URL, and address components.
- The branch editor shows saved origin coordinates and derived city/barangay, or a warning when coordinates are missing.
- `updateBranchAction` now persists the new branch origin fields and revalidates the branch detail page.
- CRM Home Service distance missing-origin copy now points staff to update the selected branch service address.
- Public booking wizard behavior was not changed.

## Files Changed

- `supabase/migrations/20260709114038_branch_location_settings.sql`
- `src/app/(dashboard)/owner/branches/[branchId]/branch-edit-form.tsx`
- `src/app/(dashboard)/owner/branches/actions.ts`
- `src/lib/validations/branch.ts`
- `src/lib/home-service/distance-service.ts`
- `src/types/supabase.ts`
- `tests/lib/validations/branch-location.test.ts`

## Verification

- `pnpm test --run tests/lib/validations/branch-location.test.ts tests/lib/home-service/distance-fee.test.ts`: PASS, 2 files / 16 tests.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS, Next.js 16.2.4, 108 routes.

## Notes

- Apply pending Supabase migrations before relying on the new branch origin fields in a deployed environment.
- `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` is required for the branch service address picker.
- `GOOGLE_MAPS_SERVER_API_KEY` is still optional for driving distance; without it, Home Service quotes fall back to Haversine estimates.

---

# Previous Task - CRM-HOME-SERVICE-LOCATION-FIELD-CLEANUP-001

Status: COMPLETED
Started: 2026-07-09
Last updated: 2026-07-09

## Description

Clean up the CRM Home Service booking form so the selected Google Places service address is the single location source of truth, removing redundant manual city/barangay/landmark/location-note fields.

## Completed

- Removed the visible CRM Home Service `City`, `Barangay / area`, `Landmark`, and `Location notes` inputs from quick booking.
- Kept one required `Service address` field backed only by the shared Google Places autocomplete component.
- Removed the CRM plain text fallback for missing Google browser key; staff must select a real Places result before submit/distance calculation.
- Kept city and barangay as internal derived values from Google address components when available.
- Added one optional compact `Access note / special direction` field with placeholder `Example: blue gate, 2nd floor, near Puregold`.
- Submitted the access note as `homeServiceAccessNote` and stored it in booking metadata as `home_service_access_note`.
- Persisted selected address components and mirrored distance/source/travel fee details in the internal Home Service address metadata.
- Updated the CRM summary to show service address, distance from branch, free allowance, additional charged km, travel fee, and total.
- Public booking wizard behavior was not changed.

## Files Changed

- `src/components/features/bookings/quick-booking-form.tsx`
- `src/lib/actions/inhouse-booking.ts`
- `src/lib/validations/booking.ts`

## Verification

- `pnpm test --run tests/lib/home-service/distance-fee.test.ts`: PASS, 1 file / 14 tests.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS, Next.js 16.2.4, 108 routes.

## Notes

- Removed stale generated `.next/dev/types/validator.ts` after it was found corrupted during the first `pnpm type-check`; source type-check passed after deleting the generated artifact.
- `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` is still required for the CRM Places field to load.

---

# Previous Task - CRM-BOOKING-HOME-SERVICE-DISTANCE-001

Status: COMPLETED
Started: 2026-07-09
Last updated: 2026-07-09

## Description

Fix CRM/internal booking therapist availability so saved schedules are the source of truth and attendance/check-in is only live-status metadata. Add CRM Home Service live address selection, branch-to-customer distance calculation, and the travel fee policy: first 5 km free, then PHP 100 per started extra km.

## Scope

- CRM/internal booking only.
- Preserve public booking wizard behavior; public booking code may only be inspected or safely reused without visual/functional changes.
- Do not expose server-only Google or Supabase service-role keys to client components.

## Required Discovery

- Identify which CRM component displays the generic "No therapist is available" message and which query/API supplies CRM therapist availability.
- Check whether attendance/check-ins/device registration are hard filters.
- Check staff service capability, schedules/group rules/overrides, blocked times, existing booking overlap, booking mode windows, and timezone parsing.
- Inspect existing public booking live address/location picker logic for safe reuse.
- Check branch location and home-service pricing settings before adding schema.

## Completed

- Confirmed the CRM quick-booking form was still using the generic public availability pre-check/copy while the CRM-specific schedule-first API already existed.
- Wired CRM quick booking pre-submit checks to `/api/booking/crm-availability`, preserving schedule-first availability and avoiding attendance/check-in as a hard blocker.
- Reused the public Google Places autocomplete component for CRM Home Service address selection without changing the public booking wizard.
- Required a selected/geocoded Home Service place in CRM before submit, then sent place id, formatted address, latitude/longitude, city/barangay hints, components, and map URL to the server action.
- Added live CRM distance quote UI for Home Service bookings through `/api/home-service/distance`, including distance, free allowance, charged extra km, travel fee, final total, and estimated-distance warnings.
- Preserved the existing server-side distance quote path: Google driving distance when `GOOGLE_MAPS_SERVER_API_KEY` is configured, Haversine fallback otherwise.
- Confirmed the travel-fee formula is first 5 km free, then PHP 100 per started extra km.
- Stored Home Service distance/fee/address metadata through the internal booking server action pricing breakdown/booking metadata path.
- Replaced remaining old generic no-therapist copy with the schedule-specific CRM message.
- Fixed owner spaces/rules fallback defaults for the new Home Service distance-fee fields.
- Added focused pure tests for Home Service distance and fee boundary behavior.

## Files Changed

- `src/components/features/bookings/quick-booking-form.tsx`
- `src/lib/actions/inhouse-booking.ts`
- `src/app/(dashboard)/owner/spaces-rules/page.tsx`
- `tests/lib/home-service/distance-fee.test.ts`

## Verification

- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS, Next.js 16.2.4, 108 routes.
- `pnpm test --run tests/lib/assignments/recommendation-engine.test.ts tests/lib/home-service/distance-fee.test.ts`: PASS, 2 files / 18 tests.

## Notes

- Public booking wizard behavior was preserved; the CRM form only imports and reuses the public Places component.
- `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` is required for the CRM browser autocomplete UI.
- `GOOGLE_MAPS_SERVER_API_KEY` enables driving-distance quotes; without it, quotes fall back to Haversine and the CRM UI marks them estimated.
- Apply pending Supabase migrations and regenerate database types if the deployment workflow requires it.
- Authenticated CRM browser QA with real Google Places and server distance credentials is still recommended after environment configuration.

---

# Previous Task - BRANCH-CORRECTION-REQUESTS-001

Status: COMPLETED
Started: 2026-07-09
Last updated: 2026-07-09

## Description

Implement the QR Attendance "Wrong Branch Correction Request" flow if the full flow does not already exist.

Staff blocked by a real scanned-QR/staff-branch mismatch should be able to submit a correction request to the scanned branch. CRM/front desk for the requested/scanned branch should be able to review and approve/reject the request without gaining broad access to staff in other branches. Approval updates `staff.branch_id`, keeps active attendance devices in sync or relies on the existing sync trigger, and writes an audit trail.

## Required Discovery

- Search for existing branch correction, wrong-branch, staff branch change, scan-engine, staff device branch mismatch, CRM inbox, and audit-log code before implementing.
- Inspect Attendance QR scan engine/UI/actions, CRM Attendance/Staff Management tabs, staff branch edit actions, and Supabase migrations.
- If the full flow exists, verify it end-to-end and patch only gaps; otherwise build the missing flow.

## Completed

- Found a partial branch correction implementation already present: request table/types/helpers, scan action entry point, wrong-branch payload types, and part of the public wrong-branch card existed, but the flow was incomplete.
- Added follow-up migration `supabase/migrations/20260709083908_staff_branch_audit_logs.sql` for `staff_branch_audit_logs`, missing request indexes, active requested-branch validation, and approval audit logging.
- Completed secure branch-correction helpers/actions for create, approve, reject, reviewer cancel, and staff-owned pending cancel.
- QR wrong-branch results now include staff/branch/QR/device/pending-request data, richer scan-event metadata, duplicate-pending detection, and clear wrong-branch copy.
- Public wrong-branch UI now shows current profile branch, scanned/requested branch, request button, pending-request state, front-desk approval reminder, and a "Try another account" path that clears scan auth/device context.
- Added CRM Staff Management "Branch Corrections" tab showing pending requested-branch correction requests with staff details, QR details, approve/reject actions, and confirmation copy.
- Central permission helper enforces owner/manager all-branch review, CRM/CSR requested-branch-only review, and no staff self-approval.
- Approval updates `staff.branch_id` through the RPC and relies on the existing `trg_staff_branch_sync_devices` trigger to keep active `staff_devices.branch_id` aligned.

## Files Changed

- `src/lib/attendance/scan-engine.ts`
- `src/lib/attendance/types.ts`
- `src/app/scan/actions.ts`
- `src/app/api/attendance/public-scan/route.ts`
- `src/components/features/attendance/public-scan-processor.tsx`
- `src/components/features/attendance/public-scan-result.tsx`
- `src/components/features/attendance/public-scan-processor.module.css`
- `src/lib/staff/branch-correction.ts`
- `src/lib/staff/branch-correction-policy.ts`
- `src/lib/staff/branch-correction-types.ts`
- `src/app/(dashboard)/crm/staff/actions.ts`
- `src/app/(dashboard)/crm/staff/page.tsx`
- `src/components/features/crm/staff/crm-staff-workspace.tsx`
- `src/components/features/crm/staff/crm-staff-branch-corrections-tab.tsx`
- `supabase/migrations/20260709064020_branch_correction_requests.sql`
- `supabase/migrations/20260709083908_staff_branch_audit_logs.sql`
- `tests/lib/staff/branch-correction-policy.test.ts`
- `tests/lib/staff/branch-correction-migrations.test.ts`
- `tests/components/attendance/public-scan-branch-correction.test.tsx`
- `tests/components/crm/crm-staff-branch-corrections-tab.test.tsx`

## Verification

- `pnpm test --run tests/lib/staff/branch-correction-policy.test.ts tests/lib/staff/branch-correction-migrations.test.ts tests/components/attendance/public-scan-branch-correction.test.tsx tests/components/crm/crm-staff-branch-corrections-tab.test.tsx tests/lib/attendance/branch-validation.test.ts`: PASS, 5 files / 16 tests.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS, Next.js 16.2.4, 106 routes.

## Notes

- Manual DB step still required: apply pending migrations, especially `20260709064020_branch_correction_requests.sql`, `20260709054954_attendance_device_branch_sync.sql` if not already applied, and `20260709083908_staff_branch_audit_logs.sql`; then regenerate Supabase types if the project standard requires checked-in generated types for new tables.
- Authenticated browser QA on a real CRM/front-desk session and physical QR phone scan QA are still recommended after migration deployment.

---

# Previous Task - STAFF-ONBOARDING-BRANCH-SAFETY-001

Status: COMPLETED
Started: 2026-07-08
Last updated: 2026-07-09

## Description

Harden the staff onboarding/registration flow so applicants cannot register under the wrong branch and approvers cannot silently move them to a different branch.

## Completed

- Branch selection is now required; the "No preference" option was removed.
- Single-branch setups auto-select and clearly display the only active branch.
- Multi-branch setups show selectable branch cards for the two active branches.
- Added a required confirmation checkbox: "I confirm this is the branch where I normally work."
- The Review step now shows the selected branch name.
- Backend no longer falls back to the first branch; missing/inactive branches are rejected.
- Branch confirmation metadata is stored in `staff_onboarding_requests.metadata`.
- `staff.branch_id` and `staff_onboarding_requests.requested_branch_id` are kept identical on submission and approval.
- Duplicate checks run before auth/staff creation for email (auth.users + submitted requests) and phone (active staff + submitted requests), including full-name + phone duplicates.
- Staff-friendly error messages added for duplicate email/phone and missing branch.
- CRM/CSR reviewers cannot change the approval branch; the branch selector is disabled for them.
- Owner/manager branch changes are allowed but clearly warned and recorded in metadata.
- Added password-save reminder and updated success copy.

## Files Changed

- `src/app/staff-onboarding/onboarding-form.tsx`
- `src/app/staff-onboarding/actions.ts`
- `src/components/features/staff-onboarding/onboarding-review-list.tsx`
- `src/lib/staff/onboarding-validation.ts` (new)
- `tests/lib/staff/onboarding-branch-validation.test.ts` (new)
- `tests/lib/staff/onboarding-duplicate-check.test.ts` (new)
- `tests/lib/staff/approval-branch-safety.test.ts` (new)
- `tests/components/staff-onboarding/onboarding-review-branch.test.tsx` (new)

## Verification

- `pnpm type-check`: PASS
- `pnpm lint`: PASS
- `pnpm build`: PASS, 107 routes
- `pnpm test --run`: PASS, 73 files / 623 tests

## Notes

- No database migration was required; changes use existing `staff_onboarding_requests.metadata` (JSONB) and the existing `requested_branch_id` column.
- Authenticated browser QA of the onboarding form and CRM review list still needs a real session.

---

# Previous Task - BRANCH-CORRECTION-REQUESTS-001

Status: IN_PROGRESS
Started: 2026-07-09
Last updated: 2026-07-09

## Description

Build Branch Correction Requests for QR Attendance wrong-branch recovery.

The new flow must let a staff member who is blocked by a real scanned-QR/staff-branch mismatch request correction to the scanned branch without changing their own branch directly. CRM users for the requested/scanned branch can review the request from Staff Management, approve or reject it, and approval updates `staff.branch_id` while preserving normal branch-limited Staff Management browsing.

## Pre-flight Notes

- Required prompt read from the current user message and attached pasted text references.
- Read `.context/CHANGELOG.cmd.md`, `.context/CURRENT_TASK.cmd.md`, `.context/DECISIONS.cmd.md`, `.context/ERRORS.cmd.md`, `.context/HANDOFF.cmd.md`, `docs/ROADMAP.md`, `docs/PROJECT_CONTEXT.md`, and `docs/AGENT_RULES.md`.
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout; documented equivalents under `docs/` are being used.
- Supabase and Supabase Postgres best-practice skill guidance read. Supabase changelog checked on 2026-07-09; relevant current note is that new public tables may not be exposed to the Data API automatically, so the new table must be RLS-protected and access must be intentionally granted/mediated.
- Local Next.js 16 docs under `node_modules/next/dist/docs/` were consulted for Server Actions, Route Handlers, authentication, and data security before code edits. Server Actions are treated as public POST endpoints and must re-auth/re-authorize internally.

## Initial Plan

1. Inspect Attendance QR scan result/action/UI code and CRM Staff Management data/action/UI code.
2. Add a new migration for `staff_branch_change_requests` with RLS, status constraints, FK indexes, and a safe atomic review RPC if needed.
3. Add server-only branch correction query/mutation helpers and thin Server Actions with explicit auth and branch-scope authorization.
4. Add wrong-branch request UI to the public scan recovery screen and a branch correction inbox to CRM Staff Management.
5. Add focused tests for permission/request helper behavior.
6. Run `pnpm type-check`, `pnpm lint`, and `pnpm build`; update context/handoff/changelog and document any errors.

---

# Current Task - BOOKING-ATTENDANCE-BRANCH-SAFETY-001

Status: COMPLETED_DB_VERIFIED
Started: 2026-07-09
Last updated: 2026-07-09

## Description

Fix the CRM Quick Booking availability/recommendation behavior so future, phone, and home-service bookings use scheduled availability instead of requiring checked-in staff, while walk-in-today falls back to scheduled staff with a warning when no eligible staff has checked in.

Fix Attendance QR branch validation so the scanned QR point branch is the source of truth, stale `staff_devices.branch_id` values do not create false wrong-branch blocks, first-scan login/register sets the cookie expected by the scan engine, and returning scans validate the current staff profile against the scanned branch using UUIDs.

## Pre-flight Notes

- Required prompt read from `C:\Users\eleur\.codex\attachments\7d57b7e4-c91e-426d-8e04-a7d45b07d3c2\pasted-text.txt`.
- Read `.context/CHANGELOG.cmd.md`, `.context/CURRENT_TASK.cmd.md`, `.context/DECISIONS.cmd.md`, `.context/ERRORS.cmd.md`, `.context/HANDOFF.cmd.md`, `docs/ROADMAP.md`, `docs/PROJECT_CONTEXT.md`, and `docs/AGENT_RULES.md`.
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout; documented equivalents under `docs/` are being used.
- Supabase and Supabase Postgres best-practice skill guidance read. Local Next.js 16 docs under `node_modules/next/dist/docs/` were consulted for Server Actions, Route Handlers, authentication, and data security before code edits.
- Existing local edits were present before this task in `src/components/features/bookings/quick-booking-form.tsx`, `src/lib/actions/inhouse-booking.ts`, and `scripts/diagnose-attendance-qr.ts`; inspect and preserve them.

## Initial Plan

1. Run safe read-only diagnostics for branches, QR points/devices/staff relationships, and booking availability schema/code assumptions.
2. Inspect the existing booking availability, recommendation, in-house booking, and quick-booking UI flow.
3. Inspect the Attendance scan engine, public scan API/actions, device cookie helpers, first-scan login path, and current database constraints/indexes.
4. Make the smallest code and migration changes that separate booking availability from attendance readiness and harden QR branch validation.
5. Add focused tests for booking fallback/warnings and QR stale-device branch handling.
6. Run `pnpm type-check`, `pnpm lint`, and `pnpm build`; update context/handoff/changelog with exact results.

## Completion Checkpoint - 2026-07-09

Completed:
- Booking auto-assignment now prefers checked-in therapists only for same-day walk-ins. If no eligible checked-in therapist exists, it falls back to scheduled availability and returns the exact warning: `No staff has checked in yet. Showing scheduled availability. Confirm staff presence before starting service.`
- Phone, future, and home-service booking recommendation paths now ignore attendance/check-in status and use schedule/conflict/service capability scoring only.
- Quick Booking surfaces the fallback warning in the success toast while preserving scheduled-slot validation.
- Attendance QR returning scans now validate the current staff branch against the scanned QR branch. A stale `staff_devices.branch_id` is repaired when the staff branch matches the scanned QR branch, instead of blocking as wrong branch.
- Attendance QR first-scan registration now checks authenticated staff ownership before branch validation and repairs stale existing-device branch ids when safe.
- Added migration `supabase/migrations/20260709054954_attendance_device_branch_sync.sql` with a staff-branch update trigger and one-time active-device repair.
- Applied the migration SQL through linked Supabase `db query --file` because `db push` timed out before SQL execution; recorded migration version `20260709054954` in `supabase_migrations.schema_migrations`.

Live DB verification:
- Migration row `20260709054954 / attendance_device_branch_sync / codex`: present.
- Trigger `trg_staff_branch_sync_devices` on `public.staff`: present.
- Active `staff_devices` rows with branch mismatch vs current `staff.branch_id`: `0`.

Verification:
- `pnpm test --run tests/lib/attendance/branch-validation.test.ts tests/lib/assignments/recommendation-engine.test.ts`: PASS, 8 tests.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS, Next.js 16.2.4, 106 app routes.

Notes:
- Safe diagnostics showed the current live wrong-branch scan events for the Main Spa attendance QR involved staff records whose current `staff.branch_id` is Living SM. This patch prevents stale device branch rows from causing false blocks, but staff whose actual current branch is SM will still be blocked by the Main QR unless their staff branch/membership is corrected or cross-branch membership is added.
- `pnpm db:push` and direct `supabase db push` still timed out to the Supabase Postgres pooler from this environment; linked `supabase db query` succeeded and was used for the migration fallback.

---

# Previous Task - ATTENDANCE-DEVICE-REGISTRY-005

Status: COMPLETED_DB_VERIFIED
Started: 2026-07-03
Last updated: 2026-07-03

## Description

Build the Device Registry and Recovery Center backend first, then replace the Attendance Devices tab.

Scope:
- Reuse the existing Attendance tables and scan/device architecture.
- Audit current `staff_devices`, `device_activation_tokens`, attendance events/sessions, activation route, token hashing, device cookie, RLS, and permissions before changing schema.
- Add only the missing database columns/indexes/constraints/RPC needed for one-time device recovery links, device metadata, rename, revocation, pending links, and atomic recovery consumption.
- Implement typed registry queries, server actions, permission checks, and recovery consumption before final UI work.
- Replace only the Attendance Devices tab content with the approved Device Registry and Recovery Center UI.
- Add the staff recovery confirmation screen at `/scan/activate/<token>` without consuming tokens on page load.
- Preserve permanent Attendance QR clock-in/out behavior and service QR behavior.

## Pre-flight Notes

- Required prompt read from `C:\Users\eleur\.codex\attachments\c5b7a049-06d2-49d3-a790-060b34f4ee33\pasted-text.txt`.
- Supabase skill guidance read; Supabase changelog checked on 2026-07-03 for the public-table explicit grant change.
- Local Next.js 16 docs consulted under `node_modules/next/dist/docs/` for Server Actions, Route Handlers, Server/Client Components, and async cookies before editing app code.
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout; documented equivalents under `docs/` are being used.
- The prior database connection task remains below for handoff context. The Supabase DB password pasted earlier must still be rotated outside the repo/session.

## Mandatory Sequence

1. Audit existing Attendance schema and code.
2. Repair or extend the database.
3. Implement backend queries, actions, permissions, and atomic recovery.
4. Test and verify the backend.
5. Replace the Devices tab UI.
6. Implement the staff recovery-link screen.
7. Wire realtime refresh and deep links.
8. Run full verification and update project context.

## Completion Checkpoint - 2026-07-03

Completed:
- Added migration `supabase/migrations/20260703151111_attendance_device_registry_recovery.sql` and applied it to the linked Supabase database.
- Extended the existing `staff_devices` and `device_activation_tokens` model instead of creating duplicate attendance/device tables.
- Added atomic recovery consumption RPC `public.consume_attendance_device_recovery`, granted only to `service_role`.
- Added typed device registry/recovery backend helpers, CRM actions, scan recovery consumption, and generated Supabase types.
- Replaced the Attendance Devices tab with the Device Registry and Recovery Center UI, including filters, selected-device panel, pending recovery links, rename, revoke, recovery-link generation, and staff confirmation screen.

Verification:
- Live SQL probe: migration row, new columns, RPC, and `service_role` execute grant all returned `ok`.
- Live migration-history query also found the earlier local versions `20260703130922`, `20260703144603`, and `20260703145113` present remotely.
- `pnpm db:types`: PASS.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm vitest run tests/lib/attendance/device-recovery.test.ts`: PASS, 3 tests.
- `pnpm test`: PASS, 67 files / 595 tests.
- `pnpm build`: PASS, 105 routes.
- `git diff --check`: PASS, line-ending notices only.

Known limitations:
- `pnpm db:status` and `pnpm db:push` still time out on `aws-1-ap-northeast-1.pooler.supabase.com:5432`; live schema was verified directly through linked SQL instead.
- Authenticated browser QA for `/crm/attendance?tab=devices` and the staff recovery confirmation flow still needs a real CRM/front-desk session and a real phone/browser scan.
- A temporary SQL probe file `tmp-attendance-device-registry-verify.sql` remains untracked because Windows denied deletion and the elevated delete request was blocked by the environment usage limit.

---

# Previous Task - DATABASE-CONNECTION-STABILIZATION-001

Status: BLOCKED_ON_ROTATED_SECRETS_AND_REMOTE_MIGRATION_CONNECTIVITY
Started: 2026-07-03
Last updated: 2026-07-03

## Description

Reset and establish a secure reusable Supabase migration, SQL, and type-generation connection.

Scope:
- Stabilize the project-local Supabase CLI workflow through `pnpm`.
- Keep linked Supabase CLI as the primary migration/type-generation path.
- Keep the transaction-pooler URL only as a local, git-ignored diagnostic and emergency fallback.
- Add reusable database doctor/status/verify/types wrappers that do not contain or print secrets.
- Document database setup, migration, type-generation, verification, fallback, and migration-history reconciliation procedures.
- Do not modify application business logic, reset production data, delete production data, or hardcode credentials.

## Pre-flight Notes

- Read the attached database stabilization prompt, Supabase skill guidance, `.context/*.cmd.md`, `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, `docs/AGENT_RULES.md`, root `AGENTS.md`, and root `CLAUDE.md`.
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout; documented equivalents under `docs/` are being used.
- Supabase changelog was checked on 2026-07-03. Current relevant risks include Data API exposure defaults for new tables, direct DB host IPv6/IPv4 limitations, and pooler/prepared-statement behavior.
- Previous active scheduling repair is preserved below as a handoff; those dirty scheduling files are not part of this database tooling task.
- A Supabase database password was previously pasted in chat and must be treated as compromised until rotated outside this repo/session.

## Initial Plan

1. Audit local Supabase CLI package/shims, pnpm build-script state, stale processes, and link metadata.
2. Add secure environment placeholders and git-ignored local-secret guidance without committing credentials.
3. Create focused `scripts/database/*` wrappers for doctor/status/verify/types.
4. Update package database scripts to use the wrappers and project-local `pnpm exec supabase` workflow.
5. Document the reusable database runbook and context decisions/errors.
6. Run safe verification and report any remaining external blockers.

## Implementation Checkpoint - 2026-07-03

Completed:
- Added secure project-local Supabase wrappers in `scripts/database/`.
- Replaced stale hardcoded database package scripts with reusable `pnpm db:*` commands.
- Added `.env.example` placeholders for Supabase runtime and local-only database tooling variables.
- Updated `.gitignore` so `.env.example` can be tracked while `.env.local`, `.env.database.local`, and `supabase/.temp` stay ignored.
- Added `docs/DATABASE_CONNECTION_RUNBOOK.md`.
- Updated context, decision, error, handoff, project context, and roadmap notes.

Verified:
- `node --check scripts/database/*.mjs`: PASS
- `pnpm db:doctor`: RUNS; exits nonzero because DB password rotation is unconfirmed, `SUPABASE_DB_POOLER_URL` is missing, and linked migration history times out through the Supabase pooler.
- `pnpm db:status`: RUNS; local migration count is 83, remote history read times out, and no remote schema change occurred.
- `pnpm db:verify`: RUNS; linked SQL probe passes and the listed critical tables verify through service-role REST, but pooler fallback warns because `SUPABASE_DB_POOLER_URL` is missing.
- `pnpm db:push -- --dry-run`: RUNS; no remote schema change occurred, but the dry-run cannot connect to the remote migration database path.
- `npx tsc --noEmit --pretty false`: PASS
- `pnpm type-check`: PASS
- `pnpm lint`: PASS
- `pnpm test`: PASS, 66 files / 592 tests
- `pnpm build`: PASS, 105 app routes
- `git diff --check`: PASS, line-ending notices only
- Secret scan: PASS for tracked files and reviewed project placeholders; only placeholder URLs/variable names were found.

Not run:
- `pnpm db:types` was intentionally not run because `db:push --dry-run` is still blocked and generated types should not be refreshed from unreconciled remote schema history.

Remaining blockers:
- Rotate the Supabase database password outside the repo/session; the previously pasted password must be treated as compromised.
- Add the rotated pooler URL to `.env.local` or `.env.database.local` as `SUPABASE_DB_POOLER_URL`.
- Re-run `pnpm db:doctor`, `pnpm db:status`, `pnpm db:push -- --dry-run`, `pnpm db:push`, `pnpm db:types`, and `pnpm db:verify`.
- Reconcile migration-history drift before applying pending migrations.

---

# Previous Task - SCHEDULING-BACKBONE-AUDIT-001

Status: REPAIRED_LOCALLY
Started: 2026-07-03
Last updated: 2026-07-03

## Description

Audit and repair all schedule-dependent operational flows before daily-use simulations.

Scope:
- Produce a scheduling dependency map before broad refactoring.
- Verify canonical schedule precedence across TypeScript and SQL/RPC paths.
- Repair confirmed timezone, group-membership, duration, blocking-status, realtime/cache, resource, dispatch, attendance, and Staff Portal inconsistencies where safe.
- Inspect the full local `supabase/migrations` folder and actual `get_daily_schedule`, `get_available_slots`, and `compute_booking_end_time` SQL definitions before changing schema or RPC behavior.
- Do not create a second scheduling engine, reset production data, regenerate QR codes, or start the large daily-use simulation suite during this task.

## Pre-flight Notes

- Read the attached master prompt, root `AGENTS.md`, `CLAUDE.md`, `docs/AGENT_RULES.md`, `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, and the active `.context/*.cmd.md` files.
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout; the documented `docs/` equivalents are being used.
- Next.js 16.2.4 local docs under `node_modules/next/dist/docs/` were consulted for Server Components, Server Actions/mutations, Route Handlers, and caching before edits.
- Supabase skill guidance was read. Direct Supabase CLI/type-generation remains historically blocked in this environment, so database verification must report exact command results honestly.
- Latest `main` is clean and synced after Attendance feed commit `7cae28f5`.

## Initial Plan

1. Create `docs/SCHEDULING_BACKBONE_AUDIT.md` with the required source/consumer map.
2. Inspect schedule resolver, availability, group rules/memberships, schedule workspaces, timezone helpers, Staff Portal, Attendance, booking duration, resource, dispatch, and SQL/RPC definitions.
3. Repair confirmed high-risk inconsistencies in the lowest shared layer first.
4. Add focused invariant/helper tests before broad simulations.
5. Run available verification and update context/handoff with exact blockers.

## Implementation Checkpoint - 2026-07-03

Completed in this slice:
- Added branch-local `YYYY-MM-DD` helpers in `src/lib/engine/slot-time.ts` and rewired touched Schedule pages, week/full-schedule views, coverage cards, CRM availability, and live timeline status away from UTC/machine-date defaults.
- Repaired Manager and Owner Schedule default selected dates to use branch business date.
- Repaired Full Schedule and Staff Full Schedule modal date navigation/labels to avoid `Date` + `toISOString()` serialization drift.
- Repaired Daily Timeline live status and Schedule Staff Mode summaries for branch-local current time and overnight windows.
- Repaired group-rule fallback lookups in CRM full schedule and assignment recommendations to use mapped plus raw group keys.
- Made group schedule apply fail closed when no explicit staff IDs are supplied.
- Added migration `supabase/migrations/20260703130922_scheduling_rpc_group_overnight_parity.sql` to align `get_available_slots` and `get_daily_schedule` with TypeScript group-key mapping, active booking-hold status semantics, and overnight schedule windows.
- Completed `docs/SCHEDULING_BACKBONE_AUDIT.md` with source map, consumer map, confirmed defects, repairs, SQL/RPC parity, verification, and remaining follow-ups.

Verified:
- `npx tsc --noEmit --pretty false`: PASS
- `npx vitest run src/lib/engine/availability.test.ts tests/lib/schedule/resolve-staff-schedule.test.ts tests/lib/schedule/schedule-timeline.test.ts tests/lib/schedule/daily-timeline-operations.test.ts tests/lib/schedule/daily-schedule-query.test.ts tests/lib/actions/staff-schedule-groups.test.ts`: PASS, 11 files / 79 tests
- `git diff --check`: PASS, line-ending notices only

Remaining follow-ups:
- The new SQL migration has not been applied to the linked database in this pass.
- `compute_booking_end_time` and `get_available_slots` still need a separate schema/API decision for `branch_services.custom_duration_minutes`, because app code/generated types reference the column but local migrations do not define it.
- Overnight date-specific overrides/bookings/blocks remain a schema-level follow-up; this pass repaired overnight schedule windows and local UI/status math.
- Authenticated Schedule browser QA remains pending.

---

# Previous Task - ATTENDANCE-FULL-INTEGRATION-002

Status: IN_PROGRESS - dashboard feed/deep-link slice complete
Started: 2026-07-03
Last updated: 2026-07-03

## Description

Upgrade and fully integrate the existing CradleHub Attendance system without creating a second attendance module.

Scope:
- Preserve existing QR public codes, scan URLs, activation links, device records, scan records, session/check-in rows, correction logic, permission helpers, realtime hooks, QR exports, and print behavior.
- Inspect the existing Attendance QR implementation before adding or changing schema/UI.
- Complete the trusted-device first-scan flow where a staff member signs in once, confirms device linking, receives an HttpOnly attendance-device cookie, and completes the first clock-in without a second scan.
- Keep future registered-device scans automatic while preserving duplicate-scan protection and safe revoked/unknown/wrong-branch handling.
- Add one reusable `AttendanceScanFeedCard` for the CRM Work Queue right rail and Owner overview/dashboard surfaces.
- Add or reuse focused attendance queries, deep links, realtime invalidation, staff profile attendance history, Staff Portal My Attendance, device management, and correction workflows where safely possible.
- Avoid destructive migrations, QR regeneration, production data resets, or edits to previously applied migrations.

## Pre-flight Notes

- Read `.context/CHANGELOG.cmd.md`, `.context/CURRENT_TASK.cmd.md`, `.context/DECISIONS.cmd.md`, `.context/ERRORS.cmd.md`, `.context/HANDOFF.cmd.md`, `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, `docs/AGENT_RULES.md`, root `AGENTS.md`, and root `CLAUDE.md`.
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout; the documented `docs/` equivalents are being used.
- Supabase changelog was checked on 2026-07-03. Relevant current risk remains Data API exposure for new public tables and direct DB/CLI connectivity limitations.
- Existing local verification from the previous checkpoint is green, but `pnpm db:push`/`pnpm db:types` remain blocked by direct DB connectivity and local Supabase CLI path issues.
- The Supabase database password was pasted earlier and must be rotated before production closure.

## Implementation Checkpoint - 2026-07-03

Completed in this slice:
- Added a reusable live `AttendanceScanFeedCard` backed by `qr_scan_events` and `staff_shift_checkins`.
- Wired the card into CRM Work Queue (`/crm/today`) and Owner Overview (`/owner`).
- Added `/api/attendance/recent-scans` for authenticated SWR refresh and Supabase realtime invalidation.
- Added `/owner/attendance` as a branch-aware owner entry that reuses the existing `AttendanceWorkspace` instead of creating a duplicate Attendance module.
- Preserved `/owner/attendance` tab switching on the owner route with the selected `branchId`.
- Added `/crm/attendance?tab=records&staffId=<id>&date=<yyyy-mm-dd>` filter handling, server-side invalid staff/date rejection, row highlighting, and a staff profile link.
- Added focused helper tests for feed record links and badge labels.

Verified:
- `npx tsc --noEmit --pretty false`: PASS
- `npx vitest run tests/lib/attendance/scan-feed.test.ts tests/lib/attendance/tabs.test.ts`: PASS, 2 files / 9 tests
- `npm run lint`: PASS
- `npm run build`: PASS, 105 app routes
- `git diff --check`: PASS, line-ending notices only

Still not complete from the full pasted prompt:
- First-scan trusted-device sign-in/linking flow was not rebuilt in this slice.
- Staff Portal "My Attendance" and staff-profile attendance history were not added.
- Authenticated browser QA still needs a valid CRM/front-desk session.
- `pnpm db:push`, `pnpm db:types`, migration-history repair, and database password rotation remain operational blockers before production closure.

---

# Previous Task - ATTENDANCE-SCHEDULE-LIVE-DATA-001

Status: IN_PROGRESS
Started: 2026-07-03
Last updated: 2026-07-03

## Description

Fix the production Attendance public URL failure and wire CRM Schedule Daily Timeline coverage to fresh live schedule data.

Scope:
- Replace Attendance page-origin resolution from the unreliable browser `Origin` header with a server-only request-origin helper using forwarded host/protocol and host.
- Resolve QR public URLs through `APP_URL`, public URL fallbacks, Vercel production URL, safe request origin, and development-only localhost.
- Keep Attendance non-QR data loading even when QR URL configuration is unavailable.
- Scope QR unavailable state to QR actions only while preserving existing QR point IDs, public codes, versions, resource associations, and scan history.
- Add live SWR-backed Schedule daily data from the existing `/api/crm/schedule` endpoint with no-store responses.
- Centralize Schedule realtime invalidation and remove duplicate display-level subscriptions.
- Correct Coverage Overview scheduled-staff denominator and show regular/single schedule rows when present.
- Preserve timed override shift classification through a nullable `schedule_overrides.shift_type` migration and legacy fallback.

## Pre-flight Notes

- Read `.context/*`, root `CLAUDE.md`, root `AGENTS.md` via session instructions, and `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, `docs/AGENT_RULES.md` because root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout.
- Installed stack is Next.js 16.2.4 and React 19.2.4; local Next.js docs under `node_modules/next/dist/docs/` were consulted for async `headers()`, route handlers, and environment variable behavior.
- Supabase changelog and current Realtime/CLI docs were checked; no new-table Data API exposure work is needed for the nullable column migration, and Realtime Postgres Changes should use one channel with table-specific subscriptions.
- Worktree was already dirty with unrelated Bookings selected-card changes and locked temp files; do not revert or clean unrelated files.

---

# Previous In-Progress Task - BOOKINGS-SELECTED-CARD-REFIT-002

Status: IN_PROGRESS
Started: 2026-07-03
Last updated: 2026-07-03

## Description

Refit only the selected booking right-hand panel in the Bookings module to match the approved compact Selected Booking card mockup.

Scope:
- Keep the booking list, filters, tabs, header, pagination, CRM shell, and workspace layout unchanged except for the selected-panel footprint if needed.
- Preserve existing booking workflow server actions, status transitions, payment controls, notes, service countdown, recommendation logic, permission checks, and modal flows.
- Consolidate duplicated selected-booking details into one compact customer/booking summary.
- Provide one next-best primary action, secondary actions, overflow actions, compact payment and note summaries, collapsed full details, and compact recommendation warnings.
- Use the active-service countdown state in place of normal next actions when a service is running.
- Add focused coverage for next-action selection, overflow action availability, payment/note/full-details behavior, handler invocation, and key booking states.

## Pre-flight Notes

- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout; equivalents in `docs/` plus root `AGENTS.md`, `CLAUDE.md`, and `.context/*` were read.
- Installed stack is Next.js 16.2.4 and React 19.2.4; relevant local Next.js docs under `node_modules/next/dist/docs/` are being consulted before source edits.
- Current branch is `main`; prior Attendance work was committed and pushed. Four locked zero-byte `_tmp_*` files remain untracked and unrelated.

---

# Previous Task - ATTENDANCE-REFIT-005

Status: BLOCKED ON AUTHENTICATED QR VISUAL QA
Started: 2026-07-02
Last updated: 2026-07-02

## Description

Refit the existing CRM Attendance workspace without rebuilding its database, scan engine, service-session engine, device activation flow, or Supabase security model.

Scope:
- Keep `/crm/attendance` as the single Attendance route.
- Keep one client workspace with instant local tabs for Overview, Records, Sessions, QR Codes, Devices, Exceptions, and Reports.
- Remove KPI-card rows from Attendance tabs, especially Overview.
- Reorganize Overview around live staff, recent scans, active sessions, exceptions, and compact quick actions.
- Rework QR Codes toward the approved compact list + selected branded preview design.
- Make Records, Sessions, Devices, Exceptions, and Reports professional compact workspaces.
- Fix the Attendance sidebar icon with `ClipboardCheck`.
- Preserve existing QR public codes, registered devices, scan routes, clock-in/out, room service-start logic, exceptions, records, reports, RLS, and branch access.
- Avoid `router.push`, `router.replace`, `router.refresh`, route links, or redirects for routine tab switching.
- Ensure QR generation actions return typed results and do not surface `NEXT_REDIRECT`.

## Pre-flight Notes

- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout; equivalents in `docs/` plus root `AGENTS.md` and `CLAUDE.md` were read.
- Installed stack is Next.js 16.2.4 and React 19.2.4; local Next docs under `node_modules/next/dist/docs/` were read for Server/Client Components, Server Actions, instant navigation, preserved UI state, and redirect behavior.
- The prior `ATTENDANCE-QR-001` implementation is present as untracked source files in this dirty worktree. Do not revert unrelated user/previous-agent changes.

## Implementation Complete - 2026-07-02

- Rebuilt the Attendance workspace shell into a client-owned instant tab surface.
- Tab switches now use local state plus `window.history.replaceState()` through shared tab helpers; routine tab changes no longer use Next router refresh/navigation or route links.
- Removed Attendance KPI-card rows and replaced Overview with live staff status, recent scan activity, active service sessions, exceptions requiring attention, and compact quick actions.
- Split Records, Sessions, QR Codes, Devices, Exceptions, and Reports into compact professional tab workspaces.
- Reworked QR Codes into a selected-list + branded preview flow with reusable print layouts, export filenames, SVG/PNG/print/copy helpers, QR info, generate missing, generate attendance QR, and deactivate QR.
- Converted Attendance server actions from redirect/status-query patterns to typed `AttendanceActionResult` returns so server-action errors do not surface as `NEXT_REDIRECT`.
- Fixed the CRM Attendance sidebar icon by switching the nav config from missing `QrCode` to supported `ClipboardCheck`.
- Added pure helpers and coverage for tab parsing, QR URL/base URL production guards, print SVG layouts, and export filenames.

## Validation - 2026-07-02

- `npx tsc --noEmit --pretty false`: PASS
- `npx vitest run tests/lib/attendance/tabs.test.ts tests/lib/attendance/qr-url.test.ts tests/lib/attendance/qr-print-layout.test.ts tests/lib/attendance/qr-filenames.test.ts`: PASS, 4 files / 14 tests.
- `npm run lint`: PASS with 4 unrelated existing warnings in `scripts/generate-service-image-assets.mjs` and `tests/components/payroll/employee-payroll-table.test.tsx`.
- `npm run build`: PASS, 104 app routes including `/crm/attendance`, `/scan/[publicCode]`, and `/scan/activate/[token]`.
- `npm test -- --run`: PASS outside sandbox after sandboxed Vite config load failed with Windows `spawn EPERM`; 60 files / 564 tests.
- `git diff --check`: PASS, line-ending notices only.
- Source scan found no Attendance `redirect()`, `NEXT_REDIRECT`, `useRouter`, `router.*`, route `<Link>`, or `window.location` usage in the refit surface.
- Attendance component files are all under 200 lines; largest is `qr-codes-tab.tsx` at 189 lines.
- Final pnpm continuation: `pnpm type-check` PASS, `pnpm lint` PASS with 0 warnings, `pnpm test` PASS (60 files / 564 tests), and `pnpm build` PASS (104 app routes).
- The four previous lint warnings were fixed in `scripts/generate-service-image-assets.mjs` and `tests/components/payroll/employee-payroll-table.test.tsx`; no eslint suppressions, `any`, or `@ts-ignore` were used.

## Follow-up / Limitations

- Authenticated browser QA for `/crm/attendance` tabs and real scan/device flows is still needed; the existing local dev server redirects unauthenticated browser sessions to `/login`.
- Browser smoke via `agent-browser` confirmed `/crm/attendance` redirects to `/login`, the login page renders content, and no Next/Vite error overlay is present.
- Existing QR/database/scan engine caveats from `ATTENDANCE-QR-001` still apply: pg_cron was not installed, migration history may need reconciliation, and `npm run db:types` remains a separate Supabase CLI script repair.
- Final browser QA attempted `/crm/attendance?tab=qr` at 1440, 1280, 1024, 768, and 375 px; every viewport redirected to `/login` because no authenticated Supabase CRM/front-desk browser session is available.
- Blocker screenshots were captured under `.codex-artifacts/attendance-qr-qa/`.
- Real QR interaction checks, phone-camera scans of exported PNG/SVG/print output, and QR identity preservation checks remain pending.

---

# Previous Task - ATTENDANCE-QR-001

Status: COMPLETE LOCALLY; authenticated CRM/browser QR QA remains PENDING
Started: 2026-07-02
Last updated: 2026-07-02

## Description

Build and wire the CradleHub QR Attendance and Service Session system:

- CRM `/crm/attendance` workspace with Overview, Attendance Records, Service Sessions, QR Codes, Registered Devices, Exceptions, and Reports tabs.
- Permanent branch attendance QR and room/resource QR scan flows through public `/scan/*` routes.
- One-time CRM-controlled staff device activation with secure cookie credentials.
- Database schema/RLS/functions for QR points, devices, activation tokens, scan events, attendance exceptions, corrections/settings, and service session authority fields.
- Attendance automation for clock-in/clock-out, duplicate protection, wrong-branch/unknown-device/revoked-device handling, unscheduled exceptions, and active-service clock-out blocking.
- Service-session start flow that reuses existing booking progress/session fields and room/resource assignment rules.
- Server-driven due-session completion where supported.
- Context, architecture, schema, and roadmap documentation updates after implementation.

## Pre-flight Notes

- Root `AGENT_RULES.md`, `PROJECT_CONTEXT.md`, and `ROADMAP.md` are absent in this checkout; the available equivalents are `AGENTS.md`, `.context/*`, `docs/PROJECT_CONTEXT.md`, and `docs/ROADMAP.md`.
- Current branch: `main`.
- Worktree was already dirty before this task, including prior CRM role normalization changes and many schedule/UI files. Do not revert unrelated existing changes.
- Next.js local docs and the Next.js/Supabase skills are being used for route handlers, async cookies/search params, public scan routes, server mutations, Supabase schema/RLS, and security guidance.

## Implementation - 2026-07-02

- Added migration `supabase/migrations/20260702075213_attendance_qr_system.sql`.
- Added QR attendance tables for QR points, staff devices, one-time activation tokens, scan events, attendance exceptions, corrections, and settings.
- Extended `staff_shift_checkins` with schedule/method/scan/metric fields and `bookings` with service-session duration/due/source fields.
- Added RPC `public.complete_due_service_sessions(p_limit integer default 100)`.
- Added server-only attendance helpers under `src/lib/attendance/*` for QR SVG generation, device credentials, timing metrics, workspace queries, and scan processing.
- Added public scan routes `/scan/[publicCode]` and `/scan/activate/[token]`.
- Added CRM workspace `/crm/attendance` with Overview, Attendance Records, Service Sessions, QR Codes, Registered Devices, Exceptions, and Reports tabs.
- Added CRM server actions for creating attendance/room QR points, creating activation links, revoking devices, resolving exceptions, and manually completing due sessions.
- Added CRM navigation/prefetch/agent-prompt entries for Attendance.
- Added `qrcode` and `@types/qrcode`.

## Database Status

- Migration was applied to the linked Supabase project via `supabase db query --linked --file`, then rerun after grant tightening.
- Live catalog verification confirmed all new tables, new booking/check-in columns, the RPC, and RLS/select policies.
- Authenticated grants are SELECT-only on new read surfaces; `device_activation_tokens` has no authenticated grant; anon grants were not present in the checked results.
- `pg_cron` is not installed on the linked project, so the optional cron block did not schedule an automatic job. The RPC is available for manual/server-side execution.
- Because this was applied with `db query --file`, Supabase migration-history tracking may not show the migration as applied. Do not assume `db push` history is reconciled.

## Validation - 2026-07-02

- `npx tsc --noEmit --pretty false`: PASS
- `npm run lint`: PASS with 4 unrelated existing warnings in `scripts/generate-service-image-assets.mjs` and `tests/components/payroll/employee-payroll-table.test.tsx`.
- `npx vitest run src/lib/attendance/time.test.ts`: PASS, 1 file / 3 tests.
- `npm run build`: PASS, 104 app routes including `/crm/attendance`, `/scan/[publicCode]`, and `/scan/activate/[token]`.

## Follow-up / Limitations

- Authenticated browser QA was not run for CRM Attendance or real device scan flows.
- The `db:types` npm script is stale for the current Supabase CLI because it uses removed `--project-ref`; production type generation also exposed unrelated live schema drift, so `src/types/supabase.ts` was restored from baseline and manually augmented for attendance.
- Two zero-byte `_tmp_14412_*` files remain because PowerShell returned Access denied when attempting scoped `Remove-Item -LiteralPath`.

## FK Fix - 2026-07-02

- Fixed `qr_points_branch_id_fkey` failures when dev bypass is enabled.
- Root cause: Attendance server actions preferred `getDevBypassLayoutStaff()` before checking the real staff record, which supplied the zero UUID branch id `00000000-0000-0000-0000-000000000000`.
- Added `src/lib/dev-bypass-server.ts` to resolve dev bypass to a real active branch from Supabase, with optional `DEV_BYPASS_BRANCH_ID` support.
- Updated `getAttendanceActionContext()` to prefer the authenticated staff branch first, then fall back to the resolved real dev branch.
- Updated `getFrontDeskContext()` dev fallback to use the same real branch resolver.
- Added branch existence validation before attendance settings and QR point inserts so future invalid branch ids fail with a clear app-level message instead of a raw FK error.
- Verification: `npx tsc --noEmit --pretty false` PASS; `npm run lint` PASS with the same 4 unrelated warnings.
- Linked DB check confirmed zero UUID branch does not exist and the dev fallback branch resolves to `c1000000-0000-0000-0000-000000000002`.
- `npm run build` was attempted after the fix but did not return before the tool timeout; no build result is available for this follow-up patch.

---

# Previous Task - CRM-SCHEDULE-WORKSPACE-COMPLETION-2026-07-01

Status: COMPLETE LOCALLY; authenticated CRM Schedule QA remains PENDING
Started: 2026-07-01
Last updated: 2026-07-01

## Description

Complete the active CRM Schedule workspace before authenticated QA while preserving the shared administrative booking modal and prior Schedule modal-action work.

Latest attached direction supersedes the older "Front Desk only" wording for visible navigation:

- Primary daily CRM nav target: `Work Queue`, `Bookings`, `Schedule`, `Customers`, `Home Service`.
- Secondary collapsed target: `System Management` with Staff & Access, Services & Providers, Rooms & Resources, Booking Rules, Schedule Management, System Health, and Close Day.
- Do not rebuild stable parts. Stabilization and action reliability are more important than visual polish.
- Keep old CRM routes and redirects alive; this checkpoint is a shell/navigation update, not a page or database rewrite.

## Latest Implementation - 2026-07-01

- Added explicit staff selection state shared by Daily Timeline and Full Schedule; no row is auto-selected from `visibleRows[0]`.
- Updated the Selected Staff card no-selection copy and added active actions for Edit Profile, Edit Capabilities, and View Full Schedule.
- Reused existing staff profile, staff service-capabilities, full schedule calendar, availability editor, block-time, check-availability, and administrative booking modal surfaces from inside `/crm/schedule`.
- Added in-place Edit Capabilities wiring through `StaffServiceEditorSheet` and `updateStaffServicesFromCrmAction`, with `/crm/schedule` revalidation after save.
- Added timeline lane assignment in `src/lib/utils/schedule-timeline.ts` and applied it to Daily Timeline booking blocks so overlapping bookings render as separate vertical lanes.
- Added the Schedule header view toggle:
  - `Daily Timeline`
  - `Full Schedule + Live Bookings`
- Added `src/components/features/schedule/tabs/full-schedule-live-bookings-view.tsx` as a master-detail view with staff list, Day/Week mode, layer toggles, live bookings, shifts, blocks, overrides, no-shift states, and conflict flags.
- Full Schedule booking clicks now open the in-Schedule booking detail panel using the real booking id; they do not navigate away from `/crm/schedule`.
- Permission/RLS audit did not require a new migration. Existing relevant coverage remains:
  - `supabase/migrations/20260529000002_crm_csr_schedule_rls.sql`
  - `supabase/migrations/20260529000003_crm_csr_staff_update_rls.sql`
  - `supabase/migrations/20260617141348_crm_staff_service_capabilities_rpc.sql`

## Previous Implementation - 2026-06-30

- Added shared quick-booking option loaders and customer prefill action:
  - `src/lib/queries/quick-booking-options.ts`
  - `src/lib/actions/administrative-booking.ts`
- Mounted `AdministrativeBookingModalProvider` in the CRM layout.
- Extended `QuickBookingForm` for modal use: prefilled service/staff/date/time, stay-vs-redirect success behavior, cancel/success callbacks, and dirty-state reporting.
- Converted major CRM New Booking triggers to modal buttons across Bookings, Today/Work Queue, Customers, Waitlist, Setup flow cards, direct customer profile, and Schedule header.
- Preserved `/crm/bookings/new` as the direct/legacy full-page route, now backed by the same shared option helpers.
- Added active Schedule modal actions:
  - Add Booking opens the shared booking modal with selected staff/date/time where available.
  - Check Availability opens an in-context availability modal and can hand off selected slots to booking creation.
  - Edit Staff Profile opens the existing CRM staff profile modal after loading full staff data.
  - View Full Schedule opens the existing staff schedule calendar modal.
  - Adjust Staff / Block Staff Time open the existing availability editor, with block-time opening directly on the block form and selected date.
- Converted Schedule quick actions away from old `/crm/staff-availability` deep links inside the Schedule workspace where practical.

## Earlier Implemented Checkpoints

- Completed the interrupted Bookings / Quick Booking checkpoint:
  - Replaced `/crm/bookings/new` with a CRM Quick Booking form for walk-in, phone, future, and home-service modes.
  - Aligned the form, Zod schema, action input, customer upsert, home-service payload, assignment fields, payment state, metadata, and booking insert payload.
  - Preserved the existing `createInhouseBookingMultiAction`; no second booking action was added.
  - Completed Bookings grouping into Needs Action, Upcoming, Active, and Completed while preserving the existing drawer and row actions.
  - Verified authenticated CRM creation for walk-in, phone, future, and home-service bookings against live Supabase data.
- Prior checkpoint simplified visible CRM navigation to `Front Desk`, `Schedule`, `Customers`, `Dispatch`, plus management-only `Admin & Setup`.
- Fixed several misleading Today shell controls: dead `View all`, fake clickable rows, non-functional End of Day tab exposure, Add Follow-up destination, and 24-hour day progress indicator.
- Added richer `getFrontDeskContext()` in `src/lib/queries/crm-context.ts` with user id, role, branch id/name, capabilities, and allowed destinations.
- Replaced duplicated local CRM user/staff/branch lookups in:
  - `src/app/(dashboard)/crm/today/page.tsx`
  - `src/app/(dashboard)/crm/bookings/page.tsx`
  - `src/app/(dashboard)/crm/control/page.tsx`
  - `src/app/(dashboard)/crm/live-operations/page.tsx`
- Dedicated progress log: `docs/FRONT_DESK_REFACTOR_PROGRESS.md`.

## Current Worktree State

Uncommitted changes are present. Do not revert them unless the user explicitly asks.

Changed areas include:

- Schedule workspace completion files:
  - `src/components/features/schedule/workspace/schedule-workspace-header.tsx`
  - `src/components/features/schedule/workspace/schedule-workspace-shell.tsx`
  - `src/components/features/schedule/tabs/daily-timeline-tab.tsx`
  - `src/components/features/schedule/tabs/daily-timeline-selection-card.tsx`
  - `src/components/features/schedule/tabs/daily-timeline-staff-row.tsx`
  - `src/components/features/schedule/tabs/full-schedule-live-bookings-view.tsx`
  - `src/lib/actions/crm-staff-services.ts`
  - `src/lib/utils/schedule-timeline.ts`
- Checkpoint 1 sidebar/nav shell files:
  - `src/components/features/dashboard/nav-config.ts`
  - `src/components/features/dashboard/sidebar.tsx`
  - `src/components/features/workspace/workspace-prefetch-config.ts`
- CRM page/context consolidation files listed above.
- CRM setup/staff/staff-availability gating from the previous checkpoint.
- Dashboard header/sidebar/nav/readiness/workspace-access changes from the previous checkpoint.
- Bookings / Quick Booking files:
  - `src/app/(dashboard)/crm/bookings/new/page.tsx`
  - `src/app/(dashboard)/crm/bookings/page.tsx`
  - `src/components/features/bookings/quick-booking-form.tsx`
  - `src/components/features/bookings/bookings-workspace.tsx`
  - `src/lib/actions/inhouse-booking.ts`
  - `src/lib/validations/booking.ts`
- `docs/FRONT_DESK_REFACTOR_PROGRESS.md` handoff log.

Run `git status --short --branch` before continuing.

## Validation Last Run

- `npm run type-check`: PASS
- `npm run lint`: PASS with 4 unrelated existing warnings:
  - `scripts/generate-service-image-assets.mjs`: unused `FALLBACK_IMAGE_URL`, unused `generationPrompt`.
  - `tests/components/payroll/employee-payroll-table.test.tsx`: two unused `_staffId` warnings.
- `npm run build`: PASS, 103 app routes
- `git diff --check`: PASS, line-ending notices only
- Browser smoke via `agent-browser` on existing `http://localhost:3000`:
  - `/crm/schedule` redirects unauthenticated browser session to `/login`; login page loads with content and no Next.js error overlay.
- Browser console/errors on the unauthenticated smoke route: no page errors; only normal dev/HMR/Speed Insights messages.
- Authenticated CRM Schedule modal/browser flow: NOT RUN in this checkpoint because no authenticated CRM browser session was available.
- `npm run test`: NOT RUN for this checkpoint.

## Next Agent Pickup

1. Read `docs/FRONT_DESK_REFACTOR_PROGRESS.md` first.
2. Inspect current diffs before editing.
3. Do not rebuild the shared booking modal, Schedule modal wiring, or new Full Schedule view from scratch; type-check, lint, and build are passing.
4. Recommended next step is an authenticated CRM browser pass:
   - Open `/crm/schedule` and verify Daily Timeline selection, no-selection disabled actions, Add Booking, Check Availability, Edit Staff Profile, Edit Capabilities, View Full Schedule, Adjust Staff, and Block Staff Time.
   - Switch to `Full Schedule + Live Bookings`, select staff, toggle Day/Week and layers, open a live booking detail, and confirm conflicts/layers render correctly.
   - Save at least one safe staff capability edit only if using a disposable/test staff record.
   - Confirm internal CRM New Booking triggers still open the shared modal and do not navigate to `/crm/bookings/new`.
5. Keep `/crm/bookings/new` alive for direct links, agent fallback, and compatibility.
6. Continue broader Work Queue / Today simplification only after authenticated Schedule QA if possible.

## Current Continuation - ATTENDANCE-SCHEDULE-REPAIR-002

- Status: Code repair and local verification are complete for the Daily Timeline console error and live Schedule data stabilization.
- The prior production `{}` console log is now replaced by contextual logging with branch ID, selected date, message, and development-only stack details.
- The daily schedule query now includes `schedule_overrides.shift_type` and fails loudly on staff metadata, blocked-time, and override query failures instead of silently returning empty data.
- Live DB check succeeded through the transaction pooler; the direct Supabase DB host was unreachable from this environment because it resolved to IPv6 only.
- The live DB already has `schedule_overrides.shift_type` and its check constraint, but Supabase migration history does not show `20260703022600` as applied.
- Verification passed with `npx tsc --noEmit`, `npm run lint`, focused schedule tests, full `npx vitest run`, `npm run build`, and `git diff --check`.
- Remaining infrastructure blocker: fix local pnpm/Supabase CLI first, then rerun `pnpm db:push` and `pnpm db:types` to reconcile migration history and generated types.
- Remaining security task: rotate the Supabase database password because it was pasted into the chat.

---

# Current Task - CRM-BOOKING-FOLLOWUP-STABILIZATION-001

Status: COMPLETED
Started: 2026-07-10
Last updated: 2026-07-10

## Description

Stabilize CRM Today and Booking Follow-up runtime/RLS paths, then finish the operational Change Staff and Reschedule flows without moving an online customer-selected appointment unless staff explicitly reschedules it.

## Completed

- Removed the CRM Today `refreshEtaAction` prop chain from `page -> shell -> dashboard -> panel`; `EtaRefreshButton` now calls `refreshHomeServiceEtaAction` from the stable server-action module directly.
- Repaired inherited Attendance Recovery type-check and lint blockers so the current project can validate.
- Updated manager booking status changes to perform the DB update through `createAdminClient()` after normal session/branch checks, then annotate the latest `booking_events` trigger row.
- Updated CRM follow-up actions to support cancel, friendly RLS-safe UI errors, same-status audit rows, and trigger-event annotation for real status changes.
- Added Change Staff hardening: assignment candidates are re-scored before save, unavailable therapists are blocked, current booking conflicts are excluded from recommendation checks, and reassignment writes metadata plus a `booking_events` audit row.
- Added `rescheduleBookingAction` and `RescheduleBookingModal`: explicit date/time moves validate therapist and room availability, preserve staff unless changed separately, store reschedule metadata/history, insert audit history, and notify the assigned therapist.
- Follow-up `Reschedule` now records the call outcome and opens the real reschedule form instead of showing the old unavailable-flow message.
- Added focused recommendation-engine tests for overlapping booking and Home Service eligibility blockers.

## Verification

- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm test --run tests/lib/assignments/recommendation-engine.test.ts`: PASS, 1 file / 6 tests.
- `pnpm build`: PASS, Next.js 16.2.4, 108 routes.

## Notes

- Existing dirty worktree changes unrelated to this task were preserved.
- `booking_events` remains read-only for authenticated roles; operational follow-up/reschedule/reassign audit writes intentionally go through branch-checked service-role server actions.
- Authenticated CRM browser QA remains recommended for the actual operator flows.
