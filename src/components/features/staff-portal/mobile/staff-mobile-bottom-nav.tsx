"use client";

import { StaffBottomNav } from "@/components/features/staff-pwa/bottom-nav";
import { CRM_GENERAL_NAV_ITEMS } from "@/components/features/staff-pwa/role-navigation";

export function StaffMobileBottomNav() {
  return (
    <StaffBottomNav
      items={CRM_GENERAL_NAV_ITEMS}
      ariaLabel="Staff portal navigation"
    />
  );
}
