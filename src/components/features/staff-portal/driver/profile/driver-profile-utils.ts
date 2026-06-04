import { STAFF_TYPE_LABELS, SYSTEM_ROLE_LABELS, isStaffType, isSystemRole } from "@/constants/staff";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";

export function titleCaseToken(value: string | null | undefined, fallback = "Unassigned"): string {
  if (!value) return fallback;

  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getDriverBranchLabel(staff: StaffPortalStaff): string {
  const relation = staff.branches;
  if (Array.isArray(relation)) return relation[0]?.name ?? "Assigned branch";
  return relation?.name ?? (staff.branch_id ? "Assigned branch" : "No branch assigned");
}

export function getDriverStaffTypeLabel(staff: StaffPortalStaff): string {
  if (staff.staff_type && isStaffType(staff.staff_type)) return STAFF_TYPE_LABELS[staff.staff_type];
  return staff.staff_type ? titleCaseToken(staff.staff_type) : "Driver";
}

export function getDriverSystemRoleLabel(staff: StaffPortalStaff): string {
  if (isSystemRole(staff.system_role)) return SYSTEM_ROLE_LABELS[staff.system_role];
  return titleCaseToken(staff.system_role);
}

export function getDriverTierLabel(staff: StaffPortalStaff): string {
  return titleCaseToken(staff.tier, "Not assigned");
}

export function getDriverFullName(staff: StaffPortalStaff): string {
  return staff.full_name.trim() || "Driver";
}

export function getDriverInitials(staff: StaffPortalStaff): string {
  const initials = getDriverFullName(staff)
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return initials || "DR";
}

export function formatDriverPhone(phone: string | null | undefined): string {
  return phone?.trim() || "Not added";
}
