import {
  BOUTIQUE_CATEGORIES,
  BOUTIQUE_COLLECTIONS,
  BOUTIQUE_GIFT_CARD_OPTIONS,
  BOUTIQUE_HERO_IMAGE,
  BOUTIQUE_PRODUCTS,
  formatPhp,
  type BoutiqueCategoryId,
  type BoutiqueCollection,
  type BoutiqueGiftCardOption,
  type BoutiqueProduct,
} from "@/lib/public/boutique-catalog";
import {
  BOUTIQUE_OPERATIONAL_CAPABILITIES,
  canApproveBoutiqueCatalogChanges,
} from "@/lib/auth/crm-permissions";

export type CrmBoutiqueTabId =
  | "products"
  | "categories"
  | "gift-cards"
  | "orders"
  | "stock"
  | "branches"
  | "settings";

export type CrmBoutiqueTabDefinition = {
  key: CrmBoutiqueTabId;
  label: string;
  description: string;
};

export const CRM_BOUTIQUE_TABS: readonly CrmBoutiqueTabDefinition[] = [
  {
    key: "products",
    label: "Products",
    description:
      "Inspect the canonical Boutique retail items, pricing, packaging details, and storefront merchandising placement.",
  },
  {
    key: "categories",
    label: "Categories",
    description:
      "Review canonical Boutique categories and featured Wellness Collections mapped directly to /products.",
  },
  {
    key: "gift-cards",
    label: "Gift Certificates",
    description:
      "Inspect approved gift denominations and formats while serialized issuance and redemption await authorization.",
  },
  {
    key: "orders",
    label: "Orders",
    description:
      "Review the in-spa concierge pickup workflow; online payment and persistent boutique order ledgers are pending authorization.",
  },
  {
    key: "stock",
    label: "Stock",
    description:
      "Audit SKU tracking readiness across active branches without fabricated inventory counts or unapproved ledger mutations.",
  },
  {
    key: "branches",
    label: "Branch Assignment",
    description:
      "Verify active Bacolod sanctuaries configured for in-spa boutique concierge pickup and branch scope visibility.",
  },
  {
    key: "settings",
    label: "Settings",
    description:
      "Audit functional vs. pending-authorization boundaries, RBAC permissions, single-source catalog parity, and Marketing governance.",
  },
] as const;

const TAB_ALIASES: Record<string, CrmBoutiqueTabId> = {
  products: "products",
  product: "products",
  catalog: "products",
  categories: "categories",
  category: "categories",
  collections: "categories",
  "gift-cards": "gift-cards",
  gift_cards: "gift-cards",
  "gift-certificates": "gift-cards",
  gift_certificates: "gift-cards",
  gifts: "gift-cards",
  orders: "orders",
  order: "orders",
  stock: "stock",
  inventory: "stock",
  branches: "branches",
  "branch-assignment": "branches",
  branch_assignment: "branches",
  settings: "settings",
  permissions: "settings",
};

export function normalizeCrmBoutiqueTab(value?: string | null): CrmBoutiqueTabId {
  if (!value) return "products";
  return TAB_ALIASES[value.trim().toLowerCase()] ?? "products";
}

export type BoutiqueSkuKind = "retail" | "kit" | "voucher";

export type BoutiqueCatalogItemView = {
  product: BoutiqueProduct;
  categoryLabel: string;
  skuKind: BoutiqueSkuKind;
  matchedCollections: BoutiqueCollection[];
  stockTrackingLabel: string;
  fulfillmentLabel: string;
  publicHref: string;
};

export type BoutiqueProductSortKey = "catalog" | "price-asc" | "price-desc" | "name";

const CATEGORY_LABEL_MAP = new Map<BoutiqueCategoryId, string>(
  BOUTIQUE_CATEGORIES.map((category) => [category.id, category.label])
);

export function getBoutiqueCategoryLabel(categoryId: BoutiqueCategoryId): string {
  return CATEGORY_LABEL_MAP.get(categoryId) ?? categoryId;
}

export function buildBoutiqueCatalogViews(): BoutiqueCatalogItemView[] {
  return BOUTIQUE_PRODUCTS.map((product) => {
    const skuKind: BoutiqueSkuKind = product.isGiftCertificate
      ? "voucher"
      : product.category === "wellness-kits"
        ? "kit"
        : "retail";

    const matchedCollections = BOUTIQUE_COLLECTIONS.filter(
      (collection) => collection.category === product.category
    );

    return {
      product,
      categoryLabel: getBoutiqueCategoryLabel(product.category),
      skuKind,
      matchedCollections,
      stockTrackingLabel: product.isGiftCertificate
        ? "Voucher (No Physical Stock)"
        : "Not Tracked (Manual Shelf Check)",
      fulfillmentLabel: product.isGiftCertificate
        ? "Front Desk Virtual / Envelope Concierge"
        : "In-Spa Branch Pickup Concierge",
      publicHref: `/products?category=${encodeURIComponent(product.category)}`,
    };
  });
}

export function filterAndSortBoutiqueCatalog(
  items: readonly BoutiqueCatalogItemView[],
  options: {
    category?: BoutiqueCategoryId;
    search?: string;
    sort?: BoutiqueProductSortKey;
  }
): BoutiqueCatalogItemView[] {
  const category = options.category ?? "all";
  const query = options.search?.trim().toLowerCase() ?? "";
  const sort = options.sort ?? "catalog";

  const filtered = items.filter((item) => {
    if (category !== "all" && item.product.category !== category) {
      return false;
    }
    if (!query) return true;
    const haystack = [
      item.product.id,
      item.product.name,
      item.product.subtitle,
      item.product.description,
      item.categoryLabel,
      item.product.badge ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });

  if (sort === "catalog") return filtered;

  return [...filtered].sort((a, b) => {
    if (sort === "price-asc") return a.product.price - b.product.price;
    if (sort === "price-desc") return b.product.price - a.product.price;
    return a.product.name.localeCompare(b.product.name);
  });
}

export type BoutiqueCategorySummary = {
  id: BoutiqueCategoryId;
  label: string;
  productCount: number;
  productIds: string[];
  priceRangeLabel: string;
  linkedCollections: BoutiqueCollection[];
  publicHref: string;
};

export function buildBoutiqueCategorySummaries(): BoutiqueCategorySummary[] {
  return BOUTIQUE_CATEGORIES.map((category) => {
    const matching =
      category.id === "all"
        ? BOUTIQUE_PRODUCTS
        : BOUTIQUE_PRODUCTS.filter((product) => product.category === category.id);

    const prices = matching.map((product) => product.price);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

    const priceRangeLabel =
      prices.length === 0
        ? "No SKUs"
        : minPrice === maxPrice
          ? formatPhp(minPrice)
          : `${formatPhp(minPrice)} – ${formatPhp(maxPrice)}`;

    const linkedCollections =
      category.id === "all"
        ? BOUTIQUE_COLLECTIONS
        : BOUTIQUE_COLLECTIONS.filter((collection) => collection.category === category.id);

    return {
      id: category.id,
      label: category.label,
      productCount: matching.length,
      productIds: matching.map((product) => product.id),
      priceRangeLabel,
      linkedCollections,
      publicHref:
        category.id === "all"
          ? "/products"
          : `/products?category=${encodeURIComponent(category.id)}`,
    };
  });
}

export type BoutiqueCollectionSummary = {
  collection: BoutiqueCollection;
  categoryLabel: string;
  matchingProductCount: number;
  matchingProductNames: string[];
};

export function buildBoutiqueCollectionSummaries(): BoutiqueCollectionSummary[] {
  return BOUTIQUE_COLLECTIONS.map((collection) => {
    const matching = BOUTIQUE_PRODUCTS.filter(
      (product) => product.category === collection.category
    );
    return {
      collection,
      categoryLabel: getBoutiqueCategoryLabel(collection.category),
      matchingProductCount: matching.length,
      matchingProductNames: matching.map((product) => product.name),
    };
  });
}

export type BoutiqueGiftCardOverview = {
  parentProduct: BoutiqueProduct | null;
  options: BoutiqueGiftCardOption[];
  minAmountLabel: string;
  maxAmountLabel: string;
  issuanceEnabled: boolean;
  redemptionEnabled: boolean;
};

export function buildBoutiqueGiftCardOverview(): BoutiqueGiftCardOverview {
  const parentProduct =
    BOUTIQUE_PRODUCTS.find((product) => product.isGiftCertificate) ?? null;
  const amounts = BOUTIQUE_GIFT_CARD_OPTIONS.map((option) => option.amount);
  const minAmount = amounts.length > 0 ? Math.min(...amounts) : 0;
  const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 0;

  return {
    parentProduct,
    options: BOUTIQUE_GIFT_CARD_OPTIONS,
    minAmountLabel: formatPhp(minAmount),
    maxAmountLabel: formatPhp(maxAmount),
    issuanceEnabled: BOUTIQUE_OPERATIONAL_CAPABILITIES.giftIssuanceEnabled,
    redemptionEnabled: BOUTIQUE_OPERATIONAL_CAPABILITIES.giftIssuanceEnabled,
  };
}

export type CrmBoutiqueBranchRecord = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  openingHours: string | null;
  isActive: boolean;
  isCurrentScope: boolean;
  pickupConciergeStatus: string;
};

export type BoutiqueStockMatrixRow = {
  productId: string;
  productName: string;
  categoryLabel: string;
  skuKind: BoutiqueSkuKind;
  sizeOrVolume: string;
  priceLabel: string;
  isTracked: boolean;
  branchAssignments: Array<{
    branchId: string;
    branchName: string;
    trackingLabel: string;
    canMutate: boolean;
  }>;
};

export function buildBoutiqueStockMatrix(
  branches: readonly CrmBoutiqueBranchRecord[]
): BoutiqueStockMatrixRow[] {
  return BOUTIQUE_PRODUCTS.map((product) => {
    const skuKind: BoutiqueSkuKind = product.isGiftCertificate
      ? "voucher"
      : product.category === "wellness-kits"
        ? "kit"
        : "retail";
    const trackingLabel = product.isGiftCertificate
      ? "Voucher SKU (No Physical Stock)"
      : "Not Tracked (Manual Shelf Check)";

    return {
      productId: product.id,
      productName: product.name,
      categoryLabel: getBoutiqueCategoryLabel(product.category),
      skuKind,
      sizeOrVolume: product.sizeOrVolume,
      priceLabel: product.priceLabel,
      isTracked: false,
      branchAssignments: branches.map((branch) => ({
        branchId: branch.id,
        branchName: branch.name,
        trackingLabel,
        canMutate: BOUTIQUE_OPERATIONAL_CAPABILITIES.stockMutationsEnabled,
      })),
    };
  });
}

export type BoutiqueCapabilityGroup =
  | "functional"
  | "marketing_governed"
  | "pending_authorization";

export type BoutiqueCapabilityEntry = {
  id: string;
  group: BoutiqueCapabilityGroup;
  title: string;
  summary: string;
  statusLabel: string;
  isEnabled: boolean;
  ownerApprovalRequired: boolean;
};

export function buildBoutiqueCapabilityMatrix(role: string): BoutiqueCapabilityEntry[] {
  const canApproveCatalog = canApproveBoutiqueCatalogChanges(role);

  return [
    {
      id: "catalog-inspection",
      group: "functional",
      title: "Canonical Boutique Catalog Inspection",
      summary:
        "Browse, filter, sort, and inspect all SKUs sourced directly from src/lib/public/boutique-catalog.ts.",
      statusLabel: "Functional",
      isEnabled: true,
      ownerApprovalRequired: false,
    },
    {
      id: "taxonomy-drilldown",
      group: "functional",
      title: "Category & Collection Taxonomy Drill-Down",
      summary:
        "Inspect live SKU counts and price ranges across Boutique categories and Wellness Collections.",
      statusLabel: "Functional",
      isEnabled: true,
      ownerApprovalRequired: false,
    },
    {
      id: "branch-concierge-directory",
      group: "functional",
      title: "Active Pickup Branch & Protocol Visibility",
      summary:
        "View live active Bacolod sanctuaries configured for in-spa front-desk pickup coordination.",
      statusLabel: "Functional",
      isEnabled: true,
      ownerApprovalRequired: false,
    },
    {
      id: "marketing-cms-governance",
      group: "marketing_governed",
      title: "Public Branding & Storefront Sections",
      summary: canApproveCatalog
        ? "Owner role can manage brand assets and public storefront copy in Owner Marketing Controls."
        : "Storefront brand logos and CMS hero copy remain governed separately by Owners and Digital Marketers.",
      statusLabel: canApproveCatalog ? "Owner Marketing Studio" : "Marketing Managed",
      isEnabled: canApproveCatalog,
      ownerApprovalRequired: true,
    },
    {
      id: "boutique-payments",
      group: "pending_authorization",
      title: "Online & POS Boutique Payment Settlement",
      summary:
        "Collecting online card/e-wallet charges or recording paid retail POS receipts for boutique SKUs is disabled.",
      statusLabel: "Pending Operational Authorization",
      isEnabled: BOUTIQUE_OPERATIONAL_CAPABILITIES.paymentsEnabled,
      ownerApprovalRequired: true,
    },
    {
      id: "boutique-orders",
      group: "pending_authorization",
      title: "Persistent Boutique Orders & Fulfillment Queue",
      summary:
        "Public cart reservations remain guest browser concierge lists (localStorage) until database order schema is authorized.",
      statusLabel: "Pending Operational Authorization",
      isEnabled: BOUTIQUE_OPERATIONAL_CAPABILITIES.orderProcessingEnabled,
      ownerApprovalRequired: true,
    },
    {
      id: "boutique-stock-ledger",
      group: "pending_authorization",
      title: "Inventory Stock Counts, Adjustments & Transfers",
      summary:
        "No inventory ledger exists yet; stock quantities are never fabricated and stock mutation actions remain locked.",
      statusLabel: "Pending Operational Authorization",
      isEnabled: BOUTIQUE_OPERATIONAL_CAPABILITIES.stockMutationsEnabled,
      ownerApprovalRequired: true,
    },
    {
      id: "gift-issuance",
      group: "pending_authorization",
      title: "Serialized Gift Certificate Issuance & Redemption",
      summary:
        "Voucher code generation, balance tracking, and reception redemption workflows await operational authorization.",
      statusLabel: "Pending Operational Authorization",
      isEnabled: BOUTIQUE_OPERATIONAL_CAPABILITIES.giftIssuanceEnabled,
      ownerApprovalRequired: true,
    },
    {
      id: "branch-sku-overrides",
      group: "pending_authorization",
      title: "Per-Branch Pricing & SKU Visibility Overrides",
      summary:
        "Branch-level SKU toggling and localized price overrides require database backing and owner approval.",
      statusLabel: "Pending Operational Authorization",
      isEnabled: false,
      ownerApprovalRequired: true,
    },
  ];
}

export type CrmBoutiqueStorefrontGovernance = {
  publicRoute: "/products";
  catalogSourcePath: "src/lib/public/boutique-catalog.ts";
  heroImageUrl: string;
  publicSectionCount: number;
  enabledSectionCount: number;
  brandSettingCount: number;
  publishedBrandSettingCount: number;
  conciergeStorageKey: "cradle_boutique_cart_v1";
  wishlistStorageKey: "cradle_boutique_wishlist_v1";
  ownerMarketingHref: "/owner/marketing";
  marketingStudioHref: "/marketing";
};

export type CrmBoutiqueOverviewMetrics = {
  totalSkus: number;
  physicalSkus: number;
  giftOptionsCount: number;
  activeCategoriesCount: number;
  activeBranchesCount: number;
};

export type CrmBoutiqueWorkspaceData = {
  actorRole: string;
  currentBranchId: string;
  currentBranchName: string;
  canApproveCatalogChanges: boolean;
  operationalCapabilities: typeof BOUTIQUE_OPERATIONAL_CAPABILITIES;
  catalog: BoutiqueCatalogItemView[];
  categories: BoutiqueCategorySummary[];
  collections: BoutiqueCollectionSummary[];
  giftCards: BoutiqueGiftCardOverview;
  branches: CrmBoutiqueBranchRecord[];
  stockMatrix: BoutiqueStockMatrixRow[];
  capabilityMatrix: BoutiqueCapabilityEntry[];
  governance: CrmBoutiqueStorefrontGovernance;
  overview: CrmBoutiqueOverviewMetrics;
  notices: {
    branchLoadError: string | null;
    marketingLoadError: string | null;
  };
};

export const BOUTIQUE_CONCIERGE_DEFAULT_HERO_IMAGE = BOUTIQUE_HERO_IMAGE;
