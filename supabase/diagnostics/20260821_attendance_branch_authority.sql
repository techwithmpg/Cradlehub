-- Read-only Attendance branch-authority diagnostic. Run with:
-- pnpm exec supabase db query --linked -f supabase/diagnostics/20260821_attendance_branch_authority.sql
with diagnostic_staff as (
  select
    staff_row.id as staff_id,
    staff_row.full_name,
    staff_row.branch_id as profile_branch_id,
    staff_row.is_cross_branch,
    temporary.branch_ids as temporary_branch_ids,
    temporary.expired_approved_count,
    duty.branch_ids as duty_branch_ids,
    duty.assignment_count as duty_assignment_count,
    transfer.id as permanent_transfer_id,
    transfer.new_branch_id as permanent_transfer_branch_id,
    transfer.effective_date as permanent_transfer_effective_date,
    transfer.status as permanent_transfer_status,
    devices.branch_ids as device_branch_ids,
    last_scan.branch_id as last_attendance_branch_id,
    issue.resolved_branch_id as latest_resolved_issue_branch_id,
    coalesce(
      case when cardinality(temporary.branch_ids) = 1 then temporary.branch_ids[1] end,
      case when cardinality(duty.branch_ids) = 1 then duty.branch_ids[1] end,
      case when transfer.effective_date <= current_date then transfer.new_branch_id end,
      staff_row.branch_id
    ) as effective_branch_id,
    case
      when cardinality(temporary.branch_ids) = 1 then 'temporary_assignment'
      when cardinality(duty.branch_ids) = 1 then 'schedule_assignment'
      when transfer.effective_date <= current_date then 'effective_permanent_transfer'
      else 'home_branch'
    end as effective_source
  from public.staff as staff_row
  left join lateral (
    select
      array_agg(distinct assignment.branch_id order by assignment.branch_id)
        filter (
          where assignment.status = 'approved'
            and assignment.assignment_type = 'temporary'
            and (assignment.valid_from is null or assignment.valid_from <= now())
            and (assignment.valid_until is null or assignment.valid_until > now())
            and coalesce(assignment.attendance_business_date, assignment.assignment_date) = current_date
        ) as branch_ids,
      count(*) filter (
        where assignment.status = 'approved'
          and assignment.assignment_type = 'temporary'
          and assignment.valid_until <= now()
      )::integer as expired_approved_count
    from public.staff_attendance_branch_assignments as assignment
    where assignment.staff_id = staff_row.id
  ) as temporary on true
  left join lateral (
    select
      array_agg(distinct duty.branch_id order by duty.branch_id) as branch_ids,
      count(*)::integer as assignment_count
    from public.staff_duty_assignments as duty
    where duty.staff_id = staff_row.id
      and duty.day_of_week = extract(dow from current_date)::integer
      and duty.is_active is true
  ) as duty on true
  left join lateral (
    select transfer_row.*
    from public.staff_permanent_branch_transfers as transfer_row
    where transfer_row.staff_id = staff_row.id
      and transfer_row.status in ('scheduled', 'effective')
    order by transfer_row.effective_date desc, transfer_row.created_at desc
    limit 1
  ) as transfer on true
  left join lateral (
    select array_agg(distinct device.branch_id order by device.branch_id) as branch_ids
    from public.staff_devices as device
    where device.staff_id = staff_row.id and device.status = 'active'
  ) as devices on true
  left join lateral (
    select scan.branch_id
    from public.qr_scan_events as scan
    where scan.staff_id = staff_row.id and scan.scan_type = 'attendance'
    order by scan.created_at desc
    limit 1
  ) as last_scan on true
  left join lateral (
    select assignment_issue.resolved_branch_id
    from public.staff_branch_assignment_issues as assignment_issue
    where assignment_issue.staff_id = staff_row.id
      and assignment_issue.status in ('resolved', 'resolved_with_booking_review')
      and assignment_issue.resolution_type = 'correct_permanent_primary_branch'
    order by assignment_issue.resolved_at desc nulls last, assignment_issue.created_at desc
    limit 1
  ) as issue on true
  where staff_row.is_active is true
    and staff_row.archived_at is null
    and staff_row.merged_into_staff_id is null
)
select
  diagnostic_staff.*,
  array_remove(array[
    case
      when permanent_transfer_effective_date > current_date
        and profile_branch_id = permanent_transfer_branch_id
      then 'future_transfer_applied_early'
    end,
    case when duty_assignment_count > 1 then 'duplicate_active_duty_assignments' end,
    case when cardinality(duty_branch_ids) > 1 then 'contradictory_active_duty_assignments' end,
    case when expired_approved_count > 0 then 'expired_temporary_assignment_still_approved' end,
    case
      when cardinality(device_branch_ids) > 0
        and not (effective_branch_id = any(device_branch_ids))
      then 'device_branch_disagrees_with_effective_branch'
    end,
    case
      when latest_resolved_issue_branch_id is not null
        and latest_resolved_issue_branch_id <> effective_branch_id
        and coalesce(permanent_transfer_effective_date <= current_date, true)
      then 'resolved_branch_issue_not_effective'
    end
  ]::text[], null) as anomaly_codes
from diagnostic_staff
order by full_name, staff_id;
