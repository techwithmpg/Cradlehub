import type { RoomState, TherapistState, VerifiedPresence } from './status';

export type LiveStage = 'upcoming' | 'waiting' | 'in_service' | 'ready_to_pay' | 'completed' | 'needs_attention';
export type LiveBooking = {
  id: string;
  date: string;
  time: string;
  name: string;
  service: string;
  therapist: string | null;
  room: string | null;
  stage: LiveStage;
  arrivalAt: string | null;
  dueAt: string | null;
  startedAt: string | null;
  durationMinutes: number | null;
  source: string | null;
  attention: string[];
  amountDue: number | null;
  paymentRef: string;
  homeService: boolean;
};
export type LiveStaff = {
  id: string;
  name: string;
  type: string;
  status: string;
  state: TherapistState;
  detail: string;
  presence: VerifiedPresence;
  schedule: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  attention: string | null;
};
export type LiveRoom = {
  id: string;
  name: string;
  state: RoomState;
  capacity: number | null;
  occupied: number | null;
  reserved: number | null;
  available: number | null;
  booking: string | null;
};
export type LiveAttendance = {
  id: string;
  name: string;
  state: VerifiedPresence;
  at: string | null;
  schedule: string;
  block: string | null;
};
export type LiveTrip = {
  id: string;
  driver: string | null;
  status: string;
  lastLocationAt: string | null;
  lat: number | null;
  lng: number | null;
  // Minimal map marker data; intentionally excludes customer name, phone, address, token.
};
export type LiveIssue = { id: string; title: string; severity: 'critical' | 'warning' | 'info'; href: string; category: string };
export type LiveEvent = { id: string; at: string; title: string; detail: string };
export type LiveCashDrawer = { openCount: number; openedAt: string | null; custodian: string | null };
export type LiveExpenses = { count: number; amount: number };
export type LiveRosterSummary = { scheduledToday: number; present: number; freeNow: number; inService: number; notCheckedIn: number };
export type LiveBoardData = {
  scenario?: 'fixture';
  branch: string;
  businessDate: string;
  refreshedAt: string;
  bookings: LiveBooking[] | null;
  summaryTotal: number | null;
  collectionToday: number | null;
  cashDrawer: LiveCashDrawer | null;
  expenses: LiveExpenses | null;
  staff: LiveStaff[] | null;
  rosterSummary: LiveRosterSummary | null;
  attendanceRows: LiveAttendance[] | null;
  availableCount: number | null;
  trips: LiveTrip[] | null;
  rooms: LiveRoom[] | null;
  roomsWithSpace: number | null;
  availableSpaces: number | null;
  issues: LiveIssue[] | null;
  events: LiveEvent[] | null;
  errors: string[];
};
