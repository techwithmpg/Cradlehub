import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  getMediaContract,
  validateMediaAssetAgainstContract,
  type MarketingMediaIntentKey,
} from "@/lib/marketing/media-contracts";
import { validateMediaBuffer } from "@/lib/marketing/media-contracts-server";
import type { MarketingMediaAssetRow } from "@/lib/queries/marketing-media";

describe("Marketing Media Contracts System", () => {
  it("defines all 8 required media intent contracts with human-readable requirement texts", () => {
    const requiredIntents: MarketingMediaIntentKey[] = [
      "HEADER_LOGO",
      "FOOTER_LOGO",
      "BRAND_MARK",
      "SITE_ICON_MASTER",
      "BRANCH_PHOTO",
      "SERVICE_PHOTO",
      "HERO_BACKGROUND",
      "FEATURE_PORTRAIT",
    ];

    for (const intent of requiredIntents) {
      const contract = getMediaContract(intent);
      expect(contract).toBeDefined();
      expect(contract.id).toBe(intent);
      expect(contract.requirementText).toBeTruthy();
      expect(contract.allowedMimeTypes.length).toBeGreaterThan(0);
      expect(contract.maxBytes).toBeGreaterThan(0);
    }
  });

  it("validates compliant and non-compliant media buffers via sharp server validation", async () => {
    const brandMarkContract = getMediaContract("BRAND_MARK");

    // 1. Valid 512x512 PNG
    const validPng = await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: { r: 200, g: 169, b: 107, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const validResult = await validateMediaBuffer(validPng, "image/png", brandMarkContract);
    expect(validResult.isValid).toBe(true);

    // 2. Invalid Undersized (100x100 for min 512)
    const smallPng = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 200, g: 169, b: 107, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const smallResult = await validateMediaBuffer(smallPng, "image/png", brandMarkContract);
    expect(smallResult.isValid).toBe(false);
    expect(smallResult.error).toContain("below the minimum");

    // 3. Invalid Non-Square (1000x600 for square contract)
    const nonSquarePng = await sharp({
      create: {
        width: 1000,
        height: 600,
        channels: 4,
        background: { r: 200, g: 169, b: 107, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const nonSquareResult = await validateMediaBuffer(nonSquarePng, "image/png", brandMarkContract);
    expect(nonSquareResult.isValid).toBe(false);
    expect(nonSquareResult.error).toContain("aspect ratio");
  });

  it("validates SVG assets gracefully regardless of fixed raster dimensions", async () => {
    const svgBuffer = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#C8A96B"/></svg>`
    );

    const contract = getMediaContract("SITE_ICON_MASTER");
    const result = await validateMediaBuffer(svgBuffer, "image/svg+xml", contract);
    expect(result.isValid).toBe(true);
  });

  it("evaluates compatibility on media library asset rows and tolerates legacy untracked assets", () => {
    const branchContract = getMediaContract("BRANCH_PHOTO");

    // 1. Fully metadata-tracked compliant asset
    const goodAsset: MarketingMediaAssetRow = {
      id: "asset-1",
      bucket_path: "media/branch-main.webp",
      public_url: "https://example.com/branch-main.webp",
      title: "Main Branch",
      alt_text: "Main Branch Spa",
      section_key: "branches",
      content_key: null,
      status: "published",
      metadata: {
        mimeType: "image/webp",
        width: 1600,
        height: 900,
        sizeBytes: 450000,
      },
      created_by: null,
      updated_by: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const goodCheck = validateMediaAssetAgainstContract(goodAsset, branchContract);
    expect(goodCheck.isCompatible).toBe(true);

    // 2. Incompatible format (e.g. text or audio)
    const badMimeAsset: MarketingMediaAssetRow = {
      ...goodAsset,
      id: "asset-2",
      metadata: {
        mimeType: "application/pdf",
      },
    };

    const badMimeCheck = validateMediaAssetAgainstContract(badMimeAsset, branchContract);
    expect(badMimeCheck.isCompatible).toBe(false);

    // 3. Untracked legacy asset (missing metadata dimensions) is tolerated
    const legacyAsset: MarketingMediaAssetRow = {
      ...goodAsset,
      id: "asset-3",
      metadata: {},
    };

    const legacyCheck = validateMediaAssetAgainstContract(legacyAsset, branchContract);
    expect(legacyCheck.isCompatible).toBe(true);
  });
});
