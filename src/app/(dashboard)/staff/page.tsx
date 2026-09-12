import { redirect } from "next/navigation";
import { getMyProfileAction } from "../staff-portal/actions";
import { getMyAttendanceData } from "@/lib/staff-portal/attendance";
import {
  resolveStaffOperationalRole,
  resolveNavigationProfile,
} from "@/components/features/staff-pwa/role-navigation";
import { GeneralStaffMobileHome } from "@/components/features/staff-portal/basic/general-staff-mobile-home";
import StaffTodayPage from "../staff-portal/page";

export default async function StaffPage() {
  const profileResult =
    await getMyProfileAction().catch(() => null);

  const staff =
    profileResult && "staff" in profileResult
      ? profileResult.staff
      : null;

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

    if (profile === "crm_general") {
      const attendanceData =
        await getMyAttendanceData(30).catch(() => null);

      return (
        <GeneralStaffMobileHome
          staff={staff}
          profile="crm_general"
          attendanceData={attendanceData}
        />
      );
    }
  }

  return <StaffTodayPage />;
}