"use client";

import { usePathname } from "next/navigation";
import { CrmReadinessBadge } from "./crm-readiness-badge";
import type { ReadinessResult } from "@/types/readiness";

export function CrmReadinessBadgeWrapper({ readiness }: { readiness: ReadinessResult | null }) {
  const pathname = usePathname();
  // Hide the global readiness badge on /crm/today since the Today page has its own compact chips
  if (pathname === "/crm/today") return null;
  return <CrmReadinessBadge readiness={readiness} />;
}
