import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Calendar } from "lucide-react";
import { ServiceCatalogClient } from "@/components/public/service-catalog-client";
import { PublicMobileServices } from "@/components/public/mobile/public-mobile-services";
import {
  getPublicBranchesSafeCached,
  getPublicServiceCatalogCached,
  getPublicSiteSectionsCached,
} from "@/lib/public/public-site-cached";
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
    getPublicServiceCatalogCached(),
    getPublicBranchesSafeCached(),
    getPublicSiteSectionsCached({ includeDisabled: false }),
  ]);

  const sections = resolvePublicSiteSections(managedSections);
  const bannerImage = sections.siteImages?.services_banner || SPA_IMAGES.hero;

  return (
    <div className="w-full bg-[#071A12] text-[#FAF5E9]">
      <PublicMobileServices
        services={services}
        bannerImage={bannerImage}
        initialCategory={initialCategory}
      />

      <div className="hidden md:block">
        {/* Emerald Glass Full-Width Split Hero Banner */}
        <section className="relative overflow-hidden border-b border-[#D4B57A]/20 bg-[#05140E]">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-[68%] overflow-hidden">
            <Image
              src={bannerImage}
              alt="Cradle Wellness Living spa treatment ambiance"
              fill
              preload={true}
              fetchPriority="high"
              sizes="68vw"
              className="eg-hero-photo object-cover opacity-75"
            />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#05140E_0%,#05140E_34%,rgba(5,20,14,0.88)_50%,rgba(5,20,14,0.42)_74%,rgba(5,20,14,0.12)_100%)]"
          />

          <div className="relative z-10 mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
            <div className="max-w-xl">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-[11px] font-semibold tracking-[0.22em] text-[#E5C98B] uppercase">
                  Cradle Wellness Living
                </span>
                <span className="h-px w-10 bg-[#D4B57A]/60" aria-hidden="true" />
              </div>
              <h1 className="font-serif text-4xl font-medium tracking-tight text-[#FAF5E9] [font-family:var(--sp-font-display)] lg:text-5xl">
                Our Services
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-[#CBD6CD]">
                A complete range of spa, beauty, and home-service treatments
                designed to help you relax, rejuvenate, and feel your best.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/book"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#D4B57A] via-[#E4C98E] to-[#D4B57A] px-5 py-2.5 text-xs font-semibold text-[#071A12] shadow-sm transition hover:brightness-105"
                >
                  <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Book a Service Now</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
                <Link
                  href="/services?category=Divine%20Renewal%20Packages"
                  className="eg-glass-pill inline-flex items-center rounded-full px-5 py-2.5 text-xs font-semibold text-[#FAF5E9] transition hover:border-[#E8D5A3]"
                >
                  Service Packages
                </Link>
              </div>
            </div>
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
