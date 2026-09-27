"use client";

import { StaffBottomNav } from "@/components/features/staff-pwa/bottom-nav";
import {
  CRM_GENERAL_NAV_ITEMS,
  UTILITY_NAV_ITEMS,
} from "@/components/features/staff-pwa/role-navigation";

type StaffMobileBottomNavProps = {
  profile?: "crm_general" | "utility";
};

export function StaffMobileBottomNav({ profile = "crm_general" }: StaffMobileBottomNavProps) {
  const items = profile === "utility" ? UTILITY_NAV_ITEMS : CRM_GENERAL_NAV_ITEMS;
  const label = profile === "utility" ? "Utility portal navigation" : "Staff portal navigation";

  return (
    <StaffBottomNav
      items={items}
      ariaLabel={label}
    />
  );
}
