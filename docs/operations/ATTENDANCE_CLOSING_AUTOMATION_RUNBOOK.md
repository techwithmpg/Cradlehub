# Attendance Closing Automation Runbook

The four jobs are intentionally not installed by application deploys. An operator must verify the production project and run the configuration SQL deliberately.

## Prerequisites

- The target is the verified CradleHub production Supabase project.
- Migration `20260715012424_attendance_hybrid_closing_automation.sql` is applied.
- All active branches use `Asia/Manila`; the database timezone is UTC.
- A current database backup and an approved rollback window exist.

## Extensions and secrets

Enable `pg_cron`. These jobs call `public.process_due_attendance_closing_interventions` directly and therefore require no HTTP endpoint, Vault value, service-role key, or other secret. Never place secrets in `cron.job.command`.

## Verify and install

1. Run `supabase/operations/verify-attendance-closing-cron.sql` read-only and archive the result.
2. Confirm the function exists, its grants are restricted, and the four intended names have no duplicates.
3. Review `supabase/operations/configure-attendance-closing-cron.sql`, verify the project identity again, then run it in one transaction.
4. Rerun the verification SQL. Exactly four intended jobs must be active with schedules `15:00`, `15:30`, `16:00`, and `16:10` UTC.

## Test mode

Use only dedicated Attendance test-mode rows. Set bounded deadlines due in the test window, invoke each processor mode manually inside a rollback transaction, and verify notifications, workflow tasks, provisional close evidence, idempotent replay, and zero live-row effects. Do not alter real staff records to make a test due.

## Disable and re-enable

Disable a job with `select cron.alter_job(<jobid>, active := false);`. Record the incident and job IDs. Re-enable with the same function and `active := true` only after the cause is resolved. Do not update `cron.job` directly.

## Failures and observability

Run the verification SQL and inspect `cron.job_run_details`. Check the latest status and bounded return message, then correlate application notifications/workflow tasks and database logs. Do not copy secrets or customer data into incident tickets.

## Rollback

Disable all four jobs first. If removal is required, call `cron.unschedule(jobid)` for only the verified job IDs. The configuration transaction preserves unrelated jobs. Roll back the processor migration only under its documented database rollback plan; never rewrite applied history.

## Production activation checklist

- [ ] Project identity and environment confirmed
- [ ] Backup and rollback owner confirmed
- [ ] Required migration verified in live history
- [ ] UTC database and Asia/Manila branch timezones verified
- [ ] Function owner, search path, ACL, and idempotency reviewed
- [ ] Test-mode processor checks passed
- [ ] Exactly four jobs active with expected schedules and commands
- [ ] First production executions monitored and archived
- [ ] Attendance enforcement remains explicitly configured

## Proposed staff-wide reminder activation

Keep the four Closing jobs and their schedules. Before enabling the proposed
hourly staff reminder, verify a classified TEST/STAGING run of the additive
migration, reminder eligibility, deduplication, recipient RLS, overnight dates,
manual-correction resolution, and a >50-row blocked-work batch. Confirm the
production migration body independently of historical version drift.

After separate owner approval, apply only the reviewed reminder migration,
verify its function ACL, trigger and partial indexes, then run
`supabase/operations/enable-staff-attendance-reminders.sql` in a reviewed
window. The operation inserts the activation time and creates exactly one new
`attendance-staff-clock-out-reminder` job at minute 7 of each hour. Verify all
four existing Closing jobs are still active and unchanged, plus the fifth job's
command and first runs. No manual invocation against live open staff records is
part of testing.

For rollback, use `cron.unschedule(jobid)` only for the verified new job ID,
then delete the singleton activation row. Leave the four Closing jobs alone.
If the migration itself must be rolled back, separately review the trigger,
function, policies, indexes and reminder state before dropping them.
