import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Star } from "lucide-react";
import { ServiceImage } from "@/components/public/service-image";
import { SPA_IMAGES } from "@/constants/spa-images";
import { getPublicServiceCatalog } from "@/lib/queries/services";
import type { PublicCatalogService } from "@/lib/queries/services";
import type { Database } from "@/types/supabase";
import { MobileHomeHeroCarousel } from "./mobile-home-hero-carousel";
import { MobileExperienceGrid } from "./mobile-experience-grid";
import { FaqAccordion } from "../faq-accordion";
import { ServiceShowcaseCarousel } from "../service-showcase-carousel";
import { SERVICE_SHOWCASE_SLIDES } from "@/constants/service-showcase";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

// ── Static data ──────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  { text: "The service felt calm, careful, and professional from start to finish.", name: "A. Guest" },
  { text: "The space is clean, peaceful, and easy to relax in.", name: "Cradle Client" },
  { text: "A refreshing experience that makes self-care feel simple.", name: "Regular Guest" },
] as const;

// ── Component ────────────────────────────────────────────────────────────────

type PublicMobileHomeProps = {
  branches?: BranchRow[];
};

export async function PublicMobileHome({ branches = [] }: PublicMobileHomeProps) {
  let featured: PublicCatalogService[] = [];
  try {
    const all = await getPublicServiceCatalog();
    featured = all
      .filter((s) => s.isPublicBookable && !s.isCsrOnly && !s.isVip)
      .slice(0, 4);
  } catch {
    // non-fatal — section hidden when data unavailable
  }

  const branchNames = branches.map((b) => b.name).filter(Boolean);
  const branchAddresses = branches.map((b) => b.address).filter(Boolean);
  const branchListText =
    branchNames.length >= 2
      ? `${branchNames.slice(0, -1).join(", ")} and ${branchNames[branchNames.length - 1]}`
      : branchNames[0] ?? "our Bacolod branches";
  const branchAddressText =
    branchAddresses.length >= 2
      ? `${branchAddresses.slice(0, -1).join(" and ")}`
      : branchAddresses[0] ?? "";

  return (
    <div className="md:hidden bg-[#F8F2E7] pb-12 text-[#022316]">

      {/* ── Hero Carousel ─────────────────────────────────────────────────── */}
      <MobileHomeHeroCarousel />

      {/* ── White lift card ───────────────────────────────────────────────── */}
      <div className="-mt-5 rounded-t-[26px] bg-[#F8F2E7] pt-5 shadow-[0_-8px_24px_rgba(2,35,22,0.10)]">

        {/* ── Choose Your Experience ──────────────────────────────────────── */}
        <MobileExperienceGrid />

        {/* ── Popular Services ───────────────────────────────────────────── */}
        {featured.length > 0 && (
          <section className="mt-5 px-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold">Popular Services</h2>
              <Link
                href="/services"
                className="flex items-center gap-1 text-[11px] font-semibold text-[#B68A3C]"
              >
                View All
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden">
              {featured.map((service, index) => (
                <article
                  key={service.id}
                  className="w-[150px] shrink-0 overflow-hidden rounded-[14px] border border-[#E8DDCA] bg-white shadow-[0_4px_14px_rgba(2,35,22,0.07)]"
                >
                  <div className="relative h-[94px]">
                    <ServiceImage
                      src={service.imageUrl}
                      alt={service.imageAlt}
                      fill
                      className="object-cover"
                      sizes="150px"
                    />
                    {index === 0 && (
                      <span className="absolute left-2 top-2 rounded-full bg-[#E0B84B] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[#022316]">
                        Best Seller
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="line-clamp-1 text-[12px] font-semibold">
                      {service.name}
                    </h3>
                    <p className="mt-0.5 text-[10px] text-[#6B7A6F]">
                      {service.durationText}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-[#9A6A1F]">
                        {service.priceLabel}
                      </p>
                      <Link
                        href="/book"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-[#022316] text-[#E0B84B]"
                        aria-label={`Book ${service.name}`}
                      >
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ── Special Packages Banner ─────────────────────────────────────── */}
        <section className="mt-5 px-4">
          <div className="relative min-h-[180px] overflow-hidden rounded-[18px] shadow-[0_8px_28px_rgba(2,35,22,0.16)]">
            <Image
              src={SPA_IMAGES.ctaBanner}
              alt="Cradle special wellness packages"
              fill
              className="object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-[#022316]/82" />
            <div className="relative px-5 py-7">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#E0B84B]">
                Best Value
              </p>
              <h2
                className="font-display mt-2 text-[22px] font-medium text-[#FCFAF5]"
              >
                Special Packages
              </h2>
              <p className="mt-2 max-w-[220px] text-[12px] leading-5 text-[#FCFAF5]/78">
                Choose from our curated packages designed for your wellness journey.
              </p>
              <Link
                href="/services"
                className="mt-5 inline-flex min-h-10 items-center rounded-full bg-linear-to-br from-[#E0B84B] to-[#D8A83F] px-5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#022316]"
              >
                Explore Packages
              </Link>
            </div>
          </div>
        </section>

        {/* ── Guest Impressions ───────────────────────────────────────────── */}
        <section className="mt-5 px-4">
          <h2 className="mb-3.5 text-[16px] font-semibold">Guest Impressions</h2>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden">
            {TESTIMONIALS.map(({ text, name }) => (
              <div
                key={name}
                className="w-[240px] shrink-0 rounded-[14px] border border-[#E8DDCA] bg-white p-4 shadow-[0_2px_10px_rgba(2,35,22,0.05)]"
              >
                <div className="mb-2 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-[#E0B84B] text-[#E0B84B]" aria-hidden="true" />
                  ))}
                </div>
                <p className="text-[12px] italic leading-5 text-[#3F4F44]">
                  &ldquo;{text}&rdquo;
                </p>
                <p className="mt-2 text-[10px] font-semibold text-[#9AA89A]">— {name}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Inside Cradle Experience ─────────────────────────────────────── */}
        <section className="mt-5">
          <ServiceShowcaseCarousel
            slides={SERVICE_SHOWCASE_SLIDES}
            eyebrow="Inside Cradle"
            heading="Inside the Cradle Experience"
            subheading="From soothing treatments to thoughtful details, every part of Cradle is created to help you feel cared for."
          />
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section className="mt-5 px-4 pb-4">
          <h2 className="mb-3.5 text-[16px] font-semibold">Frequently Asked Questions</h2>
          <div className="rounded-[16px] border border-[#E8DDCA] bg-white px-4 shadow-[0_2px_10px_rgba(2,35,22,0.05)]">
            <FaqAccordion
              items={[
                {
                  question: "How do I book a massage?",
                  answer:
                    "Book online at cradlewellnessliving.com/book. Choose in-spa or home service, select your treatment, and confirm your schedule.",
                },
                {
                  question: "Do you offer home service massage in Bacolod?",
                  answer:
                    "Yes. Select Home Service when booking and provide your address. Our therapist will come to your location.",
                },
                {
                  question: "Where are your branches?",
                  answer:
                    branchNames.length > 0
                      ? `${branchListText}${branchAddressText ? `. ${branchAddressText}` : ""}`
                      : "We have branches in Bacolod City. Please contact us for the latest location information.",
                },
                {
                  question: "What services do you offer?",
                  answer:
                    "Massage, foot spa, body scrub, skin care, salon services, spa packages, and home service massage.",
                },
              ]}
            />
          </div>
        </section>

      </div>
    </div>
  );
}
