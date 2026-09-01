"use client";

import type { MarketingSectionDefault } from "@/lib/marketing/public-section-defaults";
import type {
  MarketingContentDraftRow,
  MarketingContentRevisionRow,
} from "@/lib/queries/marketing-content";
import type { MarketingMediaAssetRow } from "@/lib/queries/marketing-media";
import type { MediaAssetUsageSummary } from "@/lib/marketing/media-usage-analyzer";
import type { MarketingBrandSettingRow } from "@/lib/queries/marketing-brand";
import type { PublicCatalogService } from "@/lib/queries/services";
import type { PublicSiteAssetRow, PublicSiteSectionRow } from "@/lib/queries/public-site";
import type { Database } from "@/types/supabase";
import { MarketingWorkspaceShell } from "@/components/features/marketing/marketing-workspace-shell";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

export type MarketingWorkspaceProps = {
  sectionDefaults: readonly MarketingSectionDefault[];
  publishedSections: PublicSiteSectionRow[];
  galleryAssets: PublicSiteAssetRow[];
  drafts: MarketingContentDraftRow[];
  revisions: MarketingContentRevisionRow[];
  mediaAssets?: MarketingMediaAssetRow[];
  mediaUsageMap?: Record<string, MediaAssetUsageSummary>;
  brandSettings?: MarketingBrandSettingRow[];
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
  mediaUsageMap = {},
  brandSettings = [],
  branches = [],
  services = [],
}: MarketingWorkspaceProps) {
  return (
    <MarketingWorkspaceShell
      role="digital_marketer"
      sectionDefaults={sectionDefaults}
      publishedSections={publishedSections}
      galleryAssets={galleryAssets}
      drafts={drafts}
      revisions={revisions}
      mediaAssets={mediaAssets}
      mediaUsageMap={mediaUsageMap}
      brandSettings={brandSettings}
      branches={branches}
      services={services}
    />
  );
}
