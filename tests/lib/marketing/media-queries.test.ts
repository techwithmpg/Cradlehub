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
const mockDbSelectError: unknown = null;
const mockDbInsertData: unknown = null;
const mockDbInsertError: unknown = null;
let mockDbUpdateData: unknown = null;
const mockDbUpdateError: unknown = null;
const mockStorageUploadError: unknown = null;

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
      update: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockImplementation(() =>
            Promise.resolve({ data: mockDbUpdateData, error: mockDbUpdateError })
          ),
      })),
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
    };

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

  it("allows digital marketer modification of draft assets", async () => {
    mockStaff = { id: "staff-dm", system_role: "digital_marketer" };
    mockDbSelectData = {
      id: TEST_ASSET_ID,
      bucket_path: "media/1-hero.jpg",
      status: "draft",
      alt_text: "Draft hero photo",
    };
    mockDbUpdateData = {
      id: TEST_ASSET_ID,
      bucket_path: "media/1-hero.jpg",
      status: "draft",
      alt_text: "Updated alt text",
    };

    const res = await saveMarketingMediaAsset({
      id: TEST_ASSET_ID,
      bucketPath: "media/1-hero.jpg",
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
});
