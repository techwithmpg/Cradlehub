import "server-only";
import sharp from "sharp";
import {
  type MarketingMediaContract,
  type MediaValidationResult,
} from "./media-contracts";

/**
 * Server-side Sharp-based buffer validation for uploaded images.
 */
export async function validateMediaBuffer(
  buffer: Buffer,
  declaredMime: string,
  contract: MarketingMediaContract
): Promise<MediaValidationResult> {
  if (buffer.length > contract.maxBytes) {
    const mbLimit = (contract.maxBytes / (1024 * 1024)).toFixed(0);
    return {
      isValid: false,
      error: `File size exceeds the ${mbLimit} MB limit for this field.`,
      reason: `Exceeds max size (${mbLimit} MB)`,
    };
  }

  // Handle SVG directly
  if (declaredMime === "image/svg+xml" || contract.svgAllowed && buffer.toString("utf8", 0, 100).includes("<svg")) {
    if (!contract.svgAllowed) {
      return {
        isValid: false,
        error: "Vector SVG format is not allowed for this photography field.",
        reason: "SVG not allowed",
      };
    }
    return {
      isValid: true,
      format: "svg",
      byteSize: buffer.length,
    };
  }

  // Probe raster metadata with sharp
  try {
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const format = metadata.format || "";

    const mimeMap: Record<string, string> = {
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
      svg: "image/svg+xml",
      pdf: "application/pdf",
    };

    const actualMime = mimeMap[format] || declaredMime;

    if (!contract.allowedMimeTypes.includes(actualMime)) {
      return {
        isValid: false,
        error: `Format '${format.toUpperCase()}' is not supported for ${contract.purpose}. Allowed: ${contract.allowedExtensions.join(", ")}.`,
        reason: `Unsupported format (${format.toUpperCase()})`,
        format,
        width,
        height,
      };
    }

    if (width < contract.minWidth || height < contract.minHeight) {
      return {
        isValid: false,
        error: `Image resolution (${width}×${height}px) is below the minimum requirement of ${contract.minWidth}×${contract.minHeight}px.`,
        reason: `Below minimum (${contract.minWidth}×${contract.minHeight}px)`,
        width,
        height,
        format,
      };
    }

    const ratio = width / height;
    if (ratio < contract.aspectRatio.min || ratio > contract.aspectRatio.max) {
      return {
        isValid: false,
        error: `Image aspect ratio (${ratio.toFixed(2)}) does not match the expected shape (target: ${contract.aspectRatio.target.toFixed(2)}).`,
        reason: `Incorrect aspect ratio (${ratio.toFixed(2)})`,
        width,
        height,
        format,
      };
    }

    return {
      isValid: true,
      width,
      height,
      format,
      byteSize: buffer.length,
    };
  } catch (err) {
    return {
      isValid: false,
      error: `Could not decode image: ${err instanceof Error ? err.message : "Corrupt or invalid image file"}`,
      reason: "Corrupt or unreadable image",
    };
  }
}
