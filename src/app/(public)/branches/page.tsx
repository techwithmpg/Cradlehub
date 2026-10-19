import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Phone, Mail, Clock, ArrowRight } from "lucide-react";
import { getPublicBranches } from "@/lib/queries/branches";
import { getPublicSiteSections } from "@/lib/queries/public-site";
import { resolvePublicSiteSections } from "@/lib/public/normalized-sections";
import { isPublicReadTransportFailure } from "@/lib/public/public-read-error";
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

const PUBLIC_DARK_SECTION =
  "bg-[radial-gradient(circle_at_80%_8%,rgba(212,181,122,0.10),transparent_34%),linear-gradient(180deg,#031B16_0%,#05241D_50%,#02140F_100%)]";
const PUBLIC_DARK_CARD =
  "rounded-2xl border border-[#D4B57A]/22 bg-[#0D2B20]/70 shadow-[0_24px_70px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(246,235,214,0.06)] backdrop-blur-xl";

export default async function BranchesPage() {
  const [branches, managedSections] = await Promise.all([
    getPublicBranches(),
    getPublicSiteSections({ includeDisabled: false }).catch((error) => {
      if (!isPublicReadTransportFailure(error)) throw error;
      return [];
    }),
  ]);

  const resolved = resolvePublicSiteSections(managedSections);
  const fallbackImage = resolved.siteImages?.branches_fallback_ambient;

  return (
    <div className="sp-public">
      <PublicMobileBranches branches={branches} fallbackImage={fallbackImage} />
      <div className="hidden md:block">
        {/* Dark hero — matches mobile header */}
        <div className="pt-28 pb-14 lg:pt-36 lg:pb-20" style={{ background: "#10261D" }}>
          <div className="mx-auto max-w-4xl px-6 text-center">
            <p
              className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-4"
              style={{ color: "#C8A96B" }}
            >
              Our Branches
            </p>
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-medium leading-tight mb-4"
              style={{ fontFamily: "var(--sp-font-display)", color: "#FCFAF5" }}
            >
              Find a Branch Near You
            </h1>
            <p className="text-[15px] max-w-xl mx-auto" style={{ color: "rgba(252,250,245,0.65)" }}>
              Two locations in Bacolod. Each branch offers the same calm experience and skilled
              team.
            </p>
          </div>
        </div>

        {/* Branches */}
        <section className={`${PUBLIC_DARK_SECTION} py-20 lg:py-28`}>
          <div className="mx-auto max-w-5xl px-6">
            {branches.length === 0 ? (
              <p className="text-center text-sm" style={{ color: "rgba(246,235,214,0.6)" }}>
                Branch information is being updated. Please contact us for details.
              </p>
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
                    (i % 2 === 0 ? SPA_IMAGES.contact : SPA_IMAGES.booking);

                  return (
                    <ScrollReveal key={branch.id} delay={i * 100}>
                      <div
                        className={`${PUBLIC_DARK_CARD} overflow-hidden transition-shadow duration-500`}
                      >
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                          {/* Branch Image Banner */}
                          <div className="relative h-64 lg:h-auto lg:col-span-4 min-h-[220px] bg-[#031B16] overflow-hidden">
                            <Image
                              src={imgSrc}
                              alt={`${branch.name} location`}
                              fill
                              className="object-cover transition-transform duration-500 hover:scale-105"
                              sizes="(max-width: 1024px) 100vw, 33vw"
                            />
                            <div className="absolute inset-0 bg-[#031B16]/20" />
                          </div>

                          {/* Branch Details */}
                          <div className="p-8 lg:p-10 lg:col-span-8 flex flex-col justify-between">
                            <div>
                              <div className="flex items-start justify-between gap-4 mb-4">
                                <h2
                                  className="text-2xl font-medium"
                                  style={{ fontFamily: "var(--sp-font-display)", color: "#F6EBD6" }}
                                >
                                  {branch.name}
                                </h2>
                                <span
                                  className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold border"
                                  style={{
                                    borderColor: "rgba(200,169,107,0.3)",
                                    color: "#C8A96B",
                                    background: "rgba(200,169,107,0.08)",
                                  }}
                                >
                                  In-Spa & Home Service
                                </span>
                              </div>

                              <div className="flex flex-col gap-3 text-[14px]" style={{ color: "rgba(246,235,214,0.72)" }}>
                                {branch.address && (
                                  <div className="flex items-start gap-3">
                                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#C8A96B" }} />
                                    <span>{branch.address}</span>
                                  </div>
                                )}
                                {branch.phone && (
                                  <div className="flex items-center gap-3">
                                    <Phone className="h-4 w-4 shrink-0" style={{ color: "#C8A96B" }} />
                                    <a
                                      href={`tel:${branch.phone.replace(/\s/g, "")}`}
                                      className="transition hover:underline"
                                      style={{ color: "#F6EBD6" }}
                                    >
                                      {branch.phone}
                                    </a>
                                  </div>
                                )}
                                {branch.email && (
                                  <div className="flex items-center gap-3">
                                    <Mail className="h-4 w-4 shrink-0" style={{ color: "#C8A96B" }} />
                                    <a
                                      href={`mailto:${branch.email}`}
                                      className="transition hover:underline"
                                      style={{ color: "#F6EBD6" }}
                                    >
                                      {branch.email}
                                    </a>
                                  </div>
                                )}
                                {branch.opening_hours && (
                                  <div className="flex items-center gap-3">
                                    <Clock className="h-4 w-4 shrink-0" style={{ color: "#C8A96B" }} />
                                    <span>{branch.opening_hours}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-[#D4B57A]/12 flex flex-wrap gap-4 items-center">
                              <Link
                                href={`/book?branch=${branch.id}`}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition"
                                style={{
                                  background: "#C8A96B",
                                  color: "#031B16",
                                }}
                              >
                                Book at this Branch
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                              {branch.address && (
                                <a
                                  href={`https://maps.google.com/?q=${encodeURIComponent(branch.address)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium border border-[#D4B57A]/24 transition hover:bg-white/[0.04]"
                                  style={{ color: "#F6EBD6" }}
                                >
                                  Open in Maps
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </ScrollReveal>
                  );
                })}
              </div>
            )}
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
