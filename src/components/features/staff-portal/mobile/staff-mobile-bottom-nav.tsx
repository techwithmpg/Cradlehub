"use client";

import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardList, Home, Plus, User } from "lucide-react";
import {
  FloatingMobileBottomNav,
  type FloatingMobileNavItem,
} from "@/components/features/mobile-shell/floating-mobile-bottom-nav";

function HomeIcon({ className }: { className?: string }) {
  return <Home className={className} />;
}

function ScheduleIcon({ className }: { className?: string }) {
  return <CalendarDays className={className} />;
}

function TodayIcon({ className }: { className?: string }) {
  return <ClipboardList className={className} />;
}

function ProfileIcon({ className }: { className?: string }) {
  return <User className={className} />;
}

function PlusIcon({ className }: { className?: string }) {
  return <Plus className={className} />;
}

const MORE_MATCH_PATHS = [
  "/staff-portal/more",
  "/staff-portal/profile",
  "/staff-portal/attendance",
  "/staff-portal/notifications",
  "/staff-portal/settings",
];

export function StaffMobileBottomNav() {
  const pathname = usePathname();
  const items: FloatingMobileNavItem[] = [
    {
      label: "Home",
      href: "/staff-portal",
      icon: HomeIcon,
      active: pathname === "/staff-portal",
    },
    {
      label: "Schedule",
      href: "/staff-portal/schedule",
      icon: ScheduleIcon,
      active: pathname.startsWith("/staff-portal/schedule") || pathname.startsWith("/staff-portal/week"),
    },
    {
      label: "Today",
      href: "/staff-portal/today",
      icon: TodayIcon,
      active: pathname.startsWith("/staff-portal/today"),
    },
    {
      label: "Profile",
      href: "/staff-portal/more",
      icon: ProfileIcon,
      active: MORE_MATCH_PATHS.some((path) => pathname.startsWith(path)),
    },
  ];

  return (
    <FloatingMobileBottomNav
      items={items}
      centerAction={{ label: "Action", icon: PlusIcon, href: "/staff-portal/today" }}
      ariaLabel="Staff portal navigation"
    />
  );
}
