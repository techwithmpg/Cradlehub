/**
 * Driver Portal Route Layout
 *
 * Wraps all /driver/* routes with background route warm-up.
 * Nested inside (dashboard)/layout.tsx which renders sidebar, header, and main scroll container.
 */

import type { ReactNode } from "react";
import { DriverMobileShell } from "@/components/features/staff-portal/driver/driver-mobile-shell";
import { WorkspaceRoutePrefetcher } from "@/components/features/workspace/workspace-route-prefetcher";
import { DRIVER_PREFETCH } from "@/components/features/workspace/workspace-prefetch-config";
import { getMyProfileAction } from "../staff-portal/actions";

export default async function DriverLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profileResult = await getMyProfileAction().catch(() => null);
  const staff = profileResult && "staff" in profileResult ? profileResult.staff : null;

  return (
    <>
      {/* Background route warm-up for Driver workspace */}
      <WorkspaceRoutePrefetcher config={DRIVER_PREFETCH} />
      {staff ? <DriverMobileShell staff={staff}>{children}</DriverMobileShell> : children}
    </>
  );
}
