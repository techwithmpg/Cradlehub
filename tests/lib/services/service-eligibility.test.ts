import { describe, expect, it } from "vitest";
import {
  isAssignableBranchService,
  isDeliveryModeEnabled,
  isVisibleForAudience,
  normalizeServiceVisibility,
  toLegacyBookingVisibility,
  validateBranchServiceEligibility,
} from "@/lib/services/service-eligibility";
import type { BranchServiceCatalogRow } from "@/lib/services/service-types";

const activeService = { is_active: true };

function branchService(
  overrides: Partial<BranchServiceCatalogRow> = {}
): BranchServiceCatalogRow {
  return {
    id: "branch-service-id",
    branch_id: "branch-id",
    service_id: "service-id",
    custom_price: null,
    is_active: true,
    available_in_spa: true,
    available_home_service: false,
    visibility: "public",
    booking_visibility: "public",
    services: null,
    ...overrides,
  };
}

describe("service eligibility", () => {
  it("uses visibility as the canonical runtime value and maps legacy booking visibility", () => {
    expect(
      normalizeServiceVisibility({
        visibility: "internal",
        bookingVisibility: "public",
      })
    ).toBe("internal");
    expect(
      normalizeServiceVisibility({
        visibility: null,
        bookingVisibility: "csr_only",
      })
    ).toBe("internal");
    expect(toLegacyBookingVisibility("hidden")).toBe("vip");
  });

  it("applies audience visibility without hiding management or assignment options", () => {
    expect(isVisibleForAudience("internal", "public")).toBe(false);
    expect(isVisibleForAudience("internal", "crm")).toBe(true);
    expect(isVisibleForAudience("hidden", "management")).toBe(true);
    expect(isVisibleForAudience("hidden", "staff_assignment")).toBe(true);
  });

  it("requires branch-enabled delivery mode for Home Service", () => {
    const both = branchService({ available_home_service: true });

    expect(isDeliveryModeEnabled(both, "in_spa", { homeServiceEnabled: false })).toBe(true);
    expect(isDeliveryModeEnabled(both, "home_service", { homeServiceEnabled: false })).toBe(false);
    expect(isDeliveryModeEnabled(both, "home_service", { homeServiceEnabled: true })).toBe(true);
  });

  it("keeps SM assignability in-spa-only when branch Home Service is disabled", () => {
    const mainBoth = branchService({
      available_in_spa: true,
      available_home_service: true,
    });
    const homeOnly = branchService({
      available_in_spa: false,
      available_home_service: true,
    });

    expect(
      isAssignableBranchService({
        service: activeService,
        branchService: mainBoth,
        rules: { homeServiceEnabled: false },
      })
    ).toBe(true);
    expect(
      isAssignableBranchService({
        service: activeService,
        branchService: homeOnly,
        rules: { homeServiceEnabled: false },
      })
    ).toBe(false);
  });

  it("does not treat missing staff providers as a catalogue eligibility failure", () => {
    expect(
      validateBranchServiceEligibility({
        service: activeService,
        branchService: branchService(),
        audience: "staff_assignment",
        deliveryMode: "in_spa",
        rules: { homeServiceEnabled: false },
      })
    ).toEqual({ ok: true });
  });

  it("rejects branch-missing, inactive, hidden public, and unavailable delivery modes", () => {
    expect(
      validateBranchServiceEligibility({
        service: activeService,
        branchService: null,
        audience: "management",
        deliveryMode: "any",
        rules: { homeServiceEnabled: false },
      })
    ).toEqual({ ok: false, reasons: ["branch_missing"] });

    expect(
      validateBranchServiceEligibility({
        service: activeService,
        branchService: branchService({ visibility: "hidden" }),
        audience: "public",
        deliveryMode: "in_spa",
        rules: { homeServiceEnabled: false },
      })
    ).toEqual({ ok: false, reasons: ["not_visible_to_audience"] });

    expect(
      validateBranchServiceEligibility({
        service: activeService,
        branchService: branchService({
          available_in_spa: false,
          available_home_service: true,
        }),
        audience: "public",
        deliveryMode: "home_service",
        rules: { homeServiceEnabled: false },
      })
    ).toEqual({ ok: false, reasons: ["delivery_mode_unavailable"] });
  });
});
