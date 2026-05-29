/**
 * Centralized Role-Based Access Control (RBAC) for CradleHub.
 *
 * All role checks should go through this module — do not scatter
 * hardcoded role strings across components or server actions.
 */

// ── Roles ───────────────────────────────────────────────────────────────────

import {
  SYSTEM_ROLE_LABELS,
  SYSTEM_ROLES,
  type SystemRole,
} from "@/constants/staff-roles";

export { SYSTEM_ROLES, type SystemRole };

export const ROLE_LABELS: Record<string, string> = { ...SYSTEM_ROLE_LABELS };

// ── Role groups ─────────────────────────────────────────────────────────────

const OWNERS: readonly string[] = ["owner"];
const MANAGERS: readonly string[] = ["owner", "manager", "assistant_manager", "store_manager"];
const CSR_ROLES: readonly string[] = ["csr_head", "csr_staff", "csr"];
const CRM_ROLES: readonly string[] = ["crm"];
const BOOKING_OPERATIONS: readonly string[] = [
  ...MANAGERS,
  ...CRM_ROLES,
  ...CSR_ROLES,
];

// ── Permission helpers ──────────────────────────────────────────────────────

export function isOwner(role: string): boolean {
  return OWNERS.includes(role);
}

export function isManager(role: string): boolean {
  return MANAGERS.includes(role);
}

export function isCsr(role: string): boolean {
  return CSR_ROLES.includes(role);
}

export function isCsrHead(role: string): boolean {
  return role === "csr_head";
}

export function isCsrStaff(role: string): boolean {
  return role === "csr_staff" || role === "csr";
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
  repeats: [...MANAGERS, "crm", "csr_head"],
  lapsed: [...MANAGERS, "crm", "csr_head"],
};

export function canViewNav(role: string, permission: NavPermission): boolean {
  return NAV_PERMISSION_MAP[permission].includes(role);
}

// ── Action permissions ──────────────────────────────────────────────────────

/** Can create in-house / walk-in / phone bookings */
export function canCreateBooking(role: string): boolean {
  return BOOKING_OPERATIONS.includes(role);
}

/** Can view booking details and lists */
export function canViewBookings(role: string): boolean {
  return BOOKING_OPERATIONS.includes(role);
}

/** Can update basic booking details (notes, type, reschedule if allowed) */
export function canUpdateBooking(role: string): boolean {
  return BOOKING_OPERATIONS.includes(role);
}

/** Can cancel bookings (CSR Head + managers + owner) */
export function canCancelBooking(role: string): boolean {
  return MANAGERS.includes(role) || isCsrHead(role);
}

/** Can reassign therapist for a booking */
export function canReassignBooking(role: string): boolean {
  return MANAGERS.includes(role) || isCsrHead(role);
}

/** Can change booking status (start, complete, no-show — all ops roles) */
export function canChangeBookingStatus(role: string): boolean {
  return BOOKING_OPERATIONS.includes(role);
}

/** Can view customer records */
export function canViewCustomers(role: string): boolean {
  return BOOKING_OPERATIONS.includes(role);
}

/** Can create customer records */
export function canCreateCustomer(role: string): boolean {
  return BOOKING_OPERATIONS.includes(role);
}

/** Can update basic customer contact details */
export function canUpdateCustomer(role: string): boolean {
  return BOOKING_OPERATIONS.includes(role);
}

/** Can delete customer records (owner/manager only) */
export function canDeleteCustomer(role: string): boolean {
  return MANAGERS.includes(role);
}

/** Can view staff schedule / availability */
export function canViewSchedule(role: string): boolean {
  return BOOKING_OPERATIONS.includes(role);
}

/** Can manually adjust one staff member's availability */
export function canAdjustStaffSchedule(role: string): boolean {
  return MANAGERS.includes(role) || role === "crm" || isCsrHead(role);
}

/** Can manage services (owner/manager only) */
export function canManageServices(role: string): boolean {
  return MANAGERS.includes(role);
}

/** Can manage staff records (owner/manager only) */
export function canManageStaff(role: string): boolean {
  return MANAGERS.includes(role);
}

/** Can approve staff onboarding applications (owner/manager/CRM/CSR for MVP) */
export function canReviewStaffOnboarding(role: string): boolean {
  return MANAGERS.includes(role) || CSR_ROLES.includes(role) || CRM_ROLES.includes(role);
}

/** Can manage branches (owner/manager only) */
export function canManageBranches(role: string): boolean {
  return MANAGERS.includes(role);
}

/** Can view owner-level reports (owner/manager only) */
export function canViewOwnerReports(role: string): boolean {
  return MANAGERS.includes(role);
}

/** Can access dev panel (owner only) */
export function canAccessDevPanel(role: string): boolean {
  return isOwner(role);
}

/** Can view daily booking summary (all ops + CSR Head) */
export function canViewDailySummary(role: string): boolean {
  return BOOKING_OPERATIONS.includes(role);
}

// ── Route access permissions ────────────────────────────────────────────────

/** Routes that CSR roles are explicitly allowed to access */
export const CSR_ALLOWED_PREFIXES = [
  "/crm",
  "/manager/schedule",
  "/manager/bookings",
];

/** Routes that CRM role can access across workspaces */
export const CRM_ALLOWED_PREFIXES = [
  "/crm",
  "/manager/bookings",
];

/** Routes that are blocked for all CSR roles */
export const CSR_BLOCKED_PREFIXES = [
  "/owner",
  "/dev",
  "/manager/staff",
  "/manager/operations",
  "/manager/reports",
  "/manager/services",
  "/manager/settings",
];

/**
 * CRM sub-routes blocked for front-desk staff (csr_staff + legacy csr).
 * All /crm/* routes are now accessible to all CRM/front-desk roles.
 * Page-level edit permissions still protect specific actions within each page.
 */
export const CSR_STAFF_BLOCKED_CRM_PREFIXES: readonly string[] = [];

/** Check if a pathname is accessible by a CSR role */
export function canCsrAccessPath(role: string, pathname: string): boolean {
  if (!isCsr(role)) return true;

  // CSR cannot access blocked prefixes
  if (CSR_BLOCKED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return false;
  }

  if (isCsrStaff(role)) {
    if (CSR_STAFF_BLOCKED_CRM_PREFIXES.some((p) => pathname.startsWith(p))) {
      return false;
    }
  }

  // CSR can access allowed prefixes
  return CSR_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p));
}

/** Check if CRM role can access a pathname outside /crm */
export function canCrmAccessPath(pathname: string): boolean {
  if (CSR_BLOCKED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return false;
  }
  return CRM_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p));
}

// ── Workspace resolution ────────────────────────────────────────────────────

/** Default dashboard path for each role.
 * MVP: owner, manager, and all management variants land at /crm.
 */
export function getDefaultDashboardPath(role: string): string {
  // MVP: owner + management roles → CRM (owner/manager workspaces soft-paused)
  if (
    role === "owner" ||
    role === "manager" ||
    role === "assistant_manager" ||
    role === "store_manager"
  ) {
    return "/crm";
  }
  if (isCsr(role)) return "/crm";
  if (role === "crm") return "/crm";
  if (role === "driver") return "/driver";
  if (role === "utility") return "/utility";
  if (
    role === "staff" ||
    role === "therapist" ||
    role === "masseuse" ||
    role === "service_provider" ||
    role === "service_head" ||
    role === "service_staff"
  ) {
    return "/staff-portal";
  }
  return "/staff-portal";
}
