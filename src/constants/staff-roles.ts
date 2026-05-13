export const SYSTEM_ROLES = [
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  "crm",
  "csr",
  "csr_head",
  "csr_staff",
  "staff",
  "service_head",
  "service_staff",
  "driver",
  "utility",
] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const SYSTEM_ROLE_LABELS: Record<SystemRole, string> = {
  owner: "Owner",
  manager: "Manager",
  assistant_manager: "Assistant Manager",
  store_manager: "Store Manager",
  crm: "CRM",
  csr: "CSR",
  csr_head: "CSR Head",
  csr_staff: "CSR Staff",
  staff: "Staff",
  service_head: "Service Head",
  service_staff: "Service Staff",
  driver: "Driver",
  utility: "Utility",
};

export const SYSTEM_ROLE_DESCRIPTIONS: Record<SystemRole, string> = {
  owner: "Full owner workspace and administration access.",
  manager: "Manager workspace for branch and operations leadership.",
  assistant_manager: "Manager workspace for assistant branch leadership.",
  store_manager: "Manager workspace for store-level leadership.",
  crm: "CRM workspace for customer records, reports, and booking support.",
  csr: "Legacy front-desk access.",
  csr_head: "Front-desk supervisor access.",
  csr_staff: "Front-desk booking and customer support access.",
  staff: "Staff portal access.",
  service_head: "Staff portal access for service supervisors.",
  service_staff: "Staff portal access for service providers.",
  driver: "Driver workspace access.",
  utility: "Utility workspace access.",
};

export type SystemRoleOption = {
  value: SystemRole;
  label: string;
  description: string;
};

export const SYSTEM_ROLE_OPTIONS = SYSTEM_ROLES.map((role) => ({
  value: role,
  label: SYSTEM_ROLE_LABELS[role],
  description: SYSTEM_ROLE_DESCRIPTIONS[role],
})) satisfies SystemRoleOption[];

export const OWNER_ASSIGNABLE_SYSTEM_ROLES = SYSTEM_ROLES;

export const MANAGER_ASSIGNABLE_SYSTEM_ROLES = [
  "crm",
  "csr_head",
  "csr_staff",
  "csr",
  "staff",
  "service_head",
  "service_staff",
  "driver",
  "utility",
] as const satisfies readonly SystemRole[];

export type ManagerAssignableSystemRole = (typeof MANAGER_ASSIGNABLE_SYSTEM_ROLES)[number];

export const HIGH_LEVEL_SYSTEM_ROLES = [
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
] as const satisfies readonly SystemRole[];

export const DEFENSIVE_ADMIN_SYSTEM_ROLES = [
  "branch_manager",
  "super_admin",
  "platform_admin",
] as const;

export const SENSITIVE_SYSTEM_ROLES = [
  ...HIGH_LEVEL_SYSTEM_ROLES,
  ...DEFENSIVE_ADMIN_SYSTEM_ROLES,
] as const;

export type SensitiveSystemRole = (typeof SENSITIVE_SYSTEM_ROLES)[number];

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

export const STAFF_TYPE_DESCRIPTIONS: Record<StaffType, string> = {
  therapist: "Spa therapy service provider.",
  nail_tech: "Nail service provider.",
  aesthetician: "Facial and aesthetic service provider.",
  csr: "Customer service and front-desk function.",
  driver: "Driver function for transport operations.",
  utility: "Utility and general staff function.",
  salon_head: "Service section supervisor function.",
  managerial: "Managerial or owner function.",
};

export type StaffTypeOption = {
  value: StaffType;
  label: string;
  description: string;
};

export const STAFF_TYPE_OPTIONS = STAFF_TYPES.map((staffType) => ({
  value: staffType,
  label: STAFF_TYPE_LABELS[staffType],
  description: STAFF_TYPE_DESCRIPTIONS[staffType],
})) satisfies StaffTypeOption[];

export const SERVICE_STAFF_TYPES = [
  "therapist",
  "nail_tech",
  "aesthetician",
  "salon_head",
] as const satisfies readonly StaffType[];

export type ServiceStaffType = (typeof SERVICE_STAFF_TYPES)[number];

const MANAGER_ACCESS_ROLES = new Set<string>(["manager", "assistant_manager", "store_manager"]);

export function isSystemRole(value: string): value is SystemRole {
  return SYSTEM_ROLES.includes(value as SystemRole);
}

export function isManagerAssignableSystemRole(value: string): value is ManagerAssignableSystemRole {
  return MANAGER_ASSIGNABLE_SYSTEM_ROLES.includes(value as ManagerAssignableSystemRole);
}

export function isSensitiveSystemRole(value: string): boolean {
  return SENSITIVE_SYSTEM_ROLES.includes(value as SensitiveSystemRole);
}

export function getAssignableSystemRoles(assignerRole: string): readonly SystemRole[] {
  if (assignerRole === "owner") return OWNER_ASSIGNABLE_SYSTEM_ROLES;
  if (MANAGER_ACCESS_ROLES.has(assignerRole)) return MANAGER_ASSIGNABLE_SYSTEM_ROLES;
  return [];
}

export function getSystemRoleOptionsForAssigner(assignerRole: string): SystemRoleOption[] {
  const assignableRoles = getAssignableSystemRoles(assignerRole);
  return SYSTEM_ROLE_OPTIONS.filter((option) => assignableRoles.includes(option.value));
}

export function isStaffType(value: string): value is StaffType {
  return STAFF_TYPES.includes(value as StaffType);
}

export function isServiceStaffType(value: string | null | undefined): value is ServiceStaffType {
  return SERVICE_STAFF_TYPES.includes(value as ServiceStaffType);
}
