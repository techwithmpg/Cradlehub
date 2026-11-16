import type { Metadata } from "next";
import Link from "next/link";
import { ScrollReveal } from "@/components/public/scroll-reveal";
import { PublicMobileContact } from "@/components/public/mobile/public-mobile-contact";
import { getPublicBranchesSafeCached } from "@/lib/public/public-site-cached";
import { Phone, MapPin, Clock, MessageSquare } from "lucide-react";
import { buildMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd, LocalBusinessJsonLd } from "@/components/seo/structured-data";

function IconFacebook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export const metadata: Metadata = buildMetadata({
  title: "Contact | Cradle Wellness Living — Bacolod Massage & Spa Booking",
  description:
    "Contact Cradle Wellness Living in Bacolod. Call us, message us on Facebook, or visit our branches. Online booking available.",
  path: "/contact",
});

export default async function ContactPage() {
  const branches = await getPublicBranchesSafeCached();
  const primaryBranch = branches[0];
  const primaryPhone = primaryBranch?.phone ?? "";
  const secondaryPhone = primaryBranch?.secondary_phone ?? "";
  const primaryPhoneHref = primaryPhone ? `tel:${primaryPhone.replace(/\s/g, "")}` : "";
  const secondaryPhoneHref = secondaryPhone ? `tel:${secondaryPhone.replace(/\s/g, "")}` : "";
  const messengerHref = primaryBranch?.messenger_link ?? primaryBranch?.fb_page ?? "";
  const openingHours = primaryBranch?.opening_hours ?? "10:00 AM – 10:00 PM";

  return (
    <div className="sp-public bg-[#F7F3EB] text-[#10261D]">
      <PublicMobileContact branches={branches} />
      <div className="hidden md:block">
        {/* Forest Green Hero */}
        <section className="bg-[#10261D] pt-28 pb-16 text-[#FCFAF5] lg:pt-32 lg:pb-20">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#D4B57A]">
              Contact Us
            </p>
            <h1
              className="mb-4 text-3xl font-medium leading-tight text-[#FCFAF5] sm:text-4xl lg:text-5xl"
              style={{ fontFamily: "var(--sp-font-display)" }}
            >
              {"We're Here to Help"}
            </h1>
            <p className="mx-auto max-w-xl text-[15px] text-[#EDE4D3]/80">
              Questions about our services, availability, or special requests?
              Reach out and our team will respond with care.
            </p>
          </div>
        </section>

        {/* Action-first cards */}
        <section className="bg-[#FCFAF5] pt-12 pb-4 lg:pt-16">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
              {primaryPhone ? (
                <a
                  href={primaryPhoneHref}
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#E5DEC9] bg-white p-8 text-center shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F3EB] text-[#B68A3C]">
                    <Phone className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#8A6D3B]">
                      Call Us
                    </p>
                    <p className="text-[15px] font-semibold text-[#10261D]">
                      {primaryPhone}
                    </p>
                  </div>
                </a>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#E5DEC9] bg-white p-8 text-center opacity-80">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F3EB] text-[#B68A3C]">
                    <Phone className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#8A6D3B]">
                      Call Us
                    </p>
                    <p className="text-[15px] font-medium text-[#55635B]">
                      Contact info updating
                    </p>
                  </div>
                </div>
              )}
              {messengerHref ? (
                <a
                  href={messengerHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#E5DEC9] bg-white p-8 text-center shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F3EB] text-[#B68A3C]">
                    <MessageSquare className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#8A6D3B]">
                      Message Us
                    </p>
                    <p className="text-[15px] font-semibold text-[#10261D]">
                      Facebook Page
                    </p>
                  </div>
                </a>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#E5DEC9] bg-white p-8 text-center opacity-80">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F3EB] text-[#B68A3C]">
                    <MessageSquare className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#8A6D3B]">
                      Message Us
                    </p>
                    <p className="text-[15px] font-medium text-[#55635B]">
                      Facebook Page
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Contact Info Cards */}
        <section className="bg-[#F7F3EB] py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {/* Hours */}
              <ScrollReveal delay={0}>
                <div className="h-full rounded-2xl border border-[#E5DEC9] bg-white p-7 text-center shadow-xs">
                  <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#F7F3EB] text-[#B68A3C]">
                    <Clock className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3
                    className="mb-3 text-[16px] font-semibold text-[#10261D]"
                    style={{ fontFamily: "var(--sp-font-display)" }}
                  >
                    Hours
                  </h3>
                  <p className="text-[13px] font-semibold text-[#10261D]">Open Daily</p>
                  <p className="mt-1 text-[13px] text-[#55635B]">{openingHours}</p>
                </div>
              </ScrollReveal>

              {/* Phone */}
              <ScrollReveal delay={100}>
                <div className="h-full rounded-2xl border border-[#E5DEC9] bg-white p-7 text-center shadow-xs">
                  <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#F7F3EB] text-[#B68A3C]">
                    <Phone className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3
                    className="mb-3 text-[16px] font-semibold text-[#10261D]"
                    style={{ fontFamily: "var(--sp-font-display)" }}
                  >
                    Phone
                  </h3>
                  {primaryPhone ? (
                    <a
                      href={primaryPhoneHref}
                      className="block text-[13px] font-medium text-[#35463E] transition-colors hover:text-[#B68A3C]"
                    >
                      {primaryPhone}
                    </a>
                  ) : (
                    <p className="text-[13px] text-[#55635B]">Contact info updating</p>
                  )}
                  {secondaryPhone ? (
                    <a
                      href={secondaryPhoneHref}
                      className="mt-1 block text-[13px] font-medium text-[#35463E] transition-colors hover:text-[#B68A3C]"
                    >
                      {secondaryPhone}
                    </a>
                  ) : null}
                </div>
              </ScrollReveal>

              {/* Branch cards */}
              {branches.map((branch, index) => (
                <ScrollReveal key={branch.id} delay={(index + 2) * 100}>
                  <div className="h-full rounded-2xl border border-[#E5DEC9] bg-white p-7 text-center shadow-xs">
                    <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#F7F3EB] text-[#B68A3C]">
                      <MapPin className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h3
                      className="mb-3 text-[16px] font-semibold text-[#10261D]"
                      style={{ fontFamily: "var(--sp-font-display)" }}
                    >
                      {branch.name}
                    </h3>
                    {branch.address && (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(branch.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] leading-relaxed text-[#55635B] transition-colors hover:text-[#10261D] hover:underline"
                      >
                        {branch.address}
                      </a>
                    )}
                  </div>
                </ScrollReveal>
              ))}
            </div>

            {/* Social + Quick Actions */}
            <ScrollReveal>
              <div className="mt-14 rounded-3xl bg-[#10261D] p-10 text-center text-[#FCFAF5] shadow-md lg:p-14">
                <h2
                  className="mb-4 text-2xl font-medium text-[#FCFAF5] sm:text-3xl"
                  style={{ fontFamily: "var(--sp-font-display)" }}
                >
                  Follow Us &amp; Book Online
                </h2>
                <p className="mx-auto mb-8 max-w-lg text-[15px] text-[#EDE4D3]/80">
                  Stay updated on promotions and availability — or book directly through our online system in under two minutes.
                </p>

                {/* Social links */}
                <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
                  <a
                    href="https://www.facebook.com/518084738045813?ref=NONE_xav_ig_profile_page_web"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-[#D4B57A]/40 px-5 py-2.5 text-[12px] font-medium tracking-wide text-[#FCFAF5] transition-all duration-300 hover:bg-[#163A2B]"
                  >
                    <IconFacebook className="h-4 w-4" />
                    Facebook
                  </a>
                  <a
                    href="https://www.instagram.com/cradlewellnessliving.smbacolod"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-[#D4B57A]/40 px-5 py-2.5 text-[12px] font-medium tracking-wide text-[#FCFAF5] transition-all duration-300 hover:bg-[#163A2B]"
                  >
                    <IconInstagram className="h-4 w-4" />
                    IG · SM Bacolod
                  </a>
                  <a
                    href="https://www.instagram.com/cradlewellnessliving"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-[#D4B57A]/40 px-5 py-2.5 text-[12px] font-medium tracking-wide text-[#FCFAF5] transition-all duration-300 hover:bg-[#163A2B]"
                  >
                    <IconInstagram className="h-4 w-4" />
                    Instagram
                  </a>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Link
                    href="/book"
                    className="inline-flex items-center rounded-full bg-[#D4B57A] px-8 py-3.5 text-[13px] font-semibold text-[#10261D] transition hover:bg-[#E4C992]"
                  >
                    Book Online
                  </Link>
                  {primaryPhone ? (
                    <a
                      href={primaryPhoneHref}
                      className="inline-flex items-center gap-2 rounded-full border border-[#D4B57A]/45 px-8 py-3.5 text-[13px] font-semibold text-[#FCFAF5] transition hover:bg-[#163A2B]"
                    >
                      <Phone className="h-4 w-4" aria-hidden="true" />
                      Call Us
                    </a>
                  ) : null}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </div>
      <LocalBusinessJsonLd />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Contact", path: "/contact" },
        ]}
      />
    </div>
  );
}
