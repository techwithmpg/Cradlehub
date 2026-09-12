import {
  Activity,
  Bell,
  CalendarDays,
  ClipboardList,
  MapPin,
  MoreHorizontal,
  QrCode,
  Sun,
  Truck,
} from "lucide-react";
import type {
  NavigationProfile,
  StaffNavItem,
  StaffOperationalRole,
} from "./types";
import { isFrontDeskRole, isServiceStaffType } from "@/constants/staff";

/**
 * 4 Frozen Navigation Profiles across 7 Staff Roles (PWA-C4 Section 4 & 5):
 *
 * 1. Provider (Therapist, Nail Tech, Aesthetician, Salon Head):
 *    Today · Schedule · Scan · Progress · More
 *
 * 2. CRM / General Staff:
 *    Today · Work · Scan · Notices · More
 *
 * 3. Utility:
 *    Today · Work · Scan · Notices · More
 *    (Work is retained as blocked/read-only notice)
 *
 * 4. Driver:
 *    Today · Trips · Scan · Map · More
 */

export const PROVIDER_NAV_ITEMS: StaffNavItem[] = [
  {
    key: "today",
    label: "Today",
    href: "/staff",
    icon: Sun,
  },
  {
    key: "schedule",
    label: "Schedule",
    href: "/staff/schedule",
    icon: CalendarDays,
  },
  {
    key: "scan",
    label: "Scan",
    href: "/staff/scan",
    icon: QrCode,
    isScan: true,
  },
  {
    key: "progress",
    label: "Progress",
    href: "/staff/progress",
    icon: Activity,
  },
  {
    key: "more",
    label: "More",
    href: "/staff/more",
    icon: MoreHorizontal,
  },
];

export const CRM_GENERAL_NAV_ITEMS: StaffNavItem[] = [
  {
    key: "today",
    label: "Today",
    href: "/staff",
    icon: Sun,
  },
  {
    key: "work",
    label: "Work",
    href: "/staff/work",
    icon: ClipboardList,
  },
  {
    key: "scan",
    label: "Scan",
    href: "/staff/scan",
    icon: QrCode,
    isScan: true,
  },
  {
    key: "notices",
    label: "Notices",
    href: "/staff/notices",
    icon: Bell,
  },
  {
    key: "more",
    label: "More",
    href: "/staff/more",
    icon: MoreHorizontal,
  },
];

export const UTILITY_NAV_ITEMS: StaffNavItem[] = [
  {
    key: "today",
    label: "Today",
    href: "/staff/utility",
    icon: Sun,
  },
  {
    key: "work",
    label: "Work",
    href: "/staff/utility/work",
    icon: ClipboardList,
    disabled: false,
  },
  {
    key: "scan",
    label: "Scan",
    href: "/staff/scan",
    icon: QrCode,
    isScan: true,
  },
  {
    key: "notices",
    label: "Notices",
    href: "/staff/utility/notices",
    icon: Bell,
  },
  {
    key: "more",
    label: "More",
    href: "/staff/utility/more",
    icon: MoreHorizontal,
  },
];

export const DRIVER_NAV_ITEMS: StaffNavItem[] = [
  {
    key: "today",
    label: "Today",
    href: "/staff/driver",
    icon: Sun,
  },
  {
    key: "trips",
    label: "Trips",
    href: "/staff/driver/trips",
    icon: Truck,
  },
  {
    key: "scan",
    label: "Scan",
    href: "/staff/scan",
    icon: QrCode,
    isScan: true,
  },
  {
    key: "map",
    label: "Map",
    href: "/staff/driver/map",
    icon: MapPin,
  },
  {
    key: "more",
    label: "More",
    href: "/staff/driver/more",
    icon: MoreHorizontal,
  },
];

export function resolveStaffOperationalRole(staff: {
  system_role: string;
  staff_type?: string | null;
}): StaffOperationalRole {
  const role = staff.system_role;
  const type = (staff.staff_type ?? "").toLowerCase();

  if (role === "driver" || type === "driver") return "driver";
  if (role === "utility" || type === "utility") return "utility";

  if (isServiceStaffType(type) || type === "facialist") {
    if (type === "nail_tech") return "nail_tech";
    if (type === "aesthetician" || type === "facialist") return "aesthetician";
    if (type === "salon_head") return "salon_head";
    return "therapist";
  }

  if (isFrontDeskRole(role)) return "crm_general";
  return "crm_general";
}

export function resolveNavigationProfile(
  role: StaffOperationalRole
): NavigationProfile {
  switch (role) {
    case "therapist":
    case "nail_tech":
    case "aesthetician":
    case "salon_head":
      return "provider";
    case "crm_general":
      return "crm_general";
    case "utility":
      return "utility";
    case "driver":
      return "driver";
  }
}

export function getNavigationItemsForProfile(
  profile: NavigationProfile
): StaffNavItem[] {
  switch (profile) {
    case "provider":
      return PROVIDER_NAV_ITEMS;
    case "crm_general":
      return CRM_GENERAL_NAV_ITEMS;
    case "utility":
      return UTILITY_NAV_ITEMS;
    case "driver":
      return DRIVER_NAV_ITEMS;
  }
}
