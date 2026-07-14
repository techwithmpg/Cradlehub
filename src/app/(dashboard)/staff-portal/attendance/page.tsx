import { redirect } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { StaffAttendanceHistory } from "@/components/features/staff-portal/staff-attendance-history";
import { StaffAttendanceRealtime } from "@/components/features/staff-portal/staff-attendance-realtime";
import { getMyAttendanceData } from "@/lib/staff-portal/attendance";

export default async function StaffAttendancePage() {
  const data = await getMyAttendanceData(90);
  if (!data) redirect("/login");
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-0 sm:pb-0">
      <PageHeader title="My Attendance" description="Your read-only schedule, clock history, and attendance review status." icon="🕒" />
      <div className="mt-6"><StaffAttendanceHistory data={data} /></div>
      <StaffAttendanceRealtime staffId={data.staffId} />
    </div>
  );
}
