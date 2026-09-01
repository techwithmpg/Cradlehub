import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock("@/lib/queries/marketing-brand", () => ({
  updateBrandSettingsBatchOwner: vi.fn(),
}));

import { updateBrandSettingAction } from "@/app/(dashboard)/marketing/brand-actions";
import { updateBrandSettingsBatchOwner } from "@/lib/queries/marketing-brand";

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
