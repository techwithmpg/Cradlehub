"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Leaf } from "lucide-react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

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
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#163A2B] text-[#C8A96B] transition-transform duration-300 group-hover:scale-105">
              <Leaf className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-none">
              <span
                className="text-[15px] font-semibold tracking-wide"
                style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
              >
                Cradle
              </span>
              <span className="text-[10px] tracking-[0.12em] uppercase" style={{ color: "#6B7A6F" }}>
                Massage & Wellness
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative text-[13px] font-medium tracking-wide transition-colors duration-300 ${
                  pathname === link.href ? "text-[#163A2B]" : "text-[#6B7A6F] hover:text-[#163A2B]"
                }`}
              >
                {link.label}
                {pathname === link.href && (
                  <span className="absolute -bottom-1 left-0 right-0 h-[1.5px] bg-[#C8A96B] rounded-full" />
                )}
              </Link>
            ))}
          </nav>

          {/* CTA + Mobile Toggle */}
          <div className="flex items-center gap-4">
            <Link
              href="/book"
              className="hidden md:inline-flex items-center rounded-full px-6 py-2.5 text-[12px] font-semibold tracking-widest uppercase transition-all duration-300 hover:shadow-lg"
              style={{
                background: "linear-gradient(135deg, #C8A96B, #B68A3C)",
                color: "#10261D",
                boxShadow: "0 4px 16px rgba(200,169,107,0.35)",
              }}
            >
              Book Appointment
            </Link>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden flex h-10 w-10 items-center justify-center rounded-full border border-[#EDE4D3] text-[#163A2B] transition-colors hover:bg-[#EDE4D3]"
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
          className={`absolute right-0 top-0 h-full w-[280px] bg-[#FCFAF5] shadow-2xl transition-transform duration-500 ${
            mobileOpen ? "translate-x-0" : "translate-x-full"
          }`}
          style={{ transitionTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)" }}
        >
          <div className="flex h-full flex-col p-8 pt-24">
            <nav className="flex flex-col gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-lg font-medium transition-colors ${
                    pathname === link.href ? "text-[#163A2B]" : "text-[#6B7A6F] hover:text-[#163A2B]"
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
