import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Calendar } from "lucide-react";
import { ServiceCatalogClient } from "@/components/public/service-catalog-client";
import { PublicMobileServices } from "@/components/public/mobile/public-mobile-services";
import { getPublicServiceCatalog } from "@/lib/queries/services";
import { getPublicBranches } from "@/lib/queries/branches";
import { getPublicSiteSections } from "@/lib/queries/public-site";
import { resolvePublicSiteSections } from "@/lib/public/normalized-sections";
import { SPA_IMAGES } from "@/constants/spa-images";
import { buildMetadata } from "@/lib/seo/metadata";
import { ServiceJsonLd, BreadcrumbJsonLd } from "@/components/seo/structured-data";

export const metadata: Metadata = buildMetadata({
  title: "Services | Massage, Salon, Skin Care & Spa Packages in Bacolod",
  description:
    "Explore the Cradle Wellness Living service catalog in Bacolod, including massage services, salon care, skin care treatments, Divine Renewal packages, and spa party packages.",
  path: "/services",
});

export default async function ServicesPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string; q?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const initialCategory =
    typeof resolvedParams.category === "string" ? resolvedParams.category : "all";
  const initialQuery =
    typeof resolvedParams.q === "string" ? resolvedParams.q : "";

  const [services, branches, managedSections] = await Promise.all([
    getPublicServiceCatalog(),
    getPublicBranches(),
    getPublicSiteSections({ includeDisabled: false }).catch((error) => {
      console.error("[ServicesPage] Failed to load site sections:", error);
      return [];
    }),
  ]);

  const sections = resolvePublicSiteSections(managedSections);
  const bannerImage = sections.siteImages?.services_banner || SPA_IMAGES.hero;

  return (
    <div className="w-full bg-[#F7F3EB] text-[#10261D]">
      <PublicMobileServices
        services={services}
        bannerImage={bannerImage}
        initialCategory={initialCategory}
      />

      <div className="hidden md:block">
        {/* Cream & Forest Split Hero Banner matching approved Desktop Services reference */}
        <section className="relative overflow-hidden border-b border-[#E5DEC9] bg-[#EFE9DA]">
          <div className="relative mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
            <div className="relative z-10 max-w-xl">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-[11px] font-semibold tracking-[0.22em] text-[#8A6D3B] uppercase">
                  Cradle Wellness Living
                </span>
                <span className="h-px w-10 bg-[#C8A96B]" aria-hidden="true" />
              </div>
              <h1 className="font-serif text-4xl font-medium tracking-tight text-[#10261D] [font-family:var(--sp-font-display)] lg:text-5xl">
                Our Services
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-[#425148]">
                A complete range of spa, beauty, and home-service treatments
                designed to help you relax, rejuvenate, and feel your best.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/book"
                  className="inline-flex items-center gap-2 rounded-full bg-[#163A2B] px-5 py-2.5 text-xs font-semibold text-[#FAF5E9] shadow-xs transition hover:bg-[#1E4D3A]"
                >
                  <Calendar className="h-3.5 w-3.5 text-[#D4B57A]" aria-hidden="true" />
                  <span>Book a Service Now</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
                <Link
                  href="/services?category=Divine%20Renewal%20Packages"
                  className="inline-flex items-center rounded-full border border-[#163A2B]/30 bg-white px-5 py-2.5 text-xs font-semibold text-[#163A2B] transition hover:border-[#163A2B]"
                >
                  Service Packages
                </Link>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-y-0 right-0 w-[56%]">
            <Image
              src={bannerImage}
              alt="Cradle Wellness Living spa treatment ambiance"
              fill
              preload={true}
              fetchPriority="high"
              sizes="56vw"
              className="object-cover"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-[#EFE9DA] via-[#EFE9DA]/70 to-transparent"
            />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-10 lg:px-8 lg:py-12">
          <ServiceCatalogClient
            services={services}
            branches={branches}
            initialCategory={initialCategory}
            initialQuery={initialQuery}
          />
        </section>
      </div>

      {services.slice(0, 10).map((s) => (
        <ServiceJsonLd
          key={s.id}
          serviceName={s.name}
          description={s.description || s.name}
          urlPath="/services"
        />
      ))}
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Services", path: "/services" },
        ]}
      />
    </div>
  );
}
