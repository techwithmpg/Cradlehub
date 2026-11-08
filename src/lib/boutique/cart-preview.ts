import type { BoutiquePreviewProduct } from "./catalogue-preview";

/** In-memory UI simulation only. Never post these quantities as an order. */
export type BoutiquePreviewCartLine = { productId: string; quantity: number };

export function addBoutiquePreviewItem(
  lines: readonly BoutiquePreviewCartLine[],
  productId: string,
  validProducts: readonly BoutiquePreviewProduct[],
): BoutiquePreviewCartLine[] {
  if (!validProducts.some((product) => product.id === productId)) return [...lines];
  const existing = lines.find((line) => line.productId === productId);
  if (!existing) return [...lines, { productId, quantity: 1 }];
  return lines.map((line) => line.productId === productId
    ? { ...line, quantity: Math.min(99, line.quantity + 1) }
    : line);
}

export function setBoutiquePreviewQuantity(
  lines: readonly BoutiquePreviewCartLine[],
  productId: string,
  quantity: number,
): BoutiquePreviewCartLine[] {
  if (!Number.isFinite(quantity)) return [...lines];
  const normalized = Math.max(0, Math.min(99, Math.trunc(quantity)));
  return lines.flatMap((line) => {
    if (line.productId !== productId) return [line];
    return normalized > 0 ? [{ ...line, quantity: normalized }] : [];
  });
}

export function getBoutiquePreviewCartSummary(
  lines: readonly BoutiquePreviewCartLine[],
  products: readonly BoutiquePreviewProduct[],
): { count: number; subtotalPhp: number } {
  const known = new Map(products.map((product) => [product.id, product.pricePhp]));
  return lines.reduce((summary, line) => {
    const price = known.get(line.productId);
    if (price === undefined || !Number.isInteger(line.quantity) || line.quantity < 1) {
      return summary;
    }
    return {
      count: summary.count + line.quantity,
      subtotalPhp: summary.subtotalPhp + line.quantity * price,
    };
  }, { count: 0, subtotalPhp: 0 });
}
