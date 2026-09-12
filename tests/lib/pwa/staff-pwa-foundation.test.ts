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
      expect(centerItem?.href).toBe("/scan");
      expect(centerItem?.isScan).toBe(true);
    }
  });

  it("verifies Provider profile destinations", () => {
    const labels = PROVIDER_NAV_ITEMS.map((item) => item.label);
    expect(labels).toEqual(["Today", "Schedule", "Scan", "Progress", "More"]);
    expect(PROVIDER_NAV_ITEMS[0]?.href).toBe("/staff-portal");
    expect(PROVIDER_NAV_ITEMS[1]?.href).toBe("/staff-portal/schedule");
    expect(PROVIDER_NAV_ITEMS[3]?.href).toBe("/staff-portal/service-progress");
    expect(PROVIDER_NAV_ITEMS[4]?.href).toBe("/staff-portal/more");
  });

  it("verifies CRM / General profile destinations", () => {
    const labels = CRM_GENERAL_NAV_ITEMS.map((item) => item.label);
    expect(labels).toEqual(["Today", "Work", "Scan", "Notices", "More"]);
    expect(CRM_GENERAL_NAV_ITEMS[0]?.href).toBe("/staff-portal");
    expect(CRM_GENERAL_NAV_ITEMS[1]?.href).toBe("/staff-portal/work");
    expect(CRM_GENERAL_NAV_ITEMS[3]?.href).toBe("/staff-portal/notices");
    expect(CRM_GENERAL_NAV_ITEMS[4]?.href).toBe("/staff-portal/more");
  });

  it("verifies Utility profile keeps Work disabled per C3/C4 contract", () => {
    const labels = UTILITY_NAV_ITEMS.map((item) => item.label);
    expect(labels).toEqual(["Today", "Work", "Scan", "Notices", "More"]);
    expect(UTILITY_NAV_ITEMS[0]?.href).toBe("/utility");

    const workItem = UTILITY_NAV_ITEMS[1];
    expect(workItem?.key).toBe("work");
    expect(workItem?.disabled).toBe(true);
    expect(workItem?.blockedNotice).toBe("Work information is unavailable for this role.");
  });

  it("verifies Driver profile destinations", () => {
    const labels = DRIVER_NAV_ITEMS.map((item) => item.label);
    expect(labels).toEqual(["Today", "Trips", "Scan", "Map", "More"]);
    expect(DRIVER_NAV_ITEMS[0]?.href).toBe("/driver");
    expect(DRIVER_NAV_ITEMS[1]?.href).toBe("/driver/trips");
    expect(DRIVER_NAV_ITEMS[3]?.href).toBe("/driver/map");
    expect(DRIVER_NAV_ITEMS[4]?.href).toBe("/driver/more");
  });
});

describe("PWA-C5: Staff Web App Manifest Contract", () => {
  it("serves valid Staff Web App Manifest with safe identity and scope separation", async () => {
    const response = getStaffManifest();
    expect(response.headers.get("Content-Type")).toContain("application/manifest+json");

    const text = await response.text();
    const manifest = JSON.parse(text);

    // Identity and name checks
    expect(manifest.id).toBe("cradlehub-staff");
    expect(manifest.name).toBe("CradleHub Staff");
    expect(manifest.short_name).toBe("Staff");
    expect(manifest.start_url).toBe("/staff-portal");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.background_color).toBe("#F7F3EB");
    expect(manifest.theme_color).toBe("#163A2B");

    // Icons check
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    expect(manifest.icons.some((icon: { sizes: string }) => icon.sizes === "192x192")).toBe(true);
    expect(manifest.icons.some((icon: { sizes: string }) => icon.sizes === "512x512")).toBe(true);
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

