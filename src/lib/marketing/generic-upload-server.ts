import "server-only";
import sharp from "sharp";

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const MAX_SIDE = 8192;
const MAX_OUTPUT_SIDE = 2400;
const ACCEPTED_FORMATS: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export type ProcessedMarketingImage = {
  buffer: Buffer;
  mimeType: "image/webp";
  width: number;
  height: number;
  format: "webp";
};

/** Decode and re-encode generic uploads so the public object has no original EXIF/GPS data. */
export async function processGenericMarketingImage(
  input: Buffer,
  declaredMime: string
): Promise<ProcessedMarketingImage> {
  if (input.length === 0 || input.length > MAX_SOURCE_BYTES) {
    throw new Error("Image must be nonempty and no larger than 10 MB.");
  }

  const source = sharp(input, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS });
  const metadata = await source.metadata();
  const actualMime = metadata.format ? ACCEPTED_FORMATS[metadata.format] : undefined;
  const normalizedDeclaredMime = declaredMime.toLowerCase() === "image/jpg" ? "image/jpeg" : declaredMime.toLowerCase();

  if (!actualMime || actualMime !== normalizedDeclaredMime || metadata.pages && metadata.pages > 1) {
    throw new Error("Upload a valid JPG, PNG, or WebP image whose file content matches its type.");
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width < 32 || height < 32 || width > MAX_SIDE || height > MAX_SIDE) {
    throw new Error("Image dimensions must be between 32 and 8192 pixels on each side.");
  }

  const buffer = await source
    .rotate()
    .resize({ width: MAX_OUTPUT_SIDE, height: MAX_OUTPUT_SIDE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
  const output = await sharp(buffer).metadata();
  if (!output.width || !output.height || output.exif) {
    throw new Error("Could not create a safe public image derivative.");
  }

  return {
    buffer,
    mimeType: "image/webp",
    width: output.width,
    height: output.height,
    format: "webp",
  };
}
