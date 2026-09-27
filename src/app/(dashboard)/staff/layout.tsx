/**
 * Canonical Staff PWA Layout (/staff/*)
 *
 * Scoped root layout for all canonical Staff PWA surfaces.
 * Links to /manifest-staff.webmanifest (scope: /staff/) and mounts
 * the appropriate role-aware mobile navigation shell.
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { WorkspaceRoutePrefetcher } from "@/components/features/workspace/workspace-route-prefetcher";
import { STAFF_PORTAL_PREFETCH } from "@/components/features/workspace/workspace-prefetch-config";
import { DriverMobileShell } from "@/components/features/staff-portal/driver/driver-mobile-shell";
import { StaffMobileShell } from "@/components/features/staff-portal/mobile/staff-mobile-shell";
import { TherapistMobileShell } from "@/components/features/staff-portal/therapist/therapist-mobile-shell";
import { getMyProfileAction } from "../staff-portal/actions";
import {
  resolveStaffOperationalRole,
  resolveNavigationProfile,
} from "@/components/features/staff-pwa/role-navigation";
import { StaffConnectivityBanner } from "@/components/features/staff-pwa/connectivity-banner";
import { StaffInstallPrompt } from "@/components/features/staff-pwa/install-prompt";
import { StaffServiceWorkerRegistration } from "@/components/features/staff-pwa/staff-service-worker-registration";

export const metadata: Metadata = {
  applicationName: "Cradle Hub",
  manifest: "/manifest-staff.webmanifest",
  title: {
    template: "%s | Cradle Hub",
    default: "Cradle Hub — Team Workspace",
  },
  appleWebApp: {
    capable: true,
    title: "Cradle Hub",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: [
      {
        url: "/staff-manifest-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  },
};

export default async function StaffLayout({
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
      content = <DriverMobileShell staff={staff} mode="canonical">{children}</DriverMobileShell>;
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
      <WorkspaceRoutePrefetcher config={STAFF_PORTAL_PREFETCH} />
      <StaffConnectivityBanner />
      <StaffServiceWorkerRegistration />
      <StaffInstallPrompt />
      {content}
    </>
  );
}
