import { getScheduleWindowAbsoluteRange } from "@/lib/schedule/schedule-coverage";
import type { ResolvedStaffSchedule } from "@/lib/schedule/resolve-staff-schedule";

/** Only online requests awaiting a CSR decision; payment holds remain separate. */
export const PENDING_CRM_BOOKING_STATUS = "pending_crm_confirmation";
export const PENDING_CRM_REMINDER_MS = 10 * 60_000;
export const PENDING_CRM_SNAPSHOT_LIMIT = 100;

export type PendingCrmBooking = {
  id: string;
  bookingDate: string;
  startTime: string;
  createdAt: string;
  customerName: string;
  serviceName: string;
};

export type PendingCrmBookingSnapshot = {
  ok: boolean;
  pendingCount: number;
  onDuty: boolean;
  first: PendingCrmBooking | null;
  checkedAt: string;
  error?: string;
};

export type PendingBookingPresentation = "none" | "single" | "group";

/**
 * The schedule is an eligibility boundary, not proof that somebody is at the desk.
 * A next-day segment can only come from an explicitly valid overnight window.
 */
export function scheduleCoversLocalMinute(
  schedule: Pick<ResolvedStaffSchedule, "status" | "windows"> | undefined,
  minute: number,
  previousDay = false
): boolean {
  if (schedule?.status !== "resolved") return false;
  return schedule.windows.some((window) => {
    const range = getScheduleWindowAbsoluteRange(window);
    if (!range) return false;
    const candidateMinute = minute + (previousDay ? 1440 : 0);
    return candidateMinute >= range.start && candidateMinute < range.end;
  });
}

/**
 * Only ONE current request produces a popup. Several requests stay grouped in
 * the existing notification bell. Reading/closing a popup never resolves work.
 */
export function pendingBookingPresentation(
  snapshot: Pick<PendingCrmBookingSnapshot, "ok" | "pendingCount" | "onDuty" | "first">,
  options: {
    now: number;
    lastPresentedAt: number | null;
    safeToInterrupt: boolean;
  }
): PendingBookingPresentation {
  if (!snapshot.ok || !snapshot.onDuty || snapshot.pendingCount < 1) return "none";
  if (snapshot.pendingCount > 1) return "group";
  if (!snapshot.first || !options.safeToInterrupt) return "none";
  if (
    options.lastPresentedAt !== null &&
    Number.isFinite(options.lastPresentedAt) &&
    options.now - options.lastPresentedAt < PENDING_CRM_REMINDER_MS
  ) return "none";
  return "single";
}
