import { bookingBlocksAvailability } from '@/lib/bookings/hold-status';
import { isTimeWithinScheduleWindows } from '@/lib/schedule/resolve-staff-schedule';
import { getScheduleWindowAbsoluteRange } from '@/lib/schedule/schedule-coverage';
import { timeToMinutes } from '@/lib/utils/time-format';
import type { CrmAvailabilityStaffRow } from '@/lib/queries/crm-availability';
import type { CradleFlowBooking } from '@/lib/crm/cradle-flow';
import { getCradleFlowBalance, getCradleFlowPaymentStatus, isCradleFlowClosed, isServiceCompleted } from '@/lib/crm/cradle-flow';
import type { LiveStage } from './types';

export type AttendanceEvidence = {
  staff_id: string;
  status: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
};

export type VerifiedPresence = 'present' | 'checked_out' | 'not_checked_in' | 'needs_review';
export type TherapistState =
  | 'in_service' | 'in_service_verify_attendance' | 'on_home_service'
  | 'busy' | 'free_now' | 'not_checked_in' | 'checked_out'
  | 'starts_later' | 'off_duty' | 'no_schedule' | 'schedule_review' | 'status_unavailable';

function validTime(value: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function isWithinDatedWindows(params: {
  nowTime: string;
  scheduleDate: string;
  windows: Array<{ startTime: string; endTime: string; endsNextDay?: boolean }>;
}): boolean {
  const currentDate = params.nowTime.slice(0, 10);
  const minutes = timeToMinutes(params.nowTime.slice(11));
  if (minutes === null) return false;
  const dayOffset = Math.round((Date.parse(`${currentDate}T00:00:00Z`) - Date.parse(`${params.scheduleDate}T00:00:00Z`)) / 86400000);
  if (!Number.isFinite(dayOffset) || dayOffset < 0 || dayOffset > 1) return false;
  const absoluteMinutes = dayOffset * 1440 + minutes;
  return params.windows.some(window => {
    const range = getScheduleWindowAbsoluteRange(window);
    return range !== null && absoluteMinutes >= range.start && absoluteMinutes <= range.end;
  });
}

/** Latest successful attendance event wins, including a later clock-out. */
export function resolveVerifiedPresence(rows: AttendanceEvidence[]): {
  state: VerifiedPresence;
  checkedInAt: string | null;
  checkedOutAt: string | null;
} {
  const events: Array<{ at: number; state: Exclude<VerifiedPresence, 'not_checked_in'>; row: AttendanceEvidence }> = [];
  for (const row of rows) {
    if (row.status !== 'checked_in' && row.status !== 'checked_out') continue;
    const inTime = validTime(row.checked_in_at);
    if (inTime === null) continue;
    if (row.checked_out_at) {
      const outTime = validTime(row.checked_out_at);
      if (outTime === null || outTime < inTime) events.push({ at: inTime, state: 'needs_review', row });
      else events.push({ at: outTime, state: 'checked_out', row });
      continue;
    }
    events.push({ at: inTime, state: row.status === 'checked_out' ? 'needs_review' : 'present', row });
  }
  events.sort((a, b) => b.at - a.at || (a.state === 'checked_out' ? -1 : 1));
  const latest = events[0];
  return {
    state: latest?.state ?? 'not_checked_in',
    checkedInAt: latest?.row.checked_in_at ?? null,
    checkedOutAt: latest?.row.checked_out_at ?? null,
  };
}

export function isActualTreatment(booking: CradleFlowBooking): boolean {
  return Boolean(booking.session_started_at && !booking.session_completed_at &&
    !['completed', 'cancelled', 'no_show', 'expired'].includes(booking.status));
}

export function resolveLiveStage(booking: CradleFlowBooking): LiveStage | null {
  if (isCradleFlowClosed(booking)) return null;
  if (isServiceCompleted(booking)) {
    if (getCradleFlowPaymentStatus(booking) === 'paid') return 'completed';
    const totalKnown = booking.order_id ? booking.order_total_amount != null : booking.price_paid != null;
    if (!totalKnown) return 'needs_attention';
    return getCradleFlowBalance(booking) > 0 ? 'ready_to_pay' : 'needs_attention';
  }
  if (isActualTreatment(booking)) return 'in_service';
  if (booking.session_started_at || booking.booking_progress_status === 'session_started' || booking.status === 'in_progress') {
    return 'needs_attention';
  }
  if (['pending', 'pending_crm_confirmation', 'pending_payment'].includes(booking.status)) return 'needs_attention';
  if (booking.checked_in_at || ['checked_in', 'arrived'].includes(booking.booking_progress_status ?? '')) return 'waiting';
  return booking.status === 'confirmed' ? 'upcoming' : 'needs_attention';
}

function isHomeService(booking: CradleFlowBooking): boolean {
  return booking.type === 'home_service' || booking.delivery_type === 'home_service';
}

export function resolveTherapistStatus(params: {
  person: CrmAvailabilityStaffRow;
  presence: VerifiedPresence;
  bookings: CradleFlowBooking[];
  nowTime: string;
  scheduleDate?: string;
  now?: Date;
}): { state: TherapistState; detail: string; attention: string | null } {
  const { person, presence, nowTime } = params;
  const scheduleDate = params.scheduleDate ?? nowTime.slice(0, 10);
  const now = params.now ?? new Date();
  const assigned = params.bookings.filter((booking) => booking.staff_id === person.staff_id);
  const treatment = assigned.find(isActualTreatment);
  if (treatment) {
    return {
      state: presence === 'present' ? 'in_service' : 'in_service_verify_attendance',
      detail: isHomeService(treatment) ? 'Home Service' : `Spa${treatment.resource_name ? ` · ${treatment.resource_name}` : ''}`,
      attention: presence === 'present' ? null : 'Verify attendance',
    };
  }
  const traveling = assigned.find((booking) => isHomeService(booking) &&
    ['travel_started', 'arrived'].includes(booking.booking_progress_status ?? '') &&
    !booking.session_completed_at && !['cancelled', 'no_show', 'expired', 'completed'].includes(booking.status));
  if (traveling) return { state: 'on_home_service', detail: traveling.booking_progress_status === 'arrived' ? 'At customer' : 'Traveling', attention: presence === 'present' ? null : 'Verify attendance' };

  const currentAllocation = assigned.find((booking) =>
    (booking.booking_date === nowTime.slice(0, 10) || booking.booking_date === scheduleDate) &&
    !booking.session_completed_at &&
    !['completed', 'cancelled', 'no_show', 'expired'].includes(booking.status) &&
    bookingBlocksAvailability(booking, now) &&
    isWithinDatedWindows({ nowTime, scheduleDate: booking.booking_date, windows: [{ startTime: booking.start_time, endTime: booking.end_time ?? booking.start_time }] }));
  const currentBlock = person.blocks.find((block) => isTimeWithinScheduleWindows(nowTime.slice(11),
    [{ shiftType: 'single', startTime: block.start_time, endTime: block.end_time }]));
  if (currentAllocation || currentBlock) return {
    state: 'busy', detail: currentBlock?.reason ?? (currentAllocation ? 'Assigned booking' : 'Unavailable'),
    attention: presence === 'present' ? null : 'Verify attendance',
  };
  if (presence === 'needs_review') return { state: 'status_unavailable', detail: 'Attendance needs review', attention: 'Attendance needs review' };
  if (presence === 'checked_out') return { state: 'checked_out', detail: 'Shift ended', attention: null };
  if (person.scheduleStatus === 'conflict') return { state: 'schedule_review', detail: 'Schedule conflict', attention: 'Schedule needs review' };
  if (person.scheduleStatus === 'no_schedule' || person.scheduleStatus === 'off_today') {
    return presence === 'present'
      ? { state: 'schedule_review', detail: 'Present · Unscheduled', attention: 'Schedule needs review' }
      : person.scheduleStatus === 'off_today'
        ? { state: 'off_duty', detail: 'Day off', attention: null }
        : { state: 'no_schedule', detail: 'Schedule setup needed', attention: 'Schedule needed' };
  }
  if (!isWithinDatedWindows({ nowTime, scheduleDate, windows: person.shifts.map(shift => ({
    startTime: shift.start_time, endTime: shift.end_time,
  })) })) {
    const startsLater = scheduleDate === nowTime.slice(0, 10) && person.shifts.some((shift) => shift.start_time > nowTime.slice(11));
    return { state: startsLater ? 'starts_later' : 'off_duty', detail: startsLater ? 'Shift starts later' : 'Outside working hours', attention: null };
  }
  if (presence !== 'present') return { state: 'not_checked_in', detail: 'Scheduled · Not checked in', attention: null };
  return { state: 'free_now', detail: 'Present · In working hours', attention: null };
}

export type RoomBooking = {
  id: string;
  resource_id: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  hold_expires_at: string | null;
  session_started_at: string | null;
  session_completed_at: string | null;
  type: string | null;
  delivery_type: string | null;
};
export type RoomState = 'ready' | 'partially_available' | 'full' | 'needs_cleaning' | 'cleaning' | 'unavailable' | 'status_unavailable';

export function resolveRoomStatus(params: {
  id: string;
  capacity: number | null;
  isActive: boolean;
  bookings: RoomBooking[];
  turnover: 'open' | 'in_progress' | null;
  date: string;
  time: string;
  now?: Date;
}): { state: RoomState; occupied: number | null; reserved: number | null; available: number | null } {
  if (!params.isActive) return { state: 'unavailable', occupied: null, reserved: null, available: null };
  const capacity = params.capacity;
  if (capacity == null || !Number.isInteger(capacity) || capacity < 1) return { state: 'status_unavailable', occupied: null, reserved: null, available: null };
  const now = params.now ?? new Date();
  const current = params.bookings.filter((booking) => booking.resource_id === params.id &&
    booking.type !== 'home_service' && booking.delivery_type !== 'home_service');
  const occupiedLines = current.filter((booking) => booking.session_started_at && !booking.session_completed_at &&
    !['cancelled', 'no_show', 'expired', 'completed'].includes(booking.status));
  const allocatedLines = current.filter((booking) => booking.booking_date === params.date && bookingBlocksAvailability(booking, now) &&
    isTimeWithinScheduleWindows(params.time, [{ shiftType: 'single', startTime: booking.start_time, endTime: booking.end_time }]));
  const occupied = occupiedLines.length;
  const reserved = allocatedLines.length;
  const used = new Set([...occupiedLines, ...allocatedLines].map((booking) => booking.id)).size;
  if (used > capacity) return { state: 'status_unavailable', occupied, reserved, available: null };
  const available = Math.max(0, capacity - used);
  if (params.turnover === 'in_progress') return { state: 'cleaning', occupied, reserved, available: 0 };
  if (params.turnover === 'open') return { state: 'needs_cleaning', occupied, reserved, available: 0 };
  return { state: used === 0 ? 'ready' : available === 0 ? 'full' : 'partially_available', occupied, reserved, available };
}
