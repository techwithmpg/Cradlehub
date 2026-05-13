import Link from "next/link";
import { BrandLogo } from "@/components/shared/brand-logo";
import type { Database } from "@/types/supabase";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

type SiteFooterProps = {
  branches?: BranchRow[];
};

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

const SOCIALS = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/518084738045813?ref=NONE_xav_ig_profile_page_web",
    icon: IconFacebook,
  },
  {
    label: "Instagram — SM Bacolod",
    href: "https://www.instagram.com/cradlewellnessliving.smbacolod",
    icon: IconInstagram,
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/cradlewellnessliving",
    icon: IconInstagram,
  },
];

const QUICK_LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/book", label: "Book" },
  { href: "/branches", label: "Branches" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteFooter({ branches }: SiteFooterProps) {
  const firstBranchHours = branches?.[0]?.opening_hours;
  const hoursText = firstBranchHours ?? "Open daily · Book online";

  return (
    <footer className="bg-[#10261D] text-[#9AA89A]">
      <div className="mx-auto max-w-7xl px-6 py-8 md:py-12">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">

          {/* Brand + Social */}
          <div className="md:max-w-xs">
            <Link href="/" className="inline-flex mb-3 hover:opacity-85 transition-opacity duration-300">
              <BrandLogo size="md" variant="dark" className="w-32 md:w-40" />
            </Link>
            <p className="text-[13px] leading-relaxed">
              A sanctuary of calm in Bacolod.
            </p>
            <div className="flex items-center gap-2.5 mt-3">
              {SOCIALS.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#163A2B] text-[#9AA89A] hover:text-[#C8A96B] hover:bg-[#1D4A35] transition-colors duration-300"
                >
                  <s.icon className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#C8A96B] mb-3">
              Quick Links
            </h4>
            <ul className="grid grid-cols-2 gap-x-8 gap-y-2">
              {QUICK_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[13px] text-[#9AA89A] hover:text-[#C8A96B] transition-colors duration-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom line */}
        <div className="mt-8 pt-5 border-t border-[#163A2B]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-[11px] text-[#6B7A6F]">
              {hoursText}
            </p>
            <p className="text-[11px] text-[#6B7A6F]">
              &copy; {new Date().getFullYear()} Cradle Massage & Wellness Spa. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
