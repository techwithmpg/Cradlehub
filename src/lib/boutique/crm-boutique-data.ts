import "server-only";

import { canApproveBoutiqueCatalogChanges, BOUTIQUE_OPERATIONAL_CAPABILITIES } from "@/lib/auth/crm-permissions";
import { BOUTIQUE_CATEGORIES, BOUTIQUE_GIFT_CARD_OPTIONS, BOUTIQUE_HERO_IMAGE, BOUTIQUE_PRODUCTS } from "@/lib/public/boutique-catalog";
import { getAllBranches } from "@/lib/queries/branches";
import type { FrontDeskContext } from "@/lib/queries/crm-context";
import { getMarketingBrandSettings } from "@/lib/queries/marketing-brand";
import { getPublicSiteSections } from "@/lib/queries/public-site";
import {
  buildBoutiqueCapabilityMatrix,
  buildBoutiqueCatalogViews,
  buildBoutiqueCategorySummaries,
  buildBoutiqueCollectionSummaries,
  buildBoutiqueGiftCardOverview,
  buildBoutiqueStockMatrix,
  type CrmBoutiqueBranchRecord,
  type CrmBoutiqueWorkspaceData,
} from "./crm-boutique-model";

type BranchQueryRow = {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  opening_hours?: string | null;
  is_active?: boolean;
};

function toBranchRecords(
  rows: readonly BranchQueryRow[],
  currentBranchId: string
): CrmBoutiqueBranchRecord[] {
  return rows.map((branch) => ({
    id: branch.id,
    name: branch.name,
    address: branch.address ?? null,
    phone: branch.phone ?? null,
    email: branch.email ?? null,
    openingHours: branch.opening_hours ?? null,
    isActive: branch.is_active ?? true,
    isCurrentScope: branch.id === currentBranchId,
    pickupConciergeStatus: "In-Spa Concierge Ready (Front Desk Handoff)",
  }));
}

export async function loadCrmBoutiqueWorkspaceData(
  context: Pick<FrontDeskContext, "role" | "branchId" | "branchName">
): Promise<CrmBoutiqueWorkspaceData> {
  let branchLoadError: string | null = null;
  let marketingLoadError: string | null = null;

  const [branchesResult, sectionsResult, brandResult] = await Promise.all([
    getAllBranches().catch((error: unknown) => {
      branchLoadError =
        error instanceof Error
          ? error.message
          : "Live branch directory could not be loaded; showing active branch context only.";
      return null;
    }),
    getPublicSiteSections({ includeDisabled: true }).catch((error: unknown) => {
      marketingLoadError =
        error instanceof Error
          ? error.message
          : "Public site section status unavailable in read-only mode.";
      return [];
    }),
    getMarketingBrandSettings().catch((error: unknown) => {
      marketingLoadError =
        marketingLoadError ??
        (error instanceof Error
          ? error.message
          : "Marketing brand settings summary unavailable.");
      return [];
    }),
  ]);

  const branches: CrmBoutiqueBranchRecord[] =
    branchesResult && branchesResult.length > 0
      ? toBranchRecords(branchesResult as BranchQueryRow[], context.branchId)
      : [
          {
            id: context.branchId,
            name: context.branchName,
            address: null,
            phone: null,
            email: null,
            openingHours: null,
            isActive: true,
            isCurrentScope: true,
            pickupConciergeStatus: "Current Branch Scope (Fallback)",
          },
        ];

  const catalog = buildBoutiqueCatalogViews();
  const categories = buildBoutiqueCategorySummaries();
  const collections = buildBoutiqueCollectionSummaries();
  const giftCards = buildBoutiqueGiftCardOverview();
  const stockMatrix = buildBoutiqueStockMatrix(branches);
  const capabilityMatrix = buildBoutiqueCapabilityMatrix(context.role);

  const enabledSections = sectionsResult.filter((section) => section.is_enabled);
  const publishedBrandSettings = brandResult.filter((row) => row.status === "published");

  return {
    actorRole: context.role,
    currentBranchId: context.branchId,
    currentBranchName: context.branchName,
    canApproveCatalogChanges: canApproveBoutiqueCatalogChanges(context.role),
    operationalCapabilities: BOUTIQUE_OPERATIONAL_CAPABILITIES,
    catalog,
    categories,
    collections,
    giftCards,
    branches,
    stockMatrix,
    capabilityMatrix,
    governance: {
      publicRoute: "/products",
      catalogSourcePath: "src/lib/public/boutique-catalog.ts",
      heroImageUrl: BOUTIQUE_HERO_IMAGE,
      publicSectionCount: sectionsResult.length,
      enabledSectionCount: enabledSections.length,
      brandSettingCount: brandResult.length,
      publishedBrandSettingCount: publishedBrandSettings.length,
      conciergeStorageKey: "cradle_boutique_cart_v1",
      wishlistStorageKey: "cradle_boutique_wishlist_v1",
      ownerMarketingHref: "/owner/marketing",
      marketingStudioHref: "/marketing",
    },
    overview: {
      totalSkus: BOUTIQUE_PRODUCTS.length,
      physicalSkus: BOUTIQUE_PRODUCTS.filter((product) => !product.isGiftCertificate).length,
      giftOptionsCount: BOUTIQUE_GIFT_CARD_OPTIONS.length,
      activeCategoriesCount: BOUTIQUE_CATEGORIES.filter((cat) => cat.id !== "all").length,
      activeBranchesCount: branches.filter((branch) => branch.isActive).length,
    },
    notices: {
      branchLoadError,
      marketingLoadError,
    },
  };
}
