import { describe, expect, it } from "vitest";
import { NAV_CONFIG, visibleNavItems } from "@/components/features/dashboard/nav-config";
import {
  BOUTIQUE_OPERATIONAL_CAPABILITIES,
  canApproveBoutiqueCatalogChanges,
  canManageBoutique,
  canViewMasterSheetReview,
} from "@/lib/auth/crm-permissions";
import {
  buildWorkspaceAccessFromStaffProfile,
  canAccessWorkspacePath,
} from "@/lib/auth/workspace-access";
import { canViewNav } from "@/lib/permissions";

describe("CRM Boutique Management RBAC & navigation contract", () => {
  const authorizedRoles = [
    "owner",
    "manager",
    "assistant_manager",
    "store_manager",
    "crm",
    "csr",
    "csr_head",
    "csr_staff",
  ];

  const deniedRoles = [
    "digital_marketer",
    "staff",
    "service_head",
    "service_staff",
    "driver",
    "utility",
    "",
    "guest",
  ];

  it("grants Boutique Management access to all CRM Front Desk & Management roles", () => {
    for (const role of authorizedRoles) {
      expect(canManageBoutique(role)).toBe(true);
      expect(canViewNav(role, "boutique")).toBe(true);
    }
  });

  it("denies Boutique Management access to non-CRM operational, marketer, and treatment roles", () => {
    for (const role of deniedRoles) {
      expect(canManageBoutique(role)).toBe(false);
      expect(canViewNav(role, "boutique")).toBe(false);
    }
  });

  it("restricts catalog change & operational cutover approval strictly to owner", () => {
    expect(canApproveBoutiqueCatalogChanges("owner")).toBe(true);
    for (const role of authorizedRoles.filter((r) => r !== "owner")) {
      expect(canApproveBoutiqueCatalogChanges(role)).toBe(false);
    }
    for (const role of deniedRoles) {
      expect(canApproveBoutiqueCatalogChanges(role)).toBe(false);
    }
  });

  it("exposes Boutique Management in CRM sidebar nav only when authorized", () => {
    const crmItems = NAV_CONFIG.crm?.items ?? [];
    const boutiqueNav = crmItems.find((item) => item.href === "/crm/boutique");
    expect(boutiqueNav).toEqual({
      label: "Boutique Management",
      href: "/crm/boutique",
      icon: "ShoppingBag",
      boutiqueAccessOnly: true,
    });

    const visibleForCrm = visibleNavItems(
      crmItems,
      canViewMasterSheetReview("crm"),
      canManageBoutique("crm")
    );
    expect(visibleForCrm.some((item) => item.href === "/crm/boutique")).toBe(true);

    const hiddenForStaff = visibleNavItems(
      crmItems,
      canViewMasterSheetReview("crm"),
      canManageBoutique("staff")
    );
    expect(hiddenForStaff.some((item) => item.href === "/crm/boutique")).toBe(false);
  });

  it("enforces workspace path routing rules on /crm/boutique", () => {
    const canAccess = (profile: {
      system_role: string;
      staff_type: string | null;
    }) => {
      const access = buildWorkspaceAccessFromStaffProfile({
        id: "staff-test-1",
        system_role: profile.system_role,
        staff_type: profile.staff_type,
      });
      return canAccessWorkspacePath(
        "/crm/boutique",
        profile.system_role,
        access,
        profile.staff_type
      );
    };

    expect(canAccess({ system_role: "crm", staff_type: null })).toBe(true);
    expect(canAccess({ system_role: "csr_staff", staff_type: null })).toBe(true);
    expect(canAccess({ system_role: "manager", staff_type: null })).toBe(true);
    expect(canAccess({ system_role: "owner", staff_type: null })).toBe(true);
    expect(
      canAccess({ system_role: "digital_marketer", staff_type: null })
    ).toBe(false);
    expect(
      canAccess({ system_role: "staff", staff_type: "therapist" })
    ).toBe(false);
  });

  it("keeps all unapproved operational switches explicitly disabled", () => {
    expect(BOUTIQUE_OPERATIONAL_CAPABILITIES).toEqual({
      paymentsEnabled: false,
      stockMutationsEnabled: false,
      orderProcessingEnabled: false,
      giftIssuanceEnabled: false,
    });
  });
});
