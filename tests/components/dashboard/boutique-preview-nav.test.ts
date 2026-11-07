import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("B1 Boutique navigation preview gate", () => {
  it("does not alter default accepted Owner/CRM navigation", async () => {
    vi.stubEnv("NEXT_PUBLIC_CRADLEHUB_BOUTIQUE_B1_PREVIEW", "false");
    vi.resetModules();
    const { NAV_CONFIG } = await import("@/components/features/dashboard/nav-config");
    expect(NAV_CONFIG.owner.items?.some((item) => item.href === "/owner/boutique")).toBe(false);
    expect(NAV_CONFIG.crm.items?.some((item) => item.href === "/crm/boutique")).toBe(false);
  });

  it("reveals scoped links only for the approved review roles", async () => {
    vi.stubEnv("NEXT_PUBLIC_CRADLEHUB_BOUTIQUE_B1_PREVIEW", "true");
    vi.resetModules();
    const { NAV_CONFIG, visibleNavItems } = await import("@/components/features/dashboard/nav-config");
    expect(NAV_CONFIG.owner.items?.some((item) => item.href === "/owner/boutique")).toBe(true);
    const crmItems = NAV_CONFIG.crm.items ?? [];
    expect(visibleNavItems(crmItems, true, "crm").some((item) => item.href === "/crm/boutique")).toBe(true);
    expect(visibleNavItems(crmItems, true, "csr_staff").some((item) => item.href === "/crm/boutique")).toBe(true);
    expect(visibleNavItems(crmItems, true, "manager").some((item) => item.href === "/crm/boutique")).toBe(false);
  });
});
