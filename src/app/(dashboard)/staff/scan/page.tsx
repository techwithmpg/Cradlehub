import { StaffAppShell } from "@/components/features/staff-pwa/app-shell";
import { getMyProfileAction } from "../../staff-portal/actions";
import {
  resolveNavigationProfile,
  resolveStaffOperationalRole,
} from "@/components/features/staff-pwa/role-navigation";
import { StaffRoleResolutionSplash } from "@/components/features/staff-pwa/role-resolution-splash";
import { StaffQrScanner } from "@/components/features/scanner/staff-qr-scanner";

export const metadata = {
  title: "Scan Code | CradleHub Staff",
};

export default async function StaffScanPage() {
  const profileResult = await getMyProfileAction().catch(() => null);
  const staff =
    profileResult && "staff" in profileResult ? profileResult.staff : null;

  if (!staff) {
    return <StaffRoleResolutionSplash />;
  }

  const opRole = resolveStaffOperationalRole({
    system_role: staff.system_role,
    staff_type: staff.staff_type,
  });
  const profile = resolveNavigationProfile(opRole);

  const returnHref =
    profile === "driver"
      ? "/staff/driver"
      : profile === "utility"
        ? "/staff/utility"
        : "/staff";

  return (
    <StaffAppShell
      staff={staff}
      profileOverride={profile ?? undefined}
      pageTitle="Scan Code"
      backHref={returnHref}
      activeNavKey="scan"
      hideNav={true}
    >
      <StaffQrScanner returnHref={returnHref} />
    </StaffAppShell>
  );
}
