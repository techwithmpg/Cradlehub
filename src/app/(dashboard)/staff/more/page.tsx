import { BasicStaffMoreMenu } from "@/components/features/staff-portal/basic/basic-staff-more-menu";
import { TherapistMoreMenu } from "@/components/features/staff-portal/therapist/therapist-more-menu";
import { DriverMoreMenu } from "@/components/features/staff-portal/driver/driver-more-menu";
import { getMyProfileAction } from "../../staff-portal/actions";
import {
  resolveStaffOperationalRole,
  resolveNavigationProfile,
} from "@/components/features/staff-pwa/role-navigation";
import {
  getStaffPortalMode,
  isBasicStaffMode,
} from "@/lib/staff/get-staff-portal-mode";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";

export default async function StaffMorePage() {
  const profileResult = await getMyProfileAction();

  const staff =
    profileResult && !("error" in profileResult)
      ? (profileResult.staff as StaffPortalStaff)
      : null;

  if (staff) {
    const operationalRole = resolveStaffOperationalRole({
      system_role: staff.system_role,
      staff_type: staff.staff_type,
    });

    const profile = resolveNavigationProfile(operationalRole);

    if (profile === "driver") {
      return <DriverMoreMenu isCanonical />;
    }

    if (profile === "provider") {
      return <TherapistMoreMenu isCanonical staff={staff} />;
    }

    if (profile === "crm_general") {
      return <BasicStaffMoreMenu isCanonical />;
    }
  }

  const mode = staff ? getStaffPortalMode(staff) : "basic";
  const isBasic = isBasicStaffMode(mode);
  const isDriver = mode === "driver";

  if (isBasic) {
    return <BasicStaffMoreMenu isCanonical />;
  }

  if (isDriver) {
    return <DriverMoreMenu isCanonical />;
  }

  return <TherapistMoreMenu isCanonical staff={staff} />;
}