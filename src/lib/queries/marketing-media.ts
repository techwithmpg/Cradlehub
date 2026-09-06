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
  batchAnalyzeMediaUsage,
  type MediaAssetUsageSummary,
  type MediaUsageContextData,
} from "@/lib/marketing/media-usage-analyzer";
import {
  getPublicSiteAssets,
  getPublicSiteSections,
  type PublicSiteAssetRow,
  type PublicSiteSectionRow,
} from "@/lib/queries/public-site";
import {
  getMarketingContentDrafts,
  type MarketingContentDraftRow,
} from "@/lib/queries/marketing-content";
import { getPublicBranches } from "@/lib/queries/branches";
import { getPublicServiceCatalog } from "@/lib/queries/services";
import { getMediaContract, type MarketingMediaIntentKey } from "@/lib/marketing/media-contracts";

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

export type MarketingBrandSettingRow = {
  id: string;
  setting_key: string;
  label: string;
  value: Record<string, unknown>;
  status: MarketingMediaStatus;
};

export type MarketingSeoSettingRow = {
  id: string;
  route_path: string;
  title: string | null;
  og_image_url: string | null;
  metadata: Record<string, unknown>;
  status: MarketingMediaStatus;
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
    (lower.includes("marketing_media_assets") ||
      lower.includes("marketing_brand_settings") ||
      lower.includes("marketing_seo_settings")) &&
    (lower.includes("does not exist") ||
      lower.includes("schema cache") ||
      lower.includes("could not find"))
  );
}

export async function getMarketingAccessContext(): Promise<MarketingAccessContext | null> {
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
      const matchKey = asset.section_key?.toLowerCase().includes(term);
      return Boolean(matchTitle || matchAlt || matchPath || matchKey);
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

export async function getMarketingMediaUsageContext(): Promise<MediaUsageContextData> {
  const unresolvedStores: string[] = [];

  let sections: PublicSiteSectionRow[] | undefined;
  try {
    sections = await getPublicSiteSections({ includeDisabled: true });
  } catch {
    unresolvedStores.push("public_site_sections");
  }

  let publicAssets: PublicSiteAssetRow[] | undefined;
  try {
    publicAssets = await getPublicSiteAssets("gallery", { includeDisabled: true });
  } catch {
    unresolvedStores.push("public_site_assets");
  }

  let drafts: MarketingContentDraftRow[] | undefined;
  try {
    drafts = await getMarketingContentDrafts();
  } catch {
    unresolvedStores.push("marketing_content_drafts");
  }

  let services:
    | Array<{
        id: string;
        name: string;
        slug?: string;
        imageUrl?: string | null;
        imageAlt?: string | null;
        isPublicBookable?: boolean;
        isCsrOnly?: boolean;
      }>
    | undefined;
  try {
    services = await getPublicServiceCatalog();
  } catch {
    unresolvedStores.push("services");
  }

  let branches:
    | Array<{
        id: string;
        name: string;
        location_metadata?: Record<string, unknown> | null;
        is_active?: boolean;
      }>
    | undefined;
  try {
    const rawBranches = await getPublicBranches();
    branches = (rawBranches ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      location_metadata:
        b.location_metadata &&
        typeof b.location_metadata === "object" &&
        !Array.isArray(b.location_metadata)
          ? (b.location_metadata as Record<string, unknown>)
          : null,
      is_active: b.is_active,
    }));
  } catch {
    unresolvedStores.push("branches");
  }

  let brandSettings:
    | Array<{
        id: string;
        setting_key: string;
        label: string;
        value: Record<string, unknown>;
        status: string;
      }>
    | undefined;
  let seoSettings:
    | Array<{
        id: string;
        route_path: string;
        title?: string | null;
        og_image_url?: string | null;
        metadata?: Record<string, unknown>;
        status: string;
      }>
    | undefined;

  const context = await getMarketingAccessContext();
  if (context) {
    try {
      const { data: brandData, error: brandError } = await context.supabase
        .from("marketing_brand_settings")
        .select("id, setting_key, label, value, status");

      if (brandError) {
        unresolvedStores.push("marketing_brand_settings");
      } else {
        brandSettings = (brandData ?? []).map((b) => ({
          id: b.id,
          setting_key: b.setting_key,
          label: b.label,
          value:
            b.value && typeof b.value === "object" && !Array.isArray(b.value)
              ? (b.value as Record<string, unknown>)
              : {},
          status: b.status,
        }));
      }
    } catch {
      unresolvedStores.push("marketing_brand_settings");
    }

    try {
      const { data: seoData, error: seoError } = await context.supabase
        .from("marketing_seo_settings")
        .select("id, route_path, title, og_image_url, metadata, status");

      if (seoError) {
        unresolvedStores.push("marketing_seo_settings");
      } else {
        seoSettings = (seoData ?? []).map((s) => ({
          id: s.id,
          route_path: s.route_path,
          title: s.title,
          og_image_url: s.og_image_url,
          metadata:
            s.metadata && typeof s.metadata === "object" && !Array.isArray(s.metadata)
              ? (s.metadata as Record<string, unknown>)
              : {},
          status: s.status,
        }));
      }
    } catch {
      unresolvedStores.push("marketing_seo_settings");
    }
  } else {
    unresolvedStores.push("marketing_brand_settings", "marketing_seo_settings");
  }

  return {
    sections,
    publicAssets,
    drafts,
    services,
    branches,
    brandSettings,
    seoSettings,
    unresolvedStores: unresolvedStores.length > 0 ? unresolvedStores : undefined,
  };
}

export async function getMarketingMediaAssetUsage(
  asset: MarketingMediaAssetRow
): Promise<MediaAssetUsageSummary> {
  const usageContext = await getMarketingMediaUsageContext();
  return analyzeMediaAssetUsage(asset, usageContext);
}

export async function getMarketingMediaUsageMap(
  assets: MarketingMediaAssetRow[]
): Promise<Record<string, MediaAssetUsageSummary>> {
  const usageContext = await getMarketingMediaUsageContext();
  const map = batchAnalyzeMediaUsage(assets, usageContext);
  const serializableMap: Record<string, MediaAssetUsageSummary> = {};
  map.forEach((val, key) => {
    serializableMap[key] = val;
  });
  return serializableMap;
}

export async function saveMarketingMediaAsset(
  rawInput: unknown
): Promise<ActionResult<{ asset: MarketingMediaAssetRow; message: string }>> {
  const parsed = marketingMediaAssetInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid media asset payload.",
    };
  }

  const context = await getMarketingAccessContext();
  if (!context) return { success: false, error: "Unauthorized" };

  const { id, bucketPath, publicUrl, title, altText, sectionKey, contentKey, metadata } =
    parsed.data;
  const assetsTable = table<MarketingMediaAssetRow>(context.supabase, "marketing_media_assets");

  if (id) {
    // Fail closed on asset lookup before applying authorization or mutations
    const existing = await assetsTable
      .select("status, bucket_path, public_url, metadata")
      .eq("id", id)
      .maybeSingle();

    if (existing.error) {
      logError("marketing.media_asset_lookup_failed", { error: existing.error, id });
      return {
        success: false,
        error: "Could not verify the current media asset state.",
      };
    }

    if (!existing.data) {
      return {
        success: false,
        error: "Media asset not found.",
      };
    }

    const currentStatus = existing.data.status;
    if (
      context.role === "digital_marketer" &&
      currentStatus !== "draft" &&
      currentStatus !== "submitted"
    ) {
      return {
        success: false,
        error: `Digital marketers can only edit draft or submitted media assets. Current asset is ${currentStatus}.`,
      };
    }

    if (context.role === "owner" && currentStatus === "archived") {
      return {
        success: false,
        error: "Archived media assets cannot be modified. Unarchive the asset first.",
      };
    }

    // Preserve protected system metadata fields from existing record
    const existingMeta = (
      existing.data.metadata && typeof existing.data.metadata === "object"
        ? existing.data.metadata
        : {}
    ) as Record<string, unknown>;

    const protectedFields = [
      "uploadStatus",
      "uploadError",
      "publicUrlCandidate",
      "mimeType",
      "sizeBytes",
      "originalFileName",
      "uploadedAt",
    ];

    let mergedMetadata = existingMeta;
    if (metadata !== undefined && typeof metadata === "object" && metadata !== null) {
      const userMeta = { ...metadata };
      for (const key of protectedFields) {
        if (key in existingMeta) {
          userMeta[key] = existingMeta[key];
        } else {
          delete userMeta[key];
        }
      }
      mergedMetadata = { ...existingMeta, ...userMeta };
    }

    // Immutable storage identity: DO NOT accept client updates to bucket_path or public_url
    const updatePayload: Record<string, unknown> = {
      updated_by: context.staffId,
      metadata: mergedMetadata,
    };

    if (title !== undefined) updatePayload.title = cleanText(title);
    if (altText !== undefined) updatePayload.alt_text = altText;
    if (sectionKey !== undefined) updatePayload.section_key = cleanText(sectionKey);
    if (contentKey !== undefined) updatePayload.content_key = cleanText(contentKey);

    const result = await assetsTable
      .update(updatePayload)
      .eq("id", id)
      .select(MEDIA_ASSET_SELECT)
      .single();

    if (result.error || !result.data) {
      return { success: false, error: result.error?.message ?? "Could not update media asset." };
    }

    revalidateMediaLibrary();
    return { success: true, asset: result.data, message: "Media asset updated." };
  }

  if (!bucketPath) {
    return { success: false, error: "Bucket path is required for new media assets." };
  }

  const insertPayload = {
    bucket_path: bucketPath,
    public_url: publicUrl ?? null,
    title: cleanText(title) || bucketPath.split("/").pop() || "Untitled Image",
    alt_text: altText ?? "Media asset",
    section_key: cleanText(sectionKey),
    content_key: cleanText(contentKey),
    status: "draft",
    metadata: metadata ?? {},
    created_by: context.staffId,
    updated_by: context.staffId,
  };

  const result = await assetsTable.insert(insertPayload).select(MEDIA_ASSET_SELECT).single();

  if (result.error || !result.data) {
    return { success: false, error: result.error?.message ?? "Could not create media asset." };
  }

  revalidateMediaLibrary();
  return { success: true, asset: result.data, message: "Media asset saved as draft." };
}

export async function updateMarketingMediaAssetStatus(
  rawInput: unknown
): Promise<ActionResult<{ asset: MarketingMediaAssetRow; message: string }>> {
  const parsed = marketingMediaStatusUpdateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid status update payload.",
    };
  }

  const context = await getMarketingAccessContext();
  if (!context) return { success: false, error: "Unauthorized" };

  const { id, status } = parsed.data;

  // Generic status updates cannot be used to archive assets.
  // Archiving must go through archiveMarketingMediaAsset to enforce safe usage checks.
  if (status === "archived") {
    return {
      success: false,
      error: "Archiving must be performed through the safe archive action.",
    };
  }

  const assetsTable = table<MarketingMediaAssetRow>(context.supabase, "marketing_media_assets");
  const existing = await assetsTable.select(MEDIA_ASSET_SELECT).eq("id", id).maybeSingle();

  if (existing.error || !existing.data) {
    return { success: false, error: "Media asset not found." };
  }

  const currentStatus = existing.data.status;
  if (currentStatus === status) {
    return { success: true, asset: existing.data, message: "Status already up to date." };
  }

  if (currentStatus === "archived") {
    return {
      success: false,
      error: "Archived media assets cannot have their status updated directly.",
    };
  }

  // Strict Lifecycle State Machine & Role Enforcement
  if (context.role === "digital_marketer") {
    // Marketer can only move draft <-> submitted
    const isAllowedMarketerTransition =
      (currentStatus === "draft" && status === "submitted") ||
      (currentStatus === "submitted" && status === "draft");

    if (!isAllowedMarketerTransition) {
      return {
        success: false,
        error: `Digital marketers can only transition between draft and submitted states. Cannot change from ${currentStatus} to ${status}.`,
      };
    }
  } else {
    // Owner role lifecycle enforcement
    const isAllowedOwnerTransition =
      (currentStatus === "draft" && status === "submitted") ||
      (currentStatus === "submitted" && status === "draft") ||
      (currentStatus === "submitted" && status === "approved") ||
      (currentStatus === "approved" && status === "published") ||
      (currentStatus === "approved" && status === "draft") ||
      (currentStatus === "published" && status === "draft");

    if (!isAllowedOwnerTransition) {
      return {
        success: false,
        error: `Invalid status transition from ${currentStatus} to ${status}.`,
      };
    }
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

  if (existing.data.status === "archived") {
    return { success: false, error: "Asset is already archived." };
  }

  // Strict Archive Safety: Verify ZERO active live references and complete usage coverage
  const usageSummary = await getMarketingMediaAssetUsage(existing.data);
  if (usageSummary.usageUnknown) {
    return {
      success: false,
      error:
        usageSummary.blockingReasons[0] ||
        "Cannot archive asset: usage coverage incomplete. Unable to verify all consumers.",
    };
  }
  if (!usageSummary.canSafelyArchive || usageSummary.totalLiveUsages > 0) {
    return {
      success: false,
      error:
        usageSummary.blockingReasons[0] ??
        `Cannot archive asset: referenced by ${usageSummary.totalLiveUsages} live consumer(s).`,
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
  const mediaIntent = (formData.get("mediaIntent") as string) || "";

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let validatedWidth: number | undefined;
  let validatedHeight: number | undefined;
  let validatedFormat: string | undefined;

  // Intent-based authoritative contract validation
  if (mediaIntent) {
    const validIntents: MarketingMediaIntentKey[] = [
      "HEADER_LOGO",
      "FOOTER_LOGO",
      "BRAND_MARK",
      "SITE_ICON_MASTER",
      "BRANCH_PHOTO",
      "SERVICE_PHOTO",
      "HERO_BACKGROUND",
      "FEATURE_PORTRAIT",
    ];

    if (!validIntents.includes(mediaIntent as MarketingMediaIntentKey)) {
      return { success: false, error: "Invalid media intent specified." };
    }

    const contract = getMediaContract(mediaIntent as MarketingMediaIntentKey);
    const { validateMediaBuffer } = await import("@/lib/marketing/media-contracts-server");
    const validation = await validateMediaBuffer(buffer, file.type, contract);

    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error || `File does not meet requirements for ${contract.purpose}.`,
      };
    }

    validatedWidth = validation.width;
    validatedHeight = validation.height;
    validatedFormat = validation.format;
  } else {
    // Generic fallback validation
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
  }

  const sanitizedFileName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "_")
    .replace(/_{2,}/g, "_");

  const timestamp = Date.now();
  const bucketPath = `media/${timestamp}-${sanitizedFileName}`;

  const title = cleanText(rawTitle) || file.name.replace(/\.[^/.]+$/, "");
  const baseAlt = cleanText(rawAltText) || title || "Public site image";
  const altText = baseAlt.length >= 3 ? baseAlt : `${baseAlt} image`;

  const assetsTable = table<MarketingMediaAssetRow>(context.supabase, "marketing_media_assets");

  // Step 1: Pre-reserve/track draft row in database BEFORE Storage upload
  const draftPayload = {
    bucket_path: bucketPath,
    public_url: null,
    title,
    alt_text: altText,
    section_key: cleanText(sectionKey),
    status: "draft",
    metadata: {
      originalFileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      mediaIntent: mediaIntent || undefined,
      width: validatedWidth,
      height: validatedHeight,
      format: validatedFormat,
      uploadStatus: "pending",
      uploadedAt: new Date().toISOString(),
    },
    created_by: context.staffId,
    updated_by: context.staffId,
  };

  const initialInsert = await assetsTable.insert(draftPayload).select(MEDIA_ASSET_SELECT).single();

  if (initialInsert.error || !initialInsert.data) {
    if (initialInsert.error && isMissingMarketingTableError(initialInsert.error.message)) {
      return {
        success: false,
        error: "Marketing media tables are not available yet in this environment.",
      };
    }
    return {
      success: false,
      error: initialInsert.error?.message ?? "Could not initialize media record for upload.",
    };
  }

  const draftRow = initialInsert.data;

  // Step 2: Upload to Supabase Storage
  try {
    const { error: uploadError } = await context.supabase.storage
      .from(PUBLIC_MEDIA_BUCKET)
      .upload(bucketPath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      logError("marketing.storage_upload_failed", { error: uploadError, bucketPath });

      // Record failed upload status in tracked draft row without deleting
      await assetsTable
        .update({
          metadata: {
            ...draftRow.metadata,
            uploadStatus: "failed",
            uploadError: uploadError.message,
          },
          updated_by: context.staffId,
        })
        .eq("id", draftRow.id);

      return {
        success: false,
        error: `Storage upload failed: ${uploadError.message}`,
      };
    }

    // Step 3: Finalize draft row with public URL
    const {
      data: { publicUrl },
    } = context.supabase.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(bucketPath);

    const finalizedResult = await assetsTable
      .update({
        public_url: publicUrl,
        metadata: {
          ...draftRow.metadata,
          uploadStatus: "completed",
        },
        updated_by: context.staffId,
      })
      .eq("id", draftRow.id)
      .select(MEDIA_ASSET_SELECT)
      .single();

    if (finalizedResult.error || !finalizedResult.data) {
      logError("marketing.media_finalization_failed", {
        error: finalizedResult.error,
        assetId: draftRow.id,
        bucketPath,
      });

      try {
        await assetsTable
          .update({
            metadata: {
              ...draftRow.metadata,
              uploadStatus: "finalization_failed",
              uploadError: finalizedResult.error?.message ?? "Database finalization failed",
              publicUrlCandidate: publicUrl,
            },
            updated_by: context.staffId,
          })
          .eq("id", draftRow.id);
      } catch (metaErr) {
        logError("marketing.media_finalization_meta_update_failed", { error: metaErr });
      }

      revalidateMediaLibrary();
      return {
        success: false,
        error:
          "The media file was stored successfully, but catalog finalization failed. The record remains tracked as incomplete and requires retry or reconciliation.",
      };
    }

    revalidateMediaLibrary();
    return {
      success: true,
      asset: finalizedResult.data,
      message: "Media uploaded and cataloged.",
    };
  } catch (err) {
    logError("marketing.media_upload_exception", { error: err });

    await assetsTable
      .update({
        metadata: {
          ...draftRow.metadata,
          uploadStatus: "failed",
          uploadError: err instanceof Error ? err.message : "Unknown upload error",
        },
        updated_by: context.staffId,
      })
      .eq("id", draftRow.id);

    return {
      success: false,
      error: `Media upload encountered an error: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}
