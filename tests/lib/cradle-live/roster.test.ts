import { describe, expect, it } from 'vitest';
import type { CrmAvailabilitySnapshot, CrmAvailabilityStaffRow } from '@/lib/queries/crm-availability';
import type { DailyScheduleStaffRow } from '@/lib/queries/schedule';
import type { CradleFlowBooking } from '@/lib/crm/cradle-flow';
import type { LiveStaff } from '@/lib/cradle-live/types';
import { findUnscheduledProviderConflicts, selectScheduledProviders, summarizeScheduledRoster } from '@/lib/cradle-live/roster';
import { isWithinDatedWindows, resolveTherapistStatus, type AttendanceEvidence } from '@/lib/cradle-live/status';

const date = '2026-10-26';
const nowTime = `${date}T10:00:00`;
const now = new Date('2026-10-26T02:00:00.000Z');
const staff = (id: string, changes: Partial<CrmAvailabilityStaffRow> = {}) => ({
  staff_id: id, staff_name: id, staff_type: 'therapist', system_role: 'therapist',
  is_service_provider: true, is_driver: false, scheduleStatus: 'scheduled',
  shifts: [{ shift_type: 'single', start_time: '09:00:00', end_time: '18:00:00' }],
  work_start: '09:00:00', work_end: '18:00:00', blocks: [], ...changes,
} as CrmAvailabilityStaffRow);
const snapshot = (rows: CrmAvailabilityStaffRow[], changes: Partial<CrmAvailabilitySnapshot> = {}) => ({
  branchId: 'main-spa', date, staff: rows, ...changes,
} as CrmAvailabilitySnapshot);
const previous = (id: string, start = '22:00:00', end = '02:00:00') => ({
  staff_id: id, schedule_status: 'resolved', schedule_is_day_off: false,
  schedule_windows: [{ shiftType: 'single', startTime: start, endTime: end, endsNextDay: true }],
  work_start: start, work_end: end, blocks: [],
} as unknown as DailyScheduleStaffRow);
const booking = (id: string, staffId: string, changes: Partial<CradleFlowBooking> = {}) => ({
  id, staff_id: staffId, booking_date: date, start_time: '09:30:00', end_time: '10:30:00',
  status: 'confirmed', booking_progress_status: 'not_started', type: 'in_spa', delivery_type: 'in_spa',
  session_started_at: null, session_completed_at: null, ...changes,
} as CradleFlowBooking);

describe('Cradle Live business-day provider roster', () => {
  it('includes only branch-authorized service providers with a valid shift', () => {
    const rows = [staff('scheduled'), staff('later', { shifts: [{ shift_type: 'single', start_time: '13:00:00', end_time: '21:00:00' }] }),
      staff('unscheduled', { scheduleStatus: 'no_schedule', shifts: [] }),
      staff('day-off', { scheduleStatus: 'off_today', shifts: [] }),
      staff('conflict', { scheduleStatus: 'conflict' }),
      staff('driver', { is_driver: true }), staff('cashier', { is_service_provider: false })];
    const result = selectScheduledProviders({ availability: snapshot(rows), branchId: 'main-spa', nowTime, previousDate: '2026-10-25', previousSchedule: [] });
    expect(result?.map(entry => entry.person.staff_id)).toEqual(['scheduled', 'later']);
    expect(selectScheduledProviders({ availability: snapshot(rows, { branchId: 'other' }), branchId: 'main-spa', nowTime, previousDate: '2026-10-25', previousSchedule: [] })).toBeNull();
  });
  it('labels a future shift Starts Later even without a scan; a current shift needs a scan', () => {
    const later = staff('later', { shifts: [{ shift_type: 'single', start_time: '13:00:00', end_time: '21:00:00' }] });
    expect(resolveTherapistStatus({ person: later, presence: 'not_checked_in', bookings: [], nowTime, now }).state).toBe('starts_later');
    expect(resolveTherapistStatus({ person: staff('current'), presence: 'not_checked_in', bookings: [], nowTime, now }).state).toBe('not_checked_in');
    expect(resolveTherapistStatus({ person: staff('current'), presence: 'present', bookings: [], nowTime, now }).state).toBe('free_now');
  });
  it('counts yesterday’s overnight shift only while its actual window carries over', () => {
    const rows = [staff('overnight', { scheduleStatus: 'off_today', shifts: [] })];
    const atOne = `${date}T01:00:00`;
    const atThree = `${date}T03:00:00`;
    expect(selectScheduledProviders({ availability: snapshot(rows), branchId: 'main-spa', nowTime: atOne, previousDate: '2026-10-25', previousSchedule: [previous('overnight')] })?.[0]?.scheduleDate).toBe('2026-10-25');
    expect(selectScheduledProviders({ availability: snapshot([staff('overnight', { shifts: [{ shift_type: 'single', start_time: '22:00:00', end_time: '02:00:00' }] })]), branchId: 'main-spa', nowTime: atOne, previousDate: '2026-10-25', previousSchedule: [previous('overnight')] })?.[0]?.scheduleDate).toBe('2026-10-25');
    expect(selectScheduledProviders({ availability: snapshot(rows), branchId: 'main-spa', nowTime: atThree, previousDate: '2026-10-25', previousSchedule: [previous('overnight')] })).toEqual([]);
    expect(isWithinDatedWindows({ nowTime: atOne, scheduleDate: date, windows: [{ startTime: '22:00:00', endTime: '02:00:00' }] })).toBe(false);
    expect(isWithinDatedWindows({ nowTime: atOne, scheduleDate: '2026-10-25', windows: [{ startTime: '22:00:00', endTime: '02:00:00' }] })).toBe(true);
  });
  it('retains split-shift break and clock-out as non-free states', () => {
    const split = staff('split', { shifts: [
      { shift_type: 'opening', start_time: '07:00:00', end_time: '09:00:00' },
      { shift_type: 'closing', start_time: '12:00:00', end_time: '18:00:00' },
    ] });
    expect(resolveTherapistStatus({ person: split, presence: 'present', bookings: [], nowTime, now }).state).toBe('starts_later');
    expect(resolveTherapistStatus({ person: split, presence: 'checked_out', bookings: [], nowTime, now }).state).toBe('checked_out');
  });
  it('keeps active unscheduled service and successful presence in the exception path', () => {
    const unscheduled = staff('unscheduled', { scheduleStatus: 'no_schedule', shifts: [] });
    const attendance = new Map<string, AttendanceEvidence[]>([['unscheduled', [{ staff_id: 'unscheduled', status: 'checked_in', checked_in_at: '2026-10-26T01:00:00Z', checked_out_at: null }]]]);
    const conflicts = findUnscheduledProviderConflicts({ availability: snapshot([unscheduled]), attendanceByStaff: attendance,
      bookings: [booking('session-1', 'unscheduled', { status: 'in_progress', session_started_at: '2026-10-26T01:30:00Z' })], nowTime, now });
    expect(conflicts).toMatchObject([{ staffId: 'unscheduled', bookingIds: ['session-1'] }]);
    expect(selectScheduledProviders({ availability: snapshot([unscheduled]), branchId: 'main-spa', nowTime, previousDate: '2026-10-25', previousSchedule: [] })).toEqual([]);
  });
  it('derives summary counters from the same filtered roster', () => {
    const rows = [
      { id: 'a', presence: 'present', state: 'free_now' },
      { id: 'b', presence: 'present', state: 'in_service' },
      { id: 'c', presence: 'not_checked_in', state: 'starts_later' },
      { id: 'd', presence: 'checked_out', state: 'checked_out' },
    ] as LiveStaff[];
    expect(summarizeScheduledRoster(rows)).toEqual({ scheduledToday: 4, present: 2, freeNow: 1, inService: 1, notCheckedIn: 1 });
  });
});
