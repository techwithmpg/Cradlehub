-- REVIEW CANDIDATE ONLY. Never run during deploy or migration replay.
-- Requires separate owner production release approval, exact installed-function
-- comparison, independent review, LOCAL/TEST evidence, and staff/device acceptance.
-- Provision the two named Vault entries separately; never print their values.
-- Deploy the reviewed route and set CRADLEHUB_ATTENDANCE_V2_ENABLED=true first;
-- it remains inactive until this transaction enables the database owner.
begin;
do $$ begin
  if current_setting('TimeZone')<>'UTC'
     or not exists(select 1 from attendance_v2_private.control where id and enabled_at is null)
     or (select count(*) from cron.job where active and jobname in (
       'attendance-closing-reminder','attendance-closing-manager-escalation',
       'attendance-closing-auto-close','attendance-closing-catch-up'))<>4
     or exists(select 1 from cron.job where jobname='attendance-v2-due-work')
     or exists(select 1 from cron.job where active and jobname='attendance-staff-clock-out-reminder')
     or exists(select 1 from public.attendance_settings s join public.branches b on b.id=s.branch_id
       where b.is_active and s.timezone is distinct from 'Asia/Manila')
     or (select count(*) from vault.decrypted_secrets where name in (
       'cradlehub_attendance_v2_endpoint','cradlehub_attendance_v2_cron_token'))<>2 then
    raise exception 'Attendance V2 activation prerequisites failed; no changes made.';
  end if;
end $$;
update attendance_v2_private.control set enabled_at=now(),owns_closing=true where id;
-- One bounded owner: resolve due attendance and drain its durable push queue.
-- The four existing Closing jobs keep their names, commands and schedules.
select cron.schedule('attendance-v2-due-work','* * * * *',$job$
  select net.http_post(
    url:=(select decrypted_secret from vault.decrypted_secrets where name='cradlehub_attendance_v2_endpoint'),
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name='cradlehub_attendance_v2_cron_token')),
    body:='{}'::jsonb,timeout_milliseconds:=30000);
$job$);
commit;
