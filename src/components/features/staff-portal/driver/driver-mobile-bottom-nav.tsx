"use client";

import { usePathname } from "next/navigation";
import { Home, Map, MapPin, Truck, User } from "lucide-react";
import {
  FloatingMobileBottomNav,
  type FloatingMobileNavItem,
} from "@/components/features/mobile-shell/floating-mobile-bottom-nav";

type DriverMobileBottomNavProps = {
  profileOpen: boolean;
  onProfileClick: () => void;
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

function UpdateIcon({ className }: { className?: string }) {
  return <MapPin className={className} />;
}

export function DriverMobileBottomNav({
  profileOpen,
  onProfileClick,
}: DriverMobileBottomNavProps) {
  const pathname = usePathname();
  const isStandaloneDriver = pathname.startsWith("/driver");
  const homeHref = isStandaloneDriver ? "/driver" : "/staff-portal";
  const tripsHref = isStandaloneDriver ? "/driver/dispatch" : "/staff-portal/dispatch";
  const mapHref = isStandaloneDriver ? "/driver/map" : "/staff-portal/map";
  const updateHref = isStandaloneDriver ? "/driver/dispatch" : "/staff-portal/jobs/active";
  const profileActive = profileOpen || pathname.startsWith("/staff-portal/profile");

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
      icon: ProfileIcon,
      active: profileActive,
      onClick: onProfileClick,
    },
  ];

  return (
    <FloatingMobileBottomNav
      items={items}
      centerAction={{ label: "Update", icon: UpdateIcon, href: updateHref }}
      ariaLabel="Driver portal navigation"
    />
  );
}
