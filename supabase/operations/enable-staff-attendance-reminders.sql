-- Reviewed operation only; never run as part of an application deploy.
-- Prerequisites: classified target, approved release window, applied and verified
-- 20261031074004_staff_clock_out_reminders.sql, and exactly four existing
-- Attendance closing jobs. This adds one hourly job because the closing jobs
-- only run near midnight and can miss a full working day.
begin;

do $enable$
declare
  v_four integer;
begin
  select count(*) into v_four
  from cron.job where jobname in (
    'attendance-closing-reminder',
    'attendance-closing-manager-escalation',
    'attendance-closing-auto-close',
    'attendance-closing-catch-up'
  ) and active = true;
  if v_four <> 4
     or exists (select 1 from cron.job where jobname = 'attendance-staff-clock-out-reminder')
     or to_regprocedure('public.process_due_staff_clock_out_reminders(timestamptz,integer)') is null then
    raise exception 'Attendance reminder preflight failed; no cron changes made.';
  end if;
  insert into public.attendance_staff_reminder_activation (id, activated_at)
  values (true, now())
  on conflict (id) do update set activated_at = excluded.activated_at;
  perform cron.schedule(
    'attendance-staff-clock-out-reminder',
    '7 * * * *',
    'select public.process_due_staff_clock_out_reminders(now(), 50);'
  );
end;
$enable$;

commit;

select jobid, jobname, schedule, active, command from cron.job
where jobname like 'attendance-closing-%'
   or jobname = 'attendance-staff-clock-out-reminder'
order by jobname;
