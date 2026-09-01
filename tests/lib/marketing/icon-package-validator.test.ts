import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { validateTrustedSiteIconPackage } from "@/lib/marketing/icon-package-validator";

function createMockSupabase(
  assetData: Record<string, unknown> | null = null,
  storageFiles: string[] = []
) {
  return {
    from: vi.fn((table: string) => {
      if (table === "marketing_media_assets") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: assetData,
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        list: vi.fn().mockResolvedValue({
          data: storageFiles.map((name) => ({ name })),
          error: null,
        }),
      }),
    },
  } as never;
}

const VALID_VERSION = "v2026-09-02";
const VALID_ASSET_ID = "asset-uuid-1234";

function getValidPackage() {
  return {
    version: VALID_VERSION,
    sourceUrl:
      "https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/media/master.png",
    sourceAssetId: VALID_ASSET_ID,
    generationStatus: "ready",
    generatedAt: new Date().toISOString(),
    icons: {
      icon16: `https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/brand/site-icon/${VALID_VERSION}/icon-16.png`,
      icon32: `https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/brand/site-icon/${VALID_VERSION}/icon-32.png`,
      icon48: `https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/brand/site-icon/${VALID_VERSION}/icon-48.png`,
      apple180: `https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/brand/site-icon/${VALID_VERSION}/apple-touch-icon-180.png`,
      icon192: `https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/brand/site-icon/${VALID_VERSION}/icon-192.png`,
      icon512: `https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/brand/site-icon/${VALID_VERSION}/icon-512.png`,
      maskable512: `https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/brand/site-icon/${VALID_VERSION}/maskable-512.png`,
    },
  };
}

describe("validateTrustedSiteIconPackage (Authoritative Server-Side Validator)", () => {
  it("accepts a fully compliant package with active master asset and authentic storage URLs", async () => {
    const mockSupabase = createMockSupabase({
      id: VALID_ASSET_ID,
      status: "published",
      bucket_path: "media/master.png",
    });

    const result = await validateTrustedSiteIconPackage(getValidPackage(), mockSupabase);

    expect(result.isValid).toBe(true);
    expect(result.validatedPackage).toBeDefined();
    expect(result.validatedPackage?.version).toBe(VALID_VERSION);
    expect(result.validatedPackage?.sourceAssetId).toBe(VALID_ASSET_ID);
  });

  it("rejects non-object, null, or array payloads", async () => {
    const mockSupabase = createMockSupabase();

    const resNull = await validateTrustedSiteIconPackage(null, mockSupabase);
    expect(resNull.isValid).toBe(false);
    expect(resNull.error).toContain("must be a non-null object");

    const resArray = await validateTrustedSiteIconPackage([], mockSupabase);
    expect(resArray.isValid).toBe(false);
  });

  it("rejects when generationStatus is not 'ready'", async () => {
    const mockSupabase = createMockSupabase();
    const pkg = { ...getValidPackage(), generationStatus: "failed" };

    const result = await validateTrustedSiteIconPackage(pkg, mockSupabase);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("generationStatus is 'failed', expected 'ready'");
  });

  it("rejects unsafe or invalid version formats", async () => {
    const mockSupabase = createMockSupabase();
    const pkg = { ...getValidPackage(), version: "../malicious/version" };

    const result = await validateTrustedSiteIconPackage(pkg, mockSupabase);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("must match");
  });

  it("rejects when sourceAssetId does not exist in Media Library", async () => {
    const mockSupabase = createMockSupabase(null); // Asset not found
    const pkg = getValidPackage();

    const result = await validateTrustedSiteIconPackage(pkg, mockSupabase);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("does not exist in Media Library");
  });

  it("rejects when sourceAsset is archived", async () => {
    const mockSupabase = createMockSupabase({
      id: VALID_ASSET_ID,
      status: "archived",
      bucket_path: "media/master.png",
    });

    const pkg = getValidPackage();
    const result = await validateTrustedSiteIconPackage(pkg, mockSupabase);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain("is archived and cannot be published");
  });

  it("rejects arbitrary external icon URLs", async () => {
    const mockSupabase = createMockSupabase({
      id: VALID_ASSET_ID,
      status: "published",
      bucket_path: "media/master.png",
    });

    const pkg = getValidPackage();
    pkg.icons.icon32 = "https://attacker.com/exploit-icon.png";

    const result = await validateTrustedSiteIconPackage(pkg, mockSupabase);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("contains untrusted or mismatched URL");
  });

  it("rejects mismatched version or filename in icon URLs", async () => {
    const mockSupabase = createMockSupabase({
      id: VALID_ASSET_ID,
      status: "published",
      bucket_path: "media/master.png",
    });

    const pkg = getValidPackage();
    // Swapped filename or wrong version subpath
    pkg.icons.icon16 = `https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/brand/site-icon/other-version/icon-16.png`;

    const result = await validateTrustedSiteIconPackage(pkg, mockSupabase);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("untrusted or mismatched URL");
  });

  it("rejects if any of the 7 required variants is missing", async () => {
    const mockSupabase = createMockSupabase({
      id: VALID_ASSET_ID,
      status: "published",
      bucket_path: "media/master.png",
    });

    const pkg = getValidPackage();
    delete (pkg.icons as Record<string, string | undefined>).maskable512;

    const result = await validateTrustedSiteIconPackage(pkg, mockSupabase);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("Missing required icon variant 'maskable512'");
  });
});
