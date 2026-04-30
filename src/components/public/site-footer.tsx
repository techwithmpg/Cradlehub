import Link from "next/link";
import { Leaf, Phone, Mail, MapPin, Clock } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="bg-[#10261D] text-[#9AA89A]">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#163A2B] text-[#C8A96B]">
                <Leaf className="h-5 w-5" />
              </div>
              <div className="flex flex-col leading-none">
                <span
                  className="text-[15px] font-semibold tracking-wide text-[#FCFAF5]"
                  style={{ fontFamily: "var(--sp-font-display)" }}
                >
                  Cradle
                </span>
                <span className="text-[10px] tracking-[0.12em] uppercase text-[#9AA89A]">
                  Massage & Wellness
                </span>
              </div>
            </Link>
            <p className="text-[13px] leading-relaxed max-w-xs">
              A sanctuary of calm where skilled hands and natural therapies guide you back to balance.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4
              className="text-[12px] font-semibold tracking-[0.15em] uppercase text-[#C8A96B] mb-5"
              style={{ fontFamily: "var(--sp-font-body)" }}
            >
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

          {/* Contact */}
          <div>
            <h4
              className="text-[12px] font-semibold tracking-[0.15em] uppercase text-[#C8A96B] mb-5"
              style={{ fontFamily: "var(--sp-font-body)" }}
            >
              Contact
            </h4>
            <ul className="flex flex-col gap-3">
              <li className="flex items-start gap-3 text-[13px]">
                <Phone className="h-4 w-4 mt-0.5 text-[#C8A96B] shrink-0" />
                <span>+63 (34) 123 4567</span>
              </li>
              <li className="flex items-start gap-3 text-[13px]">
                <Mail className="h-4 w-4 mt-0.5 text-[#C8A96B] shrink-0" />
                <span>hello@cradlespa.com</span>
              </li>
              <li className="flex items-start gap-3 text-[13px]">
                <MapPin className="h-4 w-4 mt-0.5 text-[#C8A96B] shrink-0" />
                <span>Bacolod City, Negros Occidental, Philippines</span>
              </li>
            </ul>
          </div>

          {/* Hours */}
          <div>
            <h4
              className="text-[12px] font-semibold tracking-[0.15em] uppercase text-[#C8A96B] mb-5"
              style={{ fontFamily: "var(--sp-font-body)" }}
            >
              Hours
            </h4>
            <ul className="flex flex-col gap-3">
              <li className="flex items-start gap-3 text-[13px]">
                <Clock className="h-4 w-4 mt-0.5 text-[#C8A96B] shrink-0" />
                <div>
                  <p className="text-[#FCFAF5]">Mon – Sat</p>
                  <p>9:00 AM – 9:00 PM</p>
                </div>
              </li>
              <li className="flex items-start gap-3 text-[13px]">
                <Clock className="h-4 w-4 mt-0.5 text-[#C8A96B] shrink-0" />
                <div>
                  <p className="text-[#FCFAF5]">Sunday</p>
                  <p>10:00 AM – 6:00 PM</p>
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
            <div className="flex items-center gap-6">
              {["Facebook", "Instagram", "TikTok"].map((social) => (
                <span
                  key={social}
                  className="text-[12px] text-[#6B7A6F] hover:text-[#C8A96B] transition-colors cursor-pointer"
                >
                  {social}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
