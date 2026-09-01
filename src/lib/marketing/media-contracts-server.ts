import "server-only";
import sharp from "sharp";
import {
  type MarketingMediaContract,
  type MediaValidationResult,
} from "./media-contracts";

/**
 * Validates that an SVG does not contain embedded executable scripts, event handlers, or unsafe tags.
 */
function sanitizeSvgCheck(content: string): { isSafe: boolean; reason?: string } {
  const lower = content.toLowerCase();
  const dangerousPatterns = [
    "<script",
    "javascript:",
    "onload=",
    "onerror=",
    "onclick=",
    "onmouseover=",
    "<foreignobject",
    "<iframe",
    "<embed",
    "<object",
  ];

  for (const pattern of dangerousPatterns) {
    if (lower.includes(pattern)) {
      return {
        isSafe: false,
        reason: `SVG contains prohibited executable element or attribute (${pattern.replace(/[<=]/g, "")}).`,
      };
    }
  }

  return { isSafe: true };
}

/**
 * Server-side Sharp-based buffer validation for uploaded images.
 * Enforces file size limits, MIME types, decodability, resolution, and aspect ratio.
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
      byteSize: buffer.length,
    };
  }

  const rawHead = buffer.toString("utf8", 0, Math.min(buffer.length, 512)).toLowerCase();
  const isSvg = declaredMime === "image/svg+xml" || rawHead.includes("<svg") || rawHead.includes("<?xml");

  if (isSvg) {
    if (!contract.svgAllowed) {
      return {
        isValid: false,
        error: "Vector SVG format is not allowed for this photography field. Please upload a WebP, JPG, or PNG image.",
        reason: "SVG not allowed",
        byteSize: buffer.length,
      };
    }

    const svgString = buffer.toString("utf8");
    const safety = sanitizeSvgCheck(svgString);
    if (!safety.isSafe) {
      return {
        isValid: false,
        error: `Security validation failed: ${safety.reason}`,
        reason: "Malicious or unsafe SVG",
        byteSize: buffer.length,
      };
    }

    try {
      const metadata = await sharp(buffer).metadata();
      if (metadata.format !== "svg") {
        return {
          isValid: false,
          error: "Corrupt or unreadable SVG artwork.",
          reason: "Corrupt SVG",
          byteSize: buffer.length,
        };
      }

      const width = metadata.width || 0;
      const height = metadata.height || 0;

      // If dimensions exist in viewBox or attributes, check aspect ratio
      if (width > 0 && height > 0) {
        const ratio = width / height;
        if (ratio < contract.aspectRatio.min || ratio > contract.aspectRatio.max) {
          return {
            isValid: false,
            error: `SVG aspect ratio (${ratio.toFixed(2)}) does not match the expected shape (target: ${contract.aspectRatio.target.toFixed(2)}).`,
            reason: `Incorrect aspect ratio (${ratio.toFixed(2)})`,
            width,
            height,
            format: "svg",
            byteSize: buffer.length,
          };
        }
      }

      return {
        isValid: true,
        width: width || undefined,
        height: height || undefined,
        format: "svg",
        byteSize: buffer.length,
      };
    } catch (err) {
      return {
        isValid: false,
        error: `Could not parse or decode SVG artwork: ${err instanceof Error ? err.message : "Corrupt SVG"}`,
        reason: "Corrupt or invalid SVG",
        byteSize: buffer.length,
      };
    }
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
        byteSize: buffer.length,
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
        byteSize: buffer.length,
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
        byteSize: buffer.length,
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
      byteSize: buffer.length,
    };
  }
}
