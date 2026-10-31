import type { CrmBookingGroup } from "./crm-booking-groups";
import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";
import { BRANCH_TIMEZONE, getBranchBusinessDate, getBranchClockTime } from "@/lib/engine/slot-time";

export type OperationalBookingEligibilityContext = {
  businessDate?: string;
  clockTime?: string;
  timezone?: string;
};

function toComparableTime(timeStr: string): string {
  const parts = timeStr.trim().split(":");
  const h = (parts[0] ?? "00").padStart(2, "0");
  const m = (parts[1] ?? "00").padStart(2, "0");
  const s = (parts[2] ?? "00").padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/**
 * Checks if a booking line has active attendance or started service.
 */
export function hasBookingStartedOrAttended(line: WorkspaceBookingRow): boolean {
  return (
    line.booking_progress_status === "checked_in" ||
    line.booking_progress_status === "arrived" ||
    line.booking_progress_status === "in_service" ||
    line.booking_progress_status === "session_started" ||
    line.booking_progress_status === "completed" ||
    Boolean(line.checked_in_at) ||
    Boolean(line.arrived_at) ||
    Boolean(line.session_started_at) ||
    Boolean(line.session_completed_at)
  );
}

/**
 * Checks if a booking line is completed.
 */
export function isBookingLineCompleted(line: WorkspaceBookingRow): boolean {
  return (
    line.status === "completed" ||
    line.booking_progress_status === "completed" ||
    Boolean(line.session_completed_at)
  );
}

export type BookingLifecycleState =
  | "cancelled"
  | "completed"
  | "in_service"
  | "checked_in"
  | "upcoming";

/**
 * Resolves the authoritative lifecycle state of an individual booking line.
 * Precedence: cancelled -> completed -> in_service -> checked_in -> upcoming
 */
export function resolveBookingLifecycleState(line: WorkspaceBookingRow): BookingLifecycleState {
  if (line.status === "cancelled" || line.booking_progress_status === "cancelled") {
    return "cancelled";
  }
  if (isBookingLineCompleted(line)) {
    return "completed";
  }
  if (
    line.status === "in_progress" ||
    line.booking_progress_status === "session_started" ||
    line.booking_progress_status === "in_service" ||
    (Boolean(line.session_started_at) && !line.session_completed_at)
  ) {
    return "in_service";
  }
  if (
    line.booking_progress_status === "checked_in" ||
    line.booking_progress_status === "arrived" ||
    Boolean(line.checked_in_at) ||
    Boolean(line.arrived_at)
  ) {
    return "checked_in";
  }
  return "upcoming";
}

/**
 * Determines whether a CrmBookingGroup represents an operationally actionable booking.
 *
 * Operational Bookings show:
 * - Upcoming valid appointments
 * - Checked-in customers
 * - Waiting customers
 * - In-service bookings
 * - Completed services with an outstanding or partial payment balance
 * - Multi-guest orders where at least one guest/service still requires operational attention or payment collection
 * - Home Service with active dispatch/service
 *
 * Operational Bookings hide:
 * - Completed and fully paid bookings with no remaining operational work
 * - Cancelled bookings (`status === "cancelled"`)
 * - Expired unattended appointments without active work (never treating an unattended appointment
 *   with no delivered service as a payment-ready completed service)
 */
export function isOperationalBookingGroup(
  group: CrmBookingGroup,
  context?: OperationalBookingEligibilityContext
): boolean {
  const lines = group.lines;
  if (!lines || lines.length === 0) return false;

  // 1. If all lines in the group are cancelled, hide.
  const allCancelled = lines.every((line) => line.status === "cancelled");
  if (allCancelled) {
    return false;
  }

  // Active / non-cancelled lines
  const activeLines = lines.filter((line) => line.status !== "cancelled");
  if (activeLines.length === 0) return false;

  // 2. Completion and Payment status evaluation:
  // When every active service in the group has completed, the only remaining operational
  // question is whether payment has been settled.
  const allActiveCompleted = activeLines.every(isBookingLineCompleted);
  const isFullyPaid =
    group.payment.status === "paid" ||
    (group.payment.due !== null && group.payment.due <= 0);

  if (allActiveCompleted) {
    // If every active service is completed and fully paid, there is no operational work left -> hide!
    if (isFullyPaid) {
      return false;
    }
    // If every active service is completed but payment is still due/partial -> show for cashier collection!
    return true;
  }

  // 3. For groups with unfinished services (single booking not yet completed, or multi-guest with remaining work):
  const unfinishedLines = activeLines.filter((line) => !isBookingLineCompleted(line));

  // 3a. In-service bookings: show immediately
  const hasInService = unfinishedLines.some(
    (line) =>
      line.status === "in_progress" ||
      line.booking_progress_status === "session_started" ||
      line.booking_progress_status === "in_service" ||
      (Boolean(line.session_started_at) && !line.session_completed_at)
  );
  if (hasInService) {
    return true;
  }

  // 3b. Checked-in or waiting customers on unfinished lines: show immediately
  const hasCheckedInOrWaiting = unfinishedLines.some(
    (line) =>
      line.booking_progress_status === "checked_in" ||
      line.booking_progress_status === "arrived" ||
      Boolean(line.checked_in_at) ||
      Boolean(line.arrived_at)
  );
  if (hasCheckedInOrWaiting) {
    return true;
  }

  // 3c. Home Service with active dispatch/service on unfinished lines: show immediately
  const hasActiveHomeService = unfinishedLines.some(
    (line) =>
      (line.delivery_type === "home_service" || line.type === "home_service") &&
      line.status !== "completed" &&
      line.status !== "cancelled" &&
      line.status !== "no_show"
  );
  if (hasActiveHomeService) {
    return true;
  }

  // 4. Check for expired unattended appointment:
  // An appointment where no guest checked in, arrived, or started service.
  const hasAnyAttendance = activeLines.some(hasBookingStartedOrAttended);

  if (!hasAnyAttendance) {
    // If explicitly marked as no_show or expired
    if (activeLines.every((line) => line.status === "no_show" || line.status === "expired")) {
      return false;
    }

    const today = getBranchBusinessDate(new Date(), context?.timezone ?? BRANCH_TIMEZONE);
    const businessDate = context?.businessDate ?? today;
    const clockTime =
      context?.clockTime ??
      (businessDate === today
        ? getBranchClockTime(new Date(), context?.timezone ?? BRANCH_TIMEZONE)
        : undefined);

    // If scheduled for a past date, unattended -> expired unattended (hide)
    if (group.bookingDate < businessDate) {
      return false;
    }

    // If scheduled for today, and scheduled end time has already elapsed, unattended -> expired unattended (hide)
    if (group.bookingDate === businessDate && clockTime) {
      const scheduledEnd = group.endTime || group.startTime;
      if (scheduledEnd && toComparableTime(clockTime) > toComparableTime(scheduledEnd)) {
        return false;
      }
    }
  }

  // If none of the hide criteria met, it's an actionable upcoming booking
  return true;
}

