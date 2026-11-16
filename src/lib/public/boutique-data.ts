import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { cacheTags } from "@/lib/cache/cache-tags";
import { isRenderableManagedSiteImageUrl } from "@/lib/marketing/website-images-inventory";
import {
  BOUTIQUE_COLLECTIONS,
  BOUTIQUE_HERO_IMAGE,
  BOUTIQUE_PRODUCTS,
  type BoutiqueCollection,
  type BoutiqueProduct,
} from "@/lib/public/boutique-catalog";
import { resolveHybridImage } from "@/lib/public/public-image-resolver";
import { isPublicReadTransportFailure } from "@/lib/public/public-read-error";
import { publicAssetExistsOnServer } from "@/lib/public/server-image-assets";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PublicSiteAssetRow, PublicSiteSectionRow } from "@/lib/queries/public-site";

export const BOUTIQUE_HERO_SECTION_KEY = "boutique";
export const BOUTIQUE_PRODUCT_ASSET_SECTION_KEY = "boutique_product";
export const BOUTIQUE_COLLECTION_ASSET_SECTION_KEY = "boutique_collection";

export type ResolvedBoutiqueCatalog = {
  heroImage: string;
  heroAlt: string;
  products: BoutiqueProduct[];
  collections: BoutiqueCollection[];
};

function metadataObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function isRenderableOrFallback(url: string): boolean {
  if (!isRenderableManagedSiteImageUrl(url)) return false;
  return publicAssetExistsOnServer(url);
}

/**
 * Pure transformer that applies optional database/Storage overrides from
 * `public_site_sections` (`section_key = "boutique"`) and `public_site_assets`
 * (`section_key IN ("boutique_product", "boutique_collection")`) onto the
 * canonical Boutique catalog without altering product IDs, prices, or stock rules.
 */
export function resolveBoutiqueCatalog(input: {
  heroSection?: PublicSiteSectionRow | null;
  assets?: readonly PublicSiteAssetRow[];
  verifyAssets?: boolean;
}): ResolvedBoutiqueCatalog {
  const verify = input.verifyAssets ?? true;
  const check = (url: string) =>
    isRenderableManagedSiteImageUrl(url) && (!verify || publicAssetExistsOnServer(url));

  const heroMeta = metadataObject(input.heroSection?.metadata);
  const heroAlt =
    typeof heroMeta.imageAltText === "string" && heroMeta.imageAltText.trim().length > 0
      ? heroMeta.imageAltText.trim()
      : "Cradle Boutique botanical massage oils and glowing lantern";

  const { url: heroImage } = resolveHybridImage(
    [{ value: input.heroSection?.image_url, tier: "database" }],
    BOUTIQUE_HERO_IMAGE,
    check
  );

  const productAssetById = new Map<string, PublicSiteAssetRow>();
  const collectionAssetById = new Map<string, PublicSiteAssetRow>();

  for (const asset of input.assets ?? []) {
    if (!asset.is_enabled) continue;
    const meta = metadataObject(asset.metadata);
    if (asset.section_key === BOUTIQUE_PRODUCT_ASSET_SECTION_KEY && typeof meta.productId === "string") {
      productAssetById.set(meta.productId.trim(), asset);
    } else if (
      asset.section_key === BOUTIQUE_COLLECTION_ASSET_SECTION_KEY &&
      typeof meta.collectionId === "string"
    ) {
      collectionAssetById.set(meta.collectionId.trim(), asset);
    }
  }

  const products = BOUTIQUE_PRODUCTS.map((product) => {
    const asset = productAssetById.get(product.id);
    const { url: image } = resolveHybridImage(
      [{ value: asset?.image_url, tier: "database" }],
      product.image,
      check
    );
    const imageAlt =
      asset?.alt_text && asset.alt_text.trim().length > 0 ? asset.alt_text.trim() : product.imageAlt;
    return { ...product, image, imageAlt };
  });

  const collections = BOUTIQUE_COLLECTIONS.map((collection) => {
    const asset = collectionAssetById.get(collection.id);
    const { url: image } = resolveHybridImage(
      [{ value: asset?.image_url, tier: "database" }],
      collection.image,
      check
    );
    const imageAlt =
      asset?.alt_text && asset.alt_text.trim().length > 0
        ? asset.alt_text.trim()
        : collection.imageAlt;
    return { ...collection, image, imageAlt };
  });

  return { heroImage, heroAlt, products, collections };
}

function isMissingBoutiqueSiteTableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    (lower.includes("public_site_sections") || lower.includes("public_site_assets")) &&
    (lower.includes("does not exist") ||
      lower.includes("schema cache") ||
      lower.includes("could not find"))
  );
}

const _getPublicBoutiqueCatalogUncached = unstable_cache(
  async (): Promise<ResolvedBoutiqueCatalog> => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      return resolveBoutiqueCatalog({ verifyAssets: true });
    }
    const supabase = createAdminClient();
    const [sectionRes, assetsRes] = await Promise.all([
      supabase
        .from("public_site_sections")
        .select(
          "id, section_key, title, subtitle, body, cta_label, cta_href, image_url, secondary_image_url, sort_order, is_enabled, metadata, created_at, updated_at"
        )
        .eq("section_key", BOUTIQUE_HERO_SECTION_KEY)
        .eq("is_enabled", true)
        .maybeSingle(),
      supabase
        .from("public_site_assets")
        .select(
          "id, section_key, title, alt_text, image_url, link_href, sort_order, is_enabled, metadata, created_at, updated_at"
        )
        .in("section_key", [
          BOUTIQUE_PRODUCT_ASSET_SECTION_KEY,
          BOUTIQUE_COLLECTION_ASSET_SECTION_KEY,
        ])
        .eq("is_enabled", true)
        .order("sort_order")
        .order("created_at"),
    ]);

    const heroSection =
      sectionRes.error && isMissingBoutiqueSiteTableError(sectionRes.error.message)
        ? null
        : sectionRes.error
          ? (() => {
              throw new Error(sectionRes.error.message);
            })()
          : sectionRes.data ?? null;

    const assets =
      assetsRes.error && isMissingBoutiqueSiteTableError(assetsRes.error.message)
        ? []
        : assetsRes.error
          ? (() => {
              throw new Error(assetsRes.error.message);
            })()
          : assetsRes.data ?? [];

    return resolveBoutiqueCatalog({
      heroSection,
      assets,
      verifyAssets: isRenderableOrFallback(BOUTIQUE_HERO_IMAGE),
    });
  },
  ["public-boutique-catalog"],
  {
    tags: [cacheTags.boutiqueCatalog, cacheTags.publicSiteSections],
    revalidate: 300,
  }
);

/** Cached public Boutique catalog reader with deterministic fallback on offline transport failures. */
export const getPublicBoutiqueCatalogCached = cache(async (): Promise<ResolvedBoutiqueCatalog> => {
  try {
    return await _getPublicBoutiqueCatalogUncached();
  } catch (error) {
    if (!isPublicReadTransportFailure(error)) throw error;
    return resolveBoutiqueCatalog({ verifyAssets: true });
  }
});
