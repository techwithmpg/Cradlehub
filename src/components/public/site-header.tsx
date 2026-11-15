"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  ChevronDown,
  Menu,
  Phone,
  Search,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { useBoutiqueCart } from "@/components/public/boutique-cart-context";

type SiteHeaderProps = {
  primaryPhone?: string | null;
  logoUrl?: string | null;
  logoAlt?: string | null;
};

const SERVICE_SUBMENU_LINKS = [
  { href: "/services", label: "All Services", description: "Complete spa & beauty menu" },
  {
    href: "/services?category=Massage%20Services",
    label: "Massage Services",
    description: "Hilot, deep tissue & aromatherapy",
  },
  {
    href: "/services?category=Skin%20Care%20Services",
    label: "Facial & Skin Care",
    description: "Restorative glowing facials",
  },
  {
    href: "/services?category=Salon%20Services",
    label: "Salon & Nail Care",
    description: "Hair, scalp, manicure & pedicure",
  },
  {
    href: "/services?category=Divine%20Renewal%20Packages",
    label: "Wellness Packages",
    description: "Curated multi-treatment rituals",
  },
  {
    href: "/home-service-massage-bacolod",
    label: "Home Service",
    description: "Spa-grade therapist at your home",
  },
];

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services", hasDropdown: true },
  { href: "/products", label: "Boutique" },
  { href: "/branches", label: "Branches" },
  { href: "/about", label: "About" },
];

function isRouteActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({ primaryPhone, logoUrl, logoAlt }: SiteHeaderProps) {
  const pathname = usePathname() || "/";
  const { totalCount, openCart, openSearch } = useBoutiqueCart();

  const [servicesOpenPath, setServicesOpenPath] = useState<string | null>(null);
  const [mobileOpenPath, setMobileOpenPath] = useState<string | null>(null);
  const servicesOpen = servicesOpenPath === pathname;
  const mobileOpen = mobileOpenPath === pathname;
  const setServicesOpen = (value: boolean | ((prev: boolean) => boolean)) => {
    setServicesOpenPath((prevPath) => {
      const prev = prevPath === pathname;
      const next = typeof value === "function" ? value(prev) : value;
      return next ? pathname : null;
    });
  };
  const setMobileOpen = (value: boolean) => {
    setMobileOpenPath(value ? pathname : null);
  };

  const servicesWrapRef = useRef<HTMLDivElement>(null);
  const mobileDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!servicesOpenPath) return;
    function handleOutside(e: MouseEvent) {
      if (
        servicesWrapRef.current &&
        !servicesWrapRef.current.contains(e.target as Node)
      ) {
        setServicesOpenPath(null);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setServicesOpenPath(null);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [servicesOpenPath]);

  useEffect(() => {
    const dialog = mobileDialogRef.current;
    if (!dialog) return;
    if (mobileOpen) {
      if (!dialog.open && typeof dialog.showModal === "function") {
        dialog.showModal();
      }
    } else if (dialog.open && typeof dialog.close === "function") {
      dialog.close();
    }
  }, [mobileOpen]);

  const isBoutiqueRoute = pathname.startsWith("/products");
  const subtitleText = isBoutiqueRoute
    ? "THE CRADLEHUB BOUTIQUE"
    : "A WELLNESS SANCTUARY";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#C8A96B]/20 bg-[#10261D]/95 text-[#FAF5E9] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-[74px] lg:px-8">
        {/* Mobile Left Menu Trigger + Brand */}
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation-drawer"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-[#FAF5E9] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4B57A] lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <Link
            href="/"
            className="group flex min-w-0 items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4B57A]"
          >
            {logoUrl ? (
              <BrandLogo
                mode="horizontal"
                size="md"
                variant="dark"
                className="w-36 sm:w-44 lg:w-48 transition-opacity group-hover:opacity-90"
                customUrl={logoUrl}
                customAlt={logoAlt}
              />
            ) : (
              <>
                <BrandLogo
                  mode="mark"
                  size="sm"
                  variant="dark"
                  className="h-9 w-11 shrink-0 transition-transform duration-300 group-hover:scale-105 lg:h-10 lg:w-12"
                />
                <div className="min-w-0 leading-tight">
                  <span className="block truncate font-serif text-[17px] font-medium tracking-wide text-[#FAF5E9] [font-family:var(--sp-font-display)] sm:text-[19px]">
                    Cradle Wellness Living
                  </span>
                  <span className="block truncate text-[9px] font-medium tracking-[0.22em] text-[#D4B57A] uppercase sm:text-[10px]">
                    {subtitleText}
                  </span>
                </div>
              </>
            )}
          </Link>
        </div>

        {/* Desktop Single Primary Navigation */}
        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-7 lg:flex"
        >
          {NAV_LINKS.map((item) => {
            const active = isRouteActive(pathname, item.href);
            if (item.hasDropdown) {
              return (
                <div key={item.href} ref={servicesWrapRef} className="relative">
                  <div className="flex items-center gap-1">
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`inline-flex items-center gap-1 py-1.5 text-[14px] tracking-wide transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4B57A] ${
                        active
                          ? "border-b-2 border-[#D4B57A] font-semibold text-[#E8D5A3]"
                          : "border-b-2 border-transparent font-medium text-[#E5E2D7] hover:text-[#FAF5E9]"
                      }`}
                    >
                      {item.label}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setServicesOpen((prev) => !prev)}
                      aria-expanded={servicesOpen}
                      aria-controls="desktop-services-submenu"
                      aria-label="Toggle Services categories menu"
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[#C8A96B] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#D4B57A]"
                    >
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${
                          servicesOpen ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  {servicesOpen && (
                    <div
                      id="desktop-services-submenu"
                      className="absolute top-full left-0 z-50 mt-3 w-72 rounded-2xl border border-[#C8A96B]/25 bg-[#10261D] p-2.5 shadow-2xl"
                    >
                      {SERVICE_SUBMENU_LINKS.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          onClick={() => setServicesOpen(false)}
                          className="block rounded-xl px-3.5 py-2.5 transition hover:bg-[#1E4D3A]/80 focus-visible:outline-2 focus-visible:outline-[#D4B57A]"
                        >
                          <p className="text-[13px] font-semibold text-[#FAF5E9]">
                            {sub.label}
                          </p>
                          <p className="text-[11px] text-[#B7C2B9]">
                            {sub.description}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`py-1.5 text-[14px] tracking-wide transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4B57A] ${
                  active
                    ? "border-b-2 border-[#D4B57A] font-semibold text-[#E8D5A3]"
                    : "border-b-2 border-transparent font-medium text-[#E5E2D7] hover:text-[#FAF5E9]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Utility Actions & Primary Gold CTA */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={openSearch}
            aria-label="Open search"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-[#E5E2D7] transition hover:border-[#D4B57A]/60 hover:bg-white/10 hover:text-[#FAF5E9] focus-visible:outline-2 focus-visible:outline-[#D4B57A]"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={openCart}
            aria-label={`Open boutique cart${totalCount > 0 ? ` (${totalCount} items)` : ""}`}
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-[#E5E2D7] transition hover:border-[#D4B57A]/60 hover:bg-white/10 hover:text-[#FAF5E9] focus-visible:outline-2 focus-visible:outline-[#D4B57A]"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            {totalCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-[#D4B57A] px-1 text-[10px] font-bold text-[#10261D] shadow-xs">
                {totalCount}
              </span>
            )}
          </button>

          <Link
            href="/book"
            className="hidden items-center gap-2 rounded-full bg-[#D4B57A] px-5 py-2.5 text-[13px] font-semibold tracking-wide text-[#10261D] shadow-sm transition hover:bg-[#E0C38A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FAF5E9] sm:inline-flex"
          >
            <Calendar className="h-4 w-4" aria-hidden="true" />
            <span>Book an Appointment</span>
          </Link>
        </div>
      </div>

      {/* Native Top-Layer Modal Navigation Drawer for Mobile / Narrow Viewports */}
      <dialog
        id="mobile-navigation-drawer"
        ref={mobileDialogRef}
        aria-label="Mobile menu"
        onClose={() => setMobileOpen(false)}
        onClick={(e) => {
          if (e.target === mobileDialogRef.current) setMobileOpen(false);
        }}
        className="fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-dvh w-[min(86vw,21rem)] border-r border-[#C8A96B]/25 bg-[#10261D] p-0 text-[#FAF5E9] shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-xs open:flex open:flex-col"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <BrandLogo mode="mark" size="sm" variant="dark" className="h-9 w-11" />
            <div className="leading-tight">
              <p className="font-serif text-base font-medium text-[#FAF5E9] [font-family:var(--sp-font-display)]">
                Cradle Wellness
              </p>
              <p className="text-[9px] tracking-[0.2em] text-[#D4B57A] uppercase">
                Bacolod Sanctuary
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-[#E5E2D7] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#D4B57A]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto px-4 py-4">
          {[
            { href: "/", label: "Home" },
            { href: "/services", label: "Services & Rituals" },
            { href: "/products", label: "Boutique" },
            { href: "/branches", label: "Our Branches" },
            { href: "/about", label: "About Cradle" },
            { href: "/contact", label: "Contact Us" },
          ].map((item) => {
            const active = isRouteActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
                className={`flex min-h-[44px] items-center justify-between rounded-xl px-4 py-2.5 text-sm transition focus-visible:outline-2 focus-visible:outline-[#D4B57A] ${
                  active
                    ? "border-l-4 border-[#D4B57A] bg-[#163A2B] font-semibold text-[#E8D5A3]"
                    : "text-[#E5E2D7] hover:bg-white/5"
                }`}
              >
                <span>{item.label}</span>
                {active && (
                  <Sparkles className="h-3.5 w-3.5 text-[#D4B57A]" aria-hidden="true" />
                )}
              </Link>
            );
          })}
        </div>

        <div className="space-y-3 border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {primaryPhone && (
            <a
              href={`tel:${primaryPhone.replace(/[^+\d]/g, "")}`}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#C8A96B]/30 bg-[#163A2B]/70 px-4 py-2.5 text-xs font-medium text-[#E8D5A3]"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Call {primaryPhone}</span>
            </a>
          )}
          <Link
            href="/book"
            onClick={() => setMobileOpen(false)}
            className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-[#D4B57A] px-4 py-3 text-sm font-semibold text-[#10261D]"
          >
            <Calendar className="h-4 w-4" aria-hidden="true" />
            <span>Book an Appointment</span>
          </Link>
        </div>
      </dialog>
    </header>
  );
}
