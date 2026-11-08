-- LOCAL/TEST ONLY. No writes; asserts that release is physically gated.
begin;
do $preflight$
begin
  if to_regclass('public.service_auto_completion_policy') is null then
    raise exception 'AUTO_COMPLETION_POLICY_MISSING';
  end if;
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.service_auto_completion_policy'::regclass
      and conname='service_auto_completion_release_gate'
  ) then
    raise exception 'AUTO_COMPLETION_RELEASE_GATE_MISSING';
  end if;
  if exists(select 1 from public.service_auto_completion_policy where enabled) then
    raise exception 'AUTO_COMPLETION_PREMATURELY_ENABLED';
  end if;
  if has_function_privilege('authenticated',
    'public.complete_due_service_sessions(integer)', 'execute') then
    raise exception 'AUTO_COMPLETION_RPC_EXPOSED_TO_BROWSER';
  end if;
  if exists(select 1 from cron.job
    where jobname='cradlehub-service-auto-completion' and active) then
    raise exception 'AUTO_COMPLETION_SCHEDULER_PREMATURELY_RUNNING';
  end if;
end
$preflight$;
rollback;
