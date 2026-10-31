# Attendance completion review handoff — 2026-10-31

## Authority and target

Owner brief: final Home Service remote clock-out access and forgotten clock-out
notices only. Review branch: `fix/attendance-completion-20261031`, based on
verified `origin/main` `3decb4cc35af9da3151e690e118eb386aea7ae1a`.
The final branch head is reported at handoff. At the initial review, no merge,
push, deployment, PRODUCTION SQL, live notification generation, or real staff
mutation had been performed. This correction pass authorizes a candidate branch
push after local checks; it does not authorize a merge or deployment.

The connected Supabase project `lsrbwqhvzjfpiabeolkv` is classified
**PRODUCTION** by repository records and the matching linked project ref. No
classified LOCAL, TEST, or STAGING database was available. Read-only production
catalog evidence on 2026-10-31 showed all four existing Closing jobs active
with their recorded schedules; both canonical portal and Closing processor
functions exist. Fourteen live open records had passed a stored latest-normal
deadline (four within 24 hours, eight within 72 hours). This is aggregate
evidence, not a migration or workflow acceptance test. Historical migration
versions were absent under the queried file versions, so live function/job
catalog checks must be repeated before any deployment.

## Implementation prepared for review

- Canonical `/staff/attendance`, the legacy attendance page it delegates to
  for other roles, and therapist/driver mobile home screens render the existing
  `StaffAttendanceClockOut` using server-provided availability. The button
  calls the existing `clockOutFromStaffPortalAction`, which delegates to
  `commit_attendance_portal_clock_out`. The client sends no staff, branch,
  attendance, assignment, timestamp, or eligibility value.
- The read-only attendance snapshot now prioritizes an open prior-business-date
  record after midnight. Success displays the recorded clock-out time, refreshes
  state, and prevents a second tap; rejection and network failure remain visible.
- A proposed additive migration adds an activation-gated, bounded personal
  reminder processor using the dynamic policy's latest-normal time and fresh
  assignment revalidation. It excludes Training/Test records, targets one staff
  recipient, prevents repeat notices for the shift, rotates blocked due rows
  behind unexamined rows, and resolves notices when the canonical record closes.
  Recipient and branch RLS is added for legacy role/workspace combinations.
- A separately reviewed operation would add one hourly staff reminder job.
  The four existing CRM Closing jobs, their names, schedules and commands stay
  untouched. The new PWA copy applies only to the new reminder dedupe key;
  existing CRM Closing notices keep generic copy.

## Initial review evidence (superseded by the final correction pass below)

- `pnpm type-check` — PASS in the isolated worktree after linking the existing
  dependency tree.
- Focused Vitest command covering clock-out interaction, notice routing and
  existing dynamic/Closing contracts — 5 files, 132 tests PASS.
- Scoped ESLint on changed TypeScript/TSX — PASS.
- Full `pnpm lint` — FAIL on one pre-existing unrelated
  `tests/components/cash-flow/cash-flow-today-operations.test.tsx:162`
  explicit-`any` error (26 additional warnings).
- Default `pnpm build` — blocked by Turbopack rejecting the isolated
  worktree's external `node_modules` junction.
- `pnpm exec next build --webpack` — compiled successfully and completed
  TypeScript, then failed during static prerender because this isolated
  worktree has no Supabase URL/environment configuration. No PRODUCTION
  credentials were copied into it for the build.
- Local PostgreSQL integration tests were not available at the initial review;
  the final correction pass below supplies isolated TEST execution. No installed
  Android Staff PWA acceptance test was run.
- Initial independent review: **CORRECTION REQUIRED** for the active-work and
  reviewed-open paths. The final correction pass below addresses both.

Production impact is zero until a separately approved migration, Cron operation,
merge and deploy. The proposed hourly job could notify only shifts whose
deadline occurs after activation. Rollback: revert the application commit;
unschedule only the verified new job and remove the activation row if enabled.
A database rollback of the new completion trigger, policies, function, indexes
and tables needs its own reviewed script. Keep the four Closing jobs and all
canonical attendance records intact.

The initial review required independent re-review, classified TEST/STAGING
database verification and mobile viewport QA on the branch. Production SQL,
enabling the new job, merge, deployment and declaring Attendance training-ready
remain outside this correction pass.

## Final correction scope — owner authorized

The accepted `process_due_attendance_closing_interventions` reminder stage
currently selects an open CRM Closing record using its stored
`clock_out_reminder_at` and can issue a notification without rechecking live
assignment evidence. The existing dynamic policy resolver already returns the
current deadline plus `has_active_assignment` and
`has_upcoming_assignment`; it covers in-spa work for CRM Closing shifts and
Home Service and driver assignments for their categories.

Proposed exact change to the established Closing workflow: after the reminder
stage locks a due open record and before it creates an intervention or
notification, call `recalculate_attendance_clock_out_policy` for that record
at the processing time. Defer the reminder if the recalculated reminder
deadline is still in the future, an active assignment exists, or an upcoming
assignment exists. Fail closed if the resolver cannot establish eligibility.
The next scheduled or catch-up pass may reconsider the record. Keep the same
dedupe key, intervention and notification writes, escalation, provisional
close, catch-up delegation, and four existing job definitions. The owner
explicitly authorized this scoped change in the 2026-10-31 final correction
pass before implementation. The guard also checks branch Home Service booking
state so an active service or upcoming dispatch defers CRM Closing reminders.

The same pass resolves an open reminder when a linked `missed_checkout` exception is
reviewed and kept open. Resolution records the reviewer and exception in the
notification metadata and does not change the Attendance record. An already
reviewed linked exception blocks a new personal or CRM Closing reminder.

## Final correction evidence and release status

- `origin/main` advanced from the initial accepted
  `3decb4cc35af9da3151e690e118eb386aea7ae1a` to
  `04f0abadc01f2d76f1724729dc3c41e42a0894e4` during this pass. The latter
  was merged into the correction branch with no conflict; its cash-flow change
  is unrelated to Attendance.
- The CRM Closing reminder stage now rechecks the authoritative dynamic
  deadline and assignment flags under the attendance row lock. It also checks
  branch Home Service activity and upcoming dispatches within the Attendance
  business-day window. A bounded pass rotates examined rows so active shifts
  cannot starve later due staff. Manager escalation, auto-close, catch-up,
  notification dedupe, and the four original job definitions are unchanged.
- Only a linked `missed_checkout` exception reviewed by an authorized CRM or
  manager resolves an open reminder. The notification stores the reviewer,
  exception ID and resolution reason; the shift remains open with original
  timestamps. Review before delivery suppresses the reminder. Later clock-out
  or provisional close resolves it through the completion trigger without
  altering payroll or confirmation fields. The CRM branch-wide notification
  policy excludes new personal reminders; recipient RLS covers them.
- Classified target: **LOCAL TEST**, native PostgreSQL 17.11 on loopback
  `127.0.0.1:55432`, database `attendance_test`, synthetic schema and records.
  The official EDB binary archive SHA-256 was
  `80379B2C04D51C30225532E0AE04509899141E9957ED096FE749D7FD9DF8F82F`.
  Command: `psql -q -h 127.0.0.1 -p 55432 -U postgres -d attendance_test
  -v ON_ERROR_STOP=1 -f tests/database/attendance-reminders-integration.sql`.
  Exit **0** and final output `attendance reminder TEST integration passed`.
  The script executed both proposed migrations and the separate Cron operation,
  then verified active/upcoming work, moved deadline, next-day boundary,
  51-row starvation, reviewed and unrelated exceptions, duplicate prevention,
  canonical timestamps, provisional confirmation, processor grants, recipient
  RLS, and four-job preservation. A second operation run failed its duplicate
  preflight as expected and left five jobs total. The test policy resolver and
  schema are stand-ins; this is not a full Supabase clone or PRODUCTION proof.
- Read-only PRODUCTION catalog checks confirmed the referenced columns/types,
  existing CRM policy names, no notification INSERT RLS policy, and the
  established processor. No customer/staff rows, credentials, or SQL writes
  were copied to or applied against the local target.
- `pnpm type-check` — PASS after reconciling main. Scoped ESLint — PASS.
  Focused Vitest — 6 files, 93 tests PASS after reconciling main, including
  the unrelated new main cash-flow export test and mocked `/staff/attendance`
  therapist (375px) and
  driver (390px) route states, server refusal, QR-only and network failure.
  These are viewport simulations, not rendered installed-PWA acceptance.
- Canonical clock-out, pure attendance reader and geofence regressions — 3
  files, 75 tests PASS after reconciling main.
- Full `pnpm lint` — baseline FAIL: the unrelated cash-flow test at
  `tests/components/cash-flow/cash-flow-today-operations.test.tsx:162` has one
  explicit-`any` error; 26 warnings remain. No attendance lint error.
- `pnpm exec next build --webpack` after reconciling main, with isolated
  loopback Supabase URL and placeholder test keys — exit **0**; compiled,
  TypeScript checked and
  generated all static pages. Static data fetches reported expected connection
  failures because no Supabase API ran at the placeholder URL. The default
  Turbopack build remains blocked by the worktree's external dependency
  junction. This is build evidence, not production runtime verification.
- Independent read-only review: no remaining P0/P1 SQL finding, but **CORRECTION
  REQUIRED for release** until installed authenticated therapist/driver PWA
  acceptance, owner gate, and production migration/Cron review. The reviewer
  did not independently rerun the local SQL command.

### Remaining manual acceptance

On an owner-approved TEST/STAGING PWA with test identities, check both therapist
and driver at 375px and 390px: eligible final Home Service/trip shows the
clock-out button; active or upcoming work and QR-only states do not; a server
rejection and network failure are visible and retryable; a successful action
records one canonical timestamp and removes the button after refresh; the
staff notice is visible only to its recipient and disappears on review or
completion. Test an installed Android PWA after midnight and a real device
reload. Confirm the four Closing jobs and the new hourly job only in an
approved release window. No classified TEST/STAGING URL or accounts were
available for this pass, per owner response.

### Rollback

Before activation, revert the branch commit and leave the database unchanged.
After an approved release, unschedule only the verified new hourly job, remove
its activation row, restore the prior CRM Closing processor and CRM notification
policies from the accepted migration definitions, and drop only the new review
and completion triggers/functions plus reminder tables/indexes under a reviewed
rollback migration. Preserve the four existing jobs, attendance records,
clock-in/out timestamps, corrections and payroll data.
