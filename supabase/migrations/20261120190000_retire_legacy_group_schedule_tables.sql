-- Retire unused legacy group schedule tables so public.staff_schedules + public.schedule_overrides
-- remain the single canonical schedule source of truth across DB, backend, and frontend.

DROP TABLE IF EXISTS public.staff_group_schedule_rules;
DROP TABLE IF EXISTS public.staff_schedule_groups;
