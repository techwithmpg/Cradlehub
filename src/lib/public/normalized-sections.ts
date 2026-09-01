import { SPA_IMAGES } from "@/constants/spa-images";
import { businessInfo, planningNotes } from "@/lib/public/public-site-data";
import type { Database } from "@/types/supabase";

export type PublicSiteSectionRow = Database["public"]["Tables"]["public_site_sections"]["Row"];

export interface NormalizedHeroSection {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl: string;
  secondaryImageUrl: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  brandEyebrow: string;
  isEnabled: boolean;
}

export interface NormalizedAboutSection {
  title: string;
  subtitle: string;
  body: string;
  paragraphs: string[];
  imageUrl: string;
  secondaryImageUrl: string;
  isEnabled: boolean;
}

export interface NormalizedQuoteBannerSection {
  title: string;
  subtitle: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl: string;
  isEnabled: boolean;
}

export interface NormalizedBeforeYouBookSection {
  title: string;
  subtitle: string;
  body: string;
  items: readonly string[];
  isEnabled: boolean;
}

export interface NormalizedSignatureServicesSection {
  title: string;
  subtitle: string;
  body: string;
  isVisible: boolean;
}

export interface NormalizedGallerySection {
  isVisible: boolean;
}

export interface NormalizedPublicSiteSections {
  hero: NormalizedHeroSection;
  about: NormalizedAboutSection;
  quoteBanner: NormalizedQuoteBannerSection;
  beforeYouBook: NormalizedBeforeYouBookSection;
  signatureServices: NormalizedSignatureServicesSection;
  gallery: NormalizedGallerySection;
  rawSections: PublicSiteSectionRow[];
}

function metadataObject(
  value: PublicSiteSectionRow["metadata"] | undefined
): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function sectionText(
  section: PublicSiteSectionRow | null | undefined,
  field:
    | "title"
    | "subtitle"
    | "body"
    | "cta_label"
    | "cta_href"
    | "image_url"
    | "secondary_image_url",
  fallback: string
): string {
  const value = section?.[field];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function metadataText(metadata: Record<string, unknown>, key: string, fallback: string): string {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function metadataItems(
  metadata: Record<string, unknown>,
  fallback: readonly string[]
): readonly string[] {
  const value = metadata.items;
  if (Array.isArray(value)) {
    const items = value.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0
    );
    if (items.length > 0) return items;
  }
  return fallback;
}

/**
 * Resolves raw database rows into typed, safe presentation models with canonical fallbacks.
 * Used across desktop homepage, mobile homepage, and future high-fidelity Marketing preview.
 */
export function resolvePublicSiteSections(
  sections?: PublicSiteSectionRow[] | null
): NormalizedPublicSiteSections {
  const rows = sections ?? [];
  const sectionMap = new Map(rows.map((s) => [s.section_key, s]));

  const getSection = (key: string) => sectionMap.get(key) ?? null;
  const isSectionEnabled = (key: string, defaultEnabled = true) => {
    const s = sectionMap.get(key);
    return s ? s.is_enabled : defaultEnabled;
  };

  // 1. Hero
  const heroRow = getSection("hero");
  const heroMeta = metadataObject(heroRow?.metadata);
  const hero: NormalizedHeroSection = {
    title: sectionText(heroRow, "title", "Restore Your Body. Quiet Your Mind."),
    subtitle: sectionText(
      heroRow,
      "subtitle",
      "Cradle Massage & Wellness Spa offers calming in-spa and home-service treatments in Bacolod for rest, recovery, and everyday renewal."
    ),
    ctaLabel: sectionText(heroRow, "cta_label", "Book Appointment"),
    ctaHref: sectionText(heroRow, "cta_href", "/book"),
    imageUrl: sectionText(heroRow, "image_url", SPA_IMAGES.hero),
    secondaryImageUrl: sectionText(heroRow, "secondary_image_url", SPA_IMAGES.heroPortrait),
    secondaryCtaLabel: metadataText(heroMeta, "secondaryCtaLabel", "Plan Your Visit"),
    secondaryCtaHref: metadataText(heroMeta, "secondaryCtaHref", "#plan-your-visit"),
    brandEyebrow: `${businessInfo.brandName} · ${businessInfo.location}`,
    isEnabled: isSectionEnabled("hero", true),
  };

  // 2. About
  const aboutRow = getSection("about");
  const aboutBody = sectionText(
    aboutRow,
    "body",
    "Cradle is designed for the moments when your body asks for quiet and your schedule needs something simple. Guests can visit the spa or request home service when comfort at home is the better setting."
  );
  const aboutParagraphs = aboutBody
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const about: NormalizedAboutSection = {
    title: sectionText(aboutRow, "title", "A calming wellness space for Bacolod guests."),
    subtitle: sectionText(aboutRow, "subtitle", "Spa Philosophy"),
    body: aboutBody,
    paragraphs: aboutParagraphs,
    imageUrl: sectionText(aboutRow, "image_url", SPA_IMAGES.about),
    secondaryImageUrl: sectionText(aboutRow, "secondary_image_url", SPA_IMAGES.aboutSecondary),
    isEnabled: isSectionEnabled("about", true),
  };

  // 3. Quote Banner / Final CTA
  const quoteRow = getSection("quote_banner");
  const quoteBanner: NormalizedQuoteBannerSection = {
    title: sectionText(quoteRow, "title", "Give yourself permission to pause."),
    subtitle: sectionText(quoteRow, "subtitle", "Pause Here"),
    body: sectionText(quoteRow, "body", ""),
    ctaLabel: sectionText(quoteRow, "cta_label", ""),
    ctaHref: sectionText(quoteRow, "cta_href", "/book"),
    imageUrl: sectionText(quoteRow, "image_url", SPA_IMAGES.ctaBanner),
    isEnabled: isSectionEnabled("quote_banner", true),
  };

  // 4. Before You Book
  const beforeRow = getSection("before_you_book");
  const beforeMeta = metadataObject(beforeRow?.metadata);
  const beforeYouBook: NormalizedBeforeYouBookSection = {
    title: sectionText(beforeRow, "title", "Plan your visit with clear expectations."),
    subtitle: sectionText(beforeRow, "subtitle", "Before You Book"),
    body: sectionText(
      beforeRow,
      "body",
      "Booking is designed to be calm and transparent. Choose the setting first so the system can guide you toward the right service and schedule."
    ),
    items: metadataItems(beforeMeta, planningNotes),
    isEnabled: isSectionEnabled("before_you_book", true),
  };

  // 5. Signature Services (Consumer-recognized)
  const servicesRow = getSection("signature_services");
  const signatureServices: NormalizedSignatureServicesSection = {
    title: sectionText(servicesRow, "title", "Explore Cradle's full menu by care category."),
    subtitle: sectionText(servicesRow, "subtitle", "Signature Services"),
    body: sectionText(
      servicesRow,
      "body",
      "Massage, salon, skin care, packages, and group spa experiences are organized for easy browsing. Booking availability still depends on branch and visit type."
    ),
    isVisible: isSectionEnabled("signature_services", true),
  };

  // 6. Gallery (Consumer-recognized visibility gate)
  const gallery: NormalizedGallerySection = {
    isVisible: isSectionEnabled("gallery", true),
  };

  return {
    hero,
    about,
    quoteBanner,
    beforeYouBook,
    signatureServices,
    gallery,
    rawSections: rows,
  };
}
