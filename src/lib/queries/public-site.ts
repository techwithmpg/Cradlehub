import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import type { Database, Json } from "@/types/supabase";
import {
  publicSiteAssetIdSchema,
  publicSiteAssetSchema,
  publicSiteSectionSchema,
  updatePublicSiteAssetSchema,
  type PublicSiteAssetInput,
  type PublicSiteSectionInput,
  type UpdatePublicSiteAssetInput,
} from "@/lib/validations/public-site";

export type PublicSiteSectionRow =
  Database["public"]["Tables"]["public_site_sections"]["Row"];
export type PublicSiteAssetRow =
  Database["public"]["Tables"]["public_site_assets"]["Row"];

type ActionResult<T extends object | undefined = undefined> =
  | (T extends object ? { success: true } & T : { success: true })
  | { success: false; error: string };

function cleanText(value?: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function jsonForDb(value: Record<string, unknown>): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function isMissingPublicSiteTableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    (lower.includes("public_site_sections") ||
      lower.includes("public_site_assets")) &&
    (lower.includes("does not exist") ||
      lower.includes("schema cache") ||
      lower.includes("could not find"))
  );
}

async function canManagePublicSiteContent(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;
  if (isDevAuthBypassEnabled()) return true;

  const { data: me } = await supabase
    .from("staff")
    .select("system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  return me?.system_role === "owner";
}

export async function getPublicSiteSections(options?: {
  enabledOnly?: boolean;
  includeDisabled?: boolean;
}): Promise<PublicSiteSectionRow[]> {
  const enabledOnly = options?.enabledOnly ?? !options?.includeDisabled;
  const supabase = createAdminClient();

  let query = supabase
    .from("public_site_sections")
    .select(
      "id, section_key, title, subtitle, body, cta_label, cta_href, image_url, secondary_image_url, sort_order, is_enabled, metadata, created_at, updated_at"
    )
    .order("sort_order")
    .order("section_key");

  if (enabledOnly) {
    query = query.eq("is_enabled", true);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingPublicSiteTableError(error.message)) return [];
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getPublicSiteSection(
  sectionKey: string
): Promise<PublicSiteSectionRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("public_site_sections")
    .select(
      "id, section_key, title, subtitle, body, cta_label, cta_href, image_url, secondary_image_url, sort_order, is_enabled, metadata, created_at, updated_at"
    )
    .eq("section_key", sectionKey)
    .maybeSingle();

  if (error) {
    if (isMissingPublicSiteTableError(error.message)) return null;
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function getPublicSiteAssets(
  sectionKey: string,
  options?: { enabledOnly?: boolean; includeDisabled?: boolean }
): Promise<PublicSiteAssetRow[]> {
  const enabledOnly = options?.enabledOnly ?? !options?.includeDisabled;
  const supabase = createAdminClient();

  let query = supabase
    .from("public_site_assets")
    .select(
      "id, section_key, title, alt_text, image_url, link_href, sort_order, is_enabled, metadata, created_at, updated_at"
    )
    .eq("section_key", sectionKey)
    .order("sort_order")
    .order("created_at");

  if (enabledOnly) {
    query = query.eq("is_enabled", true);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingPublicSiteTableError(error.message)) return [];
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function updatePublicSiteSection(
  rawInput: unknown
): Promise<ActionResult<{ section: PublicSiteSectionRow }>> {
  const parsed = publicSiteSectionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Please check the section details.",
    };
  }

  const allowed = await canManagePublicSiteContent();
  if (!allowed) return { success: false, error: "Unauthorized" };

  const input: PublicSiteSectionInput = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_site_sections")
    .upsert(
      {
        section_key: input.sectionKey,
        title: cleanText(input.title),
        subtitle: cleanText(input.subtitle),
        body: cleanText(input.body),
        cta_label: cleanText(input.ctaLabel),
        cta_href: cleanText(input.ctaHref),
        image_url: cleanText(input.imageUrl),
        secondary_image_url: cleanText(input.secondaryImageUrl),
        sort_order: input.sortOrder,
        is_enabled: input.isEnabled,
        metadata: jsonForDb(input.metadata),
      },
      { onConflict: "section_key" }
    )
    .select("*")
    .single();

  if (error || !data) {
    if (error && isMissingPublicSiteTableError(error.message)) {
      return {
        success: false,
        error: "Marketing Studio tables are not available yet. Run the latest Supabase migration first.",
      };
    }

    return { success: false, error: error?.message ?? "Could not save section." };
  }

  revalidatePath("/");
  revalidatePath("/owner/marketing");

  return { success: true, section: data };
}

export async function createPublicSiteAsset(
  rawInput: unknown
): Promise<ActionResult<{ asset: PublicSiteAssetRow }>> {
  const parsed = publicSiteAssetSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Please check the asset details.",
    };
  }

  const allowed = await canManagePublicSiteContent();
  if (!allowed) return { success: false, error: "Unauthorized" };

  const input: PublicSiteAssetInput = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_site_assets")
    .insert({
      section_key: cleanText(input.sectionKey),
      title: cleanText(input.title),
      alt_text: input.altText.trim(),
      image_url: input.imageUrl ?? "",
      link_href: cleanText(input.linkHref),
      sort_order: input.sortOrder,
      is_enabled: input.isEnabled,
      metadata: jsonForDb(input.metadata),
    })
    .select("*")
    .single();

  if (error || !data) {
    if (error && isMissingPublicSiteTableError(error.message)) {
      return {
        success: false,
        error: "Marketing Studio tables are not available yet. Run the latest Supabase migration first.",
      };
    }

    return { success: false, error: error?.message ?? "Could not create asset." };
  }

  revalidatePath("/");
  revalidatePath("/owner/marketing");

  return { success: true, asset: data };
}

export async function updatePublicSiteAsset(
  rawInput: unknown
): Promise<ActionResult<{ asset: PublicSiteAssetRow }>> {
  const parsed = updatePublicSiteAssetSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Please check the asset details.",
    };
  }

  const allowed = await canManagePublicSiteContent();
  if (!allowed) return { success: false, error: "Unauthorized" };

  const input: UpdatePublicSiteAssetInput = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_site_assets")
    .update({
      section_key: cleanText(input.sectionKey),
      title: cleanText(input.title),
      alt_text: input.altText.trim(),
      image_url: input.imageUrl ?? "",
      link_href: cleanText(input.linkHref),
      sort_order: input.sortOrder,
      is_enabled: input.isEnabled,
      metadata: jsonForDb(input.metadata),
    })
    .eq("id", input.id)
    .select("*")
    .single();

  if (error || !data) {
    if (error && isMissingPublicSiteTableError(error.message)) {
      return {
        success: false,
        error: "Marketing Studio tables are not available yet. Run the latest Supabase migration first.",
      };
    }

    return { success: false, error: error?.message ?? "Could not update asset." };
  }

  revalidatePath("/");
  revalidatePath("/owner/marketing");

  return { success: true, asset: data };
}

export async function disablePublicSiteAsset(
  rawInput: unknown
): Promise<ActionResult> {
  const parsed = publicSiteAssetIdSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid asset ID.",
    };
  }

  const allowed = await canManagePublicSiteContent();
  if (!allowed) return { success: false, error: "Unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("public_site_assets")
    .update({ is_enabled: false })
    .eq("id", parsed.data.id);

  if (error) {
    if (isMissingPublicSiteTableError(error.message)) {
      return {
        success: false,
        error: "Marketing Studio tables are not available yet. Run the latest Supabase migration first.",
      };
    }

    return { success: false, error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/owner/marketing");

  return { success: true };
}
