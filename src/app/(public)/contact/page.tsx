import type { Metadata } from "next";
import Link from "next/link";
import { ScrollReveal } from "@/components/public/scroll-reveal";
import { PublicMobileContact } from "@/components/public/mobile/public-mobile-contact";
import { getPublicBranches } from "@/lib/queries/branches";
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

const PUBLIC_DARK_SECTION =
  "bg-[radial-gradient(circle_at_80%_8%,rgba(212,181,122,0.10),transparent_34%),linear-gradient(180deg,#031B16_0%,#05241D_50%,#02140F_100%)]";
const PUBLIC_DARK_CARD =
  "rounded-2xl border border-[#D4B57A]/22 bg-[#0D2B20]/70 shadow-[0_24px_70px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(246,235,214,0.06)] backdrop-blur-xl";

export const metadata: Metadata = buildMetadata({
  title: "Contact | Cradle Wellness Living — Bacolod Massage & Spa Booking",
  description:
    "Contact Cradle Wellness Living in Bacolod. Call us, message us on Facebook, or visit our branches. Online booking available.",
  path: "/contact",
});

export default async function ContactPage() {
  const branches = await getPublicBranches();
  const primaryBranch = branches[0];
  const primaryPhone = primaryBranch?.phone ?? "";
  const secondaryPhone = primaryBranch?.secondary_phone ?? "";
  const primaryPhoneHref = primaryPhone ? `tel:${primaryPhone.replace(/\s/g, "")}` : "";
  const secondaryPhoneHref = secondaryPhone ? `tel:${secondaryPhone.replace(/\s/g, "")}` : "";
  const messengerHref = primaryBranch?.messenger_link ?? primaryBranch?.fb_page ?? "";
  const openingHours = primaryBranch?.opening_hours ?? "10:00 AM – 10:00 PM";

  return (
    <div className="sp-public">
      <PublicMobileContact branches={branches} />
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
              Contact Us
            </p>
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-medium leading-tight mb-4"
              style={{ fontFamily: "var(--sp-font-display)", color: "#FCFAF5" }}
            >
              {"We're Here to Help"}
            </h1>
            <p className="text-[15px] max-w-xl mx-auto" style={{ color: "rgba(252,250,245,0.65)" }}>
              Questions about our services, availability, or special requests?
              Reach out and our team will respond with care.
            </p>
          </div>
        </div>

        {/* Action-first cards */}
        <section className={`${PUBLIC_DARK_SECTION} pt-12 pb-4 lg:pt-16`}>
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {primaryPhone ? (
                <a
                  href={primaryPhoneHref}
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                  style={{ background: "#163A2B" }}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "rgba(200,169,107,0.15)" }}>
                    <Phone className="h-6 w-6" style={{ color: "#C8A96B" }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold tracking-widest uppercase mb-1" style={{ color: "#C8A96B" }}>Call Us</p>
                    <p className="text-[15px] font-medium" style={{ color: "#FCFAF5" }}>{primaryPhone}</p>
                  </div>
                </a>
              ) : (
                <div
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center"
                  style={{ background: "#163A2B", opacity: 0.7 }}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "rgba(200,169,107,0.15)" }}>
                    <Phone className="h-6 w-6" style={{ color: "#C8A96B" }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold tracking-widest uppercase mb-1" style={{ color: "#C8A96B" }}>Call Us</p>
                    <p className="text-[15px] font-medium" style={{ color: "#FCFAF5" }}>Contact info updating</p>
                  </div>
                </div>
              )}
              {messengerHref ? (
                <a
                  href={messengerHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                  style={{ background: "#163A2B" }}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "rgba(200,169,107,0.15)" }}>
                    <MessageSquare className="h-6 w-6" style={{ color: "#C8A96B" }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold tracking-widest uppercase mb-1" style={{ color: "#C8A96B" }}>Message Us</p>
                    <p className="text-[15px] font-medium" style={{ color: "#FCFAF5" }}>Facebook Page</p>
                  </div>
                </a>
              ) : (
                <div
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center"
                  style={{ background: "#163A2B", opacity: 0.7 }}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "rgba(200,169,107,0.15)" }}>
                    <MessageSquare className="h-6 w-6" style={{ color: "#C8A96B" }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold tracking-widest uppercase mb-1" style={{ color: "#C8A96B" }}>Message Us</p>
                    <p className="text-[15px] font-medium" style={{ color: "#FCFAF5" }}>Facebook Page</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Contact Info Cards */}
        <section className={`${PUBLIC_DARK_SECTION} py-20 lg:py-28`}>
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">

              {/* Hours */}
              <ScrollReveal delay={0}>
                <div className={`${PUBLIC_DARK_CARD} p-7 transition-shadow duration-500 h-full text-center`}>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#163A2B] text-[#C8A96B] mx-auto mb-5">
                    <Clock className="h-6 w-6" />
                  </div>
                  <h3
                    className="text-[16px] font-semibold mb-3"
                    style={{ fontFamily: "var(--sp-font-display)", color: "#F6EBD6" }}
                  >
                    Hours
                  </h3>
                  <p className="text-[13px] font-medium" style={{ color: "#F6EBD6" }}>Open Daily</p>
                  <p className="text-[13px] mt-1" style={{ color: "rgba(246,235,214,0.66)" }}>{openingHours}</p>
                </div>
              </ScrollReveal>

              {/* Phone */}
              <ScrollReveal delay={100}>
                <div className={`${PUBLIC_DARK_CARD} p-7 transition-shadow duration-500 h-full text-center`}>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#163A2B] text-[#C8A96B] mx-auto mb-5">
                    <Phone className="h-6 w-6" />
                  </div>
                  <h3
                    className="text-[16px] font-semibold mb-3"
                    style={{ fontFamily: "var(--sp-font-display)", color: "#F6EBD6" }}
                  >
                    Phone
                  </h3>
                  {primaryPhone ? (
                    <a
                      href={primaryPhoneHref}
                      className="block text-[13px] transition-colors hover:text-[#C8A96B]"
                      style={{ color: "rgba(246,235,214,0.66)" }}
                    >
                      {primaryPhone}
                    </a>
                  ) : (
                    <p className="text-[13px]" style={{ color: "rgba(246,235,214,0.66)" }}>Contact info updating</p>
                  )}
                  {secondaryPhone ? (
                    <a
                      href={secondaryPhoneHref}
                      className="block text-[13px] mt-1 transition-colors hover:text-[#C8A96B]"
                      style={{ color: "rgba(246,235,214,0.66)" }}
                    >
                      {secondaryPhone}
                    </a>
                  ) : null}
                </div>
              </ScrollReveal>

              {/* Branch cards */}
              {branches.map((branch, index) => (
                <ScrollReveal key={branch.id} delay={(index + 2) * 100}>
                  <div className={`${PUBLIC_DARK_CARD} p-7 transition-shadow duration-500 h-full text-center`}>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#163A2B] text-[#C8A96B] mx-auto mb-5">
                      <MapPin className="h-6 w-6" />
                    </div>
                    <h3
                      className="text-[16px] font-semibold mb-3"
                      style={{ fontFamily: "var(--sp-font-display)", color: "#F6EBD6" }}
                    >
                      {branch.name}
                    </h3>
                    {branch.address && (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(branch.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] leading-relaxed transition-colors hover:text-[#C8A96B]"
                        style={{ color: "rgba(246,235,214,0.66)" }}
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
              <div
                className="mt-16 rounded-2xl p-10 lg:p-14 text-center"
                style={{ background: "#163A2B" }}
              >
                <h2
                  className="text-2xl sm:text-3xl font-medium mb-4"
                  style={{ fontFamily: "var(--sp-font-display)", color: "#FCFAF5" }}
                >
                  Follow Us &amp; Book Online
                </h2>
                <p
                  className="text-[15px] max-w-lg mx-auto mb-8"
                  style={{ color: "rgba(247,243,235,0.7)" }}
                >
                  Stay updated on promotions and availability — or book directly through our online system in under two minutes.
                </p>

                {/* Social links */}
                <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
                  <a
                    href="https://www.facebook.com/518084738045813?ref=NONE_xav_ig_profile_page_web"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-medium tracking-wide border transition-all duration-300 hover:bg-[#D4B57A]/10"
                    style={{ borderColor: "rgba(247,243,235,0.25)", color: "rgba(247,243,235,0.9)" }}
                  >
                    <IconFacebook className="h-4 w-4" />
                    Facebook
                  </a>
                  <a
                    href="https://www.instagram.com/cradlewellnessliving.smbacolod"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-medium tracking-wide border transition-all duration-300 hover:bg-[#D4B57A]/10"
                    style={{ borderColor: "rgba(247,243,235,0.25)", color: "rgba(247,243,235,0.9)" }}
                  >
                    <IconInstagram className="h-4 w-4" />
                    IG · SM Bacolod
                  </a>
                  <a
                    href="https://www.instagram.com/cradlewellnessliving"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-medium tracking-wide border transition-all duration-300 hover:bg-[#D4B57A]/10"
                    style={{ borderColor: "rgba(247,243,235,0.25)", color: "rgba(247,243,235,0.9)" }}
                  >
                    <IconInstagram className="h-4 w-4" />
                    Instagram
                  </a>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Link
                    href="/book"
                    className="inline-flex items-center rounded-full px-8 py-3.5 text-[12px] font-semibold tracking-widest uppercase transition-all duration-300 hover:shadow-xl"
                    style={{
                      background: "linear-gradient(135deg, #C8A96B, #B68A3C)",
                      color: "#10261D",
                    }}
                  >
                    Book Online
                  </Link>
                  {primaryPhone ? (
                    <a
                      href={primaryPhoneHref}
                      className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-[12px] font-medium tracking-widest uppercase border transition-all duration-300 hover:bg-[#D4B57A]/10"
                      style={{
                        borderColor: "rgba(247,243,235,0.25)",
                        color: "rgba(247,243,235,0.9)",
                      }}
                    >
                      <Phone className="h-4 w-4" />
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
