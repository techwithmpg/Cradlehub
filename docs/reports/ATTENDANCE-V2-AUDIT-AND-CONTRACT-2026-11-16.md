# Attendance V2 — truth audit and policy contract

Date: 2026-11-16. Status: **LOCAL IMPLEMENTATION / INDEPENDENT REVIEW PASS; RELEASE ACCEPTANCE PENDING**.

## Authorization and baseline

Repository: `techwithmpg/Cradlehub` (Web only).
Branch: `stage/web-attendance-v2-automation-20261116`.
Isolated worktree: `E:/cradlehub/.worktrees/web-attendance-v2`.
Verified fetched `origin/main`, remote `refs/heads/main`, and initial HEAD:
`a9ff58e9da53bc10a71a714839ce6d77dc895bb0`.
Accepted main later advanced to `6c5380e96290edd93077b1c6a318e537f89453e3`;
that accepted history was merged into the isolated branch before final checks.

The owner's Attendance V2 brief authorizes controlled repository implementation
and LOCAL/TEST verification, subject to investigation, policy freeze and review.
It does not authorize production SQL/data, RLS/Auth changes, Cron activation,
deployment, push to production, or merge. It specifically requires identification
of unresolved policy choices before changes that could affect payroll.

Read AGENTS.md, AI_CONTEXT.md and the Web governance manifest. The latest owner
instruction supersedes older attendance-only scope restrictions for this slice;
the production and release gates remain binding. Other registered Web worktrees
include Boutique, public preview and image work. Their work is preserved. The
root main worktree was four commits ahead with untracked image directories; none
of those commits/assets is incorporated into this branch. No other registered
worktree had this V2 branch. This is a repository worktree inventory, not proof
that all external/concurrent work has stopped.

## Evidence boundary

All implementation findings below are **VERIFIED REPOSITORY FACT** at the base.
Prior handoffs about production are **REPOSITORY-RECORDED PRODUCTION EVIDENCE**,
not current live verification. The aggregate open-session observations and
reproduction supplied in the owner's brief are dated owner-supplied evidence.
No customer/staff rows, production catalogs, Cron runs or project configuration
were queried in this pass. `lsrbwqhvzjfpiabeolkv` is classified **PRODUCTION** by
the brief and repository records. It is excluded from mutation and test work.

## A. Dependency and safety map

| Concern | Existing authority | V2 implication |
| --- | --- | --- |
| QR/device/identity | `src/lib/attendance/scan-engine.ts`, public-scan route, registered devices, branch/geofence validation | Retain all checks and the device limit; early arrival grants no new identity/branch authority. |
| Schedule/intent | `clock-in-authority.ts`, `attendance-intent-engine.ts`, schedule resolver, `shift-instance.ts` | Current ordinary earliest insert is 60 minutes before start. Effective window, source ID, timezone and business date must be preserved. |
| Canonical scan write | `commit_attendance_scan_transaction` (latest repository definition in `20260821023717_fix_attendance_function_ambiguity.sql`) | Reuse request replay, staff locking, event/result persistence and transaction; do not insert client-authored attendance. |
| Insert invariant | `20261109120000_attendance_qr_clockin_window_guard.sql` | BEFORE INSERT independently requires weekly/override source, start/end, and the 60-minute boundary. Changing a TS constant alone cannot implement V2. |
| Session identity | `20260712035222_attendance_autonomy_hardening.sql` | Nonvoided shift-instance/legacy unique indexes include branch and test mode. They do not establish a global cross-branch open-session invariant. |
| Dynamic work deadline | `recalculate_attendance_clock_out_policy` in `20260715021703_attendance_smart_dynamic_clock_out.sql` | Reuse its category rules, versioned values, schedule overrides, booking assignment evidence and buffers. Strengthen evidence where necessary; do not add another policy engine. |
| Lifecycle reevaluation | Booking/schedule/policy triggers in the same migration | Service completion reevaluates policy; it is not employee clock-out. Existing booking/schedule locks participate in attendance coordination. |
| Raw worked minutes | `time.ts:computeAttendanceMetrics`, portal/correction/review/stale/reconciliation SQL | TS uses actual in/out duration; multiple SQL writers independently calculate duration. All writers must adopt one credited contract together. |
| Closing automation | `process_due_attendance_closing_interventions`, Closing interventions, provisional reconciliation RPC | Existing auto-close stores synthetic `checked_out_at`, method `system_auto_close`, null scan ID, confirmation-required flag. Existing consumers already distinguish it using these fields; V2 must expose actual scan separately. |
| General reminders | `20261031074004_staff_clock_out_reminders.sql` | Activation-gated batches (1–100), row locks/SKIP LOCKED, dynamic recheck, completion/review resolution triggers. One lifetime notification key per checkin; not a five-minute repeat system. |
| Closing reminder guard | `20261031074005_crm_closing_reminder_eligibility.sql` | Fresh policy and assignment checks for the reminder stage. Do not assume this same guard covers every auto-close path. |
| Cron ownership | `supabase/operations/configure-attendance-closing-cron.sql`, `enable-staff-attendance-reminders.sql` | Four Closing jobs at fixed UTC times; separate proposed hourly general job at minute 7. Preserve historical files and verify installed definitions before release. |
| Push | `notifications/push/delivery.ts`, `workflow-notifications-store.ts`, service-transition outbox | JS notification creation invokes push; SQL insertion in the reminder processor does not invoke that JS path. Reuse delivery adapter and durable claim/finish pattern, with attendance-specific eligibility and delivery audit. |
| Staff/CRM readers | `staff-portal/attendance.ts`, attendance queries/day model/realtime merge, History/records UI | Existing readers assume stored worked minutes or uncapped live elapsed time. Need explicit credited/preliminary state and delayed/reconnect reconciliation. Preserve Today/Review/History/Setup. |

### Confirmed gaps

1. A scan 66 minutes before a 13:00 shift fails the current TS and SQL 60-minute
   boundary. This is expected under the existing policy; the V2 policy must
   supersede both guards deliberately. Raising the limit alone would grant raw
   early worked minutes and would not prove presence at shift start.
2. `recent-scans-map.ts` takes shift type only from the linked checkin;
   `recent-scan-event.ts` takes it only from the public result. A captured event
   without a session can contain `metadata.schedule.shiftType` or
   `metadata.shiftInstance.shiftType` and still show no shift label.
3. `day-model.ts` and `attendance-workspace-realtime-merge.ts` calculate open
   elapsed minutes from check-in to now without capping at authorized end.
   `computeAttendanceMetrics` itself returns zero for an open session; the
   uncapped display counter is a separate consumer gap, not proof that stored
   payroll minutes accrue continuously in production.
4. The general reminder proposal uses `staff-clock-out-reminder:<checkin>` once,
   without interval identity, first-deadline-plus-five cadence, or push outbox.
   Stored notice and `notification_sent_at` are not phone delivery evidence.
5. The dynamic resolver falls back to the next business-day boundary when the
   schedule end is missing. That fallback cannot justify automatic payable time
   or safe V2 historical closure. Unknown end must require review.
6. Existing dynamic candidate completion may use `session_due_at` or scheduled
   end. Those estimates must not be treated as independently verified actual
   service/travel completion or overtime authorization.
7. Existing ordinary provider final-client release can precede shift end when
   enabled; Closing policy uses branch in-spa booking completion. Preserve
   configured behavior for release eligibility, but neither spa last booking
   nor completed service alone proves the end of authorized staff duty.
8. Current advisory keys contain branch/staff/test. A new global staff invariant
   needs coordinated lock order across scan, correction, booking/schedule and
   automation writers; frontend checks and existing per-branch uniqueness are
   insufficient proof against cross-branch races.
9. Existing provisional reconciliation chooses current business-date candidates;
   a previous-day late scan must not silently extend yesterday's pay or consume
   today's clock-in. Ambiguous attribution requires review.

### Worked-minute consumer inventory

`rg` inspection found these source consumers/writers; this is source tracing,
not payroll acceptance or live data reconciliation:

- `src/lib/attendance/time.ts`: raw duration, lateness, early leave, overtime.
- `scan-engine.ts`: QR result and transaction metric payloads.
- `attendance-correction-service.ts`: correction metric payloads.
- SQL scan, portal, stale recovery, corrected-times, scan-review, provisional
  reconciliation and Closing auto-close functions: persisted minutes.
- `queries.ts`, `types.ts`: projection/mapping of persisted minute fields.
- `day-model.ts`, `attendance-workspace-realtime-merge.ts`: open elapsed counters.
- `reports.ts`: Daily Attendance and Payroll Export. Export labels all stored
  minutes approved unless an open exception belongs to its finite ambiguity
  set; it does not independently reject provisional/unconfirmed closure.
- `staff-portal/attendance.ts`: history/self-service mapping.
- `recent-scans-map.ts`, `recent-scan-event.ts`: scan-result worked-minute display.
- History view, records tab and staff-day repair panel: durations and totals.
- `src/lib/payroll/fixed-monthly.ts` and `src/lib/queries/payroll.ts`: inspected
  fixed-monthly payroll path has no direct `staff_shift_checkins`/`worked_minutes`
  dependency. Attendance export remains a separate payroll-facing surface.

## B. Approved contract and implemented scope

The latest owner correction approves **one scan within 120 minutes before shift
start**. It explicitly supersedes the earlier second-scan proposal. Arrival is
recorded at its actual timestamp; credited time starts at scheduled shift start.
There is no second-scan requirement and no fabricated presence event. The early
scan still does not prove continuous presence: the scheduled-time credit is the
owner-approved assumption, remains preliminary while open/provisionally closed,
and is bounded by verified departure, authorized work evidence and corrections.

For the reproduction: 11:54 arrival, 13:00 credited start, 20:00 ordinary end,
420 credited minutes after an ordinary verified 20:00 departure. A 13:15 arrival
starts credit at 13:15. A departure before 13:00 credits zero. More than 120
minutes early, missing/conflicting schedule, unauthorized branch/QR or device
identity never grants attendance eligibility. No device-limit change.

The existing canonical session retains `checked_in_at` as arrival. An additive
`attendance_policy_snapshot.v2` object carries credited start/end, authorized end,
actual physical/portal clock-out, preliminary/final/review state, reason and a
monotonic revision. Existing `worked_minutes` is normalized at the database write
boundary for V2 rows, covering QR, portal, review/correction, stale recovery and
provisional reconciliation writers. Historical rows are not enrolled/backfilled.
Open persisted minutes remain zero; live preliminary counters use the same
extended `computeAttendanceMetrics` contract and stop at the evidenced bound.

A system closure retains the established legacy `checked_out_at` compatibility
field with `clock_out_method=system_auto_close`, no QR scan ID, and confirmation
required. Its V2 actual clock-out remains null. History shows provisional closure
and the separate credited period. A manual reviewed end can finalize credit
without claiming a physical employee scan. Late physical departure beyond the
justified bound is retained as actual evidence and creates an actionable
working-time review issue rather than automatically granting overtime.

### Due-work and delivery ownership

The candidate forward migration creates three private processing tables
(control, due work and push delivery), not another attendance ledger. The schema
has no browser-role access. Public worker RPCs revoke PUBLIC/anon/authenticated
execution and grant only service_role. No existing RLS or Auth policy changes.
Activation defaults to null. The server also requires the explicit
`CRADLEHUB_ATTENDANCE_V2_ENABLED=true` switch; no unrestricted Setup toggle.

One bounded processor selects indexed due state, takes the established
branch/staff advisory lock before the session row, skips locked rows, and
rechecks dynamic assignments. Existing canonical staff-row locking also
serializes cross-branch inserts. Conflicts retain a scan/review outcome; request
replay is identity-bound. Cross-device rapid retries cannot turn an arrival into
a departure. Repeated closed-shift scans are no-ops in V2. Delayed realtime rows
with older V2 revisions cannot reopen the visible record.

First reminder is due five minutes after the eligible deadline, then every five
minutes. Session/deadline-generation/interval keys and durable work progress
prevent duplicate interval notices even after notice resolution. Catch-up sends
only the current interval, never all missed intervals. Completion resolves
notices, suppresses outstanding deliveries and removes due work atomically.
The message is “Cradle Attendance” / “Your shift has ended. Please scan to clock
out.” Delivery records distinguish queued, attempted, provider-accepted, failed
and suppressed; attempt history and accepted endpoint IDs survive retries.
Provider acceptance does not prove device display or employee receipt.

The transport reuses existing Staff PWA/web-push delivery. The protected POST
`/api/attendance/automation` performs due work and bounded push draining. A
separate, unapplied operation proposes one Supabase Cron HTTP invocation each
minute, with Vault references rather than embedded secrets. No Vercel Attendance
Cron is added. Four existing Closing job definitions stay unchanged. A guarded
forward Closing processor excludes only enrolled V2 rows when its explicitly
approved ownership handoff is enabled; legacy rows retain existing stages.
The historical hourly proposal and its RLS edits are not replayed/applied.

Active service and upcoming assignment evidence defer reminders/closure.
Verified completion plus existing configured cleanup/Home Service/driver-return
buffers extends the justified end; scheduled due estimates alone do not justify
additional payable time. Approved schedule-end changes remain authoritative.
Front Desk cash custody, closed-at and outgoing handover evidence are read from
the existing cash lifecycle, independently of branch booking completion. Ongoing
cash custody prevents midnight closure. Driver return uses the established
booking-completion plus configured buffer contract; a separate actual
return-to-branch timestamp is not present in the inspected model.

At branch-local midnight or later catch-up, an ended ordinary V2 shift with no
active/upcoming duty can be provisionally closed at its justified end. A 01:00
shift stays open at 00:00. The processor writes a system correction audit,
preserves unknown physical departure, stops reminders, and creates no new shift.
Manual corrected/open records leave automation ownership. Row locking and
rechecking prevent an automated closure from overwriting a concurrent manual
correction. Missing work evidence is retained for authorized review with a
machine-readable reason; historical unknown-end records remain untouched.

### Focused interface and report changes

Today/Review/History/Setup structure remains intact. Today and Staff history
explain early arrival, working, authorized extension, overdue, provisional and
completed states. Scan feeds recover a known shift label from retained schedule
metadata even without a checkin. History separates arrival, credited period and
actual clock-out, including reviewed times with no physical scan. Routine early
arrivals/duplicates and safe provisional closures do not create routine Review
items; uncertain/disputed credit does. Payroll Export adds credit state and
credited/actual fields and excludes preliminary, unconfirmed or malformed V2
credit from approved payable totals. The fixed-monthly payroll engine is unchanged.

## C–F. Evidence and remaining release gates

See [the handoff](ATTENDANCE-V2-HANDOFF-2026-11-16.md) for exact commands, results,
changed paths, implementation head and limitations. The classified LOCAL TEST
harness uses PostgreSQL 17.11, a synthetic schema, exact accepted policy/scan and
booking-lifecycle functions, and the candidate migration. It tests state, audit,
request/interval replay, independent connections, manual correction and service
completion races. It is not Supabase Auth/RLS/PostgREST deployment parity.

Required-scenario coverage: early/start/late/window/schedule and payable export
are calculation/unit plus database tests; duplicate/concurrent/multiple-open,
reminder cadence/completion, service/cleanup/Home Service/overnight, midnight,
late reconciliation, correction races and retry mutations have database-state
assertions. Push failure has durable SQL attempt evidence plus mocked transport
tests. Two-device limits and wrong-branch/QR controls retain existing unit/route
coverage. Reconnect uses existing resilience tests and an added delayed-revision
merge test. No authenticated browser submission, installed PWA, actual phone
push, real payroll reconciliation or production Cron execution was performed.

The subsequent [independent re-review](ATTENDANCE-V2-INDEPENDENT-REVIEW-2026-11-16.md) passed after test/reliability corrections; final 671 affected tests and 39 LOCAL database scenarios pass. See the current [handoff](ATTENDANCE-V2-HANDOFF-2026-11-16.md). Before release: verify exact installed
function/trigger/index/grant prerequisites (including prior reminder helper
schema) without replaying historical migrations; verify current branch timezones,
four Closing jobs and no competing hourly owner; test the migration and ownership
transition on classified Supabase TEST with actual role/recipient access; finish
authenticated browser, device, notification and payroll acceptance; retain the corrected scanner contract and obtain owner release approval. No production migration, marked-applied change, backfill, Cron
activation, push, merge or deployment is authorized by completion of this pass.

Rollback must stop the new job and disable its database/application activation
before application rollback. Keep due/delivery audit, credited snapshots and
payroll finalization checks. Do not drop evidence or restore raw-duration pay
for V2 records. Restoring legacy Closing ownership or removing database guards
requires a separately reviewed operation after reconciling open V2 work. The
candidate activation operation is deliberately separate from migrations/deploy.

Official platform references checked for the proposed schedule/transport:
[Supabase Cron](https://supabase.com/docs/guides/cron),
[pg_net](https://supabase.com/docs/guides/database/extensions/pg_net), and
[Vault](https://supabase.com/docs/guides/database/vault). These documents do not
prove that any extension, secret or schedule is installed on the target project.
