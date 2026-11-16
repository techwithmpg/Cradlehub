import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Phone, Mail, Clock, ArrowRight } from "lucide-react";
import {
  getPublicBranchesSafeCached,
  getPublicSiteSectionsCached,
} from "@/lib/public/public-site-cached";
import { resolvePublicSiteSections } from "@/lib/public/normalized-sections";
import { ScrollReveal } from "@/components/public/scroll-reveal";
import { PublicMobileBranches } from "@/components/public/mobile/public-mobile-branches";
import { SPA_IMAGES } from "@/constants/spa-images";
import { buildMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd, LocalBusinessJsonLd } from "@/components/seo/structured-data";

export const metadata: Metadata = buildMetadata({
  title: "Branches | Cradle Wellness Living — Bacolod Massage & Spa Locations",
  description:
    "Find Cradle Wellness Living branches in Bacolod. Visit our branches for in-spa massage and wellness treatments. Home service also available.",
  path: "/branches",
});

export default async function BranchesPage() {
  const [branches, managedSections] = await Promise.all([
    getPublicBranchesSafeCached(),
    getPublicSiteSectionsCached({ includeDisabled: false }),
  ]);

  const resolved = resolvePublicSiteSections(managedSections);
  const fallbackImage = resolved.siteImages?.branches_fallback_ambient;
  const heroImage =
    fallbackImage || resolved.siteImages?.branches_hero || SPA_IMAGES.contact;

  return (
    <div className="sp-public bg-[#F7F3EB] text-[#10261D]">
      <PublicMobileBranches branches={branches} fallbackImage={fallbackImage} />
      <div className="hidden md:block">
        {/* Forest Green Split Hero */}
        <section className="relative overflow-hidden bg-[#10261D] pt-24 text-[#FCFAF5]">
          <div className="relative mx-auto grid max-w-7xl grid-cols-12 items-center px-6 py-16 lg:py-20">
            <div className="relative z-10 col-span-7 pr-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#D4B57A]">
                Our Branches
              </p>
              <h1
                className="mt-3 text-4xl font-medium leading-tight text-[#FCFAF5] lg:text-5xl"
                style={{ fontFamily: "var(--sp-font-display)" }}
              >
                Visit Our Branches
              </h1>
              <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-[#EDE4D3]/85">
                Experience the same trusted Cradle wellness care at our convenient
                locations in Bacolod City.
              </p>
            </div>
            <div className="relative col-span-5 h-56 overflow-hidden rounded-2xl border border-[#D4B57A]/25 lg:h-64">
              <Image
                src={heroImage}
                alt="Cradle Wellness Living reception and sanctuary"
                fill
                preload
                fetchPriority="high"
                sizes="(min-width: 1024px) 40vw, 45vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#10261D]/70 via-transparent to-[#10261D]/20" />
            </div>
          </div>
        </section>

        {/* Highlights Strip */}
        <section className="border-b border-[#E5DEC9] bg-[#FCFAF5] py-7">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-6">
            <div className="flex items-center gap-4 rounded-2xl border border-[#E5DEC9] bg-white px-6 py-4 shadow-xs">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F7F3EB] text-[#B68A3C]">
                <MapPin className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#10261D]">
                  {branches.length > 0 ? branches.length : 2} Convenient Locations
                </p>
                <p className="text-[12px] text-[#55635B]">
                  Main Spa and SM Branch
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-2xl border border-[#E5DEC9] bg-white px-6 py-4 shadow-xs">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F7F3EB] text-[#B68A3C]">
                <Clock className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#10261D]">
                  Consistent Premium Care
                </p>
                <p className="text-[12px] text-[#55635B]">
                  Same quality, same Cradle experience
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Branches List */}
        <section className="bg-[#F7F3EB] py-16 lg:py-20">
          <div className="mx-auto max-w-5xl px-6">
            {branches.length === 0 ? (
              <div className="rounded-2xl border border-[#E5DEC9] bg-white p-12 text-center shadow-xs">
                <p className="text-sm text-[#55635B]">
                  Branch information is being updated. Please contact us for details.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {branches.map((branch, i) => {
                  const metaImg =
                    branch.location_metadata &&
                    typeof branch.location_metadata === "object" &&
                    "image_url" in branch.location_metadata &&
                    typeof branch.location_metadata.image_url === "string" &&
                    branch.location_metadata.image_url.trim().length > 0
                      ? branch.location_metadata.image_url.trim()
                      : null;
                  const imgSrc =
                    metaImg ||
                    fallbackImage ||
                    (i % 2 === 0 ? SPA_IMAGES.branchMain : SPA_IMAGES.branchSm);
                  const badgeLabel = /sm/i.test(branch.name)
                    ? "SM Branch"
                    : i === 0
                      ? "Main Branch"
                      : "Branch Location";
                  const shortLabel = /sm/i.test(branch.name)
                    ? "SM Branch"
                    : i === 0
                      ? "Main Spa"
                      : branch.name;

                  return (
                    <ScrollReveal key={branch.id} delay={i * 80}>
                      <article className="overflow-hidden rounded-2xl border border-[#E5DEC9] bg-white shadow-xs transition-shadow duration-300 hover:shadow-md">
                        <div className="grid grid-cols-1 lg:grid-cols-12">
                          {/* Branch Photo */}
                          <div className="relative min-h-[260px] overflow-hidden bg-[#EDE4D3] lg:col-span-6">
                            <Image
                              src={imgSrc}
                              alt={`${branch.name} location`}
                              fill
                              loading="lazy"
                              className="object-cover transition-transform duration-500 hover:scale-105"
                              sizes="(max-width: 1024px) 100vw, 50vw"
                            />
                          </div>

                          {/* Branch Details */}
                          <div className="flex flex-col justify-between p-7 lg:col-span-6 lg:p-9">
                            <div>
                              <span className="inline-flex items-center rounded-full bg-[#EFE2C2] px-3 py-1 text-[11px] font-semibold text-[#5C4417]">
                                {badgeLabel}
                              </span>
                              <h2
                                className="mt-3 text-2xl font-semibold text-[#10261D]"
                                style={{ fontFamily: "var(--sp-font-display)" }}
                              >
                                {branch.name}
                              </h2>

                              <div className="mt-5 flex flex-col gap-3 text-[14px] text-[#35463E]">
                                {branch.address && (
                                  <div className="flex items-start gap-3">
                                    <MapPin
                                      className="mt-0.5 h-4 w-4 shrink-0 text-[#B68A3C]"
                                      aria-hidden="true"
                                    />
                                    <span>{branch.address}</span>
                                  </div>
                                )}
                                {branch.opening_hours && (
                                  <div className="flex items-center gap-3">
                                    <Clock
                                      className="h-4 w-4 shrink-0 text-[#B68A3C]"
                                      aria-hidden="true"
                                    />
                                    <span>{branch.opening_hours}</span>
                                  </div>
                                )}
                                {branch.phone && (
                                  <div className="flex items-center gap-3">
                                    <Phone
                                      className="h-4 w-4 shrink-0 text-[#B68A3C]"
                                      aria-hidden="true"
                                    />
                                    <a
                                      href={`tel:${branch.phone.replace(/\s/g, "")}`}
                                      className="font-medium text-[#10261D] transition hover:text-[#B68A3C] hover:underline"
                                    >
                                      {branch.phone}
                                    </a>
                                  </div>
                                )}
                                {branch.email && (
                                  <div className="flex items-center gap-3">
                                    <Mail
                                      className="h-4 w-4 shrink-0 text-[#B68A3C]"
                                      aria-hidden="true"
                                    />
                                    <a
                                      href={`mailto:${branch.email}`}
                                      className="text-[#35463E] transition hover:text-[#10261D] hover:underline"
                                    >
                                      {branch.email}
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="mt-6 flex flex-col gap-2.5 pt-5">
                              <Link
                                href={`/book?branchId=${encodeURIComponent(branch.id)}`}
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#163A2B] px-6 text-[13px] font-semibold text-[#FCFAF5] transition hover:bg-[#1E4D3A]"
                              >
                                Book at {shortLabel}
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                              </Link>
                              {branch.address && (
                                <a
                                  href={`https://maps.google.com/?q=${encodeURIComponent(branch.address)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#D4CBB3] bg-[#FCFAF5] px-5 text-[13px] font-semibold text-[#10261D] transition hover:bg-[#F7F3EB]"
                                >
                                  <MapPin className="h-3.5 w-3.5 text-[#B68A3C]" aria-hidden="true" />
                                  Get Directions
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    </ScrollReveal>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Bottom Forest Green CTA Banner */}
        <section className="bg-[#F7F3EB] pb-20">
          <div className="mx-auto max-w-5xl px-6">
            <div className="relative overflow-hidden rounded-3xl bg-[#10261D] text-[#FCFAF5] shadow-md">
              <div className="grid items-center lg:grid-cols-12">
                <div className="relative z-10 p-8 lg:col-span-7 lg:p-12">
                  <h2
                    className="text-2xl font-medium leading-snug text-[#FCFAF5] lg:text-3xl"
                    style={{ fontFamily: "var(--sp-font-display)" }}
                  >
                    Book at Your Preferred Branch
                  </h2>
                  <p className="mt-2 text-sm text-[#EDE4D3]/85">
                    Same services. Same care. More convenience.
                  </p>
                  <Link
                    href="/book"
                    className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#D4B57A] px-7 text-[13px] font-semibold text-[#10261D] transition hover:bg-[#E4C992]"
                  >
                    Book an Appointment
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
                <div className="relative hidden h-full min-h-[220px] lg:col-span-5 lg:block">
                  <Image
                    src={SPA_IMAGES.ctaBanner}
                    alt="Cradle Wellness Living treatment essentials"
                    fill
                    loading="lazy"
                    sizes="40vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#10261D] via-[#10261D]/40 to-transparent" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Branches", path: "/branches" },
        ]}
      />
      <LocalBusinessJsonLd />
    </div>
  );
}
