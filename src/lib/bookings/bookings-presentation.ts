import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";
import type { CrmBookingGroup } from "./crm-booking-groups";
import { groupCrmBookings, matchesCrmBookingGroupSearch } from "./crm-booking-groups";
import { firstBookingRelation } from "./booking-display";
import { isBookingLineClosed, isBookingLineCompleted } from "./operational-booking-eligibility";
import { bookingMatchesQuickFilter, type BookingQuickFilter } from "./bookings-workspace-filters";

export function sessionOperationalState(line: WorkspaceBookingRow) {
  if (isBookingLineClosed(line))
    return line.status === "expired"
      ? "expired"
      : line.status === "no_show" || line.booking_progress_status === "no_show"
        ? "no_show"
        : "cancelled";
  if (isBookingLineCompleted(line)) return "completed";
  if (
    line.status === "in_progress" ||
    ["session_started", "in_service"].includes(line.booking_progress_status ?? "") ||
    (line.session_started_at && !line.session_completed_at)
  )
    return "in_service";
  if (
    ["checked_in", "arrived"].includes(line.booking_progress_status ?? "") ||
    line.checked_in_at ||
    line.arrived_at
  )
    return "checked_in";
  return "upcoming";
}

export type BookingSessionFilters = {
  quickFilter: BookingQuickFilter;
  status: string;
  service: string;
  therapist: string;
  room: string;
  search: string;
};

/** Every predicate applies to the same session, so different guests cannot satisfy different filters. */
export function sessionMatchesPresentationFilters(
  line: WorkspaceBookingRow,
  filters: BookingSessionFilters
) {
  const single = groupCrmBookings([line], false)[0]!;
  if (filters.quickFilter === "needs-attention" && single.attentionSummary.length === 0)
    return false;
  if (filters.quickFilter === "active-now" && !bookingMatchesQuickFilter(line, "active-now"))
    return false;
  if (filters.status !== "all" && sessionOperationalState(line) !== filters.status) return false;
  const service = firstBookingRelation(line.services),
    staff = firstBookingRelation(line.staff),
    room = firstBookingRelation(line.branch_resources);
  if (filters.service !== "all" && ![service?.id, service?.name].includes(filters.service))
    return false;
  if (
    filters.therapist !== "all" &&
    ![line.staff_id, staff?.id, staff?.full_name].includes(filters.therapist)
  )
    return false;
  if (filters.room !== "all" && ![line.resource_id, room?.id, room?.name].includes(filters.room))
    return false;
  return !filters.search.trim() || matchesCrmBookingGroupSearch(single, filters.search.trim());
}

export function bookingGuestCount(group: CrmBookingGroup) {
  const recipients = new Set(
    group.lines.map((line) => {
      const attendee = firstBookingRelation(line.booking_attendees),
        customer = firstBookingRelation(line.customers);
      return (
        line.attendee_id ??
        attendee?.id ??
        customer?.id ??
        attendee?.display_name?.trim() ??
        customer?.full_name?.trim() ??
        line.id
      );
    })
  );
  return group.guestCount || recipients.size;
}

export function bookingSessionSummary(group: CrmBookingGroup) {
  const states = group.lines.map(sessionOperationalState);
  return {
    active: states.filter((s) => s === "in_service").length,
    waiting: states.filter((s) => s === "checked_in" || s === "upcoming").length,
    completed: states.filter((s) => s === "completed").length,
  };
}
