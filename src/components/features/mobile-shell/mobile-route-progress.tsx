"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useMobileNavigationProgress } from "./mobile-navigation-progress-provider";

export function MobileRouteProgress() {
  const pathname = usePathname();
  const { phase, stopNavigation } = useMobileNavigationProgress();
  const isVisible = phase !== "idle";

  useEffect(() => {
    stopNavigation();
  }, [pathname, stopNavigation]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[100] h-1 w-full overflow-hidden md:hidden"
    >
      <div
        className={cn(
          "h-full origin-left bg-gradient-to-r from-emerald-950 via-emerald-600 to-teal-400 shadow-[0_0_18px_rgba(16,185,129,0.45)] transition-all duration-300 ease-out",
          phase === "loading" && "w-[88%] opacity-100",
          phase === "complete" && "w-full opacity-100 duration-150",
          !isVisible && "w-0 opacity-0"
        )}
      />
    </div>
  );
}
