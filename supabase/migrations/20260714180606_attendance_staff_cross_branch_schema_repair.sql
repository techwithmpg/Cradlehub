-- Repair live schema drift where the historical staff expansion migration was
-- recorded/applied incompletely. Attendance device and branch authorization
-- queries require this server-owned flag before they can resolve staff safely.
alter table public.staff
  add column if not exists is_cross_branch boolean not null default false;

comment on column public.staff.is_cross_branch is
  'Allows explicitly authorized staff to operate across branches; false by default.';
