/**
 * Staff profile completeness evaluation.
 *
 * Used in staff portal alerts, manager/CRM review panels, and notification
 * generation. Does not depend on React or DB writes — pure evaluation.
 */

export interface StaffProfileCompleteness {
  isComplete: boolean;
  missingItems: string[];
  warnings: string[];
  percentComplete: number;
}

export interface StaffProfileInputs {
  fullName?: string | null;
  phone?: string | null;
  staffType?: string | null;
  branchId?: string | null;
  isActive?: boolean | null;
  tier?: string | null;
  serviceCount?: number;
  scheduleExists?: boolean;
}

const REQUIRED_FIELDS: { key: keyof StaffProfileInputs; label: string; check: (v: unknown) => boolean }[] = [
  { key: "fullName",  label: "Full name",         check: (v) => typeof v === "string" && v.trim().length > 0 },
  { key: "phone",     label: "Contact phone",     check: (v) => typeof v === "string" && v.trim().length > 0 },
  { key: "staffType", label: "Job role / staff type", check: (v) => typeof v === "string" && v.trim().length > 0 },
  { key: "branchId",  label: "Branch assignment", check: (v) => typeof v === "string" && v.trim().length > 0 },
];

/**
 * Evaluate how complete a staff profile is.
 *
 * Rules:
 * - name, contact, staff_type, branch = required
 * - if therapist: tier must be assigned (not "n/a" or missing)
 * - service capabilities OR legacy fallback warning
 * - schedule is a soft requirement (warns but does not block completeness)
 */
export function evaluateStaffProfileCompleteness(
  inputs: StaffProfileInputs
): StaffProfileCompleteness {
  const missingItems: string[] = [];
  const warnings: string[] = [];

  // Required fields
  for (const field of REQUIRED_FIELDS) {
    if (!field.check(inputs[field.key])) {
      missingItems.push(field.label);
    }
  }

  // Active status
  if (inputs.isActive !== true) {
    missingItems.push("Account activation");
  }

  // Therapist tier check
  const isTherapist = inputs.staffType === "therapist";
  if (isTherapist) {
    const hasTier = typeof inputs.tier === "string" && inputs.tier !== "n/a" && inputs.tier.trim().length > 0;
    if (!hasTier) {
      missingItems.push("Therapist level (Junior / Mid / Senior)");
    }
  }

  // Service capabilities
  const hasServices = typeof inputs.serviceCount === "number" && inputs.serviceCount > 0;
  if (!hasServices) {
    warnings.push(
      "Service capabilities are not configured. This staff member is temporarily using legacy scheduling behavior."
    );
  }

  // Schedule
  if (inputs.scheduleExists === false) {
    warnings.push("No weekly schedule is set. This staff member will not appear in availability searches.");
  }

  const totalChecks = REQUIRED_FIELDS.length + 1 + (isTherapist ? 1 : 0); // fields + active + maybe tier
  const passedChecks = totalChecks - missingItems.length;
  const percentComplete = Math.round((passedChecks / totalChecks) * 100);

  return {
    isComplete: missingItems.length === 0,
    missingItems,
    warnings,
    percentComplete,
  };
}

/**
 * Quick check: is this staff member a therapist-type role?
 */
export function isTherapistRole(staffType: string | null | undefined): boolean {
  if (!staffType) return false;
  return staffType === "therapist" || staffType === "salon_head";
}

/**
 * Quick check: does this staff type require a tier/level assignment?
 */
export function requiresTierAssignment(staffType: string | null | undefined): boolean {
  return isTherapistRole(staffType);
}
