import { STAFF_TYPE_LABELS } from "@/constants/staff";
import { ROLE_LABELS } from "@/lib/permissions";
import type { Database } from "@/types/supabase";

type StaffRow = Database["public"]["Tables"]["staff"]["Row"];

export type StaffBranchRelation =
  | { id: string; name: string }
  | { id: string; name: string }[]
  | null;

export type StaffMember = Omit<StaffRow, "branch_id"> & {
  branch_id: string | null;
  branches: StaffBranchRelation;
  email?: string | null;
  job_title?: string | null;
};

export type StaffTab = "active" | "pending";
export type StaffStatus = "active" | "awaiting" | "invited" | "inactive";

export type StaffBranchGroup = {
  branchId: string;
  branchName: string;
  branchShortName: string;
  staff: StaffMember[];
};

export type StaffFilters = {
  search: string;
  branchId: string;
  role: string;
  status: string;
};

export type StaffDisplayRole = {
  roleLabel: string;
  shouldShowTier: boolean;
  tierLabel: string | null;
};

export const UNASSIGNED_BRANCH_ID = "__unassigned__";

const TIER_LABELS: Record<string, string> = {
  senior: "Senior",
  mid: "Mid",
  junior: "Junior",
};

const STAFF_TYPE_DISPLAY_LABELS: Record<string, string> = {
  ...STAFF_TYPE_LABELS,
  csr: "CSR",
  nail_tech: "Nail Technician",
  utility: "Utility",
};

const NON_TIER_ROLES = new Set([
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  "crm",
  "csr",
  "csr_head",
  "csr_staff",
  "service_head",
  "driver",
  "utility",
  "managerial",
  "salon_head",
]);

const ADMIN_ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Managerial",
  assistant_manager: "Managerial",
  store_manager: "Managerial",
  crm: "CRM",
  csr: "CSR",
  csr_head: "CSR Head",
  csr_staff: "CSR Staff",
  driver: "Driver",
  utility: "Utility",
};

const TIER_ELIGIBLE_STAFF_TYPES = new Set(["therapist"]);

const NON_TIER_STAFF_TYPES = new Set([
  "csr",
  "driver",
  "utility",
  "managerial",
  "salon_head",
]);

function titleCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function cleanOptionalText(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

export function readBranchName(relation: StaffBranchRelation): string {
  if (!relation) return "Unassigned Branch";
  if (Array.isArray(relation)) return relation[0]?.name ?? "Unassigned Branch";
  return relation.name;
}

export function getBranchShortName(branchName: string): string {
  if (branchName === "Unassigned Branch") return branchName;

  const shortened = branchName
    .replace(/^Cradle Wellness Living Inc\.?\s*/i, "")
    .replace(/^Cradle Wellness\s*/i, "")
    .trim();

  return shortened || branchName;
}

export function getStaffStatus(member: StaffMember): StaffStatus {
  if (member.is_active) return "active";
  if (!member.auth_user_id || member.full_name.toLowerCase() === "pending invitation") {
    return "invited";
  }
  return "awaiting";
}

export function getStaffStatusLabel(status: StaffStatus): string {
  const labels: Record<StaffStatus, string> = {
    active: "Active",
    awaiting: "Awaiting Approval",
    invited: "Invite Sent",
    inactive: "Inactive",
  };
  return labels[status];
}

export function getSystemRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? titleCase(role);
}

export function getStaffTypeLabel(staffType: string | null | undefined): string {
  if (!staffType) return "Staff";
  return STAFF_TYPE_DISPLAY_LABELS[staffType] ?? titleCase(staffType);
}

function getBaseStaffRoleLabel(member: StaffMember): string {
  const jobTitle = cleanOptionalText(member.job_title);
  const staffType = cleanOptionalText(member.staff_type);
  const role = member.system_role;

  if (jobTitle && jobTitle.toLowerCase() !== "pending invitation") {
    return jobTitle;
  }

  if (staffType === "managerial") return "Managerial";
  if (staffType === "salon_head") return "Salon Head";

  const protectedRoleLabel = ADMIN_ROLE_LABELS[role];
  if (protectedRoleLabel) return protectedRoleLabel;

  return getStaffTypeLabel(staffType);
}

export function getStaffDisplayRole(member: StaffMember): StaffDisplayRole {
  const staffType = cleanOptionalText(member.staff_type);
  const role = member.system_role;
  const roleLabel = getBaseStaffRoleLabel(member);
  const normalizedBase = roleLabel.toLowerCase();
  const hasTierInTitle =
    normalizedBase.includes("senior") ||
    normalizedBase.includes("mid") ||
    normalizedBase.includes("junior");

  const shouldShowTier =
    !!staffType &&
    TIER_ELIGIBLE_STAFF_TYPES.has(staffType) &&
    !NON_TIER_ROLES.has(role) &&
    !NON_TIER_STAFF_TYPES.has(staffType) &&
    !hasTierInTitle;
  const tierLabel = shouldShowTier ? TIER_LABELS[member.tier] ?? null : null;

  return {
    roleLabel,
    shouldShowTier,
    tierLabel,
  };
}

export function getStaffDisplayPosition(member: StaffMember): string {
  const { roleLabel, tierLabel } = getStaffDisplayRole(member);
  return tierLabel ? `${roleLabel} · ${tierLabel}` : roleLabel;
}

export function getStaffDisplaySubtitle(member: StaffMember): string {
  const parts = [getStaffDisplayPosition(member)];
  if (member.phone && member.phone !== "0000000000") {
    parts.push(member.phone);
  }
  return parts.join(" · ");
}

export function getInitials(name: string): string {
  const parts = name
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();

  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

export function formatStaffDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function groupStaffByBranch(staff: StaffMember[]): StaffBranchGroup[] {
  const groups = new Map<string, StaffBranchGroup>();

  for (const member of staff) {
    const branchId = member.branch_id ?? UNASSIGNED_BRANCH_ID;
    const branchName = readBranchName(member.branches);
    const existing = groups.get(branchId);

    if (existing) {
      existing.staff.push(member);
      continue;
    }

    groups.set(branchId, {
      branchId,
      branchName,
      branchShortName: getBranchShortName(branchName),
      staff: [member],
    });
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.branchId === UNASSIGNED_BRANCH_ID) return 1;
    if (b.branchId === UNASSIGNED_BRANCH_ID) return -1;
    return a.branchName.localeCompare(b.branchName);
  });
}

export function staffMatchesFilters(member: StaffMember, filters: StaffFilters): boolean {
  const status = getStaffStatus(member);
  const branchId = member.branch_id ?? UNASSIGNED_BRANCH_ID;
  const query = filters.search.trim().toLowerCase();
  const searchableText = [
    member.full_name,
    member.phone,
    member.email,
    readBranchName(member.branches),
    getBranchShortName(readBranchName(member.branches)),
    getStaffDisplayPosition(member),
    getStaffDisplaySubtitle(member),
    getSystemRoleLabel(member.system_role),
    getStaffTypeLabel(member.staff_type),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    (!query || searchableText.includes(query)) &&
    (filters.branchId === "all" || filters.branchId === branchId) &&
    (filters.role === "all" || filters.role === member.system_role) &&
    (filters.status === "all" || filters.status === status)
  );
}
