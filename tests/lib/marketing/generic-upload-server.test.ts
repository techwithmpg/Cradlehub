import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));

import { processGenericMarketingImage } from "@/lib/marketing/generic-upload-server";

describe("generic Marketing upload security boundary", () => {
  it("decodes and re-encodes a raster upload without public EXIF metadata", async () => {
    const source = await sharp({
      create: { width: 3000, height: 1800, channels: 3, background: "#163a2b" },
    })
      .withExif({ IFD0: { Copyright: "Test source" } })
      .jpeg()
      .toBuffer();

    const result = await processGenericMarketingImage(source, "image/jpeg");
    const metadata = await sharp(result.buffer).metadata();

    expect(result.mimeType).toBe("image/webp");
    expect(result.width).toBe(2400);
    expect(result.height).toBe(1440);
    expect(metadata.exif).toBeUndefined();
  });

  it("rejects MIME spoofing, SVG, GIF, and undecodable bytes", async () => {
    const png = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "#163a2b" },
    }).png().toBuffer();
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>');
    const gif = await sharp(png).gif().toBuffer();

    await expect(processGenericMarketingImage(png, "image/jpeg")).rejects.toThrow("matches its type");
    await expect(processGenericMarketingImage(svg, "image/svg+xml")).rejects.toThrow("JPG, PNG, or WebP");
    await expect(processGenericMarketingImage(gif, "image/gif")).rejects.toThrow("JPG, PNG, or WebP");
    await expect(processGenericMarketingImage(Buffer.from("not an image"), "image/png")).rejects.toThrow();
  });

  it("rejects input dimensions outside the allowed range", async () => {
    const tiny = await sharp({
      create: { width: 16, height: 16, channels: 3, background: "#163a2b" },
    }).png().toBuffer();
    await expect(processGenericMarketingImage(tiny, "image/png")).rejects.toThrow("dimensions");
  });
});
