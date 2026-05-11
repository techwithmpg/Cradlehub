import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { SPA_IMAGES } from "@/constants/spa-images";
import { ServiceCatalogClient } from "@/components/public/service-catalog-client";
import { PublicMobileServices } from "@/components/public/mobile/public-mobile-services";
import { getPublicServiceCatalog } from "@/lib/queries/services";
import { buildMetadata } from "@/lib/seo/metadata";
import { ServiceJsonLd, BreadcrumbJsonLd } from "@/components/seo/structured-data";

export const metadata: Metadata = buildMetadata({
  title: "Services | Massage, Salon, Skin Care & Spa Packages in Bacolod",
  description:
    "Explore the Cradle Wellness Living service catalog in Bacolod, including massage services, salon care, skin care treatments, Divine Renewal packages, and spa party packages.",
  path: "/services",
});

export default async function ServicesPage() {
  const services = await getPublicServiceCatalog();

  return (
    <div className="sp-public">
      <PublicMobileServices services={services} />
      <div className="hidden md:block">
        <section className="relative overflow-hidden bg-[#10261D] pt-32 pb-16 text-[#FCFAF5] lg:pt-40 lg:pb-24">
          <div className="absolute inset-0">
            <Image
              src={SPA_IMAGES.ctaBanner}
              alt="Cradle spa treatment details"
              fill
              priority
              className="object-cover opacity-60"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-[#10261D]/70" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,38,29,0.97)_0%,rgba(16,38,29,0.74)_52%,rgba(16,38,29,0.4)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(0deg,#FCFAF5_0%,rgba(252,250,245,0)_100%)]" />
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
              <p className="mt-6 max-w-2xl text-[15px] leading-7 text-[#F7F3EB]/76">
                Browse Cradle&apos;s real service catalog by category. The public booking flow
                remains branch-aware, so only assigned and available services appear when you book.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/book"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-[#C8A96B] px-7 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#10261D] transition hover:bg-[#E8D5A3]"
                >
                  Book Appointment
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] border border-[#F7F3EB]/28 px-7 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#FCFAF5] transition hover:bg-white/10"
                >
                  Ask Front Desk
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="rounded-[8px] border border-[#F7F3EB]/14 bg-[#FCFAF5] p-5 text-[#163A2B] shadow-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#B68A3C]">
                What appears in booking?
              </p>
              <p className="mt-3 text-[14px] leading-6 text-[#5F6F63]">
                The catalog below is for browsing. The booking wizard only shows services that are
                assigned to your selected branch, active, public, and available for your visit type.
              </p>
            </div>
          </div>
        </section>

        <ServiceCatalogClient services={services} />
      </div>
      <ServiceJsonLd
        serviceName="Cradle Wellness Living Services"
        description="Massage, salon, skin care, Divine Renewal packages, and spa party packages in Bacolod."
        urlPath="/services"
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Services", path: "/services" },
        ]}
      />
    </div>
  );
}
