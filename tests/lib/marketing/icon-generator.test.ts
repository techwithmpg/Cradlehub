import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import sharp from "sharp";
import {
  generateSiteIconPackageFromBuffer,
  normalizeToSquareMaster,
  SITE_ICON_VARIANTS,
} from "@/lib/marketing/icon-generator";

describe("Dynamic Site Icon Generator", () => {
  it("normalizes raster and vector images into a square 1024x1024 master canvas", async () => {
    // 1. Non-square raster image
    const rectBuffer = await sharp({
      create: {
        width: 1200,
        height: 600,
        channels: 4,
        background: { r: 16, g: 38, b: 29, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const { buffer: squareMaster } = await normalizeToSquareMaster(rectBuffer, false);
    const meta = await sharp(squareMaster).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(1200);

    // 2. SVG rasterization
    const svgBuffer = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#C8A96B"/></svg>`
    );
    const { buffer: svgMaster } = await normalizeToSquareMaster(svgBuffer, true);
    const svgMeta = await sharp(svgMaster).metadata();
    expect(svgMeta.width).toBe(1024);
    expect(svgMeta.height).toBe(1024);
  });

  it("defines all 7 required PNG icon variants without fake ICO generation", () => {
    expect(SITE_ICON_VARIANTS.length).toBe(7);
    const names = SITE_ICON_VARIANTS.map((v) => v.name);
    expect(names).toEqual([
      "icon16",
      "icon32",
      "icon48",
      "apple180",
      "icon192",
      "icon512",
      "maskable512",
    ]);
  });

  it("generates a complete site icon package from a valid 512x512 master PNG buffer in test environment", async () => {
    const masterBuffer = await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: { r: 200, g: 169, b: 107, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const result = await generateSiteIconPackageFromBuffer({
      masterBuffer,
      declaredMime: "image/png",
      sourceUrl: "https://example.com/brand-master.png",
      sourceAssetId: "asset-uuid-123",
      customVersion: "vtest123",
    });

    expect(result.success).toBe(true);
    expect(result.package).toBeDefined();
    if (!result.package) return;

    expect(result.package.version).toBe("vtest123");
    expect(result.package.sourceAssetId).toBe("asset-uuid-123");
    expect(result.package.generationStatus).toBe("ready");
    expect(result.package.icons.icon16).toBeTruthy();
    expect(result.package.icons.icon32).toBeTruthy();
    expect(result.package.icons.icon48).toBeTruthy();
    expect(result.package.icons.apple180).toBeTruthy();
    expect(result.package.icons.icon192).toBeTruthy();
    expect(result.package.icons.icon512).toBeTruthy();
    expect(result.package.icons.maskable512).toBeTruthy();
  });

  it("fails gracefully and returns validation error for undersized source image", async () => {
    const smallBuffer = await sharp({
      create: {
        width: 256,
        height: 256,
        channels: 4,
        background: { r: 200, g: 169, b: 107, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const result = await generateSiteIconPackageFromBuffer({
      masterBuffer: smallBuffer,
      declaredMime: "image/png",
      sourceUrl: "https://example.com/small.png",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("below the minimum requirement");
    expect(result.package).toBeUndefined();
  });

  it("attempts cleanup of newly created objects if storage upload fails midway", async () => {
    const mockRemove = vi.fn().mockResolvedValue({ error: null });
    let uploadCallCount = 0;
    const mockUpload = vi.fn().mockImplementation(() => {
      uploadCallCount++;
      if (uploadCallCount === 2) {
        return Promise.resolve({ error: { message: "Simulated Storage Failure" } });
      }
      return Promise.resolve({ error: null });
    });

    const mockSupabase = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          getPublicUrl: vi
            .fn()
            .mockReturnValue({ data: { publicUrl: "https://storage/variant.png" } }),
          remove: mockRemove,
        }),
      },
    };

    const masterBuffer = await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: { r: 200, g: 169, b: 107, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const result = await generateSiteIconPackageFromBuffer({
      masterBuffer,
      declaredMime: "image/png",
      sourceUrl: "https://example.com/brand-master.png",
      sourceAssetId: "asset-uuid-123",
      supabase: mockSupabase as never,
      customVersion: "vtest-cleanup",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Storage upload failed");
    expect(mockRemove).toHaveBeenCalledWith(
      expect.arrayContaining(["brand/site-icon/vtest-cleanup/icon-16.png"])
    );
  });
});
