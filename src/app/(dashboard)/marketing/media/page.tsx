import { PageHeader } from "@/components/features/dashboard/page-header";
import { getMarketingMediaAssets } from "@/lib/queries/marketing-media";
import { getPublicSiteAssets, getPublicSiteSections } from "@/lib/queries/public-site";
import { getMarketingContentDrafts } from "@/lib/queries/marketing-content";
import { getPublicServiceCatalog } from "@/lib/queries/services";
import {
  batchAnalyzeMediaUsage,
  type MediaAssetUsageSummary,
} from "@/lib/marketing/media-usage-analyzer";
import { MediaLibraryView } from "@/components/features/marketing/media/media-library-view";
import { createClient } from "@/lib/supabase/server";

export default async function MediaLibraryPage() {
  const [assets, sections, publicAssets, drafts, services] = await Promise.all([
    getMarketingMediaAssets({ limit: 150 }),
    getPublicSiteSections({ includeDisabled: true }),
    getPublicSiteAssets("gallery", { includeDisabled: true }),
    getMarketingContentDrafts(),
    getPublicServiceCatalog(),
  ]);

  const usageMap = batchAnalyzeMediaUsage(assets, {
    sections,
    publicAssets,
    drafts,
    services,
  });

  const serializableUsageMap: Record<string, MediaAssetUsageSummary> = {};
  usageMap.forEach((val, key) => {
    serializableUsageMap[key] = val;
  });

  // Determine user role
  let userRole: "owner" | "digital_marketer" = "digital_marketer";
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: me } = await supabase
        .from("staff")
        .select("system_role")
        .eq("auth_user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (me?.system_role === "owner") {
        userRole = "owner";
      }
    }
  } catch {
    // Default to marketer
  }

  return (
    <div>
      <PageHeader
        title="Media Library"
        description="Central visual library for public site imagery, brand assets, and service photos."
      />

      <MediaLibraryView
        initialAssets={assets}
        initialUsageMap={serializableUsageMap}
        userRole={userRole}
      />
    </div>
  );
}
