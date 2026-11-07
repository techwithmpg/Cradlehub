/**
 * B1: Non-authoritative, LOCAL/TEST presentation fixtures.
 * Only product names and prices came from owner-provided information.
 * No SKU, stock, verified photography, checkout or availability authority.
 */
export type BoutiqueCategory = "All" | "Massage Oils" | "Home Rituals";
export type BoutiqueSort = "featured" | "price-low" | "price-high";

export type BoutiquePreviewProduct = {
  id: string;
  name: string;
  description: string;
  category: Exclude<BoutiqueCategory, "All">;
  pricePhp: number;
  artwork: "oil" | "spray";
  palette: "ginger" | "borneol" | "linen";
};

export const BOUTIQUE_PREVIEW_CATEGORIES: readonly BoutiqueCategory[] = [
  "All",
  "Massage Oils",
  "Home Rituals",
];

export const BOUTIQUE_PREVIEW_PRODUCTS: readonly BoutiquePreviewProduct[] = [
  {
    id: "preview-ginger-oil",
    name: "Ginger Massage Oil",
    category: "Massage Oils",
    pricePhp: 300,
    description: "A warming massage ritual. Product details and imagery require final catalogue verification.",
    artwork: "oil",
    palette: "ginger",
  },
  {
    id: "preview-borneol-oil",
    name: "Borneol Oil",
    category: "Massage Oils",
    pricePhp: 300,
    description: "A refreshing care ritual. Product details and imagery require final catalogue verification.",
    artwork: "oil",
    palette: "borneol",
  },
  {
    id: "preview-linen-spray",
    name: "Linen Spray",
    category: "Home Rituals",
    pricePhp: 250,
    description: "A serene home-care ritual. Product details and imagery require final catalogue verification.",
    artwork: "spray",
    palette: "linen",
  },
];

export function filterBoutiquePreviewProducts(
  products: readonly BoutiquePreviewProduct[],
  query: string,
  category: BoutiqueCategory,
  sort: BoutiqueSort = "featured",
): BoutiquePreviewProduct[] {
  const q = query.trim().toLocaleLowerCase();
  const result = products.filter((product) =>
    (category === "All" || product.category === category) &&
    (!q || [product.name, product.category, product.description].some((value) =>
      value.toLocaleLowerCase().includes(q))),
  );

  if (sort === "price-low") {
    return result.sort((a, b) => a.pricePhp - b.pricePhp || a.name.localeCompare(b.name));
  }
  if (sort === "price-high") {
    return result.sort((a, b) => b.pricePhp - a.pricePhp || a.name.localeCompare(b.name));
  }
  return result;
}

export function formatBoutiquePreviewPeso(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}
