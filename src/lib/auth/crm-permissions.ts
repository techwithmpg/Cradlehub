/**
 * CRM Workspace Permission Helpers
 *
 * Typed helpers that answer "can this role do X inside the CRM workspace?"
 *
 * MVP permission levels:
 *   owner                             — full access to all helpers
 *   manager, assistant_manager,
 *   store_manager                     — same as owner (all helpers)
 *   crm, csr_head                     — canManageBookings, canConfirmPayments,
 *                                       canManageCustomers, canManageDispatch
 *   csr_staff, csr                    — canManageBookings, canManageCustomers,
 *                                       canManageDispatch
 */

// ── Role catalog ──────────────────────────────────────────────────────────────

/** system_role values that can use the CRM workspace */
export const CRM_WORKSPACE_ROLES = [
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  "crm",
  "csr_head",
  "csr_staff",
  "csr",
] as const;

export type CrmWorkspaceRole = (typeof CRM_WORKSPACE_ROLES)[number];

// ── Role groups (internal) ────────────────────────────────────────────────────

const OWNER_ROLE = "owner" as const;
const MANAGEMENT_ROLES: readonly string[] = [
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
];
const CSR_ELEVATED_ROLES: readonly string[] = ["crm", "csr_head"];
const CSR_BASIC_ROLES: readonly string[] = ["csr_staff", "csr"];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Whether this role is allowed into the CRM workspace at all. */
export function canAccessCrmWorkspace(role: string): boolean {
  return (CRM_WORKSPACE_ROLES as readonly string[]).includes(role);
}

/** Can configure CRM-wide setup (booking rules, branch settings).
 *  Restricted to owner + management. */
export function canManageCrmSetup(role: string): boolean {
  return MANAGEMENT_ROLES.includes(role);
}

/** Can add/edit/remove services.
 *  Restricted to owner + management. */
export function canManageServices(role: string): boolean {
  return MANAGEMENT_ROLES.includes(role);
}

/** Can create, update, cancel, and manage bookings.
 *  Available to all CRM roles. */
export function canManageBookings(role: string): boolean {
  return (
    MANAGEMENT_ROLES.includes(role) ||
    CSR_ELEVATED_ROLES.includes(role) ||
    CSR_BASIC_ROLES.includes(role)
  );
}

/** Can confirm / record payments.
 *  Owner + management + csr_head + crm. */
export function canConfirmPayments(role: string): boolean {
  return MANAGEMENT_ROLES.includes(role) || CSR_ELEVATED_ROLES.includes(role);
}

/** Can view and manage customer records.
 *  Available to all CRM roles. */
export function canManageCustomers(role: string): boolean {
  return (
    MANAGEMENT_ROLES.includes(role) ||
    CSR_ELEVATED_ROLES.includes(role) ||
    CSR_BASIC_ROLES.includes(role)
  );
}

/** Can edit staff operational profiles (name, phone, type, active status).
 *  Owner + management + CRM elevated roles. */
export function canManageOperationalStaff(role: string): boolean {
  return (
    MANAGEMENT_ROLES.includes(role) ||
    CSR_ELEVATED_ROLES.includes(role) ||
    CSR_BASIC_ROLES.includes(role)
  );
}

/** Can assign and reassign staff to bookings / shifts.
 *  Owner + management + CRM elevated roles. */
export function canManageStaffAssignments(role: string): boolean {
  return MANAGEMENT_ROLES.includes(role) || CSR_ELEVATED_ROLES.includes(role);
}

/** Can assign/remove service capabilities for staff (staff_services).
 *  Owner + management + all CRM roles. */
export function canManageStaffServices(role: string): boolean {
  return (
    MANAGEMENT_ROLES.includes(role) ||
    CSR_ELEVATED_ROLES.includes(role) ||
    CSR_BASIC_ROLES.includes(role)
  );
}

/** Can update service visibility (public / csr_only) for branch services.
 *  Owner + management + CRM elevated roles. */
export function canUpdateServiceVisibility(role: string): boolean {
  return MANAGEMENT_ROLES.includes(role) || CSR_ELEVATED_ROLES.includes(role);
}

/** Can manage resources (rooms, equipment).
 *  Restricted to owner + management. */
export function canManageResources(role: string): boolean {
  return MANAGEMENT_ROLES.includes(role);
}

/** Can view and act on the dispatch queue.
 *  Available to all CRM roles. */
export function canManageDispatch(role: string): boolean {
  return (
    MANAGEMENT_ROLES.includes(role) ||
    CSR_ELEVATED_ROLES.includes(role) ||
    CSR_BASIC_ROLES.includes(role)
  );
}

// Keep a reference so callers can check the owner role constant if needed.
export { OWNER_ROLE };
