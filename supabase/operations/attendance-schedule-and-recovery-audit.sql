-- CRADLEHUB ATTENDANCE LIFECYCLE AUDIT & REMEDIATION CANDIDATE
-- Classification: SEPARATE DIAGNOSTIC / OWNER-APPROVED MAINTENANCE ONLY
-- NEVER execute blindly against production; review every row with CRM/Manager/Owner
-- before applying any data repair or schedule edits.
-- Never included in automated schema migrations.

-- =============================================================================
-- 1. READ-ONLY SCHEDULE ANOMALY DIAGNOSTICS
-- =============================================================================
-- Identifies active weekly schedule rows that distort late_minutes, early_clock_in,
-- or closing behavior:
--   a) 11h - 13h branch-wide operating hours assigned as single shifts (e.g. 10:00-22:30)
--   b) Sub-4h typo windows (e.g. 22:03-22:30 = 27 minutes)
--   c) Non-standard off-grid minute timestamps (:03, :09, :33)
--   d) Overnight windows (ends_next_day = true or end_time <= start_time)
select
  b.name as branch_name,
  s.id as staff_id,
  s.full_name,
  s.system_role,
  ss.id as schedule_id,
  ss.day_of_week,
  ss.shift_type,
  ss.start_time,
  ss.end_time,
  ss.ends_next_day,
  ss.window_order,
  round(
    extract(epoch from (
      (ss.end_time::interval + case when ss.ends_next_day or ss.end_time <= ss.start_time then interval '24 hours' else interval '0 hours' end)
      - ss.start_time::interval
    )) / 3600.0,
    2
  ) as duration_hours,
  case
    when extract(epoch from ((ss.end_time::interval + case when ss.ends_next_day or ss.end_time <= ss.start_time then interval '24 hours' else interval '0 hours' end) - ss.start_time::interval)) < 4 * 3600
      then 'short_or_typo_window'
    when extract(epoch from ((ss.end_time::interval + case when ss.ends_next_day or ss.end_time <= ss.start_time then interval '24 hours' else interval '0 hours' end) - ss.start_time::interval)) > 10 * 3600
      then 'excessive_duration_over_10h'
    when extract(minute from ss.start_time)::int not in (0, 15, 30, 45)
      or extract(minute from ss.end_time)::int not in (0, 15, 30, 45)
      then 'odd_minute_entry'
    when ss.ends_next_day or ss.end_time <= ss.start_time
      then 'overnight_window_verify'
    else 'other'
  end as anomaly_reason
from public.staff_schedules ss
join public.staff s on s.id = ss.staff_id
join public.branches b on b.id = s.branch_id
where ss.is_active = true
  and s.is_active = true
  and (
    extract(epoch from ((ss.end_time::interval + case when ss.ends_next_day or ss.end_time <= ss.start_time then interval '24 hours' else interval '0 hours' end) - ss.start_time::interval)) > 10 * 3600
    or extract(epoch from ((ss.end_time::interval + case when ss.ends_next_day or ss.end_time <= ss.start_time then interval '24 hours' else interval '0 hours' end) - ss.start_time::interval)) < 4 * 3600
    or extract(minute from ss.start_time)::int not in (0, 15, 30, 45)
    or extract(minute from ss.end_time)::int not in (0, 15, 30, 45)
    or ss.ends_next_day = true
  )
order by b.name, anomaly_reason, s.full_name, ss.day_of_week, ss.start_time;

-- =============================================================================
-- 2. READ-ONLY HISTORICAL MISATTRIBUTED STALE EXCEPTION AUDIT
-- =============================================================================
-- Finds prior stale_open_checkin / missed_checkout exceptions whose checkin_id
-- currently points to a newer check-in while metadata.staleCheckinId holds the
-- actual unclosed prior session, plus clean current check-ins falsely flagged open.
select
  e.id as exception_id,
  e.status as exception_status,
  e.checkin_id as current_linked_checkin_id,
  (e.metadata->>'staleCheckinId')::uuid as original_stale_checkin_id,
  curr.shift_date as current_checkin_shift_date,
  curr.exception_state as current_checkin_exception_state,
  stale.shift_date as original_stale_shift_date,
  stale.attendance_business_date as original_stale_business_date
from public.attendance_exceptions e
left join public.staff_shift_checkins curr on curr.id = e.checkin_id
left join public.staff_shift_checkins stale on stale.id = (e.metadata->>'staleCheckinId')::uuid
where e.status = 'open'
  and (e.exception_type = 'missed_checkout' or e.metadata->>'internalExceptionType' = 'stale_open_checkin')
  and nullif(e.metadata->>'staleCheckinId', '') is not null
  and e.checkin_id is distinct from (e.metadata->>'staleCheckinId')::uuid;

-- =============================================================================
-- 3. OPTIONAL REMEDIATION CANDIDATE FOR MISATTRIBUTED HISTORICAL STALE LINKS
-- =============================================================================
-- Run ONLY after reviewing query (2) above and taking a backup/snapshot.
-- Never touches qr_scan_events, attendance_corrections, or raw timestamps.
/*
begin;

with target_exceptions as (
  select
    e.id as exception_id,
    e.checkin_id as wrong_current_checkin_id,
    stale.id as stale_checkin_id,
    stale.branch_id as stale_branch_id,
    stale.shift_date as stale_shift_date,
    coalesce(stale.attendance_business_date, stale.shift_date) as stale_business_date,
    coalesce(stale.scheduled_end_at, stale.checked_in_at) as original_detected_at
  from public.attendance_exceptions e
  join public.staff_shift_checkins stale
    on stale.id = (e.metadata->>'staleCheckinId')::uuid
  where e.status = 'open'
    and (e.exception_type = 'missed_checkout' or e.metadata->>'internalExceptionType' = 'stale_open_checkin')
    and e.checkin_id is distinct from stale.id
)
update public.attendance_exceptions e
   set checkin_id = t.stale_checkin_id,
       related_checkin_ids = array[t.stale_checkin_id],
       branch_id = coalesce(t.stale_branch_id, e.branch_id),
       detected_at = coalesce(t.original_detected_at, e.detected_at),
       metadata = e.metadata || jsonb_build_object(
         'staleShiftDate', t.stale_shift_date,
         'staleBusinessDate', t.stale_business_date,
         'recoveredByCurrentCheckinId', t.wrong_current_checkin_id,
         'attributionRepaired', true
       ),
       updated_at = now()
  from target_exceptions t
 where e.id = t.exception_id;

-- Clear exception_state ONLY on current clean check-ins that had exception_state='open'
-- solely because of the prior stale recovery bug and have zero real open exceptions of their own.
update public.staff_shift_checkins c
   set exception_state = 'none',
       updated_at = now()
 where c.exception_state = 'open'
   and c.late_minutes = 0
   and c.early_leave_minutes = 0
   and c.overtime_minutes = 0
   and c.clock_out_confirmation_required = false
   and c.provisional_auto_closed_at is null
   and not exists (
     select 1
     from public.attendance_exceptions e
     where e.status = 'open'
       and (e.checkin_id = c.id or c.id = any(coalesce(e.related_checkin_ids, '{}'::uuid[])))
   );

commit;
*/
