-- =============================================================================
-- CradleHub - schedule leftover cleanup
-- =============================================================================
-- Narrow cleanup after individual schedule unification:
--   * restore known corrupted roster-total coverage minimums to schema defaults;
--   * remove deterministic stale single windows superseded by newer
--     opening/closing rows;
--   * preserve ambiguous invalid/overlapping windows for CRM review.
-- =============================================================================

create table if not exists public.schedule_repair_backups (
  id bigserial primary key,
  batch_id uuid not null,
  source_table text not null,
  source_pk text not null,
  original_row jsonb not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists schedule_repair_backups_batch_idx
  on public.schedule_repair_backups (batch_id, source_table);

grant select, insert on public.schedule_repair_backups to authenticated, service_role;
grant usage, select on sequence public.schedule_repair_backups_id_seq to authenticated, service_role;

do $$
declare
  v_batch_id uuid := gen_random_uuid();
begin
  insert into public.schedule_repair_backups (
    batch_id,
    source_table,
    source_pk,
    original_row,
    reason
  )
  select
    v_batch_id,
    'scheduling_rules',
    sr.id::text,
    to_jsonb(sr),
    'leftover_cleanup_restore_corrupted_coverage_roster_totals'
  from public.scheduling_rules sr
  where sr.min_daily_staff = 29
    and sr.min_daily_therapists = 29
    and sr.min_daily_csr = 4
    and sr.min_daily_drivers = 3
    and sr.min_daily_utility = 2
    and not exists (
      select 1
      from public.schedule_repair_backups existing
      where existing.source_table = 'scheduling_rules'
        and existing.source_pk = sr.id::text
        and existing.reason = 'leftover_cleanup_restore_corrupted_coverage_roster_totals'
    );

  update public.scheduling_rules sr
  set
    min_daily_staff = 1,
    min_daily_therapists = 1,
    min_daily_csr = 1,
    min_daily_drivers = 0,
    min_daily_utility = 0,
    updated_at = now()
  where sr.min_daily_staff = 29
    and sr.min_daily_therapists = 29
    and sr.min_daily_csr = 4
    and sr.min_daily_drivers = 3
    and sr.min_daily_utility = 2;

  with stale_single_rows as (
    select distinct single_row.id
    from public.staff_schedules single_row
    join public.staff_schedules replacement_row
      on replacement_row.staff_id = single_row.staff_id
     and replacement_row.day_of_week = single_row.day_of_week
     and replacement_row.id <> single_row.id
     and replacement_row.is_active = true
     and replacement_row.shift_type in ('opening', 'closing')
     and replacement_row.created_at > single_row.created_at
    where single_row.is_active = true
      and single_row.shift_type = 'single'
      and public.schedule_time_ranges_overlap(
        single_row.start_time,
        single_row.end_time,
        replacement_row.start_time,
        replacement_row.end_time
      )
  )
  insert into public.schedule_repair_backups (
    batch_id,
    source_table,
    source_pk,
    original_row,
    reason
  )
  select
    v_batch_id,
    'staff_schedules',
    ss.id::text,
    to_jsonb(ss),
    'leftover_cleanup_deactivate_stale_single_window'
  from public.staff_schedules ss
  join stale_single_rows stale on stale.id = ss.id
  where not exists (
    select 1
    from public.schedule_repair_backups existing
    where existing.source_table = 'staff_schedules'
      and existing.source_pk = ss.id::text
      and existing.reason = 'leftover_cleanup_deactivate_stale_single_window'
  );

  with stale_single_rows as (
    select distinct single_row.id
    from public.staff_schedules single_row
    join public.staff_schedules replacement_row
      on replacement_row.staff_id = single_row.staff_id
     and replacement_row.day_of_week = single_row.day_of_week
     and replacement_row.id <> single_row.id
     and replacement_row.is_active = true
     and replacement_row.shift_type in ('opening', 'closing')
     and replacement_row.created_at > single_row.created_at
    where single_row.is_active = true
      and single_row.shift_type = 'single'
      and public.schedule_time_ranges_overlap(
        single_row.start_time,
        single_row.end_time,
        replacement_row.start_time,
        replacement_row.end_time
      )
  )
  delete from public.staff_schedules ss
  using stale_single_rows stale
  where ss.id = stale.id;
end $$;
