"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { MobileNavigationProgressProvider } from "@/components/features/mobile-shell/mobile-navigation-progress-provider";
import { MobileRouteProgress } from "@/components/features/mobile-shell/mobile-route-progress";
import { DriverMobileBottomNav } from "./driver-mobile-bottom-nav";
import { DriverProfileSheet } from "./driver-profile-sheet";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";

type DriverMobileShellProps = {
  staff: StaffPortalStaff;
  children: ReactNode;
  mode?: "canonical" | "driver" | "staff_portal";
};

export function DriverMobileShell({ staff, children, mode }: DriverMobileShellProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const pathname = usePathname();
  const isScan = Boolean(pathname?.startsWith("/staff/scan"));

  if (isScan) {
    return (
      <MobileNavigationProgressProvider>
        <MobileRouteProgress />
        <div className="min-h-dvh bg-[var(--cs-bg)] md:contents md:bg-transparent">
          {children}
        </div>
      </MobileNavigationProgressProvider>
    );
  }

  return (
    <MobileNavigationProgressProvider>
      <MobileRouteProgress />
      <div className="min-h-dvh bg-[var(--cs-bg)] pb-[calc(84px+env(safe-area-inset-bottom))] md:contents md:bg-transparent md:pb-0">
        {children}
        <DriverMobileBottomNav
          isProfileOpen={profileOpen}
          onProfileOpen={() => setProfileOpen(true)}
          mode={mode}
        />
        <DriverProfileSheet staff={staff} open={profileOpen} onOpenChange={setProfileOpen} />
      </div>
    </MobileNavigationProgressProvider>
  );
}
