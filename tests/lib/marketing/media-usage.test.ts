import { describe, expect, it } from "vitest";
import {
  analyzeMediaAssetUsage,
  batchAnalyzeMediaUsage,
  matchesMediaAsset,
  type MediaUsageContextData,
} from "@/lib/marketing/media-usage-analyzer";
import type { MarketingMediaAssetRow } from "@/lib/queries/marketing-media";

const sampleAsset: MarketingMediaAssetRow = {
  id: "asset-1111-1111",
  bucket_path: "media/1725170000-hero-room.jpg",
  public_url:
    "https://example.com/storage/v1/object/public/public-site-media/media/1725170000-hero-room.jpg",
  title: "Hero Room Treatment",
  alt_text: "Luxury treatment room with ambient lighting",
  section_key: "hero",
  content_key: null,
  status: "published",
  metadata: { sizeBytes: 254000, mimeType: "image/jpeg" },
  created_by: "staff-1",
  updated_by: "staff-1",
  reviewed_by: "staff-owner",
  reviewed_at: "2026-09-01T00:00:00Z",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

describe("media asset matching and usage analyzer", () => {
  it("correctly matches assets by public URL, bucket path, or filename", () => {
    expect(
      matchesMediaAsset(
        sampleAsset,
        "https://example.com/storage/v1/object/public/public-site-media/media/1725170000-hero-room.jpg"
      )
    ).toBe(true);

    expect(matchesMediaAsset(sampleAsset, "media/1725170000-hero-room.jpg")).toBe(true);
    expect(matchesMediaAsset(sampleAsset, "/images/1725170000-hero-room.jpg")).toBe(true);
    expect(matchesMediaAsset(sampleAsset, "https://example.com/other-unrelated.jpg")).toBe(false);
    expect(matchesMediaAsset(sampleAsset, null)).toBe(false);
    expect(matchesMediaAsset(sampleAsset, "")).toBe(false);
  });

  it("identifies live section usages and blocks archiving", () => {
    const context: MediaUsageContextData = {
      sections: [
        {
          id: "sec-hero",
          section_key: "hero",
          title: "Welcome to Cradle",
          subtitle: null,
          body: null,
          cta_label: "Book",
          cta_href: "/book",
          image_url: sampleAsset.public_url,
          secondary_image_url: null,
          sort_order: 1,
          is_enabled: true,
          metadata: {},
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
        },
      ],
    };

    const summary = analyzeMediaAssetUsage(sampleAsset, context);
    expect(summary.totalLiveUsages).toBe(1);
    expect(summary.totalDraftUsages).toBe(0);
    expect(summary.canSafelyArchive).toBe(false);
    expect(summary.blockingReasons.length).toBe(1);
    expect(summary.blockingReasons[0] ?? "").toContain("referenced by 1 live public consumer");
    expect(summary.usages[0]?.consumerType).toBe("public_section");
    expect(summary.usages[0]?.isLive).toBe(true);
  });

  it("allows archiving when only draft references exist", () => {
    const context: MediaUsageContextData = {
      drafts: [
        {
          id: "draft-1",
          content_type: "section",
          content_key: "hero",
          title: "Draft Hero",
          subtitle: null,
          body: null,
          cta_label: null,
          cta_href: null,
          image_url: sampleAsset.public_url,
          secondary_image_url: null,
          alt_text: null,
          link_href: null,
          sort_order: 0,
          is_enabled: true,
          metadata: {},
          status: "draft",
          scheduled_for: null,
          source_section_id: null,
          source_asset_id: null,
          created_by: null,
          updated_by: null,
          submitted_by: null,
          submitted_at: null,
          reviewed_by: null,
          reviewed_at: null,
          review_note: null,
          published_by: null,
          published_at: null,
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
        },
      ],
    };

    const summary = analyzeMediaAssetUsage(sampleAsset, context);
    expect(summary.totalLiveUsages).toBe(0);
    expect(summary.totalDraftUsages).toBe(1);
    expect(summary.canSafelyArchive).toBe(true);
    expect(summary.blockingReasons.length).toBe(0);
    expect(summary.usages[0]?.isLive).toBe(false);
  });

  it("detects service catalog usages as live and blocks archiving", () => {
    const context: MediaUsageContextData = {
      services: [
        {
          id: "srv-signature",
          name: "Signature Cradle Massage",
          slug: "signature-cradle-massage",
          imageUrl: sampleAsset.public_url,
          isPublicBookable: true,
        },
      ],
    };

    const summary = analyzeMediaAssetUsage(sampleAsset, context);
    expect(summary.totalLiveUsages).toBe(1);
    expect(summary.canSafelyArchive).toBe(false);
    expect(summary.usages[0]?.consumerType).toBe("service");
  });

  it("treats unreferenced assets as completely safe to archive", () => {
    const context: MediaUsageContextData = {
      sections: [],
      drafts: [],
      services: [],
    };

    const summary = analyzeMediaAssetUsage(sampleAsset, context);
    expect(summary.totalLiveUsages).toBe(0);
    expect(summary.totalDraftUsages).toBe(0);
    expect(summary.canSafelyArchive).toBe(true);
    expect(summary.blockingReasons).toEqual([]);
  });

  it("batch analyzes multiple assets correctly", () => {
    const asset2: MarketingMediaAssetRow = {
      ...sampleAsset,
      id: "asset-2222-2222",
      bucket_path: "media/1725170001-about-garden.jpg",
      public_url:
        "https://example.com/storage/v1/object/public/public-site-media/media/1725170001-about-garden.jpg",
    };

    const context: MediaUsageContextData = {
      sections: [
        {
          id: "sec-about",
          section_key: "about",
          title: "About",
          subtitle: null,
          body: null,
          cta_label: null,
          cta_href: null,
          image_url: asset2.public_url,
          secondary_image_url: null,
          sort_order: 2,
          is_enabled: true,
          metadata: {},
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
        },
      ],
    };

    const map = batchAnalyzeMediaUsage([sampleAsset, asset2], context);
    expect(map.size).toBe(2);
    expect(map.get(sampleAsset.id)?.totalLiveUsages).toBe(0);
    expect(map.get(sampleAsset.id)?.canSafelyArchive).toBe(true);
    expect(map.get(asset2.id)?.totalLiveUsages).toBe(1);
    expect(map.get(asset2.id)?.canSafelyArchive).toBe(false);
  });
});
