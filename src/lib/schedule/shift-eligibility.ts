import { canonicalizeSystemRole } from "@/constants/staff";

export type ScheduleShiftType = "single" | "opening" | "closing";

export type ScheduleShiftEligibilityStaff = {
  staff_type?: string | null;
  system_role?: string | null;
};

export function isCrmScheduleRole(systemRole: string | null | undefined): boolean {
  return canonicalizeSystemRole(systemRole) === "crm";
}

export function isCrmFrontDeskScheduleStaff(staff: ScheduleShiftEligibilityStaff): boolean {
  return staff.staff_type?.trim().toLowerCase() === "csr" || isCrmScheduleRole(staff.system_role);
}

export function canUseOpeningClosingShift(staff: ScheduleShiftEligibilityStaff): boolean {
  return staff.staff_type === "therapist" || isCrmFrontDeskScheduleStaff(staff);
}

export function canUseScheduleShiftType(
  staff: ScheduleShiftEligibilityStaff,
  shiftType: ScheduleShiftType
): boolean {
  return shiftType === "single" || canUseOpeningClosingShift(staff);
}
