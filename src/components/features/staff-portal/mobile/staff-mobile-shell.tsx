"use client";

import type { ReactNode } from "react";
import { StaffMobileBottomNav } from "./staff-mobile-bottom-nav";

type StaffMobileShellProps = {
  children: ReactNode;
};

export function StaffMobileShell({ children }: StaffMobileShellProps) {
  return (
    <div className="min-h-dvh bg-[var(--cs-bg)] pb-[calc(112px+env(safe-area-inset-bottom))] md:contents md:bg-transparent md:pb-0">
      {children}
      <StaffMobileBottomNav />
    </div>
  );
}
