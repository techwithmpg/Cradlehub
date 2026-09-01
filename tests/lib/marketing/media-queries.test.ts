import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const mockUser: { id: string } | null = { id: "user-123" };
let mockStaff: { id: string; system_role: string } | null = {
  id: "staff-dm",
  system_role: "digital_marketer",
};

let mockDbSelectData: unknown = null;
let mockDbSelectError: unknown = null;
let mockDbInsertData: unknown = null;
let mockDbInsertError: unknown = null;
let mockDbUpdateData: unknown = null;
let mockDbUpdateError: unknown = null;
let lastUpdatePayload: Record<string, unknown> | null = null;
let mockStorageUploadError: unknown = null;

let mockBrandError: unknown = null;
let mockSeoError: unknown = null;

const mockStorageUpload = vi.fn().mockImplementation(() => {
  return Promise.resolve({ error: mockStorageUploadError });
});

const mockStorageGetPublicUrl = vi.fn().mockImplementation((path: string) => ({
  data: { publicUrl: `https://example.com/storage/v1/object/public/public-site-media/${path}` },
}));

type MockQueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
};

const mockSupabase = {
  auth: {
    getUser: vi.fn().mockImplementation(() => Promise.resolve({ data: { user: mockUser } })),
  },
  from: vi.fn().mockImplementation((tableName: string) => {
    if (tableName === "staff") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi
          .fn()
          .mockImplementation(() => Promise.resolve({ data: mockStaff, error: null })),
      };
    }

    if (tableName === "marketing_brand_settings") {
      return {
        select: vi.fn().mockImplementation(() => {
          if (mockBrandError) {
            return Promise.resolve({ data: null, error: mockBrandError });
          }
          return Promise.resolve({
            data: [
              {
                id: "brand-1",
                setting_key: "brand_logo",
                label: "Logo",
                value: { url: "https://example.com/logo.jpg" },
                status: "published",
              },
            ],
            error: null,
          });
        }),
      };
    }

    if (tableName === "marketing_seo_settings") {
      return {
        select: vi.fn().mockImplementation(() => {
          if (mockSeoError) {
            return Promise.resolve({ data: null, error: mockSeoError });
          }
          return Promise.resolve({
            data: [
              {
                id: "seo-1",
                route_path: "/",
                title: "Home",
                og_image_url: "https://example.com/og.jpg",
                metadata: {},
                status: "published",
              },
            ],
            error: null,
          });
        }),
      };
    }

    const builder: MockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockImplementation(() =>
            Promise.resolve({ data: mockDbInsertData, error: mockDbInsertError })
          ),
      })),
      update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        lastUpdatePayload = payload;
        return {
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi
            .fn()
            .mockImplementation(() =>
              Promise.resolve({ data: mockDbUpdateData, error: mockDbUpdateError })
            ),
        };
      }),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ data: mockDbSelectData, error: mockDbSelectError })
        ),
      single: vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ data: mockDbSelectData, error: mockDbSelectError })
        ),
    };
    return builder;
  }),
  storage: {
    from: vi.fn().mockImplementation(() => ({
      upload: mockStorageUpload,
      getPublicUrl: mockStorageGetPublicUrl,
    })),
  },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(() => Promise.resolve(mockSupabase)),
}));

vi.mock("@/lib/queries/public-site", () => ({
  getPublicSiteSections: vi.fn().mockResolvedValue([]),
  getPublicSiteAssets: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/queries/marketing-content", () => ({
  getMarketingContentDrafts: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/queries/services", () => ({
  getPublicServiceCatalog: vi.fn().mockResolvedValue([]),
}));

import {
  saveMarketingMediaAsset,
  updateMarketingMediaAssetStatus,
  archiveMarketingMediaAsset,
  uploadMarketingMediaFile,
  getMarketingMediaUsageContext,
  getMarketingMediaUsageMap,
} from "@/lib/queries/marketing-media";

const TEST_ASSET_ID = "e4b6c310-8b1e-450f-90bf-c94d2fa8e711";

describe("marketing media queries - role boundaries and safety enforcement", () => {
  it("rejects digital marketer modification of approved or published assets", async () => {
    mockStaff = { id: "staff-dm", system_role: "digital_marketer" };
    mockDbSelectData = {
      id: TEST_ASSET_ID,
      bucket_path: "media/1-hero.jpg",
      status: "approved",
      alt_text: "Approved hero photo",
      metadata: {},
    };
    mockDbSelectError = null;

    const res = await saveMarketingMediaAsset({
      id: TEST_ASSET_ID,
      bucketPath: "media/1-hero.jpg",
      altText: "New alt text attempt",
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("Digital marketers can only edit draft or submitted");
    }
  });

  it("fails closed when existing asset state lookup produces a DB error for digital marketer", async () => {
    mockStaff = { id: "staff-dm", system_role: "digital_marketer" };
    mockDbSelectData = null;
    mockDbSelectError = { message: "Database connection failed" };
    lastUpdatePayload = null;

    const res = await saveMarketingMediaAsset({
      id: TEST_ASSET_ID,
      altText: "Updated alt text",
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe("Could not verify the current media asset state.");
    }
    expect(lastUpdatePayload).toBeNull();
  });

  it("fails closed when existing asset state lookup produces a DB error for owner", async () => {
    mockStaff = { id: "staff-owner", system_role: "owner" };
    mockDbSelectData = null;
    mockDbSelectError = { message: "Database connection failed" };
    lastUpdatePayload = null;

    const res = await saveMarketingMediaAsset({
      id: TEST_ASSET_ID,
      altText: "Updated alt text",
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe("Could not verify the current media asset state.");
    }
    expect(lastUpdatePayload).toBeNull();
  });

  it("fails closed when existing asset is not found", async () => {
    mockStaff = { id: "staff-owner", system_role: "owner" };
    mockDbSelectData = null;
    mockDbSelectError = null;
    lastUpdatePayload = null;

    const res = await saveMarketingMediaAsset({
      id: TEST_ASSET_ID,
      altText: "Updated alt text",
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe("Media asset not found.");
    }
    expect(lastUpdatePayload).toBeNull();
  });

  it("preserves immutable storage identity (bucket_path and public_url) on existing asset edits", async () => {
    mockStaff = { id: "staff-dm", system_role: "digital_marketer" };
    mockDbSelectData = {
      id: TEST_ASSET_ID,
      bucket_path: "media/canonical-path.jpg",
      public_url: "https://example.com/canonical-url.jpg",
      status: "draft",
      alt_text: "Original Alt",
      metadata: { originalFileName: "pic.jpg" },
    };
    mockDbSelectError = null;
    mockDbUpdateData = {
      id: TEST_ASSET_ID,
      bucket_path: "media/canonical-path.jpg",
      public_url: "https://example.com/canonical-url.jpg",
      status: "draft",
      alt_text: "New Alt",
      metadata: { originalFileName: "pic.jpg" },
    };
    lastUpdatePayload = null;

    const res = await saveMarketingMediaAsset({
      id: TEST_ASSET_ID,
      bucketPath: "media/tampered-path.jpg",
      publicUrl: "https://example.com/tampered-url.jpg",
      altText: "New Alt",
      title: "New Title",
    });

    expect(res.success).toBe(true);
    const payload = lastUpdatePayload as Record<string, unknown> | null;
    expect(payload).toBeDefined();
    expect(payload?.bucket_path).toBeUndefined();
    expect(payload?.public_url).toBeUndefined();
    expect(payload?.title).toBe("New Title");
    expect(payload?.alt_text).toBe("New Alt");
  });

  it("protects system tracking metadata fields from client overwrite", async () => {
    mockStaff = { id: "staff-dm", system_role: "digital_marketer" };
    mockDbSelectData = {
      id: TEST_ASSET_ID,
      bucket_path: "media/hero.jpg",
      public_url: "https://example.com/hero.jpg",
      status: "draft",
      alt_text: "Hero",
      metadata: {
        uploadStatus: "completed",
        sizeBytes: 12345,
        mimeType: "image/jpeg",
        originalFileName: "hero.jpg",
      },
    };
    mockDbSelectError = null;
    mockDbUpdateData = mockDbSelectData;
    lastUpdatePayload = null;

    const res = await saveMarketingMediaAsset({
      id: TEST_ASSET_ID,
      altText: "New Hero Alt",
      metadata: {
        uploadStatus: "forged_status",
        sizeBytes: 9999999,
        customUserTag: "autumn-campaign",
      },
    });

    expect(res.success).toBe(true);
    const metaPayload = lastUpdatePayload as Record<string, unknown> | null;
    const updatedMeta = metaPayload?.metadata as Record<string, unknown>;
    expect(updatedMeta.uploadStatus).toBe("completed"); // Preserved
    expect(updatedMeta.sizeBytes).toBe(12345); // Preserved
    expect(updatedMeta.customUserTag).toBe("autumn-campaign"); // Allowed
  });

  it("allows digital marketer modification of draft assets", async () => {
    mockStaff = { id: "staff-dm", system_role: "digital_marketer" };
    mockDbSelectData = {
      id: TEST_ASSET_ID,
      bucket_path: "media/1-hero.jpg",
      status: "draft",
      alt_text: "Draft hero photo",
      metadata: {},
    };
    mockDbSelectError = null;
    mockDbUpdateData = {
      id: TEST_ASSET_ID,
      bucket_path: "media/1-hero.jpg",
      status: "draft",
      alt_text: "Updated alt text",
    };

    const res = await saveMarketingMediaAsset({
      id: TEST_ASSET_ID,
      altText: "Updated alt text",
    });

    expect(res.success).toBe(true);
  });

  it("rejects generic status update to archived", async () => {
    mockStaff = { id: "staff-owner", system_role: "owner" };
    mockDbSelectData = {
      id: TEST_ASSET_ID,
      status: "published",
    };
    mockDbSelectError = null;

    const res = await updateMarketingMediaAssetStatus({
      id: TEST_ASSET_ID,
      status: "archived",
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("Archiving must be performed through the safe archive action");
    }
  });

  it("rejects digital marketer transition to approved or published", async () => {
    mockStaff = { id: "staff-dm", system_role: "digital_marketer" };
    mockDbSelectData = {
      id: TEST_ASSET_ID,
      status: "draft",
    };
    mockDbSelectError = null;

    const res = await updateMarketingMediaAssetStatus({
      id: TEST_ASSET_ID,
      status: "approved",
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain(
        "Digital marketers can only transition between draft and submitted"
      );
    }
  });

  it("allows digital marketer transition from draft to submitted", async () => {
    mockStaff = { id: "staff-dm", system_role: "digital_marketer" };
    mockDbSelectData = {
      id: TEST_ASSET_ID,
      status: "draft",
    };
    mockDbSelectError = null;
    mockDbUpdateData = {
      id: TEST_ASSET_ID,
      status: "submitted",
    };

    const res = await updateMarketingMediaAssetStatus({
      id: TEST_ASSET_ID,
      status: "submitted",
    });

    expect(res.success).toBe(true);
  });

  it("rejects archiving by non-owner roles", async () => {
    mockStaff = { id: "staff-dm", system_role: "digital_marketer" };

    const res = await archiveMarketingMediaAsset({
      id: TEST_ASSET_ID,
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("Only the Owner can finalize archiving");
    }
  });

  it("loads complete six-store usage context without unresolved stores when all resolve", async () => {
    mockStaff = { id: "staff-owner", system_role: "owner" };
    mockBrandError = null;
    mockSeoError = null;
    const context = await getMarketingMediaUsageContext();

    expect(context.sections).toBeDefined();
    expect(context.publicAssets).toBeDefined();
    expect(context.drafts).toBeDefined();
    expect(context.services).toBeDefined();
    expect(context.brandSettings).toBeDefined();
    expect(context.seoSettings).toBeDefined();
    expect(context.unresolvedStores).toBeUndefined();
  });

  it("fails closed when marketing_brand_settings table is missing or unreadable", async () => {
    mockStaff = { id: "staff-owner", system_role: "owner" };
    mockBrandError = { message: "relation marketing_brand_settings does not exist" };
    mockSeoError = null;

    const context = await getMarketingMediaUsageContext();
    expect(context.unresolvedStores).toContain("marketing_brand_settings");

    const asset = {
      id: TEST_ASSET_ID,
      bucket_path: "media/test.jpg",
      public_url: "https://example.com/test.jpg",
      title: "Test",
      alt_text: "Test Alt",
      section_key: null,
      content_key: null,
      status: "draft" as const,
      metadata: {},
      created_by: null,
      updated_by: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
    };

    const map = await getMarketingMediaUsageMap([asset]);
    expect(map[TEST_ASSET_ID]?.usageUnknown).toBe(true);
    expect(map[TEST_ASSET_ID]?.canSafelyArchive).toBe(false);
    mockBrandError = null;
  });

  it("fails closed when marketing_seo_settings table is missing or unreadable", async () => {
    mockStaff = { id: "staff-owner", system_role: "owner" };
    mockBrandError = null;
    mockSeoError = { message: "relation marketing_seo_settings does not exist" };

    const context = await getMarketingMediaUsageContext();
    expect(context.unresolvedStores).toContain("marketing_seo_settings");

    const asset = {
      id: TEST_ASSET_ID,
      bucket_path: "media/test.jpg",
      public_url: "https://example.com/test.jpg",
      title: "Test",
      alt_text: "Test Alt",
      section_key: null,
      content_key: null,
      status: "draft" as const,
      metadata: {},
      created_by: null,
      updated_by: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
    };

    const map = await getMarketingMediaUsageMap([asset]);
    expect(map[TEST_ASSET_ID]?.usageUnknown).toBe(true);
    expect(map[TEST_ASSET_ID]?.canSafelyArchive).toBe(false);
    mockSeoError = null;
  });

  it("generates page-level usage map covering all assets with complete context", async () => {
    mockStaff = { id: "staff-owner", system_role: "owner" };
    mockBrandError = null;
    mockSeoError = null;
    const asset = {
      id: TEST_ASSET_ID,
      bucket_path: "media/logo.jpg",
      public_url: "https://example.com/logo.jpg",
      title: "Logo",
      alt_text: "Brand Logo",
      section_key: "hero",
      content_key: null,
      status: "published" as const,
      metadata: {},
      created_by: "staff-1",
      updated_by: "staff-1",
      reviewed_by: null,
      reviewed_at: null,
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
    };

    const map = await getMarketingMediaUsageMap([asset]);
    expect(map[TEST_ASSET_ID]).toBeDefined();
    expect(map[TEST_ASSET_ID]?.usageUnknown).toBe(false);
    expect(map[TEST_ASSET_ID]?.totalLiveUsages).toBe(1); // from brand setting
    expect(map[TEST_ASSET_ID]?.canSafelyArchive).toBe(false);
  });

  it("permits safe archive when all stores resolve and asset has zero live usages", async () => {
    mockStaff = { id: "staff-owner", system_role: "owner" };
    mockBrandError = null;
    mockSeoError = null;
    const asset = {
      id: "unreferenced-asset-id",
      bucket_path: "media/unused-image.jpg",
      public_url: "https://example.com/unused-image.jpg",
      title: "Unused Image",
      alt_text: "Unused Image Alt",
      section_key: null,
      content_key: null,
      status: "published" as const,
      metadata: {},
      created_by: "staff-1",
      updated_by: "staff-1",
      reviewed_by: null,
      reviewed_at: null,
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
    };

    const map = await getMarketingMediaUsageMap([asset]);
    expect(map["unreferenced-asset-id"]).toBeDefined();
    expect(map["unreferenced-asset-id"]?.usageUnknown).toBe(false);
    expect(map["unreferenced-asset-id"]?.totalLiveUsages).toBe(0);
    expect(map["unreferenced-asset-id"]?.canSafelyArchive).toBe(true);
  });

  it("fails closed when storage upload succeeds but DB finalization update fails", async () => {
    mockStaff = { id: "staff-dm", system_role: "digital_marketer" };
    mockStorageUploadError = null;

    // Reservation insert succeeds
    mockDbInsertData = {
      id: TEST_ASSET_ID,
      bucket_path: "media/1725170000-sample.jpg",
      public_url: null,
      title: "Sample Image",
      alt_text: "Sample Alt Text",
      section_key: "hero",
      status: "draft",
      metadata: { uploadStatus: "pending" },
    };
    mockDbInsertError = null;

    // Finalization update fails
    mockDbUpdateData = null;
    mockDbUpdateError = { message: "Database connection timeout during finalization" };

    const file = new File(["dummy content"], "sample.jpg", { type: "image/jpeg" });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", "Sample Image");
    formData.append("altText", "Sample Alt Text");
    formData.append("sectionKey", "hero");

    const result = await uploadMarketingMediaFile(formData);

    expect(result.success).toBe(false);
    expect(mockStorageUpload).toHaveBeenCalled();
    if (!result.success) {
      expect(result.error).toContain("catalog finalization failed");
    }
  });
});
