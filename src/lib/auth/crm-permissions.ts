/**
 * CRM Workspace Permission Helpers
 *
 * Typed helpers that answer "can this role do X inside the CRM workspace?"
 *
 * MVP permission levels:
 *   owner                             — full cross-branch access
 *   manager, assistant_manager,
 *   store_manager                     — management access
 *   crm, csr, csr_head, csr_staff     — one equal branch-scoped Front Desk level
 */

import {
  FRONT_DESK_ROLE_ALIASES,
  canonicalizeSystemRole,
  isFrontDeskRole,
} from "@/constants/staff-roles";

// ── Role catalog ──────────────────────────────────────────────────────────────

/** system_role values that can use the CRM workspace */
export const CRM_WORKSPACE_ROLES = [
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  ...FRONT_DESK_ROLE_ALIASES,
] as const;

export type CrmWorkspaceRole = (typeof CRM_WORKSPACE_ROLES)[number];

// ── Role groups (internal) ────────────────────────────────────────────────────

const OWNER_ROLE = "owner" as const;
export const CRM_MANAGEMENT_ROLES = [
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
] as const;
export const CRM_BRANCH_OPERATIONAL_ROLES = [
  "manager",
  "assistant_manager",
  "store_manager",
  ...FRONT_DESK_ROLE_ALIASES,
] as const;
export const CRM_STAFF_SERVICE_ROLES = CRM_WORKSPACE_ROLES;

const MANAGEMENT_ROLES: readonly string[] = CRM_MANAGEMENT_ROLES;

function isCrmOperationalRole(role: string): boolean {
  const canonicalRole = canonicalizeSystemRole(role);
  return MANAGEMENT_ROLES.includes(canonicalRole) || canonicalRole === "crm";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Whether this role is allowed into the CRM workspace at all. */
export function canAccessCrmWorkspace(role: string): boolean {
  const canonicalRole = canonicalizeSystemRole(role);
  return MANAGEMENT_ROLES.includes(canonicalRole) || isFrontDeskRole(role);
}

/** Can configure CRM-wide setup (booking rules, branch settings).
 *  Available to all CRM/front-desk roles; branch scope still applies. */
export function canManageCrmSetup(role: string): boolean {
  return isCrmOperationalRole(role);
}

/** Can add/edit/remove services.
 *  Available to all CRM/front-desk roles; branch scope still applies. */
export function canManageServices(role: string): boolean {
  return isCrmOperationalRole(role);
}

/** Can create, update, cancel, and manage bookings.
 *  Available to all CRM roles. */
export function canManageBookings(role: string): boolean {
  return isCrmOperationalRole(role);
}

/** Can confirm / record payments. */
export function canConfirmPayments(role: string): boolean {
  return isCrmOperationalRole(role);
}

/** Can view and manage customer records.
 *  Available to all CRM roles. */
export function canManageCustomers(role: string): boolean {
  return isCrmOperationalRole(role);
}

/** Can edit staff operational profiles (name, phone, type, active status).
 *  Owner + management + CRM elevated roles. */
export function canManageOperationalStaff(role: string): boolean {
  return isCrmOperationalRole(role);
}

/** Can assign and reassign staff to bookings / shifts.
 *  Owner + management + CRM elevated roles. */
export function canManageStaffAssignments(role: string): boolean {
  return isCrmOperationalRole(role);
}

/** Can assign/remove service capabilities for staff (staff_services).
 *  Owner + management + all CRM roles. */
export function canManageStaffServices(role: string): boolean {
  return isCrmOperationalRole(role);
}

/** Owner is the only CRM role with cross-branch staff-service authority. */
export function canManageStaffServicesAcrossBranches(role: string): boolean {
  return canonicalizeSystemRole(role) === OWNER_ROLE;
}

/** Can update service visibility (public / csr_only) for branch services.
 *  Owner + management + CRM elevated roles. */
export function canUpdateServiceVisibility(role: string): boolean {
  return isCrmOperationalRole(role);
}

/** Can manage resources (rooms, equipment).
 *  Available to all CRM/front-desk roles; branch scope still applies. */
export function canManageResources(role: string): boolean {
  return isCrmOperationalRole(role);
}

/** Can view and act on the dispatch queue.
 *  Available to all CRM roles. */
export function canManageDispatch(role: string): boolean {
  return isCrmOperationalRole(role);
}

// Keep a reference so callers can check the owner role constant if needed.
export { OWNER_ROLE };
