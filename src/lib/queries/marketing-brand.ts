import "server-only";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { logError } from "@/lib/logger";

import type { Json } from "@/types/supabase";

export type MarketingBrandSettingValue = {
  url?: string | null;
  alt?: string | null;
  variant?: "light" | "dark";
  text?: string | null;
  subtext?: string | null;
  [key: string]: unknown;
};

export type MarketingBrandSettingRow = {
  id: string;
  setting_key: string;
  label: string;
  value: MarketingBrandSettingValue;
  status: string;
  updated_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
};

export const DEFAULT_BRAND_SETTINGS: Record<string, { label: string; value: MarketingBrandSettingValue }> = {
  header_logo: {
    label: "Header Logo",
    value: {
      url: "",
      alt: "Cradle Wellness Living",
      variant: "dark",
    },
  },
  footer_logo: {
    label: "Footer Logo",
    value: {
      url: "",
      alt: "Cradle Wellness Living",
      variant: "dark",
    },
  },
  brand_mark: {
    label: "Brand Mark / Emblem",
    value: {
      url: "",
      alt: "Cradle Brand Mark",
      variant: "dark",
    },
  },
  site_icon: {
    label: "Site Icon / Favicon Asset",
    value: {
      url: "/favicon.ico",
      alt: "Cradle Site Icon",
    },
  },
  brand_tagline: {
    label: "Brand Tagline & Mission",
    value: {
      text: "A sanctuary of calm in Bacolod.",
      subtext: "Experience genuine renewal with our certified massage therapists and calming atmosphere.",
    },
  },
};

export async function getMarketingBrandSettings(): Promise<MarketingBrandSettingRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("marketing_brand_settings")
      .select("id, setting_key, label, value, status, updated_at, reviewed_at, reviewed_by")
      .order("setting_key");

    if (error || !data || data.length === 0) {
      return Object.entries(DEFAULT_BRAND_SETTINGS).map(([key, def], idx) => ({
        id: `default-${key}`,
        setting_key: key,
        label: def.label,
        value: def.value,
        status: "published",
        updated_at: new Date().toISOString(),
      }));
    }

    return data.map((row) => ({
      id: row.id,
      setting_key: row.setting_key,
      label: row.label,
      value: (row.value && typeof row.value === "object" && !Array.isArray(row.value)
        ? row.value
        : {}) as MarketingBrandSettingValue,
      status: row.status,
      updated_at: row.updated_at,
      reviewed_at: row.reviewed_at,
      reviewed_by: row.reviewed_by,
    }));
  } catch {
    return Object.entries(DEFAULT_BRAND_SETTINGS).map(([key, def]) => ({
      id: `default-${key}`,
      setting_key: key,
      label: def.label,
      value: def.value,
      status: "published",
      updated_at: new Date().toISOString(),
    }));
  }
}

export async function updateBrandSettingOwner(
  settingKey: string,
  label: string,
  value: MarketingBrandSettingValue
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user && !isDevAuthBypassEnabled()) {
      return { success: false, error: "Unauthorized" };
    }

    let staffId: string | null = null;
    if (user) {
      const { data: me } = await supabase
        .from("staff")
        .select("id, system_role")
        .eq("auth_user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (me?.system_role !== "owner" && !isDevAuthBypassEnabled()) {
        return { success: false, error: "Only owners can publish live brand settings directly." };
      }
      staffId = me?.id ?? null;
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("marketing_brand_settings")
      .upsert(
        {
          setting_key: settingKey,
          label,
          value: value as unknown as Json,
          status: "published",
          updated_at: now,
          updated_by: staffId,
          reviewed_at: now,
          reviewed_by: staffId,
        },
        { onConflict: "setting_key" }
      );

    if (error) {
      logError("marketing.brand_setting_update_failed", { settingKey, error });
      return { success: false, error: error.message };
    }

    revalidatePath("/marketing");
    revalidatePath("/owner/marketing");
    revalidatePath("/");

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update brand setting" };
  }
}
