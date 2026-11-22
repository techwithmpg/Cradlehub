import {
  getCradleFlowStage,
  isPaymentOverdue,
  type CradleFlowBooking,
} from "@/lib/crm/cradle-flow";
import {
  groupBookingsByOrder,
  matchesBookingGroupSearch,
} from "@/lib/bookings/group-bookings-by-order";
import {
  getCradleFlowAmountPaid,
  getCradleFlowBalance,
  getCradleFlowPaymentStatus,
} from "@/lib/crm/cradle-flow";

export type CradleFlowFilter =
  | "all"
  | "needs_action"
  | "not_arrived"
  | "waiting_arrived"
  | "in_service"
  | "ready_to_pay"
  | "home_service"
  | "upcoming"
  | "past_unfollowed"
  | "completed";

export const CRADLE_FLOW_FILTERS: { key: CradleFlowFilter; label: string }[] = [
  { key: "all", label: "Active" },
  { key: "needs_action", label: "Needs Action" },
  { key: "not_arrived", label: "Not Arrived" },
  { key: "waiting_arrived", label: "Waiting (Arrived)" },
  { key: "in_service", label: "In Service" },
  { key: "ready_to_pay", label: "Ready to Pay" },
  { key: "home_service", label: "Home Service" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past_unfollowed", label: "Past / Unfollowed" },
  { key: "completed", label: "Completed" },
];

export function isPastUnfollowedBooking(
  booking: CradleFlowBooking,
  businessDate?: string,
  now = new Date()
): boolean {
  const stage = getCradleFlowStage(booking);
  if (stage !== "waiting" || isArrived(booking)) return false;
  const refDate = businessDate ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(now);
  if (booking.booking_date < refDate) return true;
  if (booking.booking_date > refDate) return false;
  const endClock = booking.end_time || booking.start_time;
  if (!endClock) return false;
  const endIso = `${booking.booking_date}T${endClock.length === 5 ? `${endClock}:00` : endClock}+08:00`;
  const endMs = Date.parse(endIso);
  return Number.isFinite(endMs) && now.getTime() > endMs;
}

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

export function getCradleFlowAttention(booking: CradleFlowBooking, now = new Date()): string[] {
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
  if (isPaymentOverdue(booking, now)) issues.push("Payment Overdue");
  return issues;
}

export function groupCradleFlowBookings(bookings: readonly CradleFlowBooking[]) {
  return groupBookingsByOrder(bookings, {
    organizerName: (line) => line.customer_name ?? "Unnamed customer",
    payment: (line) => ({
      total: line.order_id ? (line.order_total_amount ?? null) : Number(line.price_paid ?? 0),
      paid: getCradleFlowAmountPaid(line),
      due: line.order_id && line.order_total_amount == null ? null : getCradleFlowBalance(line),
      status: getCradleFlowPaymentStatus(line),
    }),
    attention: (line) => getCradleFlowAttention(line),
  }).map((group) => ({
    ...group,
    attentionSummary: group.attentionSummary.map((issue) =>
      issue.replace(/^\d+ Payment Overdue$/, "Payment Overdue")
    ),
  }));
}

export type CradleFlowGroup = ReturnType<typeof groupCradleFlowBookings>[number];

export function matchesCradleFlowGroupSearch(group: CradleFlowGroup, query: string): boolean {
  return matchesBookingGroupSearch(group, query, (line) => [
    line.customer_phone,
    line.service_name,
    line.staff_name,
    line.resource_name,
    line.hs_address,
    line.payment_reference,
  ]);
}

export function matchesCradleFlowGroupFilter(
  group: CradleFlowGroup,
  filter: CradleFlowFilter,
  businessDate?: string
): boolean {
  const applicable = group.lines.filter((line) => getCradleFlowStage(line) !== null);
  if (applicable.length === 0) return false;
  const future = Boolean(businessDate && group.bookingDate > businessDate);
  if (future)
    return (
      filter === "upcoming" || (filter === "needs_action" && group.attentionSummary.length > 0)
    );
  const isPastUnfollowed =
    group.stage === "waiting" &&
    applicable.every((line) => isPastUnfollowedBooking(line, businessDate));

  switch (filter) {
    case "all":
      return group.stage !== "completed" && !isPastUnfollowed;
    case "past_unfollowed":
      return isPastUnfollowed;
    case "upcoming":
      return false;
    case "needs_action":
      return group.attentionSummary.length > 0 && !isPastUnfollowed;
    case "in_service":
      return group.stage === "in_service";
    case "ready_to_pay":
      return group.stage === "ready_to_pay";
    case "completed":
      return group.stage === "completed";
    case "home_service":
      return applicable.some(isHomeServiceVisit) && !isPastUnfollowed;
    case "not_arrived":
      return group.stage === "waiting" && applicable.every((line) => !isArrived(line)) && !isPastUnfollowed;
    case "waiting_arrived":
      return group.stage === "waiting" && applicable.some(isArrived);
  }
}

export function matchesCradleFlowFilter(
  booking: CradleFlowBooking,
  filter: CradleFlowFilter,
  businessDate?: string
): boolean {
  const stage = getCradleFlowStage(booking);
  if (!stage) return false;
  const future = Boolean(businessDate && booking.booking_date > businessDate);
  if (future) {
    if (filter === "upcoming") return true;
    if (filter === "needs_action") return getCradleFlowAttention(booking).length > 0;
    return false;
  }
  const pastUnfollowed = isPastUnfollowedBooking(booking, businessDate);
  switch (filter) {
    case "all":
      return stage !== "completed" && !pastUnfollowed;
    case "past_unfollowed":
      return pastUnfollowed;
    case "upcoming":
      return false;
    case "needs_action":
      return getCradleFlowAttention(booking).length > 0 && !pastUnfollowed;
    case "not_arrived":
      return stage === "waiting" && !isArrived(booking) && !pastUnfollowed;
    case "waiting_arrived":
      return stage === "waiting" && isArrived(booking);
    case "in_service":
      return stage === "in_service";
    case "ready_to_pay":
      return stage === "ready_to_pay";
    case "home_service":
      return isHomeServiceVisit(booking) && !pastUnfollowed;
    case "completed":
      return stage === "completed";
  }
}

export function getCradleFlowDisplayCounts(bookings: CradleFlowBooking[], businessDate?: string) {
  const groups = groupCradleFlowBookings(bookings);
  return Object.fromEntries(
    CRADLE_FLOW_FILTERS.map(({ key }) => [
      key,
      groups.filter((group) => matchesCradleFlowGroupFilter(group, key, businessDate)).length,
    ])
  ) as Record<CradleFlowFilter, number>;
}

