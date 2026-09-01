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
  const { getMarketingAccessContext, getMarketingMediaAssetById, uploadMarketingMediaFile } =
    await import("@/lib/queries/marketing-media");
  const { generateSiteIconPackageFromBuffer } = await import("@/lib/marketing/icon-generator");

  // 1. Marketing Authorization Boundary (digital_marketer or owner only)
  const context = await getMarketingAccessContext();
  if (!context || (context.role !== "owner" && context.role !== "digital_marketer")) {
    return {
      success: false,
      error: "Unauthorized: only digital marketers or owners can generate site icon packages.",
    };
  }

  const file = formData.get("masterFile") as File | null;
  const rawSourceAssetId = formData.get("sourceAssetId")?.toString() || null;

  let buffer: Buffer | null = null;
  let mime = "";
  let sourceUrl = "";
  let sourceAssetId: string | null = rawSourceAssetId;

  // 2. Trusted Asset Flow via Media Library ID
  if (sourceAssetId) {
    const asset = await getMarketingMediaAssetById(sourceAssetId);
    if (!asset || asset.status === "archived") {
      return {
        success: false,
        error: "Selected media asset is invalid, archived, or not found.",
      };
    }

    if (!asset.bucket_path) {
      return {
        success: false,
        error: "Selected media asset does not have a valid storage path.",
      };
    }

    const { data: blob, error: downloadError } = await context.supabase.storage
      .from("public-site-media")
      .download(asset.bucket_path);

    if (downloadError || !blob) {
      return {
        success: false,
        error: `Could not download asset from trusted storage: ${downloadError?.message || "Storage object missing"}`,
      };
    }

    const arrayBuf = await blob.arrayBuffer();
    buffer = Buffer.from(arrayBuf);
    const meta = (asset.metadata || {}) as Record<string, unknown>;
    mime = blob.type || (typeof meta.mimeType === "string" ? meta.mimeType : "image/png");
    sourceUrl = asset.public_url || asset.bucket_path;
  } else if (file && file.size > 0) {
    // 3. Direct Master Upload Flow: Save master asset first to track provenance
    const uploadForm = new FormData();
    uploadForm.append("file", file);
    uploadForm.append("title", "Site Icon Master");
    uploadForm.append("altText", "Master Brand Site Icon");
    uploadForm.append("mediaIntent", "SITE_ICON_MASTER");

    const uploadRes = await uploadMarketingMediaFile(uploadForm);
    if (!uploadRes.success) {
      return {
        success: false,
        error: uploadRes.error || "Failed to validate and store master icon asset.",
      };
    }

    sourceAssetId = uploadRes.asset.id;
    sourceUrl = uploadRes.asset.public_url || uploadRes.asset.bucket_path;
    const arrayBuf = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuf);
    mime = file.type || "image/png";
  }

  if (!buffer) {
    return {
      success: false,
      error: "Please provide a master brand icon file or select an active asset from the media library.",
    };
  }

  // 4. Generate derived package from trusted buffer
  const result = await generateSiteIconPackageFromBuffer({
    masterBuffer: buffer,
    declaredMime: mime,
    sourceUrl,
    sourceAssetId,
  });

  if (!result.success || !result.package) {
    return { success: false, error: result.error || "Failed to generate site icon package." };
  }

  return {
    success: true,
    package: result.package,
    message: "Site icon package generated successfully (7 variants ready).",
  };
}
