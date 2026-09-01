import "server-only";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { logError } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import {
  MARKETING_DRAFT_STATUSES,
  MARKETING_MUTABLE_DRAFT_STATUSES,
  MARKETING_CONTENT_TYPES,
  marketingContentDraftIdSchema,
  marketingContentDraftInputSchema,
  marketingDraftReviewSchema,
  marketingDraftScheduleSchema,
  type MarketingContentDraftInput,
} from "@/lib/validations/marketing";
import { updatePublicSiteSection } from "@/lib/queries/public-site";
import { validateTrustedSiteIconPackage } from "@/lib/marketing/icon-package-validator";

export type MarketingContentType = (typeof MARKETING_CONTENT_TYPES)[number];
export type MarketingDraftStatus = (typeof MARKETING_DRAFT_STATUSES)[number];
export type MarketingRevisionAction =
  | "created"
  | "saved"
  | "submitted"
  | "changes_requested"
  | "approved"
  | "scheduled"
  | "published"
  | "rolled_back"
  | "archived";

export type MarketingContentDraftRow = {
  id: string;
  content_type: MarketingContentType;
  content_key: string;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  cta_label: string | null;
  cta_href: string | null;
  image_url: string | null;
  secondary_image_url: string | null;
  alt_text: string | null;
  link_href: string | null;
  sort_order: number;
  is_enabled: boolean;
  metadata: Record<string, unknown>;
  status: MarketingDraftStatus;
  scheduled_for: string | null;
  source_section_id: string | null;
  source_asset_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  published_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketingContentRevisionRow = {
  id: string;
  draft_id: string;
  revision_no: number;
  action: MarketingRevisionAction;
  snapshot: Record<string, unknown>;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

type ActionResult<T extends object | undefined = undefined> =
  | (T extends object ? { success: true } & T : { success: true })
  | { success: false; error: string };

type DbError = { message: string };
type QueryList<T> = { data: T[] | null; error: DbError | null };
type QuerySingle<T> = { data: T | null; error: DbError | null };
type OrderOptions = {
  ascending?: boolean;
  nullsFirst?: boolean;
  referencedTable?: string;
};

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

const DRAFT_SELECT =
  "id, content_type, content_key, title, subtitle, body, cta_label, cta_href, image_url, secondary_image_url, alt_text, link_href, sort_order, is_enabled, metadata, status, scheduled_for, source_section_id, source_asset_id, created_by, updated_by, submitted_by, submitted_at, reviewed_by, reviewed_at, review_note, published_by, published_at, created_at, updated_at";

const REVISION_SELECT = "id, draft_id, revision_no, action, snapshot, note, created_by, created_at";

function table<T>(client: unknown, tableName: string): UntypedTable<T> {
  return (client as { from: (name: string) => UntypedTable<T> }).from(tableName);
}

function cleanText(value?: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function cleanOptionalDate(value?: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isMissingMarketingTableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    (lower.includes("marketing_content_drafts") ||
      lower.includes("marketing_content_revisions") ||
      lower.includes("marketing_media_assets") ||
      lower.includes("marketing_brand_settings") ||
      lower.includes("marketing_seo_settings")) &&
    (lower.includes("does not exist") ||
      lower.includes("schema cache") ||
      lower.includes("could not find"))
  );
}

function migrationUnavailableError(): string {
  return "Marketing draft tables are not available yet. Review and apply the Phase 3 Supabase migration first.";
}

function isMutableDraftStatus(status: string): boolean {
  return (MARKETING_MUTABLE_DRAFT_STATUSES as readonly string[]).includes(status);
}

function draftSnapshot(draft: MarketingContentDraftRow): Record<string, unknown> {
  return {
    contentType: draft.content_type,
    contentKey: draft.content_key,
    title: draft.title,
    subtitle: draft.subtitle,
    body: draft.body,
    ctaLabel: draft.cta_label,
    ctaHref: draft.cta_href,
    imageUrl: draft.image_url,
    secondaryImageUrl: draft.secondary_image_url,
    altText: draft.alt_text,
    linkHref: draft.link_href,
    sortOrder: draft.sort_order,
    isEnabled: draft.is_enabled,
    metadata: draft.metadata,
    status: draft.status,
    scheduledFor: draft.scheduled_for,
  };
}

export async function getMarketingAccessContext(): Promise<MarketingAccessContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: me, error } = await supabase
    .from("staff")
    .select("id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    logError("marketing.access_lookup_failed", { userId: user.id, error });
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

async function findDraft(
  supabase: unknown,
  input: Pick<MarketingContentDraftInput, "id" | "contentType" | "contentKey">
): Promise<QuerySingle<MarketingContentDraftRow>> {
  if (input.id) {
    return table<MarketingContentDraftRow>(supabase, "marketing_content_drafts")
      .select(DRAFT_SELECT)
      .eq("id", input.id)
      .maybeSingle();
  }

  const result = await table<MarketingContentDraftRow>(supabase, "marketing_content_drafts")
    .select(DRAFT_SELECT)
    .eq("content_type", input.contentType)
    .eq("content_key", input.contentKey)
    .in("status", MARKETING_MUTABLE_DRAFT_STATUSES)
    .order("updated_at", { ascending: false })
    .limit(1);

  return { data: result.data?.[0] ?? null, error: result.error };
}

async function insertMarketingRevision(
  supabase: unknown,
  draft: MarketingContentDraftRow,
  action: MarketingRevisionAction,
  staffId: string | null,
  note?: string | null
): Promise<void> {
  const revisions = table<MarketingContentRevisionRow>(supabase, "marketing_content_revisions");
  const latest = await revisions
    .select(REVISION_SELECT)
    .eq("draft_id", draft.id)
    .order("revision_no", { ascending: false })
    .limit(1);

  if (latest.error) {
    logError("marketing.revision_lookup_failed", { draftId: draft.id, error: latest.error });
    return;
  }

  const revisionNo = (latest.data?.[0]?.revision_no ?? 0) + 1;
  const inserted = await revisions.insert({
    draft_id: draft.id,
    revision_no: revisionNo,
    action,
    snapshot: draftSnapshot(draft),
    note: cleanText(note),
    created_by: staffId,
  });
  const { error } = await inserted.select(REVISION_SELECT).single();

  if (error) {
    logError("marketing.revision_insert_failed", { draftId: draft.id, action, error });
  }
}

function revalidateMarketingWorkspace() {
  revalidatePath("/marketing");
  revalidatePath("/owner/marketing");
}

function revalidatePublishedSite() {
  revalidatePath("/");
  revalidateMarketingWorkspace();
}

function isOwnerContext(context: MarketingAccessContext): boolean {
  return context.role === "owner";
}

export async function getMarketingContentDrafts(): Promise<MarketingContentDraftRow[]> {
  const context = await getMarketingAccessContext();
  if (!context) return [];

  const { data, error } = await table<MarketingContentDraftRow>(
    context.supabase,
    "marketing_content_drafts"
  )
    .select(DRAFT_SELECT)
    .order("updated_at", { ascending: false })
    .limit(80);

  if (error) {
    if (isMissingMarketingTableError(error.message)) return [];
    logError("marketing.draft_query_failed", { error });
    return [];
  }

  return data ?? [];
}

export async function getMarketingContentRevisions(
  limit = 12
): Promise<MarketingContentRevisionRow[]> {
  const context = await getMarketingAccessContext();
  if (!context) return [];

  const { data, error } = await table<MarketingContentRevisionRow>(
    context.supabase,
    "marketing_content_revisions"
  )
    .select(REVISION_SELECT)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(30, Math.floor(limit))));

  if (error) {
    if (isMissingMarketingTableError(error.message)) return [];
    logError("marketing.revision_query_failed", { error });
    return [];
  }

  return data ?? [];
}

export async function saveMarketingContentDraft(
  rawInput: unknown
): Promise<ActionResult<{ draft: MarketingContentDraftRow; message: string }>> {
  const parsed = marketingContentDraftInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Please check the draft details.",
    };
  }

  const context = await getMarketingAccessContext();
  if (!context) return { success: false, error: "Unauthorized" };

  const input = parsed.data;
  const existing = await findDraft(context.supabase, input);
  if (existing.error) {
    if (isMissingMarketingTableError(existing.error.message)) {
      return { success: false, error: migrationUnavailableError() };
    }
    return { success: false, error: existing.error.message };
  }

  if (context.role !== "owner" && existing.data && !isMutableDraftStatus(existing.data.status)) {
    return { success: false, error: "This draft is locked for owner review." };
  }

  const payload = {
    content_type: input.contentType,
    content_key: input.contentKey,
    title: cleanText(input.title),
    subtitle: cleanText(input.subtitle),
    body: cleanText(input.body),
    cta_label: cleanText(input.ctaLabel),
    cta_href: cleanText(input.ctaHref),
    image_url: cleanText(input.imageUrl),
    secondary_image_url: cleanText(input.secondaryImageUrl),
    alt_text: cleanText(input.altText),
    link_href: cleanText(input.linkHref),
    sort_order: input.sortOrder,
    is_enabled: input.isEnabled,
    metadata: input.metadata,
    updated_by: context.staffId,
  };

  const drafts = table<MarketingContentDraftRow>(context.supabase, "marketing_content_drafts");
  const result = existing.data
    ? await drafts.update(payload).eq("id", existing.data.id).select(DRAFT_SELECT).single()
    : await drafts
        .insert({
          ...payload,
          status: "draft",
          created_by: context.staffId,
        })
        .select(DRAFT_SELECT)
        .single();

  if (result.error || !result.data) {
    if (result.error && isMissingMarketingTableError(result.error.message)) {
      return { success: false, error: migrationUnavailableError() };
    }
    return { success: false, error: result.error?.message ?? "Could not save draft." };
  }

  await insertMarketingRevision(
    context.supabase,
    result.data,
    existing.data ? "saved" : "created",
    context.staffId
  );
  revalidateMarketingWorkspace();

  return { success: true, draft: result.data, message: "Draft saved." };
}

export async function submitMarketingContentDraft(
  rawInput: unknown
): Promise<ActionResult<{ draft: MarketingContentDraftRow; message: string }>> {
  const parsed = marketingContentDraftIdSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid draft ID." };
  }

  const context = await getMarketingAccessContext();
  if (!context) return { success: false, error: "Unauthorized" };

  const existing = await findDraft(context.supabase, {
    id: parsed.data.id,
    contentType: "section",
    contentKey: "draft",
  });
  if (existing.error) {
    if (isMissingMarketingTableError(existing.error.message)) {
      return { success: false, error: migrationUnavailableError() };
    }
    return { success: false, error: existing.error.message };
  }
  if (!existing.data) return { success: false, error: "Draft not found." };
  if (context.role !== "owner" && !isMutableDraftStatus(existing.data.status)) {
    return { success: false, error: "This draft is locked for owner review." };
  }

  const now = new Date().toISOString();
  const result = await table<MarketingContentDraftRow>(context.supabase, "marketing_content_drafts")
    .update({
      status: "submitted",
      submitted_by: context.staffId,
      submitted_at: now,
      updated_by: context.staffId,
      review_note: null,
    })
    .eq("id", existing.data.id)
    .select(DRAFT_SELECT)
    .single();

  if (result.error || !result.data) {
    if (result.error && isMissingMarketingTableError(result.error.message)) {
      return { success: false, error: migrationUnavailableError() };
    }
    return { success: false, error: result.error?.message ?? "Could not submit draft." };
  }

  await insertMarketingRevision(context.supabase, result.data, "submitted", context.staffId);
  revalidateMarketingWorkspace();

  return { success: true, draft: result.data, message: "Draft submitted for owner review." };
}

export async function requestMarketingContentChanges(
  rawInput: unknown
): Promise<ActionResult<{ draft: MarketingContentDraftRow; message: string }>> {
  const parsed = marketingDraftReviewSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid review request." };
  }

  const context = await getMarketingAccessContext();
  if (!context) return { success: false, error: "Unauthorized" };
  if (!isOwnerContext(context)) return { success: false, error: "Owner approval is required." };

  const now = new Date().toISOString();
  const result = await table<MarketingContentDraftRow>(context.supabase, "marketing_content_drafts")
    .update({
      status: "changes_requested",
      reviewed_by: context.staffId,
      reviewed_at: now,
      review_note: cleanText(parsed.data.reviewNote),
      updated_by: context.staffId,
    })
    .eq("id", parsed.data.id)
    .select(DRAFT_SELECT)
    .single();

  if (result.error || !result.data) {
    if (result.error && isMissingMarketingTableError(result.error.message)) {
      return { success: false, error: migrationUnavailableError() };
    }
    return { success: false, error: result.error?.message ?? "Could not request changes." };
  }

  await insertMarketingRevision(
    context.supabase,
    result.data,
    "changes_requested",
    context.staffId,
    parsed.data.reviewNote
  );
  revalidateMarketingWorkspace();
  return { success: true, draft: result.data, message: "Changes requested." };
}

export async function approveMarketingContentDraft(
  rawInput: unknown
): Promise<ActionResult<{ draft: MarketingContentDraftRow; message: string }>> {
  const parsed = marketingDraftReviewSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid approval request.",
    };
  }

  const context = await getMarketingAccessContext();
  if (!context) return { success: false, error: "Unauthorized" };
  if (!isOwnerContext(context)) return { success: false, error: "Owner approval is required." };

  const now = new Date().toISOString();
  const result = await table<MarketingContentDraftRow>(context.supabase, "marketing_content_drafts")
    .update({
      status: "approved",
      reviewed_by: context.staffId,
      reviewed_at: now,
      review_note: cleanText(parsed.data.reviewNote),
      updated_by: context.staffId,
    })
    .eq("id", parsed.data.id)
    .select(DRAFT_SELECT)
    .single();

  if (result.error || !result.data) {
    if (result.error && isMissingMarketingTableError(result.error.message)) {
      return { success: false, error: migrationUnavailableError() };
    }
    return { success: false, error: result.error?.message ?? "Could not approve draft." };
  }

  await insertMarketingRevision(context.supabase, result.data, "approved", context.staffId);
  revalidateMarketingWorkspace();
  return { success: true, draft: result.data, message: "Draft approved." };
}

export async function scheduleMarketingContentDraft(
  rawInput: unknown
): Promise<ActionResult<{ draft: MarketingContentDraftRow; message: string }>> {
  const parsed = marketingDraftScheduleSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid schedule request.",
    };
  }

  const context = await getMarketingAccessContext();
  if (!context) return { success: false, error: "Unauthorized" };
  if (!isOwnerContext(context)) return { success: false, error: "Owner approval is required." };

  const scheduledFor = cleanOptionalDate(parsed.data.scheduledFor);
  if (!scheduledFor) return { success: false, error: "Choose a valid publish date and time." };

  const now = new Date().toISOString();
  const result = await table<MarketingContentDraftRow>(context.supabase, "marketing_content_drafts")
    .update({
      status: "scheduled",
      scheduled_for: scheduledFor,
      reviewed_by: context.staffId,
      reviewed_at: now,
      review_note: cleanText(parsed.data.reviewNote),
      updated_by: context.staffId,
    })
    .eq("id", parsed.data.id)
    .select(DRAFT_SELECT)
    .single();

  if (result.error || !result.data) {
    if (result.error && isMissingMarketingTableError(result.error.message)) {
      return { success: false, error: migrationUnavailableError() };
    }
    return { success: false, error: result.error?.message ?? "Could not schedule draft." };
  }

  await insertMarketingRevision(context.supabase, result.data, "scheduled", context.staffId);
  revalidateMarketingWorkspace();
  return { success: true, draft: result.data, message: "Draft scheduled." };
}

export async function publishMarketingContentDraft(
  rawInput: unknown
): Promise<ActionResult<{ draft: MarketingContentDraftRow; message: string }>> {
  const parsed = marketingContentDraftIdSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid draft ID." };
  }

  const context = await getMarketingAccessContext();
  if (!context) return { success: false, error: "Unauthorized" };
  if (!isOwnerContext(context)) return { success: false, error: "Owner approval is required." };

  const existing = await findDraft(context.supabase, {
    id: parsed.data.id,
    contentType: "section",
    contentKey: "draft",
  });
  if (existing.error) {
    if (isMissingMarketingTableError(existing.error.message)) {
      return { success: false, error: migrationUnavailableError() };
    }
    return { success: false, error: existing.error.message };
  }
  if (!existing.data) return { success: false, error: "Draft not found." };
  if (!["submitted", "approved", "scheduled"].includes(existing.data.status)) {
    return { success: false, error: "Submit or approve the draft before publishing." };
  }

  let sourceSectionId: string | null = null;

  if (existing.data.content_type === "brand") {
    // Publish Brand draft to marketing_brand_settings
    const meta =
      existing.data.metadata &&
      typeof existing.data.metadata === "object" &&
      !Array.isArray(existing.data.metadata)
        ? (existing.data.metadata as Record<string, unknown>)
        : {};

    let validatedSiteIconPackage: Record<string, unknown> | undefined;
    if (meta.siteIconPackage) {
      const validation = await validateTrustedSiteIconPackage(
        meta.siteIconPackage,
        context.supabase
      );
      if (!validation.isValid || !validation.validatedPackage) {
        return {
          success: false,
          error: validation.error || "Brand draft contains an invalid dynamic site icon package.",
        };
      }
      validatedSiteIconPackage = validation.validatedPackage as unknown as Record<string, unknown>;
    }

    const { updateBrandSettingsBatchOwner } = await import("@/lib/queries/marketing-brand");
    const brandResult = await updateBrandSettingsBatchOwner([
      {
        settingKey: "header_logo",
        label: "Header Logo",
        value: {
          url: (meta.headerLogoUrl as string) || existing.data.image_url || "",
          alt: (meta.headerLogoAlt as string) || existing.data.alt_text || "Cradle Wellness Living",
          variant: "dark" as const,
        },
      },
      {
        settingKey: "footer_logo",
        label: "Footer Logo",
        value: {
          url: (meta.footerLogoUrl as string) || existing.data.secondary_image_url || "",
          alt: (meta.footerLogoAlt as string) || "Cradle Wellness Living",
          variant: "dark" as const,
        },
      },
      {
        settingKey: "brand_mark",
        label: "Brand Mark",
        value: {
          url: (meta.brandMarkUrl as string) || "",
          alt: (meta.brandMarkAlt as string) || "Cradle Brand Mark",
          variant: "dark" as const,
        },
      },
      {
        settingKey: "site_icon",
        label: "Site Icon",
        value: {
          url:
            (validatedSiteIconPackage?.icons as Record<string, string>)?.icon32 ||
            (meta.siteIconUrl as string) ||
            "/favicon.ico",
          alt: (meta.siteIconAlt as string) || "Cradle Site Icon",
          ...(validatedSiteIconPackage ? { package: validatedSiteIconPackage } : {}),
        },
      },
      {
        settingKey: "brand_tagline",
        label: "Brand Tagline & Mission",
        value: {
          text:
            (meta.taglineText as string) ||
            existing.data.title ||
            "A sanctuary of calm in Bacolod.",
          subtext:
            (meta.taglineSubtext as string) ||
            existing.data.subtitle ||
            "Experience genuine renewal with our certified massage therapists and calming atmosphere.",
        },
      },
    ]);

    if (!brandResult.success) {
      return {
        success: false,
        error: brandResult.error ?? "Failed to publish brand settings live.",
      };
    }
  } else if (existing.data.content_type === "service") {
    // Publish Service presentation draft to services table
    const serviceId = existing.data.content_key;
    const meta =
      existing.data.metadata &&
      typeof existing.data.metadata === "object" &&
      !Array.isArray(existing.data.metadata)
        ? (existing.data.metadata as Record<string, unknown>)
        : {};

    const shortDescription =
      (typeof meta.shortDescription === "string" && meta.shortDescription) ||
      existing.data.subtitle ||
      null;
    const badges = Array.isArray(meta.badges) ? (meta.badges as string[]) : [];
    const inclusions = Array.isArray(meta.inclusions) ? (meta.inclusions as string[]) : [];
    const imageAlt =
      existing.data.alt_text || (typeof meta.imageAlt === "string" ? meta.imageAlt : null);

    const { updateServicePresentationDirect } =
      await import("@/app/(dashboard)/marketing/service-actions");
    const serviceResult = await updateServicePresentationDirect(context.supabase, {
      serviceId,
      description: existing.data.body || null,
      shortDescription,
      imageUrl: existing.data.image_url || null,
      imageAlt,
      badges,
      inclusions,
    });

    if (!serviceResult.success) {
      return {
        success: false,
        error: serviceResult.error ?? "Failed to publish service presentation live.",
      };
    }
  } else if (
    existing.data.content_type === "section" &&
    existing.data.content_key.startsWith("branch_")
  ) {
    // Publish Branch presentation draft
    const meta =
      existing.data.metadata &&
      typeof existing.data.metadata === "object" &&
      !Array.isArray(existing.data.metadata)
        ? (existing.data.metadata as Record<string, unknown>)
        : {};

    const branchIdValidation = z
      .guid("Branch draft is missing a valid canonical branchId in metadata.")
      .safeParse(meta.branchId);

    if (!branchIdValidation.success) {
      return {
        success: false,
        error:
          branchIdValidation.error.issues[0]?.message ??
          "Branch draft is missing a valid canonical branchId in metadata.",
      };
    }

    const branchId = branchIdValidation.data;

    const { data: existingBranch, error: fetchBranchError } = await context.supabase
      .from("branches")
      .select("name, address, location_metadata")
      .eq("id", branchId)
      .single();

    if (fetchBranchError || !existingBranch) {
      return {
        success: false,
        error: `Failed to read existing branch metadata: ${fetchBranchError?.message || "Branch not found."}`,
      };
    }

    const existingBranchMeta =
      existingBranch.location_metadata &&
      typeof existingBranch.location_metadata === "object" &&
      !Array.isArray(existingBranch.location_metadata)
        ? (existingBranch.location_metadata as Record<string, unknown>)
        : {};

    const mergedLocationMetadata = {
      ...existingBranchMeta,
      image_url: existing.data.image_url || null,
    };

    const branchName =
      (typeof meta.name === "string" && meta.name.trim().length > 0 ? meta.name.trim() : null) ||
      existing.data.title ||
      existingBranch.name;

    const branchAddress =
      (typeof meta.address === "string" && meta.address.trim().length > 0
        ? meta.address.trim()
        : null) ||
      existing.data.body ||
      existingBranch.address;

    const { updateBranchAction } = await import("@/app/(dashboard)/owner/branches/actions");
    const branchResult = await updateBranchAction({
      branchId,
      name: branchName,
      address: branchAddress,
      phone: (meta.phone as string) || existing.data.cta_label || null,
      email: (meta.email as string) || null,
      fbPage: (meta.fbPage as string) || null,
      messengerLink: (meta.messengerLink as string) || null,
      openingHours: (meta.openingHours as string) || null,
      mapsEmbedUrl: (meta.mapsEmbedUrl as string) || null,
      locationMetadata: mergedLocationMetadata,
    });

    if (!branchResult.success) {
      return {
        success: false,
        error: branchResult.error ?? "Failed to publish branch presentation live.",
      };
    }
  } else if (existing.data.content_type === "section") {
    // Standard Homepage section draft
    const published = await updatePublicSiteSection({
      sectionKey: existing.data.content_key,
      title: existing.data.title ?? "",
      subtitle: existing.data.subtitle ?? "",
      body: existing.data.body ?? "",
      ctaLabel: existing.data.cta_label ?? "",
      ctaHref: existing.data.cta_href ?? "",
      imageUrl: existing.data.image_url ?? "",
      secondaryImageUrl: existing.data.secondary_image_url ?? "",
      sortOrder: existing.data.sort_order,
      isEnabled: existing.data.is_enabled,
      metadata: existing.data.metadata,
    });

    if (!published.success) return { success: false, error: published.error };
    sourceSectionId = published.section.id;
  } else {
    return {
      success: false,
      error: `Publishing for content type ${existing.data.content_type} is not supported.`,
    };
  }

  const now = new Date().toISOString();
  const result = await table<MarketingContentDraftRow>(context.supabase, "marketing_content_drafts")
    .update({
      status: "published",
      scheduled_for: null,
      reviewed_by: existing.data.reviewed_by ?? context.staffId,
      reviewed_at: existing.data.reviewed_at ?? now,
      published_by: context.staffId,
      published_at: now,
      updated_by: context.staffId,
      source_section_id: sourceSectionId,
    })
    .eq("id", existing.data.id)
    .select(DRAFT_SELECT)
    .single();

  if (result.error || !result.data) {
    if (result.error && isMissingMarketingTableError(result.error.message)) {
      return { success: false, error: migrationUnavailableError() };
    }
    return {
      success: false,
      error: result.error?.message ?? "Live changes saved, but draft lock failed.",
    };
  }

  await insertMarketingRevision(context.supabase, result.data, "published", context.staffId);
  revalidatePublishedSite();
  return { success: true, draft: result.data, message: "Draft published to live successfully." };
}

export async function archiveMarketingContentDraft(
  rawInput: unknown
): Promise<ActionResult<{ draft: MarketingContentDraftRow; message: string }>> {
  const parsed = marketingDraftReviewSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid archive request." };
  }

  const context = await getMarketingAccessContext();
  if (!context) return { success: false, error: "Unauthorized" };
  if (!isOwnerContext(context)) return { success: false, error: "Owner approval is required." };

  const result = await table<MarketingContentDraftRow>(context.supabase, "marketing_content_drafts")
    .update({
      status: "archived",
      review_note: cleanText(parsed.data.reviewNote),
      updated_by: context.staffId,
    })
    .eq("id", parsed.data.id)
    .select(DRAFT_SELECT)
    .single();

  if (result.error || !result.data) {
    if (result.error && isMissingMarketingTableError(result.error.message)) {
      return { success: false, error: migrationUnavailableError() };
    }
    return { success: false, error: result.error?.message ?? "Could not archive draft." };
  }

  await insertMarketingRevision(context.supabase, result.data, "archived", context.staffId);
  revalidateMarketingWorkspace();
  return { success: true, draft: result.data, message: "Draft archived." };
}
