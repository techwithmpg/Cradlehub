"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Sparkles, CalendarDays, MapPin, Phone } from "lucide-react";

const NAV_ITEMS = [
  { label: "Home",     href: "/",         icon: Home },
  { label: "Services", href: "/services",  icon: Sparkles },
  { label: "Book",     href: "/book",      icon: CalendarDays },
  { label: "Branches", href: "/branches",  icon: MapPin },
  { label: "Contact",  href: "/contact",   icon: Phone },
] as const;

// Routes where the bottom nav should be hidden (booking wizard has its own Continue button)
const HIDDEN_PATHS = ["/book/", "/book?"];

export function PublicBottomNav() {
  const pathname = usePathname();

  // Hide on booking wizard sub-pages
  const isBookingFlow =
    pathname.startsWith("/book/") ||
    (pathname !== "/book" && pathname.startsWith("/book"));

  if (isBookingFlow) return null;

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{
        background:  "#10261D",
        borderTop:   "1px solid rgba(200,169,107,0.18)",
        boxShadow:   "0 -4px 24px rgba(16,38,29,0.35)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="grid grid-cols-5">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(href + "/");

          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-1 py-2.5 transition-colors"
              style={{
                color: isActive ? "#C8A96B" : "rgba(252,250,245,0.50)",
              }}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                aria-hidden="true"
                className="h-5 w-5 shrink-0"
                strokeWidth={isActive ? 2.2 : 1.75}
              />
              <span
                className="text-[9.5px] font-semibold tracking-wide"
                style={{
                  fontFamily: "var(--sp-font-body, sans-serif)",
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
