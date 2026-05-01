import Link from "next/link";
import { Phone, MapPin, Clock } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";

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

export function SiteFooter() {
  return (
    <footer className="bg-[#10261D] text-[#9AA89A]">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">

          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="inline-flex mb-6 hover:opacity-85 transition-opacity duration-300">
              <BrandLogo size="md" className="w-44 md:w-56" />
            </Link>
            <p className="text-[13px] leading-relaxed max-w-xs">
              A sanctuary of calm where skilled hands and natural therapies guide you back to balance.
            </p>

            {/* Social icons */}
            <div className="flex items-center gap-3 mt-6">
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
            <h4 className="text-[12px] font-semibold tracking-[0.15em] uppercase text-[#C8A96B] mb-5">
              Explore
            </h4>
            <ul className="flex flex-col gap-3">
              {[
                { href: "/", label: "Home" },
                { href: "/about", label: "About Us" },
                { href: "/services", label: "Services" },
                { href: "/book", label: "Book Now" },
                { href: "/contact", label: "Contact" },
              ].map((link) => (
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

          {/* Locations & Contact */}
          <div>
            <h4 className="text-[12px] font-semibold tracking-[0.15em] uppercase text-[#C8A96B] mb-5">
              Contact
            </h4>
            <ul className="flex flex-col gap-4">
              <li className="flex items-start gap-3 text-[13px]">
                <Phone className="h-4 w-4 mt-0.5 text-[#C8A96B] shrink-0" />
                <div className="flex flex-col gap-1">
                  <a
                    href="tel:+639177077070"
                    className="hover:text-[#C8A96B] transition-colors"
                  >
                    0917 707 7070
                  </a>
                  <a
                    href="tel:+639090087815"
                    className="hover:text-[#C8A96B] transition-colors"
                  >
                    0909 008 7815
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3 text-[13px]">
                <MapPin className="h-4 w-4 mt-0.5 text-[#C8A96B] shrink-0" />
                <a
                  href="https://maps.google.com/?q=3rd+Floor+North+Wing+SM+City+Bacolod"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#C8A96B] transition-colors leading-relaxed"
                >
                  3rd Floor, North Wing,<br />SM City Bacolod
                </a>
              </li>
              <li className="flex items-start gap-3 text-[13px]">
                <MapPin className="h-4 w-4 mt-0.5 text-[#C8A96B] shrink-0" />
                <a
                  href="https://maps.google.com/?q=PX26+XQ+Bacolod+Negros+Occidental"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#C8A96B] transition-colors leading-relaxed"
                >
                  3rd Floor, La Luz Bldg Lacson,<br />National Highway, Bacolod
                </a>
              </li>
            </ul>
          </div>

          {/* Hours */}
          <div>
            <h4 className="text-[12px] font-semibold tracking-[0.15em] uppercase text-[#C8A96B] mb-5">
              Hours
            </h4>
            <ul className="flex flex-col gap-3">
              <li className="flex items-start gap-3 text-[13px]">
                <Clock className="h-4 w-4 mt-0.5 text-[#C8A96B] shrink-0" />
                <div>
                  <p className="text-[#FCFAF5]">Open Daily</p>
                  <p>10:00 AM – 10:00 PM</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-[#163A2B]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[12px] text-[#6B7A6F]">
              &copy; {new Date().getFullYear()} Cradle Massage & Wellness Spa. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              {SOCIALS.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="text-[12px] text-[#6B7A6F] hover:text-[#C8A96B] transition-colors flex items-center gap-1.5"
                >
                  <s.icon className="h-3.5 w-3.5" />
                  <span>{s.icon === IconFacebook ? "Facebook" : s.label === "Instagram" ? "Instagram" : "IG · SM Bacolod"}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
