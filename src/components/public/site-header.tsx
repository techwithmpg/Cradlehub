"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Phone } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { publicPhones } from "@/lib/public/public-site-data";

const navLinks = [
  { href: "/",          label: "Home" },
  { href: "/services",  label: "Services" },
  { href: "/book",      label: "Book" },
  { href: "/branches",  label: "Branches" },
  { href: "/about",     label: "About" },
  { href: "/contact",   label: "Contact" },
];

export function SiteHeader() {
  const [scrolled,    setScrolled]    = useState(false);
  const [mobileOpen, setMobileOpen]  = useState(false);
  const pathname = usePathname();

  const isHome      = pathname === "/";
  const isHeroMode  = !scrolled && isHome; // desktop-only transparent hero mode

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close drawer on navigation
  useEffect(() => {
    const id = setTimeout(() => setMobileOpen(false), 0);
    return () => clearTimeout(id);
  }, [pathname]);

  const primaryPhone = publicPhones[0];

  return (
    <>
      <header
        className={[
          // Mobile: always dark green, fixed, safe-area aware
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
          // Mobile bg: always dark forest green
          "bg-[#10261D]",
          // Desktop override: transparent on homepage hero, cream when scrolled
          isHeroMode
            ? "md:bg-transparent"
            : scrolled
            ? "md:bg-[#FCFAF5]/95 md:backdrop-blur-md md:shadow-[0_1px_20px_rgba(22,58,43,0.06)]"
            : "md:bg-[#10261D]",
        ].join(" ")}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        {/* ── Mobile header layout ─────────────────────────────── */}
        <div className="md:hidden flex items-center justify-between px-4 h-14">
          {/* Left: hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/80 hover:bg-white/10 transition-colors"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          </button>

          {/* Center: logo */}
          <Link href="/" aria-label="Cradle Wellness Spa — Home" className="absolute left-1/2 -translate-x-1/2">
            <BrandLogo size="sm" variant="dark" className="w-28" />
          </Link>

          {/* Right: call button */}
          {primaryPhone && (
            <a
              href={primaryPhone.href}
              aria-label={`Call ${primaryPhone.label}`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#C8A96B]/60 text-[#C8A96B] hover:bg-[#C8A96B]/10 transition-colors"
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
        </div>

        {/* ── Desktop header layout ─────────────────────────────── */}
        <div className="hidden md:flex mx-auto max-w-7xl items-center justify-between px-6 lg:px-12 py-5">
          {/* Logo */}
          <Link href="/" aria-label="Cradle Wellness Living" className="group flex items-center">
            <BrandLogo
              size="md"
              variant={isHeroMode ? "dark" : scrolled ? "light" : "dark"}
              className="w-32 sm:w-36 md:w-44 lg:w-52 group-hover:opacity-85"
            />
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-8">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={[
                    "relative text-[11px] font-semibold tracking-widest uppercase transition-colors duration-300",
                    isActive
                      ? isHeroMode
                        ? "text-white"
                        : "text-[#163A2B]"
                      : isHeroMode
                      ? "text-white/65 hover:text-white"
                      : scrolled
                      ? "text-[#6B7A6F] hover:text-[#163A2B]"
                      : "text-white/65 hover:text-white",
                  ].join(" ")}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute -bottom-1.5 left-0 right-0 h-[1.5px] bg-[#C8A96B] rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* CTA */}
          <Link
            href="/book"
            className="inline-flex items-center rounded-full px-6 py-2.5 text-[12px] font-semibold tracking-widest uppercase transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
            style={{
              background:  "linear-gradient(135deg, #C8A96B, #B68A3C)",
              color:       "#10261D",
              boxShadow:   isHeroMode
                ? "0 4px 20px rgba(200,169,107,0.45)"
                : "0 4px 16px rgba(200,169,107,0.35)",
            }}
          >
            Book Appointment
          </Link>
        </div>
      </header>

      {/* ── Mobile full-screen drawer ──────────────────────────── */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 md:hidden ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className="absolute inset-0 bg-[#10261D]/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={`absolute left-0 top-0 h-full w-72 bg-[#10261D] shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="flex h-full flex-col px-6 pt-16 pb-8">
            {/* Close button + Logo */}
            <div className="flex items-center justify-between mb-8">
              <BrandLogo size="sm" variant="dark" className="w-28" />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
              {navLinks.map((link) => {
                const isActive =
                  link.href === "/"
                    ? pathname === "/"
                    : pathname === link.href || pathname.startsWith(link.href + "/");
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={[
                      "flex items-center rounded-xl px-4 py-3.5 text-[16px] font-medium transition-colors",
                      isActive
                        ? "bg-white/10 text-[#C8A96B]"
                        : "text-white/75 hover:bg-white/8 hover:text-white",
                    ].join(" ")}
                    style={{ fontFamily: "var(--sp-font-body)" }}
                  >
                    {link.label}
                    {isActive && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#C8A96B]" />
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto space-y-3 pt-6">
              <Link
                href="/book"
                className="flex w-full items-center justify-center rounded-full px-6 py-3.5 text-[12px] font-semibold tracking-widest uppercase"
                style={{
                  background: "linear-gradient(135deg, #C8A96B, #B68A3C)",
                  color:      "#10261D",
                }}
              >
                Book Appointment
              </Link>
              {primaryPhone && (
                <a
                  href={primaryPhone.href}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 px-6 py-3.5 text-[12px] font-medium text-white/80 hover:bg-white/5 transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  {primaryPhone.label}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
