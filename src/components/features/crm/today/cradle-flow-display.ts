import {
  getCradleFlowStage,
  type CradleFlowBooking,
} from "@/lib/crm/cradle-flow";

export type CradleFlowFilter =
  | "all"
  | "needs_action"
  | "not_arrived"
  | "waiting_arrived"
  | "in_service"
  | "ready_to_pay"
  | "home_service"
  | "completed";

export const CRADLE_FLOW_FILTERS: { key: CradleFlowFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs_action", label: "Needs Action" },
  { key: "not_arrived", label: "Not Arrived" },
  { key: "waiting_arrived", label: "Waiting (Arrived)" },
  { key: "in_service", label: "In Service" },
  { key: "ready_to_pay", label: "Ready to Pay" },
  { key: "home_service", label: "Home Service" },
  { key: "completed", label: "Completed" },
];

export function isHomeServiceVisit(booking: CradleFlowBooking): boolean {
  return booking.type === "home_service" || booking.delivery_type === "home_service";
}

function isArrived(booking: CradleFlowBooking): boolean {
  return Boolean(
    booking.checked_in_at ||
    booking.booking_progress_status === "checked_in" ||
    booking.session_started_at
  );
}

export function getCradleFlowDisplayStatus(booking: CradleFlowBooking): string {
  const stage = getCradleFlowStage(booking);
  if (stage === "in_service") return "In Service";
  if (stage === "ready_to_pay") return "Ready to Pay";
  if (stage === "completed") return "Completed";
  if (booking.status === "pending" || booking.status === "pending_crm_confirmation") {
    return "Awaiting Confirmation";
  }
  return isArrived(booking) ? "Arrived · Ready to Start" : "Booked · Not Arrived";
}

export function getCradleFlowAttention(booking: CradleFlowBooking): string[] {
  const stage = getCradleFlowStage(booking);
  if (!stage || stage === "completed") return [];

  const issues: string[] = [];
  if (booking.status === "pending" || booking.status === "pending_crm_confirmation") {
    issues.push("Booking needs confirmation");
  }
  if (stage === "waiting" || stage === "in_service") {
    if (!booking.staff_name) issues.push("Therapist not assigned");
    if (!isHomeServiceVisit(booking) && !booking.resource_id) {
      issues.push("Room not assigned");
    }
  }
  if (booking.needs_staff_schedule_review) issues.push("Staff schedule review");
  if (isHomeServiceVisit(booking)) {
    if (booking.needs_location_review) issues.push("Home Service location review");
    if (booking.no_driver_warning) issues.push("Home Service driver needed");
    if (booking.dispatch_warning) issues.push("Home Service dispatch review");
  }
  if (stage === "ready_to_pay") issues.push("Payment due");
  return issues;
}

export function matchesCradleFlowFilter(
  booking: CradleFlowBooking,
  filter: CradleFlowFilter
): boolean {
  const stage = getCradleFlowStage(booking);
  if (!stage) return false;
  switch (filter) {
    case "all": return true;
    case "needs_action": return getCradleFlowAttention(booking).length > 0;
    case "not_arrived": return stage === "waiting" && !isArrived(booking);
    case "waiting_arrived": return stage === "waiting" && isArrived(booking);
    case "in_service": return stage === "in_service";
    case "ready_to_pay": return stage === "ready_to_pay";
    case "home_service": return isHomeServiceVisit(booking);
    case "completed": return stage === "completed";
  }
}

export function getCradleFlowDisplayCounts(bookings: CradleFlowBooking[]) {
  return Object.fromEntries(
    CRADLE_FLOW_FILTERS.map(({ key }) => [
      key,
      bookings.filter((booking) => matchesCradleFlowFilter(booking, key)).length,
    ])
  ) as Record<CradleFlowFilter, number>;
}
