import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

const mockUpdateBranchAction = vi.fn();
vi.mock("@/app/(dashboard)/owner/branches/actions", () => ({
  updateBranchAction: (...args: unknown[]) => mockUpdateBranchAction(...args),
}));

const mockUpdatePublicSiteSection = vi.fn();
vi.mock("@/lib/queries/public-site", () => ({
  updatePublicSiteSection: (...args: unknown[]) => mockUpdatePublicSiteSection(...args),
}));

const mockUpdateBrandSettingsBatchOwner = vi.fn();
vi.mock("@/lib/queries/marketing-brand", () => ({
  updateBrandSettingsBatchOwner: (...args: unknown[]) => mockUpdateBrandSettingsBatchOwner(...args),
}));

type MockQueryChain = {
  eq: ReturnType<typeof vi.fn>;
  maybeSingle?: ReturnType<typeof vi.fn>;
  single?: ReturnType<typeof vi.fn>;
  select?: ReturnType<typeof vi.fn>;
};

let currentMockSupabase: unknown = null;
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => currentMockSupabase),
}));

vi.mock("@/lib/dev-bypass", () => ({
  isDevAuthBypassEnabled: vi.fn(() => false),
}));

import { publishMarketingContentDraft } from "@/lib/queries/marketing-content";

function createStaffQuery(): MockQueryChain {
  const query: MockQueryChain = {
    eq: vi.fn().mockImplementation(() => query),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: "staff-owner-01", system_role: "owner", is_active: true },
    }),
  };
  return query;
}

function createDraftUpdateQuery(draftRow: Record<string, unknown>): MockQueryChain {
  const query: MockQueryChain = {
    eq: vi.fn().mockImplementation(() => query),
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: { ...draftRow, status: "published" },
        error: null,
      }),
    }),
  };
  return query;
}

function createRevisionsQuery() {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "rev-01" },
          error: null,
        }),
      }),
    }),
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    }),
  };
}

describe("Draft Publication Pipelines (C5.4 Review Corrections)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Branch Draft Publication", () => {
    it("publishes branch draft using canonical metadata.branchId (hyphenated UUID) and merges location_metadata without touching public_site_sections", async () => {
      const realBranchUuid = "e7b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c";
      const draftUuid = "11111111-1111-4111-8111-111111111111";
      const existingBranchMeta = {
        operational_key: "OP_BRANCH_LACSON_01",
        coordinates: { lat: 10.6765, lng: 122.951 },
        custom_facility_code: "FAC-99",
      };

      const mockDraftRow = {
        id: draftUuid,
        content_type: "section",
        content_key: "branch_e7b1a2c3_4d5e_6f7a_8b9c_0d1e2f3a4b5c",
        status: "approved",
        title: "Cradle Lacson Flagship",
        subtitle: "10:00 AM - 10:00 PM Daily",
        body: "123 Lacson Street, Bacolod City",
        cta_label: "0917-111-2222",
        image_url: "https://example.com/cradle-lacson-new.webp",
        metadata: {
          branchId: realBranchUuid,
          name: "Cradle Lacson Flagship",
          phone: "0917-111-2222",
          email: "lacson@cradlespa.com",
          fbPage: "facebook.com/cradlebacolod",
          messengerLink: "m.me/cradlebacolod",
          openingHours: "10:00 AM - 10:00 PM Daily",
          mapsEmbedUrl: "https://maps.google.com/embed?q=lacson",
        },
      };

      currentMockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-user-01" } } }),
        },
        from: vi.fn((table: string) => {
          if (table === "staff") {
            return {
              select: vi.fn().mockReturnValue(createStaffQuery()),
            };
          }
          if (table === "marketing_content_drafts") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: mockDraftRow,
                    error: null,
                  }),
                }),
              }),
              update: vi.fn().mockReturnValue(createDraftUpdateQuery(mockDraftRow)),
            };
          }
          if (table === "branches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      name: "Old Main Spa",
                      address: "Old Lacson Address",
                      location_metadata: existingBranchMeta,
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "marketing_content_revisions") {
            return createRevisionsQuery();
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }),
      };

      mockUpdateBranchAction.mockResolvedValue({ success: true });

      const result = await publishMarketingContentDraft({ id: draftUuid });

      expect(result.success).toBe(true);

      // Verify correct hyphenated UUID, name, address, and metadata are passed
      expect(mockUpdateBranchAction).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: realBranchUuid,
          name: "Cradle Lacson Flagship",
          address: "123 Lacson Street, Bacolod City",
          phone: "0917-111-2222",
          email: "lacson@cradlespa.com",
          fbPage: "facebook.com/cradlebacolod",
          messengerLink: "m.me/cradlebacolod",
          openingHours: "10:00 AM - 10:00 PM Daily",
          mapsEmbedUrl: "https://maps.google.com/embed?q=lacson",
          locationMetadata: {
            operational_key: "OP_BRANCH_LACSON_01",
            coordinates: { lat: 10.6765, lng: 122.951 },
            custom_facility_code: "FAC-99",
            image_url: "https://example.com/cradle-lacson-new.webp",
          },
        })
      );

      // Verify branch_* draft NEVER calls updatePublicSiteSection
      expect(mockUpdatePublicSiteSection).not.toHaveBeenCalled();
    });

    it("fails closed if canonical metadata.branchId is missing or invalid", async () => {
      const draftUuid = "22222222-2222-4222-8222-222222222222";
      const mockDraftRow = {
        id: draftUuid,
        content_type: "section",
        content_key: "branch_invalid",
        status: "approved",
        metadata: {}, // Missing branchId
      };

      currentMockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-user-01" } } }),
        },
        from: vi.fn((table: string) => {
          if (table === "staff") {
            return {
              select: vi.fn().mockReturnValue(createStaffQuery()),
            };
          }
          if (table === "marketing_content_drafts") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: mockDraftRow,
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const result = await publishMarketingContentDraft({ id: draftUuid });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("missing a valid canonical branchId");
      }
      expect(mockUpdateBranchAction).not.toHaveBeenCalled();
      expect(mockUpdatePublicSiteSection).not.toHaveBeenCalled();
    });

    it("fails closed if existing branch metadata cannot be read during draft publication", async () => {
      const realBranchUuid = "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d";
      const draftUuid = "33333333-3333-4333-8333-333333333333";
      const mockDraftRow = {
        id: draftUuid,
        content_type: "section",
        content_key: `branch_${realBranchUuid.replace(/-/g, "_")}`,
        status: "approved",
        metadata: {
          branchId: realBranchUuid,
        },
      };

      currentMockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-user-01" } } }),
        },
        from: vi.fn((table: string) => {
          if (table === "staff") {
            return {
              select: vi.fn().mockReturnValue(createStaffQuery()),
            };
          }
          if (table === "marketing_content_drafts") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: mockDraftRow,
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "branches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: "Database connection failure" },
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const result = await publishMarketingContentDraft({ id: draftUuid });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Failed to read existing branch metadata");
      }
      expect(mockUpdateBranchAction).not.toHaveBeenCalled();
    });
  });

  describe("Service Draft Publication", () => {
    it("publishes service draft by updating ONLY presentation fields and preserving all non-marketing metadata", async () => {
      const realServiceId = "srv-aromatherapy-01";
      const draftUuid = "44444444-4444-4444-8444-444444444444";
      const existingServiceMeta = {
        internal_code: "AROMA_60",
        commission_rate: 0.35,
        required_equipment: ["diffuser", "towel_warmer"],
        public_short_description: "Old short summary",
      };

      const mockDraftRow = {
        id: draftUuid,
        content_type: "service",
        content_key: realServiceId,
        status: "approved",
        title: "Aromatherapy Massage",
        subtitle: "Deep relaxation with pure essential oils.",
        body: "Detailed description of Swedish and Shiatsu strokes with calming lavender oils.",
        alt_text: "Therapist applying essential oils",
        image_url: "https://example.com/aroma-treatment.webp",
        metadata: {
          shortDescription: "Deep relaxation with pure essential oils.",
          badges: ["Bestseller", "Aromatherapy"],
          inclusions: ["Lavender & Bergamot Oils", "Hot Herbal Towel", "Foot Soak"],
          imageAlt: "Therapist applying essential oils",
        },
      };

      let capturedServiceUpdatePayload: Record<string, unknown> | null = null;

      currentMockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-user-01" } } }),
        },
        from: vi.fn((table: string) => {
          if (table === "staff") {
            return {
              select: vi.fn().mockReturnValue(createStaffQuery()),
            };
          }
          if (table === "marketing_content_drafts") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: mockDraftRow,
                    error: null,
                  }),
                }),
              }),
              update: vi.fn().mockReturnValue(createDraftUpdateQuery(mockDraftRow)),
            };
          }
          if (table === "services") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { metadata: existingServiceMeta },
                    error: null,
                  }),
                }),
              }),
              update: vi.fn().mockImplementation((payload) => {
                capturedServiceUpdatePayload = payload;
                return {
                  eq: vi.fn().mockResolvedValue({ error: null }),
                };
              }),
            };
          }
          if (table === "marketing_content_revisions") {
            return createRevisionsQuery();
          }
          return {};
        }),
      };

      const result = await publishMarketingContentDraft({ id: draftUuid });

      expect(result.success).toBe(true);

      // Verify payload written to services table writes only presentation fields and preserves existing metadata
      expect(capturedServiceUpdatePayload).toEqual({
        image_url: "https://example.com/aroma-treatment.webp",
        image_alt: "Therapist applying essential oils",
        description:
          "Detailed description of Swedish and Shiatsu strokes with calming lavender oils.",
        metadata: {
          internal_code: "AROMA_60",
          commission_rate: 0.35,
          required_equipment: ["diffuser", "towel_warmer"],
          public_short_description: "Deep relaxation with pure essential oils.",
          service_badges: ["Bestseller", "Aromatherapy"],
          inclusions: ["Lavender & Bergamot Oils", "Hot Herbal Towel", "Foot Soak"],
        },
      });
    });
  });

  describe("Brand Draft Publication & Site Icon Package Flow", () => {
    it("publishes brand draft and persists validated siteIconPackage to marketing_brand_settings", async () => {
      const draftUuid = "55555555-5555-4555-8555-555555555555";
      const validPackage = {
        version: "v2026",
        sourceUrl:
          "https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/media/master.png",
        sourceAssetId: "asset-123",
        generationStatus: "ready",
        generatedAt: "2026-09-02T00:00:00Z",
        icons: {
          icon16:
            "https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/brand/site-icon/v2026/icon-16.png",
          icon32:
            "https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/brand/site-icon/v2026/icon-32.png",
          icon48:
            "https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/brand/site-icon/v2026/icon-48.png",
          apple180:
            "https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/brand/site-icon/v2026/apple-touch-icon-180.png",
          icon192:
            "https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/brand/site-icon/v2026/icon-192.png",
          icon512:
            "https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/brand/site-icon/v2026/icon-512.png",
          maskable512:
            "https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/brand/site-icon/v2026/maskable-512.png",
        },
      };

      const mockDraftRow = {
        id: draftUuid,
        content_type: "brand",
        content_key: "brand_identity",
        status: "approved",
        title: "A sanctuary of calm in Bacolod.",
        subtitle: "Experience genuine renewal.",
        image_url: "https://storage/logo.png",
        alt_text: "Cradle Logo",
        metadata: {
          headerLogoUrl: "https://storage/logo.png",
          siteIconPackage: validPackage,
          siteIconAlt: "Cradle Spa Favicon",
        },
      };

      mockUpdateBrandSettingsBatchOwner.mockResolvedValue({ success: true });

      currentMockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-user-01" } } }),
        },
        from: vi.fn((table: string) => {
          if (table === "staff") {
            return { select: vi.fn().mockReturnValue(createStaffQuery()) };
          }
          if (table === "marketing_media_assets") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "asset-123", status: "published", bucket_path: "media/master.png" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "marketing_content_drafts") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: mockDraftRow,
                    error: null,
                  }),
                }),
              }),
              update: vi.fn().mockReturnValue(createDraftUpdateQuery(mockDraftRow)),
            };
          }
          if (table === "marketing_content_revisions") {
            return createRevisionsQuery();
          }
          return {};
        }),
      };

      const result = await publishMarketingContentDraft({ id: draftUuid });

      expect(result.success).toBe(true);
      expect(mockUpdateBrandSettingsBatchOwner).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            settingKey: "site_icon",
            value: expect.objectContaining({
              url: validPackage.icons.icon32,
              package: validPackage,
            }),
          }),
        ])
      );
    });

    it("fails closed when brand draft contains an incomplete or untrusted siteIconPackage", async () => {
      const draftUuid = "66666666-6666-4666-8666-666666666666";
      const brokenPackage = {
        version: "v2026",
        sourceUrl: "https://storage/master.png",
        generationStatus: "failed", // Not ready!
        icons: {
          icon16: "",
        },
      };

      const mockDraftRow = {
        id: draftUuid,
        content_type: "brand",
        content_key: "brand_identity",
        status: "approved",
        metadata: {
          siteIconPackage: brokenPackage,
        },
      };

      currentMockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-user-01" } } }),
        },
        from: vi.fn((table: string) => {
          if (table === "staff") {
            return { select: vi.fn().mockReturnValue(createStaffQuery()) };
          }
          if (table === "marketing_content_drafts") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: mockDraftRow,
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const result = await publishMarketingContentDraft({ id: draftUuid });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("generationStatus is 'failed', expected 'ready'");
      }
      expect(mockUpdateBrandSettingsBatchOwner).not.toHaveBeenCalled();
    });
  });
});
