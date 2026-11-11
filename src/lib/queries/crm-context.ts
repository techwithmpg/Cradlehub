import { redirect } from "next/navigation";
import { cache } from "react";
import "server-only";
import {
  canAccessCrmWorkspace,
  canConfirmPayments,
  canManageBookings,
  canManageCrmSetup,
  canManageCustomers,
  canManageDispatch,
  canManageOperationalStaff,
  canManageResources,
  canManageServices,
  canManageStaffAssignments,
  canManageStaffServices,
  canManageStaffServicesAcrossBranches,
  canUpdateServiceVisibility,
} from "@/lib/auth/crm-permissions";
import { canonicalizeSystemRole } from "@/constants/staff-roles";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { getDevBypassBranchContext } from "@/lib/dev-bypass-server";
import { resolveOwnerFrontDeskBranch } from "@/lib/queries/front-desk-branch";
import { getLayoutStaffContext } from "@/lib/queries/staff-context";

type BranchRelation = { name: string | null } | { name: string | null }[] | null;

export type FrontDeskDestination = {
  key: "front_desk" | "schedule" | "customers" | "dispatch" | "admin_setup";
  label: string;
  href: string;
};

export type FrontDeskCapabilities = {
  canManageCrmSetup: boolean;
  canManageServices: boolean;
  canManageBookings: boolean;
  canConfirmPayments: boolean;
  canManageCustomers: boolean;
  canManageOperationalStaff: boolean;
  canManageStaffAssignments: boolean;
  canManageStaffServices: boolean;
  canManageStaffServicesAcrossBranches: boolean;
  canUpdateServiceVisibility: boolean;
  canManageResources: boolean;
  canManageDispatch: boolean;
};

export type FrontDeskContext = {
  userId: string;
  role: string;
  branchId: string;
  branchName: string;
  capabilities: FrontDeskCapabilities;
  allowedDestinations: FrontDeskDestination[];
};

function branchNameFromRelation(branches: BranchRelation): string {
  const branch = Array.isArray(branches) ? branches[0] : branches;
  return branch?.name ?? "Your Branch";
}

function buildFrontDeskCapabilities(role: string): FrontDeskCapabilities {
  return {
    canManageCrmSetup: canManageCrmSetup(role),
    canManageServices: canManageServices(role),
    canManageBookings: canManageBookings(role),
    canConfirmPayments: canConfirmPayments(role),
    canManageCustomers: canManageCustomers(role),
    canManageOperationalStaff: canManageOperationalStaff(role),
    canManageStaffAssignments: canManageStaffAssignments(role),
    canManageStaffServices: canManageStaffServices(role),
    canManageStaffServicesAcrossBranches: canManageStaffServicesAcrossBranches(role),
    canUpdateServiceVisibility: canUpdateServiceVisibility(role),
    canManageResources: canManageResources(role),
    canManageDispatch: canManageDispatch(role),
  };
}

function buildAllowedFrontDeskDestinations(role: string): FrontDeskDestination[] {
  const destinations: FrontDeskDestination[] = [
    { key: "front_desk", label: "Front Desk", href: "/crm/today" },
    { key: "schedule", label: "Schedule", href: "/crm/schedule" },
    { key: "customers", label: "Customers", href: "/crm/customers" },
    { key: "dispatch", label: "Dispatch", href: "/crm/dispatch" },
  ];

  if (canManageCrmSetup(role)) {
    destinations.push({ key: "admin_setup", label: "Admin & Setup", href: "/crm/setup" });
  }

  return destinations;
}

export const getCrmContext = cache(async function getCrmContext() {
  const ctx = await getLayoutStaffContext();
  if (!ctx?.user) redirect("/login");

  const { user, me } = ctx;

  if (!me && isDevAuthBypassEnabled()) {
    return { role: "owner" as string, branchId: null as string | null };
  }

  if (!me || !canAccessCrmWorkspace(me.system_role)) redirect("/login");

  const role = canonicalizeSystemRole(me.system_role);
  const ownerBranch = role === "owner"
    ? await resolveOwnerFrontDeskBranch(user.id, me.branch_id)
    : null;
  return {
    role,
    branchId: role === "owner" ? ownerBranch?.id ?? null : me.branch_id,
  };
});

export const getFrontDeskContext = cache(async function getFrontDeskContext(): Promise<FrontDeskContext> {
  const ctx = await getLayoutStaffContext();
  if (!ctx?.user) redirect("/login");

  const { user, me } = ctx;

  if ((!me || !canAccessCrmWorkspace(me.system_role) || (!me.branch_id && canonicalizeSystemRole(me.system_role) !== "owner")) && isDevAuthBypassEnabled()) {
    const devBranch = await getDevBypassBranchContext();
    if (!devBranch) redirect("/login");
    const role = devBranch.role;
    return {
      userId: user.id,
      role,
      branchId: devBranch.branchId,
      branchName: devBranch.branchName,
      capabilities: buildFrontDeskCapabilities(role),
      allowedDestinations: buildAllowedFrontDeskDestinations(role),
    };
  }

  if (!me || !canAccessCrmWorkspace(me.system_role) || (!me.branch_id && canonicalizeSystemRole(me.system_role) !== "owner")) redirect("/login");

  const role = canonicalizeSystemRole(me.system_role);
  const ownerBranch = role === "owner"
    ? await resolveOwnerFrontDeskBranch(user.id, me.branch_id)
    : null;
  if (role === "owner" && !ownerBranch) redirect("/login");
  return {
    userId: user.id,
    role,
    branchId: ownerBranch?.id ?? me.branch_id!,
    branchName: ownerBranch?.name ?? branchNameFromRelation(me.branches as BranchRelation),
    capabilities: buildFrontDeskCapabilities(role),
    allowedDestinations: buildAllowedFrontDeskDestinations(role),
  };
});
