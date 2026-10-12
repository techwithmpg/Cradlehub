"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MobileNavigationProgressProvider } from "@/components/features/mobile-shell/mobile-navigation-progress-provider";
import { MobileRouteProgress } from "@/components/features/mobile-shell/mobile-route-progress";
import { StaffMobileBottomNav } from "./staff-mobile-bottom-nav";
import { StaffCanvas } from "@/components/features/staff-pwa/native-foundation";
import { StaffSafeMemoryProvider } from "@/components/features/staff-pwa/safe-memory";

type StaffMobileShellProps = {
  children: ReactNode;
  profile?: "crm_general" | "utility";
  identity?: string;
};

export function StaffMobileShell({
  children,
  profile = "crm_general",
  identity,
}: StaffMobileShellProps) {
  const pathname = usePathname();
  const isScan = Boolean(pathname?.startsWith("/staff/scan"));

  const content = isScan ? (
    <div className="min-h-dvh bg-[var(--cs-bg)] md:contents md:bg-transparent">{children}</div>
  ) : profile === "utility" ? (
    <StaffCanvas className="min-h-full pb-[calc(88px+env(safe-area-inset-bottom))] md:contents md:pb-0">
      {children}
      <StaffMobileBottomNav profile={profile} />
    </StaffCanvas>
  ) : (
    <div className="min-h-dvh bg-[var(--cs-bg)] pb-[calc(84px+env(safe-area-inset-bottom))] md:contents md:bg-transparent md:pb-0">
      {children}
      <StaffMobileBottomNav profile={profile} />
    </div>
  );

  return (
    <MobileNavigationProgressProvider>
      <MobileRouteProgress />
      {profile === "utility" && identity ? (
        <StaffSafeMemoryProvider identity={identity}>{content}</StaffSafeMemoryProvider>
      ) : (
        content
      )}
    </MobileNavigationProgressProvider>
  );
}
