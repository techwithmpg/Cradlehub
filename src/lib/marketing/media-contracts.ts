import type { MarketingMediaAssetRow } from "@/lib/queries/marketing-media";

export type MarketingMediaIntentKey =
  | "HEADER_LOGO"
  | "FOOTER_LOGO"
  | "BRAND_MARK"
  | "SITE_ICON_MASTER"
  | "BRANCH_PHOTO"
  | "SERVICE_PHOTO"
  | "HERO_BACKGROUND"
  | "FEATURE_PORTRAIT";

export type MarketingMediaContract = {
  id: MarketingMediaIntentKey;
  purpose: string;
  allowedMimeTypes: readonly string[];
  allowedExtensions: readonly string[];
  maxBytes: number;
  minWidth: number;
  minHeight: number;
  recommendedWidth: number;
  recommendedHeight: number;
  aspectRatio: {
    target: number; // width / height
    min: number;
    max: number;
  };
  svgAllowed: boolean;
  transparencyPreferred: boolean;
  requirementText: string;
};

export const MARKETING_MEDIA_CONTRACTS: Record<MarketingMediaIntentKey, MarketingMediaContract> = {
  HEADER_LOGO: {
    id: "HEADER_LOGO",
    purpose: "Public horizontal navigation header logo",
    allowedMimeTypes: ["image/svg+xml", "image/png", "image/webp"],
    allowedExtensions: [".svg", ".png", ".webp"],
    maxBytes: 2 * 1024 * 1024, // 2MB
    minWidth: 400,
    minHeight: 80,
    recommendedWidth: 800,
    recommendedHeight: 200,
    aspectRatio: {
      target: 4.0,
      min: 2.5,
      max: 7.0,
    },
    svgAllowed: true,
    transparencyPreferred: true,
    requirementText: "Wide / Horizontal · SVG, PNG, WebP · Min 400px wide (SVG preferred) · Max 2 MB",
  },
  FOOTER_LOGO: {
    id: "FOOTER_LOGO",
    purpose: "Public footer and secondary brand emblem",
    allowedMimeTypes: ["image/svg+xml", "image/png", "image/webp"],
    allowedExtensions: [".svg", ".png", ".webp"],
    maxBytes: 2 * 1024 * 1024, // 2MB
    minWidth: 300,
    minHeight: 80,
    recommendedWidth: 600,
    recommendedHeight: 180,
    aspectRatio: {
      target: 3.5,
      min: 2.0,
      max: 6.0,
    },
    svgAllowed: true,
    transparencyPreferred: true,
    requirementText: "Horizontal · SVG, PNG, WebP · Transparent background preferred · Max 2 MB",
  },
  BRAND_MARK: {
    id: "BRAND_MARK",
    purpose: "Square brand mark, emblem, and watermark asset",
    allowedMimeTypes: ["image/svg+xml", "image/png", "image/webp"],
    allowedExtensions: [".svg", ".png", ".webp"],
    maxBytes: 5 * 1024 * 1024, // 5MB
    minWidth: 512,
    minHeight: 512,
    recommendedWidth: 1024,
    recommendedHeight: 1024,
    aspectRatio: {
      target: 1.0,
      min: 0.95,
      max: 1.05,
    },
    svgAllowed: true,
    transparencyPreferred: true,
    requirementText: "Square (1:1) · SVG, PNG, WebP · Min 512×512, Recommended 1024×1024 · Max 5 MB",
  },
  SITE_ICON_MASTER: {
    id: "SITE_ICON_MASTER",
    purpose: "Master source for auto-generated favicon and application icon package",
    allowedMimeTypes: ["image/svg+xml", "image/png", "image/webp"],
    allowedExtensions: [".svg", ".png", ".webp"],
    maxBytes: 5 * 1024 * 1024, // 5MB
    minWidth: 512,
    minHeight: 512,
    recommendedWidth: 1024,
    recommendedHeight: 1024,
    aspectRatio: {
      target: 1.0,
      min: 0.9,
      max: 1.1,
    },
    svgAllowed: true,
    transparencyPreferred: true,
    requirementText: "Square brand mark · SVG, PNG, WebP · Min 512×512 (Recommended 1024×1024) · Max 5 MB",
  },
  BRANCH_PHOTO: {
    id: "BRANCH_PHOTO",
    purpose: "Public spa branch presentation photography",
    allowedMimeTypes: ["image/webp", "image/jpeg", "image/png"],
    allowedExtensions: [".webp", ".jpg", ".jpeg", ".png"],
    maxBytes: 5 * 1024 * 1024, // 5MB
    minWidth: 800,
    minHeight: 450,
    recommendedWidth: 1600,
    recommendedHeight: 900,
    aspectRatio: {
      target: 16 / 9,
      min: 1.4,
      max: 2.1,
    },
    svgAllowed: false,
    transparencyPreferred: false,
    requirementText: "Landscape (16:9) · WebP, JPG, PNG · Min 800×450, Recommended 1600×900 · Max 5 MB",
  },
  SERVICE_PHOTO: {
    id: "SERVICE_PHOTO",
    purpose: "Public service treatment presentation image",
    allowedMimeTypes: ["image/webp", "image/jpeg", "image/png"],
    allowedExtensions: [".webp", ".jpg", ".jpeg", ".png"],
    maxBytes: 5 * 1024 * 1024, // 5MB
    minWidth: 600,
    minHeight: 450,
    recommendedWidth: 1200,
    recommendedHeight: 900,
    aspectRatio: {
      target: 4 / 3,
      min: 1.1,
      max: 1.6,
    },
    svgAllowed: false,
    transparencyPreferred: false,
    requirementText: "Standard (4:3) · WebP, JPG, PNG · Min 600×450, Recommended 1200×900 · Max 5 MB",
  },
  HERO_BACKGROUND: {
    id: "HERO_BACKGROUND",
    purpose: "Homepage hero section full-width background photo",
    allowedMimeTypes: ["image/webp", "image/jpeg", "image/png"],
    allowedExtensions: [".webp", ".jpg", ".jpeg", ".png"],
    maxBytes: 8 * 1024 * 1024, // 8MB
    minWidth: 1280,
    minHeight: 720,
    recommendedWidth: 1920,
    recommendedHeight: 1080,
    aspectRatio: {
      target: 16 / 9,
      min: 1.5,
      max: 2.2,
    },
    svgAllowed: false,
    transparencyPreferred: false,
    requirementText: "Wide Landscape (16:9) · WebP, JPG, PNG · Min 1280×720, Recommended 1920×1080 · Max 8 MB",
  },
  FEATURE_PORTRAIT: {
    id: "FEATURE_PORTRAIT",
    purpose: "About, philosophy, or team spotlight portrait photo",
    allowedMimeTypes: ["image/webp", "image/jpeg", "image/png"],
    allowedExtensions: [".webp", ".jpg", ".jpeg", ".png"],
    maxBytes: 5 * 1024 * 1024, // 5MB
    minWidth: 600,
    minHeight: 750,
    recommendedWidth: 1200,
    recommendedHeight: 1500,
    aspectRatio: {
      target: 4 / 5,
      min: 0.65,
      max: 0.95,
    },
    svgAllowed: false,
    transparencyPreferred: false,
    requirementText: "Portrait (4:5) · WebP, JPG, PNG · Min 600×750, Recommended 1200×1500 · Max 5 MB",
  },
};

export function getMediaContract(intentKey: MarketingMediaIntentKey): MarketingMediaContract {
  return MARKETING_MEDIA_CONTRACTS[intentKey];
}

export type MediaValidationResult = {
  isValid: boolean;
  error?: string;
  reason?: string;
  width?: number;
  height?: number;
  format?: string;
  byteSize?: number;
};

/**
 * Server-side authoritative validation using sharp for decoded dimensions, format, and aspect ratio.
 */


/**
 * Evaluates an existing MarketingMediaAssetRow against a media contract.
 * If historical asset lacks width/height metadata, allows selection with warning unless MIME/ext is explicitly rejected.
 */
export function validateMediaAssetAgainstContract(
  asset: MarketingMediaAssetRow,
  contract: MarketingMediaContract
): { isCompatible: boolean; reason?: string } {
  const url = (asset.public_url || asset.bucket_path || "").toLowerCase();

  // Extension check
  const hasAllowedExt = contract.allowedExtensions.some((ext) => url.endsWith(ext));
  const isSvg = url.endsWith(".svg");

  if (isSvg && !contract.svgAllowed) {
    return { isCompatible: false, reason: "SVG artwork not accepted for photos" };
  }

  if (!isSvg && !hasAllowedExt && !contract.svgAllowed) {
    return { isCompatible: false, reason: `Requires ${contract.allowedExtensions.join(", ")}` };
  }

  const meta = (asset.metadata || {}) as Record<string, unknown>;
  const mimeType = typeof meta.mimeType === "string" ? meta.mimeType : undefined;
  if (mimeType && !contract.allowedMimeTypes.includes(mimeType)) {
    return { isCompatible: false, reason: `Unsupported format (${mimeType})` };
  }

  const width = typeof meta.width === "number" ? meta.width : undefined;
  const height = typeof meta.height === "number" ? meta.height : undefined;

  if (width && height && !isSvg) {
    if (width < contract.minWidth || height < contract.minHeight) {
      return {
        isCompatible: false,
        reason: `Too small (${width}×${height}px, min ${contract.minWidth}×${contract.minHeight}px)`,
      };
    }

    const ratio = width / height;
    if (ratio < contract.aspectRatio.min || ratio > contract.aspectRatio.max) {
      return {
        isCompatible: false,
        reason: `Shape mismatch (target ratio ${contract.aspectRatio.target.toFixed(1)})`,
      };
    }
  }

  return { isCompatible: true };
}
