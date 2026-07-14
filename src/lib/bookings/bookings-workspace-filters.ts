import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";
import { isBookingClosedForCrm, isCrmPendingBookingStatus } from "@/lib/bookings/crm-booking-status";
import { getOpenStaffScheduleException } from "@/lib/bookings/staff-schedule-exception";

export const BOOKING_QUICK_FILTERS = [
  "all",
  "needs-attention",
  "active-now",
] as const;

export type BookingQuickFilter = (typeof BOOKING_QUICK_FILTERS)[number];

export type ResolvedBookingQuickFilter = {
  quickFilter: BookingQuickFilter;
  legacyStatusFilter?: "completed";
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
export function isHomeServiceBooking(booking: WorkspaceBookingRow): boolean {
  return (
    booking.delivery_type === "home_service" ||
    booking.type === "home_service" ||
    booking.metadata?.delivery_type === "home_service" ||
    booking.metadata?.type === "home_service"
  );
}

export function isBookingOperationallyClosed(
  booking: WorkspaceBookingRow
): boolean {
  const progress = booking.booking_progress_status ?? null;
  return (
    isBookingClosedForCrm(booking.status) ||
    booking.status === "completed" ||
    booking.status === "cancelled" ||
    booking.status === "no_show" ||
    progress === "completed" ||
    progress === "no_show"
  );
}

export function isBookingActiveNow(booking: WorkspaceBookingRow): boolean {
  if (isBookingOperationallyClosed(booking)) return false;
  const progress = booking.booking_progress_status ?? null;
  return (
    booking.status === "in_progress" ||
    progress === "checked_in" ||
    progress === "travel_started" ||
    progress === "arrived" ||
    progress === "session_started" ||
    progress === "in_progress"
  );
}

function hasPendingPayment(booking: WorkspaceBookingRow): boolean {
  return ["unpaid", "pending", "pending_payment"].includes(
    booking.payment_status ?? "unpaid"
  );
}

function hasFollowUpRequired(booking: WorkspaceBookingRow): boolean {
  const followup = booking.metadata?.crm_followup;
  if (!followup || typeof followup !== "object" || Array.isArray(followup)) {
    return false;
  }
  const result = (followup as { result?: unknown }).result;
  return (
    result === "no_answer" ||
    result === "reschedule" ||
    result === "confirm_later"
  );
}

export function bookingNeedsAttention(booking: WorkspaceBookingRow): boolean {
  if (isBookingOperationallyClosed(booking)) return false;

  const missingStaff = !firstRelation(booking.staff);
  const missingRoom =
    booking.status === "confirmed" &&
    !isHomeServiceBooking(booking) &&
    !booking.resource_id;
  const hasAssignmentWarning =
    booking.metadata?.staff_assignment_review_required === true ||
    Boolean(getOpenStaffScheduleException(booking.metadata));

  return (
    isCrmPendingBookingStatus(booking.status) ||
    hasPendingPayment(booking) ||
    hasFollowUpRequired(booking) ||
    missingStaff ||
    missingRoom ||
    hasAssignmentWarning
  );
}

export function bookingMatchesQuickFilter(
  booking: WorkspaceBookingRow,
  quickFilter: BookingQuickFilter
): boolean {
  if (quickFilter === "needs-attention") return bookingNeedsAttention(booking);
  if (quickFilter === "active-now") return isBookingActiveNow(booking);
  return true;
}

export function resolveBookingQuickFilter(
  raw: string | null | undefined
): ResolvedBookingQuickFilter {
  if (raw === "needs-attention" || raw === "needs-action") {
    return { quickFilter: "needs-attention" };
  }
  if (raw === "active-now" || raw === "active") {
    return { quickFilter: "active-now" };
  }
  if (raw === "completed") {
    return { quickFilter: "all", legacyStatusFilter: "completed" };
  }
  return { quickFilter: "all" };
}
