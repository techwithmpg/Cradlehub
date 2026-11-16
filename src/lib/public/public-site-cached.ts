import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { cacheTags } from "@/lib/cache/cache-tags";
import { getPublicBranchesCached } from "@/lib/queries/branches";
import {
  getPublicSiteAssets,
  getPublicSiteSections,
  type PublicSiteAssetRow,
  type PublicSiteSectionRow,
} from "@/lib/queries/public-site";
import {
  getPublicServiceCatalog,
  type PublicCatalogService,
} from "@/lib/queries/services";
import { isPublicReadTransportFailure } from "@/lib/public/public-read-error";
import { publicAssetExistsOnServer } from "@/lib/public/server-image-assets";
import { resolveServiceImage } from "@/lib/service-images";
import { createAdminClient } from "@/lib/supabase/admin";

function hasAdminSupabaseConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

const _getPublicSiteSectionsUnstableCached = unstable_cache(
  async (includeDisabled: boolean): Promise<PublicSiteSectionRow[]> => {
    if (!hasAdminSupabaseConfig()) return [];
    return getPublicSiteSections({ includeDisabled });
  },
  ["public-site-sections"],
  {
    tags: [cacheTags.publicSiteSections],
    revalidate: 300,
  }
);

const _getPublicSiteAssetsUnstableCached = unstable_cache(
  async (sectionKey: string): Promise<PublicSiteAssetRow[]> => {
    if (!hasAdminSupabaseConfig()) return [];
    return getPublicSiteAssets(sectionKey);
  },
  ["public-site-assets"],
  {
    tags: [cacheTags.publicSiteSections, cacheTags.boutiqueCatalog],
    revalidate: 300,
  }
);

const _getPublicServiceCatalogUnstableCached = unstable_cache(
  async (): Promise<PublicCatalogService[]> => {
    if (!hasAdminSupabaseConfig()) return [];
    const services = await getPublicServiceCatalog(createAdminClient());
    return services.map((service) => {
      const resolved = resolveServiceImage(
        {
          id: service.id,
          name: service.name,
          imageUrl: service.imageUrl,
          imageAlt: service.imageAlt,
        },
        { isAvailable: publicAssetExistsOnServer }
      );
      if (resolved.imageUrl === service.imageUrl && resolved.imageAlt === service.imageAlt) {
        return service;
      }
      return {
        ...service,
        imageUrl: resolved.imageUrl,
        imageAlt: resolved.imageAlt,
      };
    });
  },
  ["public-service-catalog"],
  {
    tags: [cacheTags.serviceCatalog],
    revalidate: 300,
  }
);

/** Request-memoized, tag-cached loader for `public_site_sections` with offline fallback. */
export const getPublicSiteSectionsCached = cache(
  async (options?: { includeDisabled?: boolean }): Promise<PublicSiteSectionRow[]> => {
    try {
      return await _getPublicSiteSectionsUnstableCached(Boolean(options?.includeDisabled));
    } catch (error) {
      if (!isPublicReadTransportFailure(error)) throw error;
      return [];
    }
  }
);

/** Request-memoized, tag-cached loader for `public_site_assets` with offline fallback. */
export const getPublicSiteAssetsCached = cache(
  async (sectionKey: string): Promise<PublicSiteAssetRow[]> => {
    try {
      return await _getPublicSiteAssetsUnstableCached(sectionKey);
    } catch (error) {
      if (!isPublicReadTransportFailure(error)) throw error;
      return [];
    }
  }
);

/** Request-memoized, tag-cached public service catalog loader with Category A clean-checkout fallback. */
export const getPublicServiceCatalogCached = cache(
  async (): Promise<PublicCatalogService[]> => {
    try {
      return await _getPublicServiceCatalogUnstableCached();
    } catch (error) {
      if (!isPublicReadTransportFailure(error)) throw error;
      return [];
    }
  }
);

type PublicBranchList = Awaited<ReturnType<typeof getPublicBranchesCached>>;

/** Request-memoized public branches loader returning `[]` gracefully on transient transport errors. */
export const getPublicBranchesSafeCached = cache(
  async (): Promise<PublicBranchList> => {
    if (!hasAdminSupabaseConfig()) return [];
    try {
      return await getPublicBranchesCached();
    } catch (error) {
      if (!isPublicReadTransportFailure(error)) throw error;
      return [];
    }
  }
);
