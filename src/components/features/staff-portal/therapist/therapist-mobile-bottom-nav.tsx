"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Stethoscope,
  TrendingUp,
  MoreHorizontal,
} from "lucide-react";

// Paths that activate the More tab
const MORE_MATCH_PATHS = [
  "/staff-portal/more",
  "/staff-portal/profile",
  "/staff-portal/notifications",
  "/staff-portal/settings",
];

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  exact?: boolean;
  matchPaths?: string[];
};

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/staff-portal", icon: LayoutDashboard, exact: true },
  { label: "Schedule", href: "/staff-portal/schedule", icon: CalendarDays },
  {
    label: "Service",
    href: "/staff-portal/service-progress",
    icon: Stethoscope,
  },
  { label: "Stats", href: "/staff-portal/stats", icon: TrendingUp },
  {
    label: "More",
    href: "/staff-portal/more",
    icon: MoreHorizontal,
    matchPaths: MORE_MATCH_PATHS,
  },
];

export function TherapistMobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backgroundColor: "#fff",
        borderTop: "1px solid var(--cs-border-soft)",
        display: "flex",
        paddingBottom: "env(safe-area-inset-bottom, 0)",
      }}
      aria-label="Therapist portal navigation"
    >
      {NAV_ITEMS.map(({ label, href, icon: Icon, exact, matchPaths }) => {
        const isActive = matchPaths
          ? matchPaths.some((p) => pathname.startsWith(p))
          : exact
          ? pathname === href
          : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              padding: "0.5rem 0 0.625rem",
              minHeight: 56,
              textDecoration: "none",
              color: isActive ? "var(--cs-staff-accent)" : "var(--cs-text-muted)",
              fontSize: 10,
              fontWeight: isActive ? 700 : 500,
              letterSpacing: "0.01em",
              transition: "color 120ms ease",
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
