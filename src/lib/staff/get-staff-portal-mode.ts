import { isFrontDeskRole, isServiceStaffType } from "@/constants/staff";
import {
  resolveStaffOperationalRole,
  resolveNavigationProfile,
} from "@/components/features/staff-pwa/role-navigation";

export type StaffPortalMode = "basic" | "therapist" | "driver" | "crm_staff";

export type StaffModeFields = {
  system_role: string;
  staff_type?: string | null;
};

/**
 * Determines what type of Staff Portal experience a staff member should receive.
 *
 * Reuses the canonical operational role resolver so runtime page rendering
 * (Today, Schedule, More, Week, Stats) stays 100% consistent with server-side authorization.
 *
 * Operational Group Mapping:
 *   Provider (therapist, nail_tech, aesthetician/facialist, salon_head, service_head, service_staff) → "therapist"
 *   Driver                                                                                           → "driver"
 *   CRM / General Staff (front desk, csr, or generic staff)                                          → "crm_staff" | "basic"
 *   Utility                                                                                          → "basic"
 */
export function getStaffPortalMode(staff: StaffModeFields): StaffPortalMode {
  const opRole = resolveStaffOperationalRole(staff);
  const profile = resolveNavigationProfile(opRole);

  if (profile === "provider") return "therapist";
  if (profile === "driver") return "driver";
  if (profile === "crm_general") {
    return isFrontDeskRole(staff.system_role) ? "crm_staff" : "basic";
  }
  if (profile === "utility") return "basic";

  // Fallback for non-Staff-PWA roles or historical access
  const role = staff.system_role;
  const type = staff.staff_type ?? "";
  if (role === "driver" || type === "driver") return "driver";
  if (isServiceStaffType(type) || type === "facialist") return "therapist";
  if (isFrontDeskRole(role)) return "crm_staff";
  return "basic";
}

export function isBasicStaffMode(mode: StaffPortalMode): boolean {
  return mode === "basic" || mode === "crm_staff";
}
