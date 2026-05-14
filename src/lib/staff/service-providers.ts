import { isServiceStaffType } from "@/constants/staff-roles";

const NON_SERVICE_SYSTEM_ROLES = new Set([
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  "crm",
  "csr",
  "csr_head",
  "csr_staff",
  "driver",
  "utility",
]);

const HARD_EXCLUDED_SYSTEM_ROLES = new Set(["driver", "utility"]);

export type ServiceProviderCandidate = {
  is_active?: boolean | null;
  staff_type?: string | null;
  system_role?: string | null;
};

export function isNonServiceSystemRole(role: string | null | undefined): boolean {
  return role ? NON_SERVICE_SYSTEM_ROLES.has(role) : false;
}

export function canActAsBookingServiceProvider(
  member: ServiceProviderCandidate,
  hasMatchingServiceCapability = false
): boolean {
  if (member.is_active === false) return false;

  if (member.system_role && HARD_EXCLUDED_SYSTEM_ROLES.has(member.system_role)) {
    return false;
  }

  const staffType = member.staff_type?.trim();
  if (staffType) {
    return isServiceStaffType(staffType);
  }

  if (isNonServiceSystemRole(member.system_role)) return false;

  return hasMatchingServiceCapability;
}
