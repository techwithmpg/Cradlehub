import { isFrontDeskRole, isServiceStaffType } from "@/constants/staff";

export type StaffPortalMode = "basic" | "therapist" | "driver" | "crm_staff";

type StaffModeFields = {
  system_role: string;
  staff_type?: string | null;
};

/**
 * Determines what type of Staff Portal experience a staff member should receive.
 *
 * Priority:
 *   driver   → system_role=driver OR staff_type=driver
 *   therapist → staff_type is a service provider type (therapist, nail_tech, aesthetician, salon_head)
 *   crm_staff → system_role is a CRM/front-desk role (multi-access user)
 *   basic     → everything else (utility, admin assistant, front desk on staff portal, etc.)
 */
export function getStaffPortalMode(staff: StaffModeFields): StaffPortalMode {
  const role = staff.system_role;
  const type = staff.staff_type ?? "";

  if (role === "driver" || type === "driver") return "driver";
  if (isServiceStaffType(type)) return "therapist";
  if (isFrontDeskRole(role)) return "crm_staff";
  return "basic";
}

export function isBasicStaffMode(mode: StaffPortalMode): boolean {
  return mode === "basic" || mode === "crm_staff";
}
