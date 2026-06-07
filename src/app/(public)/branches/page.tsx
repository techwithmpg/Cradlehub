import type { Metadata } from "next";
import { getPublicBranches } from "@/lib/queries/branches";
import { ScrollReveal } from "@/components/public/scroll-reveal";
import { PublicMobileBranches } from "@/components/public/mobile/public-mobile-branches";
import { MapPin, Phone, Mail, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";
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
  const branches = await getPublicBranches();

  return (
    <div className="sp-public">
      <PublicMobileBranches branches={branches} />
      <div className="hidden md:block">
        {/* Dark hero — matches mobile header */}
        <div
          className="pt-28 pb-14 lg:pt-36 lg:pb-20"
          style={{ background: "#10261D" }}
        >
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
              Two locations in Bacolod. Each branch offers the same calm experience
              and skilled team.
            </p>
          </div>
        </div>

        {/* Branches */}
        <section className={`${PUBLIC_DARK_SECTION} py-20 lg:py-28`}>
          <div className="mx-auto max-w-5xl px-6">
            {branches.length === 0 ? (
              <div className={`py-16 text-center ${PUBLIC_DARK_CARD}`}>
                <p className="text-[15px] font-medium" style={{ color: "#F6EBD6" }}>
                  No branches available at the moment.
                </p>
                <p className="text-[13px] mt-2" style={{ color: "rgba(246,235,214,0.66)" }}>
                  Please check back soon or contact us directly.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {branches.map((branch, i) => (
                  <ScrollReveal key={branch.id} delay={i * 100}>
                    <div className={`${PUBLIC_DARK_CARD} p-8 transition-shadow duration-500 lg:p-10`}>
                      <div className="flex flex-col gap-5">
                        {/* Branch name + meta */}
                        <div>
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#163A2B] text-[#C8A96B] shrink-0">
                              <MapPin className="h-5 w-5" />
                            </div>
                            <h2
                              className="text-xl sm:text-2xl font-medium"
                              style={{ fontFamily: "var(--sp-font-display)", color: "#F6EBD6" }}
                            >
                              {branch.name}
                            </h2>
                          </div>
                          {branch.address && (
                            <p className="text-[14px] mb-3 pl-13" style={{ color: "rgba(246,235,214,0.68)" }}>
                              {branch.address}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-x-5 gap-y-2 pl-13">
                            {branch.phone && (
                              <div className="flex items-center gap-2 text-[13px]" style={{ color: "rgba(246,235,214,0.66)" }}>
                                <Phone className="h-3.5 w-3.5 text-[#C8A96B] shrink-0" />
                                {branch.phone}
                              </div>
                            )}
                            {branch.email && (
                              <div className="flex items-center gap-2 text-[13px]" style={{ color: "rgba(246,235,214,0.66)" }}>
                                <Mail className="h-3.5 w-3.5 text-[#C8A96B] shrink-0" />
                                {branch.email}
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-[13px]" style={{ color: "rgba(246,235,214,0.66)" }}>
                              <Clock className="h-3.5 w-3.5 text-[#C8A96B] shrink-0" />
                              {branch.opening_hours ?? "Daily availability through booking"}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-3 pt-1">
                          {branch.phone && (
                            <a
                              href={`tel:${branch.phone.replace(/\s/g, "")}`}
                              className="inline-flex items-center gap-2 rounded-full border px-5 py-2 text-[12px] font-medium tracking-wide transition-all duration-300 hover:bg-[#D4B57A]/10"
                              style={{ borderColor: "rgba(212,181,122,0.36)", color: "#F6EBD6" }}
                            >
                              <Phone className="h-3.5 w-3.5" />
                              Call
                            </a>
                          )}
                          <Link
                            href="/book"
                            className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-[12px] font-semibold tracking-widest uppercase transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                            style={{
                              background: "linear-gradient(135deg, #C8A96B, #B68A3C)",
                              color: "#10261D",
                            }}
                          >
                            Book Now
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
      <LocalBusinessJsonLd />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Branches", path: "/branches" },
        ]}
      />
    </div>
  );
}
