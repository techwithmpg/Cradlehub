import { describe, expect, it } from "vitest";
import {
  NAV_CONFIG,
  resolveWorkspaceKeyFromRole,
  visibleNavItems,
} from "@/components/features/dashboard/nav-config";
import { canViewMasterSheetReview } from "@/lib/auth/crm-permissions";

describe("workspace navigation contract", () => {
  it("shows exactly one Staff Attendance destination", () => {
    const attendanceItems = NAV_CONFIG.staff?.items?.filter(
      (item) => item.href === "/staff-portal/attendance"
    );

    expect(attendanceItems).toEqual([
      {
        label: "My Attendance",
        href: "/staff-portal/attendance",
        icon: "ClipboardCheck",
      },
    ]);
  });

  it("keeps the Manager workspace paused and management roles routed to CRM", () => {
    expect(NAV_CONFIG.manager?.mvpHidden).toBe(true);
    expect(resolveWorkspaceKeyFromRole("manager")).toBe("crm");
    expect(resolveWorkspaceKeyFromRole("assistant_manager")).toBe("crm");
    expect(resolveWorkspaceKeyFromRole("store_manager")).toBe("crm");
  });

  it("routes digital marketers to the dedicated Marketing workspace", () => {
    expect(resolveWorkspaceKeyFromRole("digital_marketer")).toBe("marketing");
    expect(NAV_CONFIG.marketing?.items?.[0]).toEqual({
      label: "Drafts",
      href: "/marketing",
      icon: "Sparkles",
    });
  });

  it("shows Master Sheet Review to approved CRM roles and hides it from unauthorized roles", () => {
    const crmItems = NAV_CONFIG.crm?.items ?? [];
    for (const role of ["owner", "manager", "assistant_manager", "store_manager", "crm", "csr"]) {
      expect(
        visibleNavItems(crmItems, canViewMasterSheetReview(role)).some(
          (item) => item.href === "/crm/master-sheet"
        )
      ).toBe(true);
    }
    for (const role of ["staff", "driver", "utility", "digital_marketer"]) {
      expect(
        visibleNavItems(crmItems, canViewMasterSheetReview(role)).some(
          (item) => item.href === "/crm/master-sheet"
        )
      ).toBe(false);
    }
    expect(
      visibleNavItems(crmItems, true).filter((item) => item.href === "/crm/master-sheet")
    ).toEqual([
      {
        label: "Master Sheet Review",
        href: "/crm/master-sheet",
        icon: "BookOpen",
        masterSheetAccessOnly: true,
      },
    ]);
  });
});
