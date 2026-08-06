"use server";

import {
  saveMarketingContentDraft,
  submitMarketingContentDraft,
  type MarketingContentDraftRow,
} from "@/lib/queries/marketing-content";

export type MarketingDraftActionState = {
  success?: boolean;
  error?: string;
  message?: string;
  draft?: MarketingContentDraftRow;
};

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

function numberValue(formData: FormData, name: string): number {
  const value = Number(formData.get(name));
  return Number.isFinite(value) ? value : 0;
}

function metadataFromForm(formData: FormData): Record<string, unknown> | string {
  const raw = text(formData, "metadataJson").trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return "Metadata must be valid JSON.";
  }

  return "Metadata must be a JSON object.";
}

export async function saveMarketingDraftAction(
  prevState: MarketingDraftActionState,
  formData: FormData
): Promise<MarketingDraftActionState> {
  void prevState;
  const metadata = metadataFromForm(formData);
  if (typeof metadata === "string") {
    return { success: false, error: metadata };
  }

  const result = await saveMarketingContentDraft({
    id: text(formData, "id") || null,
    contentType: text(formData, "contentType") || "section",
    contentKey: text(formData, "contentKey"),
    title: text(formData, "title"),
    subtitle: text(formData, "subtitle"),
    body: text(formData, "body"),
    ctaLabel: text(formData, "ctaLabel"),
    ctaHref: text(formData, "ctaHref"),
    imageUrl: text(formData, "imageUrl"),
    secondaryImageUrl: text(formData, "secondaryImageUrl"),
    altText: text(formData, "altText"),
    linkHref: text(formData, "linkHref"),
    sortOrder: numberValue(formData, "sortOrder"),
    isEnabled: formData.get("isEnabled") === "on",
    metadata,
  });

  if (!result.success) return { success: false, error: result.error };
  return { success: true, message: result.message, draft: result.draft };
}

export async function submitMarketingDraftAction(
  prevState: MarketingDraftActionState,
  formData: FormData
): Promise<MarketingDraftActionState> {
  void prevState;
  const result = await submitMarketingContentDraft({ id: text(formData, "id") });

  if (!result.success) return { success: false, error: result.error };
  return { success: true, message: result.message, draft: result.draft };
}
