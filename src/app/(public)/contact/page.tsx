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
    <div className="sp-public min-h-screen bg-[#071A12] text-[#FAF5E9]">
      <PublicMobileContact branches={branches} />
      <div className="hidden md:block">
        {/* Emerald Glass Hero */}
        <section className="relative overflow-hidden border-b border-[#D4B57A]/15 bg-[#05140E] pt-28 pb-16 text-[#FAF5E9] lg:pt-32 lg:pb-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_380px_at_15%_10%,rgba(28,89,63,0.4),transparent_65%),radial-gradient(600px_320px_at_85%_25%,rgba(212,181,122,0.12),transparent_60%)]" aria-hidden="true" />
          <div className="relative mx-auto max-w-4xl px-6 text-center">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#E5C98B]">
              Contact Us
            </p>
            <h1
              className="mb-4 text-3xl font-medium leading-tight text-[#FAF5E9] sm:text-4xl lg:text-5xl"
              style={{ fontFamily: "var(--sp-font-display)" }}
            >
              {"We're Here to Help"}
            </h1>
            <p className="mx-auto max-w-xl text-[15px] text-[#CBD6CD]">
              Questions about our services, availability, or special requests?
              Reach out and our team will respond with care.
            </p>
          </div>
        </section>

        {/* Action-first cards */}
        <section className="bg-[#061810]/70 pt-12 pb-4 lg:pt-16">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
              {primaryPhone ? (
                <a
                  href={primaryPhoneHref}
                  className="eg-glass-card eg-glass-lift flex flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#D4B57A]/25 bg-[#0A251A]/90 text-[#E5C98B]">
                    <Phone className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#E5C98B]">
                      Call Us
                    </p>
                    <p className="text-[15px] font-semibold text-[#FAF5E9]">
                      {primaryPhone}
                    </p>
                  </div>
                </a>
              ) : (
                <div className="eg-glass-card flex flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center opacity-80">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#D4B57A]/25 bg-[#0A251A]/90 text-[#E5C98B]">
                    <Phone className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#E5C98B]">
                      Call Us
                    </p>
                    <p className="text-[15px] font-medium text-[#B7C6BC]">
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
                  className="eg-glass-card eg-glass-lift flex flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#D4B57A]/25 bg-[#0A251A]/90 text-[#E5C98B]">
                    <MessageSquare className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#E5C98B]">
                      Message Us
                    </p>
                    <p className="text-[15px] font-semibold text-[#FAF5E9]">
                      Facebook Page
                    </p>
                  </div>
                </a>
              ) : (
                <div className="eg-glass-card flex flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center opacity-80">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#D4B57A]/25 bg-[#0A251A]/90 text-[#E5C98B]">
                    <MessageSquare className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#E5C98B]">
                      Message Us
                    </p>
                    <p className="text-[15px] font-medium text-[#B7C6BC]">
                      Facebook Page
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Contact Info Cards */}
        <section className="bg-[#071A12] py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {/* Hours */}
              <ScrollReveal delay={0}>
                <div className="eg-glass-card eg-glass-lift h-full rounded-2xl p-7 text-center">
                  <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-[#D4B57A]/25 bg-[#0A251A]/90 text-[#E5C98B]">
                    <Clock className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3
                    className="mb-3 text-[16px] font-semibold text-[#FAF5E9]"
                    style={{ fontFamily: "var(--sp-font-display)" }}
                  >
                    Hours
                  </h3>
                  <p className="text-[13px] font-semibold text-[#FAF5E9]">Open Daily</p>
                  <p className="mt-1 text-[13px] text-[#CBD6CD]">{openingHours}</p>
                </div>
              </ScrollReveal>

              {/* Phone */}
              <ScrollReveal delay={100}>
                <div className="eg-glass-card eg-glass-lift h-full rounded-2xl p-7 text-center">
                  <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-[#D4B57A]/25 bg-[#0A251A]/90 text-[#E5C98B]">
                    <Phone className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3
                    className="mb-3 text-[16px] font-semibold text-[#FAF5E9]"
                    style={{ fontFamily: "var(--sp-font-display)" }}
                  >
                    Phone
                  </h3>
                  {primaryPhone ? (
                    <a
                      href={primaryPhoneHref}
                      className="block text-[13px] font-medium text-[#FAF5E9] transition-colors hover:text-[#E5C98B]"
                    >
                      {primaryPhone}
                    </a>
                  ) : (
                    <p className="text-[13px] text-[#B7C6BC]">Contact info updating</p>
                  )}
                  {secondaryPhone ? (
                    <a
                      href={secondaryPhoneHref}
                      className="mt-1 block text-[13px] font-medium text-[#FAF5E9] transition-colors hover:text-[#E5C98B]"
                    >
                      {secondaryPhone}
                    </a>
                  ) : null}
                </div>
              </ScrollReveal>

              {/* Branch cards */}
              {branches.map((branch, index) => (
                <ScrollReveal key={branch.id} delay={(index + 2) * 100}>
                  <div className="eg-glass-card eg-glass-lift h-full rounded-2xl p-7 text-center">
                    <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-[#D4B57A]/25 bg-[#0A251A]/90 text-[#E5C98B]">
                      <MapPin className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h3
                      className="mb-3 text-[16px] font-semibold text-[#FAF5E9]"
                      style={{ fontFamily: "var(--sp-font-display)" }}
                    >
                      {branch.name}
                    </h3>
                    {branch.address && (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(branch.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] leading-relaxed text-[#CBD6CD] transition-colors hover:text-[#FAF5E9] hover:underline"
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
              <div className="eg-glass-card mt-14 rounded-3xl bg-[#05140E]/90 p-10 text-center text-[#FAF5E9] shadow-xl lg:p-14">
                <h2
                  className="mb-4 text-2xl font-medium text-[#FAF5E9] sm:text-3xl"
                  style={{ fontFamily: "var(--sp-font-display)" }}
                >
                  Follow Us &amp; Book Online
                </h2>
                <p className="mx-auto mb-8 max-w-lg text-[15px] text-[#CBD6CD]">
                  Stay updated on promotions and availability — or book directly through our online system in under two minutes.
                </p>

                {/* Social links */}
                <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
                  <a
                    href="https://www.facebook.com/518084738045813?ref=NONE_xav_ig_profile_page_web"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="eg-glass-pill inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-medium tracking-wide text-[#FAF5E9] transition-all duration-300 hover:border-[#E5C98B]/60 hover:bg-[#14402E]"
                  >
                    <IconFacebook className="h-4 w-4 text-[#E5C98B]" />
                    Facebook
                  </a>
                  <a
                    href="https://www.instagram.com/cradlewellnessliving.smbacolod"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="eg-glass-pill inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-medium tracking-wide text-[#FAF5E9] transition-all duration-300 hover:border-[#E5C98B]/60 hover:bg-[#14402E]"
                  >
                    <IconInstagram className="h-4 w-4 text-[#E5C98B]" />
                    IG · SM Bacolod
                  </a>
                  <a
                    href="https://www.instagram.com/cradlewellnessliving"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="eg-glass-pill inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-medium tracking-wide text-[#FAF5E9] transition-all duration-300 hover:border-[#E5C98B]/60 hover:bg-[#14402E]"
                  >
                    <IconInstagram className="h-4 w-4 text-[#E5C98B]" />
                    Instagram
                  </a>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Link
                    href="/book"
                    className="inline-flex items-center rounded-full bg-gradient-to-r from-[#D4B57A] via-[#E4C98E] to-[#D4B57A] px-8 py-3.5 text-[13px] font-semibold text-[#071A12] shadow-[0_8px_24px_-8px_rgba(212,181,122,0.55)] transition hover:brightness-105"
                  >
                    Book Online
                  </Link>
                  {primaryPhone ? (
                    <a
                      href={primaryPhoneHref}
                      className="inline-flex items-center gap-2 rounded-full border border-[#D4B57A]/45 bg-[#0D2E20]/70 px-8 py-3.5 text-[13px] font-semibold text-[#FAF5E9] backdrop-blur-sm transition hover:border-[#E8D5A3]/75 hover:bg-[#14402E]"
                    >
                      <Phone className="h-4 w-4 text-[#E5C98B]" aria-hidden="true" />
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
