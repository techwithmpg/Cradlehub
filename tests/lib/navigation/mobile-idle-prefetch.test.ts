import { describe, expect, it } from "vitest";
import { CRM_PREFETCH, OWNER_PREFETCH, STAFF_PWA_PROVIDER_PREFETCH } from "@/components/features/workspace/workspace-prefetch-config";
import { resolveIdlePrefetchRoutes } from "@/components/features/workspace/mobile-idle-prefetch";

describe("Mobile administrative workspace prefetch policy", () => {
  const crmMobile = ["/crm/today", "/crm/schedule"];
  const ownerMobile = ["/owner", "/owner/bookings"];

  it("retains the existing desktop CRM and Owner prefetch lists", () => {
    expect(resolveIdlePrefetchRoutes(CRM_PREFETCH, crmMobile, false)).toEqual(CRM_PREFETCH.idle);
    expect(resolveIdlePrefetchRoutes(OWNER_PREFETCH, ownerMobile, false)).toEqual(OWNER_PREFETCH.idle);
  });

  it("excludes expensive secondary background routes on mobile", () => {
    expect(resolveIdlePrefetchRoutes(CRM_PREFETCH, crmMobile, true)).toEqual(crmMobile);
    expect(resolveIdlePrefetchRoutes(OWNER_PREFETCH, ownerMobile, true)).toEqual(ownerMobile);
    expect(resolveIdlePrefetchRoutes(OWNER_PREFETCH, ownerMobile, true)).not.toContain("/owner/reports");
    expect(resolveIdlePrefetchRoutes(CRM_PREFETCH, crmMobile, true)).not.toContain("/crm/bookings");
  });

  it("does not allow undeclared routes into the idle prefetch list", () => {
    expect(resolveIdlePrefetchRoutes(CRM_PREFETCH, ["/crm/today", "/owner", "/crm/admin"], true)).toEqual(["/crm/today"]);
  });

  it("leaves canonical Staff PWA behavior unchanged without an opt-in", () => {
    expect(resolveIdlePrefetchRoutes(STAFF_PWA_PROVIDER_PREFETCH, undefined, true)).toEqual(
      STAFF_PWA_PROVIDER_PREFETCH.idle
    );
  });
});
