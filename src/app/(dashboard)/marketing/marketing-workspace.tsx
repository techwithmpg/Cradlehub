"use client";

import type { MarketingSectionDefault } from "@/lib/marketing/public-section-defaults";
import type {
  MarketingContentDraftRow,
  MarketingContentRevisionRow,
} from "@/lib/queries/marketing-content";
import type { MarketingMediaAssetRow } from "@/lib/queries/marketing-media";
import type { PublicCatalogService } from "@/lib/queries/services";
import type { PublicSiteAssetRow, PublicSiteSectionRow } from "@/lib/queries/public-site";
import type { Database } from "@/types/supabase";
import { WebsiteStudioView } from "@/components/features/marketing/website/website-studio-view";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

export type MarketingWorkspaceProps = {
  sectionDefaults: readonly MarketingSectionDefault[];
  publishedSections: PublicSiteSectionRow[];
  galleryAssets: PublicSiteAssetRow[];
  drafts: MarketingContentDraftRow[];
  revisions: MarketingContentRevisionRow[];
  mediaAssets?: MarketingMediaAssetRow[];
  branches?: BranchRow[];
  services?: PublicCatalogService[];
};

export function MarketingWorkspace({
  sectionDefaults,
  publishedSections,
  galleryAssets,
  drafts,
  revisions,
  mediaAssets = [],
  branches = [],
  services = [],
}: MarketingWorkspaceProps) {
  return (
    <WebsiteStudioView
      role="digital_marketer"
      sectionDefaults={sectionDefaults}
      publishedSections={publishedSections}
      galleryAssets={galleryAssets}
      drafts={drafts}
      revisions={revisions}
      mediaAssets={mediaAssets}
      branches={branches}
      services={services}
    />
  );
}
