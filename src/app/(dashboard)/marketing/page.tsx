import { PageHeader } from "@/components/features/dashboard/page-header";
import { PUBLIC_SITE_SECTION_DEFAULTS } from "@/lib/marketing/public-section-defaults";
import {
  getMarketingContentDrafts,
  getMarketingContentRevisions,
} from "@/lib/queries/marketing-content";
import { getMarketingMediaAssets } from "@/lib/queries/marketing-media";
import { getPublicSiteAssets, getPublicSiteSections } from "@/lib/queries/public-site";
import { MarketingWorkspace } from "./marketing-workspace";

export default async function MarketingWorkspacePage() {
  const [sections, galleryAssets, drafts, revisions, mediaAssets] = await Promise.all([
    getPublicSiteSections({ includeDisabled: true }),
    getPublicSiteAssets("gallery", { includeDisabled: true }),
    getMarketingContentDrafts(),
    getMarketingContentRevisions(12),
    getMarketingMediaAssets({ limit: 150 }),
  ]);

  return (
    <div>
      <PageHeader
        title="Marketing Studio"
        description="Prepare public-site updates as drafts before owner publishing."
      />

      <MarketingWorkspace
        sectionDefaults={PUBLIC_SITE_SECTION_DEFAULTS}
        publishedSections={sections}
        galleryAssets={galleryAssets}
        drafts={drafts}
        revisions={revisions}
        mediaAssets={mediaAssets}
      />
    </div>
  );
}
