import { describe, expect, it } from "vitest";
import {
  buildWorkspaceAccessFromStaffProfile,
  canAccessWorkspacePath,
  getPrimaryWorkspaceHref,
  getWorkspaceSwitchDestination,
  type WorkspaceKey,
  type WorkspaceStaffProfile,
} from "../../../src/lib/auth/workspace-access";
import { getDefaultDashboardPath } from "../../../src/lib/permissions";
import { NAV_CONFIG, resolveWorkspaceKeyFromRole } from "../../../src/components/features/dashboard/nav-config";
import { OWNER_PREFETCH } from "../../../src/components/features/workspace/workspace-prefetch-config";

const OWNER_ROUTE_PREFIXES = new Set([
  "/owner",
  "/owner/attendance",
  "/owner/bookings",
  "/owner/branches",
  "/owner/dispatch",
  "/owner/marketing",
  "/owner/notifications",
  "/owner/payroll",
  "/owner/reports",
  "/owner/schedule",
  "/owner/services",
  "/owner/spaces-rules",
  "/owner/staff",
]);

function profile(overrides: Partial<WorkspaceStaffProfile>): WorkspaceStaffProfile {
  return {
    id: "staff-1",
    full_name: "Test User",
    system_role: "staff",
    staff_type: "therapist",
    branch_id: "branch-1",
    branches: { name: "Main Branch" },
    ...overrides,
  };
}

function workspaceKeys(profileOverrides: Partial<WorkspaceStaffProfile>): WorkspaceKey[] {
  return buildWorkspaceAccessFromStaffProfile(profile(profileOverrides)).map((workspace) => workspace.key);
}

describe("workspace defaults", () => {
  it("routes owners to the restored Owner workspace while preserving other defaults", () => {
    expect(getDefaultDashboardPath("owner")).toBe("/owner");
    expect(getDefaultDashboardPath("manager")).toBe("/crm");
    expect(getDefaultDashboardPath("assistant_manager")).toBe("/crm");
    expect(getDefaultDashboardPath("crm")).toBe("/crm");
    expect(getDefaultDashboardPath("staff")).toBe("/staff-portal");
    expect(getDefaultDashboardPath("driver")).toBe("/driver");
    expect(getDefaultDashboardPath("utility")).toBe("/utility");
  });

  it("prefers Owner as the primary owner workspace but still shows the switcher", () => {
    const workspaces = buildWorkspaceAccessFromStaffProfile(profile({ system_role: "owner" }));

    expect(getPrimaryWorkspaceHref(workspaces)).toBe("/owner");
    expect(getWorkspaceSwitchDestination(workspaces)).toBe("/select-workspace");
  });
});

describe("buildWorkspaceAccessFromStaffProfile", () => {
  it("grants owners Owner and CRM access without granting Manager access", () => {
    expect(workspaceKeys({ system_role: "owner" })).toEqual(["owner", "crm", "staff_portal"]);
  });

  it("keeps CRM, staff, driver, and utility workspace grants scoped to their roles", () => {
    expect(workspaceKeys({ system_role: "crm" })).toEqual(["crm", "staff_portal"]);
    expect(workspaceKeys({ system_role: "staff" })).toEqual(["staff_portal"]);
    expect(workspaceKeys({ system_role: "driver", staff_type: "driver" })).toEqual(["driver"]);
    expect(workspaceKeys({ system_role: "utility", staff_type: "utility" })).toEqual(["utility"]);
  });
});

describe("canAccessWorkspacePath", () => {
  it("allows owners into Owner routes, CRM oversight, and the owner-only dev prefix", () => {
    const ownerWorkspaces = buildWorkspaceAccessFromStaffProfile(profile({ system_role: "owner" }));

    expect(canAccessWorkspacePath("/owner", "owner", ownerWorkspaces)).toBe(true);
    expect(canAccessWorkspacePath("/owner/reports", "owner", ownerWorkspaces)).toBe(true);
    expect(canAccessWorkspacePath("/crm/today", "owner", ownerWorkspaces)).toBe(true);
    expect(canAccessWorkspacePath("/dev", "owner", ownerWorkspaces)).toBe(true);
  });

  it("rejects Owner and dev routes for CRM, staff, and driver roles", () => {
    const crmWorkspaces = buildWorkspaceAccessFromStaffProfile(profile({ system_role: "crm" }));
    const staffWorkspaces = buildWorkspaceAccessFromStaffProfile(profile({ system_role: "staff" }));
    const driverWorkspaces = buildWorkspaceAccessFromStaffProfile(
      profile({ system_role: "driver", staff_type: "driver" })
    );

    expect(canAccessWorkspacePath("/owner", "crm", crmWorkspaces)).toBe(false);
    expect(canAccessWorkspacePath("/dev", "crm", crmWorkspaces)).toBe(false);
    expect(canAccessWorkspacePath("/owner/bookings", "staff", staffWorkspaces)).toBe(false);
    expect(canAccessWorkspacePath("/owner/schedule", "driver", driverWorkspaces)).toBe(false);
  });
});

describe("Owner navigation and prefetch config", () => {
  it("exposes Owner nav for owners without linking to dev-only or nonexistent routes", () => {
    const ownerNav = NAV_CONFIG.owner!;
    const hrefs = ownerNav.items?.map((item) => item.href) ?? [];

    expect(ownerNav.mvpHidden).toBeUndefined();
    expect(resolveWorkspaceKeyFromRole("owner")).toBe("owner");
    expect(resolveWorkspaceKeyFromRole("manager")).toBe("crm");
    expect(hrefs).not.toContain("/dev");
    expect(hrefs).not.toContain("/owner/settings");
    expect(hrefs.every((href) => OWNER_ROUTE_PREFIXES.has(href))).toBe(true);
  });

  it("prefetches only restored Owner routes", () => {
    const routes = [...OWNER_PREFETCH.immediate, ...OWNER_PREFETCH.idle, ...OWNER_PREFETCH.hover];

    expect(routes).not.toContain("/dev");
    expect(routes).not.toContain("/owner/settings");
    expect(routes.every((href) => OWNER_ROUTE_PREFIXES.has(href))).toBe(true);
  });
});
