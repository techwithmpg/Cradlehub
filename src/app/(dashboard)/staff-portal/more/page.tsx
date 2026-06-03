import { BasicStaffMoreMenu } from "@/components/features/staff-portal/basic/basic-staff-more-menu";
import { TherapistMoreMenu } from "@/components/features/staff-portal/therapist/therapist-more-menu";
import { DriverMoreMenu } from "@/components/features/staff-portal/driver/driver-more-menu";
import { getMyProfileAction } from "../actions";
import { getStaffPortalMode, isBasicStaffMode } from "@/lib/staff/get-staff-portal-mode";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";

export default async function StaffMorePage() {
  const profileResult = await getMyProfileAction();
  const staffForMode = "error" in profileResult ? null : (profileResult.staff as StaffPortalStaff);
  const mode = staffForMode ? getStaffPortalMode(staffForMode) : "basic";
  const isBasic = isBasicStaffMode(mode);
  const isDriver = mode === "driver";

  if (isBasic) return <BasicStaffMoreMenu />;
  if (isDriver) return <DriverMoreMenu />;
  return <TherapistMoreMenu />;
}
