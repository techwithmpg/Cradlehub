"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Home, MapPin, ShoppingBag, Sparkles } from "lucide-react";

const BOTTOM_NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/services", label: "Services", icon: Sparkles },
  { href: "/book", label: "Book", icon: Calendar },
  { href: "/products", label: "Boutique", icon: ShoppingBag },
  { href: "/branches", label: "Branches", icon: MapPin },
];

export function PublicBottomNav() {
  const pathname = usePathname() || "/";

  // Keep /book free so the booking wizard's sticky action footer has full viewport priority.
  if (pathname.startsWith("/book")) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] lg:hidden">
      <nav
        aria-label="Mobile quick navigation"
        className="pointer-events-auto grid w-full max-w-md grid-cols-5 items-center rounded-2xl border border-[#C8A96B]/25 bg-[#10261D]/95 px-1.5 py-1.5 shadow-[0_12px_32px_-8px_rgba(16,38,29,0.55)] backdrop-blur-md"
      >
        {BOTTOM_NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10px] tracking-wide transition focus-visible:outline-2 focus-visible:outline-[#D4B57A] ${
                active
                  ? "bg-[#163A2B] font-semibold text-[#E8D5A3]"
                  : "font-medium text-[#B9C4BC] hover:text-[#FAF5E9]"
              }`}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0.5 h-0.5 w-6 rounded-full bg-[#D4B57A]"
                />
              )}
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
