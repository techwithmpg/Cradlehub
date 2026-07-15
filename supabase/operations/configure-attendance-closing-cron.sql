-- Production operation: configure the four exact Attendance closing safety jobs.
--
-- Preconditions:
--   1. Run only against the explicitly verified CradleHub production project.
--   2. Apply 20260715012424_attendance_hybrid_closing_automation.sql first.
--   3. All active branches must share Asia/Manila closing time.
--
-- Supabase Cron evaluates these schedules in UTC. The jobs call PostgreSQL
-- directly; there is no HTTP request and no secret is stored in cron.job.

begin;

do $safety$
declare
  v_timezone_count integer;
  v_timezone text;
begin
  select count(distinct coalesce(nullif(settings.timezone, ''), 'Asia/Manila')),
         min(coalesce(nullif(settings.timezone, ''), 'Asia/Manila'))
  into v_timezone_count, v_timezone
  from public.branches as branch
  left join public.attendance_settings as settings on settings.branch_id = branch.id
  where branch.is_active = true;

  if v_timezone_count <> 1 or v_timezone <> 'Asia/Manila' then
    raise exception
      'Attendance closing cron requires all active branches to use Asia/Manila; found % timezone configuration(s).',
      v_timezone_count;
  end if;

  if current_setting('TimeZone') <> 'UTC' then
    raise exception
      'Attendance closing cron requires the verified UTC database timezone; found %.',
      current_setting('TimeZone');
  end if;
end;
$safety$;

create extension if not exists pg_cron with schema pg_catalog;

-- Inspection output before mutation. Preserve every unrelated job.
select jobid, jobname, schedule, active
from cron.job
order by jobname, jobid;

do $unschedule$
declare
  v_job record;
begin
  for v_job in
    select jobid
    from cron.job
    where jobname = any (array[
      'attendance-closing-reminder',
      'attendance-closing-manager-escalation',
      'attendance-closing-auto-close',
      'attendance-closing-catch-up',
      'attendance-closing-interventions',
      'attendance-crm-closing-interventions',
      'crm-closing-attendance-interventions'
    ]::text[])
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end;
$unschedule$;

select cron.schedule(
  'attendance-closing-reminder',
  '0 15 * * *',
  $job$select public.process_due_attendance_closing_interventions('reminder', now(), 50);$job$
);

select cron.schedule(
  'attendance-closing-manager-escalation',
  '30 15 * * *',
  $job$select public.process_due_attendance_closing_interventions('manager_escalation', now(), 50);$job$
);

select cron.schedule(
  'attendance-closing-auto-close',
  '0 16 * * *',
  $job$select public.process_due_attendance_closing_interventions('auto_close', now(), 50);$job$
);

select cron.schedule(
  'attendance-closing-catch-up',
  '10 16 * * *',
  $job$select public.process_due_attendance_closing_interventions('catch_up', now(), 50);$job$
);

commit;

-- Expected result: exactly four active Attendance jobs with the schedules above.
select jobid, jobname, schedule, active
from cron.job
where jobname like 'attendance-closing-%'
order by schedule, jobname;
