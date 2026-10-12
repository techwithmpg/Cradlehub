import { redirect } from "next/navigation";
import { DriverNativeHome } from "@/components/features/staff-pwa/driver/driver-native-home";
import { getMyDriverJobsAction } from "../../staff-portal/actions";
import { getPureAttendanceSnapshot } from "@/lib/staff-portal/attendance";

export default async function StaffDriverTodayPage() {
  const [driverResult, attendanceData] = await Promise.all([
    getMyDriverJobsAction(),
    getPureAttendanceSnapshot(30).catch(() => null),
  ]);

  if ("error" in driverResult) {
    if (driverResult.error === "Unauthorized") {
      redirect("/login");
    }

    return (
      <div
        role="alert"
        className="mx-auto max-w-[480px] px-4 py-8 text-center text-sm text-[#68778A]"
      >
        {driverResult.error}
      </div>
    );
  }

  return (
    <DriverNativeHome
      staff={driverResult.staff}
      items={driverResult.items}
      businessDate={driverResult.businessDate ?? new Date().toISOString().slice(0, 10)}
      attendanceData={attendanceData}
    />
  );
}
