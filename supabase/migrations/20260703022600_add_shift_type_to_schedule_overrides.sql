alter table public.schedule_overrides
add column if not exists shift_type text null;

alter table public.schedule_overrides
drop constraint if exists schedule_overrides_shift_type_check;

alter table public.schedule_overrides
add constraint schedule_overrides_shift_type_check
check (
  shift_type is null
  or shift_type in ('single', 'opening', 'closing')
);
