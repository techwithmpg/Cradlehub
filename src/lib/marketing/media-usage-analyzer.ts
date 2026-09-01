import type { MarketingMediaStatus } from "@/lib/validations/marketing";
import type { PublicSiteAssetRow, PublicSiteSectionRow } from "@/lib/queries/public-site";
import type { MarketingContentDraftRow } from "@/lib/queries/marketing-content";

export type MediaAssetUsageConsumerType =
  | "public_section"
  | "public_asset"
  | "draft"
  | "service"
  | "brand"
  | "seo"
  | "other";

export type MediaAssetUsage = {
  consumerType: MediaAssetUsageConsumerType;
  entityId: string;
  entityKey: string;
  field: string;
  label: string;
  context?: string;
  isLive: boolean;
};

export type MediaAssetUsageSummary = {
  assetId: string;
  publicUrl: string | null;
  bucketPath: string;
  usages: MediaAssetUsage[];
  totalLiveUsages: number;
  totalDraftUsages: number;
  canSafelyArchive: boolean;
  blockingReasons: string[];
  usageUnknown?: boolean;
};

export type MediaUsageContextData = {
  sections?: readonly PublicSiteSectionRow[];
  publicAssets?: readonly PublicSiteAssetRow[];
  drafts?: readonly MarketingContentDraftRow[];
  services?: readonly {
    id: string;
    name: string;
    slug?: string;
    imageUrl?: string | null;
    imageAlt?: string | null;
    isPublicBookable?: boolean;
    isCsrOnly?: boolean;
  }[];
  brandSettings?: readonly {
    id: string;
    setting_key: string;
    label: string;
    value: Record<string, unknown>;
    status: string;
  }[];
  seoSettings?: readonly {
    id: string;
    route_path: string;
    title?: string | null;
    og_image_url?: string | null;
    status: string;
  }[];
};

function normalizeUrlOrPath(val?: string | null): string {
  if (!val) return "";
  return val.trim().toLowerCase();
}

export function matchesMediaAsset(
  asset: { id?: string; public_url?: string | null; bucket_path: string },
  targetValue?: string | null
): boolean {
  if (!targetValue) return false;
  const target = normalizeUrlOrPath(targetValue);
  if (!target) return false;

  if (asset.public_url) {
    const pub = normalizeUrlOrPath(asset.public_url);
    if (pub && (target === pub || target.includes(pub) || pub.includes(target))) {
      return true;
    }
  }

  const bucket = normalizeUrlOrPath(asset.bucket_path);
  if (bucket && (target === bucket || target.includes(bucket))) {
    return true;
  }

  // Also check filename match if path is structured
  const filename = bucket.split("/").pop();
  if (filename && filename.length > 4 && target.includes(filename)) {
    return true;
  }

  return false;
}

function searchJsonValues(
  json: unknown,
  asset: { public_url?: string | null; bucket_path: string }
): boolean {
  if (!json) return false;
  if (typeof json === "string") {
    return matchesMediaAsset(asset, json);
  }
  if (Array.isArray(json)) {
    return json.some((item) => searchJsonValues(item, asset));
  }
  if (typeof json === "object") {
    return Object.values(json as Record<string, unknown>).some((val) =>
      searchJsonValues(val, asset)
    );
  }
  return false;
}

export function analyzeMediaAssetUsage(
  asset: {
    id: string;
    public_url: string | null;
    bucket_path: string;
    status: MarketingMediaStatus;
  },
  context: MediaUsageContextData
): MediaAssetUsageSummary {
  const usages: MediaAssetUsage[] = [];

  // 1. Check Public Site Sections (Live)
  if (context.sections) {
    for (const section of context.sections) {
      const isLive = section.is_enabled !== false;
      if (matchesMediaAsset(asset, section.image_url)) {
        usages.push({
          consumerType: "public_section",
          entityId: section.id,
          entityKey: section.section_key,
          field: "image_url",
          label: `Section: ${section.title || section.section_key}`,
          context: "Primary Section Image",
          isLive,
        });
      }
      if (matchesMediaAsset(asset, section.secondary_image_url)) {
        usages.push({
          consumerType: "public_section",
          entityId: section.id,
          entityKey: section.section_key,
          field: "secondary_image_url",
          label: `Section: ${section.title || section.section_key}`,
          context: "Secondary Section Image",
          isLive,
        });
      }
      if (section.metadata && searchJsonValues(section.metadata, asset)) {
        usages.push({
          consumerType: "public_section",
          entityId: section.id,
          entityKey: section.section_key,
          field: "metadata",
          label: `Section: ${section.title || section.section_key}`,
          context: "Section Metadata / Gallery",
          isLive,
        });
      }
    }
  }

  // 2. Check Public Site Assets (Gallery / Live)
  if (context.publicAssets) {
    for (const pa of context.publicAssets) {
      if (matchesMediaAsset(asset, pa.image_url)) {
        usages.push({
          consumerType: "public_asset",
          entityId: pa.id,
          entityKey: pa.section_key || "gallery",
          field: "image_url",
          label: `Public Asset: ${pa.title || pa.section_key || "Gallery"}`,
          context: `Sort Order ${pa.sort_order}`,
          isLive: pa.is_enabled !== false,
        });
      }
    }
  }

  // 3. Check Marketing Content Drafts (Draft)
  if (context.drafts) {
    for (const draft of context.drafts) {
      if (draft.status === "archived") continue;

      if (matchesMediaAsset(asset, draft.image_url)) {
        usages.push({
          consumerType: "draft",
          entityId: draft.id,
          entityKey: draft.content_key,
          field: "image_url",
          label: `Draft: ${draft.title || draft.content_key}`,
          context: `Status: ${draft.status}`,
          isLive: false,
        });
      }
      if (matchesMediaAsset(asset, draft.secondary_image_url)) {
        usages.push({
          consumerType: "draft",
          entityId: draft.id,
          entityKey: draft.content_key,
          field: "secondary_image_url",
          label: `Draft: ${draft.title || draft.content_key}`,
          context: `Status: ${draft.status}`,
          isLive: false,
        });
      }
      if (draft.metadata && searchJsonValues(draft.metadata, asset)) {
        usages.push({
          consumerType: "draft",
          entityId: draft.id,
          entityKey: draft.content_key,
          field: "metadata",
          label: `Draft: ${draft.title || draft.content_key}`,
          context: `Metadata (Status: ${draft.status})`,
          isLive: false,
        });
      }
    }
  }

  // 4. Check Services Catalog (Live)
  if (context.services) {
    for (const service of context.services) {
      if (matchesMediaAsset(asset, service.imageUrl)) {
        usages.push({
          consumerType: "service",
          entityId: service.id,
          entityKey: service.slug || service.name,
          field: "imageUrl",
          label: `Service: ${service.name}`,
          context: service.isPublicBookable ? "Public Bookable Service" : "Catalog Service",
          isLive: true,
        });
      }
    }
  }

  // 5. Check Brand Settings
  if (context.brandSettings) {
    for (const brand of context.brandSettings) {
      if (searchJsonValues(brand.value, asset)) {
        usages.push({
          consumerType: "brand",
          entityId: brand.id,
          entityKey: brand.setting_key,
          field: "value",
          label: `Brand Setting: ${brand.label || brand.setting_key}`,
          context: `Status: ${brand.status}`,
          isLive: brand.status === "published",
        });
      }
    }
  }

  // 6. Check SEO Settings
  if (context.seoSettings) {
    for (const seo of context.seoSettings) {
      if (matchesMediaAsset(asset, seo.og_image_url)) {
        usages.push({
          consumerType: "seo",
          entityId: seo.id,
          entityKey: seo.route_path,
          field: "og_image_url",
          label: `SEO: ${seo.route_path}`,
          context: `Status: ${seo.status}`,
          isLive: seo.status === "published",
        });
      }
    }
  }

  const totalLiveUsages = usages.filter((u) => u.isLive).length;
  const totalDraftUsages = usages.filter((u) => !u.isLive).length;
  const blockingReasons: string[] = [];

  if (totalLiveUsages > 0) {
    blockingReasons.push(
      `Asset is currently referenced by ${totalLiveUsages} live public consumer${
        totalLiveUsages === 1 ? "" : "s"
      }. Replace or remove all live references before archiving.`
    );
  }

  return {
    assetId: asset.id,
    publicUrl: asset.public_url,
    bucketPath: asset.bucket_path,
    usages,
    totalLiveUsages,
    totalDraftUsages,
    canSafelyArchive: totalLiveUsages === 0,
    blockingReasons,
    usageUnknown: false,
  };
}

export function batchAnalyzeMediaUsage(
  assets: readonly {
    id: string;
    public_url: string | null;
    bucket_path: string;
    status: MarketingMediaStatus;
  }[],
  context: MediaUsageContextData
): Map<string, MediaAssetUsageSummary> {
  const map = new Map<string, MediaAssetUsageSummary>();
  for (const asset of assets) {
    map.set(asset.id, analyzeMediaAssetUsage(asset, context));
  }
  return map;
}
