-- Permanent transfer dates are Attendance business dates, not UTC calendar
-- dates. Patch the already-deployed canonical resolver in place and fail
-- closed if its expected definition is not present.

begin;

do $migration$
declare
  v_definition text;
  v_patched_definition text;
  v_declaration_anchor constant text :=
    '  v_effective_now boolean := p_effective_date <= current_date;';
  v_declaration_replacement constant text :=
    E'  v_effective_now boolean;\n'
    || E'  v_target_timezone text := ''Asia/Manila'';\n'
    || E'  v_day_boundary time := time ''00:00'';\n'
    || E'  v_branch_local_now timestamp;\n'
    || E'  v_current_business_date date;';
  v_update_anchor constant text :=
    E'  update public.staff_permanent_branch_transfers as transfer_row\n';
  v_business_date_block constant text :=
    E'  select\n'
    || E'    coalesce(nullif(btrim(settings.timezone), ''''), ''Asia/Manila''),\n'
    || E'    coalesce(settings.attendance_day_boundary, time ''00:00'')\n'
    || E'    into v_target_timezone, v_day_boundary\n'
    || E'  from public.attendance_settings as settings\n'
    || E'  where settings.branch_id = v_issue.affected_branch_id;\n\n'
    || E'  v_branch_local_now := now() at time zone v_target_timezone;\n'
    || E'  v_current_business_date := v_branch_local_now::date -\n'
    || E'    case when v_branch_local_now::time < v_day_boundary then 1 else 0 end;\n'
    || E'  v_effective_now := p_effective_date <= v_current_business_date;\n\n'
    || v_update_anchor;
begin
  select pg_get_functiondef(proc.oid)
    into v_definition
  from pg_proc as proc
  join pg_namespace as namespace on namespace.oid = proc.pronamespace
  where namespace.nspname = 'public'
    and proc.proname = 'resolve_staff_permanent_branch_transfer_issue'
    and proc.proargtypes = '2950 2950 2950 25 1082 3802'::oidvector;

  if v_definition is null then
    raise exception 'canonical permanent branch transfer resolver was not found';
  end if;
  if strpos(v_definition, v_declaration_anchor) = 0 then
    raise exception 'permanent transfer UTC-date declaration anchor was not found';
  end if;
  if strpos(v_definition, v_update_anchor) = 0 then
    raise exception 'permanent transfer update anchor was not found';
  end if;

  v_patched_definition := replace(
    v_definition,
    v_declaration_anchor,
    v_declaration_replacement
  );
  v_patched_definition := replace(
    v_patched_definition,
    v_update_anchor,
    v_business_date_block
  );

  if v_patched_definition = v_definition then
    raise exception 'permanent transfer business-date patch made no change';
  end if;

  execute v_patched_definition;
end;
$migration$;

comment on function public.resolve_staff_permanent_branch_transfer_issue(
  uuid, uuid, uuid, text, date, jsonb
) is
  'Approves permanent branch authority using the target branch Attendance business date.';

notify pgrst, 'reload schema';

commit;
