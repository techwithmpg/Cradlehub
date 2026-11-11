"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MobileNavigationProgressProvider } from "@/components/features/mobile-shell/mobile-navigation-progress-provider";
import { MobileRouteProgress } from "@/components/features/mobile-shell/mobile-route-progress";
import { MobileRetainedTabHost } from "@/components/features/mobile-shell/mobile-retained-tab-host";
import { TherapistMobileBottomNav } from "./therapist-mobile-bottom-nav";
import { StaffCanvas } from "@/components/features/staff-pwa/native-foundation";
import { StaffSafeMemoryProvider } from "@/components/features/staff-pwa/safe-memory";

type TherapistMobileShellProps = {
  children: ReactNode;
  identity?: string;
};

export function TherapistMobileShell({ children, identity }: TherapistMobileShellProps) {
  const pathname = usePathname();
  const isScan = Boolean(pathname?.startsWith("/staff/scan"));
  const branchId = identity ? identity.split(":")[4] || null : null;

  const content = (
    <StaffCanvas className="min-h-full pb-[calc(88px+env(safe-area-inset-bottom))] md:contents md:pb-0">
      <MobileRetainedTabHost branchId={branchId}>{children}</MobileRetainedTabHost>
      <TherapistMobileBottomNav />
    </StaffCanvas>
  );

  if (isScan) {
    return (
      <MobileNavigationProgressProvider>
        <MobileRouteProgress />
        <div className="min-h-dvh bg-[var(--cs-bg)] md:contents md:bg-transparent cs-module-reveal">
          {children}
        </div>
      </MobileNavigationProgressProvider>
    );
  }

  return (
    <MobileNavigationProgressProvider>
      <MobileRouteProgress />
      {identity ? (
        <StaffSafeMemoryProvider identity={identity}>{content}</StaffSafeMemoryProvider>
      ) : (
        content
      )}
    </MobileNavigationProgressProvider>
  );
}
