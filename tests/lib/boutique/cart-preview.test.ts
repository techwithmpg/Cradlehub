import { describe, expect, it } from "vitest";
import {
  BOUTIQUE_PREVIEW_PRODUCTS,
  filterBoutiquePreviewProducts,
  formatBoutiquePreviewPeso,
} from "@/lib/boutique/catalogue-preview";
import {
  addBoutiquePreviewItem,
  getBoutiquePreviewCartSummary,
  setBoutiquePreviewQuantity,
} from "@/lib/boutique/cart-preview";

describe("B1 presentation-only catalogue", () => {
  it("keeps precisely the three approved product names and prices", () => {
    expect(BOUTIQUE_PREVIEW_PRODUCTS.map((product) => [product.name, product.pricePhp])).toEqual([
      ["Ginger Massage Oil", 300],
      ["Borneol Oil", 300],
      ["Linen Spray", 250],
    ]);
    expect(formatBoutiquePreviewPeso(250)).toContain("250");
  });

  it("filters category and query without mutating fixtures", () => {
    expect(filterBoutiquePreviewProducts(BOUTIQUE_PREVIEW_PRODUCTS, "ginger", "All"))
      .toHaveLength(1);
    expect(filterBoutiquePreviewProducts(BOUTIQUE_PREVIEW_PRODUCTS, "", "Home Rituals"))
      .toHaveLength(1);
    expect(filterBoutiquePreviewProducts(BOUTIQUE_PREVIEW_PRODUCTS, "not a product", "All"))
      .toEqual([]);
    expect(filterBoutiquePreviewProducts(BOUTIQUE_PREVIEW_PRODUCTS, "", "All", "price-low")
      .map((product) => product.pricePhp)).toEqual([250, 300, 300]);
    expect(BOUTIQUE_PREVIEW_PRODUCTS[0]?.name).toBe("Ginger Massage Oil");
  });
});

describe("B1 in-memory shopping bag simulation", () => {
  it("increments known items and derives count and subtotal from fixture prices", () => {
    const first = addBoutiquePreviewItem([], "preview-ginger-oil", BOUTIQUE_PREVIEW_PRODUCTS);
    const second = addBoutiquePreviewItem(first, "preview-linen-spray", BOUTIQUE_PREVIEW_PRODUCTS);
    const third = addBoutiquePreviewItem(second, "preview-ginger-oil", BOUTIQUE_PREVIEW_PRODUCTS);
    expect(getBoutiquePreviewCartSummary(third, BOUTIQUE_PREVIEW_PRODUCTS))
      .toEqual({ count: 3, subtotalPhp: 850 });
  });

  it("rejects unknown products and removes zero-quantity lines", () => {
    const invalid = addBoutiquePreviewItem([], "not-a-sku", BOUTIQUE_PREVIEW_PRODUCTS);
    expect(invalid).toEqual([]);
    const first = addBoutiquePreviewItem(invalid, "preview-borneol-oil", BOUTIQUE_PREVIEW_PRODUCTS);
    expect(setBoutiquePreviewQuantity(first, "preview-borneol-oil", 0)).toEqual([]);
    expect(getBoutiquePreviewCartSummary([{ productId: "fake", quantity: 200 }], BOUTIQUE_PREVIEW_PRODUCTS))
      .toEqual({ count: 0, subtotalPhp: 0 });
  });
});
