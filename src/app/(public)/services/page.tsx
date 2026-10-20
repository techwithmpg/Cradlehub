import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { SPA_IMAGES } from "@/constants/spa-images";
import { ServiceCatalogClient } from "@/components/public/service-catalog-client";
import { PublicMobileServices } from "@/components/public/mobile/public-mobile-services";
import { getPublicServiceCatalog } from "@/lib/queries/services";
import { getPublicSiteSections } from "@/lib/queries/public-site";
import { resolvePublicSiteSections } from "@/lib/public/normalized-sections";
import { isPublicReadTransportFailure } from "@/lib/public/public-read-error";
import { buildMetadata } from "@/lib/seo/metadata";
import { ServiceJsonLd, BreadcrumbJsonLd } from "@/components/seo/structured-data";

export const metadata: Metadata = buildMetadata({
  title: "Services | Massage, Salon, Skin Care & Spa Packages in Bacolod",
  description:
    "Explore the Cradle Wellness Living service catalog in Bacolod, including massage services, salon care, skin care treatments, Divine Renewal packages, and spa party packages.",
  path: "/services",
});

export default async function ServicesPage() {
  const [services, managedSections] = await Promise.all([
    getPublicServiceCatalog(),
    getPublicSiteSections({ includeDisabled: false }).catch((error) => {
      if (!isPublicReadTransportFailure(error)) throw error;
      return [];
    }),
  ]);

  const resolved = resolvePublicSiteSections(managedSections);
  const bannerImage =
    resolved.siteImages?.services_page_banner ||
    resolved.quoteBanner.imageUrl ||
    SPA_IMAGES.ctaBanner;

  return (
    <div className="sp-public">
      <PublicMobileServices services={services} bannerImage={bannerImage} />
      <div className="hidden md:block">
        <section className="relative overflow-hidden bg-[#10261D] pt-32 pb-16 text-[#FCFAF5] lg:pt-40 lg:pb-24">
          <div className="absolute inset-0">
            <Image
              src={bannerImage}
              alt="Cradle spa treatment details"
              fill
              priority
              className="object-cover opacity-60"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-[#10261D]/70" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,38,29,0.97)_0%,rgba(16,38,29,0.74)_52%,rgba(16,38,29,0.4)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(0deg,#031B16_0%,rgba(3,27,22,0)_100%)]" />
          </div>

          <div className="relative mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[1fr_0.52fr] lg:items-end lg:px-12">
            <div>
              <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#E8D5A3]">
                Cradle Service Menu
              </p>
              <h1
                className="max-w-4xl text-4xl font-medium leading-[1.04] sm:text-6xl lg:text-7xl"
                style={{ fontFamily: "var(--sp-font-display)" }}
              >
                Massage, salon, skin care, and spa rituals in one calm menu.
              </h1>
              <p className="mt-6 max-w-2xl text-[15px] leading-7 text-[#EDE4D3]/76">
                Browse our treatments by category, review service notes, and book
                directly online. Our team is always ready to guide your selection.
              </p>
            </div>

            <div className="rounded-[8px] border border-[#D4B57A]/22 bg-[#061912]/74 p-7 backdrop-blur-md">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#E8D5A3]">
                Booking Guidance
              </p>
              <h2
                className="mt-3 text-2xl font-medium text-[#FCFAF5]"
                style={{ fontFamily: "var(--sp-font-display)" }}
              >
                Need help deciding?
              </h2>
              <p className="mt-3 text-[13px] leading-6 text-[#EDE4D3]/72">
                Choose in-spa for full relaxation in our treatment rooms, or home
                service when comfort at your residence is preferred.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/book"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] bg-[#C8A96B] px-5 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#10261D] transition hover:bg-[#D4B57A]"
                >
                  Book Online
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] border border-[#D4B57A]/35 px-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#FCFAF5] transition hover:bg-white/5"
                >
                  <MessageCircle className="h-4 w-4 text-[#C8A96B]" />
                  Ask Front Desk
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#FAF7F2] py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <ServiceCatalogClient services={services} />
          </div>
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
