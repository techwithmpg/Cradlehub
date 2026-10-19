import { describe, expect, it } from "vitest";
import { marketingContentDraftInputSchema } from "@/lib/validations/marketing";

const draft = (slots: unknown) => ({
  contentType: "section",
  contentKey: "site_images",
  metadata: { slots },
});

describe("managed website image validation", () => {
  it("accepts recognized local and configured public-storage image slots", () => {
    expect(
      marketingContentDraftInputSchema.safeParse(
        draft({
          home_setting_in_spa: "/images/spa/in-spa.jpg",
          mobile_final_cta_ambient:
            "https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/marketing-media/cta.jpg",
        })
      ).success
    ).toBe(true);
  });

  it.each([
    { home_setting_in_spa: "javascript:alert(1)" },
    { home_setting_in_spa: "https://unconfigured.example.com/image.jpg" },
    { unknown_slot: "/images/spa/in-spa.jpg" },
    { mobile_final_cta_ambient: "//unconfigured.example.com/image.jpg" },
    null,
  ])("rejects unsafe or unknown managed slots: %j", (slots) => {
    expect(marketingContentDraftInputSchema.safeParse(draft(slots)).success).toBe(false);
  });
});
