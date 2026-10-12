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
import { STAFF_PWA_PROVIDER_PREFETCH } from "@/components/features/workspace/workspace-prefetch-config";
import { DriverMobileShell } from "@/components/features/staff-portal/driver/driver-mobile-shell";
import { StaffMobileShell } from "@/components/features/staff-portal/mobile/staff-mobile-shell";
import { TherapistMobileShell } from "@/components/features/staff-portal/therapist/therapist-mobile-shell";
import { getMyProfileAction } from "../staff-portal/actions";
import { getLayoutStaffContext } from "@/lib/queries/staff-context";
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
    icon: [
      {
        url: "/staff-pwa-icon-48-gold.png",
        sizes: "48x48",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/staff-pwa-apple-touch-icon-180-gold.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const authContext = await getLayoutStaffContext();
  const profileResult = await getMyProfileAction().catch(() => null);
  const staff = profileResult && "staff" in profileResult ? profileResult.staff : null;
  let content: ReactNode = children;
  let prefetchProviderTabs = false;

  if (staff) {
    const opRole = resolveStaffOperationalRole({
      system_role: staff.system_role,
      staff_type: staff.staff_type,
    });
    const profile = resolveNavigationProfile(opRole);

    if (profile === "driver") {
      content = (
        <DriverMobileShell
          staff={staff}
          mode="canonical"
          identity={`${authContext?.user.id ?? ""}:${staff.id}:${staff.system_role}:${staff.staff_type ?? ""}:${staff.branch_id ?? ""}`}
        >
          {children}
        </DriverMobileShell>
      );
    } else if (profile === "provider") {
      prefetchProviderTabs = true;
      content = (
        <TherapistMobileShell
          identity={`${authContext?.user.id ?? ""}:${staff.id}:${staff.system_role}:${staff.staff_type ?? ""}:${staff.branch_id ?? ""}`}
        >
          {children}
        </TherapistMobileShell>
      );
    } else if (profile === "utility") {
      content = (
        <StaffMobileShell
          profile="utility"
          identity={`${authContext?.user.id ?? ""}:${staff.id}:${staff.system_role}:${staff.staff_type ?? ""}:${staff.branch_id ?? ""}`}
        >
          {children}
        </StaffMobileShell>
      );
    } else {
      content = <StaffMobileShell profile="crm_general">{children}</StaffMobileShell>;
    }
  }

  return (
    <>
      {prefetchProviderTabs ? (
        <WorkspaceRoutePrefetcher config={STAFF_PWA_PROVIDER_PREFETCH} />
      ) : null}
      <StaffConnectivityBanner />
      <StaffServiceWorkerRegistration />
      <StaffInstallPrompt />
      {content}
    </>
  );
}
