import 'server-only';
import { getFrontDeskContext } from '@/lib/queries/crm-context';
import { BRANCH_TIMEZONE, addDaysToYmd, getBranchBusinessDate, getBranchClockTime } from '@/lib/engine/slot-time';
import { branchDateTimeToIsoInTimezone } from '@/lib/attendance/shift-instance';
import { isTimingOnlyAttendanceException } from '@/lib/attendance/attendance-exception-actionability';
import { getCrmTodayOperationalData } from '@/lib/queries/crm-today-operational';
import { getCrmAvailabilitySnapshot } from '@/lib/queries/crm-availability';
import { getDailySchedule } from '@/lib/queries/schedule';
import { getActiveTripsForOpsMap } from '@/lib/actions/live-ops-actions';
import { getCradleFlowBalance } from '@/lib/crm/cradle-flow';
import { getCradleFlowAttention, isHomeServiceVisit } from '@/components/features/crm/today/cradle-flow-display';
import { createClient } from '@/lib/supabase/server';
import type { LiveBoardData, LiveBooking, LiveRoom, LiveEvent, LiveCashDrawer, LiveExpenses, LiveIssue } from './types';
import { resolveLiveStage, resolveRoomStatus, resolveTherapistStatus, resolveVerifiedPresence, type AttendanceEvidence } from './status';
import { isTimeWithinScheduleWindows } from '@/lib/schedule/resolve-staff-schedule';
import { findUnscheduledProviderConflicts, selectScheduledProviders, summarizeScheduledRoster } from './roster';
import { buildOperationsIssues, type OperationalStaffMember } from '@/lib/operations-center/issue-model';
import type { AttendanceException } from '@/lib/attendance/types';

type LiveAttendanceRow = AttendanceEvidence & { id: string; shift_date: string | null; attendance_business_date: string | null };
type LiveCashSessionRow = { id: string; opened_at: string; current_custodian_id: string | null; opened_by: string };
type LiveExpenseTransaction = { id: string; financial_account_movements: Array<{ amount: number | string }> | null };
type LiveIdentityRow = {
  id: string; full_name: string; nickname: string | null; phone: string | null;
  system_role: string; staff_type: string; tier: string | null; is_active: boolean;
  branch_id: string; auth_user_id: string | null; identity_verified_at: string | null;
  archived_at: string | null; merged_into_staff_id: string | null; created_at: string | null;
};

// Read-only composition of established, branch-authorized CRM sources.
// IMPORTANT: Do not duplicate mutations or use desktop-local state as authority.
export async function getCradleLiveData(): Promise<LiveBoardData> {
  const { branchId, branchName } = await getFrontDeskContext();
  const date = getBranchBusinessDate();
  const previousDate = addDaysToYmd(date, -1);
  const dayStart = branchDateTimeToIsoInTimezone({ date, time: '00:00:00', timezone: BRANCH_TIMEZONE });
  const dayEnd = branchDateTimeToIsoInTimezone({ date: addDaysToYmd(date, 1), time: '00:00:00', timezone: BRANCH_TIMEZONE });
  const refreshedAt = new Date().toISOString();
  const now = new Date(refreshedAt);
  const nowTime = `${date}T${getBranchClockTime(now, BRANCH_TIMEZONE)}`;
  const errors: string[] = [];
  const [opsResult, staffResult, previousScheduleResult, tripResult, attendanceResult, exceptionResult, identityResult, cashResult, expenseResult] = await Promise.allSettled([
    getCrmTodayOperationalData({ branchId, date }),
    getCrmAvailabilitySnapshot({ branchId, date }),
    getDailySchedule({ branchId, date: previousDate }),
    getActiveTripsForOpsMap(),
    (async () => {
      const db = await createClient();
      const result = await db.from('staff_shift_checkins')
        .select('id,staff_id,status,checked_in_at,checked_out_at,shift_date,attendance_business_date', { count: 'exact' })
        .eq('branch_id', branchId)
        .eq('is_test', false)
        .or(`attendance_business_date.eq.${date},shift_date.eq.${date},attendance_business_date.eq.${previousDate},shift_date.eq.${previousDate}`);
      if (result.error || result.count == null || result.count !== result.data?.length) throw new Error('Attendance evidence incomplete');
      return (result.data ?? []) as LiveAttendanceRow[];
    })(),
    (async () => {
      const db = await createClient();
      const result = await db.from('attendance_exceptions')
        .select('id,branch_id,staff_id,checkin_id,scan_event_id,exception_type,severity,status,message,metadata,detected_at,resolved_at,safe_error_code,category,resolution_owner,resolution_status,resolution_action,recommended_action,occurrence_count,first_detected_at,last_detected_at,latest_scan_event_id,dedupe_key,priority,staff_response_required,technical_context', { count: 'exact' })
        .eq('branch_id', branchId).eq('status', 'open').eq('is_test', false);
      if (result.error || result.count == null || result.count !== result.data?.length) throw new Error('Attendance exceptions incomplete');
      return ((result.data ?? []) as unknown as AttendanceException[]).map(row => ({
        ...row,
        metadata: row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata : {},
      }));
    })(),
    (async () => {
      const db = await createClient();
      const result = await db.from('staff')
        .select('id,full_name,nickname,phone,system_role,staff_type,tier,is_active,branch_id,auth_user_id,identity_verified_at,archived_at,merged_into_staff_id,created_at', { count: 'exact' })
        .eq('branch_id', branchId);
      if (result.error || result.count == null || result.count !== result.data?.length) throw new Error('Staff identity feed incomplete');
      return ((result.data ?? []) as LiveIdentityRow[]).map(row => ({
        id: row.id, full_name: row.full_name, nickname: row.nickname, phone: row.phone,
        system_role: row.system_role, staff_type: row.staff_type, tier: row.tier,
        is_active: row.is_active, branch_id: row.branch_id,
        hasLoginAccount: Boolean(row.auth_user_id), isIdentityVerified: Boolean(row.identity_verified_at),
        identity_verified_at: row.identity_verified_at, archived_at: row.archived_at,
        merged_into_staff_id: row.merged_into_staff_id, created_at: row.created_at,
      })) satisfies OperationalStaffMember[];
    })(),
    (async () => {
      const db = await createClient();
      const cashDb = db as unknown as { from: (table: string) => {
        select: (columns: string) => { eq: (column: string, value: unknown) => {
          eq: (column: string, value: unknown) => PromiseLike<{ data: LiveCashSessionRow[] | null; error: unknown }>
        } }
      } };
      const result = await cashDb.from('cash_sessions')
        .select('id,opened_at,current_custodian_id,opened_by')
        .eq('branch_id', branchId).eq('status', 'open');
      if (result.error) throw result.error;
      return result.data ?? [];
    })(),
    (async () => {
      const db = await createClient();
      const result = await db.from('financial_transactions')
        .select('id,financial_account_movements(amount)', { count: 'exact' })
        .eq('branch_id', branchId).eq('business_date', date)
        .eq('status', 'posted').eq('transaction_type', 'operational_expense');
      if (result.error || result.count == null || result.count !== result.data?.length) throw new Error('Expense feed incomplete');
      const rows = (result.data ?? []) as LiveExpenseTransaction[];
      if (rows.some(tx => (tx.financial_account_movements ?? []).some(movement => !Number.isFinite(Number(movement.amount))))) {
        throw new Error('Expense amount unavailable');
      }
      return rows;
    })(),
  ]);

  const ops = opsResult.status === 'fulfilled' ? opsResult.value : null;
  const availability = staffResult.status === 'fulfilled' ? staffResult.value : null;
  const previousSchedule = previousScheduleResult.status === 'fulfilled' ? previousScheduleResult.value : null;
  const tripsRaw = tripResult.status === 'fulfilled' ? tripResult.value : null;
  const attendance = attendanceResult.status === 'fulfilled' ? attendanceResult.value : null;
  const exceptions = exceptionResult.status === 'fulfilled' ? exceptionResult.value : null;
  const identityStaff = identityResult.status === 'fulfilled' ? identityResult.value : null;
  const cashSessions = cashResult.status === 'fulfilled' ? cashResult.value : null;
  const expenseTransactions = expenseResult.status === 'fulfilled' ? expenseResult.value : null;
  if (!ops) errors.push('Booking and collection data unavailable');
  if (!availability) errors.push('Staff presence data unavailable');
  if (!previousSchedule) errors.push('Overnight schedule data unavailable');
  if (!tripsRaw) errors.push('Home Service trip data unavailable');
  if (!attendance) errors.push('Attendance evidence unavailable');
  if (!exceptions) errors.push('Attendance review status unavailable');
  if (!identityStaff) errors.push('Identity issue summary unavailable');
  if (!cashSessions) errors.push('Cash drawer status unavailable');
  if (!expenseTransactions) errors.push('Expense summary unavailable');
  if (ops && !ops.readinessAvailable) errors.push('Operational issue feed unavailable');

  const bookings: LiveBooking[] | null = ops
    ? ops.queueData.filter(b => b.booking_date >= date && resolveLiveStage(b) !== null).map(b => {
        const stage = resolveLiveStage(b)!;
        const isToday = b.booking_date === date;
        return {
          id: b.id,
          date: b.booking_date,
          time: b.start_time,
          name: b.customer_name ?? 'Guest',
          service: b.service_name ?? 'Service',
          therapist: b.staff_name,
          room: b.resource_name,
          stage,
          arrivalAt: b.checked_in_at ?? null,
          dueAt: b.session_due_at ?? null,
          startedAt: b.session_started_at ?? null,
          durationMinutes: b.service_duration ?? null,
          source: b.therapist_selection_source ?? null,
          attention: isToday ? getCradleFlowAttention(b).slice(0, 3) : [],
          amountDue: stage === 'ready_to_pay' ? getCradleFlowBalance(b) : null,
          paymentRef: b.order_id ?? b.id,
          homeService: isHomeServiceVisit(b),
        };
      })
    : null;

  const attendanceByStaff = new Map<string, LiveAttendanceRow[]>();
  for (const row of attendance ?? []) {
    const rows = attendanceByStaff.get(row.staff_id) ?? [];
    rows.push(row);
    attendanceByStaff.set(row.staff_id, rows);
  }
  const attendanceForDate = (staffId: string, scheduleDate: string) =>
    (attendanceByStaff.get(staffId) ?? []).filter(row => (row.shift_date ?? row.attendance_business_date) === scheduleDate);
  const hasAttendanceReview = (staffId: string, scheduleDate: string) => {
    const checkinIds = new Set(attendanceForDate(staffId, scheduleDate).map(row => row.id));
    const start = scheduleDate === date ? dayStart : branchDateTimeToIsoInTimezone({ date: scheduleDate, time: '00:00:00', timezone: BRANCH_TIMEZONE });
    const end = scheduleDate === date ? dayEnd : dayStart;
    return (exceptions ?? []).some(row => row.staff_id === staffId && !isTimingOnlyAttendanceException(row) &&
      (row.checkin_id ? checkinIds.has(row.checkin_id) : row.detected_at >= start && row.detected_at < end));
  };
  const todayAttendanceByStaff = new Map((availability?.staff ?? []).map(person =>
    [person.staff_id, attendanceForDate(person.staff_id, date)] as const));
  const scheduledEntries = availability && previousSchedule ? selectScheduledProviders({
    availability, branchId, nowTime, previousDate, previousSchedule,
  }) : null;
  const unscheduledConflicts = availability && attendance ? findUnscheduledProviderConflicts({
    availability, attendanceByStaff: todayAttendanceByStaff, bookings: ops?.queueData ?? [], nowTime, now,
    ...(scheduledEntries ? { scheduledIds: new Set(scheduledEntries.map(entry => entry.person.staff_id)) } : {}),
  }) : [];
  const unscheduledBookingIds = new Set(unscheduledConflicts.flatMap(conflict => conflict.bookingIds));
  const liveBookings = bookings?.map(booking => unscheduledBookingIds.has(booking.id)
    ? { ...booking, attention: ['Therapist schedule needs review', ...booking.attention].slice(0, 3) }
    : booking) ?? null;
  const staff = scheduledEntries && attendance && exceptions ? scheduledEntries
    .map(({ person, scheduleDate }) => {
      const verified = resolveVerifiedPresence(attendanceForDate(person.staff_id, scheduleDate));
      const needsReview = hasAttendanceReview(person.staff_id, scheduleDate);
      const presence = needsReview ? 'needs_review' as const : verified.state;
      const resolved = resolveTherapistStatus({ person, presence, bookings: ops?.queueData ?? [], nowTime, scheduleDate, now });
      const state = ops || resolved.state !== 'free_now' ? resolved.state : 'status_unavailable';
      return {
        id: person.staff_id,
        name: person.staff_name,
        type: person.staff_type,
        status: state,
        state,
        detail: !ops && resolved.state === 'free_now' ? 'Work feed unavailable' : resolved.detail,
        presence: verified.state,
        schedule: `${person.work_start ?? '?'}–${person.work_end ?? '?'}${scheduleDate !== date ? ' · overnight' : ''}`,
        checkedInAt: verified.checkedInAt,
        checkedOutAt: verified.checkedOutAt,
        attention: needsReview ? 'Attendance needs review' : resolved.attention,
      };
    }).sort((a, b) => {
      const rank = (state: string) => state.startsWith('in_service') ? 0 : state === 'on_home_service' ? 1 :
        state === 'status_unavailable' || state === 'schedule_review' ? 2 : state === 'free_now' ? 3 :
        state === 'busy' ? 4 : state === 'starts_later' ? 5 : state === 'not_checked_in' ? 6 : 7;
      return rank(a.state) - rank(b.state) || a.name.localeCompare(b.name);
    }) : null;
  const attendanceRows = availability && attendance && exceptions ? availability.staff.map(person => {
    const verified = resolveVerifiedPresence(attendanceForDate(person.staff_id, date));
    const block = person.blocks.find(item => isTimeWithinScheduleWindows(nowTime.slice(11),
      [{ shiftType: 'single', startTime: item.start_time, endTime: item.end_time }]));
    return {
      id: person.staff_id,
      name: person.staff_name,
      state: hasAttendanceReview(person.staff_id, date) ? 'needs_review' as const : verified.state,
      at: verified.checkedOutAt ?? verified.checkedInAt,
      schedule: person.scheduleStatus === 'scheduled' ? `${person.work_start ?? '?'}–${person.work_end ?? '?'}` : person.scheduleStatus === 'no_schedule' ? 'Unscheduled' : person.scheduleStatus.replaceAll('_', ' '),
      block: block?.reason ?? null,
    };
  }).sort((a, b) => (b.at ?? '').localeCompare(a.at ?? '')) : null;

  const onlyOpenSession = cashSessions?.length === 1 ? cashSessions[0] : null;
  const cashDrawer: LiveCashDrawer | null = cashSessions ? {
    openCount: cashSessions.length,
    openedAt: onlyOpenSession?.opened_at ?? null,
    custodian: onlyOpenSession
      ? availability?.staff.find(person => person.staff_id === (onlyOpenSession.current_custodian_id ?? onlyOpenSession.opened_by))?.staff_name ?? null
      : null,
  } : null;
  const expenses: LiveExpenses | null = expenseTransactions ? {
    count: expenseTransactions.length,
    amount: expenseTransactions.reduce((total, tx) => total + (tx.financial_account_movements ?? []).reduce(
      (movementTotal: number, movement: { amount: number | string }) => movementTotal + Math.max(0, -Number(movement.amount)), 0), 0),
  } : null;

  // The CRM queue uses the branch business date. The map action uses its own
  // date and can swallow failures, so it supplies positions but not trip truth.
  const activeHomeService = ops?.queueData.filter(b => isHomeServiceVisit(b) &&
    ['travel_started', 'arrived', 'session_started'].includes(b.booking_progress_status ?? '') &&
    !b.session_completed_at && !['completed', 'cancelled', 'no_show', 'expired'].includes(b.status));
  if (tripsRaw === null || (activeHomeService?.length && tripsRaw.length < activeHomeService.length)) {
    errors.push('Some Home Service positions need verification');
  }
  const markers = new Map((tripsRaw ?? []).map(t => [t.id, t]));
  const trips = activeHomeService ? activeHomeService.map(b => {
    const marker = markers.get(b.id);
    return {
      id: b.id,
      driver: b.driver_name ?? marker?.driver_name ?? null,
      status: b.booking_progress_status ?? b.status,
      lastLocationAt: b.last_location_at ?? marker?.location?.recorded_at ?? null,
      lat: marker?.location?.lat ?? null,
      lng: marker?.location?.lng ?? null,
    };
  }) : null;

  // Only read configured rooms and their active utility turnover tasks; no write,
  // status repair, room-ready mutation, or fabrication of 'ready' without authority.
  let rooms: LiveRoom[] | null = null;
  try {
    const db = await createClient();
    const [resourceResult, turnoverResult, bookingResult] = await Promise.all([
      db.from('branch_resources').select('id,name,capacity,is_active', { count: 'exact' }).eq('branch_id', branchId),
      db.from('workflow_tasks')
        .select('entity_id,status,created_at', { count: 'exact' })
        .eq('branch_id', branchId)
        .eq('workspace_scope', 'utility')
        .eq('task_type', 'room_turnover')
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false }),
      db.from('bookings')
        .select('id,resource_id,booking_date,start_time,end_time,status,hold_expires_at,session_started_at,session_completed_at,type,delivery_type', { count: 'exact' })
        .eq('branch_id', branchId).gte('booking_date', previousDate)
        .lte('booking_date', date).not('resource_id', 'is', null),
    ]);
    if ([resourceResult, turnoverResult, bookingResult].some(result => result.error || result.count == null || result.count !== result.data?.length)) {
      throw new Error('Room reads denied/incomplete');
    }
    const taskByRoom = new Map<string, string>();
    for (const task of turnoverResult.data ?? []) {
      if (task.entity_id && !taskByRoom.has(task.entity_id)) taskByRoom.set(task.entity_id, task.status);
    }
    rooms = (resourceResult.data ?? []).map((r: { id: string; name: string; capacity: number | null; is_active: boolean }) => {
      const status = resolveRoomStatus({
        id: r.id, capacity: r.capacity, isActive: r.is_active,
        bookings: bookingResult.data ?? [],
        turnover: (taskByRoom.get(r.id) as 'open' | 'in_progress' | undefined) ?? null,
        date, time: getBranchClockTime(now, BRANCH_TIMEZONE), now,
      });
      return { id: r.id, name: r.name, capacity: r.capacity, ...status, booking: null };
    });
  } catch {
    errors.push('Room and cleaning status unavailable');
  }

  const nameByStaff = new Map((availability?.staff ?? []).map(person => [person.staff_id, person.staff_name]));
  const operationalIssues = buildOperationsIssues(exceptions ? {
    exceptions: exceptions.map(exception => ({
      ...exception,
      staff_name: exception.staff_id ? nameByStaff.get(exception.staff_id) ?? null : null,
    })),
  } : null, null, identityStaff);
  const missingEffectiveSchedules = availability?.staff.filter(person =>
    person.is_service_provider && !person.is_driver && person.scheduleStatus === 'no_schedule').length ?? null;
  const conflictingSchedules = availability?.staff.filter(person =>
    person.is_service_provider && !person.is_driver && person.scheduleStatus === 'conflict').length ?? null;
  const issueRows: LiveIssue[] = [
    ...(ops?.readinessAvailable ? ops.readinessIssues.filter(x => x.severity !== 'success' && (availability == null || x.scope !== 'schedule')).map(x => ({
      id: `readiness:${x.id}`, title: x.title, severity: x.severity as LiveIssue['severity'], category: x.scope,
      href: typeof x.actionHref === 'string' && x.actionHref.startsWith('/crm/') ? x.actionHref : '/crm/operations-center',
    })) : []),
    ...(missingEffectiveSchedules ? [{ id: 'schedule:missing-effective', title: `${missingEffectiveSchedules} therapists have no effective schedule today`,
      severity: 'warning' as const, category: 'schedule', href: '/crm/schedule?tab=setup' }] : []),
    ...(conflictingSchedules ? [{ id: 'schedule:conflict', title: `${conflictingSchedules} therapist schedules need conflict review`,
      severity: 'warning' as const, category: 'schedule', href: '/crm/schedule?tab=setup' }] : []),
    ...operationalIssues.map(issue => ({
      id: issue.id, title: issue.title, severity: issue.severity,
      category: /DEVICE|PHONE|BROWSER/i.test(issue.code ?? '') ? 'device' : issue.area,
      href: issue.actionHref.startsWith('/crm/') ? issue.actionHref : '/crm/operations-center',
    })),
    ...unscheduledConflicts.map(conflict => ({
      id: `schedule:active:${conflict.staffId}`,
      title: `${conflict.name}: active with ${conflict.reason}`,
      severity: 'warning' as const, category: 'schedule', href: '/crm/operations-center',
    })),
    ...(rooms ?? []).filter(room => room.state === 'status_unavailable' ||
      (room.occupied != null && room.occupied > 0 && ['cleaning', 'needs_cleaning'].includes(room.state))).map(room => ({
      id: `room:${room.id}`, title: `${room.name}: capacity or turnover needs review`,
      severity: 'warning' as const, category: 'resource', href: '/crm/spaces-rules',
    })),
    ...(liveBookings ?? []).filter(booking => booking.date === date && booking.attention.length > 0).map(booking => ({
      id: `booking:${booking.id}`, title: `${booking.service}: ${booking.attention[0]}`,
      severity: 'warning' as const, category: 'booking', href: '/crm/today?filter=needs_action',
    })),
  ];
  const severityRank = { critical: 0, warning: 1, info: 2 };
  const issues = ops?.readinessAvailable || availability || exceptions || identityStaff || rooms || unscheduledConflicts.length
    ? [...new Map(issueRows.map(issue => [issue.id, issue])).values()].sort((a, b) =>
        severityRank[a.severity] - severityRank[b.severity] || a.title.localeCompare(b.title))
    : null;

  const events: LiveEvent[] | null = ops ? ops.queueData.flatMap(b => {
    const e: LiveEvent[] = [];
    if (b.created_at) e.push({ id: b.id + ':created', at: b.created_at, title: 'Booking created', detail: b.service_name ?? 'Service' });
    if (b.session_started_at) e.push({ id: b.id + ':started', at: b.session_started_at, title: 'Service started', detail: b.service_name ?? 'Service' });
    if (b.session_completed_at) e.push({ id: b.id + ':ended', at: b.session_completed_at, title: 'Service completed', detail: b.service_name ?? 'Service' });
    return e;
  }).sort((a,b) => b.at.localeCompare(a.at)).slice(0, 5) : null;

  return {
    branch: branchName,
    businessDate: date,
    refreshedAt,
    bookings: liveBookings,
    summaryTotal: ops?.snapshot.bookingSummary.total ?? null,
    collectionToday: ops?.snapshot.payment?.total_collected ?? null,
    cashDrawer,
    expenses,
    staff,
    attendanceRows,
    rosterSummary: staff && ops ? summarizeScheduledRoster(staff) : null,
    availableCount: staff && ops ? staff.filter(person => person.state === 'free_now').length : null,
    rooms,
    roomsWithSpace: rooms && rooms.every(room => room.state !== 'status_unavailable')
      ? rooms.filter(room => room.available != null && room.available > 0).length : null,
    availableSpaces: rooms && rooms.every(room => room.state !== 'status_unavailable')
      ? rooms.reduce((total, room) => total + (room.available ?? 0), 0) : null,
    trips,
    issues,
    events,
    errors,
  };
}
