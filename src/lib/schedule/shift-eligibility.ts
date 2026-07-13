import { canonicalizeSystemRole } from "@/constants/staff";

export type ScheduleShiftType = "single" | "opening" | "closing";

export type ScheduleShiftEligibilityStaff = {
  staff_type?: string | null;
  system_role?: string | null;
};

export function isCrmScheduleRole(systemRole: string | null | undefined): boolean {
  return canonicalizeSystemRole(systemRole) === "crm";
}

export function canUseOpeningClosingShift(
  staff: ScheduleShiftEligibilityStaff
): boolean {
  return staff.staff_type === "therapist" || isCrmScheduleRole(staff.system_role);
}

export function canUseScheduleShiftType(
  staff: ScheduleShiftEligibilityStaff,
  shiftType: ScheduleShiftType
): boolean {
  return shiftType === "single" || canUseOpeningClosingShift(staff);
}
