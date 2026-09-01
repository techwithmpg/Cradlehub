"use client";

import { useState } from "react";
import { Building2, Globe, ImageIcon, Layout, Sparkles, Utensils, Wand2 } from "lucide-react";
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
import { WebsiteStudioView } from "@/components/features/marketing/website/website-studio-view";
import { BrandStudioView } from "@/components/features/marketing/brand/brand-studio-view";
import { BranchesStudioView } from "@/components/features/marketing/branches/branches-studio-view";
import { ServicesStudioView } from "@/components/features/marketing/services/services-studio-view";
import { MediaLibraryView } from "@/components/features/marketing/media/media-library-view";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

export type MarketingWorkspaceShellProps = {
  role: "digital_marketer" | "owner";
  sectionDefaults: readonly MarketingSectionDefault[];
  publishedSections: PublicSiteSectionRow[];
  galleryAssets?: PublicSiteAssetRow[];
  drafts: MarketingContentDraftRow[];
  revisions: MarketingContentRevisionRow[];
  mediaAssets?: MarketingMediaAssetRow[];
  mediaUsageMap?: Record<string, MediaAssetUsageSummary>;
  brandSettings?: MarketingBrandSettingRow[];
  branches?: BranchRow[];
  services?: PublicCatalogService[];
  initialTab?: "website" | "brand" | "branches" | "services" | "media";
};

type WorkspaceTab = "website" | "brand" | "branches" | "services" | "media";

const WORKSPACE_TABS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: typeof Layout;
  description: string;
}> = [
  {
    id: "website",
    label: "Website Studio",
    icon: Globe,
    description: "Homepage copy, promotional banners, and section structure",
  },
  {
    id: "brand",
    label: "Brand Studio",
    icon: Sparkles,
    description: "Logos, brand marks, site icons, and tagline copy",
  },
  {
    id: "branches",
    label: "Branches Studio",
    icon: Building2,
    description: "Branch locations, contact details, schedules, and photos",
  },
  {
    id: "services",
    label: "Services Studio",
    icon: Wand2,
    description: "Service catalog photos, descriptions, badges, and inclusions",
  },
  {
    id: "media",
    label: "Media Library",
    icon: ImageIcon,
    description: "Central asset library, usage analyzer, and media manager",
  },
];

export function MarketingWorkspaceShell({
  role,
  sectionDefaults,
  publishedSections,
  galleryAssets = [],
  drafts = [],
  revisions = [],
  mediaAssets = [],
  mediaUsageMap = {},
  brandSettings = [],
  branches = [],
  services = [],
  initialTab = "website",
}: MarketingWorkspaceShellProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);

  return (
    <div className="space-y-6">
      {/* Top Workspace Tab Navigator */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D4B57A]/15 pb-3">
        <nav
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Marketing Workspace Navigation"
        >
          {WORKSPACE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition-all ${
                  isActive
                    ? "border border-[#C8A96B]/50 bg-[#163A2B] text-[#F6EBD6] shadow-md ring-1 ring-[#C8A96B]/20"
                    : "border border-transparent text-[#9AA89A] hover:border-white/10 hover:bg-white/[0.03] hover:text-[#F6EBD6]"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-[#C8A96B]" : "text-[#9AA89A]"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 text-xs text-[#9AA89A]">
          <span className="hidden sm:inline">Authorized Workspace:</span>
          <span className="rounded-full bg-[#163A2B] px-2.5 py-0.5 text-[11px] font-semibold text-[#C8A96B]">
            {role === "owner" ? "Owner Access" : "Digital Marketer"}
          </span>
        </div>
      </div>

      {/* Active Tab Panel */}
      <div
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
        className="focus:outline-none"
      >
        {activeTab === "website" && (
          <WebsiteStudioView
            role={role}
            sectionDefaults={sectionDefaults}
            publishedSections={publishedSections}
            galleryAssets={galleryAssets}
            drafts={drafts}
            revisions={revisions}
            mediaAssets={mediaAssets}
            branches={branches}
            services={services}
          />
        )}

        {activeTab === "brand" && (
          <BrandStudioView
            role={role}
            brandSettings={brandSettings}
            drafts={drafts}
            revisions={revisions}
            mediaAssets={mediaAssets}
          />
        )}

        {activeTab === "branches" && (
          <BranchesStudioView
            role={role}
            branches={branches}
            drafts={drafts}
            revisions={revisions}
            mediaAssets={mediaAssets}
          />
        )}

        {activeTab === "services" && (
          <ServicesStudioView
            role={role}
            services={services}
            drafts={drafts}
            revisions={revisions}
            mediaAssets={mediaAssets}
          />
        )}

        {activeTab === "media" && (
          <MediaLibraryView
            initialAssets={mediaAssets}
            initialUsageMap={mediaUsageMap}
            userRole={role}
          />
        )}
      </div>
    </div>
  );
}
