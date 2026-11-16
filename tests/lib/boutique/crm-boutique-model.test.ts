import { describe, expect, it } from "vitest";
import {
  BOUTIQUE_CATEGORIES,
  BOUTIQUE_COLLECTIONS,
  BOUTIQUE_GIFT_CARD_OPTIONS,
  BOUTIQUE_PRODUCTS,
} from "@/lib/public/boutique-catalog";
import {
  buildBoutiqueCapabilityMatrix,
  buildBoutiqueCatalogViews,
  buildBoutiqueCategorySummaries,
  buildBoutiqueCollectionSummaries,
  buildBoutiqueGiftCardOverview,
  buildBoutiqueStockMatrix,
  filterAndSortBoutiqueCatalog,
  normalizeCrmBoutiqueTab,
} from "@/lib/boutique/crm-boutique-model";

describe("crm-boutique-model", () => {
  it("single-sources products directly from BOUTIQUE_PRODUCTS without duplication", () => {
    const views = buildBoutiqueCatalogViews();
    expect(views).toHaveLength(BOUTIQUE_PRODUCTS.length);
    views.forEach((view, idx) => {
      expect(view.product).toBe(BOUTIQUE_PRODUCTS[idx]);
    });
  });

  it("normalizes supported boutique tab keys and aliases safely", () => {
    expect(normalizeCrmBoutiqueTab(undefined)).toBe("products");
    expect(normalizeCrmBoutiqueTab("gift_cards")).toBe("gift-cards");
    expect(normalizeCrmBoutiqueTab("gift-certificates")).toBe("gift-cards");
    expect(normalizeCrmBoutiqueTab("branch_assignment")).toBe("branches");
    expect(normalizeCrmBoutiqueTab("stock")).toBe("stock");
    expect(normalizeCrmBoutiqueTab("unknown-tab")).toBe("products");
  });

  it("filters by category and search query and sorts deterministically", () => {
    const all = buildBoutiqueCatalogViews();
    const oils = filterAndSortBoutiqueCatalog(all, { category: "oils" });
    expect(oils.length).toBeGreaterThan(0);
    expect(oils.every((item) => item.product.category === "oils")).toBe(true);

    const searchBorneol = filterAndSortBoutiqueCatalog(all, { search: "borneol" });
    expect(searchBorneol.map((i) => i.product.id)).toContain("borneol-oil");

    const asc = filterAndSortBoutiqueCatalog(all, { sort: "price-asc" });
    for (let i = 1; i < asc.length; i += 1) {
      expect(asc[i]!.product.price).toBeGreaterThanOrEqual(asc[i - 1]!.product.price);
    }

    const desc = filterAndSortBoutiqueCatalog(all, { sort: "price-desc" });
    for (let i = 1; i < desc.length; i += 1) {
      expect(desc[i]!.product.price).toBeLessThanOrEqual(desc[i - 1]!.product.price);
    }
  });

  it("builds category, collection, and gift card overviews matching canonical constants", () => {
    const categories = buildBoutiqueCategorySummaries();
    expect(categories).toHaveLength(BOUTIQUE_CATEGORIES.length);
    expect(categories.find((c) => c.id === "all")?.productCount).toBe(BOUTIQUE_PRODUCTS.length);

    const collections = buildBoutiqueCollectionSummaries();
    expect(collections).toHaveLength(BOUTIQUE_COLLECTIONS.length);

    const gifts = buildBoutiqueGiftCardOverview();
    expect(gifts.options).toEqual(BOUTIQUE_GIFT_CARD_OPTIONS);
    expect(gifts.issuanceEnabled).toBe(false);
    expect(gifts.redemptionEnabled).toBe(false);
  });

  it("reports stock readiness truthfully without synthetic counts or active mutations", () => {
    const matrix = buildBoutiqueStockMatrix([
      {
        id: "branch-1",
        name: "Main Spa · Lacson",
        address: null,
        phone: null,
        email: null,
        openingHours: null,
        isActive: true,
        isCurrentScope: true,
        pickupConciergeStatus: "In-Spa Concierge Ready",
      },
    ]);

    expect(matrix).toHaveLength(BOUTIQUE_PRODUCTS.length);
    for (const row of matrix) {
      expect(row.isTracked).toBe(false);
      for (const cell of row.branchAssignments) {
        expect(cell.canMutate).toBe(false);
        expect(cell.trackingLabel).toMatch(/Not Tracked|Voucher SKU/);
      }
    }
  });

  it("enforces owner vs CRM capability distinctions with pending operations disabled", () => {
    const crmMatrix = buildBoutiqueCapabilityMatrix("crm");
    const ownerMatrix = buildBoutiqueCapabilityMatrix("owner");

    const crmMarketing = crmMatrix.find((c) => c.id === "marketing-cms-governance");
    const ownerMarketing = ownerMatrix.find((c) => c.id === "marketing-cms-governance");

    expect(crmMarketing?.isEnabled).toBe(false);
    expect(ownerMarketing?.isEnabled).toBe(true);

    const pending = ownerMatrix.filter((c) => c.group === "pending_authorization");
    expect(pending.length).toBeGreaterThanOrEqual(4);
    expect(pending.every((c) => c.isEnabled === false)).toBe(true);
  });
});
