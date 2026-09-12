import { describe, expect, it } from "vitest";
import {
  CRM_GENERAL_NAV_ITEMS,
  DRIVER_NAV_ITEMS,
  getNavigationItemsForProfile,
  PROVIDER_NAV_ITEMS,
  resolveNavigationProfile,
  resolveStaffOperationalRole,
  UTILITY_NAV_ITEMS,
} from "@/components/features/staff-pwa/role-navigation";
import { GET as getStaffManifest } from "@/app/manifest-staff.webmanifest/route";

describe("PWA-C5: Staff Foundation Navigation & Role Mapping", () => {
  it("resolves all 7 staff roles to the correct operational role", () => {
    // 1. Therapist
    expect(
      resolveStaffOperationalRole({ system_role: "staff", staff_type: "therapist" })
    ).toBe("therapist");

    // 2. Nail Tech
    expect(
      resolveStaffOperationalRole({ system_role: "staff", staff_type: "nail_tech" })
    ).toBe("nail_tech");

    // 3. Aesthetician / Facialist
    expect(
      resolveStaffOperationalRole({ system_role: "staff", staff_type: "aesthetician" })
    ).toBe("aesthetician");
    expect(
      resolveStaffOperationalRole({ system_role: "staff", staff_type: "facialist" })
    ).toBe("aesthetician");

    // 4. Salon Head
    expect(
      resolveStaffOperationalRole({ system_role: "staff", staff_type: "salon_head" })
    ).toBe("salon_head");

    // 5. CRM / General Staff
    expect(
      resolveStaffOperationalRole({ system_role: "front_desk", staff_type: null })
    ).toBe("crm_general");
    expect(
      resolveStaffOperationalRole({ system_role: "crm", staff_type: null })
    ).toBe("crm_general");

    // 6. Utility
    expect(
      resolveStaffOperationalRole({ system_role: "utility", staff_type: "utility" })
    ).toBe("utility");
    expect(
      resolveStaffOperationalRole({ system_role: "staff", staff_type: "utility" })
    ).toBe("utility");

    // 7. Driver
    expect(
      resolveStaffOperationalRole({ system_role: "driver", staff_type: null })
    ).toBe("driver");
    expect(
      resolveStaffOperationalRole({ system_role: "staff", staff_type: "driver" })
    ).toBe("driver");
  });

  it("maps operational roles to the 4 canonical navigation profiles", () => {
    expect(resolveNavigationProfile("therapist")).toBe("provider");
    expect(resolveNavigationProfile("nail_tech")).toBe("provider");
    expect(resolveNavigationProfile("aesthetician")).toBe("provider");
    expect(resolveNavigationProfile("salon_head")).toBe("provider");

    expect(resolveNavigationProfile("crm_general")).toBe("crm_general");
    expect(resolveNavigationProfile("utility")).toBe("utility");
    expect(resolveNavigationProfile("driver")).toBe("driver");
  });

  it("ensures each profile has exactly 5 destinations with Scan in the center (position 3 / index 2)", () => {
    const profiles = ["provider", "crm_general", "utility", "driver"] as const;

    for (const profile of profiles) {
      const items = getNavigationItemsForProfile(profile);
      expect(items).toHaveLength(5);

      // Central prominent Scan button
      const centerItem = items[2];
      expect(centerItem).toBeDefined();
      expect(centerItem?.key).toBe("scan");
      expect(centerItem?.label).toBe("Scan");
      expect(centerItem?.href).toBe("/staff/scan");
      expect(centerItem?.isScan).toBe(true);
    }
  });

  it("verifies Provider profile destinations", () => {
    const labels = PROVIDER_NAV_ITEMS.map((item) => item.label);
    expect(labels).toEqual(["Today", "Schedule", "Scan", "Progress", "More"]);
    expect(PROVIDER_NAV_ITEMS[0]?.href).toBe("/staff");
    expect(PROVIDER_NAV_ITEMS[1]?.href).toBe("/staff/schedule");
    expect(PROVIDER_NAV_ITEMS[3]?.href).toBe("/staff/progress");
    expect(PROVIDER_NAV_ITEMS[4]?.href).toBe("/staff/more");
  });

  it("verifies CRM / General profile destinations", () => {
    const labels = CRM_GENERAL_NAV_ITEMS.map((item) => item.label);
    expect(labels).toEqual(["Today", "Work", "Scan", "Notices", "More"]);
    expect(CRM_GENERAL_NAV_ITEMS[0]?.href).toBe("/staff");
    expect(CRM_GENERAL_NAV_ITEMS[1]?.href).toBe("/staff/work");
    expect(CRM_GENERAL_NAV_ITEMS[3]?.href).toBe("/staff/notices");
    expect(CRM_GENERAL_NAV_ITEMS[4]?.href).toBe("/staff/more");
  });

  it("verifies Utility profile keeps Work selectable pointing to read-only unavailable state", () => {
    const labels = UTILITY_NAV_ITEMS.map((item) => item.label);
    expect(labels).toEqual(["Today", "Work", "Scan", "Notices", "More"]);
    expect(UTILITY_NAV_ITEMS[0]?.href).toBe("/staff/utility");

    const workItem = UTILITY_NAV_ITEMS[1];
    expect(workItem?.key).toBe("work");
    expect(workItem?.disabled).toBe(false);
    expect(workItem?.href).toBe("/staff/utility/work");
    expect(UTILITY_NAV_ITEMS[3]?.href).toBe("/staff/utility/notices");
    expect(UTILITY_NAV_ITEMS[4]?.href).toBe("/staff/utility/more");
  });

  it("verifies Driver profile destinations", () => {
    const labels = DRIVER_NAV_ITEMS.map((item) => item.label);
    expect(labels).toEqual(["Today", "Trips", "Scan", "Map", "More"]);
    expect(DRIVER_NAV_ITEMS[0]?.href).toBe("/staff/driver");
    expect(DRIVER_NAV_ITEMS[1]?.href).toBe("/staff/driver/trips");
    expect(DRIVER_NAV_ITEMS[3]?.href).toBe("/staff/driver/map");
    expect(DRIVER_NAV_ITEMS[4]?.href).toBe("/staff/driver/more");
  });
});

describe("PWA-C5: Staff Web App Manifest Contract", () => {
  it("serves valid Staff Web App Manifest with safe identity and scope separation", async () => {
    const response = getStaffManifest();
    expect(response.headers.get("Content-Type")).toContain("application/manifest+json");

    const text = await response.text();
    const manifest = JSON.parse(text);

    // Identity and name checks
    expect(manifest.id).toBe("/cradlehub-staff");
    expect(manifest.name).toBe("CradleHub Staff");
    expect(manifest.short_name).toBe("Staff");
    expect(manifest.start_url).toBe("/staff/");
    expect(manifest.scope).toBe("/staff/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.background_color).toBe("#F7F3EB");
    expect(manifest.theme_color).toBe("#163A2B");

    // Icons check: must reference dedicated staff icons, preserving shared icons
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    expect(manifest.icons.some((icon: { src: string; sizes: string }) => icon.src === "/staff-manifest-icon-192.png" && icon.sizes === "192x192")).toBe(true);
    expect(manifest.icons.some((icon: { src: string; sizes: string }) => icon.src === "/staff-manifest-icon-512.png" && icon.sizes === "512x512")).toBe(true);
    expect(manifest.description).toContain("Team Workspace");
  });
});

describe("PWA-C5: Role-Resolution Splash Contract", () => {
  it("verifies required primary wording in role-resolution splash source", async () => {
    const splashSource = await import("fs").then((fs) =>
      fs.readFileSync("src/components/features/staff-pwa/role-resolution-splash.tsx", "utf8")
    );
    expect(splashSource).toContain("CradleHub Staff");
    expect(splashSource).toContain("Team Workspace");
    expect(splashSource).toContain("Opening your workspace…");
  });
});

describe("PWA-C5: Service Worker Preservation Contract", () => {
  it("verifies existing service workers are preserved untouched", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("public/cradlehub-push-sw.js")).toBe(true);
    expect(fs.existsSync("public/sw.js")).toBe(true);

    const pushSw = fs.readFileSync("public/cradlehub-push-sw.js", "utf8");
    expect(pushSw).toContain("ALLOWED_ACTION_PREFIXES");
    expect(pushSw).toContain("/crm");
    expect(pushSw).toContain("/staff-portal");

    const cleanupSw = fs.readFileSync("public/sw.js", "utf8");
    expect(cleanupSw).toContain("CRADLEHUB_SERVICE_WORKER_UNREGISTERED");
  });
});

describe("PWA-C5: Design Tokens & Connectivity Contracts", () => {
  it("enforces C4 color and touch target tokens", async () => {
    const { STAFF_PWA_TOKENS } = await import("@/components/features/staff-pwa/tokens");
    expect(STAFF_PWA_TOKENS.colors.forest).toBe("#163A2B");
    expect(STAFF_PWA_TOKENS.colors.gold).toBe("#C8A96B");
    expect(STAFF_PWA_TOKENS.colors.pageBg).toBe("#F7F3EB");
    expect(STAFF_PWA_TOKENS.touch.minTarget).toBe("48px");
    expect(STAFF_PWA_TOKENS.touch.scanTarget).toBe("56px");
  });

  it("prohibits false offline mutation promises in connectivity contracts", async () => {
    const bannerSource = await import("fs").then((fs) =>
      fs.readFileSync("src/components/features/staff-pwa/connectivity-banner.tsx", "utf8")
    );
    expect(bannerSource).not.toContain("Will sync later");
    expect(bannerSource).not.toContain("Saved offline");
    expect(bannerSource).not.toContain("Queued for sync");
    expect(bannerSource).toContain("actions that write data are disabled");
  });
});

describe("PWA-C5: Security Boundaries & Authorization Contracts", () => {
  it("verifies PROTECTED_PREFIXES includes /staff and /scan", async () => {
    const fs = await import("fs");
    const proxySource = fs.readFileSync("src/proxy.ts", "utf8");
    expect(proxySource).toContain('"/staff"');
    expect(proxySource).toContain('"/scan"');
  });

  it("verifies canAccessWorkspacePath authorizes canonical /staff routes for appropriate roles and rejects Manager/Owner/Marketing", async () => {
    const { canAccessWorkspacePath, buildWorkspaceAccessFromStaffProfile } = await import("@/lib/auth/workspace-access");

    // 1. Provider / therapist (staff + therapist)
    const therapistWs = buildWorkspaceAccessFromStaffProfile({ id: "1", system_role: "staff", staff_type: "therapist" });
    expect(canAccessWorkspacePath("/staff", "staff", therapistWs, "therapist")).toBe(true);
    expect(canAccessWorkspacePath("/staff/scan", "staff", therapistWs, "therapist")).toBe(true);
    expect(canAccessWorkspacePath("/scan", "staff", therapistWs, "therapist")).toBe(true);
    expect(canAccessWorkspacePath("/staff/schedule", "staff", therapistWs, "therapist")).toBe(true);
    expect(canAccessWorkspacePath("/staff/progress", "staff", therapistWs, "therapist")).toBe(true);
    expect(canAccessWorkspacePath("/staff/driver", "staff", therapistWs, "therapist")).toBe(false);
    expect(canAccessWorkspacePath("/staff/utility", "staff", therapistWs, "therapist")).toBe(false);
    expect(canAccessWorkspacePath("/staff/work", "staff", therapistWs, "therapist")).toBe(false);

    // 2. Driver
    const driverWs = buildWorkspaceAccessFromStaffProfile({ id: "2", system_role: "driver", staff_type: null });
    expect(canAccessWorkspacePath("/staff", "driver", driverWs, null)).toBe(true);
    expect(canAccessWorkspacePath("/staff/driver", "driver", driverWs, null)).toBe(true);
    expect(canAccessWorkspacePath("/driver", "driver", driverWs, null)).toBe(true);
    expect(canAccessWorkspacePath("/staff/scan", "driver", driverWs, null)).toBe(true);
    expect(canAccessWorkspacePath("/scan", "driver", driverWs, null)).toBe(true);
    expect(canAccessWorkspacePath("/staff/utility", "driver", driverWs, null)).toBe(false);
    expect(canAccessWorkspacePath("/staff-portal", "driver", driverWs, null)).toBe(false);

    // 3. Utility
    const utilityWs = buildWorkspaceAccessFromStaffProfile({ id: "3", system_role: "utility", staff_type: "utility" });
    expect(canAccessWorkspacePath("/staff", "utility", utilityWs, "utility")).toBe(true);
    expect(canAccessWorkspacePath("/staff/utility", "utility", utilityWs, "utility")).toBe(true);
    expect(canAccessWorkspacePath("/utility", "utility", utilityWs, "utility")).toBe(true);
    expect(canAccessWorkspacePath("/staff/scan", "utility", utilityWs, "utility")).toBe(true);
    expect(canAccessWorkspacePath("/scan", "utility", utilityWs, "utility")).toBe(true);
    expect(canAccessWorkspacePath("/staff/driver", "utility", utilityWs, "utility")).toBe(false);
    expect(canAccessWorkspacePath("/staff-portal", "utility", utilityWs, "utility")).toBe(false);

    // 4. Front Desk / CRM
    const crmWs = buildWorkspaceAccessFromStaffProfile({ id: "4", system_role: "front_desk", staff_type: null });
    expect(canAccessWorkspacePath("/staff", "front_desk", crmWs, null)).toBe(true);
    expect(canAccessWorkspacePath("/staff/scan", "front_desk", crmWs, null)).toBe(true);
    expect(canAccessWorkspacePath("/scan", "front_desk", crmWs, null)).toBe(true);
    expect(canAccessWorkspacePath("/staff/work", "front_desk", crmWs, null)).toBe(true);
    expect(canAccessWorkspacePath("/staff/driver", "front_desk", crmWs, null)).toBe(false);

    // 5. REJECTION: Owner must NOT access Staff-PWA operational boundary
    const ownerWs = buildWorkspaceAccessFromStaffProfile({ id: "5", system_role: "owner", staff_type: null });
    expect(canAccessWorkspacePath("/staff", "owner", ownerWs, null)).toBe(false);
    expect(canAccessWorkspacePath("/staff/scan", "owner", ownerWs, null)).toBe(false);
    expect(canAccessWorkspacePath("/scan", "owner", ownerWs, null)).toBe(false);
    expect(canAccessWorkspacePath("/staff/driver", "owner", ownerWs, null)).toBe(false);
    expect(canAccessWorkspacePath("/staff/utility", "owner", ownerWs, null)).toBe(false);
    expect(canAccessWorkspacePath("/owner", "owner", ownerWs, null)).toBe(true);

    // 6. REJECTION: Manager must NOT access Staff-PWA operational boundary
    const managerWs = buildWorkspaceAccessFromStaffProfile({ id: "6", system_role: "manager", staff_type: null });
    expect(canAccessWorkspacePath("/staff", "manager", managerWs, null)).toBe(false);
    expect(canAccessWorkspacePath("/staff/scan", "manager", managerWs, null)).toBe(false);
    expect(canAccessWorkspacePath("/scan", "manager", managerWs, null)).toBe(false);
    expect(canAccessWorkspacePath("/manager", "manager", managerWs, null)).toBe(true);

    // 7. REJECTION: Digital Marketer must NOT access Staff-PWA operational boundary
    const marketerWs = buildWorkspaceAccessFromStaffProfile({ id: "7", system_role: "digital_marketer", staff_type: null });
    expect(canAccessWorkspacePath("/staff", "digital_marketer", marketerWs, null)).toBe(false);
    expect(canAccessWorkspacePath("/staff/scan", "digital_marketer", marketerWs, null)).toBe(false);
    expect(canAccessWorkspacePath("/scan", "digital_marketer", marketerWs, null)).toBe(false);
    expect(canAccessWorkspacePath("/marketing", "digital_marketer", marketerWs, null)).toBe(true);
  });

  it("verifies proxy passes staff_type to canAccessWorkspacePath", async () => {
    const fs = await import("fs");
    const proxySource = fs.readFileSync("src/proxy.ts", "utf8");
    expect(proxySource).toContain("canAccessWorkspacePath(pathname, systemRole, workspaces, staffRecord.staff_type)");
  });

  it("verifies StaffAppShell does not fall back to therapist silently", async () => {
    const fs = await import("fs");
    const shellSource = fs.readFileSync("src/components/features/staff-pwa/app-shell.tsx", "utf8");
    // Ensure "therapist" is not used as a fallback string when role is unresolved
    expect(shellSource).not.toMatch(/operationalRole\s*=\s*.*\|\|\s*["']therapist["']/);
    expect(shellSource).toContain("StaffRoleResolutionSplash");
  });

  it("proves strict server-UI operational group alignment across all role/type combinations", async () => {
    const { resolveStaffPwaOperationalGroup } = await import("@/lib/auth/workspace-access");

    const testCases: Array<{ role: string; staff_type: string | null }> = [
      // Providers
      { role: "staff", staff_type: "therapist" },
      { role: "staff", staff_type: "nail_tech" },
      { role: "staff", staff_type: "aesthetician" },
      { role: "staff", staff_type: "facialist" },
      { role: "staff", staff_type: "salon_head" },
      { role: "service_head", staff_type: null },
      { role: "service_staff", staff_type: null },
      // Drivers
      { role: "driver", staff_type: null },
      { role: "staff", staff_type: "driver" },
      // Utility
      { role: "utility", staff_type: null },
      { role: "utility", staff_type: "utility" },
      { role: "staff", staff_type: "utility" },
      // CRM / General
      { role: "crm", staff_type: null },
      { role: "front_desk", staff_type: null },
      { role: "csr", staff_type: null },
      { role: "staff", staff_type: null },
      { role: "staff", staff_type: "csr" },
      // Excluded / Non-Staff-PWA roles
      { role: "owner", staff_type: null },
      { role: "manager", staff_type: null },
      { role: "assistant_manager", staff_type: null },
      { role: "store_manager", staff_type: null },
      { role: "digital_marketer", staff_type: null },
      { role: "staff", staff_type: "managerial" },
    ];

    for (const { role, staff_type } of testCases) {
      const serverGroup = resolveStaffPwaOperationalGroup(role, staff_type);
      const uiRole = resolveStaffOperationalRole({ system_role: role, staff_type });
      const uiProfile = resolveNavigationProfile(uiRole);

      expect(uiProfile).toBe(serverGroup);
    }
  });
});

describe("PWA-C5: Canonical Staff Runtime Scope Containment", () => {
  it("verifies Driver canonical bottom nav never emits /driver, /staff-portal, or legacy /scan", async () => {
    const { getDriverBottomNavItems } = await import(
      "@/components/features/staff-portal/driver/driver-mobile-bottom-nav"
    );
    const canonicalItems = getDriverBottomNavItems("canonical");

    expect(canonicalItems.length).toBe(5);
    for (const item of canonicalItems) {
      expect(item.href).toMatch(/^\/staff\//);
      expect(item.href).not.toMatch(/^\/driver(\/|$)/);
      expect(item.href).not.toContain("/staff-portal");
      expect(item.href).not.toBe("/scan");
    }

    expect(canonicalItems.find((i) => i.key === "today")?.href).toBe("/staff/driver");
    expect(canonicalItems.find((i) => i.key === "trips")?.href).toBe("/staff/driver/trips");
    expect(canonicalItems.find((i) => i.key === "scan")?.href).toBe("/staff/scan");
    expect(canonicalItems.find((i) => i.key === "map")?.href).toBe("/staff/driver/map");
    expect(canonicalItems.find((i) => i.key === "more")?.href).toBe("/staff/driver/more");
  });

  it("verifies canonical Driver More does not emit legacy Staff Portal destinations", async () => {
    const { getDriverMoreSections } = await import(
      "@/components/features/staff-portal/driver/driver-more-menu"
    );
    const canonicalSections = getDriverMoreSections(true);

    for (const section of canonicalSections) {
      for (const item of section.items) {
        if (item.kind === "link") {
          expect(item.href).toMatch(/^\/staff\//);
          expect(item.href).not.toContain("/staff-portal");
        }
      }
    }
  });

  it("verifies canonical Provider More remains within approved /staff/ routes or honest seams", async () => {
    const { getTherapistMoreSections } = await import(
      "@/components/features/staff-portal/therapist/therapist-more-menu"
    );
    const canonicalSections = getTherapistMoreSections(true);

    for (const section of canonicalSections) {
      for (const item of section.items) {
        if (item.kind === "link") {
          expect(item.href).toMatch(/^\/staff\//);
          expect(item.href).not.toContain("/staff-portal");
        }
      }
    }
  });

  it("verifies canonical CRM/general More remains within approved /staff/ routes or honest seams", async () => {
    const { getBasicStaffMoreSections } = await import(
      "@/components/features/staff-portal/basic/basic-staff-more-menu"
    );
    const canonicalSections = getBasicStaffMoreSections(true);

    for (const section of canonicalSections) {
      for (const item of section.items) {
        if (item.kind === "link") {
          expect(item.href).toMatch(/^\/staff\//);
          expect(item.href).not.toContain("/staff-portal");
        }
      }
    }
  });

  it("verifies Utility Today contains no speculative task-module promises and never links to /staff-portal", async () => {
    const fs = await import("fs");
    const utilityTodaySource = fs.readFileSync("src/app/(dashboard)/staff/utility/page.tsx", "utf8");

    // Must not contain speculative modules
    expect(utilityTodaySource).not.toContain("Room Preparation Checklist");
    expect(utilityTodaySource).not.toContain("Cleaning Schedule");
    expect(utilityTodaySource).not.toContain("Supply Restock Reminders");
    expect(utilityTodaySource).not.toContain("Maintenance Tasks");
    expect(utilityTodaySource).not.toContain("Coming Soon");

    // Must not contain legacy staff-portal redirect or links
    expect(utilityTodaySource).not.toContain("/staff-portal");

    // Must have truthful foundation destinations
    expect(utilityTodaySource).toContain("/staff/utility/work");
    expect(utilityTodaySource).toContain("/staff/scan");
    expect(utilityTodaySource).toContain("/staff/utility/notices");
    expect(utilityTodaySource).toContain("/staff/utility/more");
  });
});

describe("PWA-C5: Canonical Utility Authorization Contract", () => {
  it("verifies canAccessCanonicalUtility enforces trusted operational-group resolution", async () => {
    const { canAccessCanonicalUtility } = await import("@/app/(dashboard)/staff/utility/page");

    // 1. role=utility → allowed
    expect(canAccessCanonicalUtility("utility", null)).toBe(true);
    expect(canAccessCanonicalUtility("utility", "utility")).toBe(true);

    // 2. role=staff + staff_type=utility → allowed
    expect(canAccessCanonicalUtility("staff", "utility")).toBe(true);

    // 3. role=owner → denied
    expect(canAccessCanonicalUtility("owner", null)).toBe(false);
    expect(canAccessCanonicalUtility("owner", "utility")).toBe(false);

    // 4. role=manager → denied
    expect(canAccessCanonicalUtility("manager", null)).toBe(false);
    expect(canAccessCanonicalUtility("manager", "utility")).toBe(false);

    // 5. role=crm → denied
    expect(canAccessCanonicalUtility("crm", null)).toBe(false);

    // 6. provider → denied
    expect(canAccessCanonicalUtility("staff", "therapist")).toBe(false);
    expect(canAccessCanonicalUtility("staff", "nail_tech")).toBe(false);
    expect(canAccessCanonicalUtility("staff", "aesthetician")).toBe(false);
    expect(canAccessCanonicalUtility("staff", "facialist")).toBe(false);
    expect(canAccessCanonicalUtility("service_head", null)).toBe(false);
    expect(canAccessCanonicalUtility("service_staff", null)).toBe(false);

    // 7. driver → denied
    expect(canAccessCanonicalUtility("driver", null)).toBe(false);
    expect(canAccessCanonicalUtility("staff", "driver")).toBe(false);
  });
});

describe("PWA-C5: Runtime Role-Resolution Split Prevention", () => {
  it("verifies getStaffPortalMode aligns with canonical operational resolver for service_head, service_staff, and facialist", async () => {
    const { getStaffPortalMode } = await import("@/lib/staff/get-staff-portal-mode");
    const { resolveStaffPwaOperationalGroup } = await import("@/lib/auth/workspace-access");
    const { resolveStaffOperationalRole, resolveNavigationProfile } = await import(
      "@/components/features/staff-pwa/role-navigation"
    );

    const providerCases = [
      { system_role: "service_head", staff_type: null },
      { system_role: "service_staff", staff_type: null },
      { system_role: "staff", staff_type: "facialist" },
      { system_role: "staff", staff_type: "therapist" },
      { system_role: "staff", staff_type: "nail_tech" },
      { system_role: "staff", staff_type: "aesthetician" },
      { system_role: "staff", staff_type: "salon_head" },
    ];

    for (const testCase of providerCases) {
      const serverGroup = resolveStaffPwaOperationalGroup(testCase.system_role, testCase.staff_type);
      const uiRole = resolveStaffOperationalRole(testCase);
      const uiProfile = resolveNavigationProfile(uiRole);
      const portalMode = getStaffPortalMode(testCase);

      // Invariant: Server authorized as Provider MUST render as Provider ("therapist" mode in legacy component hierarchy)
      expect(serverGroup).toBe("provider");
      expect(uiProfile).toBe("provider");
      expect(portalMode).toBe("therapist");
    }
  });

  it("verifies canonical Today, Schedule, and More choose Provider runtime profile for service_head and service_staff", async () => {
    const { getStaffPortalMode, isBasicStaffMode } = await import("@/lib/staff/get-staff-portal-mode");
    const { resolveStaffOperationalRole, resolveNavigationProfile } = await import(
      "@/components/features/staff-pwa/role-navigation"
    );

    const roles: Array<{ system_role: string; staff_type: string | null }> = [
      { system_role: "service_head", staff_type: null },
      { system_role: "service_staff", staff_type: null },
    ];

    for (const role of roles) {
      // 1. Operational profile used in canonical wrappers (More, etc.)
      const opRole = resolveStaffOperationalRole(role);
      const profile = resolveNavigationProfile(opRole);
      expect(profile).toBe("provider");

      // 2. Portal mode used by Today & Schedule
      const mode = getStaffPortalMode(role);
      expect(mode).toBe("therapist");
      expect(isBasicStaffMode(mode)).toBe(false);
    }
  });

  it("verifies Manager, Owner, and Marketer roles are completely excluded from Staff PWA operational roles", async () => {
    const { resolveStaffPwaOperationalGroup } = await import("@/lib/auth/workspace-access");
    const { resolveStaffOperationalRole, resolveNavigationProfile } = await import(
      "@/components/features/staff-pwa/role-navigation"
    );

    const nonStaffRoles = [
      { system_role: "owner", staff_type: null },
      { system_role: "manager", staff_type: null },
      { system_role: "assistant_manager", staff_type: null },
      { system_role: "store_manager", staff_type: null },
      { system_role: "digital_marketer", staff_type: null },
      { system_role: "staff", staff_type: "managerial" },
    ];

    for (const testCase of nonStaffRoles) {
      const serverGroup = resolveStaffPwaOperationalGroup(testCase.system_role, testCase.staff_type);
      const uiRole = resolveStaffOperationalRole(testCase);
      const uiProfile = resolveNavigationProfile(uiRole);

      expect(serverGroup).toBeNull();
      expect(uiRole).toBeNull();
      expect(uiProfile).toBeNull();
    }
  });
});

