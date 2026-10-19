import { describe, expect, it } from "vitest";
import { resolvePublicSiteSections, type PublicSiteSectionRow } from "@/lib/public/normalized-sections";
import { marketingContentDraftInputSchema } from "@/lib/validations/marketing";

describe("responsive Marketing hero contract", () => {
  it("resolves a mobile variant and bounded focal positions for public and preview renderers", () => {
    const hero = {
      section_key: "hero",
      image_url: "/images/spa/hero.jpg",
      secondary_image_url: null,
      is_enabled: true,
      metadata: {
        mobileImageUrl: "/images/spa/hero-mobile.jpg",
        imageAltText: "Wellness treatment room",
        mobileImageAltText: "Massage treatment on mobile",
        desktopFocalX: 70,
        desktopFocalY: 45,
        mobileFocalX: 30,
        mobileFocalY: 60,
      },
    } as unknown as PublicSiteSectionRow;

    const result = resolvePublicSiteSections([hero]).hero;
    expect(result.mobileImageUrl).toBe("/images/spa/hero-mobile.jpg");
    expect(result.imagePosition).toBe("70% 45%");
    expect(result.mobileImagePosition).toBe("30% 60%");
    expect(result.mobileImageAltText).toBe("Massage treatment on mobile");
  });

  it("rejects unsafe mobile URLs and focal coordinates before draft storage", () => {
    const invalid = marketingContentDraftInputSchema.safeParse({
      contentType: "section",
      contentKey: "hero",
      metadata: { mobileImageUrl: "javascript:alert(1)", mobileFocalX: 200 },
    });
    expect(invalid.success).toBe(false);

    const valid = marketingContentDraftInputSchema.safeParse({
      contentType: "section",
      contentKey: "hero",
      metadata: { mobileImageUrl: "/images/spa/hero-mobile.jpg", mobileFocalX: 25 },
    });
    expect(valid.success).toBe(true);
  });
});
