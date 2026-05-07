import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  HeartHandshake,
  Home,
  Leaf,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { SPA_IMAGES } from "@/constants/spa-images";
import { getAllServices } from "@/lib/queries/services";
import {
  getPublicSiteAssets,
  getPublicSiteSections,
  type PublicSiteSectionRow,
} from "@/lib/queries/public-site";
import {
  bookingJourneySteps,
  businessInfo,
  galleryItems,
  guestReasons,
  heroProofPoints,
  planningNotes,
  publicBranches,
  publicPhones,
  quickTrustPoints,
  settingCards,
  teamRoles,
  whyGuestsChooseCradle,
} from "@/lib/public/public-site-data";
import type { Database } from "@/types/supabase";
import { ScrollReveal } from "./scroll-reveal";

type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type CategoryRow = Pick<
  Database["public"]["Tables"]["service_categories"]["Row"],
  "id" | "name" | "display_order"
>;
type CategoryRelation = CategoryRow | CategoryRow[] | null;
type ServiceWithCategory = ServiceRow & {
  service_categories?: CategoryRelation;
};

type CoverImageProps = {
  src: string;
  alt: string;
  priority?: boolean;
  sizes: string;
  className?: string;
};

const DEFAULT_DESCRIPTION =
  "A calming wellness treatment designed to help you pause, release tension, and feel renewed.";

const SERVICE_IMAGES = [
  SPA_IMAGES.swedish,
  SPA_IMAGES.deepTissue,
  SPA_IMAGES.aromatherapy,
  SPA_IMAGES.hotStone,
  SPA_IMAGES.reflexology,
  SPA_IMAGES.couples,
] as const;

const proofIcons = [ShieldCheck, Home, MapPin, MessageCircle] as const;
const journeyIcons = [Home, Sparkles, CalendarDays, HeartHandshake] as const;
const whyIcons = [Leaf, CalendarDays, Home, MapPin] as const;

function metadataObject(value: PublicSiteSectionRow["metadata"] | undefined) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function sectionText(
  section: PublicSiteSectionRow | null,
  field: "title" | "subtitle" | "body" | "cta_label" | "cta_href" | "image_url" | "secondary_image_url",
  fallback: string
): string {
  return section?.[field] ?? fallback;
}

function metadataText(
  metadata: Record<string, unknown>,
  key: string,
  fallback: string
): string {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function metadataItems(
  metadata: Record<string, unknown>,
  fallback: readonly string[]
): readonly string[] {
  const value = metadata.items;
  if (Array.isArray(value)) {
    const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    if (items.length > 0) return items;
  }

  return fallback;
}

function CoverImage({ src, alt, priority, sizes, className = "" }: CoverImageProps) {
  const imageClass = `object-cover ${className}`.trim();

  if (src.startsWith("/") && !src.startsWith("//")) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        className={imageClass}
        sizes={sizes}
      />
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={`absolute inset-0 h-full w-full ${imageClass}`} />;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

function firstCategory(value: CategoryRelation | undefined): CategoryRow | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function resolveServiceImage(name: string, index: number) {
  const key = name.toLowerCase();
  if (key.includes("swedish")) return SPA_IMAGES.swedish;
  if (key.includes("deep")) return SPA_IMAGES.deepTissue;
  if (key.includes("aroma")) return SPA_IMAGES.aromatherapy;
  if (key.includes("stone")) return SPA_IMAGES.hotStone;
  if (key.includes("reflex")) return SPA_IMAGES.reflexology;
  if (key.includes("couple")) return SPA_IMAGES.couples;
  return SERVICE_IMAGES[index % SERVICE_IMAGES.length]!;
}

function buildServiceTags(serviceName: string, categoryName: string) {
  const key = serviceName.toLowerCase();
  if (key.includes("swedish")) return ["Relaxation", "Stress relief", "First-time friendly"];
  if (key.includes("deep")) return ["Deep pressure", "Muscle tension", "Recovery"];
  if (key.includes("aroma")) return ["Relaxation", "Calming scent", "Gentle reset"];
  if (key.includes("stone")) return ["Warmth", "Deep relaxation", "In-spa"];
  if (key.includes("reflex")) return ["Pressure points", "Foot care", "Relaxation"];
  if (key.includes("couple")) return ["Shared session", "In-spa", "Self-care"];
  if (key.includes("home")) return ["Home service", "Comfort", "Relaxation"];
  return [categoryName, "Relaxation", "Wellness"];
}

export async function HomePageSections() {
  const [services, managedSections, managedGalleryAssets] = await Promise.all([
    getAllServices() as Promise<ServiceWithCategory[]>,
    getPublicSiteSections({ includeDisabled: true }),
    getPublicSiteAssets("gallery", { includeDisabled: true }),
  ]);
  const sectionMap = new Map(
    managedSections.map((section) => [section.section_key, section])
  );
  const enabledSection = (sectionKey: string) => {
    const section = sectionMap.get(sectionKey);
    return section?.is_enabled ? section : null;
  };
  const sectionIsVisible = (sectionKey: string) => {
    const section = sectionMap.get(sectionKey);
    return section ? section.is_enabled : true;
  };

  const heroSection = enabledSection("hero");
  const heroMetadata = metadataObject(heroSection?.metadata);
  const heroTitle = sectionText(
    heroSection,
    "title",
    "Restore Your Body. Quiet Your Mind."
  );
  const heroSubtitle = sectionText(
    heroSection,
    "subtitle",
    "Cradle Massage & Wellness Spa offers calming in-spa and home-service treatments in Bacolod for rest, recovery, and everyday renewal."
  );
  const heroCtaLabel = sectionText(heroSection, "cta_label", "Book Appointment");
  const heroCtaHref = sectionText(heroSection, "cta_href", "/book");
  const heroImage = sectionText(heroSection, "image_url", SPA_IMAGES.hero);
  const heroSecondaryImage = sectionText(
    heroSection,
    "secondary_image_url",
    SPA_IMAGES.heroPortrait
  );
  const heroSecondaryCtaLabel = metadataText(
    heroMetadata,
    "secondaryCtaLabel",
    "Plan Your Visit"
  );
  const heroSecondaryCtaHref = metadataText(
    heroMetadata,
    "secondaryCtaHref",
    "#plan-your-visit"
  );

  const aboutSection = enabledSection("about");
  const aboutTitle = sectionText(
    aboutSection,
    "title",
    "A calming wellness space for Bacolod guests."
  );
  const aboutEyebrow = sectionText(aboutSection, "subtitle", "Spa Philosophy");
  const aboutBody = sectionText(
    aboutSection,
    "body",
    "Cradle is designed for the moments when your body asks for quiet and your schedule needs something simple. Guests can visit the spa or request home service when comfort at home is the better setting."
  );
  const aboutImage = sectionText(aboutSection, "image_url", SPA_IMAGES.about);
  const aboutSecondaryImage = sectionText(
    aboutSection,
    "secondary_image_url",
    SPA_IMAGES.aboutSecondary
  );

  const servicesSection = enabledSection("signature_services");
  const servicesEyebrow = sectionText(
    servicesSection,
    "subtitle",
    "Signature Services"
  );
  const servicesTitle = sectionText(
    servicesSection,
    "title",
    "Treatment storytelling, pulled from the real service menu."
  );
  const servicesBody = sectionText(
    servicesSection,
    "body",
    "Browse a preview of published services, then continue into the live booking system to choose branch, setting, time, and therapist."
  );
  const quoteSection = enabledSection("quote_banner");
  const quoteTitle = sectionText(
    quoteSection,
    "title",
    "Give yourself permission to pause."
  );
  const quoteEyebrow = sectionText(quoteSection, "subtitle", "Pause Here");
  const quoteBody = sectionText(quoteSection, "body", "");
  const quoteCtaLabel = sectionText(quoteSection, "cta_label", "");
  const quoteCtaHref = sectionText(quoteSection, "cta_href", "/book");
  const quoteImage = sectionText(quoteSection, "image_url", SPA_IMAGES.ctaBanner);

  const beforeSection = enabledSection("before_you_book");
  const beforeMetadata = metadataObject(beforeSection?.metadata);
  const beforeTitle = sectionText(
    beforeSection,
    "title",
    "Plan your visit with clear expectations."
  );
  const beforeEyebrow = sectionText(beforeSection, "subtitle", "Before You Book");
  const beforeBody = sectionText(
    beforeSection,
    "body",
    "Booking is designed to be calm and transparent. Choose the setting first so the system can guide you toward the right service and schedule."
  );
  const beforeItems = metadataItems(beforeMetadata, planningNotes);
  const aboutParagraphs = aboutBody
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const displayServices = services.slice(0, 6).map((service, index) => {
    const category = firstCategory(service.service_categories)?.name ?? "Wellness";
    return {
      id: service.id,
      category,
      name: service.name,
      description: service.description ?? DEFAULT_DESCRIPTION,
      duration: `${service.duration_minutes} min`,
      price: `From ${formatCurrency(Number(service.price))}`,
      image: resolveServiceImage(service.name, index),
      tags: buildServiceTags(service.name, category),
    };
  });
  const galleryAssetItems = managedGalleryAssets
    .filter((asset) => asset.is_enabled)
    .map((asset) => ({
      id: asset.id,
      title: asset.title ?? "Gallery image",
      detail: "",
      image: asset.image_url,
      imageAlt: asset.alt_text ?? asset.title ?? "Cradle spa gallery image",
    }));
  const displayedGalleryItems =
    galleryAssetItems.length > 0 ? galleryAssetItems : galleryItems;

  return (
    <>
      {sectionIsVisible("hero") && (
      <section className="relative overflow-hidden bg-[#10261D] pt-28 pb-16 sm:pt-32 lg:pt-40 lg:pb-24">
        <div className="absolute inset-0">
          <CoverImage
            src={heroImage}
            alt="Cradle Massage and Wellness Spa treatment room"
            priority
            className="object-cover opacity-70"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[#10261D]/55" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,38,29,0.96)_0%,rgba(16,38,29,0.76)_48%,rgba(16,38,29,0.38)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-36 bg-[linear-gradient(0deg,#F7F3EB_0%,rgba(247,243,235,0)_100%)]" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[1.03fr_0.72fr] lg:px-12">
          <div className="max-w-3xl">
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#E8D5A3]">
              {businessInfo.brandName} · {businessInfo.location}
            </p>
            <h1
              className="text-4xl font-medium leading-[1.04] text-[#FCFAF5] sm:text-6xl lg:text-7xl"
              style={{ fontFamily: "var(--sp-font-display)" }}
            >
              {heroTitle}
            </h1>
            <p className="mt-6 max-w-2xl text-[15px] leading-7 text-[#F7F3EB]/78 sm:text-base">
              {heroSubtitle}
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href={heroCtaHref}
                className="inline-flex min-h-12 items-center justify-center rounded-[8px] bg-[#C8A96B] px-7 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#10261D] transition hover:bg-[#E8D5A3] focus-visible:ring-2 focus-visible:ring-[#E8D5A3] sm:w-auto"
              >
                {heroCtaLabel}
              </Link>
              <Link
                href={heroSecondaryCtaHref}
                className="inline-flex min-h-12 items-center justify-center rounded-[8px] border border-[#F7F3EB]/28 px-7 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#FCFAF5] transition hover:border-[#E8D5A3] hover:bg-white/10 sm:w-auto"
              >
                {heroSecondaryCtaLabel}
              </Link>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {heroProofPoints.map((point) => (
                <div
                  key={point.id}
                  className="rounded-[8px] border border-[#F7F3EB]/14 bg-[#10261D]/48 p-4 backdrop-blur-sm"
                >
                  <p className="text-[12px] font-semibold text-[#FCFAF5]">{point.label}</p>
                  <p className="mt-1 text-[12px] leading-5 text-[#F7F3EB]/62">{point.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="relative ml-auto max-w-sm">
              <div className="relative aspect-[3/4] overflow-hidden rounded-[8px] border border-[#E8D5A3]/24 shadow-2xl">
                <CoverImage
                  src={heroSecondaryImage}
                  alt="Warm wellness details inside Cradle spa"
                  sizes="360px"
                />
                <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(16,38,29,0.42),rgba(16,38,29,0)_58%)]" />
              </div>
              <div className="absolute -bottom-8 -left-10 w-64 rounded-[8px] border border-[#E8D5A3]/24 bg-[#FCFAF5] p-5 shadow-xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#B68A3C]">
                  Contact
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {publicPhones.map((phone) => (
                    <a
                      key={phone.href}
                      href={phone.href}
                      className="text-lg font-semibold text-[#163A2B] transition hover:text-[#B68A3C]"
                      style={{ fontFamily: "var(--sp-font-display)" }}
                    >
                      {phone.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {sectionIsVisible("about") && (
      <section id="philosophy" className="bg-[#F7F3EB] py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-12">
          <ScrollReveal>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#B68A3C]">
              {aboutEyebrow}
            </p>
            <h2
              className="text-3xl font-medium leading-tight text-[#163A2B] sm:text-4xl lg:text-5xl"
              style={{ fontFamily: "var(--sp-font-display)" }}
            >
              {aboutTitle}
            </h2>
            <div className="mt-6 space-y-4 text-[15px] leading-7 text-[#5F6F63]">
              {aboutParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </ScrollReveal>

          <ScrollReveal variant="scale">
            <div className="grid gap-3 sm:grid-cols-[1fr_0.72fr]">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[8px]">
                <CoverImage
                  src={aboutImage}
                  alt="Cradle spa treatment room"
                  sizes="(max-width: 768px) 100vw, 45vw"
                />
              </div>
              <div className="grid gap-3">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[8px]">
                  <CoverImage
                    src={aboutSecondaryImage}
                    alt="Quiet spa details for relaxation"
                    sizes="(max-width: 768px) 100vw, 25vw"
                  />
                </div>
                <div className="rounded-[8px] bg-[#163A2B] p-6 text-[#FCFAF5]">
                  <p
                    className="text-2xl italic leading-snug text-[#E8D5A3]"
                    style={{ fontFamily: "var(--sp-font-accent)" }}
                  >
                    Rest is not a reward. It is part of care.
                  </p>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
      )}

      <section className="bg-[#FCFAF5] py-14">
        <div className="mx-auto grid max-w-7xl gap-4 px-6 sm:grid-cols-2 lg:grid-cols-4 lg:px-12">
          {quickTrustPoints.map((point, index) => {
            const Icon = proofIcons[index % proofIcons.length]!;
            return (
              <ScrollReveal key={point.id} delay={index * 80}>
                <div className="h-full rounded-[8px] border border-[#EDE4D3] bg-white p-6 transition hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(22,58,43,0.08)]">
                  <Icon className="mb-5 h-5 w-5 text-[#B68A3C]" aria-hidden="true" />
                  <h3 className="text-[15px] font-semibold text-[#163A2B]">{point.label}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#6B7A6F]">{point.detail}</p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      <section id="experience" className="bg-[#10261D] py-20 text-[#FCFAF5] lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <ScrollReveal>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#E8D5A3]">
                The Cradle Experience
              </p>
              <h2
                className="text-3xl font-medium leading-tight sm:text-4xl"
                style={{ fontFamily: "var(--sp-font-display)" }}
              >
                A guided path from intention to appointment.
              </h2>
            </ScrollReveal>
            <p className="max-w-2xl text-[15px] leading-7 text-[#F7F3EB]/68">
              The public site now mirrors how guests actually book: setting first, then
              treatment, schedule, therapist, and confirmation details.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-4">
            {bookingJourneySteps.map((step, index) => {
              const Icon = journeyIcons[index % journeyIcons.length]!;
              return (
                <ScrollReveal key={step.id} delay={index * 90}>
                  <div className="h-full rounded-[8px] border border-[#F7F3EB]/12 bg-white/[0.04] p-6">
                    <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#C8A96B] text-[#10261D]">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E8D5A3]">
                      0{index + 1}
                    </p>
                    <h3 className="mt-2 text-base font-semibold">{step.title}</h3>
                    <p className="mt-3 text-[13px] leading-6 text-[#F7F3EB]/62">{step.detail}</p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#F7F3EB] py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="mb-12 max-w-2xl">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#B68A3C]">
              Choose Your Setting
            </p>
            <h2
              className="text-3xl font-medium leading-tight text-[#163A2B] sm:text-4xl"
              style={{ fontFamily: "var(--sp-font-display)" }}
            >
              Come to the spa, or let the spa come to you.
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {settingCards.map((card, index) => (
              <ScrollReveal key={card.id} delay={index * 120} variant="scale">
                <article className="grid h-full overflow-hidden rounded-[8px] bg-white shadow-[0_10px_34px_rgba(22,58,43,0.08)] md:grid-cols-[0.92fr_1.08fr]">
                  <div className="relative min-h-72">
                    <Image
                      src={card.image}
                      alt={card.imageAlt}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 36vw"
                    />
                  </div>
                  <div className="flex flex-col p-7">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#B68A3C]">
                      {card.eyebrow}
                    </p>
                    <h3
                      className="mt-3 text-2xl font-medium text-[#163A2B]"
                      style={{ fontFamily: "var(--sp-font-display)" }}
                    >
                      {card.title}
                    </h3>
                    <p className="mt-4 text-[14px] leading-7 text-[#6B7A6F]">{card.detail}</p>
                    <ul className="mt-5 space-y-2">
                      {card.points.map((point) => (
                        <li key={point} className="flex gap-2 text-[13px] text-[#5F6F63]">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#B68A3C]" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/book"
                      className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[#163A2B] px-5 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#FCFAF5] transition hover:bg-[#1E4D3A]"
                    >
                      Book Appointment
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {sectionIsVisible("signature_services") && (
      <section id="services" className="bg-[#FCFAF5] py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#B68A3C]">
              {servicesEyebrow}
            </p>
            <h2
              className="text-3xl font-medium leading-tight text-[#163A2B] sm:text-4xl lg:text-5xl"
              style={{ fontFamily: "var(--sp-font-display)" }}
            >
              {servicesTitle}
            </h2>
            <p className="mt-5 text-[15px] leading-7 text-[#6B7A6F]">
              {servicesBody}
            </p>
          </div>

          {displayServices.length === 0 ? (
            <div className="rounded-[8px] border border-[#EDE4D3] bg-[#F7F3EB] px-8 py-12 text-center">
              <p className="text-[15px] font-medium text-[#163A2B]">No services published yet.</p>
              <p className="mt-2 text-[13px] text-[#6B7A6F]">
                Add services in the dashboard to show them here.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {displayServices.map((service, index) => (
                <ScrollReveal key={service.id} delay={index * 70} variant="scale">
                  <article className="group flex h-full flex-col overflow-hidden rounded-[8px] border border-[#EDE4D3] bg-white shadow-[0_6px_22px_rgba(22,58,43,0.05)] transition hover:-translate-y-1 hover:shadow-[0_16px_34px_rgba(22,58,43,0.1)]">
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <Image
                        src={service.image}
                        alt={`${service.name} treatment preview`}
                        fill
                        className="object-cover transition duration-500 group-hover:scale-[1.03]"
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      />
                      <div className="absolute left-4 top-4 rounded-[8px] bg-[#10261D]/82 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E8D5A3] backdrop-blur">
                        {service.category}
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <div className="mb-3 flex flex-wrap items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#B68A3C]">
                        <span>{service.duration}</span>
                        <span className="h-1 w-1 rounded-full bg-[#EDE4D3]" />
                        <span>{service.price}</span>
                      </div>
                      <h3
                        className="text-xl font-medium text-[#163A2B]"
                        style={{ fontFamily: "var(--sp-font-display)" }}
                      >
                        {service.name}
                      </h3>
                      <p className="mt-3 flex-1 text-[14px] leading-7 text-[#6B7A6F]">
                        {service.description}
                      </p>
                      <div className="mt-5 flex flex-wrap gap-2">
                        {service.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-[#EDE4D3] bg-[#F7F3EB] px-3 py-1 text-[11px] font-medium text-[#5F6F63]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <Link
                        href="/book"
                        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[8px] border border-[#163A2B] px-5 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#163A2B] transition hover:bg-[#163A2B] hover:text-[#FCFAF5]"
                      >
                        Book Now
                      </Link>
                    </div>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          )}
        </div>
      </section>
      )}

      {sectionIsVisible("quote_banner") && (
      <section className="relative overflow-hidden py-24 text-center lg:py-32">
        <CoverImage
          src={quoteImage}
          alt="Calming Cradle spa atmosphere"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[#10261D]/78" />
        <div className="relative mx-auto max-w-4xl px-6">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#E8D5A3]">
            {quoteEyebrow}
          </p>
          <h2
            className="text-4xl font-medium leading-tight text-[#FCFAF5] sm:text-5xl"
            style={{ fontFamily: "var(--sp-font-display)" }}
          >
            {quoteTitle}
          </h2>
          {quoteBody ? (
            <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-7 text-[#F7F3EB]/72">
              {quoteBody}
            </p>
          ) : null}
          {quoteCtaLabel ? (
            <Link
              href={quoteCtaHref}
              className="mt-8 inline-flex min-h-12 items-center justify-center rounded-[8px] bg-[#C8A96B] px-7 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#10261D] transition hover:bg-[#E8D5A3]"
            >
              {quoteCtaLabel}
            </Link>
          ) : null}
        </div>
      </section>
      )}

      {sectionIsVisible("gallery") && (
      <section className="bg-[#F7F3EB] py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="mb-12 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#B68A3C]">
                Gallery
              </p>
              <h2
                className="text-3xl font-medium leading-tight text-[#163A2B] sm:text-4xl"
                style={{ fontFamily: "var(--sp-font-display)" }}
              >
                Replaceable visuals for the Cradle experience.
              </h2>
            </div>
            <p className="max-w-md text-[14px] leading-7 text-[#6B7A6F]">
              These use local spa assets only and can be swapped with real branch photography later.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayedGalleryItems.map((item, index) => (
              <ScrollReveal key={item.id} delay={index * 60}>
                <figure className="group overflow-hidden rounded-[8px] bg-[#10261D]">
                  <div className="relative aspect-[4/3]">
                    <CoverImage
                      src={item.image}
                      alt={item.imageAlt}
                      className="object-cover transition duration-500 group-hover:scale-[1.03]"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(16,38,29,0.7),rgba(16,38,29,0)_62%)]" />
                    <figcaption className="absolute inset-x-0 bottom-0 p-5">
                      <p className="font-semibold text-[#FCFAF5]">{item.title}</p>
                      <p className="mt-1 text-[12px] leading-5 text-[#F7F3EB]/68">{item.detail}</p>
                    </figcaption>
                  </div>
                </figure>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>
      )}

      <section className="bg-[#FCFAF5] py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#B68A3C]">
                Why Guests Choose Cradle
              </p>
              <h2
                className="text-3xl font-medium leading-tight text-[#163A2B] sm:text-4xl"
                style={{ fontFamily: "var(--sp-font-display)" }}
              >
                Premium care with practical booking support.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {whyGuestsChooseCradle.map((item, index) => {
                const Icon = whyIcons[index % whyIcons.length]!;
                return (
                  <ScrollReveal key={item.id} delay={index * 80}>
                    <div className="h-full rounded-[8px] border border-[#EDE4D3] bg-[#F7F3EB] p-6">
                      <Icon className="mb-5 h-5 w-5 text-[#B68A3C]" aria-hidden="true" />
                      <h3 className="font-semibold text-[#163A2B]">{item.label}</h3>
                      <p className="mt-2 text-[13px] leading-6 text-[#6B7A6F]">{item.detail}</p>
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#10261D] py-20 text-[#FCFAF5] lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#E8D5A3]">
              Wellness Team
            </p>
            <h2
              className="text-3xl font-medium leading-tight sm:text-4xl"
              style={{ fontFamily: "var(--sp-font-display)" }}
            >
              Role-based care, without invented staff profiles.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {teamRoles.map((role, index) => (
              <ScrollReveal key={role.id} delay={index * 80}>
                <div className="h-full rounded-[8px] border border-[#F7F3EB]/12 bg-white/[0.04] p-6">
                  <Users className="mb-5 h-5 w-5 text-[#E8D5A3]" aria-hidden="true" />
                  <h3 className="font-semibold">{role.title}</h3>
                  <p className="mt-3 text-[13px] leading-6 text-[#F7F3EB]/64">{role.detail}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F7F3EB] py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-12">
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#B68A3C]">
              Reasons Guests Visit
            </p>
            <h2
              className="text-3xl font-medium leading-tight text-[#163A2B] sm:text-4xl"
              style={{ fontFamily: "var(--sp-font-display)" }}
            >
              Real-life reasons to make space for a reset.
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {guestReasons.map((reason) => (
              <div
                key={reason}
                className="rounded-[8px] border border-[#EDE4D3] bg-white px-5 py-4 text-[14px] font-medium text-[#163A2B]"
              >
                {reason}
              </div>
            ))}
          </div>
        </div>
      </section>

      {sectionIsVisible("before_you_book") && (
      <section id="plan-your-visit" className="bg-[#FCFAF5] py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-12">
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#B68A3C]">
              {beforeEyebrow}
            </p>
            <h2
              className="text-3xl font-medium leading-tight text-[#163A2B] sm:text-4xl"
              style={{ fontFamily: "var(--sp-font-display)" }}
            >
              {beforeTitle}
            </h2>
            <p className="mt-5 text-[15px] leading-7 text-[#6B7A6F]">
              {beforeBody}
            </p>
          </div>
          <div className="rounded-[8px] border border-[#EDE4D3] bg-[#F7F3EB] p-6 sm:p-8">
            <ul className="space-y-4">
              {beforeItems.map((note) => (
                <li key={note} className="flex gap-3 text-[14px] leading-6 text-[#5F6F63]">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#B68A3C]" aria-hidden="true" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      )}

      <section id="contact" className="bg-[#10261D] py-20 text-[#FCFAF5] lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#E8D5A3]">
                Contact + Branches
              </p>
              <h2
                className="text-3xl font-medium leading-tight sm:text-4xl"
                style={{ fontFamily: "var(--sp-font-display)" }}
              >
                Reach the Cradle team in Bacolod.
              </h2>
              <p className="mt-5 text-[15px] leading-7 text-[#F7F3EB]/66">
                Call or message for appointment questions, home-service details, or manual
                payment confirmation follow-up.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/book"
                  className="inline-flex min-h-12 items-center justify-center rounded-[8px] bg-[#C8A96B] px-6 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#10261D] transition hover:bg-[#E8D5A3]"
                >
                  Book Appointment
                </Link>
                <a
                  href={publicPhones[0]?.href ?? "tel:+639177077070"}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] border border-[#F7F3EB]/24 px-6 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#FCFAF5] transition hover:border-[#E8D5A3] hover:bg-white/10"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Call / Message
                </a>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[8px] border border-[#F7F3EB]/12 bg-white/[0.04] p-6">
                <Clock className="mb-5 h-5 w-5 text-[#E8D5A3]" aria-hidden="true" />
                <h3 className="font-semibold">Availability</h3>
                <p className="mt-2 text-[13px] leading-6 text-[#F7F3EB]/64">{businessInfo.hours}</p>
              </div>
              <div className="rounded-[8px] border border-[#F7F3EB]/12 bg-white/[0.04] p-6">
                <Phone className="mb-5 h-5 w-5 text-[#E8D5A3]" aria-hidden="true" />
                <h3 className="font-semibold">Phone</h3>
                <div className="mt-3 flex flex-col gap-2">
                  {publicPhones.map((phone) => (
                    <a
                      key={phone.href}
                      href={phone.href}
                      className="text-[14px] text-[#F7F3EB]/76 transition hover:text-[#E8D5A3]"
                    >
                      {phone.label}
                    </a>
                  ))}
                </div>
              </div>
              {publicBranches.map((branch) => (
                <div
                  key={branch.id}
                  className="rounded-[8px] border border-[#F7F3EB]/12 bg-white/[0.04] p-6"
                >
                  <MapPin className="mb-5 h-5 w-5 text-[#E8D5A3]" aria-hidden="true" />
                  <h3 className="font-semibold">{branch.name}</h3>
                  <p className="mt-2 text-[13px] text-[#F7F3EB]/64">{branch.area}</p>
                  {branch.mapHref ? (
                    <a
                      href={branch.mapHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#E8D5A3] transition hover:text-[#FCFAF5]"
                    >
                      Google Maps
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#F7F3EB] py-20 text-center lg:py-28">
        <div className="mx-auto max-w-3xl px-6">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#B68A3C]">
            Your quiet reset starts here
          </p>
          <h2
            className="text-3xl font-medium leading-tight text-[#163A2B] sm:text-5xl"
            style={{ fontFamily: "var(--sp-font-display)" }}
          >
            Choose a time, choose your setting, and let Cradle take care of the rest.
          </h2>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/book"
              className="inline-flex min-h-12 items-center justify-center rounded-[8px] bg-[#163A2B] px-7 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#FCFAF5] transition hover:bg-[#1E4D3A]"
            >
              Book Appointment
            </Link>
            <a
              href={publicPhones[0]?.href ?? "tel:+639177077070"}
              className="inline-flex min-h-12 items-center justify-center rounded-[8px] border border-[#163A2B] px-7 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#163A2B] transition hover:bg-[#163A2B] hover:text-[#FCFAF5]"
            >
              Call / Message
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
