import type { ReactNode } from "react";

export type DispatchRole = "crm" | "manager" | "owner" | "driver" | "therapist";

export type DispatchStatus =
  | "in_route"
  | "ready"
  | "en_route_to_therapist"
  | "awaiting_driver"
  | "arrived_at_customer"
  | "delayed"
  | "completed"
  | "cancelled";

export type DispatchTone =
  | "default"
  | "purple"
  | "blue"
  | "green"
  | "amber"
  | "red";

export type DispatchTabId =
  | "queue"
  | "city-map"
  | "live-tracking"
  | "delays-alerts"
  | "completed";

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
}

export interface DispatchStat {
  label: string;
  value: string | number;
  icon?: ReactNode;
  tone?: DispatchTone;
}

export interface ActiveDispatchTrip {
  dispatchId: string;
  number: string;
  customerName: string;
  status: DispatchStatus;
  etaMinutes: number;
}

export interface DispatchTripStep {
  label: string;
  time: string;
  state: "completed" | "active" | "upcoming";
}

export function canManageDispatch(role: DispatchRole) {
  return role === "crm" || role === "manager";
}

export function canViewAllDispatches(role: DispatchRole) {
  return role === "crm" || role === "manager" || role === "owner";
}

export function isReadOnlyRole(role: DispatchRole) {
  return role === "owner";
}
