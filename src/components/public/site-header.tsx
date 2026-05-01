"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/#testimonials", label: "Testimonials" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const isHome = pathname === "/";
  const isHeroMode = !scrolled && isHome;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setMobileOpen(false), 0);
    return () => clearTimeout(id);
  }, [pathname]);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? "bg-[#FCFAF5]/95 backdrop-blur-md shadow-[0_1px_20px_rgba(22,58,43,0.06)]"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 lg:px-12 py-5">
          {/* Logo */}
          <Link href="/" aria-label="Cradle Wellness Living" className="group flex items-center">
            <BrandLogo
              size="md"
              className="w-32 sm:w-36 md:w-44 lg:w-52 transition-opacity duration-500 group-hover:opacity-85"
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative text-[11px] font-semibold tracking-widest uppercase transition-colors duration-300 ${
                  pathname === link.href.split("#")[0]
                    ? isHeroMode
                      ? "text-white"
                      : "text-[#163A2B]"
                    : isHeroMode
                    ? "text-white/65 hover:text-white"
                    : "text-[#6B7A6F] hover:text-[#163A2B]"
                }`}
              >
                {link.label}
                {pathname === link.href.split("#")[0] && (
                  <span className="absolute -bottom-1.5 left-0 right-0 h-[1.5px] bg-[#C8A96B] rounded-full" />
                )}
              </Link>
            ))}
          </nav>

          {/* CTA + Mobile Toggle */}
          <div className="flex items-center gap-4">
            <Link
              href="/book"
              className="hidden md:inline-flex items-center rounded-full px-6 py-2.5 text-[12px] font-semibold tracking-widest uppercase transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
              style={{
                background: "linear-gradient(135deg, #C8A96B, #B68A3C)",
                color: "#10261D",
                boxShadow: isHeroMode
                  ? "0 4px 20px rgba(200,169,107,0.45)"
                  : "0 4px 16px rgba(200,169,107,0.35)",
              }}
            >
              Book Appointment
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className={`md:hidden flex h-10 w-10 items-center justify-center rounded-full border transition-colors duration-300 ${
                isHeroMode
                  ? "border-white/30 text-white hover:bg-white/10"
                  : "border-[#EDE4D3] text-[#163A2B] hover:bg-[#EDE4D3]"
              }`}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 md:hidden ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="absolute inset-0 bg-[#10261D]/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        <div
          className={`absolute right-0 top-0 h-full w-70 bg-[#FCFAF5] shadow-2xl transition-transform duration-500 [transition-timing-function:cubic-bezier(0.25,0.46,0.45,0.94)] ${
            mobileOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col p-8 pt-24">
            <nav className="flex flex-col gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-lg font-medium transition-colors ${
                    pathname === link.href.split("#")[0] ? "text-[#163A2B]" : "text-[#6B7A6F] hover:text-[#163A2B]"
                  }`}
                  style={{ fontFamily: "var(--sp-font-display)" }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto">
              <Link
                href="/book"
                className="flex w-full items-center justify-center rounded-full px-6 py-3 text-[12px] font-semibold tracking-widest uppercase"
                style={{
                  background: "linear-gradient(135deg, #C8A96B, #B68A3C)",
                  color: "#10261D",
                }}
              >
                Book Appointment
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
