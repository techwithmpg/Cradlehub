/**
 * Staff onboarding approval permissions.
 *
 * MVP temporary behavior: CRM/CSR roles can approve low-risk operational
 * staff applications. They CANNOT approve management or admin roles.
 *
 * This should be reviewed after MVP.
 */

import {
  CRM_ASSIGNABLE_SYSTEM_ROLES,
  MANAGER_ASSIGNABLE_SYSTEM_ROLES,
  OWNER_ASSIGNABLE_SYSTEM_ROLES,
  SENSITIVE_SYSTEM_ROLES as STAFF_SENSITIVE_SYSTEM_ROLES,
  canonicalizeSystemRole,
  isFrontDeskRole,
} from "@/constants/staff";
import { isOwner, isManager } from "@/lib/permissions";

/** System roles that grant management or admin access. */
export const SENSITIVE_SYSTEM_ROLES = STAFF_SENSITIVE_SYSTEM_ROLES;

/** System roles considered safe for CRM/CSR to approve. */
export const OPERATIONAL_SYSTEM_ROLES = [
  "staff",
  "service_staff",
  "service_head",
  "driver",
  "utility",
] as const;

export function isSensitiveSystemRole(role: string): boolean {
  return SENSITIVE_SYSTEM_ROLES.includes(canonicalizeSystemRole(role) as (typeof SENSITIVE_SYSTEM_ROLES)[number]);
}

export function isOperationalSystemRole(role: string): boolean {
  return OPERATIONAL_SYSTEM_ROLES.includes(role as (typeof OPERATIONAL_SYSTEM_ROLES)[number]);
}

export interface CanApproveStaffOnboardingInput {
  approverRole: string;
  approverBranchId?: string | null;
  targetBranchId?: string | null;
  requestedSystemRole: string;
}

export interface CanApproveResult {
  allowed: boolean;
  reason?: string;
  assignableRoles: string[];
}

/**
 * Determine whether an approver can approve a staff onboarding request.
 *
 * Rules:
 * 1. Owner can approve all allowed roles.
 * 2. Manager can approve staff within their branch scope.
 * 3. CRM/CSR can temporarily approve only operational staff roles.
 * 4. CRM/CSR approval must be branch-scoped.
 * 5. CRM/CSR cannot approve any management/admin role.
 * 6. CRM/CSR cannot change a requested role into a management role.
 * 7. If requested role is unknown/legacy/blank/management-like, require owner/manager.
 */
export function canApproveStaffOnboarding({
  approverRole,
  approverBranchId,
  targetBranchId,
  requestedSystemRole,
}: CanApproveStaffOnboardingInput): CanApproveResult {
  // ── Owner ───────────────────────────────────────────────────────────────
  const canonicalApproverRole = canonicalizeSystemRole(approverRole);
  const canonicalRequestedRole = canonicalizeSystemRole(requestedSystemRole);

  if (isOwner(canonicalApproverRole)) {
    return {
      allowed: true,
      assignableRoles: [...OWNER_ASSIGNABLE_SYSTEM_ROLES],
    };
  }

  // ── Manager ─────────────────────────────────────────────────────────────
  if (isManager(canonicalApproverRole)) {
    if (targetBranchId && approverBranchId && targetBranchId !== approverBranchId) {
      return {
        allowed: false,
        reason: "You can only approve staff for your own branch.",
        assignableRoles: [...MANAGER_ASSIGNABLE_SYSTEM_ROLES],
      };
    }
    return {
      allowed: true,
      assignableRoles: [...MANAGER_ASSIGNABLE_SYSTEM_ROLES],
    };
  }

  // ── CRM / CSR ───────────────────────────────────────────────────────────
  if (isFrontDeskRole(approverRole)) {
    // Branch scope check
    if (targetBranchId && approverBranchId && targetBranchId !== approverBranchId) {
      return {
        allowed: false,
        reason: "You can only approve staff for your own branch.",
        assignableRoles: [...CRM_ASSIGNABLE_SYSTEM_ROLES],
      };
    }

    // Cannot approve management roles
    if (isSensitiveSystemRole(canonicalRequestedRole)) {
      return {
        allowed: false,
        reason: "Management and admin roles require owner or manager approval.",
        assignableRoles: [...CRM_ASSIGNABLE_SYSTEM_ROLES],
      };
    }

    // Can only assign operational roles
    return {
      allowed: true,
      assignableRoles: [...CRM_ASSIGNABLE_SYSTEM_ROLES],
    };
  }

  // ── Everyone else ───────────────────────────────────────────────────────
  return {
    allowed: false,
    reason: "You do not have permission to approve staff applications.",
    assignableRoles: [],
  };
}
