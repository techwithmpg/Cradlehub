-- Read-only verification for the four CradleHub Attendance closing jobs.
with intended(job_name, expected_schedule) as (
  values
    ('attendance-closing-reminder', '0 15 * * *'),
    ('attendance-closing-manager-escalation', '30 15 * * *'),
    ('attendance-closing-auto-close', '0 16 * * *'),
    ('attendance-closing-catch-up', '10 16 * * *')
), configured as (
  select i.job_name, i.expected_schedule, j.jobid, j.schedule, j.active, j.command
  from intended i
  left join cron.job j on j.jobname = i.job_name
), latest as (
  select distinct on (jobid)
    jobid, start_time, end_time, status, return_message
  from cron.job_run_details
  order by jobid, start_time desc
)
select
  c.job_name,
  c.schedule,
  c.expected_schedule,
  c.active,
  c.command as command_target,
  l.start_time as latest_execution,
  l.status as latest_status,
  case when l.status = 'succeeded' then true when l.status is null then null else false end as recent_success,
  case when l.status = 'succeeded' then null else left(l.return_message, 500) end as failure_message,
  case c.job_name
    when 'attendance-closing-reminder' then (current_date + interval '1 day' + time '15:00') at time zone 'UTC'
    when 'attendance-closing-manager-escalation' then (current_date + interval '1 day' + time '15:30') at time zone 'UTC'
    when 'attendance-closing-auto-close' then (current_date + interval '1 day' + time '16:00') at time zone 'UTC'
    when 'attendance-closing-catch-up' then (current_date + interval '1 day' + time '16:10') at time zone 'UTC'
  end as next_expected_run_approx
from configured c
left join latest l on l.jobid = c.jobid
order by c.expected_schedule, c.job_name;

-- Duplicate or obsolete Attendance jobs must be reviewed before activation.
select jobid, jobname, schedule, active, command
from cron.job
where jobname like '%attendance%closing%'
order by jobname, jobid;
