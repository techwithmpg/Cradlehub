import React from "react";
import type { PublicBranch } from "@/lib/public/public-site-data";
import type { PublicCatalogService } from "@/lib/queries/services";
import type { BoutiqueProduct } from "@/lib/public/boutique-catalog";
import type { NormalizedPublicSiteSections } from "@/lib/public/normalized-sections";
import { resolvePublicSiteSections } from "@/lib/public/normalized-sections";
import { EG_SURFACE } from "@/components/public/emerald-glass";
import { EmeraldServiceRail } from "@/components/public/emerald-service-rail";
import { GuestExperiencesSection } from "@/components/public/guest-experiences-section";
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
  boutiqueProducts?: BoutiqueProduct[];
};

export type PublicMobileHomeRendererProps = {
  sections: NormalizedPublicSiteSections;
  branches: PublicBranch[];
  services: PublicCatalogService[];
  boutiqueProducts?: BoutiqueProduct[];
};

export function PublicMobileHomeRenderer({
  sections,
  branches,
  services,
  boutiqueProducts,
}: PublicMobileHomeRendererProps) {
  const safeServices = services.filter(isPublicSafeService);
  const featured = safeServices.slice(0, 6);

  return (
    <div className={EG_SURFACE.pageGradient}>
      <MobileHomeHeroCarousel hero={sections.hero} siteImages={sections.siteImages} />
      <div className="-mt-4 pb-4">
        <EmeraldServiceRail services={safeServices} />
      </div>
      {sections.signatureServices.isVisible && (
        <MobileCalmCategories
          services={safeServices}
          categoryImages={sections.signatureServices.categoryImages}
        />
      )}
      <MobileTrustPanel />
      <MobileMostLovedTreatments services={featured} />
      <MobileExperienceGrid siteImages={sections.siteImages} />
      <MobileSignatureRituals
        services={safeServices}
        siteImages={sections.siteImages}
        boutiqueProducts={boutiqueProducts}
      />
      <MobileBranchesSection branches={branches} siteImages={sections.siteImages} />
      <GuestExperiencesSection reviews={[]} />
      <MobileFinalCta quoteBanner={sections.quoteBanner} siteImages={sections.siteImages} />
    </div>
  );
}

export function PublicMobileHome({
  branches,
  services,
  sections,
  boutiqueProducts,
}: PublicMobileHomeProps) {
  const resolved = sections ?? resolvePublicSiteSections([]);
  const safeServices = services.filter(isPublicSafeService);

  return (
    <div className="md:hidden">
      <PublicMobileHomeRenderer
        sections={resolved}
        branches={branches}
        services={safeServices}
        boutiqueProducts={boutiqueProducts}
      />
    </div>
  );
}
