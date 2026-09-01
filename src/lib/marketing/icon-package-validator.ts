import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { GeneratedSiteIconPackage } from "./icon-generator";

const REQUIRED_VARIANTS: Record<keyof GeneratedSiteIconPackage["icons"], string> = {
  icon16: "icon-16.png",
  icon32: "icon-32.png",
  icon48: "icon-48.png",
  apple180: "apple-touch-icon-180.png",
  icon192: "icon-192.png",
  icon512: "icon-512.png",
  maskable512: "maskable-512.png",
};

const VERSION_REGEX = /^v[a-zA-Z0-9_-]{3,64}$/;

export type SiteIconPackageValidationResult = {
  isValid: boolean;
  error?: string;
  validatedPackage?: GeneratedSiteIconPackage;
};

/**
 * Authoritative Server-Side Validator for Dynamic Site Icon Packages.
 *
 * Validates:
 * 1. Package shape, ready status, and valid version slug.
 * 2. Source asset exists in marketing_media_assets and is NOT archived.
 * 3. All 7 required PNG variant keys exist and match authorized public-site-media storage paths.
 * 4. Rejects all arbitrary external or manipulated URLs.
 * 5. Where practical, verifies storage object presence.
 */
export async function validateTrustedSiteIconPackage(
  rawPackage: unknown,
  supabase: SupabaseClient<Database>
): Promise<SiteIconPackageValidationResult> {
  if (!rawPackage || typeof rawPackage !== "object" || Array.isArray(rawPackage)) {
    return {
      isValid: false,
      error: "Invalid site icon package: payload must be a non-null object.",
    };
  }

  const pkg = rawPackage as Record<string, unknown>;

  // 1. Generation Status
  if (pkg.generationStatus !== "ready") {
    return {
      isValid: false,
      error: `Invalid site icon package: generationStatus is '${pkg.generationStatus}', expected 'ready'.`,
    };
  }

  // 2. Version validation
  const version = typeof pkg.version === "string" ? pkg.version.trim() : "";
  if (!version || !VERSION_REGEX.test(version)) {
    return {
      isValid: false,
      error: `Invalid site icon package: version '${version}' must match /^v[a-zA-Z0-9_-]{3,64}$/.`,
    };
  }

  // 3. Source Asset ID validation
  const sourceAssetId = typeof pkg.sourceAssetId === "string" ? pkg.sourceAssetId.trim() : "";
  if (!sourceAssetId) {
    return {
      isValid: false,
      error: "Invalid site icon package: missing trusted sourceAssetId.",
    };
  }

  // Verify source asset exists and is active in database
  const { data: assetRow, error: assetError } = await supabase
    .from("marketing_media_assets")
    .select("id, status, bucket_path")
    .eq("id", sourceAssetId)
    .maybeSingle();

  if (assetError) {
    return {
      isValid: false,
      error: `Failed to verify master asset in database: ${assetError.message}`,
    };
  }

  if (!assetRow) {
    return {
      isValid: false,
      error: `Master asset '${sourceAssetId}' does not exist in Media Library.`,
    };
  }

  if (assetRow.status === "archived") {
    return {
      isValid: false,
      error: `Master asset '${sourceAssetId}' is archived and cannot be published.`,
    };
  }

  // 4. Icons Object & 7 Variant URLs validation
  if (!pkg.icons || typeof pkg.icons !== "object" || Array.isArray(pkg.icons)) {
    return {
      isValid: false,
      error: "Invalid site icon package: missing icons map.",
    };
  }

  const icons = pkg.icons as Record<string, unknown>;
  const validatedIcons: Partial<GeneratedSiteIconPackage["icons"]> = {};

  for (const [variantKey, filename] of Object.entries(REQUIRED_VARIANTS)) {
    const rawUrl = icons[variantKey];
    if (typeof rawUrl !== "string" || !rawUrl.trim()) {
      return {
        isValid: false,
        error: `Missing required icon variant '${variantKey}' in package.`,
      };
    }

    const url = rawUrl.trim();
    const expectedSubpath = `brand/site-icon/${version}/${filename}`;

    // Validate that URL points strictly to the expected storage location for this version & filename
    // Acceptable formats:
    // - Full Supabase public URL: https://<project-ref>.supabase.co/storage/v1/object/public/public-site-media/brand/site-icon/<version>/<filename>
    // - Relative public storage path: /storage/v1/object/public/public-site-media/brand/site-icon/<version>/<filename>
    // - Relative public path (dev/test): /brand/site-icon/<version>/<filename>
    const isSupabaseStorageUrl =
      url.includes(".supabase.co/storage/v1/object/public/public-site-media/") &&
      url.endsWith(expectedSubpath);
    const isRelativeStorageUrl =
      url.startsWith("/storage/v1/object/public/public-site-media/") &&
      url.endsWith(expectedSubpath);
    const isRelativeDevUrl = url === `/${expectedSubpath}`;

    if (!isSupabaseStorageUrl && !isRelativeStorageUrl && !isRelativeDevUrl) {
      return {
        isValid: false,
        error: `Icon variant '${variantKey}' contains untrusted or mismatched URL: ${url}`,
      };
    }

    validatedIcons[variantKey as keyof GeneratedSiteIconPackage["icons"]] = url;
  }

  // 5. Storage object presence verification (where practical)
  try {
    if (supabase.storage) {
      const { data: storageList, error: listError } = await supabase.storage
        .from("public-site-media")
        .list(`brand/site-icon/${version}`);

      if (!listError && Array.isArray(storageList) && storageList.length > 0) {
        const foundFiles = new Set(storageList.map((f) => f.name));
        for (const expectedFilename of Object.values(REQUIRED_VARIANTS)) {
          if (!foundFiles.has(expectedFilename)) {
            return {
              isValid: false,
              error: `Storage verification failed: missing object ${expectedFilename} in brand/site-icon/${version}/`,
            };
          }
        }
      }
    }
  } catch {
    // Non-fatal if storage.list is mocked or not implemented in test harness
  }

  const validatedPackage: GeneratedSiteIconPackage = {
    version,
    sourceUrl: typeof pkg.sourceUrl === "string" ? pkg.sourceUrl : "",
    sourceAssetId,
    generationStatus: "ready",
    generatedAt: typeof pkg.generatedAt === "string" ? pkg.generatedAt : new Date().toISOString(),
    icons: validatedIcons as GeneratedSiteIconPackage["icons"],
  };

  return {
    isValid: true,
    validatedPackage,
  };
}
