import { describe, expect, it } from "vitest";

import {
  FRONT_DESK_ROLE_ALIASES,
  SYSTEM_ROLE_OPTIONS,
  canonicalizeSystemRole,
  getAssignableSystemRoles,
  isFrontDeskRole,
} from "@/constants/staff";
import {
  canAccessDevPanel,
  canCancelBooking,
  canReassignBooking,
  canAdjustStaffSchedule,
  canReviewStaffOnboarding,
} from "@/lib/permissions";
import {
  canAccessCrmWorkspace,
  canConfirmPayments,
  canManageBookings,
  canManageBranchResources,
  canManageCrmSetup,
  canManageCrmOperationalStaff,
  canManageOperationalStaff,
  canManageResources,
  canManageStaffAssignments,
  canManageStaffCapabilities,
  canManageStaffServices,
  canManageStaffServicesAcrossBranches,
  canUpdateServiceVisibility,
} from "@/lib/auth/crm-permissions";
import { getCrmApiAccessForRole } from "@/lib/auth/crm-api-access";
import {
  buildWorkspaceAccessFromStaffProfile,
  canAccessWorkspacePath,
  type WorkspaceStaffProfile,
} from "@/lib/auth/workspace-access";
import { NAV_CONFIG, resolveCrmNavKeyFromRole } from "@/components/features/dashboard/nav-config";

const CRM_PAGE_PATHS = [
  "/crm/today",
  "/crm/bookings",
  "/crm/staff",
  "/crm/staff-availability",
  "/crm/setup",
  "/crm/reconciliation",
] as const;

const NON_CRM_ROLES = [
  "staff",
  "service_head",
  "service_staff",
  "driver",
  "utility",
] as const;

function profile(role: string): WorkspaceStaffProfile {
  return {
    id: `staff-${role}`,
    full_name: "Role Test",
    system_role: role,
    staff_type: role === "driver" || role === "utility" ? role : "therapist",
    branch_id: "branch-1",
    branches: { name: "Main Branch" },
  };
}

function crmCapabilitySnapshot(role: string) {
  return {
    access: canAccessCrmWorkspace(role),
    bookings: canManageBookings(role),
    payments: canConfirmPayments(role),
    schedule: canAdjustStaffSchedule(role),
    onboarding: canReviewStaffOnboarding(role),
    operationalStaff: canManageCrmOperationalStaff(role),
    staffCapabilities: canManageStaffCapabilities(role),
    branchResources: canManageBranchResources(role),
    setup: canManageCrmSetup(role),
    cancel: canCancelBooking(role),
    reassign: canReassignBooking(role),
    staffAssignments: canManageStaffAssignments(role),
    staffServices: canManageStaffServices(role),
    serviceVisibility: canUpdateServiceVisibility(role),
    resources: canManageResources(role),
    operationalStaffAlias: canManageOperationalStaff(role),
  };
}

describe("Front Desk role unification", () => {
  it("canonicalizes every legacy Front Desk system role to crm", () => {
    for (const role of FRONT_DESK_ROLE_ALIASES) {
      expect(isFrontDeskRole(role)).toBe(true);
      expect(canonicalizeSystemRole(role)).toBe("crm");
    }
  });

  it("removes legacy Front Desk aliases from selectable system roles", () => {
    const optionValues = SYSTEM_ROLE_OPTIONS.map((option) => option.value);

    expect(optionValues).toContain("crm");
    expect(optionValues).not.toContain("csr");
    expect(optionValues).not.toContain("csr_head");
    expect(optionValues).not.toContain("csr_staff");
  });

  it("grants equal CRM workspace capabilities to all Front Desk aliases", () => {
    const canonicalSnapshot = crmCapabilitySnapshot("crm");

    for (const role of FRONT_DESK_ROLE_ALIASES) {
      expect(crmCapabilitySnapshot(role)).toEqual(canonicalSnapshot);
    }
  });

  it("grants equal booking and schedule permissions to all Front Desk aliases", () => {
    for (const role of FRONT_DESK_ROLE_ALIASES) {
      expect(canCancelBooking(role)).toBe(true);
      expect(canReassignBooking(role)).toBe(true);
      expect(canAdjustStaffSchedule(role)).toBe(true);
      expect(canReviewStaffOnboarding(role)).toBe(true);
    }
  });

  it("does not change CRM permissions based on is_head", () => {
    const regularCrm = { system_role: "crm", is_head: false };
    const headCrm = { system_role: "crm", is_head: true };

    expect(crmCapabilitySnapshot(regularCrm.system_role)).toEqual(
      crmCapabilitySnapshot(headCrm.system_role)
    );
  });

  it("allows every Front Desk alias into the same CRM pages", () => {
    for (const role of FRONT_DESK_ROLE_ALIASES) {
      const workspaces = buildWorkspaceAccessFromStaffProfile(profile(role));

      expect(workspaces.map((workspace) => workspace.key)).toContain("crm");
      for (const path of CRM_PAGE_PATHS) {
        expect(canAccessWorkspacePath(path, role, workspaces)).toBe(true);
      }
    }
  });

  it("denies non-CRM staff roles from CRM pages and API access", () => {
    for (const role of NON_CRM_ROLES) {
      const workspaces = buildWorkspaceAccessFromStaffProfile(profile(role));

      expect(canAccessCrmWorkspace(role)).toBe(false);
      expect(getCrmApiAccessForRole(role)).toEqual({
        ok: false,
        status: 403,
        error: "Forbidden",
      });
      expect(canAccessWorkspacePath("/crm/staff", role, workspaces)).toBe(false);
    }
  });

  it("keeps all CRM roles on one Front Desk navigation surface", () => {
    expect(NAV_CONFIG).not.toHaveProperty("crm_admin");
    expect(NAV_CONFIG.crm?.systemItems?.map((item) => item.href)).toEqual(
      expect.arrayContaining([
        "/crm/staff",
        "/crm/setup?tab=services",
        "/crm/setup?tab=spaces",
        "/crm/setup?tab=booking_rules",
        "/crm/staff-availability",
        "/crm/reconciliation",
      ])
    );

    for (const role of FRONT_DESK_ROLE_ALIASES) {
      expect(resolveCrmNavKeyFromRole(role)).toBe("crm");
    }
  });

  it("allows CRM API access for Front Desk, management, and owner roles", () => {
    expect(getCrmApiAccessForRole(null)).toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized",
    });

    for (const role of [
      "owner",
      "manager",
      "assistant_manager",
      "store_manager",
      ...FRONT_DESK_ROLE_ALIASES,
    ]) {
      expect(getCrmApiAccessForRole(role)).toBeNull();
    }
  });

  it("retains owner-only and management boundaries outside Front Desk unification", () => {
    expect(canManageStaffServicesAcrossBranches("owner")).toBe(true);
    expect(canManageStaffServicesAcrossBranches("manager")).toBe(false);
    expect(canManageStaffServicesAcrossBranches("crm")).toBe(false);

    expect(canAccessDevPanel("owner")).toBe(true);
    expect(canAccessDevPanel("manager")).toBe(false);
    expect(canAccessDevPanel("crm")).toBe(false);

    expect(getAssignableSystemRoles("crm")).toEqual([
      "crm",
      "staff",
      "service_head",
      "service_staff",
      "driver",
      "utility",
    ]);
    expect(getAssignableSystemRoles("crm")).not.toContain("owner");
    expect(getAssignableSystemRoles("manager")).not.toContain("owner");
  });
});
