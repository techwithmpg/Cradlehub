import { describe, expect, it } from "vitest";
import { parseMarketingDraftWithPublishedImages } from "@/lib/validations/marketing";

describe("unchanged published image compatibility", () => {
  const legacyHero = {
    image_url: "https://cdn.example.com/old-desktop.jpg",
    secondary_image_url: "https://cdn.example.com/old-portrait.jpg",
    metadata: { mobileImageUrl: "https://cdn.example.com/old-mobile.jpg" },
  };

  it("preserves unchanged legacy hero URLs while accepting a supported mobile replacement", () => {
    const parsed = parseMarketingDraftWithPublishedImages(
      {
        contentType: "section",
        contentKey: "hero",
        imageUrl: legacyHero.image_url,
        secondaryImageUrl: legacyHero.secondary_image_url,
        metadata: { mobileImageUrl: "/images/new-mobile.jpg" },
      },
      legacyHero
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.imageUrl).toBe(legacyHero.image_url);
    expect(parsed.data.secondaryImageUrl).toBe(legacyHero.secondary_image_url);
    expect(parsed.data.metadata.mobileImageUrl).toBe("/images/new-mobile.jpg");
  });

  it("rejects a newly supplied unsupported URL", () => {
    const parsed = parseMarketingDraftWithPublishedImages(
      {
        contentType: "section",
        contentKey: "hero",
        imageUrl: "https://cdn.example.com/new-desktop.jpg",
        secondaryImageUrl: legacyHero.secondary_image_url,
        metadata: { mobileImageUrl: legacyHero.metadata.mobileImageUrl },
      },
      legacyHero
    );
    expect(parsed.success).toBe(false);
  });

  it("preserves unchanged legacy category entries while accepting a new supported cover", () => {
    const published = {
      metadata: {
        categoryImages: {
          "Salon Services": "https://cdn.example.com/old-salon.jpg",
          "Unknown Category": "/images/unknown.jpg",
        },
      },
    };
    const parsed = parseMarketingDraftWithPublishedImages(
      {
        contentType: "section",
        contentKey: "signature_services",
        metadata: {
          categoryImages: {
            ...published.metadata.categoryImages,
            "Skin Care Services": "/images/new-skin-care.jpg",
          },
        },
      },
      published
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.metadata.categoryImages).toEqual({
      ...published.metadata.categoryImages,
      "Skin Care Services": "/images/new-skin-care.jpg",
    });

    const unsupportedNewCategory = parseMarketingDraftWithPublishedImages(
      {
        contentType: "section",
        contentKey: "signature_services",
        metadata: {
          categoryImages: {
            ...published.metadata.categoryImages,
            "Skin Care Services": "https://cdn.example.com/new-skin-care.jpg",
          },
        },
      },
      published
    );
    expect(unsupportedNewCategory.success).toBe(false);
  });
});
