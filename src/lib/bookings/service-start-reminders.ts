export type ServiceStartCandidate = {
  id: string;
  booking_date: string;
  start_time: string;
  status: string;
  booking_progress_status?: string | null;
  session_started_at?: string | null;
  staff_id?: string | null;
  resource_id?: string | null;
  delivery_type?: string | null;
};

export type ServiceStartReminder = {
  bookingId: string;
  recipientName: string;
  serviceName: string;
  durationMinutes: number;
  scheduledStart: string;
  scheduledAtIso: string;
  therapistName: string;
  roomName: string;
  groupReference?: string | null;
};

const MANILA_OFFSET = "+08:00";
const REMINDER_LEAD_MS = 2 * 60_000;
const REMINDER_LATE_MS = 15 * 60_000;

export function scheduledStartMs(candidate: Pick<ServiceStartCandidate, "booking_date" | "start_time">): number {
  const time = candidate.start_time.slice(0, 8);
  const normalized = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
  if (!/^\d{2}:\d{2}:\d{2}$/.test(normalized)) return Number.NaN;
  return Date.parse(`${candidate.booking_date}T${normalized}${MANILA_OFFSET}`);
}

export function isServiceStartReminderEligible(candidate: ServiceStartCandidate, serverNowMs: number): boolean {
  if (candidate.status !== "confirmed" || candidate.delivery_type === "home_service") return false;
  if (!candidate.staff_id || !candidate.resource_id || candidate.session_started_at) return false;
  const progress = candidate.booking_progress_status;
  if (progress && !["confirmed", "not_started", "checked_in", "arrived"].includes(progress)) return false;
  const start = scheduledStartMs(candidate);
  return Number.isFinite(start) && serverNowMs >= start - REMINDER_LEAD_MS && serverNowMs <= start + REMINDER_LATE_MS;
}

export function serviceStartReminderQueue<T extends ServiceStartCandidate>(candidates: T[], serverNowMs: number): T[] {
  return candidates.filter((candidate) => isServiceStartReminderEligible(candidate, serverNowMs))
    .sort((a, b) => scheduledStartMs(a) - scheduledStartMs(b) || a.id.localeCompare(b.id));
}

/** Scheduled phone reminders are sent only before start; late CRM dialogs remain in-app. */
export function isTherapistStartPushEligible(candidate: ServiceStartCandidate, serverNowMs: number): boolean {
  const start = scheduledStartMs(candidate);
  return isServiceStartReminderEligible(candidate, serverNowMs)
    && Number.isFinite(start)
    && serverNowMs < start;
}
