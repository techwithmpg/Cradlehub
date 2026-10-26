import { SERVICE_STAFF_TYPES } from "@/constants/staff-roles";
import type { OperationalStaffMember } from "@/lib/operations-center/issue-model";
import type { StaffAvailabilityItem } from "@/lib/queries/staff";

type VerifiedStaff = Pick<OperationalStaffMember, "id" | "staff_type" | "is_active" | "branch_id">;

export function getStaffNeedingWeeklySchedule(
  items: StaffAvailabilityItem[],
  verifiedStaff: VerifiedStaff[],
  branchId: string,
  dayOfWeek: number
): StaffAvailabilityItem[] {
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return [];

  // Availability's legacy fallback can label every staff member a therapist.
  // Only the independently queried branch roster can establish a service-facing type.
  const eligibleIds = new Set(
    verifiedStaff
      .filter(
        (staff) =>
          staff.branch_id === branchId &&
          staff.is_active &&
          (SERVICE_STAFF_TYPES as readonly string[]).includes(staff.staff_type)
      )
      .map((staff) => staff.id)
  );

  return items
    .filter(
      (item) =>
        eligibleIds.has(item.staff.id) &&
        !item.schedules.some(
          (schedule) => schedule.is_active && schedule.day_of_week === dayOfWeek
        )
    )
    .sort((a, b) => a.staff.full_name.localeCompare(b.staff.full_name));
}
