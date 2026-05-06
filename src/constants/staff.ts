export const STAFF_TYPES = [
  "therapist",
  "nail_tech",
  "aesthetician",
  "csr",
  "driver",
  "utility",
  "salon_head",
  "managerial",
] as const;

export type StaffType = (typeof STAFF_TYPES)[number];

export const STAFF_TYPE_LABELS: Record<StaffType, string> = {
  therapist: "Therapist",
  nail_tech: "Nail Tech",
  aesthetician: "Aesthetician / Facialist",
  csr: "CSR / Front Desk",
  driver: "Driver",
  utility: "Utility",
  salon_head: "Salon Head",
  managerial: "Managerial",
};

/**
 * system_role controls app access and dashboard routing
 * (owner | manager | crm | csr | csr_head | csr_staff | staff).
 * staff_type describes the person's real job function in the spa.
 */
