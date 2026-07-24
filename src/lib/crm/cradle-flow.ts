import type { ControlBooking } from "@/components/features/control-console/types";

export type CradleFlowStage = "waiting" | "in_service" | "ready_to_pay" | "completed";

export type CradleFlowBooking = ControlBooking & {
  booking_date: string;
  branch_id?: string | null;
  delivery_type?: string | null;
  resource_id?: string | null;
  customer_phone?: string | null;
  checked_in_at?: string | null;
  session_started_at?: string | null;
  session_due_at?: string | null;
  session_completed_at?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type CradleFlowCounts = Record<CradleFlowStage, number> & {
  homeService: number;
};

export const CRADLE_FLOW_STAGES: Array<{
  key: CradleFlowStage;
  label: string;
  helper: string;
}> = [
  { key: "waiting", label: "Waiting", helper: "Arrivals and confirmed bookings" },
  { key: "in_service", label: "In Service", helper: "Services happening now" },
  { key: "ready_to_pay", label: "Ready to Pay", helper: "Completed, not yet settled" },
  { key: "completed", label: "Completed", helper: "Paid and closed" },
];

export function isCradleFlowClosed(booking: CradleFlowBooking): boolean {
  return ["cancelled", "no_show", "expired"].includes(booking.status);
}

export function isServiceCompleted(booking: CradleFlowBooking): boolean {
  return (
    booking.status === "completed" ||
    booking.booking_progress_status === "completed" ||
    Boolean(booking.session_completed_at)
  );
}

export function getCradleFlowStage(booking: CradleFlowBooking): CradleFlowStage | null {
  if (isCradleFlowClosed(booking)) return null;
  if (isServiceCompleted(booking)) {
    return booking.payment_status === "paid" ? "completed" : "ready_to_pay";
  }
  if (
    booking.status === "in_progress" ||
    booking.booking_progress_status === "session_started" ||
    Boolean(booking.session_started_at)
  ) {
    return "in_service";
  }
  return "waiting";
}

export function getCradleFlowCounts(bookings: CradleFlowBooking[]): CradleFlowCounts {
  const counts: CradleFlowCounts = {
    waiting: 0,
    in_service: 0,
    ready_to_pay: 0,
    completed: 0,
    homeService: 0,
  };

  for (const booking of bookings) {
    const stage = getCradleFlowStage(booking);
    if (stage) counts[stage] += 1;
    if (stage && (booking.type === "home_service" || booking.delivery_type === "home_service")) {
      counts.homeService += 1;
    }
  }
  return counts;
}

export function matchesCradleFlowSearch(booking: CradleFlowBooking, rawQuery: string): boolean {
  const query = rawQuery.trim().toLocaleLowerCase("en-PH");
  if (!query) return true;
  return [
    booking.customer_name,
    booking.customer_phone,
    booking.id,
    booking.service_name,
    booking.staff_name,
    booking.resource_name,
    booking.hs_address,
    booking.payment_reference,
  ].some((value) => value?.toLocaleLowerCase("en-PH").includes(query));
}

export function getCradleFlowPrimaryLabel(booking: CradleFlowBooking): string {
  const stage = getCradleFlowStage(booking);
  if (stage === "in_service") return "Complete Service";
  if (stage === "ready_to_pay") return "Collect Payment";
  if (stage === "completed") return "View Record";
  if (booking.status === "pending" || booking.status === "pending_crm_confirmation") {
    return "Confirm Booking";
  }
  if (booking.type === "home_service" || booking.delivery_type === "home_service") {
    return "Open Home Service";
  }
  if (booking.booking_progress_status === "checked_in") return "Start Service";
  return "Check In";
}

export function formatCradleFlowMoney(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}
