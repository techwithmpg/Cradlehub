import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

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

  it("BRANCH_PHOTO contract rejects SVG and GIF formats", async () => {
    const branchContract = getMediaContract("BRANCH_PHOTO");

    // 1. SVG rejected for BRANCH_PHOTO
    const svgBuffer = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450"><rect width="800" height="450" fill="#0D2B20"/></svg>`
    );
    const svgResult = await validateMediaBuffer(svgBuffer, "image/svg+xml", branchContract);
    expect(svgResult.isValid).toBe(false);
    expect(svgResult.error).toContain("Vector SVG format is not allowed");

    // 2. GIF rejected for BRANCH_PHOTO
    const gifBuffer = await sharp({
      create: {
        width: 800,
        height: 450,
        channels: 4,
        background: { r: 13, g: 43, b: 32, alpha: 1 },
      },
    })
      .gif()
      .toBuffer();
    const gifResult = await validateMediaBuffer(gifBuffer, "image/gif", branchContract);
    expect(gifResult.isValid).toBe(false);
    expect(gifResult.error).toContain("not supported");
  });

  it("HEADER_LOGO contract rejects JPG and requires SVG, PNG, or WebP with transparency", async () => {
    const headerLogoContract = getMediaContract("HEADER_LOGO");

    const jpgBuffer = await sharp({
      create: {
        width: 800,
        height: 200,
        channels: 3,
        background: { r: 13, g: 43, b: 32 },
      },
    })
      .jpeg()
      .toBuffer();

    const jpgResult = await validateMediaBuffer(jpgBuffer, "image/jpeg", headerLogoContract);
    expect(jpgResult.isValid).toBe(false);
    expect(jpgResult.error).toContain("not supported");
  });

  it("validates safe SVG assets and rejects malicious or corrupt SVGs", async () => {
    const contract = getMediaContract("SITE_ICON_MASTER");

    // 1. Safe valid SVG
    const safeSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="200" fill="#C8A96B"/></svg>`
    );
    const safeResult = await validateMediaBuffer(safeSvg, "image/svg+xml", contract);
    expect(safeResult.isValid).toBe(true);

    // 2. Malicious SVG with embedded <script>
    const maliciousScriptSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><script>alert('xss')</script><circle cx="256" cy="256" r="200" fill="#C8A96B"/></svg>`
    );
    const scriptResult = await validateMediaBuffer(maliciousScriptSvg, "image/svg+xml", contract);
    expect(scriptResult.isValid).toBe(false);
    expect(scriptResult.error).toContain("Security validation failed");

    // 3. Malicious SVG with onload attribute
    const maliciousOnloadSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" onload="fetch('https://evil.com')"><circle cx="256" cy="256" r="200" fill="#C8A96B"/></svg>`
    );
    const onloadResult = await validateMediaBuffer(maliciousOnloadSvg, "image/svg+xml", contract);
    expect(onloadResult.isValid).toBe(false);
    expect(onloadResult.error).toContain("Security validation failed");

    // 4. Corrupt unparseable SVG
    const corruptSvg = Buffer.from("<svg>this is not valid xml <><<<<");
    const corruptResult = await validateMediaBuffer(corruptSvg, "image/svg+xml", contract);
    expect(corruptResult.isValid).toBe(false);
    expect(corruptResult.error).toContain("Could not parse or decode SVG artwork");
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
