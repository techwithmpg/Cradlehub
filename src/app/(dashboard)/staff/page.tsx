import { redirect } from "next/navigation";
import { getMyProfileAction } from "../staff-portal/actions";
import {
  resolveStaffOperationalRole,
  resolveNavigationProfile,
} from "@/components/features/staff-pwa/role-navigation";
import StaffTodayPage from "../staff-portal/page";

export default async function StaffPage() {
  const profileResult = await getMyProfileAction().catch(() => null);
  const staff = profileResult && "staff" in profileResult ? profileResult.staff : null;

  if (staff) {
    const opRole = resolveStaffOperationalRole({
      system_role: staff.system_role,
      staff_type: staff.staff_type,
    });
    const profile = resolveNavigationProfile(opRole);

    if (profile === "driver") {
      redirect("/staff/driver");
    }
    if (profile === "utility") {
      redirect("/staff/utility");
    }
  }

  return <StaffTodayPage />;
}
