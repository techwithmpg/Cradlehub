"use client";

import { usePathname } from "next/navigation";
import { Home, Map, Plus, Truck, User } from "lucide-react";
import {
  FloatingMobileBottomNav,
  type FloatingMobileNavItem,
} from "@/components/features/mobile-shell/floating-mobile-bottom-nav";

type DriverMobileBottomNavProps = {
  isProfileOpen?: boolean;
  onProfileOpen: () => void;
};

function HomeIcon({ className }: { className?: string }) {
  return <Home className={className} />;
}

function TripsIcon({ className }: { className?: string }) {
  return <Truck className={className} />;
}

function MapIcon({ className }: { className?: string }) {
  return <Map className={className} />;
}

function ProfileIcon({ className }: { className?: string }) {
  return <User className={className} />;
}

function JobsActionIcon({ className }: { className?: string }) {
  return <Plus className={className} />;
}

export function DriverMobileBottomNav({
  isProfileOpen = false,
  onProfileOpen,
}: DriverMobileBottomNavProps) {
  const pathname = usePathname();
  const isStandaloneDriver = pathname.startsWith("/driver");
  const homeHref = isStandaloneDriver ? "/driver" : "/staff-portal";
  const tripsHref = isStandaloneDriver ? "/driver/dispatch" : "/staff-portal/dispatch";
  const mapHref = isStandaloneDriver ? "/driver/map" : "/staff-portal/map";
  const jobsHref = isStandaloneDriver ? "/driver/jobs" : "/staff-portal/jobs";
  const profileActive = isProfileOpen || pathname.startsWith("/staff-portal/profile");

  const items: FloatingMobileNavItem[] = [
    {
      label: "Home",
      href: homeHref,
      icon: HomeIcon,
      active: pathname === homeHref,
    },
    {
      label: "Trips",
      href: tripsHref,
      icon: TripsIcon,
      active: pathname.startsWith(tripsHref),
    },
    {
      label: "Map",
      href: mapHref,
      icon: MapIcon,
      active: pathname.startsWith(mapHref),
    },
    {
      label: "Profile",
      ariaLabel: "Open profile",
      icon: ProfileIcon,
      active: profileActive,
      onClick: onProfileOpen,
    },
  ];

  return (
    <FloatingMobileBottomNav
      items={items}
      centerAction={{
        label: "Jobs",
        icon: JobsActionIcon,
        href: jobsHref,
        active: pathname.startsWith(jobsHref),
      }}
      ariaLabel="Driver portal navigation"
    />
  );
}
