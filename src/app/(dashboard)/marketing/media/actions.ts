"use server";

import {
  saveMarketingMediaAsset,
  updateMarketingMediaAssetStatus,
  archiveMarketingMediaAsset,
  uploadMarketingMediaFile,
  type MarketingMediaAssetRow,
} from "@/lib/queries/marketing-media";

export type MediaActionState = {
  success?: boolean;
  error?: string;
  message?: string;
  asset?: MarketingMediaAssetRow;
};

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
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

export async function saveMediaMetadataAction(
  prevState: MediaActionState,
  formData: FormData
): Promise<MediaActionState> {
  void prevState;

  const metadata = metadataFromForm(formData);
  if (typeof metadata === "string") {
    return { success: false, error: metadata };
  }

  const result = await saveMarketingMediaAsset({
    id: text(formData, "id") || null,
    title: text(formData, "title"),
    altText: text(formData, "altText"),
    sectionKey: text(formData, "sectionKey") || null,
    contentKey: text(formData, "contentKey") || null,
    bucketPath: text(formData, "bucketPath"),
    publicUrl: text(formData, "publicUrl") || null,
    metadata,
  });

  if (!result.success) return { success: false, error: result.error };
  return { success: true, message: result.message, asset: result.asset };
}

export async function submitMediaForReviewAction(
  prevState: MediaActionState,
  formData: FormData
): Promise<MediaActionState> {
  void prevState;
  const id = text(formData, "id");
  const result = await updateMarketingMediaAssetStatus({ id, status: "submitted" });

  if (!result.success) return { success: false, error: result.error };
  return { success: true, message: result.message, asset: result.asset };
}

export async function approveMediaAssetAction(
  prevState: MediaActionState,
  formData: FormData
): Promise<MediaActionState> {
  void prevState;
  const id = text(formData, "id");
  const result = await updateMarketingMediaAssetStatus({ id, status: "approved" });

  if (!result.success) return { success: false, error: result.error };
  return { success: true, message: result.message, asset: result.asset };
}

export async function publishMediaAssetAction(
  prevState: MediaActionState,
  formData: FormData
): Promise<MediaActionState> {
  void prevState;
  const id = text(formData, "id");
  const result = await updateMarketingMediaAssetStatus({ id, status: "published" });

  if (!result.success) return { success: false, error: result.error };
  return { success: true, message: result.message, asset: result.asset };
}

export async function archiveMediaAssetAction(
  prevState: MediaActionState,
  formData: FormData
): Promise<MediaActionState> {
  void prevState;
  const id = text(formData, "id");
  const reviewNote = text(formData, "reviewNote");
  const result = await archiveMarketingMediaAsset({ id, reviewNote });

  if (!result.success) return { success: false, error: result.error };
  return { success: true, message: result.message, asset: result.asset };
}

export async function uploadMediaFileAction(
  prevState: MediaActionState,
  formData: FormData
): Promise<MediaActionState> {
  void prevState;
  const result = await uploadMarketingMediaFile(formData);

  if (!result.success) return { success: false, error: result.error };
  return { success: true, message: result.message, asset: result.asset };
}
