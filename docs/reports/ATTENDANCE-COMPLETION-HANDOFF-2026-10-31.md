# Attendance completion review handoff — 2026-10-31

## Authority and target

Owner brief: final Home Service remote clock-out access and forgotten clock-out
notices only. Review branch: `fix/attendance-completion-20261031`, based on
verified `origin/main` `3decb4cc35af9da3151e690e118eb386aea7ae1a`.
The final branch head is recorded in the completion report. No merge, push,
deployment, PRODUCTION SQL, live notification generation, or real staff mutation
was authorized or performed.

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

## Verification and unresolved release gates

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
- Local PostgreSQL integration tests — NOT RUN; Docker daemon was unavailable.
  The new migration, RLS, Cron and trigger require a classified TEST/STAGING
  execution and review. No installed Android Staff PWA acceptance test was run.
- Independent review decision: **CORRECTION REQUIRED**. Existing CRM Closing
  reminders can still issue while active work continues because their accepted
  processor has not been replaced. A reviewed shift deliberately left open has
  no demonstrated notice-resolution path. These requirements need a separate
  focused correction or an explicit owner decision before release.

Production impact is zero until a separately approved migration, Cron operation,
merge and deploy. The proposed hourly job could notify only shifts whose
deadline occurs after activation. Rollback: revert the application commit;
unschedule only the verified new job and remove the activation row if enabled.
A database rollback of the new completion trigger, policies, function, indexes
and tables needs its own reviewed script. Keep the four Closing jobs and all
canonical attendance records intact.

**Next permitted action:** independent re-review, classified TEST/STAGING
database verification and mobile viewport QA on the branch. **Not authorized:**
production SQL, enabling the new job, merge, deployment, or declaring
attendance training-ready.
