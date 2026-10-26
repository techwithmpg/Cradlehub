import type { CrmAvailabilitySnapshot, CrmAvailabilityStaffRow } from '@/lib/queries/crm-availability';
import type { DailyScheduleStaffRow } from '@/lib/queries/schedule';
import type { LiveStaff } from './types';
import type { CradleFlowBooking } from '@/lib/crm/cradle-flow';
import { bookingBlocksAvailability } from '@/lib/bookings/hold-status';
import { isActualTreatment, isWithinDatedWindows, resolveVerifiedPresence, type AttendanceEvidence } from './status';

export type ScheduledProvider = { person: CrmAvailabilityStaffRow; scheduleDate: string };

/** Include today's resolved shifts and a prior-day overnight shift only while it is active. */
export function selectScheduledProviders(params: {
  availability: CrmAvailabilitySnapshot;
  branchId: string;
  nowTime: string;
  previousDate: string;
  previousSchedule: DailyScheduleStaffRow[];
}): ScheduledProvider[] | null {
  if (params.availability.branchId !== params.branchId || params.availability.date !== params.nowTime.slice(0, 10)) return null;
  const previousByStaff = new Map(params.previousSchedule.map(row => [row.staff_id, row]));
  return params.availability.staff.flatMap(person => {
    if (!person.is_service_provider || person.is_driver) return [];
    const previous = previousByStaff.get(person.staff_id);
    if (previous?.schedule_status === 'resolved' && !previous.schedule_is_day_off &&
        previous.schedule_windows.some(window => window.endsNextDay ?? window.endTime <= window.startTime) &&
        isWithinDatedWindows({ nowTime: params.nowTime, scheduleDate: params.previousDate, windows: previous.schedule_windows })) {
      return [{
        person: {
          ...person,
          scheduleStatus: 'scheduled' as const,
          work_start: previous.work_start,
          work_end: previous.work_end,
          shifts: previous.schedule_windows.map(window => ({
            shift_type: window.shiftType,
            start_time: window.startTime,
            end_time: window.endTime,
          })),
          blocks: previous.blocks.map(block => ({
            start_time: block.start_time,
            end_time: block.end_time,
            reason: block.reason,
          })),
        },
        scheduleDate: params.previousDate,
      }];
    }
    if (person.scheduleStatus === 'scheduled' && person.shifts.length > 0) {
      return [{ person, scheduleDate: params.availability.date }];
    }
    return [];
  });
}

export function summarizeScheduledRoster(staff: LiveStaff[]) {
  return {
    scheduledToday: staff.length,
    present: staff.filter(person => person.presence === 'present').length,
    freeNow: staff.filter(person => person.state === 'free_now').length,
    inService: staff.filter(person => person.state === 'in_service' || person.state === 'in_service_verify_attendance').length,
    notCheckedIn: staff.filter(person => person.presence === 'not_checked_in').length,
  };
}

export function findUnscheduledProviderConflicts(params: {
  availability: CrmAvailabilitySnapshot;
  attendanceByStaff: Map<string, AttendanceEvidence[]>;
  bookings: CradleFlowBooking[];
  nowTime: string;
  now: Date;
  scheduledIds?: Set<string>;
}) {
  const scheduledIds = params.scheduledIds ?? new Set(params.availability.staff.filter(person =>
    person.is_service_provider && !person.is_driver && person.scheduleStatus === 'scheduled' && person.shifts.length > 0
  ).map(person => person.staff_id));
  return params.availability.staff.flatMap(person => {
    if (!person.is_service_provider || person.is_driver || scheduledIds.has(person.staff_id)) return [];
    const present = resolveVerifiedPresence(params.attendanceByStaff.get(person.staff_id) ?? []).state === 'present';
    const activeBookings = params.bookings.filter(booking => booking.staff_id === person.staff_id &&
      !['completed', 'cancelled', 'no_show', 'expired'].includes(booking.status) &&
      (isActualTreatment(booking) || ['travel_started', 'arrived'].includes(booking.booking_progress_status ?? '') ||
        (bookingBlocksAvailability(booking, params.now) && isWithinDatedWindows({
          nowTime: params.nowTime, scheduleDate: booking.booking_date,
          windows: [{ startTime: booking.start_time, endTime: booking.end_time ?? booking.start_time }],
        }))));
    if (!present && activeBookings.length === 0) return [];
    return [{ staffId: person.staff_id, name: person.staff_name, bookingIds: activeBookings.map(booking => booking.id),
      reason: person.scheduleStatus === 'off_today' ? 'day off' : person.scheduleStatus === 'conflict' ? 'schedule conflict' : 'no effective schedule' }];
  });
}
