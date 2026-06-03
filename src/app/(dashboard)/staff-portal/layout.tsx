/**
 * Staff Portal Route Layout
 *
 * Wraps all /staff-portal/* routes with background route warm-up.
 * Nested inside (dashboard)/layout.tsx which renders sidebar, header, and main scroll container.
 */

import type { ReactNode } from "react";
import { WorkspaceRoutePrefetcher } from "@/components/features/workspace/workspace-route-prefetcher";
import { STAFF_PORTAL_PREFETCH } from "@/components/features/workspace/workspace-prefetch-config";
import { DriverMobileShell } from "@/components/features/staff-portal/driver/driver-mobile-shell";
import { getMyProfileAction } from "./actions";
import { getStaffPortalMode } from "@/lib/staff/get-staff-portal-mode";

export default async function StaffPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profileResult = await getMyProfileAction().catch(() => null);
  const staff = profileResult && "staff" in profileResult ? profileResult.staff : null;
  const content =
    staff && getStaffPortalMode(staff) === "driver" ? (
      <DriverMobileShell staff={staff}>{children}</DriverMobileShell>
    ) : (
      children
    );

  return (
    <>
      {/* Background route warm-up for Staff Portal workspace */}
      <WorkspaceRoutePrefetcher config={STAFF_PORTAL_PREFETCH} />
      {content}
    </>
  );
}
