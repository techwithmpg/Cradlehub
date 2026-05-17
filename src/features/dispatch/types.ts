export type DispatchStatus =
  | "awaiting_driver"
  | "ready"
  | "in_route"
  | "arrived_at_customer"
  | "service_started"
  | "completed"
  | "cancelled";

export interface DispatchAlert {
  id: string;
  title: string;
  description: string;
  timeAgo: string;
  severity: "warning" | "danger";
  dispatchNumber: string;
  bookingId: string;
}
