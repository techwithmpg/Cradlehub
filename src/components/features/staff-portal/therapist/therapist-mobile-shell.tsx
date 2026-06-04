"use client";

import type { ReactNode } from "react";
import { TherapistMobileBottomNav } from "./therapist-mobile-bottom-nav";

type TherapistMobileShellProps = {
  children: ReactNode;
};

export function TherapistMobileShell({ children }: TherapistMobileShellProps) {
  return (
    <div className="min-h-dvh bg-[var(--cs-bg)] pb-[calc(112px+env(safe-area-inset-bottom))] md:contents md:bg-transparent md:pb-0">
      {children}
      <TherapistMobileBottomNav />
    </div>
  );
}
