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

export const UNASSIGNED_BRANCH_ID = "__unassigned__";

const TIER_LABELS: Record<string, string> = {
  senior: "Senior",
  mid: "Mid",
  junior: "Junior",
};

const STAFF_TYPE_DISPLAY_LABELS: Record<string, string> = {
  ...STAFF_TYPE_LABELS,
  nail_tech: "Nail Technician",
  utility: "Utility / Maintenance",
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

function getManagerFallbackLabel(member: StaffMember, roleLabel: string): string | null {
  const branchShortName = getBranchShortName(readBranchName(member.branches));

  if (member.system_role === "manager") return "Manager Main/SM Branch";
  if (member.system_role === "assistant_manager") return "Asst. Manager Main/SM Branch";
  if (member.system_role === "store_manager") return `${roleLabel} ${branchShortName}`;
  if (member.system_role === "utility") return "Utility / Maintenance";

  return null;
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

export function getStaffDisplayPosition(member: StaffMember): string {
  const jobTitle = cleanOptionalText(member.job_title);
  const staffType = cleanOptionalText(member.staff_type);
  const role = member.system_role;
  const roleLabel = getSystemRoleLabel(role);
  const staffTypeLabel = getStaffTypeLabel(staffType);
  const managerFallbackLabel = getManagerFallbackLabel(member, roleLabel);

  let baseLabel: string;
  if (jobTitle && jobTitle.toLowerCase() !== "pending invitation") {
    baseLabel = jobTitle;
  } else if (managerFallbackLabel) {
    baseLabel = managerFallbackLabel;
  } else if (role === "service_head" && staffType === "salon_head") {
    baseLabel = staffTypeLabel;
  } else if (NON_TIER_ROLES.has(role) || role === "service_head") {
    baseLabel = roleLabel;
  } else {
    baseLabel = staffTypeLabel;
  }

  const normalizedBase = baseLabel.toLowerCase();
  const hasTierInTitle =
    normalizedBase.includes("senior") ||
    normalizedBase.includes("mid") ||
    normalizedBase.includes("junior");
  const canShowTier =
    staffType === "therapist" &&
    !NON_TIER_ROLES.has(role) &&
    !NON_TIER_STAFF_TYPES.has(staffType) &&
    !hasTierInTitle;
  const tierLabel = canShowTier ? TIER_LABELS[member.tier] : undefined;

  return tierLabel ? `${baseLabel} · ${tierLabel}` : baseLabel;
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
