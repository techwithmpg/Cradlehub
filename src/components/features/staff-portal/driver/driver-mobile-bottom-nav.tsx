"use client";

import { usePathname } from "next/navigation";
import { Home, Map, MoreHorizontal, QrCode, Truck } from "lucide-react";
import { StaffBottomNav } from "@/components/features/staff-pwa/bottom-nav";
import type { StaffNavItem } from "@/components/features/staff-pwa/types";

type DriverMobileBottomNavProps = {
  isProfileOpen?: boolean;
  onProfileOpen?: () => void;
};

export function DriverMobileBottomNav({
  isProfileOpen = false,
  onProfileOpen,
}: DriverMobileBottomNavProps) {
  const pathname = usePathname();
  const isStandaloneDriver = pathname.startsWith("/driver");
  const homeHref = isStandaloneDriver ? "/driver" : "/staff-portal";
  const tripsHref = isStandaloneDriver ? "/driver/dispatch" : "/staff-portal/dispatch";
  const mapHref = isStandaloneDriver ? "/driver/map" : "/staff-portal/map";
  const moreHref = isStandaloneDriver ? "/driver/more" : "/staff-portal/more";

  const items: StaffNavItem[] = [
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
      href: "/scan",
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

  return (
    <StaffBottomNav
      items={items}
      ariaLabel="Driver portal navigation"
    />
  );
}
