"use server";

import {
  createPublicSiteAsset,
  disablePublicSiteAsset,
  updatePublicSiteAsset,
  updatePublicSiteSection,
} from "@/lib/queries/public-site";

export type MarketingActionState = {
  success?: boolean;
  error?: string;
  message?: string;
};

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

function numberValue(formData: FormData, name: string): number {
  const value = Number(formData.get(name));
  return Number.isFinite(value) ? value : 0;
}

function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildSectionMetadata(sectionKey: string, formData: FormData) {
  if (sectionKey === "hero") {
    return {
      secondaryCtaLabel: text(formData, "secondaryCtaLabel"),
      secondaryCtaHref: text(formData, "secondaryCtaHref"),
    };
  }

  if (sectionKey === "before_you_book") {
    return {
      items: lines(text(formData, "items")),
    };
  }

  return {};
}

export async function saveMarketingSectionAction(
  prevState: MarketingActionState,
  formData: FormData
): Promise<MarketingActionState> {
  void prevState;
  const sectionKey = text(formData, "sectionKey");
  const result = await updatePublicSiteSection({
    sectionKey,
    title: text(formData, "title"),
    subtitle: text(formData, "subtitle"),
    body: text(formData, "body"),
    ctaLabel: text(formData, "ctaLabel"),
    ctaHref: text(formData, "ctaHref"),
    imageUrl: text(formData, "imageUrl"),
    secondaryImageUrl: text(formData, "secondaryImageUrl"),
    sortOrder: numberValue(formData, "sortOrder"),
    isEnabled: formData.get("isEnabled") === "on",
    metadata: buildSectionMetadata(sectionKey, formData),
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, message: "Section saved." };
}

export async function createMarketingAssetAction(
  prevState: MarketingActionState,
  formData: FormData
): Promise<MarketingActionState> {
  void prevState;
  const result = await createPublicSiteAsset({
    sectionKey: text(formData, "sectionKey"),
    title: text(formData, "title"),
    altText: text(formData, "altText"),
    imageUrl: text(formData, "imageUrl"),
    linkHref: text(formData, "linkHref"),
    sortOrder: numberValue(formData, "sortOrder"),
    isEnabled: formData.get("isEnabled") === "on",
    metadata: {},
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, message: "Asset added." };
}

export async function updateMarketingAssetAction(
  prevState: MarketingActionState,
  formData: FormData
): Promise<MarketingActionState> {
  void prevState;
  const result = await updatePublicSiteAsset({
    id: text(formData, "id"),
    sectionKey: text(formData, "sectionKey"),
    title: text(formData, "title"),
    altText: text(formData, "altText"),
    imageUrl: text(formData, "imageUrl"),
    linkHref: text(formData, "linkHref"),
    sortOrder: numberValue(formData, "sortOrder"),
    isEnabled: formData.get("isEnabled") === "on",
    metadata: {},
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, message: "Asset saved." };
}

export async function disableMarketingAssetAction(
  prevState: MarketingActionState,
  formData: FormData
): Promise<MarketingActionState> {
  void prevState;
  const result = await disablePublicSiteAsset({
    id: text(formData, "id"),
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, message: "Asset disabled." };
}
