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

  const rawPackage = formData.get("siteIconPackage")?.toString() || "";
  let parsedPackage: Record<string, unknown> | null = null;
  if (rawPackage) {
    try {
      parsedPackage = JSON.parse(rawPackage);
    } catch {
      // ignore invalid json
    }
  }

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
        ...(parsedPackage ? { package: parsedPackage } : {}),
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

export type GenerateIconState = {
  success?: boolean;
  package?: import("@/lib/marketing/icon-generator").GeneratedSiteIconPackage;
  message?: string;
  error?: string;
};

export async function generateSiteIconAction(
  _prevState: GenerateIconState,
  formData: FormData
): Promise<GenerateIconState> {
  const { generateSiteIconPackageFromBuffer } = await import("@/lib/marketing/icon-generator");

  const file = formData.get("masterFile") as File | null;
  const sourceUrl = formData.get("sourceUrl")?.toString() || "";
  const sourceAssetId = formData.get("sourceAssetId")?.toString() || null;

  let buffer: Buffer | null = null;
  let mime = "";

  if (file && file.size > 0) {
    const arrayBuf = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuf);
    mime = file.type || "image/png";
  } else if (sourceUrl) {
    try {
      // If relative URL or external URL, fetch it
      const fetchUrl = sourceUrl.startsWith("http")
        ? sourceUrl
        : `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${sourceUrl}`;
      const res = await fetch(fetchUrl);
      if (!res.ok) {
        return { success: false, error: `Could not load master image from ${sourceUrl}` };
      }
      const arrayBuf = await res.arrayBuffer();
      buffer = Buffer.from(arrayBuf);
      mime = res.headers.get("content-type") || "image/png";
    } catch (err) {
      return {
        success: false,
        error: `Could not fetch source icon image: ${err instanceof Error ? err.message : "Unknown error"}`,
      };
    }
  }

  if (!buffer) {
    return {
      success: false,
      error: "Please provide a master brand icon file or select an asset from the media library.",
    };
  }

  const result = await generateSiteIconPackageFromBuffer({
    masterBuffer: buffer,
    declaredMime: mime,
    sourceUrl: sourceUrl || "uploaded-master-icon",
    sourceAssetId,
  });

  if (!result.success || !result.package) {
    return { success: false, error: result.error || "Failed to generate site icon package." };
  }

  return {
    success: true,
    package: result.package,
    message: "Site icon package generated successfully (8 variants ready).",
  };
}
