// @vitest-environment jsdom
import React from "react";
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { TherapistMobileShell } from "@/components/features/staff-portal/therapist/therapist-mobile-shell";
import { DriverMobileShell } from "@/components/features/staff-portal/driver/driver-mobile-shell";
import { StaffMobileShell } from "@/components/features/staff-portal/mobile/staff-mobile-shell";
import {
  resolveStaffOperationalRole,
  resolveNavigationProfile,
} from "@/components/features/staff-pwa/role-navigation";

let mockPathname = "/staff";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Lucide icons and internal sub-components to keep render focused
vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    Camera: () => <span data-testid="icon-camera" />,
    Scan: () => <span data-testid="icon-scan" />,
  };
});

describe("W1A: Scanner Shell Isolation & Foundation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/staff";
  });

  afterEach(() => {
    cleanup();
  });

  it("1. TherapistMobileShell suppresses bottom navigation and bottom padding when on /staff/scan", () => {
    mockPathname = "/staff/scan";
    const { container } = render(
      <TherapistMobileShell>
        <div data-testid="scanner-content">Camera Scanner</div>
      </TherapistMobileShell>
    );

    expect(screen.getByTestId("scanner-content")).toBeDefined();
    // Bottom nav must NOT be rendered under scanner
    expect(screen.queryByRole("navigation")).toBeNull();
    // Bottom padding must be omitted to prevent dead space under camera viewport
    const contentWrapper = container.querySelector(".min-h-dvh");
    expect(contentWrapper).not.toBeNull();
    expect(contentWrapper?.className).not.toContain("pb-[calc(112px");
  });

  it("2. TherapistMobileShell preserves bottom navigation when on standard provider route /staff", () => {
    mockPathname = "/staff";
    const { container } = render(
      <TherapistMobileShell>
        <div data-testid="therapist-today">Provider Today Content</div>
      </TherapistMobileShell>
    );

    expect(screen.getByTestId("therapist-today")).toBeDefined();
    // Bottom navigation must be present on standard routes
    expect(container.querySelector("nav")).not.toBeNull();
    const contentWrapper = container.querySelector(".min-h-dvh");
    expect(contentWrapper?.className).toContain("pb-[calc(112px+env(safe-area-inset-bottom))]");
  });

  it("3. DriverMobileShell suppresses bottom navigation, sheet, and padding on /staff/scan", () => {
    mockPathname = "/staff/scan";
    const dummyStaff = {
      id: "driver-1",
      full_name: "Juan Driver",
      nickname: "Juan",
      branch_id: "branch-1",
      system_role: "driver",
      staff_type: "driver",
      tier: null,
      is_active: true,
      branch: { id: "branch-1", name: "Main Branch", timezone: "Asia/Manila" },
    };

    const { container } = render(
      <DriverMobileShell staff={dummyStaff} mode="canonical">
        <div data-testid="driver-scanner">Driver Scanner View</div>
      </DriverMobileShell>
    );

    expect(screen.getByTestId("driver-scanner")).toBeDefined();
    expect(screen.queryByRole("navigation")).toBeNull();
    const contentWrapper = container.querySelector(".min-h-dvh");
    expect(contentWrapper?.className).not.toContain("pb-[calc(84px");
  });

  it("4. DriverMobileShell preserves driver navigation when on standard route /staff/driver", () => {
    mockPathname = "/staff/driver";
    const dummyStaff = {
      id: "driver-1",
      full_name: "Juan Driver",
      nickname: "Juan",
      branch_id: "branch-1",
      system_role: "driver",
      staff_type: "driver",
      tier: null,
      is_active: true,
      branch: { id: "branch-1", name: "Main Branch", timezone: "Asia/Manila" },
    };

    const { container } = render(
      <DriverMobileShell staff={dummyStaff} mode="canonical">
        <div data-testid="driver-today">Driver Today View</div>
      </DriverMobileShell>
    );

    expect(screen.getByTestId("driver-today")).toBeDefined();
    expect(container.querySelector("nav")).not.toBeNull();
    const contentWrapper = container.querySelector(".min-h-dvh");
    expect(contentWrapper?.className).toContain("pb-[calc(84px+env(safe-area-inset-bottom))]");
  });

  it("5. StaffMobileShell suppresses bottom navigation on /staff/scan for utility and crm", () => {
    mockPathname = "/staff/scan";

    // Utility profile
    const { container: utilityContainer } = render(
      <StaffMobileShell profile="utility">
        <div data-testid="utility-scanner">Utility Scanner View</div>
      </StaffMobileShell>
    );
    expect(screen.getByTestId("utility-scanner")).toBeDefined();
    expect(utilityContainer.querySelector("nav")).toBeNull();
    expect(utilityContainer.querySelector(".min-h-dvh")?.className).not.toContain("pb-[calc(84px");

    cleanup();

    // CRM general profile
    const { container: crmContainer } = render(
      <StaffMobileShell profile="crm_general">
        <div data-testid="crm-scanner">CRM Scanner View</div>
      </StaffMobileShell>
    );
    expect(screen.getByTestId("crm-scanner")).toBeDefined();
    expect(crmContainer.querySelector("nav")).toBeNull();
    expect(crmContainer.querySelector(".min-h-dvh")?.className).not.toContain("pb-[calc(84px");
  });

  it("6. resolves role-correct return href for scanner back navigation", () => {
    // Driver -> /staff/driver
    const driverRole = resolveStaffOperationalRole({ system_role: "driver", staff_type: null });
    const driverProfile = resolveNavigationProfile(driverRole);
    const driverReturnHref =
      driverProfile === "driver" ? "/staff/driver" : driverProfile === "utility" ? "/staff/utility" : "/staff";
    expect(driverReturnHref).toBe("/staff/driver");

    // Utility -> /staff/utility
    const utilityRole = resolveStaffOperationalRole({ system_role: "utility", staff_type: "utility" });
    const utilityProfile = resolveNavigationProfile(utilityRole);
    const utilityReturnHref =
      utilityProfile === "driver" ? "/staff/driver" : utilityProfile === "utility" ? "/staff/utility" : "/staff";
    expect(utilityReturnHref).toBe("/staff/utility");

    // Therapist / Provider -> /staff
    const therapistRole = resolveStaffOperationalRole({ system_role: "staff", staff_type: "therapist" });
    const providerProfile = resolveNavigationProfile(therapistRole);
    const providerReturnHref =
      providerProfile === "driver" ? "/staff/driver" : providerProfile === "utility" ? "/staff/utility" : "/staff";
    expect(providerReturnHref).toBe("/staff");

    // CRM / General -> /staff
    const crmRole = resolveStaffOperationalRole({ system_role: "crm", staff_type: null });
    const crmProfile = resolveNavigationProfile(crmRole);
    const crmReturnHref =
      crmProfile === "driver" ? "/staff/driver" : crmProfile === "utility" ? "/staff/utility" : "/staff";
    expect(crmReturnHref).toBe("/staff");
  });

  it("7. preserves C6 full-document navigation for central Scan button", () => {
    const bottomNavSource = readFileSync("src/components/features/staff-pwa/bottom-nav.tsx", "utf8");
    // Scan must use native anchor <a> to guarantee same-origin document reload and camera Permissions-Policy
    expect(bottomNavSource).toMatch(/<a\s+href=\{item\.href\}\s+aria-label="Scan QR code"/);
  });

  it("8. preserves exactly one scanner shell structure in /staff/scan/page.tsx", () => {
    const scanPageSource = readFileSync("src/app/(dashboard)/staff/scan/page.tsx", "utf8");
    // StaffAppShell is rendered with hideNav={true}
    expect(scanPageSource).toContain("<StaffAppShell");
    expect(scanPageSource).toContain("hideNav={true}");
    expect(scanPageSource).toContain("<StaffQrScanner returnHref={returnHref} />");
  });
});
