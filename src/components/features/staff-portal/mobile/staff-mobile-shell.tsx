"use client";

import type { ReactNode } from "react";
import { MobileNavigationProgressProvider } from "@/components/features/mobile-shell/mobile-navigation-progress-provider";
import { MobileRouteProgress } from "@/components/features/mobile-shell/mobile-route-progress";
import { StaffMobileBottomNav } from "./staff-mobile-bottom-nav";

type StaffMobileShellProps = {
  children: ReactNode;
};

export function StaffMobileShell({ children }: StaffMobileShellProps) {
  return (
    <MobileNavigationProgressProvider>
      <MobileRouteProgress />
      <div className="min-h-dvh bg-[var(--cs-bg)] pb-[calc(112px+env(safe-area-inset-bottom))] md:contents md:bg-transparent md:pb-0">
        {children}
        <StaffMobileBottomNav />
      </div>
    </MobileNavigationProgressProvider>
  );
}
