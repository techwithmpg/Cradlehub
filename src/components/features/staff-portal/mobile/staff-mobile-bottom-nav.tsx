"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  CalendarCheck,
  MoreHorizontal,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Home",         href: "/staff-portal",              icon: LayoutDashboard, exact: true },
  { label: "Schedule",     href: "/staff-portal/schedule",     icon: CalendarDays },
  { label: "Bookings",     href: "/staff-portal/week",         icon: ClipboardList },
  { label: "Availability", href: "/staff-portal/profile",      icon: CalendarCheck },
  { label: "More",         href: "/staff-portal/profile",      icon: MoreHorizontal },
];

export function StaffMobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position:        "fixed",
        bottom:          0,
        left:            0,
        right:           0,
        zIndex:          50,
        backgroundColor: "#fff",
        borderTop:       "1px solid var(--cs-border-soft)",
        display:         "flex",
        paddingBottom:   "env(safe-area-inset-bottom, 0)",
      }}
      aria-label="Staff portal navigation"
    >
      {NAV_ITEMS.map(({ label, href, icon: Icon, exact }) => {
        const isActive = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={label}
            href={href}
            style={{
              flex:           1,
              display:        "flex",
              flexDirection:  "column",
              alignItems:     "center",
              justifyContent: "center",
              gap:            3,
              padding:        "0.5rem 0 0.625rem",
              textDecoration: "none",
              color:          isActive ? "var(--cs-staff-accent)" : "var(--cs-text-muted)",
              fontSize:       10,
              fontWeight:     isActive ? 700 : 500,
              letterSpacing:  "0.01em",
              transition:     "color 120ms ease",
            }}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon size={22} strokeWidth={isActive ? 2 : 1.75} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
