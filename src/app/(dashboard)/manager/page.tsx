import { getTodaysSchedule } from "@/lib/queries/bookings";
import { getStaffByBranch, getStaffByBranchWithBranches, getPendingStaffByBranch } from "@/lib/queries/staff";
import { getBranchById } from "@/lib/queries/branches";
import { getManagerBranchId } from "@/lib/queries/manager-context";
import { getDailySchedule } from "@/lib/queries/schedule";
import { computeStaffAvailability, type TodayBooking } from "@/components/features/manager-today/manager-today-utils";
import { ManagerTodayWorkspace } from "@/components/features/manager-today/manager-today-workspace";
import { ManagerMobileWorkspace } from "@/components/features/manager/mobile/manager-mobile-workspace";
import type { StaffMember } from "@/components/features/staff/staff-management-utils";

export default async function ManagerTodayPage() {
  const branchId = await getManagerBranchId();
  const today = new Date().toISOString().split("T")[0]!;

  const [branch, bookingsRaw, staffRaw, scheduleRows, allStaff, pendingStaff] = await Promise.all([
    getBranchById(branchId),
    getTodaysSchedule(branchId, today),
    getStaffByBranch(branchId),
    getDailySchedule({ branchId, date: today }),
    getStaffByBranchWithBranches(branchId),
    getPendingStaffByBranch(branchId),
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
    <>
      {/* Desktop: preserve existing workspace exactly */}
      <div className="hidden md:block">
        <ManagerTodayWorkspace
          branchName={branchName}
          todayLabel={todayLabel}
          bookings={bookings}
          staff={staffAvailability}
          userRole="manager"
        />
      </div>

      {/* Mobile: new simplified manager experience */}
      <div className="block md:hidden">
        <ManagerMobileWorkspace
          branchName={branchName}
          todayLabel={todayLabel}
          bookings={bookings}
          staff={staffAvailability}
          scheduleRows={scheduleRows}
          allStaff={allStaff as StaffMember[]}
          pendingStaff={pendingStaff as StaffMember[]}
          userRole="manager"
        />
      </div>
    </>
  );
}
