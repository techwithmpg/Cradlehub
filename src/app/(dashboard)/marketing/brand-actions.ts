"use server";

import { revalidatePath } from "next/cache";
import { updateBrandSettingOwner } from "@/lib/queries/marketing-brand";

export async function updateBrandSettingAction(
  _prevState: { success: boolean; message?: string; error?: string },
  formData: FormData
) {
  const headerLogoUrl = formData.get("headerLogoUrl")?.toString() || "";
  const headerLogoAlt = formData.get("headerLogoAlt")?.toString() || "";
  const footerLogoUrl = formData.get("footerLogoUrl")?.toString() || "";
  const footerLogoAlt = formData.get("footerLogoAlt")?.toString() || "";
  const brandMarkUrl = formData.get("brandMarkUrl")?.toString() || "";
  const brandMarkAlt = formData.get("brandMarkAlt")?.toString() || "";
  const siteIconUrl = formData.get("siteIconUrl")?.toString() || "";
  const siteIconAlt = formData.get("siteIconAlt")?.toString() || "";
  const taglineText = formData.get("taglineText")?.toString() || "";
  const taglineSubtext = formData.get("taglineSubtext")?.toString() || "";

  try {
    // Update individual setting keys in marketing_brand_settings
    await Promise.all([
      updateBrandSettingOwner("header_logo", "Header Logo", {
        url: headerLogoUrl,
        alt: headerLogoAlt,
        variant: "dark",
      }),
      updateBrandSettingOwner("footer_logo", "Footer Logo", {
        url: footerLogoUrl,
        alt: footerLogoAlt,
        variant: "dark",
      }),
      updateBrandSettingOwner("brand_mark", "Brand Mark", {
        url: brandMarkUrl,
        alt: brandMarkAlt,
        variant: "dark",
      }),
      updateBrandSettingOwner("site_icon", "Site Icon", {
        url: siteIconUrl,
        alt: siteIconAlt,
      }),
      updateBrandSettingOwner("brand_tagline", "Brand Tagline & Mission", {
        text: taglineText,
        subtext: taglineSubtext,
      }),
    ]);

    revalidatePath("/marketing");
    revalidatePath("/owner/marketing");
    revalidatePath("/");

    return { success: true, message: "Brand identity settings published live." };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to publish brand settings.",
    };
  }
}
