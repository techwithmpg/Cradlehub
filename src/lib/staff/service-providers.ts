import { canonicalizeSystemRole, isServiceStaffType } from "@/constants/staff-roles";

const NON_SERVICE_SYSTEM_ROLES = new Set([
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  "crm",
  "driver",
  "utility",
]);

const HARD_EXCLUDED_SYSTEM_ROLES = new Set(["driver", "utility"]);

export type ServiceProviderCandidate = {
  is_active?: boolean | null;
  staff_type?: string | null;
  system_role?: string | null;
};

export type ServiceCapabilityContext = {
  name?: string | null;
  categoryName?: string | null;
};

export function isNonServiceSystemRole(role: string | null | undefined): boolean {
  return role ? NON_SERVICE_SYSTEM_ROLES.has(canonicalizeSystemRole(role)) : false;
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

function includesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

export function staffTypeCanPerformService(
  staffType: string | null | undefined,
  service?: ServiceCapabilityContext | null
): boolean {
  if (!isServiceStaffType(staffType)) return false;

  const serviceText = `${service?.name ?? ""} ${service?.categoryName ?? ""}`
    .toLowerCase()
    .trim();

  if (!serviceText) return true;

  if (staffType === "therapist") {
    return includesAny(serviceText, [
      "massage",
      "therapy",
      "therapist",
      "reflexology",
      "hilot",
      "shiatsu",
      "thai",
      "stone",
      "ventosa",
      "aromatherapy",
      "lomi",
      "sports",
      "prenatal",
      "post natal",
      "body scrub",
      "body wrap",
      "spa party",
      "package",
    ]);
  }

  if (staffType === "nail_tech") {
    return includesAny(serviceText, [
      "nail",
      "manicure",
      "pedicure",
      "mani",
      "pedi",
      "gel",
      "polish",
      "foot spa",
      "foot scrub",
      "orly",
    ]);
  }

  if (staffType === "aesthetician") {
    return includesAny(serviceText, [
      "facial",
      "skin",
      "aesthetic",
      "laser",
      "pico",
      "hydra",
      "dermabrasion",
      "underarm",
      "wax",
      "bikini",
      "carbon",
      "tattoo",
      "cleansing",
      "mask",
      "body scrub",
      "body wrap",
    ]);
  }

  if (staffType === "salon_head") {
    return includesAny(serviceText, [
      "salon",
      "hair",
      "shampoo",
      "blowdry",
      "rebond",
      "keratin",
      "color",
      "make up",
      "makeup",
      "lash",
      "eyebrow",
      "threading",
    ]);
  }

  return false;
}
