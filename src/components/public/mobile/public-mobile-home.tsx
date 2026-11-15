import React from "react";
import type { PublicBranch } from "@/lib/public/public-site-data";
import type { PublicCatalogService } from "@/lib/queries/services";
import type { NormalizedPublicSiteSections } from "@/lib/public/normalized-sections";
import { resolvePublicSiteSections } from "@/lib/public/normalized-sections";
import { MobileHomeHeroCarousel } from "./mobile-home-hero-carousel";
import { MobileTrustPanel } from "./mobile-trust-panel";
import { MobileCalmCategories } from "./mobile-calm-categories";
import { MobileMostLovedTreatments } from "./mobile-most-loved-treatments";
import { MobileExperienceGrid } from "./mobile-experience-grid";
import { MobileSignatureRituals } from "./mobile-signature-rituals";
import { MobileBranchesSection } from "./mobile-branches-section";
import { MobileFinalCta } from "./mobile-final-cta";

export const isPublicSafeService = (s: PublicCatalogService) =>
  Boolean(s.isPublicBookable && !s.isCsrOnly && !s.isVip);

export type PublicMobileHomeProps = {
  branches: PublicBranch[];
  services: PublicCatalogService[];
  sections?: NormalizedPublicSiteSections;
};

export type PublicMobileHomeRendererProps = {
  sections: NormalizedPublicSiteSections;
  branches: PublicBranch[];
  services: PublicCatalogService[];
};

export function PublicMobileHomeRenderer({
  sections,
  branches,
  services,
}: PublicMobileHomeRendererProps) {
  const safeServices = services.filter(isPublicSafeService);
  const featured = safeServices.slice(0, 6);

  return (
    <div className="w-full bg-[#F7F3EB] text-[#10261D]">
      <MobileHomeHeroCarousel hero={sections.hero} siteImages={sections.siteImages} />
      {sections.signatureServices.isVisible && (
        <MobileCalmCategories
          services={safeServices}
          categoryImages={sections.signatureServices.categoryImages}
        />
      )}
      <MobileTrustPanel />
      <MobileMostLovedTreatments services={featured} />
      <MobileExperienceGrid siteImages={sections.siteImages} />
      <MobileSignatureRituals services={safeServices} siteImages={sections.siteImages} />
      <MobileBranchesSection branches={branches} siteImages={sections.siteImages} />
      <MobileFinalCta quoteBanner={sections.quoteBanner} siteImages={sections.siteImages} />
    </div>
  );
}

export function PublicMobileHome({
  branches,
  services,
  sections,
}: PublicMobileHomeProps) {
  const resolved = sections ?? resolvePublicSiteSections([]);
  const safeServices = services.filter(isPublicSafeService);

  return (
    <div className="md:hidden">
      <PublicMobileHomeRenderer
        sections={resolved}
        branches={branches}
        services={safeServices}
      />
    </div>
  );
}
