import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

import {
  REQUIRED_SITE_ICON_VARIANTS,
  validateTrustedSiteIconPackage,
} from "@/lib/marketing/icon-package-validator";

const VALID_VERSION = "v2026-09-02";
const VALID_ASSET_ID = "asset-uuid-1234";
const AUTHENTIC_PROJECT_DOMAIN = "lsrbwqhvzjfpiabeolkv.supabase.co";

const ALL_SEVEN_FILES = Object.values(REQUIRED_SITE_ICON_VARIANTS);

function createMockSupabase(
  assetData: Record<string, unknown> | null = null,
  storageFiles: string[] = ALL_SEVEN_FILES,
  storageListError: { message: string } | null = null
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
      from: vi.fn((bucket: string) => ({
        list: vi.fn().mockResolvedValue({
          data: storageListError ? null : storageFiles.map((name) => ({ name })),
          error: storageListError,
        }),
        getPublicUrl: vi.fn((path: string) => ({
          data: {
            publicUrl: `https://${AUTHENTIC_PROJECT_DOMAIN}/storage/v1/object/public/${bucket}/${path}`,
          },
        })),
      })),
    },
  } as never;
}

function getValidPackage() {
  return {
    version: VALID_VERSION,
    sourceUrl: `https://${AUTHENTIC_PROJECT_DOMAIN}/storage/v1/object/public/public-site-media/media/master.png`,
    sourceAssetId: VALID_ASSET_ID,
    generationStatus: "ready",
    generatedAt: new Date().toISOString(),
    icons: {
      icon16: `https://${AUTHENTIC_PROJECT_DOMAIN}/storage/v1/object/public/public-site-media/brand/site-icon/${VALID_VERSION}/icon-16.png`,
      icon32: `https://${AUTHENTIC_PROJECT_DOMAIN}/storage/v1/object/public/public-site-media/brand/site-icon/${VALID_VERSION}/icon-32.png`,
      icon48: `https://${AUTHENTIC_PROJECT_DOMAIN}/storage/v1/object/public/public-site-media/brand/site-icon/${VALID_VERSION}/icon-48.png`,
      apple180: `https://${AUTHENTIC_PROJECT_DOMAIN}/storage/v1/object/public/public-site-media/brand/site-icon/${VALID_VERSION}/apple-touch-icon-180.png`,
      icon192: `https://${AUTHENTIC_PROJECT_DOMAIN}/storage/v1/object/public/public-site-media/brand/site-icon/${VALID_VERSION}/icon-192.png`,
      icon512: `https://${AUTHENTIC_PROJECT_DOMAIN}/storage/v1/object/public/public-site-media/brand/site-icon/${VALID_VERSION}/icon-512.png`,
      maskable512: `https://${AUTHENTIC_PROJECT_DOMAIN}/storage/v1/object/public/public-site-media/brand/site-icon/${VALID_VERSION}/maskable-512.png`,
    },
  };
}

describe("validateTrustedSiteIconPackage (Authoritative Server-Side Validator)", () => {
  it("accepts a fully compliant package with active master asset, matching project URLs, and 7 present files", async () => {
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
    expect(result.validatedPackage?.icons.icon16).toContain(AUTHENTIC_PROJECT_DOMAIN);
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
    const mockSupabase = createMockSupabase(null);
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

  it("rejects foreign Supabase projects even with valid bucket and paths (Regression Test)", async () => {
    const mockSupabase = createMockSupabase({
      id: VALID_ASSET_ID,
      status: "published",
      bucket_path: "media/master.png",
    });

    const pkg = getValidPackage();
    // Foreign attacker project URL
    pkg.icons.icon32 = `https://attacker-project.supabase.co/storage/v1/object/public/public-site-media/brand/site-icon/${VALID_VERSION}/icon-32.png`;

    const result = await validateTrustedSiteIconPackage(pkg, mockSupabase);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("contains untrusted or foreign project URL");
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
    expect(result.error).toContain("contains untrusted or foreign project URL");
  });

  it("rejects mismatched version or filename in icon URLs", async () => {
    const mockSupabase = createMockSupabase({
      id: VALID_ASSET_ID,
      status: "published",
      bucket_path: "media/master.png",
    });

    const pkg = getValidPackage();
    // Wrong version in URL path
    pkg.icons.icon16 = `https://${AUTHENTIC_PROJECT_DOMAIN}/storage/v1/object/public/public-site-media/brand/site-icon/other-version/icon-16.png`;

    const result = await validateTrustedSiteIconPackage(pkg, mockSupabase);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("untrusted or foreign project URL");
  });

  it("rejects if any of the 7 required variants is missing from payload", async () => {
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

  describe("Storage Presence Fail-Closed Verification", () => {
    it("rejects when storage list returns an error", async () => {
      const mockSupabase = createMockSupabase(
        {
          id: VALID_ASSET_ID,
          status: "published",
          bucket_path: "media/master.png",
        },
        [],
        { message: "Network error listing storage objects" }
      );

      const result = await validateTrustedSiteIconPackage(getValidPackage(), mockSupabase);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain(
        "Storage verification failed: Network error listing storage objects"
      );
    });

    it("rejects when storage directory is empty", async () => {
      const mockSupabase = createMockSupabase(
        {
          id: VALID_ASSET_ID,
          status: "published",
          bucket_path: "media/master.png",
        },
        [] // empty directory
      );

      const result = await validateTrustedSiteIconPackage(getValidPackage(), mockSupabase);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("directory 'brand/site-icon/v2026-09-02' is empty");
    });

    it("rejects when one of the seven required variants is missing from storage", async () => {
      const missingMaskable = ALL_SEVEN_FILES.filter((f) => f !== "maskable-512.png");
      const mockSupabase = createMockSupabase(
        {
          id: VALID_ASSET_ID,
          status: "published",
          bucket_path: "media/master.png",
        },
        missingMaskable
      );

      const result = await validateTrustedSiteIconPackage(getValidPackage(), mockSupabase);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain(
        "Storage verification failed: missing object 'maskable-512.png' for variant 'maskable512'"
      );
    });

    it("accepts when all seven variants are present in storage", async () => {
      const mockSupabase = createMockSupabase(
        {
          id: VALID_ASSET_ID,
          status: "published",
          bucket_path: "media/master.png",
        },
        ALL_SEVEN_FILES
      );

      const result = await validateTrustedSiteIconPackage(getValidPackage(), mockSupabase);
      expect(result.isValid).toBe(true);
      expect(result.validatedPackage).toBeDefined();
    });
  });

  describe("updateBrandSettingsBatchOwner (Persist Only Validated Package)", () => {
    it("persists only the normalized validatedPackage and strips extraneous raw JSON", async () => {
      const { updateBrandSettingsBatchOwner } = await import("@/lib/queries/marketing-brand");

      const rawPackageWithExtraKeys = {
        ...getValidPackage(),
        extraAttackPayload: "malicious_script_data",
        arbitraryUnsafeField: 12345,
      };

      const mockUpsert = vi.fn().mockResolvedValue({ error: null });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "owner-user-123" } },
          }),
        },
        from: vi.fn((table: string) => {
          if (table === "staff") {
            const staffQuery: Record<string, unknown> = {};
            staffQuery.eq = vi.fn().mockReturnValue(staffQuery);
            staffQuery.maybeSingle = vi.fn().mockResolvedValue({
              data: { id: "owner-staff-123", system_role: "owner" },
              error: null,
            });
            return {
              select: vi.fn().mockReturnValue(staffQuery),
            };
          }
          if (table === "marketing_media_assets") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: VALID_ASSET_ID,
                      status: "published",
                      bucket_path: "media/master.png",
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "marketing_brand_settings") {
            return {
              upsert: mockUpsert,
            };
          }
          return {};
        }),
        storage: {
          from: vi.fn((bucket: string) => ({
            list: vi.fn().mockResolvedValue({
              data: ALL_SEVEN_FILES.map((name) => ({ name })),
              error: null,
            }),
            getPublicUrl: vi.fn((path: string) => ({
              data: {
                publicUrl: `https://${AUTHENTIC_PROJECT_DOMAIN}/storage/v1/object/public/${bucket}/${path}`,
              },
            })),
          })),
        },
      };

      const result = await updateBrandSettingsBatchOwner(
        [
          {
            settingKey: "site_icon",
            label: "Site Icon",
            value: {
              url: rawPackageWithExtraKeys.icons.icon32,
              alt: "Custom Alt",
              package: rawPackageWithExtraKeys,
            },
          },
        ],
        mockSupabase as never
      );

      expect(result.success).toBe(true);
      expect(mockUpsert).toHaveBeenCalledTimes(1);

      const upsertedRows = mockUpsert.mock.calls[0]?.[0];
      expect(upsertedRows).toBeDefined();
      expect(upsertedRows).toHaveLength(1);

      const persistedValue = (
        upsertedRows?.[0] as {
          value: {
            package: {
              version: string;
              sourceAssetId: string;
              extraAttackPayload?: unknown;
              arbitraryUnsafeField?: unknown;
            };
          };
        }
      )?.value;
      expect(persistedValue.package).toBeDefined();
      expect(persistedValue.package.version).toBe(VALID_VERSION);
      expect(persistedValue.package.sourceAssetId).toBe(VALID_ASSET_ID);
      // Ensure extra arbitrary keys are stripped
      expect(persistedValue.package.extraAttackPayload).toBeUndefined();
      expect(persistedValue.package.arbitraryUnsafeField).toBeUndefined();
    });
  });
});
