import { getTodaysSchedule } from "@/lib/queries/bookings";
import { getStaffByBranch } from "@/lib/queries/staff";
import { getBranchById } from "@/lib/queries/branches";
import { getManagerBranchId } from "@/lib/queries/manager-context";
import { computeStaffAvailability, type TodayBooking } from "@/components/features/manager-today/manager-today-utils";
import { ManagerTodayWorkspace } from "@/components/features/manager-today/manager-today-workspace";

export default async function ManagerTodayPage() {
  const branchId = await getManagerBranchId();
  const today = new Date().toISOString().split("T")[0]!;

  const [branch, bookingsRaw, staffRaw] = await Promise.all([
    getBranchById(branchId),
    getTodaysSchedule(branchId, today),
    getStaffByBranch(branchId),
  ]);

  const bookings = bookingsRaw as TodayBooking[];
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const staffAvailability = computeStaffAvailability(
    staffRaw.map((s) => ({
      id: s.id,
      full_name: s.full_name,
      tier: s.tier ?? null,
      staff_type: s.staff_type ?? null,
    })),
    bookings,
    nowMins
  );

  const branchName = branch?.name ?? "Your Branch";
  const todayLabel = new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <ManagerTodayWorkspace
      branchName={branchName}
      todayLabel={todayLabel}
      bookings={bookings}
      staff={staffAvailability}
      userRole="manager"
    />
  );
}
