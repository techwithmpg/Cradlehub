"use server";

import { revalidatePath } from "next/cache";
import { updateBrandSettingsBatchOwner } from "@/lib/queries/marketing-brand";

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

  const batchPayload = [
    {
      settingKey: "header_logo",
      label: "Header Logo",
      value: {
        url: headerLogoUrl,
        alt: headerLogoAlt,
        variant: "dark" as const,
      },
    },
    {
      settingKey: "footer_logo",
      label: "Footer Logo",
      value: {
        url: footerLogoUrl,
        alt: footerLogoAlt,
        variant: "dark" as const,
      },
    },
    {
      settingKey: "brand_mark",
      label: "Brand Mark",
      value: {
        url: brandMarkUrl,
        alt: brandMarkAlt,
        variant: "dark" as const,
      },
    },
    {
      settingKey: "site_icon",
      label: "Site Icon",
      value: {
        url: siteIconUrl,
        alt: siteIconAlt,
      },
    },
    {
      settingKey: "brand_tagline",
      label: "Brand Tagline & Mission",
      value: {
        text: taglineText,
        subtext: taglineSubtext,
      },
    },
  ];

  const result = await updateBrandSettingsBatchOwner(batchPayload);
  if (!result.success) {
    return {
      success: false,
      error: result.error ?? "Failed to publish brand settings live.",
    };
  }

  revalidatePath("/marketing");
  revalidatePath("/owner/marketing");
  revalidatePath("/(public)", "layout");
  revalidatePath("/");

  return { success: true, message: "Brand identity settings published live." };
}
