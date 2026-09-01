import { PageHeader } from "@/components/features/dashboard/page-header";
import { getPublicSiteAssets, getPublicSiteSections } from "@/lib/queries/public-site";
import { PUBLIC_SITE_SECTION_DEFAULTS } from "@/lib/marketing/public-section-defaults";
import {
  getMarketingContentDrafts,
  getMarketingContentRevisions,
} from "@/lib/queries/marketing-content";
import { getMarketingMediaAssets, getMarketingMediaUsageMap } from "@/lib/queries/marketing-media";
import { getMarketingBrandSettings } from "@/lib/queries/marketing-brand";
import { getPublicBranches } from "@/lib/queries/branches";
import { getPublicServiceCatalog } from "@/lib/queries/services";
import { MarketingStudio } from "./marketing-studio";

export default async function MarketingStudioPage() {
  const [
    sections,
    galleryAssets,
    drafts,
    revisions,
    mediaAssets,
    brandSettings,
    branches,
    services,
  ] = await Promise.all([
    getPublicSiteSections({ includeDisabled: true }),
    getPublicSiteAssets("gallery", { includeDisabled: true }),
    getMarketingContentDrafts(),
    getMarketingContentRevisions(16),
    getMarketingMediaAssets({ limit: 150 }),
    getMarketingBrandSettings(),
    getPublicBranches().catch(() => []),
    getPublicServiceCatalog().catch(() => []),
  ]);

  const mediaUsageMap = await getMarketingMediaUsageMap(mediaAssets);

  return (
    <div>
      <PageHeader
        title="Marketing Studio"
        description="Manage public homepage copy, brand identity, branch details, service catalog presentation, and promotional sections."
      />

      <MarketingStudio
        sectionDefaults={PUBLIC_SITE_SECTION_DEFAULTS}
        sections={sections}
        galleryAssets={galleryAssets}
        drafts={drafts}
        revisions={revisions}
        mediaAssets={mediaAssets}
        mediaUsageMap={mediaUsageMap}
        brandSettings={brandSettings}
        branches={branches}
        services={services}
      />
    </div>
  );
}
