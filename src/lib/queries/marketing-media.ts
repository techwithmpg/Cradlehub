import "server-only";

import { revalidatePath } from "next/cache";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { logError } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import {
  marketingMediaAssetInputSchema,
  marketingMediaStatusUpdateSchema,
  marketingMediaArchiveSchema,
  type MarketingMediaStatus,
} from "@/lib/validations/marketing";
import {
  analyzeMediaAssetUsage,
  type MediaAssetUsageSummary,
} from "@/lib/marketing/media-usage-analyzer";
import { getPublicSiteAssets, getPublicSiteSections } from "@/lib/queries/public-site";
import { getMarketingContentDrafts } from "@/lib/queries/marketing-content";
import { getPublicServiceCatalog } from "@/lib/queries/services";

export type MarketingMediaAssetRow = {
  id: string;
  bucket_path: string;
  public_url: string | null;
  title: string | null;
  alt_text: string;
  section_key: string | null;
  content_key: string | null;
  status: MarketingMediaStatus;
  metadata: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ActionResult<T extends object | undefined = undefined> =
  | (T extends object ? { success: true } & T : { success: true })
  | { success: false; error: string };

type DbError = { message: string };
type QueryList<T> = { data: T[] | null; error: DbError | null };
type QuerySingle<T> = { data: T | null; error: DbError | null };
type OrderOptions = { ascending?: boolean; nullsFirst?: boolean };

type SelectBuilder<T> = PromiseLike<QueryList<T>> & {
  eq(column: string, value: unknown): SelectBuilder<T>;
  in(column: string, values: readonly unknown[]): SelectBuilder<T>;
  order(column: string, options?: OrderOptions): SelectBuilder<T>;
  limit(count: number): SelectBuilder<T>;
  maybeSingle(): Promise<QuerySingle<T>>;
  single(): Promise<QuerySingle<T>>;
};

type MutationBuilder<T> = {
  select(columns: string): SelectBuilder<T>;
};

type MutationFilterBuilder<T> = {
  eq(column: string, value: unknown): MutationFilterBuilder<T>;
  select(columns: string): SelectBuilder<T>;
};

type UntypedTable<T> = {
  select(columns: string): SelectBuilder<T>;
  insert(value: Record<string, unknown> | readonly Record<string, unknown>[]): MutationBuilder<T>;
  update(value: Record<string, unknown>): MutationFilterBuilder<T>;
};

type MarketingAccessContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  staffId: string | null;
  role: "owner" | "digital_marketer";
};

const MEDIA_ASSET_SELECT =
  "id, bucket_path, public_url, title, alt_text, section_key, content_key, status, metadata, created_by, updated_by, reviewed_by, reviewed_at, created_at, updated_at";

const PUBLIC_MEDIA_BUCKET = "public-site-media";

function table<T>(client: unknown, tableName: string): UntypedTable<T> {
  return (client as { from: (name: string) => UntypedTable<T> }).from(tableName);
}

function cleanText(value?: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function isMissingMarketingTableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("marketing_media_assets") &&
    (lower.includes("does not exist") ||
      lower.includes("schema cache") ||
      lower.includes("could not find"))
  );
}

async function getMarketingAccessContext(): Promise<MarketingAccessContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isDevAuthBypassEnabled()) {
      return { supabase, staffId: null, role: "owner" };
    }
    return null;
  }

  const { data: me, error } = await supabase
    .from("staff")
    .select("id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    logError("marketing.media_access_lookup_failed", { userId: user.id, error });
    return null;
  }

  if (me?.system_role === "owner" || me?.system_role === "digital_marketer") {
    return { supabase, staffId: me.id, role: me.system_role };
  }

  if (isDevAuthBypassEnabled()) {
    return { supabase, staffId: null, role: "owner" };
  }

  return null;
}

function revalidateMediaLibrary() {
  revalidatePath("/marketing/media");
  revalidatePath("/marketing");
  revalidatePath("/owner/marketing");
}

export async function getMarketingMediaAssets(filters?: {
  status?: string;
  search?: string;
  sectionKey?: string;
  limit?: number;
}): Promise<MarketingMediaAssetRow[]> {
  const context = await getMarketingAccessContext();
  if (!context) return [];

  let query = table<MarketingMediaAssetRow>(context.supabase, "marketing_media_assets")
    .select(MEDIA_ASSET_SELECT)
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.sectionKey) {
    query = query.eq("section_key", filters.sectionKey);
  }

  const limit = Math.max(1, Math.min(200, filters?.limit ?? 100));
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    if (isMissingMarketingTableError(error.message)) return [];
    logError("marketing.media_assets_query_failed", { error });
    return [];
  }

  let assets = data ?? [];

  if (filters?.search && filters.search.trim().length > 0) {
    const term = filters.search.trim().toLowerCase();
    assets = assets.filter((asset) => {
      const matchTitle = asset.title?.toLowerCase().includes(term);
      const matchAlt = asset.alt_text?.toLowerCase().includes(term);
      const matchPath = asset.bucket_path?.toLowerCase().includes(term);
      const matchSection = asset.section_key?.toLowerCase().includes(term);
      return Boolean(matchTitle || matchAlt || matchPath || matchSection);
    });
  }

  return assets;
}

export async function getMarketingMediaAssetById(
  id: string
): Promise<MarketingMediaAssetRow | null> {
  const context = await getMarketingAccessContext();
  if (!context) return null;

  const { data, error } = await table<MarketingMediaAssetRow>(
    context.supabase,
    "marketing_media_assets"
  )
    .select(MEDIA_ASSET_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (isMissingMarketingTableError(error.message)) return null;
    logError("marketing.media_asset_lookup_failed", { id, error });
    return null;
  }

  return data;
}

export async function getMarketingMediaAssetUsage(
  asset: MarketingMediaAssetRow
): Promise<MediaAssetUsageSummary> {
  const [sections, publicAssets, drafts, services] = await Promise.all([
    getPublicSiteSections({ includeDisabled: true }),
    getPublicSiteAssets("gallery", { includeDisabled: true }),
    getMarketingContentDrafts(),
    getPublicServiceCatalog(),
  ]);

  return analyzeMediaAssetUsage(asset, {
    sections,
    publicAssets,
    drafts,
    services,
  });
}

export async function saveMarketingMediaAsset(
  rawInput: unknown
): Promise<ActionResult<{ asset: MarketingMediaAssetRow; message: string }>> {
  const parsed = marketingMediaAssetInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Please check the media asset details.",
    };
  }

  const context = await getMarketingAccessContext();
  if (!context) return { success: false, error: "Unauthorized" };

  const input = parsed.data;
  const assetsTable = table<MarketingMediaAssetRow>(context.supabase, "marketing_media_assets");

  if (input.id) {
    const existing = await assetsTable.select(MEDIA_ASSET_SELECT).eq("id", input.id).maybeSingle();

    if (existing.error) {
      return { success: false, error: existing.error.message };
    }
    if (!existing.data) {
      return { success: false, error: "Media asset not found." };
    }

    if (context.role !== "owner" && existing.data.status === "archived") {
      return { success: false, error: "Archived media assets cannot be modified." };
    }

    const payload = {
      title: cleanText(input.title),
      alt_text: input.altText.trim(),
      section_key: cleanText(input.sectionKey),
      content_key: cleanText(input.contentKey),
      metadata: input.metadata,
      updated_by: context.staffId,
    };

    const result = await assetsTable
      .update(payload)
      .eq("id", input.id)
      .select(MEDIA_ASSET_SELECT)
      .single();

    if (result.error || !result.data) {
      return { success: false, error: result.error?.message ?? "Could not update media asset." };
    }

    revalidateMediaLibrary();
    return { success: true, asset: result.data, message: "Media details updated." };
  }

  // Create new asset row
  const payload = {
    bucket_path: input.bucketPath.trim(),
    public_url: cleanText(input.publicUrl),
    title: cleanText(input.title),
    alt_text: input.altText.trim(),
    section_key: cleanText(input.sectionKey),
    content_key: cleanText(input.contentKey),
    status: "draft",
    metadata: input.metadata,
    created_by: context.staffId,
    updated_by: context.staffId,
  };

  const result = await assetsTable.insert(payload).select(MEDIA_ASSET_SELECT).single();

  if (result.error || !result.data) {
    if (result.error && isMissingMarketingTableError(result.error.message)) {
      return {
        success: false,
        error: "Marketing media tables are not available yet in this environment.",
      };
    }
    return { success: false, error: result.error?.message ?? "Could not create media asset." };
  }

  revalidateMediaLibrary();
  return { success: true, asset: result.data, message: "Media asset created." };
}

export async function updateMarketingMediaAssetStatus(
  rawInput: unknown
): Promise<ActionResult<{ asset: MarketingMediaAssetRow; message: string }>> {
  const parsed = marketingMediaStatusUpdateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid status update request.",
    };
  }

  const context = await getMarketingAccessContext();
  if (!context) return { success: false, error: "Unauthorized" };

  const { id, status } = parsed.data;

  // Digital Marketer can only transition draft <-> submitted
  if (context.role !== "owner") {
    if (!["draft", "submitted"].includes(status)) {
      return {
        success: false,
        error: "Only the Owner can approve, publish, or archive media assets.",
      };
    }
  }

  const assetsTable = table<MarketingMediaAssetRow>(context.supabase, "marketing_media_assets");
  const existing = await assetsTable.select(MEDIA_ASSET_SELECT).eq("id", id).maybeSingle();

  if (existing.error || !existing.data) {
    return { success: false, error: "Media asset not found." };
  }

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    status,
    updated_by: context.staffId,
  };

  if (status === "approved" || status === "published") {
    payload.reviewed_by = context.staffId;
    payload.reviewed_at = now;
  }

  const result = await assetsTable.update(payload).eq("id", id).select(MEDIA_ASSET_SELECT).single();

  if (result.error || !result.data) {
    return { success: false, error: result.error?.message ?? "Could not update media status." };
  }

  revalidateMediaLibrary();
  return {
    success: true,
    asset: result.data,
    message: `Media status changed to ${status}.`,
  };
}

export async function archiveMarketingMediaAsset(
  rawInput: unknown
): Promise<ActionResult<{ asset: MarketingMediaAssetRow; message: string }>> {
  const parsed = marketingMediaArchiveSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid archive request.",
    };
  }

  const context = await getMarketingAccessContext();
  if (!context) return { success: false, error: "Unauthorized" };
  if (context.role !== "owner") {
    return { success: false, error: "Only the Owner can finalize archiving media assets." };
  }

  const assetsTable = table<MarketingMediaAssetRow>(context.supabase, "marketing_media_assets");
  const existing = await assetsTable
    .select(MEDIA_ASSET_SELECT)
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (existing.error || !existing.data) {
    return { success: false, error: "Media asset not found." };
  }

  // Strict Archive Safety: Verify ZERO active live references
  const usageSummary = await getMarketingMediaAssetUsage(existing.data);
  if (!usageSummary.canSafelyArchive) {
    return {
      success: false,
      error:
        usageSummary.blockingReasons[0] ??
        "Cannot archive asset: it is currently referenced by live public site sections or services.",
    };
  }

  const now = new Date().toISOString();
  const result = await assetsTable
    .update({
      status: "archived",
      reviewed_by: context.staffId,
      reviewed_at: now,
      updated_by: context.staffId,
    })
    .eq("id", parsed.data.id)
    .select(MEDIA_ASSET_SELECT)
    .single();

  if (result.error || !result.data) {
    return { success: false, error: result.error?.message ?? "Could not archive media asset." };
  }

  revalidateMediaLibrary();
  return { success: true, asset: result.data, message: "Media asset archived safely." };
}

export async function uploadMarketingMediaFile(
  formData: FormData
): Promise<ActionResult<{ asset: MarketingMediaAssetRow; message: string }>> {
  const context = await getMarketingAccessContext();
  if (!context) return { success: false, error: "Unauthorized" };

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return { success: false, error: "Please choose a valid file to upload." };
  }

  const rawTitle = (formData.get("title") as string) || "";
  const rawAltText = (formData.get("altText") as string) || "";
  const sectionKey = (formData.get("sectionKey") as string) || "";

  // Validation
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/svg+xml",
    "image/gif",
  ];
  if (!allowedMimeTypes.includes(file.type.toLowerCase())) {
    return {
      success: false,
      error: "Unsupported file type. Please upload a JPG, PNG, WebP, SVG, or GIF image.",
    };
  }

  const maxBytes = 10 * 1024 * 1024; // 10MB
  if (file.size > maxBytes) {
    return {
      success: false,
      error: "File size exceeds 10MB limit. Please upload an optimized image.",
    };
  }

  const sanitizedFileName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "_")
    .replace(/_{2,}/g, "_");

  const timestamp = Date.now();
  const bucketPath = `media/${timestamp}-${sanitizedFileName}`;

  // Upload to Supabase Storage
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await context.supabase.storage
      .from(PUBLIC_MEDIA_BUCKET)
      .upload(bucketPath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      logError("marketing.storage_upload_failed", { error: uploadError, bucketPath });
      return {
        success: false,
        error: `Storage upload failed: ${uploadError.message}`,
      };
    }

    const {
      data: { publicUrl },
    } = context.supabase.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(bucketPath);

    const title = cleanText(rawTitle) || file.name.replace(/\.[^/.]+$/, "");
    const altText = cleanText(rawAltText) || title || "Public site image";

    const metadata = {
      originalFileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      uploadedAt: new Date().toISOString(),
    };

    return saveMarketingMediaAsset({
      bucketPath,
      publicUrl,
      title,
      altText: altText.length >= 3 ? altText : `${altText} image`,
      sectionKey: cleanText(sectionKey),
      metadata,
    });
  } catch (err) {
    logError("marketing.media_upload_exception", { error: err });
    return {
      success: false,
      error: "An unexpected error occurred while processing the upload.",
    };
  }
}
