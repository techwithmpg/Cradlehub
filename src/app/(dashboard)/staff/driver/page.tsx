import { redirect } from "next/navigation";
import { DriverMobileHome } from "@/components/features/staff-portal/driver/driver-mobile-home";
import { getMyDriverJobsAction } from "../../staff-portal/actions";
import { getPureAttendanceSnapshot } from "@/lib/staff-portal/attendance";

export default async function StaffDriverTodayPage() {
  const today = new Date().toISOString().split("T")[0]!;

  const [driverResult, attendanceData] = await Promise.all([
    getMyDriverJobsAction(today),
    getPureAttendanceSnapshot(30).catch(() => null),
  ]);

  if ("error" in driverResult) {
    if (driverResult.error === "Unauthorized") {
      redirect("/login");
    }

    return (
      <div className="mx-auto max-w-[480px] px-4 py-8 text-center text-sm text-[#68778A]">
        {driverResult.error}
      </div>
    );
  }

  return (
    <DriverMobileHome
      staff={driverResult.staff}
      items={driverResult.items}
      stats={driverResult.stats}
      attendanceData={attendanceData}
    />
  );
}