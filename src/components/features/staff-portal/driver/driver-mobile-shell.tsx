"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { MobileNavigationProgressProvider } from "@/components/features/mobile-shell/mobile-navigation-progress-provider";
import { MobileRouteProgress } from "@/components/features/mobile-shell/mobile-route-progress";
import { MobileRetainedTabHost } from "@/components/features/mobile-shell/mobile-retained-tab-host";
import { DriverMobileBottomNav } from "./driver-mobile-bottom-nav";
import { DriverProfileSheet } from "./driver-profile-sheet";
import { StaffCanvas } from "@/components/features/staff-pwa/native-foundation";
import { StaffSafeMemoryProvider } from "@/components/features/staff-pwa/safe-memory";
import { DriverDispatchWakeListener } from "@/components/features/staff-pwa/driver/driver-dispatch-wake-listener";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";

type DriverMobileShellProps = {
  staff: StaffPortalStaff;
  children: ReactNode;
  mode?: "canonical" | "driver" | "staff_portal";
  identity?: string;
};

export function DriverMobileShell({ staff, children, mode, identity }: DriverMobileShellProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const pathname = usePathname();
  const isScan = Boolean(pathname?.startsWith("/staff/scan"));
  const branchId = staff?.branch_id ?? (identity ? identity.split(":")[4] || null : null);

  const content = isScan ? (
    <div className="min-h-dvh bg-[var(--cs-bg)] md:contents md:bg-transparent cs-module-reveal">
      {children}
    </div>
  ) : mode === "canonical" ? (
    <StaffCanvas className="min-h-full pb-[calc(88px+env(safe-area-inset-bottom))] md:contents md:pb-0">
      <MobileRetainedTabHost branchId={branchId}>{children}</MobileRetainedTabHost>
      <DriverMobileBottomNav mode={mode} />
    </StaffCanvas>
  ) : (
    <div className="min-h-dvh bg-[var(--cs-bg)] pb-[calc(84px+env(safe-area-inset-bottom))] md:contents md:bg-transparent md:pb-0">
      <MobileRetainedTabHost branchId={branchId}>{children}</MobileRetainedTabHost>
      <DriverMobileBottomNav
        isProfileOpen={profileOpen}
        onProfileOpen={() => setProfileOpen(true)}
        mode={mode}
      />
      <DriverProfileSheet staff={staff} open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );

  return (
    <MobileNavigationProgressProvider>
      <MobileRouteProgress />
      {mode === "canonical" ? <DriverDispatchWakeListener /> : null}
      {mode === "canonical" && identity ? (
        <StaffSafeMemoryProvider identity={identity}>{content}</StaffSafeMemoryProvider>
      ) : (
        content
      )}
    </MobileNavigationProgressProvider>
  );
}
