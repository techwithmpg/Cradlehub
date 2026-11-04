insert into public.branches values ('10000000-0000-0000-0000-000000000002');
insert into public.staff values ('20000000-0000-0000-0000-000000000002');
insert into public.customers values ('30000000-0000-0000-0000-000000000002', 'Race Test Customer');
insert into public.services values ('40000000-0000-0000-0000-000000000002', 'Race Test Treatment');
-- Remove the release latch only in this disposable LOCAL database to exercise
-- concurrency. The shipped migration retains the latch.
alter table public.service_auto_completion_policy
  drop constraint service_auto_completion_release_gate;

insert into public.service_auto_completion_policy (
  branch_id, enabled, eligible_started_after, activated_at
) values (
  '10000000-0000-0000-0000-000000000002', true,
  clock_timestamp() - interval '20 minutes', clock_timestamp() - interval '20 minutes'
);
insert into public.bookings (
  id, branch_id, staff_id, customer_id, service_id, resource_id,
  booking_date, delivery_type, status, booking_progress_status,
  session_start_source, session_started_at, session_due_at
) values (
  '60000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000002',
  '70000000-0000-0000-0000-000000000002',
  (clock_timestamp() at time zone 'Asia/Manila')::date,
  'in_spa', 'in_progress', 'session_started', 'staff_portal',
  clock_timestamp() - interval '10 minutes', clock_timestamp() - interval '3 minutes'
);
