import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock("@/lib/queries/marketing-brand", () => ({
  updateBrandSettingsBatchOwner: vi.fn(),
}));

vi.mock("@/lib/queries/marketing-media", () => ({
  getMarketingAccessContext: vi.fn(),
  getMarketingMediaAssetById: vi.fn(),
  uploadMarketingMediaFile: vi.fn(),
}));

vi.mock("@/lib/marketing/icon-generator", () => ({
  generateSiteIconPackageFromBuffer: vi.fn(),
}));

import {
  updateBrandSettingAction,
  generateSiteIconAction,
} from "@/app/(dashboard)/marketing/brand-actions";
import { updateBrandSettingsBatchOwner } from "@/lib/queries/marketing-brand";
import {
  getMarketingAccessContext,
  getMarketingMediaAssetById,
  uploadMarketingMediaFile,
} from "@/lib/queries/marketing-media";
import { generateSiteIconPackageFromBuffer } from "@/lib/marketing/icon-generator";

describe("Brand Server Actions (Fail Closed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails closed when batch update returns failure", async () => {
    vi.mocked(updateBrandSettingsBatchOwner).mockResolvedValue({
      success: false,
      error: "Database constraint error on marketing_brand_settings",
    });

    const formData = new FormData();
    formData.append("headerLogoUrl", "https://example.com/logo.png");
    formData.append("headerLogoAlt", "Custom Logo");

    const result = await updateBrandSettingAction({ success: true }, formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Database constraint error on marketing_brand_settings");
    expect(result.message).toBeUndefined();
  });

  it("fails closed when unauthorized caller tries to publish directly", async () => {
    vi.mocked(updateBrandSettingsBatchOwner).mockResolvedValue({
      success: false,
      error: "Only owners can publish live brand settings directly.",
    });

    const formData = new FormData();
    formData.append("headerLogoUrl", "https://example.com/logo.png");

    const result = await updateBrandSettingAction({ success: true }, formData);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Only owners can publish live brand settings directly.");
  });

  it("succeeds and reports published message on successful batch write", async () => {
    vi.mocked(updateBrandSettingsBatchOwner).mockResolvedValue({
      success: true,
    });

    const formData = new FormData();
    formData.append("headerLogoUrl", "https://example.com/logo.png");
    formData.append("taglineText", "A sanctuary of calm");

    const result = await updateBrandSettingAction({ success: true }, formData);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Brand identity settings published live.");
    expect(updateBrandSettingsBatchOwner).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ settingKey: "header_logo" }),
        expect.objectContaining({ settingKey: "brand_tagline" }),
      ])
    );
  });
});

describe("generateSiteIconAction (Security & Trusted Asset Flow)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated caller before processing any file or storage request", async () => {
    vi.mocked(getMarketingAccessContext).mockResolvedValue(null);

    const formData = new FormData();
    formData.append("sourceUrl", "https://malicious.com/attack.png");

    const result = await generateSiteIconAction({}, formData);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Unauthorized");
    expect(getMarketingMediaAssetById).not.toHaveBeenCalled();
    expect(generateSiteIconPackageFromBuffer).not.toHaveBeenCalled();
  });

  it("rejects unauthorized staff roles (e.g., receptionist or therapist)", async () => {
    vi.mocked(getMarketingAccessContext).mockResolvedValue({
      supabase: {} as never,
      staffId: "staff-123",
      role: "receptionist" as never,
    });

    const formData = new FormData();
    formData.append("sourceAssetId", "asset-123");

    const result = await generateSiteIconAction({}, formData);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Unauthorized");
    expect(getMarketingMediaAssetById).not.toHaveBeenCalled();
  });

  it("does NOT make remote HTTP fetch requests for browser-supplied external URLs", async () => {
    vi.mocked(getMarketingAccessContext).mockResolvedValue({
      supabase: {} as never,
      staffId: "marketer-1",
      role: "digital_marketer",
    });

    const fetchSpy = vi.spyOn(global, "fetch");

    const formData = new FormData();
    formData.append("sourceUrl", "https://evil.example.com/exploit.png");

    const result = await generateSiteIconAction({}, formData);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toContain("Please provide a master brand icon file or select an active asset");
  });

  it("allows digital marketer with trusted asset ID and downloads from Supabase storage", async () => {
    const mockDownload = vi.fn().mockResolvedValue({
      data: new Blob([Buffer.from("mock-image-bytes")], { type: "image/png" }),
      error: null,
    });

    const mockSupabase = {
      storage: {
        from: vi.fn().mockReturnValue({
          download: mockDownload,
        }),
      },
    };

    vi.mocked(getMarketingAccessContext).mockResolvedValue({
      supabase: mockSupabase as never,
      staffId: "marketer-1",
      role: "digital_marketer",
    });

    vi.mocked(getMarketingMediaAssetById).mockResolvedValue({
      id: "trusted-asset-789",
      bucket_path: "media/trusted-icon.png",
      public_url: "https://storage.supabase.co/media/trusted-icon.png",
      title: "Trusted Master Icon",
      alt_text: "Master Icon",
      status: "published",
      section_key: null,
      content_key: null,
      metadata: { mimeType: "image/png" },
      created_by: "marketer-1",
      updated_by: "marketer-1",
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    vi.mocked(generateSiteIconPackageFromBuffer).mockResolvedValue({
      success: true,
      package: {
        version: "v123",
        sourceUrl: "https://storage.supabase.co/media/trusted-icon.png",
        sourceAssetId: "trusted-asset-789",
        generationStatus: "ready",
        generatedAt: "2026-09-02T00:00:00Z",
        icons: {
          icon16: "https://storage/icon-16.png",
          icon32: "https://storage/icon-32.png",
          icon48: "https://storage/icon-48.png",
          apple180: "https://storage/apple-touch-icon-180.png",
          icon192: "https://storage/icon-192.png",
          icon512: "https://storage/icon-512.png",
          maskable512: "https://storage/maskable-512.png",
        },
      },
    });

    const formData = new FormData();
    formData.append("sourceAssetId", "trusted-asset-789");

    const result = await generateSiteIconAction({}, formData);

    expect(result.success).toBe(true);
    expect(result.package?.sourceAssetId).toBe("trusted-asset-789");
    expect(mockSupabase.storage.from).toHaveBeenCalledWith("public-site-media");
    expect(mockDownload).toHaveBeenCalledWith("media/trusted-icon.png");
    expect(generateSiteIconPackageFromBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceAssetId: "trusted-asset-789",
        sourceUrl: "https://storage.supabase.co/media/trusted-icon.png",
      })
    );
  });

  it("allows Owner to upload master file which first creates tracked asset", async () => {
    vi.mocked(getMarketingAccessContext).mockResolvedValue({
      supabase: {} as never,
      staffId: "owner-1",
      role: "owner",
    });

    vi.mocked(uploadMarketingMediaFile).mockResolvedValue({
      success: true,
      message: "Uploaded",
      asset: {
        id: "created-asset-999",
        bucket_path: "media/created.png",
        public_url: "https://storage/created.png",
        title: "Site Icon Master",
        alt_text: "Master Brand Site Icon",
        status: "draft",
        section_key: null,
        content_key: null,
        metadata: {},
        created_by: "owner-1",
        updated_by: "owner-1",
        reviewed_by: null,
        reviewed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });

    vi.mocked(generateSiteIconPackageFromBuffer).mockResolvedValue({
      success: true,
      package: {
        version: "v999",
        sourceUrl: "https://storage/created.png",
        sourceAssetId: "created-asset-999",
        generationStatus: "ready",
        generatedAt: "2026-09-02T00:00:00Z",
        icons: {
          icon16: "https://storage/icon-16.png",
          icon32: "https://storage/icon-32.png",
          icon48: "https://storage/icon-48.png",
          apple180: "https://storage/apple-touch-icon-180.png",
          icon192: "https://storage/icon-192.png",
          icon512: "https://storage/icon-512.png",
          maskable512: "https://storage/maskable-512.png",
        },
      },
    });

    const file = new File([Buffer.from("png-bytes")], "master.png", { type: "image/png" });
    const formData = new FormData();
    formData.append("masterFile", file);

    const result = await generateSiteIconAction({}, formData);

    expect(uploadMarketingMediaFile).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.package?.sourceAssetId).toBe("created-asset-999");
  });
});
