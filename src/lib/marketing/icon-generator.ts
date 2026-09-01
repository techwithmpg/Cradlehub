import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";
import { getMediaContract } from "@/lib/marketing/media-contracts";
import { validateMediaBuffer } from "@/lib/marketing/media-contracts-server";

export type GeneratedSiteIconPackage = {
  version: string;
  sourceUrl: string;
  sourceAssetId?: string | null;
  generationStatus: "idle" | "generating" | "ready" | "failed";
  generatedAt: string;
  icons: {
    icon16: string;
    icon32: string;
    icon48: string;
    apple180: string;
    icon192: string;
    icon512: string;
    maskable512: string;
  };
};

export type IconVariantDefinition = {
  name: keyof GeneratedSiteIconPackage["icons"];
  filename: string;
  size: number;
  isMaskable?: boolean;
};

export const SITE_ICON_VARIANTS: readonly IconVariantDefinition[] = [
  { name: "icon16", filename: "icon-16.png", size: 16 },
  { name: "icon32", filename: "icon-32.png", size: 32 },
  { name: "icon48", filename: "icon-48.png", size: 48 },
  { name: "apple180", filename: "apple-touch-icon-180.png", size: 180 },
  { name: "icon192", filename: "icon-192.png", size: 192 },
  { name: "icon512", filename: "icon-512.png", size: 512 },
  { name: "maskable512", filename: "maskable-512.png", size: 512, isMaskable: true },
] as const;

const PUBLIC_MEDIA_BUCKET = "public-site-media";

/**
 * Normalizes input image buffer to a square 1024x1024 PNG canvas with transparent padding if needed.
 */
export async function normalizeToSquareMaster(
  buffer: Buffer,
  isSvg: boolean
): Promise<{ buffer: Buffer; format: string }> {
  if (isSvg) {
    // High-res SVG rasterization to 1024x1024
    const pngBuffer = await sharp(buffer, { density: 300 })
      .resize(1024, 1024, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    return { buffer: pngBuffer, format: "png" };
  }

  const image = sharp(buffer);
  const meta = await image.metadata();
  const width = meta.width || 1024;
  const height = meta.height || 1024;

  const maxDim = Math.max(width, height, 1024);

  const pngBuffer = await image
    .resize(maxDim, maxDim, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return { buffer: pngBuffer, format: "png" };
}

/**
 * Authoritative server-side generation of complete site icon package from a master image buffer.
 * Fails closed if any required variant cannot be generated or uploaded.
 */
export async function generateSiteIconPackageFromBuffer({
  masterBuffer,
  declaredMime,
  sourceUrl,
  sourceAssetId,
  customVersion,
}: {
  masterBuffer: Buffer;
  declaredMime: string;
  sourceUrl: string;
  sourceAssetId?: string | null;
  customVersion?: string;
}): Promise<{ success: boolean; package?: GeneratedSiteIconPackage; error?: string }> {
  // 1. Authoritative Validation
  const contract = getMediaContract("SITE_ICON_MASTER");
  const validation = await validateMediaBuffer(masterBuffer, declaredMime, contract);

  if (!validation.isValid) {
    return { success: false, error: validation.error || "Master brand icon failed validation." };
  }

  const isSvg =
    declaredMime === "image/svg+xml" ||
    masterBuffer.slice(0, 100).toString("utf-8").toLowerCase().includes("<svg");

  try {
    // 2. Normalize Master to 1024x1024 square canvas
    const { buffer: squareMaster } = await normalizeToSquareMaster(masterBuffer, isSvg);

    const version = customVersion || `v${Date.now()}`;
    const generatedAt = new Date().toISOString();

    const iconsMap: Partial<Record<keyof GeneratedSiteIconPackage["icons"], string>> = {};
    let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
    try {
      supabase = await createClient();
    } catch {
      // Test environment
    }

    // 3. Generate and upload all variants
    for (const variant of SITE_ICON_VARIANTS) {
      let variantBuffer: Buffer;

      if (variant.isMaskable) {
        // Maskable icon: contains the logo inside safe area (80% of canvas, padded by 10% on each side)
        const innerSize = Math.round(variant.size * 0.8);
        const padding = Math.round(variant.size * 0.1);

        const innerBuffer = await sharp(squareMaster)
          .resize(innerSize, innerSize, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer();

        variantBuffer = await sharp({
          create: {
            width: variant.size,
            height: variant.size,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          },
        })
          .composite([{ input: innerBuffer, top: padding, left: padding }])
          .png()
          .toBuffer();
      } else {
        variantBuffer = await sharp(squareMaster)
          .resize(variant.size, variant.size, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer();
      }

      const storagePath = `brand/site-icon/${version}/${variant.filename}`;

      if (supabase?.storage) {
        const { error: uploadError } = await supabase.storage
          .from(PUBLIC_MEDIA_BUCKET)
          .upload(storagePath, variantBuffer, {
            contentType: "image/png",
            upsert: true,
          });

        if (uploadError) {
          logError("marketing.site_icon_variant_upload_failed", {
            error: uploadError,
            storagePath,
          });
          return {
            success: false,
            error: `Storage upload failed for ${variant.filename}: ${uploadError.message}`,
          };
        }

        const { data } = supabase.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(storagePath);
        if (!data?.publicUrl) {
          return {
            success: false,
            error: `Could not resolve public URL for ${variant.filename}`,
          };
        }
        iconsMap[variant.name] = data.publicUrl;
      } else {
        // Fallback in test-only environment
        if (process.env.NODE_ENV === "test") {
          iconsMap[variant.name] = `/brand/site-icon/${version}/${variant.filename}`;
        } else {
          return {
            success: false,
            error: `Storage client unavailable to store variant ${variant.filename}`,
          };
        }
      }
    }

    // Fail closed if any required variant is missing
    const requiredKeys: (keyof GeneratedSiteIconPackage["icons"])[] = [
      "icon16",
      "icon32",
      "icon48",
      "apple180",
      "icon192",
      "icon512",
      "maskable512",
    ];

    for (const key of requiredKeys) {
      if (!iconsMap[key]) {
        return {
          success: false,
          error: `Required icon variant '${key}' failed to generate or upload.`,
        };
      }
    }

    const completePackage: GeneratedSiteIconPackage = {
      version,
      sourceUrl,
      sourceAssetId: sourceAssetId || null,
      generationStatus: "ready",
      generatedAt,
      icons: {
        icon16: iconsMap.icon16!,
        icon32: iconsMap.icon32!,
        icon48: iconsMap.icon48!,
        apple180: iconsMap.apple180!,
        icon192: iconsMap.icon192!,
        icon512: iconsMap.icon512!,
        maskable512: iconsMap.maskable512!,
      },
    };

    return {
      success: true,
      package: completePackage,
    };
  } catch (err) {
    logError("marketing.site_icon_generation_exception", { error: err });
    return {
      success: false,
      error: `Site icon generation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}
