import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { AttendanceReadinessCard } from "@/components/features/staff-portal/attendance-readiness-card";
import { StaffAttendanceHistory } from "@/components/features/staff-portal/staff-attendance-history";
import { StaffAttendanceRealtime } from "@/components/features/staff-portal/staff-attendance-realtime";
import { getOwnAttendancePhoneState } from "@/lib/attendance/device-registration";
import { ATTENDANCE_REGISTRATION_COOKIE_NAME } from "@/lib/attendance/scan-continuation";
import { DEVICE_COOKIE_NAME } from "@/lib/attendance/tokens";
import { getMyAttendanceData } from "@/lib/staff-portal/attendance";

export default async function StaffAttendancePage() {
  const data = await getMyAttendanceData(90);
  if (!data) redirect("/login");

  const cookieStore = await cookies();
  let phoneState: Awaited<ReturnType<typeof getOwnAttendancePhoneState>> = null;
  try {
    phoneState = await getOwnAttendancePhoneState(
      cookieStore.get(DEVICE_COOKIE_NAME)?.value ??
        cookieStore.get(ATTENDANCE_REGISTRATION_COOKIE_NAME)?.value ??
        null
    );
  } catch {
    phoneState = null;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-0 sm:pb-0">
      <PageHeader
        title="My Attendance"
        description="Check whether your account, phone, branch, and schedule are ready before scanning."
        icon="🕒"
      />
      <div className="mt-6 space-y-5">
        <AttendanceReadinessCard data={data} phoneState={phoneState} />
        <StaffAttendanceHistory data={data} />
      </div>
      <StaffAttendanceRealtime staffId={data.staffId} />
    </div>
  );
}
