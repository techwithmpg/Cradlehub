/**
 * Onboarding role options and mappings.
 *
 * Applicants see user-friendly labels. The backend stores the mapped
 * staff_type value (which must exist in the DB CHECK constraint).
 */

export const ONBOARDING_ROLE_OPTIONS = [
  { value: "therapist",   label: "Massage Therapist",      sublabel: "Bodywork & recovery",      icon: "💆" },
  { value: "nail_tech",   label: "Nail Technician",        sublabel: "Manicure & pedicure",      icon: "💅" },
  { value: "aesthetician",label: "Aesthetician",           sublabel: "Facials & skin care",      icon: "✨" },
  { value: "driver",      label: "Driver",                 sublabel: "Home service transport",   icon: "🚗" },
  { value: "utility",     label: "Utility / Housekeeping", sublabel: "Room prep & maintenance",  icon: "🧹" },
  { value: "csr",         label: "CSR / Front Desk",       sublabel: "Customer service",         icon: "🎧" },
  { value: "salon_head",  label: "Salon Head",             sublabel: "Salon department lead",    icon: "👑" },
  { value: "managerial",  label: "Manager",                sublabel: "Management role",          icon: "📊" },
  { value: "other",       label: "Other / To be assigned", sublabel: "Role TBD",                 icon: "📋" },
] as const;

export type OnboardingRoleValue = (typeof ONBOARDING_ROLE_OPTIONS)[number]["value"];

export function getOnboardingRoleLabel(value: string): string {
  return ONBOARDING_ROLE_OPTIONS.find((r) => r.value === value)?.label ?? value;
}

/**
 * Map applicant-facing role value to the DB staff_type.
 * All returned values must exist in the staff.staff_type CHECK constraint.
 */
export function mapPreferredRoleToStaffType(preferredRole: string): string {
  switch (preferredRole) {
    case "therapist":    return "therapist";
    case "nail_tech":    return "nail_tech";
    case "aesthetician": return "aesthetician";
    case "driver":       return "driver";
    case "utility":      return "utility";
    case "csr":          return "csr";
    case "salon_head":   return "salon_head";
    case "managerial":   return "managerial";
    default:             return "therapist"; // safe fallback
  }
}

/**
 * Reverse: given a staff_type, suggest the most likely onboarding role value.
 */
export function staffTypeToOnboardingRole(staffType: string): string {
  const match = ONBOARDING_ROLE_OPTIONS.find((r) => r.value === staffType);
  return match?.value ?? "other";
}
