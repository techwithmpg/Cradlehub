export type DispatchRole = "crm" | "manager" | "owner" | "driver" | "therapist";

export type DispatchStatus =
  | "in_route"
  | "ready"
  | "en_route_to_therapist"
  | "awaiting_driver"
  | "arrived_at_customer"
  | "service_started"
  | "delayed"
  | "completed"
  | "cancelled";

export interface DispatchItem {
  id: string;
  number: string;
  customerName: string;
  serviceName: string;
  area: string;
  driverName?: string;
  therapistName?: string;
  status: DispatchStatus;
  etaMinutes?: number;
  paymentStatus: "paid" | "pending" | "unpaid";
  completedAt?: string;
  rating?: number;
}

export interface DispatchAlert {
  id: string;
  title: string;
  description: string;
  timeAgo: string;
  severity: "info" | "warning" | "danger";
  dispatchNumber: string;
  /** Booking UUID — use to navigate to the dispatch in the queue */
  bookingId: string;
}

export interface TripStep {
  label: string;
  time?: string;
  state: "done" | "active" | "pending";
}

export interface ActiveTrip {
  number: string;
  customerName: string;
  status: string;
  etaMinutes: number;
}

// ── Role helpers ──────────────────────────────────────────────────────────────

export function canManageDispatch(role: DispatchRole): boolean {
  return role === "crm" || role === "manager";
}

export function canViewAllDispatches(role: DispatchRole): boolean {
  return role === "crm" || role === "manager" || role === "owner";
}

export function isReadOnlyRole(role: DispatchRole): boolean {
  return role === "owner";
}
