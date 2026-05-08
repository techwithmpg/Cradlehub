import { SPA_IMAGES } from "@/constants/spa-images";

export const PUBLIC_CATALOG_CATEGORY_NAMES = [
  "Massage Services",
  "Salon Services",
  "Skin Care Services",
  "Divine Renewal Packages",
  "Spa Party Packages",
] as const;

export type PublicCatalogCategoryName =
  (typeof PUBLIC_CATALOG_CATEGORY_NAMES)[number];

export const PUBLIC_CATALOG_CATEGORY_DETAILS: Record<
  PublicCatalogCategoryName,
  {
    shortName: string;
    eyebrow: string;
    description: string;
    image: string;
  }
> = {
  "Massage Services": {
    shortName: "Massage",
    eyebrow: "Body Recovery",
    description:
      "Classic relaxation, specialty bodywork, hot stone, hilot, and recovery-focused massage care.",
    image: SPA_IMAGES.swedish,
  },
  "Salon Services": {
    shortName: "Salon",
    eyebrow: "Hair, Nails & Beauty",
    description:
      "Hair care, nail care, lashes, waxing, styling, and makeup services for polished self-care.",
    image: SPA_IMAGES.contact,
  },
  "Skin Care Services": {
    shortName: "Skin Care",
    eyebrow: "Face & Body Care",
    description:
      "Facials, body scrubs, skin treatments, laser services, and consultation-led aesthetic care.",
    image: SPA_IMAGES.aboutSecondary,
  },
  "Divine Renewal Packages": {
    shortName: "Packages",
    eyebrow: "Curated Rituals",
    description:
      "Bundled spa rituals that combine massage, skin care, nails, and body care into longer escapes.",
    image: SPA_IMAGES.couples,
  },
  "Spa Party Packages": {
    shortName: "Spa Party",
    eyebrow: "Group Experiences",
    description:
      "Group spa experiences for 10 to 20 guests, coordinated with specialists and setup details.",
    image: SPA_IMAGES.booking,
  },
};

export const PUBLIC_CATALOG_SUBCATEGORY_ORDER = [
  "1-hour / standard",
  "1.5-hour / specialty",
  "Hair Care",
  "Nail Care",
  "Body Care",
  "Hair & Makeup",
  "Face Pampering",
  "Body Pampering",
  "Facial Treatments",
  "Laser Treatments",
  "Tattoo Removal",
  "Halo Tier",
  "Celestial Tier",
  "Spa Party Packages",
] as const;

