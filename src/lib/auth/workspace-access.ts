import { canCrmAccessPath, canCsrAccessPath, isCsr } from "@/lib/permissions";

export type WorkspaceKey =
  | "crm"
  | "staff_portal"
  | "driver"
  | "owner"
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

const CRM_ROLES = new Set(["owner", "manager", "assistant_manager", "store_manager", "crm", "csr", "csr_head", "csr_staff"]);
const MANAGER_ROLES = new Set(["manager", "assistant_manager", "store_manager"]);
const STAFF_PORTAL_EXCLUDED_PRIMARY_ROLES = new Set(["driver", "utility"]);

function branchNameFromProfile(profile: WorkspaceStaffProfile): string | null {
  const branch = profile.branches;
  if (!branch) return null;
  if (Array.isArray(branch)) return branch[0]?.name ?? null;
  return branch.name ?? null;
}

function workspaceMeta(
  key: WorkspaceKey,
  branchName: string | null
): WorkspaceAccess {
  switch (key) {
    case "crm":
      return {
        key,
        label: "CRM / Front Desk",
        description: "Manage customers, bookings, staff and front desk operations.",
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

  const role = profile.system_role;
  const staffType = profile.staff_type ?? null;
  const branchName = branchNameFromProfile(profile);
  const byKey = new Map<WorkspaceKey, WorkspaceAccess>();
  const add = (key: WorkspaceKey) => byKey.set(key, workspaceMeta(key, branchName));

  if (role === "owner") add("owner");
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

export function canAccessWorkspacePath(
  pathname: string,
  role: string,
  workspaces: readonly WorkspaceAccess[]
): boolean {
  if (pathname.startsWith("/select-workspace")) return workspaces.length > 0;

  if (pathname.startsWith("/crm")) {
    if (!hasWorkspaceAccess(workspaces, "crm")) return false;
    if (isCsr(role)) return canCsrAccessPath(role, pathname);
    if (role === "crm") return canCrmAccessPath(pathname);
    return true;
  }

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

  if (pathname.startsWith("/manager")) {
    return hasWorkspaceAccess(workspaces, "manager");
  }

  if (pathname.startsWith("/dev")) {
    return hasWorkspaceAccess(workspaces, "owner");
  }

  return true;
}
