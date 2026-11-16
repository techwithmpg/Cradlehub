import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Calendar,
  Clock,
  Flower2,
  Home,
  Leaf,
  MapPin,
  Phone,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import {
  PUBLIC_CATALOG_CATEGORY_DETAILS,
  getPublicHomeCategoryImage,
} from "@/lib/public/service-catalog-config";
import {
  resolvePublicBranchImage,
  type PublicBranch,
} from "@/lib/public/public-site-data";
import type { PublicCatalogService } from "@/lib/queries/services";
import type { NormalizedPublicSiteSections } from "@/lib/public/normalized-sections";
import { resolvePublicSiteSections } from "@/lib/public/normalized-sections";
import { SPA_IMAGES } from "@/constants/spa-images";
import { BOUTIQUE_PRODUCTS, type BoutiqueProduct } from "@/lib/public/boutique-catalog";
import {
  EG_SURFACE,
  EmeraldAtmosphere,
  EmeraldSectionEyebrow,
} from "@/components/public/emerald-glass";
import { EmeraldServiceRail } from "@/components/public/emerald-service-rail";
import { GuestExperiencesSection } from "@/components/public/guest-experiences-section";
import { ScrollReveal } from "@/components/public/scroll-reveal";

export type HomePageSectionsProps = {
  branches: PublicBranch[];
  services: PublicCatalogService[];
  sections?: NormalizedPublicSiteSections;
  boutiqueProducts?: BoutiqueProduct[];
};

export type HomePageSectionsRendererProps = {
  sections: NormalizedPublicSiteSections;
  branches: PublicBranch[];
  services: PublicCatalogService[];
  boutiqueProducts?: BoutiqueProduct[];
};

const SERVICE_EXPERIENCE_CARDS = [
  {
    key: "massage",
    categoryName: "Massage Services" as const,
    title: "Signature Massage",
    subtitle: "Relax and release tension",
    href: "/services?category=Massage%20Services",
    icon: Flower2,
  },
  {
    key: "skincare",
    categoryName: "Skin Care Services" as const,
    title: "Spa & Body",
    subtitle: "Rejuvenate and restore",
    href: "/services?category=Skin%20Care%20Services",
    icon: Sparkles,
  },
  {
    key: "salon",
    categoryName: "Salon Services" as const,
    title: "Salon & Beauty",
    subtitle: "Hair, nails, and beauty care",
    href: "/services?category=Salon%20Services",
    icon: Scissors,
  },
  {
    key: "home",
    categoryName: null,
    title: "Home Service",
    subtitle: "Bring the spa to your home",
    href: "/home-service-massage-bacolod",
    icon: Home,
  },
];

const TRUST_HIGHLIGHTS = [
  {
    icon: Flower2,
    title: "Expert Care",
    description: "Trained and welcoming wellness professionals",
  },
  {
    icon: ShieldCheck,
    title: "Safe & Hygienic",
    description: "Clean suites, fresh linens, thoughtful care",
  },
  {
    icon: Leaf,
    title: "Holistic Wellness",
    description: "Massage, spa, salon & skin care in one sanctuary",
  },
  {
    icon: MapPin,
    title: "Multiple Branches",
    description: "SM City Bacolod, Main Spa & Home Service",
  },
];

function isSafeDisplayService(service: PublicCatalogService) {
  return Boolean(service.isPublicBookable && !service.isCsrOnly && !service.isVip);
}

export function HomePageSectionsRenderer({
  sections,
  branches,
  services,
  boutiqueProducts = BOUTIQUE_PRODUCTS,
}: HomePageSectionsRendererProps) {
  const { hero, about, quoteBanner, signatureServices, siteImages } = sections;

  const safeServices = services.filter(isSafeDisplayService);
  const signaturePreviewServices = safeServices.slice(0, 4);
  const branchCount = branches.length > 0 ? branches.length : 2;
  const primaryBranch = branches[0];
  const primaryHours = primaryBranch?.opening_hours || primaryBranch?.hours || "10:00 AM – 10:30 PM";
  const primaryPhone = primaryBranch?.phone || "0917 300 9173";

  const secondaryHeroHref =
    hero.secondaryCtaHref === "#plan-your-visit"
      ? "/services"
      : hero.secondaryCtaHref || "/services";
  const secondaryHeroLabel =
    hero.secondaryCtaLabel === "Plan Your Visit"
      ? "Explore Services"
      : hero.secondaryCtaLabel || "Explore Services";

  return (
    <div className={EG_SURFACE.pageGradient}>
      {/* 1. Cinematic Full-Width Spa Hero + Overlapping Moving Service Rail */}
      {hero.isEnabled && (
        <section className="relative flex min-h-[660px] flex-col justify-between overflow-hidden bg-[#05140E] lg:min-h-[min(92svh,860px)]">
          <Image
            src={hero.imageUrl || SPA_IMAGES.hero}
            alt={hero.imageAltText || "Cradle Wellness Living sanctuary suite"}
            fill
            preload={true}
            fetchPriority="high"
            sizes="100vw"
            className="eg-hero-photo object-cover"
            style={{ objectPosition: hero.imagePosition || "55% 42%" }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(100deg,rgba(5,20,14,0.95)_0%,rgba(6,24,17,0.84)_38%,rgba(7,26,18,0.44)_68%,rgba(7,26,18,0.28)_100%)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(to_top,#071A12_0%,rgba(7,26,18,0.68)_32%,rgba(7,26,18,0)_64%)]"
          />
          <EmeraldAtmosphere subtle />

          <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-12 pb-6 sm:px-8 lg:pt-16">
            <div className="max-w-2xl">
              <EmeraldSectionEyebrow>
                {hero.brandEyebrow || "Cradle Wellness Living · Bacolod"}
              </EmeraldSectionEyebrow>

              <h1 className={`${EG_SURFACE.heading} mt-4 whitespace-pre-line text-4xl leading-[1.06] sm:text-5xl lg:text-[60px]`}>
                {hero.title || "Restore Your Body.\nQuiet Your Mind."}
              </h1>

              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#D8E2DA] [text-wrap:pretty] lg:text-base">
                {hero.subtitle}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3.5">
                <Link
                  href={hero.ctaHref || "/book"}
                  className={`${EG_SURFACE.goldButton} min-h-12 px-6 py-3 text-sm`}
                >
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  <span>{hero.ctaLabel || "Book an Appointment"}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href={secondaryHeroHref}
                  className={`${EG_SURFACE.ghostButton} min-h-12 px-6 py-3 text-sm`}
                >
                  <span>{secondaryHeroLabel}</span>
                  <ArrowRight className="h-4 w-4 text-[#E5C98B]" aria-hidden="true" />
                </Link>
              </div>

              {/* Compact Business Information Strip */}
              <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-[#D4B57A]/25 pt-5 sm:grid-cols-4">
                <div>
                  <dt className="text-[10px] font-semibold tracking-[0.16em] text-[#E5C98B] uppercase">
                    In-Spa · Daily
                  </dt>
                  <dd className="mt-1 text-xs font-medium text-[#FAF5E9] tabular-nums sm:text-sm">
                    {primaryHours}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold tracking-[0.16em] text-[#E5C98B] uppercase">
                    Home Service
                  </dt>
                  <dd className="mt-1 text-xs font-medium text-[#FAF5E9] tabular-nums sm:text-sm">
                    2:30 PM – 10:00 PM
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold tracking-[0.16em] text-[#E5C98B] uppercase">
                    Branches
                  </dt>
                  <dd className="mt-1 text-xs font-medium text-[#FAF5E9] tabular-nums sm:text-sm">
                    {branchCount} in Bacolod
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold tracking-[0.16em] text-[#E5C98B] uppercase">
                    Front Desk
                  </dt>
                  <dd className="mt-1 text-xs font-semibold text-[#E8D5A3] tabular-nums sm:text-sm">
                    <a
                      href={`tel:${primaryPhone.replace(/[^+\d]/g, "")}`}
                      className="hover:underline"
                    >
                      {primaryPhone}
                    </a>
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="relative z-10 pb-6">
            <EmeraldServiceRail services={safeServices} />
          </div>
        </section>
      )}

      {/* 2. Four-Card Emerald Glass Trust Highlights */}
      <section className="relative mx-auto max-w-7xl px-6 pt-10 pb-6 sm:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_HIGHLIGHTS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <ScrollReveal key={item.title} delay={idx * 60}>
                <div className={`${EG_SURFACE.glassCardLift} flex h-full items-start gap-3.5 p-4 sm:p-5`}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D4B57A]/30 bg-[#0D3223]/90 text-[#E5C98B]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-[#FAF5E9]">{item.title}</h2>
                    <p className="mt-0.5 text-xs leading-relaxed text-[#CBD6CD]">
                      {item.description}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      {/* 3. Our Services Visual Category Showcase */}
      {signatureServices.isVisible && (
        <section className="mx-auto max-w-7xl px-6 py-14 sm:px-8">
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            <ScrollReveal className="lg:col-span-4">
              <EmeraldSectionEyebrow>
                {signatureServices.subtitle || "Our Services"}
              </EmeraldSectionEyebrow>
              <h2 className={`${EG_SURFACE.heading} mt-3 text-3xl lg:text-[36px]`}>
                Wellness, Beauty &amp; Self-Care
              </h2>
              <p className={`${EG_SURFACE.body} mt-3 text-sm`}>{signatureServices.body}</p>
              <Link
                href="/services"
                className={`${EG_SURFACE.goldButton} mt-6 px-5 py-2.5 text-xs tracking-wide`}
              >
                <span>View All Services</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </ScrollReveal>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-4">
              {SERVICE_EXPERIENCE_CARDS.map((card, idx) => {
                const Icon = card.icon;
                const categoryImage = card.categoryName
                  ? signatureServices.categoryImages[card.categoryName] ||
                    getPublicHomeCategoryImage(card.categoryName)
                  : siteImages?.home_service_card || SPA_IMAGES.aromatherapy;
                return (
                  <ScrollReveal key={card.key} delay={idx * 60}>
                    <Link
                      href={card.href}
                      className={`${EG_SURFACE.glassCardLift} group flex h-full flex-col overflow-hidden`}
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#0A251B]">
                        <Image
                          src={categoryImage}
                          alt={card.title}
                          fill
                          loading="lazy"
                          sizes="(min-width: 1024px) 18vw, (min-width: 640px) 42vw, 90vw"
                          className="object-cover transition duration-500 group-hover:scale-105"
                        />
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 bg-gradient-to-t from-[#071A12]/80 via-transparent to-transparent"
                        />
                      </div>
                      <div className="flex flex-1 items-center justify-between gap-2 px-3.5 py-3.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#D4B57A]/30 bg-[#0D3223] text-[#E5C98B]">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <h3 className="truncate text-[13px] font-semibold text-[#FAF5E9]">
                              {card.title}
                            </h3>
                            <p className="truncate text-[11px] text-[#CBD6CD]">{card.subtitle}</p>
                          </div>
                        </div>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#D4B57A]/30 bg-[#0D3223] text-[#E5C98B] transition group-hover:bg-[#D4B57A] group-hover:text-[#071A12]">
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                      </div>
                    </Link>
                  </ScrollReveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 4. Choose Your Wellness Experience Split Glass Card */}
      <section className="mx-auto max-w-7xl px-6 pb-14 sm:px-8">
        <ScrollReveal>
          <div className={`${EG_SURFACE.glassCard} grid grid-cols-1 overflow-hidden rounded-3xl lg:grid-cols-12`}>
            <div className="relative flex min-h-[200px] items-center overflow-hidden bg-[#061810] px-8 py-8 text-[#FAF5E9] lg:col-span-4">
              <Image
                src={siteImages?.experience_banner || SPA_IMAGES.ctaBanner}
                alt="Fresh botanical spa atmosphere"
                fill
                loading="lazy"
                sizes="(min-width: 1024px) 33vw, 100vw"
                className="object-cover opacity-35"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-r from-[#05140E]/90 via-[#05140E]/60 to-transparent"
              />
              <div className="relative z-10">
                <p className="text-[10px] font-semibold tracking-[0.22em] text-[#E5C98B] uppercase">
                  How We Serve You
                </p>
                <h2 className={`${EG_SURFACE.heading} mt-2 text-2xl lg:text-[28px]`}>
                  Choose your wellness experience
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 divide-y divide-[#D4B57A]/15 md:grid-cols-2 md:divide-x md:divide-y-0 lg:col-span-8">
              <div className="flex items-start gap-4 p-6 lg:p-8">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#D4B57A]/30 bg-[#0D3223] text-[#E5C98B]">
                  <Flower2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-[#FAF5E9]">In-Spa Experience</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#CBD6CD]">
                    Enjoy the full Cradle Wellness Living sanctuary at our SM City Bacolod or
                    Lacson Street branches.
                  </p>
                  <Link
                    href="/book?visitType=in_spa"
                    className={`${EG_SURFACE.ghostButton} mt-4 px-4 py-2 text-xs`}
                  >
                    <span>Book at a Branch</span>
                    <ArrowRight className="h-3.5 w-3.5 text-[#E5C98B]" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              <div className="flex items-start gap-4 p-6 lg:p-8">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#D4B57A]/30 bg-[#0D3223] text-[#E5C98B]">
                  <Home className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-[#FAF5E9]">Home Service</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#CBD6CD]">
                    The same therapist-grade relaxation and restorative oils brought to your home or
                    hotel in Bacolod.
                  </p>
                  <Link
                    href="/book?visitType=home_service"
                    className={`${EG_SURFACE.ghostButton} mt-4 px-4 py-2 text-xs`}
                  >
                    <span>Book Home Service</span>
                    <ArrowRight className="h-3.5 w-3.5 text-[#E5C98B]" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* 5. Popular Bookable Treatments (Live Public Catalog) */}
      {signaturePreviewServices.length > 0 && (
        <section className="border-y border-[#D4B57A]/15 bg-[#061810]/65 py-14">
          <div className="mx-auto max-w-7xl px-6 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <EmeraldSectionEyebrow>Curated Treatments</EmeraldSectionEyebrow>
                <h2 className={`${EG_SURFACE.heading} mt-2 text-3xl`}>Popular Treatments</h2>
              </div>
              <Link
                href="/services"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E8D5A3] hover:underline"
              >
                <span>Browse Full Menu ({safeServices.length})</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {signaturePreviewServices.map((service, idx) => (
                <ScrollReveal key={service.id} delay={idx * 60}>
                  <div className={`${EG_SURFACE.glassCardLift} flex h-full flex-col overflow-hidden`}>
                    <div className="relative aspect-[16/10] w-full bg-[#0A251B]">
                      <Image
                        src={service.imageUrl}
                        alt={service.imageAlt || service.name}
                        fill
                        loading="lazy"
                        sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 90vw"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <p className="text-[10px] font-semibold tracking-wider text-[#E5C98B] uppercase">
                        {PUBLIC_CATALOG_CATEGORY_DETAILS[
                          service.categoryName as keyof typeof PUBLIC_CATALOG_CATEGORY_DETAILS
                        ]?.shortName || service.categoryName}
                      </p>
                      <h3 className="mt-1 font-serif text-base font-semibold text-[#FAF5E9] [font-family:var(--sp-font-display)]">
                        {service.name}
                      </h3>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#CBD6CD]">
                        {service.description}
                      </p>
                      <div className="mt-auto pt-4">
                        <div className="flex items-center justify-between border-t border-[#D4B57A]/15 pt-3 text-xs">
                          <span className="inline-flex items-center gap-1 text-[#CBD6CD]">
                            <Clock className="h-3.5 w-3.5 text-[#E5C98B]" aria-hidden="true" />
                            <span>{service.durationText}</span>
                          </span>
                          <span className="font-bold text-[#E8D5A3] tabular-nums">
                            {service.priceLabel}
                          </span>
                        </div>
                        <Link
                          href={`/book?serviceId=${encodeURIComponent(service.id)}`}
                          className={`${EG_SURFACE.goldButton} mt-3 flex w-full px-4 py-2 text-xs`}
                        >
                          <span>Book Now</span>
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 6. Our Branches (Main Spa & SM Branch) */}
      <section className="mx-auto max-w-7xl px-6 py-14 sm:px-8">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <EmeraldSectionEyebrow>Our Branches</EmeraldSectionEyebrow>
            <h2 className={`${EG_SURFACE.heading} mt-3 text-3xl`}>Visit Our Spa Branches</h2>
            <p className={`${EG_SURFACE.body} mt-3 text-sm`}>
              Experience Cradle Wellness Living across our verified Bacolod sanctuaries.
            </p>
            <Link href="/branches" className={`${EG_SURFACE.ghostButton} mt-5 px-5 py-2.5 text-xs`}>
              <span>View All Locations</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#E5C98B]" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:col-span-8">
            {branches.map((branch, idx) => (
              <ScrollReveal key={branch.id} delay={idx * 70}>
                <div className={`${EG_SURFACE.glassCardLift} flex h-full flex-col overflow-hidden sm:flex-row`}>
                  <div className="relative aspect-[4/3] w-full shrink-0 bg-[#0A251B] sm:aspect-auto sm:w-44">
                    <Image
                      src={resolvePublicBranchImage(
                        branch,
                        idx === 0 ? SPA_IMAGES.branchMain : SPA_IMAGES.branchSm
                      )}
                      alt={branch.name}
                      fill
                      loading="lazy"
                      sizes="(min-width: 768px) 200px, 100vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <div className="flex items-start gap-2">
                        <MapPin
                          className="mt-0.5 h-4 w-4 shrink-0 text-[#E5C98B]"
                          aria-hidden="true"
                        />
                        <div>
                          <h3 className="text-sm font-semibold text-[#FAF5E9]">{branch.name}</h3>
                          <p className="mt-0.5 text-xs leading-relaxed text-[#CBD6CD]">
                            {branch.address}
                          </p>
                        </div>
                      </div>
                      {branch.phone && (
                        <p className="mt-2 flex items-center gap-1.5 pl-6 text-xs text-[#E8D5A3]">
                          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{branch.phone}</span>
                        </p>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 pl-6">
                      <Link
                        href="/branches"
                        className={`${EG_SURFACE.ghostButton} px-3.5 py-1.5 text-xs`}
                      >
                        <span>View Details</span>
                        <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </Link>
                      <Link
                        href={`/book?branchId=${encodeURIComponent(branch.id)}`}
                        className={`${EG_SURFACE.goldButton} px-3.5 py-1.5 text-xs`}
                      >
                        <span>Book Branch</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Sanctuary Story & Cradle Boutique Preview */}
      <section className="border-t border-[#D4B57A]/15 bg-[#061810]/55 py-14">
        <div className="mx-auto max-w-7xl space-y-14 px-6 sm:px-8">
          {about.isEnabled && (
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
              <ScrollReveal variant="scale" className="lg:col-span-5">
                <div className="relative aspect-[16/10] overflow-hidden rounded-3xl border border-[#D4B57A]/25 bg-[#0A251B] shadow-lg">
                  <Image
                    src={about.imageUrl || SPA_IMAGES.about}
                    alt={about.title}
                    fill
                    loading="lazy"
                    sizes="(min-width: 1024px) 40vw, 100vw"
                    className="object-cover"
                  />
                </div>
              </ScrollReveal>
              <ScrollReveal className="lg:col-span-7">
                <EmeraldSectionEyebrow>{about.subtitle || "Spa Philosophy"}</EmeraldSectionEyebrow>
                <h2 className={`${EG_SURFACE.heading} mt-3 text-3xl`}>{about.title}</h2>
                <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#CBD6CD]">
                  {about.paragraphs.map((paragraph: string, i: number) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/about" className={`${EG_SURFACE.goldButton} px-5 py-2.5 text-xs`}>
                    <span>Read Our Story</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                  <Link href="/products" className={`${EG_SURFACE.ghostButton} px-5 py-2.5 text-xs`}>
                    <ShoppingBag className="h-3.5 w-3.5 text-[#E5C98B]" aria-hidden="true" />
                    <span>Explore Cradle Boutique</span>
                  </Link>
                </div>
              </ScrollReveal>
            </div>
          )}

          <div className={`${EG_SURFACE.glassCard} rounded-3xl p-6 lg:p-8`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <EmeraldSectionEyebrow>Cradle Boutique</EmeraldSectionEyebrow>
                <h2 className={`${EG_SURFACE.heading} mt-2 text-2xl`}>Wellness at Home</h2>
              </div>
              <Link href="/products" className={`${EG_SURFACE.goldButton} px-4 py-2 text-xs`}>
                <span>Shop Boutique</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {boutiqueProducts.slice(0, 4).map((item) => (
                <Link
                  key={item.id}
                  href={`/products?category=${item.category}`}
                  className={`${EG_SURFACE.glassCardLift} group overflow-hidden p-3`}
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#0A251B]">
                    <Image
                      src={item.image}
                      alt={item.imageAlt}
                      fill
                      loading="lazy"
                      sizes="(min-width: 1024px) 20vw, 45vw"
                      className="object-cover transition duration-300 group-hover:scale-105"
                    />
                  </div>
                  <p className="mt-2.5 text-sm font-semibold text-[#FAF5E9]">{item.name}</p>
                  <p className="truncate text-[11px] text-[#CBD6CD]">{item.subtitle}</p>
                  <p className="mt-1.5 text-xs font-bold text-[#E8D5A3] tabular-nums">
                    {item.priceLabel}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 8. Kind Words From Our Guests (Strict Truthful Source Policy) */}
      <GuestExperiencesSection reviews={[]} />

      {/* 9. Final Booking CTA */}
      {quoteBanner.isEnabled && (
        <section className="relative overflow-hidden border-t border-[#D4B57A]/20 bg-[#05140E] text-[#FAF5E9]">
          <Image
            src={quoteBanner.imageUrl || SPA_IMAGES.ctaBanner}
            alt="Calm candlelit spa sanctuary"
            fill
            loading="lazy"
            sizes="100vw"
            className="object-cover opacity-30"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-[#05140E]/80 via-[#05140E]/65 to-[#05140E]"
          />
          <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 py-16 text-center sm:px-8 lg:py-20">
            <EmeraldSectionEyebrow centered>
              {quoteBanner.subtitle || "Ready to Relax?"}
            </EmeraldSectionEyebrow>
            <h2 className={`${EG_SURFACE.heading} mt-3 max-w-2xl text-3xl lg:text-4xl`}>
              {quoteBanner.title}
            </h2>
            {quoteBanner.body && (
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#CBD6CD]">
                {quoteBanner.body}
              </p>
            )}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={quoteBanner.ctaHref || "/book"}
                className={`${EG_SURFACE.goldButton} px-7 py-3 text-sm`}
              >
                <Calendar className="h-4 w-4" aria-hidden="true" />
                <span>{quoteBanner.ctaLabel || "Book an Appointment"}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export function HomePageSections({
  branches,
  services,
  sections,
  boutiqueProducts,
}: HomePageSectionsProps) {
  const resolvedSections = sections ?? resolvePublicSiteSections([]);
  return (
    <HomePageSectionsRenderer
      sections={resolvedSections}
      branches={branches}
      services={services}
      boutiqueProducts={boutiqueProducts}
    />
  );
}
