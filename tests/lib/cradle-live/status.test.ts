import { describe, expect, it } from 'vitest';
import type { CrmAvailabilityStaffRow } from '@/lib/queries/crm-availability';
import type { CradleFlowBooking } from '@/lib/crm/cradle-flow';
import {
  resolveLiveStage, resolveRoomStatus, resolveTherapistStatus, resolveVerifiedPresence,
  type RoomBooking,
} from '@/lib/cradle-live/status';

const now = new Date('2026-10-26T02:00:00.000Z');
const nowTime = '2026-10-26T10:00:00';
const person = (changes: Partial<CrmAvailabilityStaffRow> = {}) => ({
  staff_id: 'therapist-1', scheduleStatus: 'scheduled',
  shifts: [{ shift_type: 'single', start_time: '09:00:00', end_time: '18:00:00' }],
  blocks: [], ...changes,
} as CrmAvailabilityStaffRow);
const booking = (changes: Partial<CradleFlowBooking> = {}) => ({
  id: 'booking-1', staff_id: 'therapist-1', booking_date: '2026-10-26',
  start_time: '09:30:00', end_time: '10:30:00', status: 'confirmed',
  booking_progress_status: 'not_started', type: 'in_spa', delivery_type: 'in_spa',
  session_started_at: null, session_completed_at: null, price_paid: 500,
  ...changes,
} as CradleFlowBooking);
const therapistStatus = (params: {
  presence?: 'present' | 'not_checked_in' | 'checked_out' | 'needs_review';
  bookings?: CradleFlowBooking[];
  staff?: CrmAvailabilityStaffRow;
}) => resolveTherapistStatus({
  person: params.staff ?? person(), presence: params.presence ?? 'present',
  bookings: params.bookings ?? [], nowTime, now,
}).state;
const roomBooking = (changes: Partial<RoomBooking> = {}): RoomBooking => ({
  id: 'line-1', resource_id: 'room-1', booking_date: '2026-10-26',
  start_time: '09:00:00', end_time: '11:00:00', status: 'confirmed', hold_expires_at: null,
  session_started_at: '2026-10-26T01:00:00.000Z', session_completed_at: null,
  type: 'in_spa', delivery_type: 'in_spa', ...changes,
});
const roomStatus = (capacity: number | null, bookings: RoomBooking[] = [], changes: { isActive?: boolean; turnover?: 'open' | 'in_progress' | null } = {}) =>
  resolveRoomStatus({ id: 'room-1', capacity, bookings, isActive: changes.isActive ?? true,
    turnover: changes.turnover ?? null, date: '2026-10-26', time: '10:00:00', now });

describe('Cradle Live verified staff state', () => {
  it('never turns a schedule or paused enforcement into physical presence', () => {
    expect(resolveVerifiedPresence([]).state).toBe('not_checked_in');
    expect(therapistStatus({ presence: 'not_checked_in' })).toBe('not_checked_in');
  });
  it('allows only present, unblocked staff in the active shift to be free', () => {
    expect(therapistStatus({})).toBe('free_now');
    expect(therapistStatus({ staff: person({ blocks: [{ start_time: '09:45:00', end_time: '10:30:00', reason: 'Break' }] }) })).toBe('busy');
    expect(therapistStatus({ staff: person({ shifts: [{ shift_type: 'single', start_time: '11:00:00', end_time: '18:00:00' }] }) })).toBe('starts_later');
  });
  it('uses successful event chronology so a later clock-out wins', () => {
    expect(resolveVerifiedPresence([
      { staff_id: 'therapist-1', status: 'checked_in', checked_in_at: '2026-10-26T00:00:00Z', checked_out_at: null },
      { staff_id: 'therapist-1', status: 'checked_out', checked_in_at: '2026-10-26T00:00:00Z', checked_out_at: '2026-10-26T01:00:00Z' },
    ]).state).toBe('checked_out');
    expect(resolveVerifiedPresence([{ staff_id: 'therapist-1', status: 'failed', checked_in_at: '2026-10-26T02:00:00Z', checked_out_at: null }]).state).toBe('not_checked_in');
    expect(therapistStatus({ presence: 'checked_out' })).toBe('checked_out');
  });
  it('prioritizes actual treatment and Home Service travel above free', () => {
    const started = booking({ status: 'in_progress', session_started_at: '2026-10-26T01:30:00Z' });
    expect(therapistStatus({ bookings: [started] })).toBe('in_service');
    expect(therapistStatus({ bookings: [started], presence: 'checked_out' })).toBe('in_service_verify_attendance');
    expect(therapistStatus({ bookings: [booking({ ...started, type: 'home_service', delivery_type: 'home_service' })] })).toBe('in_service');
    expect(therapistStatus({ bookings: [booking({ type: 'home_service', delivery_type: 'home_service', booking_progress_status: 'travel_started' })] })).toBe('on_home_service');
  });
  it('blocks overlapping allocations but releases completed work', () => {
    expect(therapistStatus({ bookings: [booking()] })).toBe('busy');
    expect(therapistStatus({ bookings: [booking({ status: 'completed', session_completed_at: '2026-10-26T01:45:00Z' })] })).toBe('free_now');
    expect(therapistStatus({ bookings: [booking({ type: 'home_service', delivery_type: 'home_service',
      booking_progress_status: 'completed', status: 'completed', session_started_at: '2026-10-26T00:30:00Z',
      session_completed_at: '2026-10-26T01:45:00Z' })] })).toBe('free_now');
  });
  it('retains verified presence while flagging a missing schedule', () => {
    expect(therapistStatus({ staff: person({ scheduleStatus: 'no_schedule', shifts: [] }) })).toBe('schedule_review');
    expect(therapistStatus({ staff: person({ scheduleStatus: 'no_schedule', shifts: [] }), presence: 'not_checked_in' })).toBe('no_schedule');
    expect(therapistStatus({ staff: person({ scheduleStatus: 'conflict' }) })).toBe('schedule_review');
  });
});

describe('Cradle Live room capacity', () => {
  it('distinguishes ready, partial and full capacity', () => {
    expect(roomStatus(1).state).toBe('ready');
    expect(roomStatus(1, [roomBooking()]).state).toBe('full');
    expect(roomStatus(3, [roomBooking()])).toMatchObject({ state: 'partially_available', occupied: 1, available: 2 });
    expect(roomStatus(3, [roomBooking(), roomBooking({ id: 'line-2' })])).toMatchObject({ state: 'partially_available', occupied: 2, available: 1 });
    expect(roomStatus(3, [roomBooking(), roomBooking({ id: 'line-2' }), roomBooking({ id: 'line-3' })])).toMatchObject({ state: 'full', occupied: 3, available: 0 });
  });
  it('keeps future reservations distinct from current occupancy', () => {
    expect(roomStatus(1, [roomBooking({ start_time: '13:00:00', end_time: '14:00:00', session_started_at: null })])).toMatchObject({ state: 'ready', occupied: 0 });
    expect(roomStatus(2, [
      roomBooking({ id: 'overtime', start_time: '08:00:00', end_time: '09:00:00' }),
      roomBooking({ id: 'current', session_started_at: null }),
    ])).toMatchObject({ state: 'full', occupied: 1, reserved: 1, available: 0 });
    expect(roomStatus(2, [roomBooking({ booking_date: '2026-10-25', start_time: '23:00:00', end_time: '01:00:00' })])).toMatchObject({ state: 'partially_available', occupied: 1, available: 1 });
  });
  it('applies whole-room turnover and unknown configuration conservatively', () => {
    expect(roomStatus(3, [], { turnover: 'in_progress' })).toMatchObject({ state: 'cleaning', available: 0 });
    expect(roomStatus(3, [], { turnover: 'open' }).state).toBe('needs_cleaning');
    expect(roomStatus(3, [], { isActive: false }).state).toBe('unavailable');
    expect(roomStatus(null).state).toBe('status_unavailable');
  });
  it('excludes Home Service and expired holds from room occupancy', () => {
    expect(roomStatus(1, [roomBooking({ type: 'home_service', delivery_type: 'home_service' })]).state).toBe('ready');
    expect(roomStatus(1, [roomBooking({ status: 'pending_payment', session_started_at: null, hold_expires_at: '2026-10-26T00:00:00Z' })]).state).toBe('ready');
  });
});

describe('Cradle Live lifecycle', () => {
  it('places confirmed, arrived, actually started and completed lines once', () => {
    expect(resolveLiveStage(booking())).toBe('upcoming');
    expect(resolveLiveStage(booking({ checked_in_at: '2026-10-26T01:30:00Z' }))).toBe('waiting');
    expect(resolveLiveStage(booking({ status: 'in_progress', session_started_at: '2026-10-26T01:40:00Z' }))).toBe('in_service');
    expect(resolveLiveStage(booking({ status: 'completed', session_completed_at: '2026-10-26T01:45:00Z', payment_status: 'unpaid' }))).toBe('ready_to_pay');
    expect(resolveLiveStage(booking({ status: 'completed', session_completed_at: '2026-10-26T01:45:00Z', payment_status: 'paid' }))).toBe('completed');
  });
  it('does not treat pending confirmation or missing session evidence as in service', () => {
    expect(resolveLiveStage(booking({ status: 'pending_crm_confirmation' }))).toBe('needs_attention');
    expect(resolveLiveStage(booking({ status: 'in_progress', session_started_at: null }))).toBe('needs_attention');
  });
});
