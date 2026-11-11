"use client";

import { usePathname } from "next/navigation";
import { Home, Map, MoreHorizontal, QrCode, Truck } from "lucide-react";
import { StaffBottomNav } from "@/components/features/staff-pwa/bottom-nav";
import type { StaffNavItem } from "@/components/features/staff-pwa/types";

type DriverMobileBottomNavProps = {
  isProfileOpen?: boolean;
  onProfileOpen?: () => void;
  mode?: "canonical" | "driver" | "staff_portal";
};

export function getDriverBottomNavItems(
  effectiveMode: "canonical" | "driver" | "staff_portal"
): StaffNavItem[] {
  const homeHref =
    effectiveMode === "canonical"
      ? "/staff/driver"
      : effectiveMode === "driver"
      ? "/driver"
      : "/staff-portal";

  const tripsHref =
    effectiveMode === "canonical"
      ? "/staff/driver/trips"
      : effectiveMode === "driver"
      ? "/driver/dispatch"
      : "/staff-portal/dispatch";

  const scanHref =
    effectiveMode === "canonical"
      ? "/staff/scan"
      : "/scan";

  const mapHref =
    effectiveMode === "canonical"
      ? "/staff/driver/map"
      : effectiveMode === "driver"
      ? "/driver/map"
      : "/staff-portal/map";

  const moreHref =
    effectiveMode === "canonical"
      ? "/staff/driver/more"
      : effectiveMode === "driver"
      ? "/driver/more"
      : "/staff-portal/more";

  // Canonical driver reuses the shared staff PWA navigation, not a new shell.
  // Legacy driver/portal routes are intentionally unchanged.
  if (effectiveMode === "canonical") return [
    { key: "trips", label: "Trips", href: homeHref, icon: Truck },
    { key: "scan", label: "QR Scanner", href: scanHref, icon: QrCode, isScan: true },
    { key: "navigation", label: "Navigation", href: mapHref, icon: Map },
    { key: "more", label: "More", href: moreHref, icon: MoreHorizontal },
  ];

  return [
    {
      key: "today",
      label: "Today",
      href: homeHref,
      icon: Home,
    },
    {
      key: "trips",
      label: "Trips",
      href: tripsHref,
      icon: Truck,
    },
    {
      key: "scan",
      label: "Scan",
      href: scanHref,
      icon: QrCode,
      isScan: true,
    },
    {
      key: "map",
      label: "Map",
      href: mapHref,
      icon: Map,
    },
    {
      key: "more",
      label: "More",
      href: moreHref,
      icon: MoreHorizontal,
    },
  ];
}

export function DriverMobileBottomNav({
  isProfileOpen = false,
  onProfileOpen,
  mode,
}: DriverMobileBottomNavProps) {
  const pathname = usePathname();
  const effectiveMode =
    mode ??
    (pathname?.startsWith("/staff")
      ? "canonical"
      : pathname?.startsWith("/driver")
      ? "driver"
      : "staff_portal");

  const items = getDriverBottomNavItems(effectiveMode);

  return (
    <StaffBottomNav
      items={items}
      activeKey={effectiveMode === "canonical" && pathname?.startsWith("/staff/driver/trips") ? "trips" : undefined}
      ariaLabel="Driver portal navigation"
    />
  );
}
