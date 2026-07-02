/**
 * Centralized Role-Based Access Control (RBAC) for CradleHub.
 *
 * All role checks should go through this module — do not scatter
 * hardcoded role strings across components or server actions.
 */

// ── Roles ───────────────────────────────────────────────────────────────────

import {
  FRONT_DESK_ROLE_ALIASES,
  SYSTEM_ROLE_LABELS,
  SYSTEM_ROLES,
  canonicalizeSystemRole,
  isFrontDeskRole,
  type SystemRole,
} from "@/constants/staff-roles";

export { SYSTEM_ROLES, type SystemRole };

export const ROLE_LABELS: Record<string, string> = { ...SYSTEM_ROLE_LABELS };

// ── Role groups ─────────────────────────────────────────────────────────────

const OWNERS: readonly string[] = ["owner"];
const MANAGERS: readonly string[] = ["owner", "manager", "assistant_manager", "store_manager"];
const CRM_ROLES: readonly string[] = FRONT_DESK_ROLE_ALIASES;
const BOOKING_OPERATIONS: readonly string[] = [
  ...MANAGERS,
  ...CRM_ROLES,
];

// ── Permission helpers ──────────────────────────────────────────────────────

export function isOwner(role: string): boolean {
  return OWNERS.includes(role);
}

export function isManager(role: string): boolean {
  return MANAGERS.includes(canonicalizeSystemRole(role));
}

export function isCsr(role: string): boolean {
  return isFrontDeskRole(role);
}

// ── Navigation permissions ──────────────────────────────────────────────────

export type NavPermission =
  | "today"
  | "bookings"
  | "customers"
  | "schedule"
  | "services"
  | "branches"
  | "staff"
  | "reports"
  | "dev_panel"
  | "operations"
  | "repeats"
  | "lapsed";

const NAV_PERMISSION_MAP: Record<NavPermission, readonly string[]> = {
  today: BOOKING_OPERATIONS,
  bookings: BOOKING_OPERATIONS,
  customers: BOOKING_OPERATIONS,
  schedule: BOOKING_OPERATIONS,
  services: MANAGERS,
  branches: MANAGERS,
  staff: MANAGERS,
  reports: MANAGERS,
  dev_panel: OWNERS,
  operations: MANAGERS,
  repeats: [...MANAGERS, ...CRM_ROLES],
  lapsed: [...MANAGERS, ...CRM_ROLES],
};

export function canViewNav(role: string, permission: NavPermission): boolean {
  return NAV_PERMISSION_MAP[permission].includes(canonicalizeSystemRole(role));
}

// ── Action permissions ──────────────────────────────────────────────────────

/** Can create in-house / walk-in / phone bookings */
export function canCreateBooking(role: string): boolean {
  return BOOKING_OPERATIONS.includes(canonicalizeSystemRole(role));
}

/** Can view booking details and lists */
export function canViewBookings(role: string): boolean {
  return BOOKING_OPERATIONS.includes(canonicalizeSystemRole(role));
}

/** Can update basic booking details (notes, type, reschedule if allowed) */
export function canUpdateBooking(role: string): boolean {
  return BOOKING_OPERATIONS.includes(canonicalizeSystemRole(role));
}

/** Can cancel bookings (all CRM/front-desk roles + management) */
export function canCancelBooking(role: string): boolean {
  const canonicalRole = canonicalizeSystemRole(role);
  return MANAGERS.includes(canonicalRole) || isFrontDeskRole(role);
}

/** Can reassign therapist for a booking */
export function canReassignBooking(role: string): boolean {
  const canonicalRole = canonicalizeSystemRole(role);
  return MANAGERS.includes(canonicalRole) || isFrontDeskRole(role);
}

/** Can change booking status (start, complete, no-show — all ops roles) */
export function canChangeBookingStatus(role: string): boolean {
  return BOOKING_OPERATIONS.includes(canonicalizeSystemRole(role));
}

/** Can view customer records */
export function canViewCustomers(role: string): boolean {
  return BOOKING_OPERATIONS.includes(canonicalizeSystemRole(role));
}

/** Can create customer records */
export function canCreateCustomer(role: string): boolean {
  return BOOKING_OPERATIONS.includes(canonicalizeSystemRole(role));
}

/** Can update basic customer contact details */
export function canUpdateCustomer(role: string): boolean {
  return BOOKING_OPERATIONS.includes(canonicalizeSystemRole(role));
}

/** Can delete customer records (owner/manager only) */
export function canDeleteCustomer(role: string): boolean {
  return MANAGERS.includes(canonicalizeSystemRole(role));
}

/** Can view staff schedule / availability */
export function canViewSchedule(role: string): boolean {
  return BOOKING_OPERATIONS.includes(canonicalizeSystemRole(role));
}

/** Can manually adjust one staff member's availability */
export function canAdjustStaffSchedule(role: string): boolean {
  const canonicalRole = canonicalizeSystemRole(role);
  return MANAGERS.includes(canonicalRole) || canonicalRole === "crm";
}

/** Can manage services (owner/manager only) */
export function canManageServices(role: string): boolean {
  return MANAGERS.includes(canonicalizeSystemRole(role));
}

/** Can manage staff records (owner/manager only) */
export function canManageStaff(role: string): boolean {
  return MANAGERS.includes(canonicalizeSystemRole(role));
}

/** Can approve staff onboarding applications (owner/manager/CRM/CSR for MVP) */
export function canReviewStaffOnboarding(role: string): boolean {
  const canonicalRole = canonicalizeSystemRole(role);
  return MANAGERS.includes(canonicalRole) || canonicalRole === "crm";
}

/** Can manage branches (owner/manager only) */
export function canManageBranches(role: string): boolean {
  return MANAGERS.includes(canonicalizeSystemRole(role));
}

/** Can view owner-level reports (owner/manager only) */
export function canViewOwnerReports(role: string): boolean {
  return MANAGERS.includes(canonicalizeSystemRole(role));
}

/** Can access dev panel (owner only) */
export function canAccessDevPanel(role: string): boolean {
  return isOwner(canonicalizeSystemRole(role));
}

/** Can view daily booking summary (all booking operations roles) */
export function canViewDailySummary(role: string): boolean {
  return BOOKING_OPERATIONS.includes(canonicalizeSystemRole(role));
}

// ── Route access permissions ────────────────────────────────────────────────

/** Routes that front-desk roles are explicitly allowed to access */
export const FRONT_DESK_ALLOWED_PREFIXES = [
  "/crm",
  "/manager/schedule",
  "/manager/bookings",
];

/** Routes that CRM role can access across workspaces */
export const FRONT_DESK_WORKSPACE_PREFIXES = [
  "/crm",
  "/manager/bookings",
];

/** Routes that are blocked for all front-desk roles */
export const FRONT_DESK_BLOCKED_PREFIXES = [
  "/owner",
  "/dev",
  "/manager/staff",
  "/manager/operations",
  "/manager/reports",
  "/manager/services",
  "/manager/settings",
];

/**
 * CRM sub-routes blocked for front-desk staff.
 * All /crm/* routes are now accessible to all CRM/front-desk roles.
 * Page-level edit permissions still protect specific actions within each page.
 */
export const FRONT_DESK_BLOCKED_CRM_PREFIXES: readonly string[] = [];

export const CSR_ALLOWED_PREFIXES = FRONT_DESK_ALLOWED_PREFIXES;
export const CRM_ALLOWED_PREFIXES = FRONT_DESK_WORKSPACE_PREFIXES;
export const CSR_BLOCKED_PREFIXES = FRONT_DESK_BLOCKED_PREFIXES;
export const CSR_STAFF_BLOCKED_CRM_PREFIXES = FRONT_DESK_BLOCKED_CRM_PREFIXES;

/** Check if a pathname is accessible by a front-desk role */
export function canCsrAccessPath(role: string, pathname: string): boolean {
  if (!isFrontDeskRole(role)) return true;

  if (FRONT_DESK_BLOCKED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return false;
  }

  if (FRONT_DESK_BLOCKED_CRM_PREFIXES.some((p) => pathname.startsWith(p))) {
    return false;
  }

  return FRONT_DESK_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p));
}

/** Check if CRM role can access a pathname outside /crm */
export function canCrmAccessPath(pathname: string): boolean {
  if (FRONT_DESK_BLOCKED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return false;
  }
  return FRONT_DESK_WORKSPACE_PREFIXES.some((p) => pathname.startsWith(p));
}

// ── Workspace resolution ────────────────────────────────────────────────────

/** Default dashboard path for each role.
 * Owner lands in the restored Owner workspace.
 * MVP: manager and management variants still land at /crm while Manager is soft-paused.
 */
export function getDefaultDashboardPath(role: string): string {
  const canonicalRole = canonicalizeSystemRole(role);
  if (canonicalRole === "owner") return "/owner";

  // MVP: management roles → CRM (manager workspace soft-paused)
  if (
    canonicalRole === "manager" ||
    canonicalRole === "assistant_manager" ||
    canonicalRole === "store_manager"
  ) {
    return "/crm";
  }
  if (canonicalRole === "crm") return "/crm";
  if (canonicalRole === "driver") return "/driver";
  if (canonicalRole === "utility") return "/utility";
  if (
    canonicalRole === "staff" ||
    canonicalRole === "therapist" ||
    canonicalRole === "masseuse" ||
    canonicalRole === "service_provider" ||
    canonicalRole === "service_head" ||
    canonicalRole === "service_staff"
  ) {
    return "/staff-portal";
  }
  return "/staff-portal";
}
