import React from "react";
import Link from "next/link";
import { MapPin, Phone } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import type { PublicBranch } from "@/lib/public/public-site-data";

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
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

type SiteFooterProps = {
  branches?: PublicBranch[];
  logoUrl?: string | null;
  logoAlt?: string | null;
  taglineText?: string | null;
};

const SOCIAL_LINKS = [
  {
    label: "Facebook — Cradle Wellness Living",
    href: "https://www.facebook.com/518084738045813?ref=NONE_xav_ig_profile_page_web",
    icon: IconFacebook,
  },
  {
    label: "Instagram — SM Bacolod",
    href: "https://www.instagram.com/cradlewellnessliving.smbacolod",
    icon: IconInstagram,
  },
  {
    label: "Instagram — Cradle Wellness Living",
    href: "https://www.instagram.com/cradlewellnessliving",
    icon: IconInstagram,
  },
];

const QUICK_LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/products", label: "Boutique" },
  { href: "/branches", label: "Branches" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/book", label: "Book Now" },
];

export function SiteFooter({
  branches = [],
  logoUrl,
  logoAlt,
  taglineText,
}: SiteFooterProps) {
  const displayTagline =
    taglineText?.trim() ||
    "Where calm meets care — authentic hilot massage, facials, and holistic spa rituals in Bacolod City.";
  const hoursText =
    branches[0]?.opening_hours ||
    branches[0]?.hours ||
    "Open daily · SM City Bacolod & Lacson Street";

  return (
    <footer className="public-site-footer border-t border-[#D4B57A]/20 bg-[#05140E] text-[#E5E2D7]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:items-start">
          {/* Brand Column */}
          <div className="space-y-4 md:col-span-5">
            <Link href="/" className="inline-flex items-center gap-3">
              {logoUrl ? (
                <BrandLogo
                  mode="horizontal"
                  size="md"
                  variant="dark"
                  className="w-40 md:w-48"
                  customUrl={logoUrl}
                  customAlt={logoAlt}
                />
              ) : (
                <>
                  <BrandLogo
                    mode="mark"
                    size="sm"
                    variant="dark"
                    className="h-10 w-12 shrink-0"
                  />
                  <div className="leading-tight">
                    <span className="block font-serif text-lg font-medium text-[#FAF5E9] [font-family:var(--sp-font-display)]">
                      Cradle Wellness Living
                    </span>
                    <span className="block text-[10px] tracking-[0.22em] text-[#D4B57A] uppercase">
                      A Wellness Sanctuary
                    </span>
                  </div>
                </>
              )}
            </Link>
            <p className="max-w-md text-[13px] leading-relaxed text-[#B9C4BC]">
              {displayTagline}
            </p>
            <div className="flex items-center gap-2.5 pt-1">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#C8A96B]/25 bg-[#163A2B] text-[#E8D5A3] transition hover:border-[#D4B57A] hover:bg-[#1E4D3A]"
                >
                  <s.icon className="h-4 w-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-3">
            <h4 className="mb-3 text-[11px] font-semibold tracking-[0.16em] text-[#D4B57A] uppercase">
              Explore
            </h4>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-1">
              {QUICK_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[13px] text-[#B9C4BC] transition hover:text-[#E8D5A3]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Bacolod Branches */}
          <div className="space-y-3 md:col-span-4">
            <h4 className="mb-3 text-[11px] font-semibold tracking-[0.16em] text-[#D4B57A] uppercase">
              Bacolod Sanctuaries
            </h4>
            {branches.length > 0 ? (
              <div className="space-y-3">
                {branches.slice(0, 3).map((branch) => (
                  <div
                    key={branch.id}
                    className="eg-glass-card rounded-xl p-3 text-xs"
                  >
                    <p className="flex items-center gap-1.5 font-semibold text-[#FAF5E9]">
                      <MapPin className="h-3.5 w-3.5 text-[#D4B57A]" aria-hidden="true" />
                      <span>{branch.name}</span>
                    </p>
                    <p className="mt-1 text-[#B9C4BC]">{branch.address}</p>
                    {branch.phone && (
                      <a
                        href={`tel:${branch.phone.replace(/[^+\d]/g, "")}`}
                        className="mt-1.5 inline-flex items-center gap-1 text-[#E8D5A3] hover:underline"
                      >
                        <Phone className="h-3 w-3" aria-hidden="true" />
                        <span>{branch.phone}</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-[#B9C4BC]">
                SM City Bacolod (North Wing) · La Luz Building (Lacson Street)
              </p>
            )}
          </div>
        </div>

        {/* Bottom Legal Line */}
        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-[#1E4D3A] pt-5 text-center sm:flex-row sm:text-left">
          <p className="text-[11px] text-[#8FA095]">{hoursText}</p>
          <p className="text-[11px] text-[#8FA095]">
            &copy; {new Date().getFullYear()} Cradle Wellness Living. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
