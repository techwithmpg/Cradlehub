import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMyProfileAction } from "../../staff-portal/actions";
import LegacyAttendancePage from "../../staff-portal/attendance/page";
import { resolveStaffPwaOperationalGroup } from "@/lib/auth/workspace-access";
import { getPureAttendanceSnapshot } from "@/lib/staff-portal/attendance";
import { getOwnAttendancePhoneState } from "@/lib/attendance/device-registration";
import { ATTENDANCE_REGISTRATION_COOKIE_NAME } from "@/lib/attendance/scan-continuation";
import { DEVICE_COOKIE_NAME } from "@/lib/attendance/tokens";
import { AttendanceReadinessCard } from "@/components/features/staff-portal/attendance-readiness-card";
import { StaffAttendanceHistory } from "@/components/features/staff-portal/staff-attendance-history";
import { StaffAttendanceRealtime } from "@/components/features/staff-portal/staff-attendance-realtime";
import { StaffScreen, StaffScreenHeader } from "@/components/features/staff-pwa/native-foundation";

export default async function StaffPwaAttendancePage() {
  const profileResult = await getMyProfileAction().catch(() => null);
  const staff = profileResult && "staff" in profileResult ? profileResult.staff : null;
  if (resolveStaffPwaOperationalGroup(staff?.system_role, staff?.staff_type) !== "provider") {
    return <LegacyAttendancePage />;
  }

  const data = await getPureAttendanceSnapshot(90);
  if (!data) redirect("/staff/login");
  const cookieStore = await cookies();
  const phoneState = await getOwnAttendancePhoneState(
    cookieStore.get(DEVICE_COOKIE_NAME)?.value ??
      cookieStore.get(ATTENDANCE_REGISTRATION_COOKIE_NAME)?.value ??
      null
  ).catch(() => null);

  return (
    <StaffScreen>
      <StaffScreenHeader title="My Attendance" subtitle="Today’s status and recent clock history" />
      <div className="space-y-4">
        <AttendanceReadinessCard data={data} phoneState={phoneState} canonical />
        <StaffAttendanceHistory data={data} canonical />
      </div>
      <StaffAttendanceRealtime staffId={data.staffId} />
    </StaffScreen>
  );
}
