"use client";

import { StaffBottomNav } from "@/components/features/staff-pwa/bottom-nav";
import { PROVIDER_NAV_ITEMS } from "@/components/features/staff-pwa/role-navigation";

export function TherapistMobileBottomNav() {
  return (
    <StaffBottomNav
      items={PROVIDER_NAV_ITEMS}
      ariaLabel="Therapist portal navigation"
    />
  );
}
