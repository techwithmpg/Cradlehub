import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";
import { isCrmPendingBookingStatus } from "@/lib/bookings/crm-booking-status";
import { isHomeServiceBooking } from "@/lib/bookings/bookings-workspace-filters";

export type BookingListFilters = {
  status?: string;
  source?: string;
  delivery?: string;
  payment?: string;
  assignment?: string;
  branchId?: string;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function matchesStatus(booking: WorkspaceBookingRow, status: string): boolean {
  const progress = booking.booking_progress_status ?? null;
  if (status === "pending") return isCrmPendingBookingStatus(booking.status);
  if (status === "checked_in") return progress === "checked_in";
  if (status === "in_service") {
    return booking.status === "in_progress" || progress === "session_started";
  }
  if (status === "completed") {
    return booking.status === "completed" || progress === "completed";
  }
  if (status === "no_show") {
    return booking.status === "no_show" || progress === "no_show";
  }
  return booking.status === status;
}

function matchesSource(booking: WorkspaceBookingRow, source: string): boolean {
  const crmMode = booking.metadata?.crm_booking_mode;
  if (source === "online") return booking.type === "online";
  if (source === "walkin") {
    return booking.type === "walkin" || crmMode === "walkin";
  }
  if (source === "phone") return crmMode === "phone";
  return booking.type === source;
}

function matchesAssignment(
  booking: WorkspaceBookingRow,
  assignment: string
): boolean {
  if (assignment === "staff_unassigned") return !firstRelation(booking.staff);
  if (assignment === "staff_assigned") return Boolean(firstRelation(booking.staff));
  if (assignment === "room_unassigned") {
    return !isHomeServiceBooking(booking) && !booking.resource_id;
  }
  if (assignment === "room_assigned") return Boolean(booking.resource_id);
  return true;
}

export function applyBookingListFilters(
  bookings: WorkspaceBookingRow[],
  filters: BookingListFilters
): WorkspaceBookingRow[] {
  return bookings.filter((booking) => {
    if (filters.status && !matchesStatus(booking, filters.status)) return false;
    if (filters.source && !matchesSource(booking, filters.source)) return false;
    if (filters.delivery === "home_service" && !isHomeServiceBooking(booking)) {
      return false;
    }
    if (filters.delivery === "in_spa" && isHomeServiceBooking(booking)) {
      return false;
    }
    if (filters.payment && booking.payment_status !== filters.payment) return false;
    if (filters.assignment && !matchesAssignment(booking, filters.assignment)) {
      return false;
    }
    if (filters.branchId && booking.branch_id !== filters.branchId) return false;
    return true;
  });
}
