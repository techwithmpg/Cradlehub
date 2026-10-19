import { SPA_IMAGES } from "@/constants/spa-images";
import {
  getPublicHomeCategoryImage,
  type PublicCatalogCategoryName,
} from "@/lib/public/service-catalog-config";
import type { PublicSiteSectionRow } from "@/lib/queries/public-site";
import type { MarketingContentDraftRow } from "@/lib/queries/marketing-content";
import type { MarketingBrandSettingRow } from "@/lib/queries/marketing-brand";
import type { PublicCatalogService } from "@/lib/queries/services";
import type { Database } from "@/types/supabase";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

export type PublicImageCategory =
  | "homepage"
  | "about"
  | "services"
  | "branches"
  | "landing"
  | "brand";

export type PublicImageOwner = "website" | "brand" | "branches" | "services";

export type PublicImageDevice = "desktop" | "mobile" | "both";

export type PublicImageFieldKey =
  | "imageUrl"
  | "secondaryImageUrl"
  | "mobileImageUrl"
  | "categoryImage"
  | "managedSlot"
  | "brandSetting"
  | "branchPhoto"
  | "servicePhoto";

export type PublicImageSlot = {
  id: string;
  label: string;
  page: string;
  section: string;
  category: PublicImageCategory;
  deviceUsage: PublicImageDevice;
  recommendedDimensions: string;
  aspectRatio: string;
  defaultUrl: string;
  canonicalOwner: PublicImageOwner;
  targetTab?: "website" | "brand" | "branches" | "services";
  targetSectionKey?: string;
  fieldKey: PublicImageFieldKey;
  categoryName?: PublicCatalogCategoryName;
  slotKey?: string;
  targetId?: string;
  description: string;
};

export const MANAGED_SITE_IMAGES_SECTION_KEY = "site_images";

export const PUBLIC_IMAGE_SLOTS: readonly PublicImageSlot[] = [
  // ── HOMEPAGE: HERO HEADER ──────────────────────────────────────────────────
  {
    id: "hero_desktop",
    label: "Hero Desktop Background",
    page: "Homepage",
    section: "Hero Header",
    category: "homepage",
    deviceUsage: "desktop",
    recommendedDimensions: "1920 × 1080px (16:9)",
    aspectRatio: "16:9",
    defaultUrl: SPA_IMAGES.hero,
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: "hero",
    fieldKey: "imageUrl",
    description: "Main full-bleed background photograph for desktop homepage hero header.",
  },
  {
    id: "hero_mobile",
    label: "Hero Mobile Slide 1",
    page: "Homepage",
    section: "Hero Header",
    category: "homepage",
    deviceUsage: "mobile",
    recommendedDimensions: "1080 × 1920px (9:16)",
    aspectRatio: "9:16",
    defaultUrl: SPA_IMAGES.heroMobile,
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: "hero",
    fieldKey: "mobileImageUrl",
    description: "First full-height portrait slide displayed in the mobile home hero carousel.",
  },
  {
    id: "hero_portrait",
    label: "Hero Desktop Portrait Card",
    page: "Homepage",
    section: "Hero Header",
    category: "homepage",
    deviceUsage: "desktop",
    recommendedDimensions: "800 × 1000px (4:5)",
    aspectRatio: "4:5",
    defaultUrl: SPA_IMAGES.heroPortrait,
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: "hero",
    fieldKey: "secondaryImageUrl",
    description: "Atmospheric portrait card floating beside the main hero copy on desktop.",
  },
  {
    id: "hero_mobile_slide_2",
    label: "Hero Mobile Slide 2 (Wide Room)",
    page: "Homepage",
    section: "Hero Header",
    category: "homepage",
    deviceUsage: "mobile",
    recommendedDimensions: "1080 × 1920px (9:16)",
    aspectRatio: "9:16",
    defaultUrl: SPA_IMAGES.heroWide,
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: MANAGED_SITE_IMAGES_SECTION_KEY,
    fieldKey: "managedSlot",
    slotKey: "home_hero_mobile_slide_2",
    description: "Second slide in the mobile hero carousel showcasing room wide ambiance.",
  },
  {
    id: "hero_mobile_slide_3",
    label: "Hero Mobile Slide 3 (Treatment Ambience)",
    page: "Homepage",
    section: "Hero Header",
    category: "homepage",
    deviceUsage: "mobile",
    recommendedDimensions: "1080 × 1920px (9:16)",
    aspectRatio: "9:16",
    defaultUrl: SPA_IMAGES.heroAmbience,
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: MANAGED_SITE_IMAGES_SECTION_KEY,
    fieldKey: "managedSlot",
    slotKey: "home_hero_mobile_slide_3",
    description:
      "Third slide in the mobile hero carousel highlighting soothing treatment lighting.",
  },

  // ── HOMEPAGE: SIGNATURE SERVICES CATEGORY COVERS ───────────────────────────
  {
    id: "category_massage",
    label: "Category Cover: Massage Services",
    page: "Homepage",
    section: "Signature Services",
    category: "homepage",
    deviceUsage: "both",
    recommendedDimensions: "800 × 600px (4:3)",
    aspectRatio: "4:3",
    defaultUrl: getPublicHomeCategoryImage("Massage Services"),
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: "signature_services",
    fieldKey: "categoryImage",
    categoryName: "Massage Services",
    description: "Cover card image for Massage Services on homepage grid and mobile categories.",
  },
  {
    id: "category_salon",
    label: "Category Cover: Salon Services",
    page: "Homepage",
    section: "Signature Services",
    category: "homepage",
    deviceUsage: "both",
    recommendedDimensions: "800 × 600px (4:3)",
    aspectRatio: "4:3",
    defaultUrl: getPublicHomeCategoryImage("Salon Services"),
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: "signature_services",
    fieldKey: "categoryImage",
    categoryName: "Salon Services",
    description: "Cover card image for Salon Services on homepage grid and mobile categories.",
  },
  {
    id: "category_skin_care",
    label: "Category Cover: Skin Care Services",
    page: "Homepage",
    section: "Signature Services",
    category: "homepage",
    deviceUsage: "both",
    recommendedDimensions: "800 × 600px (4:3)",
    aspectRatio: "4:3",
    defaultUrl: getPublicHomeCategoryImage("Skin Care Services"),
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: "signature_services",
    fieldKey: "categoryImage",
    categoryName: "Skin Care Services",
    description: "Cover card image for Skin Care & Facials on homepage grid and mobile categories.",
  },
  {
    id: "category_packages",
    label: "Category Cover: Divine Renewal Packages",
    page: "Homepage",
    section: "Signature Services",
    category: "homepage",
    deviceUsage: "both",
    recommendedDimensions: "800 × 600px (4:3)",
    aspectRatio: "4:3",
    defaultUrl: getPublicHomeCategoryImage("Divine Renewal Packages"),
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: "signature_services",
    fieldKey: "categoryImage",
    categoryName: "Divine Renewal Packages",
    description:
      "Cover card image for Divine Renewal Packages on homepage grid and mobile categories.",
  },
  {
    id: "category_party",
    label: "Category Cover: Spa Party Packages",
    page: "Homepage",
    section: "Signature Services",
    category: "homepage",
    deviceUsage: "both",
    recommendedDimensions: "800 × 600px (4:3)",
    aspectRatio: "4:3",
    defaultUrl: getPublicHomeCategoryImage("Spa Party Packages"),
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: "signature_services",
    fieldKey: "categoryImage",
    categoryName: "Spa Party Packages",
    description: "Cover card image for Spa Party Packages on homepage grid and mobile categories.",
  },

  // ── HOMEPAGE: CHOOSE SETTING & EXPERIENCE ─────────────────────────────────
  {
    id: "setting_in_spa",
    label: "Setting Card: In-Spa Experience",
    page: "Homepage",
    section: "Choose Setting",
    category: "homepage",
    deviceUsage: "both",
    recommendedDimensions: "800 × 600px (4:3)",
    aspectRatio: "4:3",
    defaultUrl: SPA_IMAGES.couples,
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: MANAGED_SITE_IMAGES_SECTION_KEY,
    fieldKey: "managedSlot",
    slotKey: "home_setting_in_spa",
    description:
      "Illustration for In-Spa appointment setting on desktop and mobile experience cards.",
  },
  {
    id: "setting_home_service",
    label: "Setting Card: Home Service Experience",
    page: "Homepage",
    section: "Choose Setting",
    category: "homepage",
    deviceUsage: "both",
    recommendedDimensions: "800 × 600px (4:3)",
    aspectRatio: "4:3",
    defaultUrl: SPA_IMAGES.swedish,
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: MANAGED_SITE_IMAGES_SECTION_KEY,
    fieldKey: "managedSlot",
    slotKey: "home_setting_home_service",
    description:
      "Illustration for Home Service appointment setting on desktop and mobile experience cards.",
  },

  // ── HOMEPAGE: MOBILE SIGNATURE RITUALS ────────────────────────────────────
  {
    id: "ritual_glow",
    label: "Signature Ritual: Glow Ritual",
    page: "Homepage",
    section: "Signature Rituals",
    category: "homepage",
    deviceUsage: "mobile",
    recommendedDimensions: "600 × 900px (2:3)",
    aspectRatio: "2:3",
    defaultUrl: "/images/spa/home/ritual-glow.jpg",
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: MANAGED_SITE_IMAGES_SECTION_KEY,
    fieldKey: "managedSlot",
    slotKey: "mobile_ritual_glow",
    description: "Featured background card image for Glow Ritual in the mobile sticky stack.",
  },
  {
    id: "ritual_recovery",
    label: "Signature Ritual: Recovery Ritual",
    page: "Homepage",
    section: "Signature Rituals",
    category: "homepage",
    deviceUsage: "mobile",
    recommendedDimensions: "600 × 900px (2:3)",
    aspectRatio: "2:3",
    defaultUrl: "/images/spa/home/ritual-recovery.jpg",
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: MANAGED_SITE_IMAGES_SECTION_KEY,
    fieldKey: "managedSlot",
    slotKey: "mobile_ritual_recovery",
    description: "Featured background card image for Recovery Ritual in the mobile sticky stack.",
  },
  {
    id: "ritual_full_reset",
    label: "Signature Ritual: Full Reset Ritual",
    page: "Homepage",
    section: "Signature Rituals",
    category: "homepage",
    deviceUsage: "mobile",
    recommendedDimensions: "600 × 900px (2:3)",
    aspectRatio: "2:3",
    defaultUrl: "/images/spa/home/ritual-full-reset.jpg",
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: MANAGED_SITE_IMAGES_SECTION_KEY,
    fieldKey: "managedSlot",
    slotKey: "mobile_ritual_full_reset",
    description: "Featured background card image for Full Reset Ritual in the mobile sticky stack.",
  },

  // ── HOMEPAGE: ABOUT & PHILOSOPHY ──────────────────────────────────────────
  {
    id: "about_primary",
    label: "About Section Primary Image",
    page: "Homepage",
    section: "About & Philosophy",
    category: "homepage",
    deviceUsage: "both",
    recommendedDimensions: "1200 × 800px (3:2)",
    aspectRatio: "3:2",
    defaultUrl: SPA_IMAGES.about,
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: "about",
    fieldKey: "imageUrl",
    description: "Main treatment room image illustrating spa story and philosophy on the homepage.",
  },
  {
    id: "about_secondary",
    label: "About Section Secondary Image",
    page: "Homepage",
    section: "About & Philosophy",
    category: "homepage",
    deviceUsage: "both",
    recommendedDimensions: "800 × 800px (1:1)",
    aspectRatio: "1:1",
    defaultUrl: SPA_IMAGES.aboutSecondary,
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: "about",
    fieldKey: "secondaryImageUrl",
    description: "Secondary wellness detail image accompanying the philosophy narrative.",
  },

  // ── HOMEPAGE: PROMOTION & CTAS ────────────────────────────────────────────
  {
    id: "quote_banner",
    label: "Promotion / Quote Banner",
    page: "Homepage",
    section: "Promotion / Quote Banner",
    category: "homepage",
    deviceUsage: "both",
    recommendedDimensions: "1920 × 600px (16:5)",
    aspectRatio: "16:5",
    defaultUrl: SPA_IMAGES.ctaBanner,
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: "quote_banner",
    fieldKey: "imageUrl",
    description: "Full-width promotional banner image encouraging guests to pause and book.",
  },
  {
    id: "mobile_final_cta_ambient",
    label: "Mobile Final CTA Ambient Backdrop",
    page: "Homepage",
    section: "Promotion / Quote Banner",
    category: "homepage",
    deviceUsage: "mobile",
    recommendedDimensions: "1080 × 1920px (9:16)",
    aspectRatio: "9:16",
    defaultUrl: SPA_IMAGES.heroAmbience,
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: MANAGED_SITE_IMAGES_SECTION_KEY,
    fieldKey: "managedSlot",
    slotKey: "mobile_final_cta_ambient",
    description: "Atmospheric dark background image behind the mobile homepage final booking CTA.",
  },

  // ── ABOUT PAGE (/about) ───────────────────────────────────────────────────
  {
    id: "about_page_story",
    label: "About Page: Our Story Interior",
    page: "About Page",
    section: "Our Story",
    category: "about",
    deviceUsage: "both",
    recommendedDimensions: "800 × 600px (4:3)",
    aspectRatio: "4:3",
    defaultUrl: SPA_IMAGES.about,
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: MANAGED_SITE_IMAGES_SECTION_KEY,
    fieldKey: "managedSlot",
    slotKey: "about_page_story",
    description: "Interior photograph featured in the Our Story narrative on /about.",
  },
  {
    id: "about_page_experience",
    label: "About Page: The Cradle Experience",
    page: "About Page",
    section: "Cradle Experience",
    category: "about",
    deviceUsage: "both",
    recommendedDimensions: "800 × 600px (4:3)",
    aspectRatio: "4:3",
    defaultUrl: SPA_IMAGES.aboutSecondary,
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: MANAGED_SITE_IMAGES_SECTION_KEY,
    fieldKey: "managedSlot",
    slotKey: "about_page_experience",
    description: "Relaxation lounge photograph on /about and mobile about page.",
  },

  // ── SERVICES PAGE (/services) ─────────────────────────────────────────────
  {
    id: "services_page_banner",
    label: "Services Page Top Banner",
    page: "Services & Menu",
    section: "Catalog Header",
    category: "services",
    deviceUsage: "both",
    recommendedDimensions: "1920 × 600px (16:5)",
    aspectRatio: "16:5",
    defaultUrl: SPA_IMAGES.ctaBanner,
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: MANAGED_SITE_IMAGES_SECTION_KEY,
    fieldKey: "managedSlot",
    slotKey: "services_page_banner",
    description: "Hero banner image greeting guests at the top of /services and mobile services.",
  },

  // ── BRANCHES PAGE (/branches) ─────────────────────────────────────────────
  {
    id: "branches_fallback_ambient",
    label: "Branch Card Fallback Image",
    page: "Branches",
    section: "Branch Locations",
    category: "branches",
    deviceUsage: "both",
    recommendedDimensions: "800 × 600px (4:3)",
    aspectRatio: "4:3",
    defaultUrl: SPA_IMAGES.heroAmbience,
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: MANAGED_SITE_IMAGES_SECTION_KEY,
    fieldKey: "managedSlot",
    slotKey: "branches_fallback_ambient",
    description:
      "Fallback photograph used for branch cards when an individual branch photo is not uploaded.",
  },

  // ── LANDING PAGES & BOOKING FLOW ──────────────────────────────────────────
  {
    id: "landing_spa_banner",
    label: "Massage Spa Bacolod Hero Banner",
    page: "Landing Pages & Booking",
    section: "Massage Spa Bacolod",
    category: "landing",
    deviceUsage: "both",
    recommendedDimensions: "1920 × 800px (24:10)",
    aspectRatio: "24:10",
    defaultUrl: SPA_IMAGES.ctaBanner,
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: MANAGED_SITE_IMAGES_SECTION_KEY,
    fieldKey: "managedSlot",
    slotKey: "landing_spa_banner",
    description: "Hero banner on the /massage-spa-bacolod search landing page.",
  },
  {
    id: "landing_spa_story",
    label: "Massage Spa Bacolod Story Photo",
    page: "Landing Pages & Booking",
    section: "Massage Spa Bacolod",
    category: "landing",
    deviceUsage: "both",
    recommendedDimensions: "800 × 600px (4:3)",
    aspectRatio: "4:3",
    defaultUrl: SPA_IMAGES.about,
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: MANAGED_SITE_IMAGES_SECTION_KEY,
    fieldKey: "managedSlot",
    slotKey: "landing_spa_story",
    description: "Treatment room interior photo on the /massage-spa-bacolod landing page.",
  },
  {
    id: "landing_home_banner",
    label: "Home Service Bacolod Hero Banner",
    page: "Landing Pages & Booking",
    section: "Home Service Bacolod",
    category: "landing",
    deviceUsage: "both",
    recommendedDimensions: "1920 × 800px (24:10)",
    aspectRatio: "24:10",
    defaultUrl: SPA_IMAGES.booking,
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: MANAGED_SITE_IMAGES_SECTION_KEY,
    fieldKey: "managedSlot",
    slotKey: "landing_home_banner",
    description: "Hero banner on the /home-service-massage-bacolod search landing page.",
  },
  {
    id: "landing_home_setup",
    label: "Home Service Bacolod Setup Photo",
    page: "Landing Pages & Booking",
    section: "Home Service Bacolod",
    category: "landing",
    deviceUsage: "both",
    recommendedDimensions: "800 × 600px (4:3)",
    aspectRatio: "4:3",
    defaultUrl: SPA_IMAGES.booking,
    canonicalOwner: "website",
    targetTab: "website",
    targetSectionKey: MANAGED_SITE_IMAGES_SECTION_KEY,
    fieldKey: "managedSlot",
    slotKey: "landing_home_setup",
    description: "In-home massage setup presentation photo on /home-service-massage-bacolod.",
  },
  // ── BRAND & IDENTITY (OWNED BY BRAND STUDIO) ──────────────────────────────
  {
    id: "brand_header_logo",
    label: "Header Primary Logo",
    page: "Brand & Identity",
    section: "Site Header",
    category: "brand",
    deviceUsage: "both",
    recommendedDimensions: "400 × 120px (transparent PNG / SVG)",
    aspectRatio: "10:3",
    defaultUrl: "/images/brand/cradle-logo.png",
    canonicalOwner: "brand",
    targetTab: "brand",
    fieldKey: "brandSetting",
    description: "Official brand logo rendered in desktop navigation bar and mobile drawer header.",
  },
  {
    id: "brand_footer_logo",
    label: "Footer Brand Logo",
    page: "Brand & Identity",
    section: "Site Footer",
    category: "brand",
    deviceUsage: "both",
    recommendedDimensions: "400 × 120px (gold/light variant)",
    aspectRatio: "10:3",
    defaultUrl: "/images/brand/cradle-logo-gold.png",
    canonicalOwner: "brand",
    targetTab: "brand",
    fieldKey: "brandSetting",
    description: "Gold/light logo variant rendered above footer description and branch list.",
  },
  {
    id: "brand_mark",
    label: "Brand Mark / Seal",
    page: "Brand & Identity",
    section: "Brand Mark",
    category: "brand",
    deviceUsage: "both",
    recommendedDimensions: "256 × 256px (1:1 square)",
    aspectRatio: "1:1",
    defaultUrl: "/images/brand/cradle-mark.png",
    canonicalOwner: "brand",
    targetTab: "brand",
    fieldKey: "brandSetting",
    description: "Iconic monogram / seal used for social sharing and compact branding.",
  },
  {
    id: "brand_site_icon",
    label: "Site Icon / Favicon",
    page: "Brand & Identity",
    section: "Browser Identity",
    category: "brand",
    deviceUsage: "both",
    recommendedDimensions: "512 × 512px (square PNG / ICO)",
    aspectRatio: "1:1",
    defaultUrl: "/favicon.ico",
    canonicalOwner: "brand",
    targetTab: "brand",
    fieldKey: "brandSetting",
    description: "Browser tab icon and mobile homescreen PWA bookmark icon.",
  },
] as const;

export const MANAGED_SITE_IMAGE_SLOT_KEYS = new Set(
  PUBLIC_IMAGE_SLOTS.filter((slot) => slot.fieldKey === "managedSlot")
    .map((slot) => slot.slotKey)
    .filter((key): key is string => Boolean(key))
);

export function isRenderableManagedSiteImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const urlText = value.trim();
  if (!urlText || urlText.length > 1000 || /[\\\s]/.test(urlText)) return false;
  if (urlText.startsWith("/")) return !urlText.startsWith("//");

  try {
    const url = new URL(urlText);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) {
      return false;
    }
    if (url.hostname === "images.unsplash.com") return url.pathname.startsWith("/photo-");

    let configuredHost: string | null = null;
    try {
      const configuredUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
      if (configuredUrl.protocol === "https:") configuredHost = configuredUrl.hostname;
    } catch {
      // A missing or local build target does not authorize another remote host.
    }

    return (
      (url.hostname === "lsrbwqhvzjfpiabeolkv.supabase.co" || url.hostname === configuredHost) &&
      url.pathname.startsWith("/storage/v1/object/public/")
    );
  } catch {
    return false;
  }
}

export type SlotResolutionResult = {
  effectiveUrl: string;
  isCustom: boolean;
  status:
    | "published_default"
    | "published_custom"
    | "draft"
    | "pending_review"
    | "approved"
    | "changes_requested";
  draftId?: string;
  publishedUrl?: string;
  draftUrl?: string;
};

export type SlotResolution = SlotResolutionResult;

export function isActiveMarketingDraft(draft: MarketingContentDraftRow): boolean {
  return draft.status !== "published" && draft.status !== "archived";
}

function readMetaRecord(val: unknown): Record<string, unknown> {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return {};
}

/**
 * Extracts managed slots map from public_site_sections or drafts.
 */
export function extractManagedSlotsFromMetadata(metadata: unknown): Record<string, string> {
  const meta = readMetaRecord(metadata);
  const slotsRaw = readMetaRecord(meta.slots);
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(slotsRaw)) {
    if (MANAGED_SITE_IMAGE_SLOT_KEYS.has(key) && isRenderableManagedSiteImageUrl(val)) {
      result[key] = val.trim();
    }
  }
  return result;
}

/**
 * Resolves current value and state for a public website image slot.
 */
export function resolveSlotState({
  slot,
  publishedSections = [],
  drafts = [],
  brandSettings = [],
  branches = [],
  services = [],
}: {
  slot: PublicImageSlot;
  publishedSections?: readonly PublicSiteSectionRow[];
  drafts?: readonly MarketingContentDraftRow[];
  brandSettings?: readonly MarketingBrandSettingRow[];
  branches?: readonly BranchRow[];
  services?: readonly PublicCatalogService[];
}): SlotResolutionResult {
  // 1. BRAND OWNER
  if (slot.canonicalOwner === "brand") {
    const draftBrand = drafts.find((d) => d.content_type === "brand" && isActiveMarketingDraft(d));
    const meta = readMetaRecord(draftBrand?.metadata);

    let publishedUrl: string | undefined;
    let draftUrl: string | undefined;

    if (slot.id === "brand_header_logo") {
      const row = brandSettings.find((b) => b.setting_key === "header_logo");
      const val = readMetaRecord(row?.value);
      publishedUrl = (val.url as string) || slot.defaultUrl;
      draftUrl = (meta.headerLogoUrl as string) || draftBrand?.image_url || undefined;
    } else if (slot.id === "brand_footer_logo") {
      const row = brandSettings.find((b) => b.setting_key === "footer_logo");
      const val = readMetaRecord(row?.value);
      publishedUrl = (val.url as string) || slot.defaultUrl;
      draftUrl = (meta.footerLogoUrl as string) || draftBrand?.secondary_image_url || undefined;
    } else if (slot.id === "brand_mark") {
      const row = brandSettings.find((b) => b.setting_key === "brand_mark");
      const val = readMetaRecord(row?.value);
      publishedUrl = (val.url as string) || slot.defaultUrl;
      draftUrl = (meta.brandMarkUrl as string) || undefined;
    } else if (slot.id === "brand_site_icon") {
      const row = brandSettings.find((b) => b.setting_key === "site_icon");
      const val = readMetaRecord(row?.value);
      publishedUrl = (val.url as string) || slot.defaultUrl;
      draftUrl = (meta.siteIconUrl as string) || undefined;
    }

    if (draftUrl && draftUrl !== publishedUrl && draftBrand) {
      return {
        effectiveUrl: draftUrl,
        isCustom: true,
        status:
          draftBrand.status === "approved"
            ? "approved"
            : draftBrand.status === "changes_requested"
              ? "changes_requested"
              : draftBrand.status === "submitted"
                ? "pending_review"
                : "draft",
        draftId: draftBrand.id,
        publishedUrl,
        draftUrl,
      };
    }

    return {
      effectiveUrl: publishedUrl || slot.defaultUrl,
      isCustom: Boolean(publishedUrl && publishedUrl !== slot.defaultUrl),
      status:
        publishedUrl && publishedUrl !== slot.defaultUrl ? "published_custom" : "published_default",
      publishedUrl,
    };
  }

  // 2. BRANCHES OWNER
  if (slot.canonicalOwner === "branches") {
    const branch = branches.find((b) => b.id === slot.targetId);
    const locMeta = readMetaRecord(branch?.location_metadata);
    const publishedUrl =
      (locMeta.image_url as string) || (locMeta.imageUrl as string) || slot.defaultUrl;
    return {
      effectiveUrl: publishedUrl,
      isCustom: publishedUrl !== slot.defaultUrl,
      status: publishedUrl !== slot.defaultUrl ? "published_custom" : "published_default",
      publishedUrl,
    };
  }

  // 3. SERVICES OWNER
  if (slot.canonicalOwner === "services") {
    const svc = services.find((s) => s.id === slot.targetId);
    const publishedUrl = svc?.imageUrl || slot.defaultUrl;
    return {
      effectiveUrl: publishedUrl,
      isCustom: publishedUrl !== slot.defaultUrl,
      status: publishedUrl !== slot.defaultUrl ? "published_custom" : "published_default",
      publishedUrl,
    };
  }

  // 4. WEBSITE STUDIO SLOTS
  const sectionKey = slot.targetSectionKey ?? "hero";
  const draft = drafts.find(
    (d) => d.content_type === "section" && d.content_key === sectionKey && isActiveMarketingDraft(d)
  );
  const published = publishedSections.find((s) => s.section_key === sectionKey);

  let publishedUrl: string | undefined;
  let draftUrl: string | undefined;

  if (slot.fieldKey === "imageUrl") {
    const publishedImage = published?.image_url;
    const draftImage = draft?.image_url;
    publishedUrl = isRenderableManagedSiteImageUrl(publishedImage)
      ? publishedImage.trim()
      : slot.defaultUrl;
    draftUrl = isRenderableManagedSiteImageUrl(draftImage) ? draftImage.trim() : undefined;
  } else if (slot.fieldKey === "secondaryImageUrl") {
    const publishedImage = published?.secondary_image_url;
    const draftImage = draft?.secondary_image_url;
    publishedUrl = isRenderableManagedSiteImageUrl(publishedImage)
      ? publishedImage.trim()
      : slot.defaultUrl;
    draftUrl = isRenderableManagedSiteImageUrl(draftImage) ? draftImage.trim() : undefined;
  } else if (slot.fieldKey === "mobileImageUrl") {
    const pubMeta = readMetaRecord(published?.metadata);
    const draftMeta = readMetaRecord(draft?.metadata);
    publishedUrl = isRenderableManagedSiteImageUrl(pubMeta.mobileImageUrl)
      ? pubMeta.mobileImageUrl.trim()
      : slot.defaultUrl;
    draftUrl = isRenderableManagedSiteImageUrl(draftMeta.mobileImageUrl)
      ? draftMeta.mobileImageUrl.trim()
      : undefined;
  } else if (slot.fieldKey === "categoryImage" && slot.categoryName) {
    const pubMeta = readMetaRecord(published?.metadata);
    const pubCatImages = readMetaRecord(pubMeta.categoryImages);
    const pubCategoryImage = pubCatImages[slot.categoryName];
    publishedUrl = isRenderableManagedSiteImageUrl(pubCategoryImage)
      ? pubCategoryImage.trim()
      : slot.defaultUrl;

    const draftMeta = readMetaRecord(draft?.metadata);
    const draftCatImages = readMetaRecord(draftMeta.categoryImages);
    const draftCategoryImage = draftCatImages[slot.categoryName];
    draftUrl = isRenderableManagedSiteImageUrl(draftCategoryImage)
      ? draftCategoryImage.trim()
      : undefined;
  } else if (slot.fieldKey === "managedSlot" && slot.slotKey) {
    const pubSlots = extractManagedSlotsFromMetadata(published?.metadata);
    publishedUrl = pubSlots[slot.slotKey] || slot.defaultUrl;

    const draftSlots = extractManagedSlotsFromMetadata(draft?.metadata);
    draftUrl = draftSlots[slot.slotKey] || undefined;
  }

  // If there's an active draft that differs from published or is explicitly in draft state
  if (draft && draftUrl && draftUrl !== publishedUrl) {
    return {
      effectiveUrl: draftUrl,
      isCustom: true,
      status:
        draft.status === "approved"
          ? "approved"
          : draft.status === "changes_requested"
            ? "changes_requested"
            : draft.status === "submitted"
              ? "pending_review"
              : "draft",
      draftId: draft.id,
      publishedUrl,
      draftUrl,
    };
  }

  return {
    effectiveUrl: publishedUrl || slot.defaultUrl,
    isCustom: Boolean(publishedUrl && publishedUrl !== slot.defaultUrl),
    status:
      publishedUrl && publishedUrl !== slot.defaultUrl ? "published_custom" : "published_default",
    publishedUrl,
  };
}

/**
 * Builds dynamic public image slots for active branches and signature services.
 */
export function buildDynamicPublicImageSlots({
  branches = [],
  services = [],
}: {
  branches?: readonly BranchRow[];
  services?: readonly PublicCatalogService[];
}): PublicImageSlot[] {
  const dynamicSlots: PublicImageSlot[] = [];

  // Branches
  for (const branch of branches) {
    const meta = readMetaRecord(branch.location_metadata);
    const branchImg = (meta.image_url as string) || (meta.imageUrl as string) || SPA_IMAGES.contact;
    dynamicSlots.push({
      id: `branch_photo_${branch.id}`,
      label: `Branch Photo: ${branch.name}`,
      page: "Branches",
      section: "Branch Directory",
      category: "branches",
      deviceUsage: "both",
      recommendedDimensions: "1200 × 800px (3:2)",
      aspectRatio: "3:2",
      defaultUrl: branchImg,
      canonicalOwner: "branches",
      targetTab: "branches",
      targetId: branch.id,
      fieldKey: "branchPhoto",
      description: `Authoritative presentation photo for ${branch.name}. Owned by Branches Studio.`,
    });
  }

  // Featured Catalog Services
  for (const service of services.slice(0, 10)) {
    dynamicSlots.push({
      id: `service_photo_${service.id}`,
      label: `Service Photo: ${service.name}`,
      page: "Services & Menu",
      section: service.categoryName || "Service Catalog",
      category: "services",
      deviceUsage: "both",
      recommendedDimensions: "800 × 600px (4:3)",
      aspectRatio: "4:3",
      defaultUrl: service.imageUrl || SPA_IMAGES.swedish,
      canonicalOwner: "services",
      targetTab: "services",
      targetId: service.id,
      fieldKey: "servicePhoto",
      description: `Authoritative catalog picture for ${service.name}. Owned by Services Studio.`,
    });
  }

  return dynamicSlots;
}
