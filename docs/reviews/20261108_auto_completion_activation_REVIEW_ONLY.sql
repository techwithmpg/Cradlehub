-- REVIEW-ONLY RELEASE PROCEDURE.
-- DO NOT EXECUTE before isolated browser/DB tests, independent review and
-- owner approval. This is NOT a historical migration replay or auto-deployment.
-- First verify the exact installed RPC SHA, privileges, branch and test evidence.

-- One branch at a time. Replace the example branch selection with the
-- approved branch UUID after reviewing the actual active branch list.
-- Supply the approved branch UUID in v_branch; this placeholder intentionally
-- aborts until the release operator edits it.
begin;
do $activate$
declare
  v_branch uuid := null; -- REQUIRED: independently verified branch id
  v_now timestamptz := clock_timestamp();
begin
  if v_branch is null then
    raise exception 'RELEASE_OPERATOR_MUST_SPECIFY_APPROVED_BRANCH';
  end if;
  if not exists(select 1 from public.branches where id=v_branch and is_active) then
    raise exception 'AUTO_COMPLETION_BRANCH_NOT_ACTIVE';
  end if;
  -- Drop only the physical release fence after independent verification.
  alter table public.service_auto_completion_policy
    drop constraint if exists service_auto_completion_release_gate;

  insert into public.service_auto_completion_policy
    (branch_id,enabled,eligible_started_after,activated_at)
  values (v_branch,true,v_now,v_now)
  on conflict (branch_id) do update
  set enabled=true,eligible_started_after=excluded.eligible_started_after,
      activated_at=excluded.activated_at;
end
$activate$;

-- Supabase Cron uses pg_cron, already installed on the live project.
-- 10-second scans provide a reliable server-side fallback even if CRM is closed.
select cron.schedule(
  'cradlehub-service-auto-completion',
  '10 seconds',
  'select * from public.complete_due_service_sessions(50);'
);
commit;

-- Emergency stop: run as an independently authorized change.
-- begin;
-- update public.service_auto_completion_policy set enabled=false where enabled;
-- select cron.unschedule('cradlehub-service-auto-completion');
-- commit;
-- Never delete audit records or revert completed booking rows automatically.
