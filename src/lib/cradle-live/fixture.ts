import 'server-only';
import { BRANCH_TIMEZONE, getBranchBusinessDate } from '@/lib/engine/slot-time';
import { branchDateTimeToIsoInTimezone } from '@/lib/attendance/shift-instance';
import type { LiveBoardData, LiveBooking, LiveStaff } from './types';
import { summarizeScheduledRoster } from './roster';

/** Development-only visual fixture. Every label is synthetic; no database reads or writes. */
export function createPopulatedCradleLiveFixture(branchName: string, now = new Date()): LiveBoardData {
  const date = getBranchBusinessDate(now, BRANCH_TIMEZONE);
  const scenarioAt = new Date(branchDateTimeToIsoInTimezone({ date, time: '10:00:00', timezone: BRANCH_TIMEZONE }));
  const iso = (offsetMinutes: number) => new Date(scenarioAt.getTime() + offsetMinutes * 60000).toISOString();
  const base: Omit<LiveBooking, 'id' | 'name' | 'service' | 'stage'> = {
    date, time: '10:00:00', therapist: null, room: null, arrivalAt: null, dueAt: null,
    startedAt: null, durationMinutes: null, source: null, attention: [], amountDue: null,
    paymentRef: '', homeService: false,
  };
  const bookings: LiveBooking[] = [
    { ...base, id: 'sample-upcoming', name: 'Sample Guest A', service: 'Massage', stage: 'upcoming',
      time: '13:00:00', therapist: 'Sample Therapist A', room: 'Room A', paymentRef: 'sample-order-a' },
    { ...base, id: 'sample-guest-one', name: 'Sample Guest B', service: 'Body Treatment', stage: 'in_service',
      time: '09:00:00', therapist: 'Sample Therapist B', room: 'Room B', arrivalAt: iso(-32),
      startedAt: iso(-18), dueAt: iso(42), durationMinutes: 60, paymentRef: 'sample-group-order' },
    { ...base, id: 'sample-guest-two', name: 'Sample Guest C', service: 'Facial', stage: 'waiting',
      time: '11:30:00', therapist: 'Sample Therapist A', room: 'Room B', arrivalAt: iso(-12),
      paymentRef: 'sample-group-order', attention: ['Prepare treatment space'] },
    { ...base, id: 'sample-unassigned', name: 'Sample Guest D', service: 'Nail Care', stage: 'needs_attention',
      time: '11:00:00', room: 'Room C', paymentRef: 'sample-order-d', attention: ['Therapist not assigned'] },
    { ...base, id: 'sample-pay', name: 'Sample Guest E', service: 'Aromatherapy', stage: 'ready_to_pay',
      time: '08:00:00', therapist: 'Sample Therapist C', room: 'Room A', paymentRef: 'sample-order-e', amountDue: 800 },
    { ...base, id: 'sample-done', name: 'Sample Guest F', service: 'Wellness Session', stage: 'completed',
      time: '07:30:00', therapist: 'Sample Therapist D', room: 'Room C', paymentRef: 'sample-order-f' },
  ];
  const staff: LiveStaff[] = [
    { id: 'sample-staff-a', name: 'Sample Therapist A', type: 'therapist', status: 'free_now', state: 'free_now',
      detail: 'Present · In working hours', presence: 'present', schedule: '09:00–18:00',
      checkedInAt: iso(-90), checkedOutAt: null, attention: null },
    { id: 'sample-staff-b', name: 'Sample Therapist B', type: 'therapist', status: 'in_service', state: 'in_service',
      detail: 'Spa · Room B', presence: 'present', schedule: '09:00–18:00',
      checkedInAt: iso(-95), checkedOutAt: null, attention: null },
    { id: 'sample-staff-c', name: 'Sample Therapist C', type: 'therapist', status: 'starts_later', state: 'starts_later',
      detail: 'Shift starts later', presence: 'not_checked_in', schedule: '13:00–21:00',
      checkedInAt: null, checkedOutAt: null, attention: null },
    { id: 'sample-staff-d', name: 'Sample Therapist D', type: 'therapist', status: 'checked_out', state: 'checked_out',
      detail: 'Shift ended', presence: 'checked_out', schedule: '06:00–09:00',
      checkedInAt: iso(-160), checkedOutAt: iso(-20), attention: null },
  ];
  return {
    scenario: 'fixture', branch: `${branchName} · sample scenario`, businessDate: date,
    refreshedAt: scenarioAt.toISOString(), bookings, summaryTotal: bookings.length, collectionToday: 1400,
    cashDrawer: { openCount: 1, openedAt: iso(-120), custodian: 'Sample Cashier' },
    expenses: { count: 2, amount: 230 }, staff, rosterSummary: summarizeScheduledRoster(staff),
    attendanceRows: staff.map(person => ({ id: person.id, name: person.name, state: person.presence,
      at: person.checkedOutAt ?? person.checkedInAt, schedule: person.schedule, block: null })),
    availableCount: 1,
    trips: [{ id: 'sample-home-trip', driver: 'Sample Driver', status: 'travel_started',
      lastLocationAt: iso(-7), lat: 14.5995, lng: 120.9842 }],
    rooms: [
      { id: 'sample-room-a', name: 'Room A', state: 'partially_available', capacity: 3, occupied: 1, reserved: 1, available: 2, booking: null },
      { id: 'sample-room-b', name: 'Room B', state: 'partially_available', capacity: 3, occupied: 2, reserved: 2, available: 1, booking: null },
      { id: 'sample-room-c', name: 'Room C', state: 'full', capacity: 1, occupied: 1, reserved: 1, available: 0, booking: null },
      { id: 'sample-room-d', name: 'Room D', state: 'cleaning', capacity: 2, occupied: 0, reserved: 0, available: 0, booking: null },
    ],
    roomsWithSpace: 2, availableSpaces: 3,
    issues: [
      { id: 'sample-issue-service', title: 'Nail Care needs a therapist', severity: 'critical', href: '/crm/services', category: 'service' },
      { id: 'sample-issue-attendance', title: 'Sample Therapist E: attendance needs review', severity: 'warning', href: '/crm/attendance', category: 'attendance' },
      { id: 'sample-issue-duplicate', title: 'Potential duplicate staff profile', severity: 'warning', href: '/crm/operations-center', category: 'staff_identity' },
      { id: 'sample-issue-device', title: 'Sample phone needs recovery', severity: 'warning', href: '/crm/attendance', category: 'device' },
    ],
    events: [
      { id: 'sample-event-a', at: iso(-18), title: 'Service started', detail: 'Sample Guest B' },
      { id: 'sample-event-b', at: iso(-12), title: 'Guest arrived', detail: 'Sample Guest C' },
    ],
    errors: [],
  };
}
