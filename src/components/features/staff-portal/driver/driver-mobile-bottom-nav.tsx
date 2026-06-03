"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ElementType } from "react";
import { LayoutDashboard, Truck, Map, BriefcaseBusiness, CircleUserRound } from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: ElementType;
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/staff-portal", icon: LayoutDashboard, exact: true },
  { label: "Dispatch", href: "/staff-portal/dispatch", icon: Truck },
  { label: "Map", href: "/staff-portal/map", icon: Map },
  { label: "Jobs", href: "/staff-portal/jobs", icon: BriefcaseBusiness },
];

type DriverMobileBottomNavProps = {
  profileOpen: boolean;
  onProfileClick: () => void;
};

export function DriverMobileBottomNav({ profileOpen, onProfileClick }: DriverMobileBottomNavProps) {
  const pathname = usePathname();
  const profileActive = profileOpen || pathname.startsWith("/staff-portal/profile");

  return (
    <nav
      className="md:hidden"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backgroundColor: "#fff",
        borderTop: "1px solid var(--cs-border-soft)",
        display: "flex",
        minHeight: 60,
        paddingBottom: "env(safe-area-inset-bottom, 0)",
      }}
      aria-label="Driver portal navigation"
    >
      {NAV_ITEMS.map(({ label, href, icon: Icon, exact }) => {
        const isActive = exact
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
      <button
        type="button"
        onClick={onProfileClick}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          padding: "0.5rem 0 0.625rem",
          minHeight: 56,
          border: 0,
          background: "transparent",
          color: profileActive ? "var(--cs-staff-accent)" : "var(--cs-text-muted)",
          cursor: "pointer",
          fontSize: 10,
          fontWeight: profileActive ? 700 : 500,
          letterSpacing: "0.01em",
          transition: "color 120ms ease",
        }}
        aria-pressed={profileActive}
      >
        <CircleUserRound size={22} strokeWidth={profileActive ? 2 : 1.75} aria-hidden="true" />
        Profile
      </button>
    </nav>
  );
}
