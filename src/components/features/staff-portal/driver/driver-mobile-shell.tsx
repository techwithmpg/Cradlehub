"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { DriverMobileBottomNav } from "./driver-mobile-bottom-nav";
import { DriverProfileSheet } from "./driver-profile-sheet";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";

type DriverMobileShellProps = {
  staff: StaffPortalStaff;
  children: ReactNode;
};

export function DriverMobileShell({ staff, children }: DriverMobileShellProps) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-[var(--cs-bg)] pb-[calc(112px+env(safe-area-inset-bottom))] md:contents md:bg-transparent md:pb-0">
      {children}
      <DriverMobileBottomNav profileOpen={profileOpen} onProfileClick={() => setProfileOpen(true)} />
      <DriverProfileSheet staff={staff} open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}
