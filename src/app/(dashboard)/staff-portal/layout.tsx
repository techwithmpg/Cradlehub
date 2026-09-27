/**
 * Staff Portal Route Layout
 *
 * Wraps all /staff-portal/* routes with background route warm-up.
 * Nested inside (dashboard)/layout.tsx which renders sidebar, header, and main scroll container.
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { WorkspaceRoutePrefetcher } from "@/components/features/workspace/workspace-route-prefetcher";
import { STAFF_PORTAL_PREFETCH } from "@/components/features/workspace/workspace-prefetch-config";
import { DriverMobileShell } from "@/components/features/staff-portal/driver/driver-mobile-shell";
import { StaffMobileShell } from "@/components/features/staff-portal/mobile/staff-mobile-shell";
import { TherapistMobileShell } from "@/components/features/staff-portal/therapist/therapist-mobile-shell";
import { getMyProfileAction } from "./actions";
import {
  resolveStaffOperationalRole,
  resolveNavigationProfile,
} from "@/components/features/staff-pwa/role-navigation";

export const metadata: Metadata = {
  manifest: "/manifest-staff.webmanifest",
  title: {
    template: "%s | CradleHub Staff",
    default: "CradleHub Staff",
  },
};

export default async function StaffPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profileResult = await getMyProfileAction().catch(() => null);
  const staff = profileResult && "staff" in profileResult ? profileResult.staff : null;
  let content: ReactNode = children;

  if (staff) {
    const opRole = resolveStaffOperationalRole({
      system_role: staff.system_role,
      staff_type: staff.staff_type,
    });
    const profile = resolveNavigationProfile(opRole);

    if (profile === "driver") {
      content = <DriverMobileShell staff={staff}>{children}</DriverMobileShell>;
    } else if (profile === "provider") {
      content = <TherapistMobileShell>{children}</TherapistMobileShell>;
    } else if (profile === "utility") {
      content = <StaffMobileShell profile="utility">{children}</StaffMobileShell>;
    } else {
      content = <StaffMobileShell profile="crm_general">{children}</StaffMobileShell>;
    }
  }

  return (
    <>
      {/* Background route warm-up for Staff Portal workspace */}
      <WorkspaceRoutePrefetcher config={STAFF_PORTAL_PREFETCH} />
      {content}
    </>
  );
}
