# Attendance Closing Automation

## Architecture

CradleHub closing Attendance uses a hybrid event-driven and database-scheduled
design:

1. A CRM/CSR closing clock-in inserts the normal `staff_shift_checkins` record.
   The existing `snapshot_attendance_policy` trigger stores the effective branch
   policy and absolute reminder, escalation, hard-cutoff, and provisional
   clock-out timestamps on that record. It does not create pending intervention
   rows.
2. A real clock-out atomically changes the record from `checked_in` to
   `checked_out`. That status change naturally removes the record from every due
   query. The scan path also resolves any already-issued closing signals.
3. Four exact Supabase Cron jobs call
   `public.process_due_attendance_closing_interventions` directly in PostgreSQL.
   No HTTP request, Vercel Function, service-role secret, or continuously running
   consumer is involved.
4. The processor locks only a bounded batch of due, open, live `crm_closing`
   records with `FOR UPDATE SKIP LOCKED`. Intervention, notification, workflow
   task, correction, and exception writes occur only when the stage applies.
5. The protected `/api/attendance/closing-interventions` route remains an
   emergency/manual retry surface. It calls the same database function and is
   not present in `vercel.json`.

Vercel Hobby cannot run the previous five-minute Attendance schedule. The only
remaining Vercel cron is the unrelated daily agent follow-up job.

## Exact production schedules

The production preflight on 2026-07-15 confirmed:

- both active CradleHub branches use `Asia/Manila`;
- the PostgreSQL database timezone is `UTC`;
- Supabase Cron evaluates these expressions in UTC.

| Job | Branch time | UTC cron | Stage |
| --- | --- | --- | --- |
| `attendance-closing-reminder` | 11:00 PM | `0 15 * * *` | `reminder` |
| `attendance-closing-manager-escalation` | 11:30 PM | `30 15 * * *` | `manager_escalation` |
| `attendance-closing-auto-close` | 12:00 AM | `0 16 * * *` | `auto_close` |
| `attendance-closing-catch-up` | 12:10 AM | `10 16 * * *` | `catch_up` |

The setup operation aborts if active branches no longer share `Asia/Manila` or
the database timezone is no longer UTC. Fixed jobs must not be installed for
mixed branch timezones.

## Database objects

Migration:

`supabase/migrations/20260715012424_attendance_hybrid_closing_automation.sql`

Authoritative function:

```sql
public.process_due_attendance_closing_interventions(
  p_stage text,
  p_processed_at timestamptz default now(),
  p_batch_size integer default 50
) returns jsonb
```

Supported stages are `reminder`, `manager_escalation`, `auto_close`, and
`catch_up`. Execution is revoked from `public`, `anon`, and `authenticated`, and
granted only to `service_role`; the function owner remains able to execute it for
direct `pg_cron` jobs. The compatibility function
`process_crm_closing_attendance_interventions` delegates to `catch_up` and no
longer owns separate closing behavior.

Three partial indexes contain only open, live CRM closing rows:

- `staff_shift_checkins_crm_closing_reminder_due_idx`
- `staff_shift_checkins_crm_closing_escalation_due_idx`
- `staff_shift_checkins_crm_closing_auto_close_due_idx`

Test/Training Mode rows (`is_test = true`) are excluded from the live scheduler,
so they cannot emit confusing operational notifications or affect live
corrections, reports, or payroll.

## Installation

1. Confirm the linked project identity and run `pnpm db:verify-live`.
2. Apply only the isolated hybrid migration. Do not run a blind full `db push`
   while the repository's known historical migration drift is unresolved.
3. Run:

   `supabase/operations/configure-attendance-closing-cron.sql`

The operation enables `pg_cron` when absent, inspects current jobs, unschedules
only stable Attendance closing job names, preserves unrelated jobs, installs the
four exact direct-SQL jobs, and returns their active configuration.

## Verification SQL

```sql
select current_setting('TimeZone') as database_timezone;

select coalesce(nullif(settings.timezone, ''), 'Asia/Manila') as timezone,
       count(*) as active_branches
from public.branches as branch
left join public.attendance_settings as settings on settings.branch_id = branch.id
where branch.is_active = true
group by 1;

select p.oid::regprocedure as function_signature,
       p.prosecdef as security_definer,
       p.proacl as execute_acl
from pg_proc as p
where p.oid = 'public.process_due_attendance_closing_interventions(text,timestamptz,integer)'::regprocedure;

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname like 'staff_shift_checkins_crm_closing_%_due_idx'
order by indexname;

select jobid, jobname, schedule, active
from cron.job
where jobname like 'attendance-closing-%'
order by schedule, jobname;

select jobid, status, start_time, end_time, return_message
from cron.job_run_details
where jobid in (
  select jobid from cron.job where jobname like 'attendance-closing-%'
)
order by start_time desc
limit 20;
```

An empty safe manual run should report zero applied work and create no
intervention rows:

```sql
select public.process_due_attendance_closing_interventions(
  'reminder',
  now(),
  50
);
```

Never manually invoke `auto_close` against real open staff records for testing.
Use dedicated Test Mode/QA data, remembering that live scheduled processing
intentionally excludes Test Mode.

## Manual fallback

The route accepts `GET` or `POST` with a stage query parameter, for example:

```text
POST /api/attendance/closing-interventions?stage=catch_up
Authorization: Bearer <server-only CRON_SECRET>
```

Allowed stages are the same four function stages. Production denies requests
when `CRON_SECRET` is missing or incorrect. Never expose this secret through a
`NEXT_PUBLIC_` variable, client code, logs, documentation, or cron SQL.

## Safe disable and re-enable

Disable only these exact jobs:

```sql
select cron.unschedule(jobid)
from cron.job
where jobname = any (array[
  'attendance-closing-reminder',
  'attendance-closing-manager-escalation',
  'attendance-closing-auto-close',
  'attendance-closing-catch-up'
]);
```

Do not delete unrelated cron jobs. To re-enable the intended configuration,
re-run `supabase/operations/configure-attendance-closing-cron.sql` after
reconfirming active branch timezones and the UTC scheduler setting.

## Troubleshooting

- `failed > 0`: inspect sanitized database/server logs and the affected due
  records using branch-scoped operational tooling. The per-record subtransaction
  rolls back partial work, so a later catch-up can retry safely.
- An active service remains open at midnight: the processor records the existing
  `active_service_blocked` intervention, exception, notification, and manager
  task without closing Attendance. Catch-up can auto-close after the service is
  completed.
- Missing reminder/task: verify the intervention delivery timestamps and the
  deterministic `:notification` / `:task` dedupe keys before retrying the same
  stage.
- No cron run: verify `pg_cron`, `cron.job.active`, UTC schedules, and recent
  `cron.job_run_details`. Use the protected route only for emergency retry.
- Mixed branch timezones: leave fixed-time jobs disabled and implement a
  timezone-aware scheduling strategy before adding the new branch.

## Upgrade path

The four exact jobs are intentionally small and sufficient for the current beta.
If scale or tighter timing requires it later, first measure due-row counts and
job duration. A future paid/platform upgrade may add more frequent narrow-window
execution, but it must continue to call the same authoritative idempotent
function and use the same open-record partial indexes. All-day five-minute HTTP
polling should not be reintroduced.
