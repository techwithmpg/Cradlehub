import { PageHeader } from "@/components/features/dashboard/page-header";
import { PUBLIC_SITE_SECTION_DEFAULTS } from "@/lib/marketing/public-section-defaults";
import {
  getMarketingContentDrafts,
  getMarketingContentRevisions,
} from "@/lib/queries/marketing-content";
import { getMarketingMediaAssets, getMarketingMediaUsageMap } from "@/lib/queries/marketing-media";
import { getMarketingBrandSettings } from "@/lib/queries/marketing-brand";
import { getPublicBranches } from "@/lib/queries/branches";
import { getPublicServiceCatalog } from "@/lib/queries/services";
import { getPublicSiteAssets, getPublicSiteSections } from "@/lib/queries/public-site";
import { MarketingWorkspace } from "./marketing-workspace";

export default async function MarketingWorkspacePage() {
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
    getMarketingContentRevisions(12),
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
        description="Prepare public-site copy, brand identity, branch details, and services catalog drafts before owner publishing."
      />

      <MarketingWorkspace
        sectionDefaults={PUBLIC_SITE_SECTION_DEFAULTS}
        publishedSections={sections}
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
