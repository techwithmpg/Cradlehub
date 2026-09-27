"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MobileNavigationProgressProvider } from "@/components/features/mobile-shell/mobile-navigation-progress-provider";
import { MobileRouteProgress } from "@/components/features/mobile-shell/mobile-route-progress";
import { TherapistMobileBottomNav } from "./therapist-mobile-bottom-nav";

type TherapistMobileShellProps = {
  children: ReactNode;
};

export function TherapistMobileShell({ children }: TherapistMobileShellProps) {
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
      <div className="min-h-dvh bg-[var(--cs-bg)] pb-[calc(112px+env(safe-area-inset-bottom))] md:contents md:bg-transparent md:pb-0">
        {children}
        <TherapistMobileBottomNav />
      </div>
    </MobileNavigationProgressProvider>
  );
}
