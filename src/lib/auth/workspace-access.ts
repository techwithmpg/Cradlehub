import {
  FRONT_DESK_ROLE_ALIASES,
  canonicalizeSystemRole,
  isFrontDeskRole,
  isServiceStaffType,
} from "@/constants/staff-roles";
import { canCrmAccessPath } from "@/lib/permissions";

export type WorkspaceKey =
  | "crm"
  | "staff_portal"
  | "driver"
  | "owner"
  | "marketing"
  | "manager"
  | "utility";

export type WorkspaceAccess = {
  key: WorkspaceKey;
  label: string;
  description: string;
  href: string;
  priority: number;
  branchName?: string | null;
};

export type WorkspaceStaffProfile = {
  id: string;
  full_name?: string | null;
  system_role: string | null;
  staff_type?: string | null;
  branch_id?: string | null;
  branches?: { name: string | null } | { name: string | null }[] | null;
};

const CRM_ROLES = new Set([
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  ...FRONT_DESK_ROLE_ALIASES,
]);
const MANAGER_ROLES = new Set(["manager", "assistant_manager", "store_manager"]);
const MARKETING_ROLES = new Set(["owner", "digital_marketer"]);
const STAFF_PORTAL_EXCLUDED_PRIMARY_ROLES = new Set(["digital_marketer", "driver", "utility"]);

function branchNameFromProfile(profile: WorkspaceStaffProfile): string | null {
  const branch = profile.branches;
  if (!branch) return null;
  if (Array.isArray(branch)) return branch[0]?.name ?? null;
  return branch.name ?? null;
}

function workspaceMeta(key: WorkspaceKey, branchName: string | null): WorkspaceAccess {
  switch (key) {
    case "crm":
      return {
        key,
        label: "Front Desk",
        description: "Manage customers, bookings, dispatch and front-desk operations.",
        href: "/crm",
        priority: 10,
        branchName,
      };
    case "staff_portal":
      return {
        key,
        label: "Staff Portal",
        description: "View your schedule, bookings, services and performance.",
        href: "/staff-portal",
        priority: 20,
        branchName,
      };
    case "driver":
      return {
        key,
        label: "Driver Portal",
        description: "View delivery routes, dispatch tasks and job assignments.",
        href: "/driver",
        priority: 15,
        branchName,
      };
    case "owner":
      return {
        key,
        label: "Owner / Admin",
        description: "System overview, settings, reports and administration.",
        href: "/owner",
        priority: 5,
        branchName,
      };
    case "marketing":
      return {
        key,
        label: "Marketing Studio",
        description: "Prepare public-site drafts, media, brand, and SEO updates.",
        href: "/marketing",
        priority: 7,
        branchName,
      };
    case "manager":
      return {
        key,
        label: "Manager",
        description: "Oversee branch operations, staff, bookings and daily readiness.",
        href: "/manager",
        priority: 8,
        branchName,
      };
    case "utility":
      return {
        key,
        label: "Utility Portal",
        description: "View utility tasks, assignments and operational updates.",
        href: "/utility",
        priority: 25,
        branchName,
      };
  }
}

export function buildWorkspaceAccessFromStaffProfile(
  profile: WorkspaceStaffProfile | null
): WorkspaceAccess[] {
  if (!profile?.system_role) return [];

  const role = canonicalizeSystemRole(profile.system_role);
  const staffType = profile.staff_type ?? null;
  const branchName = branchNameFromProfile(profile);
  const byKey = new Map<WorkspaceKey, WorkspaceAccess>();
  const add = (key: WorkspaceKey) => byKey.set(key, workspaceMeta(key, branchName));

  if (role === "owner") add("owner");
  if (MARKETING_ROLES.has(role)) add("marketing");
  if (MANAGER_ROLES.has(role)) add("manager");
  if (CRM_ROLES.has(role)) add("crm");

  if (role === "driver" || staffType === "driver") add("driver");
  if (role === "utility" || staffType === "utility") add("utility");

  if (!STAFF_PORTAL_EXCLUDED_PRIMARY_ROLES.has(role)) {
    add("staff_portal");
  }

  return [...byKey.values()].sort((a, b) => a.priority - b.priority);
}

export function hasWorkspaceAccess(
  workspaces: readonly WorkspaceAccess[],
  key: WorkspaceKey
): boolean {
  return workspaces.some((workspace) => workspace.key === key);
}

export function getPrimaryWorkspaceHref(workspaces: readonly WorkspaceAccess[]): string {
  return [...workspaces].sort((a, b) => a.priority - b.priority)[0]?.href ?? "/account/setup";
}

export function getWorkspaceSwitchDestination(workspaces: readonly WorkspaceAccess[]): string {
  if (workspaces.length === 0) return "/account/setup";
  if (workspaces.length === 1) return getPrimaryWorkspaceHref(workspaces);
  return "/select-workspace";
}

export type StaffPwaOperationalGroup = "provider" | "crm_general" | "utility" | "driver";

/**
 * Resolves trusted staff identity to one of the 4 approved Staff-PWA operational groups
 * (Provider, CRM / General Staff, Utility, Driver).
 *
 * Managerial, Owner, and Digital Marketer roles do NOT produce Staff-PWA operational groups
 * (PWA-C4 Section 1 & External Review Directive).
 */
export function resolveStaffPwaOperationalGroup(
  role: string | null | undefined,
  staffType?: string | null | undefined
): StaffPwaOperationalGroup | null {
  if (!role) return null;
  const canonicalRole = canonicalizeSystemRole(role);
  const type = (staffType ?? "").toLowerCase();

  // Exclude managerial/administrative and marketing roles unconditionally
  if (
    canonicalRole === "owner" ||
    canonicalRole === "manager" ||
    canonicalRole === "assistant_manager" ||
    canonicalRole === "store_manager" ||
    canonicalRole === "digital_marketer" ||
    type === "managerial"
  ) {
    return null;
  }

  // 1. Driver
  if (canonicalRole === "driver" || type === "driver") {
    return "driver";
  }

  // 2. Utility
  if (canonicalRole === "utility" || type === "utility") {
    return "utility";
  }

  // 3. Provider (therapist, nail_tech, aesthetician/facialist, salon_head)
  if (
    isServiceStaffType(type) ||
    type === "facialist" ||
    canonicalRole === "service_head" ||
    canonicalRole === "service_staff"
  ) {
    return "provider";
  }

  // 4. CRM / General Staff (front desk, csr)
  if (canonicalRole === "crm" || isFrontDeskRole(role) || role === "front_desk" || type === "csr") {
    return "crm_general";
  }

  // Generic staff role without managerial override
  if (canonicalRole === "staff") {
    if (isServiceStaffType(type) || type === "facialist") return "provider";
    if (type === "driver") return "driver";
    if (type === "utility") return "utility";
    return "crm_general";
  }

  return null;
}

export function canAccessWorkspacePath(
  pathname: string,
  role: string,
  workspaces: readonly WorkspaceAccess[],
  staffType?: string | null
): boolean {
  if (pathname.startsWith("/select-workspace")) return workspaces.length > 0;

  if (pathname.startsWith("/crm")) {
    if (!hasWorkspaceAccess(workspaces, "crm")) return false;
    if (canonicalizeSystemRole(role) === "crm") return canCrmAccessPath(pathname);
    return true;
  }

  // Staff-PWA operational boundary: /staff/* and /scan
  // Strictly rejects Manager, Owner, and Digital Marketer
  if (pathname.startsWith("/staff/scan") || pathname.startsWith("/scan")) {
    return resolveStaffPwaOperationalGroup(role, staffType) !== null;
  }

  if (pathname.startsWith("/staff/driver")) {
    return resolveStaffPwaOperationalGroup(role, staffType) === "driver";
  }

  if (pathname.startsWith("/staff/utility")) {
    return resolveStaffPwaOperationalGroup(role, staffType) === "utility";
  }

  if (pathname.startsWith("/staff/schedule") || pathname.startsWith("/staff/progress")) {
    return resolveStaffPwaOperationalGroup(role, staffType) === "provider";
  }

  if (pathname.startsWith("/staff/notices")) {
    return resolveStaffPwaOperationalGroup(role, staffType) !== null;
  }

  if (pathname.startsWith("/staff/work")) {
    return resolveStaffPwaOperationalGroup(role, staffType) === "crm_general";
  }

  if (pathname.startsWith("/staff/more")) {
    const group = resolveStaffPwaOperationalGroup(role, staffType);
    return group === "provider" || group === "crm_general";
  }

  if (pathname === "/staff" || pathname.startsWith("/staff/")) {
    return resolveStaffPwaOperationalGroup(role, staffType) !== null;
  }

  // Historical legacy workspace authority is fully preserved
  if (pathname.startsWith("/staff-portal")) {
    return hasWorkspaceAccess(workspaces, "staff_portal");
  }

  if (pathname.startsWith("/driver")) {
    return hasWorkspaceAccess(workspaces, "driver");
  }

  if (pathname.startsWith("/utility")) {
    return hasWorkspaceAccess(workspaces, "utility");
  }

  if (pathname.startsWith("/owner")) {
    return hasWorkspaceAccess(workspaces, "owner");
  }

  if (pathname.startsWith("/marketing")) {
    return hasWorkspaceAccess(workspaces, "marketing");
  }

  if (pathname.startsWith("/manager")) {
    return hasWorkspaceAccess(workspaces, "manager");
  }

  if (pathname.startsWith("/dev")) {
    return hasWorkspaceAccess(workspaces, "owner");
  }

  return true;
}
