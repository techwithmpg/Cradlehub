import { describe, expect, it } from "vitest";
import { filterOwnerServices, serviceBranchSummary, extensionPricePreview } from "./owner-service-workspace";
import { ownerServiceCatalogSchema } from "@/lib/validations/service";
import { resolveServiceImage } from "@/lib/service-images";
import type { OwnerService } from "@/components/features/services/owner-service-types";

const main = "c1000000-0000-0000-0000-000000000001";
const sm = "c1000000-0000-0000-0000-000000000002";
const category = "c2000000-0000-0000-0000-000000000001";
const branches = [{ id: main, name: "Main Spa" }, { id: sm, name: "SM Branch" }];
const services = [
  { id: "a", name: "Swedish Massage", description: "Relaxation", category_id: category, service_categories: { id: category, name: "Massage", display_order: 1 }, duration_minutes: 60, price: 800, is_active: true, offeredBranchIds: [main, sm] },
  { id: "b", name: "Special Facial", description: "Skin care", category_id: category, service_categories: { id: category, name: "Facial", display_order: 2 }, duration_minutes: 75, price: 900, is_active: true, offeredBranchIds: [main] },
  { id: "c", name: "Retired Massage", description: null, category_id: category, service_categories: { id: category, name: "Massage", display_order: 1 }, duration_minutes: 90, price: 700, is_active: false, offeredBranchIds: [sm] },
] as OwnerService[];

const baseInput = {
  categoryId: category,
  name: "Swedish Massage",
  description: "Relaxation",
  durationMinutes: 60,
  price: 800,
  isActive: true,
  isPublicVisible: true,
  durationPolicy: "extendable" as const,
  extensionIncrementMinutes: 30,
  extensionPrice: 350,
  maximumDurationMinutes: 180,
  imageAlt: "Massage treatment",
  allBranches: false,
  branchIds: [main],
};

describe("Owner service catalog contract", () => {
  it("filters branch offerings without changing the canonical service ID or other filters", () => {
    const selected = filterOwnerServices(services, { search: "massage", categoryId: category, branchId: sm, status: "active", sort: "name" });
    expect(selected.map((service) => service.id)).toEqual(["a"]);
    expect(filterOwnerServices(services, { search: "", categoryId: null, branchId: null, status: "all", sort: "name" })).toHaveLength(3);
    expect(filterOwnerServices(services, { search: "", categoryId: null, branchId: main, status: "active", sort: "price_desc" }).map((service) => service.id)).toEqual(["b", "a"]);
    expect(serviceBranchSummary(services[0]!, branches)).toBe("All branches");
    expect(serviceBranchSummary(services[1]!, branches)).toBe("Main Spa");
  });

  it("uses explicit extension pricing and rejects invalid policies", () => {
    expect(extensionPricePreview({ baseDuration: 60, basePrice: 800, increment: 30, extensionPrice: 350, maximumDuration: 180 }))
      .toEqual([{ duration: 60, price: 800 }, { duration: 90, price: 1150 }, { duration: 120, price: 1500 }, { duration: 150, price: 1850 }, { duration: 180, price: 2200 }]);
    expect(ownerServiceCatalogSchema.safeParse(baseInput).success).toBe(true);
    const zeroPriceRes = ownerServiceCatalogSchema.safeParse({ ...baseInput, extensionPrice: 0 });
    expect(zeroPriceRes.success).toBe(false);
    if (!zeroPriceRes.success) {
      expect(zeroPriceRes.error.issues[0]?.message).toBe("Extension price must be greater than ₱0.");
    }
    expect(ownerServiceCatalogSchema.safeParse({ ...baseInput, extensionPrice: -50 }).success).toBe(false);
    expect(extensionPricePreview({ baseDuration: 60, basePrice: 800, increment: 30, extensionPrice: 0, maximumDuration: 180 })).toEqual([]);
    expect(ownerServiceCatalogSchema.safeParse({ ...baseInput, extensionIncrementMinutes: 0 }).success).toBe(false);
    expect(ownerServiceCatalogSchema.safeParse({ ...baseInput, maximumDurationMinutes: 175 }).success).toBe(false);
    expect(ownerServiceCatalogSchema.safeParse({ ...baseInput, allBranches: false, branchIds: [] }).success).toBe(false);
    expect(ownerServiceCatalogSchema.safeParse({ ...baseInput, durationPolicy: "fixed" }).success).toBe(false);
    expect(ownerServiceCatalogSchema.safeParse({ ...baseInput, durationPolicy: "fixed", extensionIncrementMinutes: null, extensionPrice: null, maximumDurationMinutes: null }).success).toBe(true);
  });

  it("prefers the canonical image over the legacy manifest fallback", () => {
    const canonical = resolveServiceImage({ id: "service-id", name: "Swedish Massage", imageUrl: "https://example.com/new.webp", imageAlt: "Owner selected massage photo" });
    expect(canonical).toEqual({ imageUrl: "https://example.com/new.webp", imageAlt: "Owner selected massage photo" });
  });
});
