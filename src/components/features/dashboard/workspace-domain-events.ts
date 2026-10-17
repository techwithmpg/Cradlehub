import type { RetainedModuleId, RetainedWorkspace } from "./workspace-retention-policy";
import { ownerScopeAcceptsBranchEvent, type OwnerEventScope } from "@/lib/owner/operational-scope";

export const WORKSPACE_DOMAIN_EVENT = "cradlehub:workspace-domain-event";

type BookingScope = { bookingId?: string; orderId?: string };
type DomainPayloads = {
  "booking.status_changed": BookingScope;
  "booking.assignment_changed": BookingScope;
  "booking.payment_changed": BookingScope;
  "booking.rescheduled": BookingScope;
  "booking.created": BookingScope;
  "booking.cancelled": BookingScope;
  "attendance.changed": { staffId?: string };
  "schedule.shift_updated": { staffId?: string };
  "schedule.assignment_changed": { staffId?: string };
  "room.changed": { resourceId?: string };
  "driver.changed": { driverId?: string };
  "customer.changed": { customerId?: string };
  "branch_rules.changed": Record<string, never>;
};

export type WorkspaceDomainEventName = keyof DomainPayloads;
export type WorkspaceDomainEvent = {
  [N in WorkspaceDomainEventName]: {
    name: N;
    branchId: string;
    payload: DomainPayloads[N];
  }
}[WorkspaceDomainEventName];

// These include future consumers, not new retention policies or authorization.
export type WorkspaceRuntimeModuleId = RetainedModuleId
  | "crm-cash-flow" | "crm-dispatch" | "crm-staff" | "crm-setup"
  | "owner-schedule" | "owner-attendance" | "owner-cash-flow"
  | "owner-dispatch" | "owner-customers" | "owner-services";

type Dependency = {
  crm: readonly WorkspaceRuntimeModuleId[];
  owner: readonly WorkspaceRuntimeModuleId[];
  tacticalPatch: "invalidate-only";
};

// Identity-only notifications cannot safely patch business/financial data.
// Future patches need a separately reviewed authoritative-result contract.
export const WORKSPACE_EVENT_DEPENDENCIES = {
  "booking.status_changed": { crm: ["crm-work-queue", "crm-bookings"], owner: ["owner-overview", "owner-bookings"], tacticalPatch: "invalidate-only" },
  "booking.assignment_changed": { crm: ["crm-work-queue", "crm-bookings", "crm-schedule", "crm-dispatch"], owner: ["owner-bookings", "owner-schedule", "owner-dispatch"], tacticalPatch: "invalidate-only" },
  "booking.payment_changed": { crm: ["crm-work-queue", "crm-bookings", "crm-cash-flow"], owner: ["owner-bookings", "owner-cash-flow", "owner-reports"], tacticalPatch: "invalidate-only" },
  "booking.rescheduled": { crm: ["crm-work-queue", "crm-bookings", "crm-schedule", "crm-dispatch"], owner: ["owner-bookings", "owner-schedule", "owner-dispatch"], tacticalPatch: "invalidate-only" },
  "booking.created": { crm: ["crm-work-queue", "crm-bookings", "crm-schedule", "crm-customers"], owner: ["owner-overview", "owner-bookings", "owner-schedule", "owner-customers"], tacticalPatch: "invalidate-only" },
  "booking.cancelled": { crm: ["crm-work-queue", "crm-bookings", "crm-schedule", "crm-dispatch", "crm-cash-flow"], owner: ["owner-overview", "owner-bookings", "owner-schedule", "owner-dispatch", "owner-cash-flow"], tacticalPatch: "invalidate-only" },
  "attendance.changed": { crm: ["crm-attendance", "crm-schedule"], owner: ["owner-attendance", "owner-schedule"], tacticalPatch: "invalidate-only" },
  "schedule.shift_updated": { crm: ["crm-schedule"], owner: ["owner-schedule"], tacticalPatch: "invalidate-only" },
  "schedule.assignment_changed": { crm: ["crm-schedule", "crm-work-queue", "crm-bookings"], owner: ["owner-schedule", "owner-bookings"], tacticalPatch: "invalidate-only" },
  "room.changed": { crm: ["crm-work-queue", "crm-schedule"], owner: ["owner-schedule"], tacticalPatch: "invalidate-only" },
  "driver.changed": { crm: ["crm-dispatch", "crm-work-queue"], owner: ["owner-dispatch"], tacticalPatch: "invalidate-only" },
  "customer.changed": { crm: ["crm-customers", "crm-bookings"], owner: ["owner-customers", "owner-bookings"], tacticalPatch: "invalidate-only" },
  "branch_rules.changed": { crm: ["crm-setup", "crm-schedule"], owner: ["owner-schedule", "owner-services"], tacticalPatch: "invalidate-only" },
} as const satisfies Record<WorkspaceDomainEventName, Dependency>;

export function affectedWorkspaceModules(
  event: WorkspaceDomainEvent,
  scope: { workspace: RetainedWorkspace; branchId: string; role: string; ownerEventScope?: OwnerEventScope },
): readonly WorkspaceRuntimeModuleId[] {
  const matches = scope.workspace === "owner" && scope.ownerEventScope
    ? ownerScopeAcceptsBranchEvent(scope.ownerEventScope, event.branchId)
    : event.branchId === scope.branchId;
  if (!matches || !Object.hasOwn(WORKSPACE_EVENT_DEPENDENCIES, event.name)) return [];
  // Role belongs in the caller's scope identity; this map grants no role access.
  return WORKSPACE_EVENT_DEPENDENCIES[event.name][scope.workspace];
}

export function emitWorkspaceDomainEvent(event: WorkspaceDomainEvent): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WORKSPACE_DOMAIN_EVENT, { detail: event }));
}

export function legacyBookingModules(workspace: RetainedWorkspace): RetainedModuleId[] {
  return workspace === "crm"
    ? ["crm-work-queue", "crm-bookings", "crm-schedule"]
    : ["owner-overview", "owner-reports", "owner-bookings"];
}
