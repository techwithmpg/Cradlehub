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
    description: "Trained and friendly wellness professionals",
  },
  {
    icon: ShieldCheck,
    title: "Safe & Hygienic",
    description: "A clean, comfortable, and well-maintained spa",
  },
  {
    icon: Leaf,
    title: "Holistic Wellness",
    description: "Beauty, relaxation, and total well-being in one place",
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

  const isDefaultHeroTitle =
    hero.title.trim() === "Restore Your Body. Quiet Your Mind.";
  const heroTitleDisplay = isDefaultHeroTitle
    ? "A sanctuary of calm\nin Bacolod"
    : hero.title;

  const safeServices = services.filter(isSafeDisplayService);
  const signaturePreviewServices = safeServices.slice(0, 4);

  return (
    <div className="w-full bg-[#F7F3EB] text-[#10261D]">
      {/* 1. Editorial Split-Overlay Hero */}
      {hero.isEnabled && (
        <section className="relative overflow-hidden border-b border-[#E5DEC9] bg-[#EFE9DA]">
          <div className="relative mx-auto max-w-7xl">
            <div className="grid min-h-[500px] grid-cols-12 items-center lg:min-h-[560px]">
              {/* Left Text Block */}
              <div className="relative z-10 col-span-12 px-6 py-14 sm:px-8 lg:col-span-6 lg:py-20">
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-[11px] font-semibold tracking-[0.22em] text-[#7D6538] uppercase">
                    Cradle Wellness Living
                  </span>
                  <span className="h-px w-12 bg-[#C8A96B]" aria-hidden="true" />
                </div>

                <h1 className="whitespace-pre-line font-serif text-4xl font-medium leading-[1.08] tracking-tight text-[#10261D] [font-family:var(--sp-font-display)] text-balance lg:text-[54px]">
                  {heroTitleDisplay}
                </h1>

                <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-[#3E4C44] [text-wrap:pretty] lg:text-base">
                  {hero.subtitle}
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3.5">
                  <Link
                    href={hero.ctaHref || "/book"}
                    className="inline-flex items-center gap-2.5 rounded-full bg-[#163A2B] px-6 py-3.5 text-sm font-semibold text-[#FAF5E9] shadow-sm transition hover:bg-[#1E4D3A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#163A2B]"
                  >
                    <Calendar className="h-4 w-4 text-[#D4B57A]" aria-hidden="true" />
                    <span>{hero.ctaLabel || "Book an Appointment"}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>

                  <Link
                    href={
                      hero.secondaryCtaHref === "#plan-your-visit"
                        ? "/services"
                        : hero.secondaryCtaHref || "/services"
                    }
                    className="inline-flex items-center gap-2 rounded-full border border-[#163A2B]/30 bg-[#FCFAF5]/90 px-6 py-3.5 text-sm font-semibold text-[#163A2B] transition hover:border-[#163A2B] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#163A2B]"
                  >
                    <span>
                      {hero.secondaryCtaLabel === "Plan Your Visit"
                        ? "Explore Services"
                        : hero.secondaryCtaLabel || "Explore Services"}
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Right Ambient Sanctuary Photography */}
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[64%] lg:block">
            <Image
              src={hero.imageUrl || SPA_IMAGES.hero}
              alt={hero.imageAltText || "Cradle Wellness Living sanctuary suite"}
              fill
              preload={true}
              fetchPriority="high"
              sizes="(min-width: 1024px) 64vw, 100vw"
              className="object-cover"
              style={{ objectPosition: hero.imagePosition || "65% 50%" }}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-[#EFE9DA] via-[#EFE9DA]/72 to-transparent"
            />
          </div>
        </section>
      )}

      {/* 2. Three-Pillar Trust Strip */}
      <section className="border-b border-[#E5DEC9] bg-[#FCFAF5]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-[#E5DEC9] px-6 sm:px-8 md:grid-cols-3 md:divide-x md:divide-y-0">
          {TRUST_HIGHLIGHTS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="flex items-start gap-3.5 py-6 md:px-6 md:first:pl-0 md:last:pr-0"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E5DEC9] bg-[#F5EFE3] text-[#B68A3C]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#10261D]">
                    {item.title}
                  </h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#58665E]">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Our Services Visual Category Showcase */}
      {signatureServices.isVisible && (
        <section className="mx-auto max-w-7xl px-6 py-14 sm:px-8 lg:py-18">
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-[11px] font-semibold tracking-[0.2em] text-[#8A6D3B] uppercase">
                  {signatureServices.subtitle || "OUR SERVICES"}
                </span>
                <span className="h-px w-10 bg-[#C8A96B]" aria-hidden="true" />
              </div>
              <h2 className="font-serif text-3xl font-medium leading-tight text-[#10261D] [font-family:var(--sp-font-display)] text-balance lg:text-[36px]">
                Wellness, Beauty &amp; Self-Care
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#526058] [text-wrap:pretty]">
                {signatureServices.body}
              </p>
              <Link
                href="/services"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#163A2B] px-5 py-2.5 text-xs font-semibold tracking-wide text-[#FAF5E9] transition hover:bg-[#1E4D3A]"
              >
                <span>View All Services</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-4">
              {SERVICE_EXPERIENCE_CARDS.map((card) => {
                const Icon = card.icon;
                const categoryImage = card.categoryName
                  ? signatureServices.categoryImages[card.categoryName] ||
                    getPublicHomeCategoryImage(card.categoryName)
                  : siteImages?.home_service_card || SPA_IMAGES.aromatherapy;
                return (
                  <Link
                    key={card.key}
                    href={card.href}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-[#E5DEC9] bg-white shadow-xs transition duration-300 hover:-translate-y-0.5 hover:border-[#C8A96B] hover:shadow-md"
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#EDE4D3]">
                      <Image
                        src={categoryImage}
                        alt={card.title}
                        fill
                        loading="lazy"
                        sizes="(min-width: 1024px) 18vw, (min-width: 640px) 42vw, 90vw"
                        className="object-cover transition duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div className="flex flex-1 items-center justify-between gap-2 px-3.5 py-3.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5EFE3] text-[#B68A3C]">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-[13px] font-semibold text-[#10261D]">
                            {card.title}
                          </h3>
                          <p className="truncate text-[11px] text-[#5B6860]">
                            {card.subtitle}
                          </p>
                        </div>
                      </div>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EFE4CC] text-[#7D5E29] transition group-hover:bg-[#163A2B] group-hover:text-[#FAF5E9]">
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 4. Choose Your Wellness Experience Split Card */}
      <section className="mx-auto max-w-7xl px-6 pb-14 sm:px-8">
        <div className="grid grid-cols-1 overflow-hidden rounded-3xl border border-[#E2D9C8] bg-[#FCFAF5] shadow-sm lg:grid-cols-12">
          <div className="relative flex min-h-[180px] items-center overflow-hidden bg-[#10261D] px-8 py-8 text-[#FAF5E9] lg:col-span-4">
            <Image
              src={siteImages?.experience_banner || SPA_IMAGES.ctaBanner}
              alt="Fresh botanical spa atmosphere"
              fill
              loading="lazy"
              sizes="(min-width: 1024px) 33vw, 100vw"
              className="object-cover opacity-35"
            />
            <div className="relative z-10">
              <p className="text-[10px] font-semibold tracking-[0.22em] text-[#D4B57A] uppercase">
                How We Serve You
              </p>
              <h2 className="mt-2 font-serif text-2xl font-medium leading-snug text-[#FAF5E9] [font-family:var(--sp-font-display)] lg:text-[28px]">
                Choose your wellness experience
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 divide-y divide-[#E5DEC9] md:grid-cols-2 md:divide-x md:divide-y-0 lg:col-span-8">
            <div className="flex items-start gap-4 p-6 lg:p-8">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F5EFE3] text-[#B68A3C]">
                <Flower2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-[#10261D]">
                  In-Spa Experience
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#55635B]">
                  Enjoy the full Cradle Wellness Living sanctuary at our SM City
                  Bacolod or Lacson Street branches.
                </p>
                <Link
                  href="/book?visitType=in_spa"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#163A2B]/30 bg-white px-4 py-2 text-xs font-semibold text-[#163A2B] transition hover:border-[#163A2B] hover:bg-[#163A2B] hover:text-[#FAF5E9]"
                >
                  <span>Book at a Branch</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 lg:p-8">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F5EFE3] text-[#B68A3C]">
                <Home className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-[#10261D]">
                  Home Service
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#55635B]">
                  The same therapist-grade relaxation and restorative oils in the
                  comfort of your home or hotel.
                </p>
                <Link
                  href="/book?visitType=home_service"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#163A2B]/30 bg-white px-4 py-2 text-xs font-semibold text-[#163A2B] transition hover:border-[#163A2B] hover:bg-[#163A2B] hover:text-[#FAF5E9]"
                >
                  <span>Book Home Service</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Popular Bookable Treatments (Live Public Catalog) */}
      {signaturePreviewServices.length > 0 && (
        <section className="border-y border-[#E5DEC9] bg-[#FCFAF5] py-14">
          <div className="mx-auto max-w-7xl px-6 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-[#8A6D3B] uppercase">
                  Curated Treatments
                </p>
                <h2 className="mt-1 font-serif text-3xl font-medium text-[#10261D] [font-family:var(--sp-font-display)]">
                  Popular Treatments
                </h2>
              </div>
              <Link
                href="/services"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#163A2B] hover:underline"
              >
                <span>Browse Full Menu ({safeServices.length})</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {signaturePreviewServices.map((service) => (
                <div
                  key={service.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-[#E5DEC9] bg-white shadow-xs transition hover:border-[#C8A96B] hover:shadow-md"
                >
                  <div className="relative aspect-[16/10] w-full bg-[#EDE4D3]">
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
                    <p className="text-[10px] font-semibold tracking-wider text-[#8A6D3B] uppercase">
                      {PUBLIC_CATALOG_CATEGORY_DETAILS[
                        service.categoryName as keyof typeof PUBLIC_CATALOG_CATEGORY_DETAILS
                      ]?.shortName || service.categoryName}
                    </p>
                    <h3 className="mt-1 font-serif text-base font-semibold text-[#10261D] [font-family:var(--sp-font-display)]">
                      {service.name}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#55635B]">
                      {service.description}
                    </p>
                    <div className="mt-auto pt-4">
                      <div className="flex items-center justify-between border-t border-[#F0EAE0] pt-3 text-xs">
                        <span className="inline-flex items-center gap-1 text-[#55635B]">
                          <Clock className="h-3.5 w-3.5 text-[#B68A3C]" aria-hidden="true" />
                          <span>{service.durationText}</span>
                        </span>
                        <span className="font-bold text-[#10261D]">
                          {service.priceLabel}
                        </span>
                      </div>
                      <Link
                        href={`/book?serviceId=${encodeURIComponent(service.id)}`}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-[#163A2B] px-4 py-2 text-xs font-semibold text-[#FAF5E9] transition hover:bg-[#1E4D3A]"
                      >
                        <span>Book Now</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 6. Our Branches (Visit Our Spa Branches) */}
      <section className="mx-auto max-w-7xl px-6 py-14 sm:px-8">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="mb-3 flex items-center gap-3">
              <span className="text-[11px] font-semibold tracking-[0.2em] text-[#8A6D3B] uppercase">
                Our Branches
              </span>
              <span className="h-px w-10 bg-[#C8A96B]" aria-hidden="true" />
            </div>
            <h2 className="font-serif text-3xl font-medium text-[#10261D] [font-family:var(--sp-font-display)]">
              Visit Our Spa Branches
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#526058]">
              Experience Cradle Wellness Living across our Bacolod sanctuaries.
            </p>
            <Link
              href="/branches"
              className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[#163A2B]/30 bg-white px-5 py-2.5 text-xs font-semibold text-[#163A2B] transition hover:border-[#163A2B]"
            >
              <span>View All Locations</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:col-span-8">
            {branches.map((branch, idx) => (
              <div
                key={branch.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-[#E5DEC9] bg-white shadow-xs sm:flex-row"
              >
                <div className="relative aspect-[4/3] w-full shrink-0 bg-[#EDE4D3] sm:aspect-auto sm:w-44">
                  <Image
                    src={resolvePublicBranchImage(
                      branch,
                      idx === 0 ? SPA_IMAGES.branchMain : SPA_IMAGES.branchSm,
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
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#B68A3C]"
                        aria-hidden="true"
                      />
                      <div>
                        <h3 className="text-sm font-semibold text-[#10261D]">
                          {branch.name}
                        </h3>
                        <p className="mt-0.5 text-xs leading-relaxed text-[#55635B]">
                          {branch.address}
                        </p>
                      </div>
                    </div>
                    {branch.phone && (
                      <p className="mt-2 flex items-center gap-1.5 pl-6 text-xs text-[#3E4C44]">
                        <Phone className="h-3.5 w-3.5 text-[#8A6D3B]" aria-hidden="true" />
                        <span>{branch.phone}</span>
                      </p>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 pl-6">
                    <Link
                      href="/branches"
                      className="inline-flex items-center gap-1 rounded-full border border-[#D7CEBC] bg-[#FCFAF5] px-3.5 py-1.5 text-xs font-semibold text-[#10261D] transition hover:border-[#163A2B]"
                    >
                      <span>View Details</span>
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                    <Link
                      href={`/book?branchId=${encodeURIComponent(branch.id)}`}
                      className="inline-flex items-center gap-1 rounded-full bg-[#163A2B] px-3.5 py-1.5 text-xs font-semibold text-[#FAF5E9] transition hover:bg-[#1E4D3A]"
                    >
                      <span>Book Branch</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Cradle Boutique Preview & Sanctuary Story (Honors Marketing Studio About) */}
      <section className="border-t border-[#E5DEC9] bg-[#FCFAF5] py-14">
        <div className="mx-auto max-w-7xl space-y-14 px-6 sm:px-8">
          {about.isEnabled && (
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
              <div className="relative aspect-[16/10] overflow-hidden rounded-3xl border border-[#E2D9C8] bg-[#EDE4D3] lg:col-span-5">
                <Image
                  src={about.imageUrl || SPA_IMAGES.about}
                  alt={about.title}
                  fill
                  loading="lazy"
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="lg:col-span-7">
                <p className="text-[11px] font-semibold tracking-[0.2em] text-[#8A6D3B] uppercase">
                  {about.subtitle || "Spa Philosophy"}
                </p>
                <h2 className="mt-2 font-serif text-3xl font-medium text-[#10261D] [font-family:var(--sp-font-display)]">
                  {about.title}
                </h2>
                <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#4C5A52]">
                  {about.paragraphs.map((paragraph: string, i: number) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/about"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#163A2B] px-5 py-2.5 text-xs font-semibold text-[#FAF5E9] transition hover:bg-[#1E4D3A]"
                  >
                    <span>Read Our Story</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                  <Link
                    href="/products"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#163A2B]/30 bg-white px-5 py-2.5 text-xs font-semibold text-[#163A2B] transition hover:border-[#163A2B]"
                  >
                    <ShoppingBag className="h-3.5 w-3.5 text-[#B68A3C]" aria-hidden="true" />
                    <span>Explore Cradle Boutique</span>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Boutique 4-Card Strip */}
          <div className="rounded-3xl border border-[#E2D9C8] bg-[#F7F3EB] p-6 lg:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.2em] text-[#8A6D3B] uppercase">
                  Cradle Boutique
                </p>
                <h2 className="mt-1 font-serif text-2xl font-medium text-[#10261D] [font-family:var(--sp-font-display)]">
                  Wellness at Home
                </h2>
              </div>
              <Link
                href="/products"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#163A2B] px-4 py-2 text-xs font-semibold text-[#FAF5E9] transition hover:bg-[#1E4D3A]"
              >
                <span>Shop Boutique</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {boutiqueProducts.slice(0, 4).map((item) => (
                <Link
                  key={item.id}
                  href={`/products?category=${item.category}`}
                  className="group overflow-hidden rounded-2xl border border-[#E5DEC9] bg-white p-3 transition hover:border-[#C8A96B] hover:shadow-sm"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#F5EFE3]">
                    <Image
                      src={item.image}
                      alt={item.imageAlt}
                      fill
                      loading="lazy"
                      sizes="(min-width: 1024px) 20vw, 45vw"
                      className="object-cover transition duration-300 group-hover:scale-105"
                    />
                  </div>
                  <p className="mt-2.5 text-sm font-semibold text-[#10261D]">
                    {item.name}
                  </p>
                  <p className="truncate text-[11px] text-[#5B6860]">
                    {item.subtitle}
                  </p>
                  <p className="mt-1.5 text-xs font-bold text-[#163A2B]">
                    {item.priceLabel}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 8. Final Quote / Booking Banner */}
      {quoteBanner.isEnabled && (
        <section className="relative overflow-hidden bg-[#10261D] text-[#FAF5E9]">
          <Image
            src={quoteBanner.imageUrl || SPA_IMAGES.ctaBanner}
            alt="Calm candlelit spa sanctuary"
            fill
            loading="lazy"
            sizes="100vw"
            className="object-cover opacity-25"
          />
          <div className="relative mx-auto flex max-w-5xl flex-col items-center px-6 py-14 text-center sm:px-8 lg:py-16">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-[#D4B57A] uppercase">
              {quoteBanner.subtitle || "Ready to Relax?"}
            </p>
            <h2 className="mt-3 max-w-2xl font-serif text-3xl font-medium leading-tight text-[#FAF5E9] [font-family:var(--sp-font-display)] lg:text-4xl">
              {quoteBanner.title}
            </h2>
            {quoteBanner.body && (
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#D0DBD2]">
                {quoteBanner.body}
              </p>
            )}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={quoteBanner.ctaHref || "/book"}
                className="inline-flex items-center gap-2 rounded-full bg-[#D4B57A] px-7 py-3 text-sm font-semibold text-[#10261D] shadow-sm transition hover:bg-[#E0C38A]"
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
