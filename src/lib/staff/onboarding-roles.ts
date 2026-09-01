/**
 * Onboarding role options and mappings.
 *
 * Applicants see user-friendly labels. The backend stores the mapped
 * staff_type value (which must exist in the DB CHECK constraint).
 */

export const ONBOARDING_ROLE_OPTIONS = [
  { value: "therapist", label: "Massage Therapist", sublabel: "Bodywork & recovery", icon: "💆" },
  { value: "nail_tech", label: "Nail Technician", sublabel: "Manicure & pedicure", icon: "💅" },
  { value: "aesthetician", label: "Aesthetician", sublabel: "Facials & skin care", icon: "✨" },
  { value: "driver", label: "Driver", sublabel: "Home service transport", icon: "🚗" },
  {
    value: "utility",
    label: "Utility / Housekeeping",
    sublabel: "Room prep & maintenance",
    icon: "🧹",
  },
  { value: "csr", label: "CSR / Front Desk", sublabel: "Customer service", icon: "🎧" },
  {
    value: "digital_marketer",
    label: "Social Media / Marketing",
    sublabel: "Content & public site",
    icon: "📣",
  },
  { value: "salon_head", label: "Salon Head", sublabel: "Salon department lead", icon: "👑" },
  { value: "managerial", label: "Manager", sublabel: "Management role", icon: "📊" },
  { value: "other", label: "Other / To be assigned", sublabel: "Role TBD", icon: "📋" },
] as const;

export type OnboardingRoleValue = (typeof ONBOARDING_ROLE_OPTIONS)[number]["value"];

const DIGITAL_MARKETING_ROLE_ALIASES = new Set([
  "digital_marketer",
  "social_media",
  "social_media_staff",
  "sm",
  "sm_staff",
  "marketing",
  "marketer",
]);

function normalizeOnboardingRole(value: string): string {
  const normalized = value.trim().toLowerCase();
  return DIGITAL_MARKETING_ROLE_ALIASES.has(normalized) ? "digital_marketer" : normalized;
}

export function getOnboardingRoleLabel(value: string): string {
  const normalized = normalizeOnboardingRole(value);
  return ONBOARDING_ROLE_OPTIONS.find((r) => r.value === normalized)?.label ?? value;
}

/**
 * Map applicant-facing role value to the DB staff_type.
 * All returned values must exist in the staff.staff_type CHECK constraint.
 */
export function mapPreferredRoleToStaffType(preferredRole: string): string {
  switch (normalizeOnboardingRole(preferredRole)) {
    case "therapist":
      return "therapist";
    case "nail_tech":
      return "nail_tech";
    case "aesthetician":
      return "aesthetician";
    case "driver":
      return "driver";
    case "utility":
      return "utility";
    case "csr":
      return "csr";
    case "digital_marketer":
      return "managerial";
    case "salon_head":
      return "salon_head";
    case "managerial":
      return "managerial";
    default:
      return "therapist"; // safe fallback
  }
}

/**
 * Map applicant-facing role value to the system role reviewers should approve.
 * This keeps access roles (workspace permissions) separate from staff_type.
 */
export function getRequestedSystemRoleForOnboardingRole(preferredRole: string): string {
  switch (normalizeOnboardingRole(preferredRole)) {
    case "csr":
      return "crm";
    case "driver":
      return "driver";
    case "utility":
      return "utility";
    case "digital_marketer":
      return "digital_marketer";
    case "managerial":
      return "manager";
    default:
      return "staff";
  }
}

/**
 * Reverse: given a staff_type, suggest the most likely onboarding role value.
 */
export function staffTypeToOnboardingRole(staffType: string): string {
  const match = ONBOARDING_ROLE_OPTIONS.find((r) => r.value === staffType);
  return match?.value ?? "other";
}
