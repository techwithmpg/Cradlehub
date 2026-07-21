-- Read-only operational preflight. Run only on the explicitly verified project.

select 'active_branches_missing_required_fields' as check_name, count(*) as issue_count
from public.branches
where is_active and (nullif(trim(name), '') is null or nullif(trim(address), '') is null);

select 'active_staff_without_branch' as check_name, count(*) as issue_count
from public.staff where is_active and archived_at is null and branch_id is null;

select 'active_staff_without_schedule' as check_name, count(*) as issue_count
from public.staff s
where s.is_active and s.archived_at is null
and not exists (select 1 from public.staff_schedules ss where ss.staff_id = s.id and ss.is_active);

select 'active_staff_without_auth_linkage' as check_name, count(*) as issue_count
from public.staff where is_active and archived_at is null and auth_user_id is null;

select 'duplicate_auth_linkage' as check_name, auth_user_id, count(*) as issue_count
from public.staff where auth_user_id is not null group by auth_user_id having count(*) > 1;

select 'unresolved_branch_assignment_issues' as check_name, count(*) as issue_count
from public.staff_branch_assignment_issues where status in ('open', 'pending', 'needs_review');

select 'stale_open_attendance' as check_name, count(*) as issue_count
from public.staff_shift_checkins
where checked_out_at is null and not is_test and checked_in_at < now() - interval '20 hours';

select 'active_devices_by_staff' as check_name, staff_id, count(*) as active_devices
from public.staff_devices where status = 'active' group by staff_id order by active_devices desc;

select 'staff_exceeding_device_limit' as check_name, staff_id, count(*) as active_devices
from public.staff_devices where status = 'active' group by staff_id having count(*) > 2;

select 'inactive_attendance_qr_points' as check_name, branch_id, count(*) as issue_count
from public.qr_points where point_type = 'attendance' and not is_active group by branch_id;

select 'duplicate_active_attendance_qr_points' as check_name, branch_id, count(*) as issue_count
from public.qr_points where point_type = 'attendance' and is_active group by branch_id having count(*) > 1;

select 'services_missing_duration' as check_name, count(*) as issue_count
from public.services where is_active and duration_minutes <= 0;

select 'services_missing_branch_availability' as check_name, count(*) as issue_count
from public.services s where s.is_active
and not exists (select 1 from public.branch_services bs where bs.service_id = s.id and bs.is_active);

select 'public_services_not_truly_bookable' as check_name, bs.branch_id, bs.service_id
from public.branch_services bs
where bs.is_active and bs.visibility = 'public'
and (not bs.available_in_spa and not bs.available_home_service);

select 'consultation_services_exposed_to_automatic_booking' as check_name, bs.branch_id, s.id, s.name
from public.branch_services bs join public.services s on s.id = bs.service_id
left join public.service_categories sc on sc.id = s.category_id
where bs.is_active and bs.visibility = 'public'
and (coalesce((s.metadata ->> 'requires_consultation')::boolean, false)
  or lower(coalesce(sc.name, '')) = 'spa party packages'
  or s.name ~* '(couple|bestie|spa[[:space:]]*party|(^|[^0-9])(10|15|20)[- ]*(person|pax))');

select 'public_service_without_provider_capability' as check_name, bs.branch_id, bs.service_id
from public.branch_services bs
where bs.is_active and bs.visibility = 'public'
and not exists (
  select 1 from public.staff_services ss join public.staff st on st.id = ss.staff_id
  where ss.service_id = bs.service_id and st.branch_id = bs.branch_id and st.is_active and st.archived_at is null
);

select 'detectable_booking_assignment_conflicts' as check_name, b1.id, b2.id as conflicting_booking_id
from public.bookings b1 join public.bookings b2
  on b1.id < b2.id and b1.staff_id = b2.staff_id and b1.booking_date = b2.booking_date
  and b1.start_time < b2.end_time and b2.start_time < b1.end_time
where b1.status not in ('cancelled', 'no_show') and b2.status not in ('cancelled', 'no_show');

select 'incomplete_payments' as check_name, count(*) as issue_count
from public.bookings
where status not in ('cancelled', 'no_show') and payment_status not in ('paid', 'refunded');

select 'unreconciled_close_day_records' as check_name, count(*) as issue_count
from public.daily_cash_reconciliations where status not in ('closed', 'reconciled');

select 'pending_home_service_or_dispatch' as check_name, count(*) as issue_count
from public.bookings
where delivery_type = 'home_service' and status not in ('completed', 'cancelled', 'no_show')
and (staff_id is null or booking_date < current_date);

select jobname, schedule, active
from cron.job where jobname like 'attendance-closing-%' order by jobname;

select 'database_configuration' as check_name,
  current_setting('TimeZone') as database_timezone,
  current_database() as database_name,
  count(*) filter (where is_active) as active_branches
from public.branches;
