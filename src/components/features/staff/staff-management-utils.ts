import { STAFF_TYPE_LABELS, SYSTEM_ROLE_LABELS } from "@/constants/staff";
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

export type StaffDisplayMeta = StaffDisplayRole & {
  staffTypeLabel: string;
  badgeLabel: string;
  badgeVariant: string;
  subtitleParts: string[];
  subtitle: string;
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

const TIER_ELIGIBLE_STAFF_TYPES = new Set(["therapist", "nail_tech", "aesthetician"]);
const TIER_ELIGIBLE_SYSTEM_ROLES = new Set(["staff", "service_staff"]);

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
  return SYSTEM_ROLE_LABELS[role as keyof typeof SYSTEM_ROLE_LABELS] ?? titleCase(role);
}

export function getStaffTypeLabel(staffType: string | null | undefined): string {
  if (!staffType) return "Staff";
  return STAFF_TYPE_DISPLAY_LABELS[staffType] ?? titleCase(staffType);
}

function getStaffTypeLabelForDisplay(member: StaffMember): string {
  return getStaffTypeLabel(member.staff_type);
}

function getPrimaryRoleLabel(member: StaffMember): string {
  const jobTitle = cleanOptionalText(member.job_title);

  if (jobTitle && jobTitle.toLowerCase() !== "pending invitation") {
    return jobTitle;
  }

  return getSystemRoleLabel(member.system_role);
}

function isNonTierJobTitle(jobTitle: string | null): boolean {
  if (!jobTitle) return false;

  const normalized = jobTitle.toLowerCase();
  return (
    normalized.includes("manager") ||
    normalized.includes("owner") ||
    normalized.includes("csr") ||
    normalized.includes("driver") ||
    normalized.includes("utility") ||
    normalized.includes("salon head")
  );
}

export function getStaffDisplayMeta(member: StaffMember): StaffDisplayMeta {
  const jobTitle = cleanOptionalText(member.job_title);
  const staffType = cleanOptionalText(member.staff_type);
  const role = member.system_role;
  const roleLabel = getPrimaryRoleLabel(member);
  const staffTypeLabel = getStaffTypeLabelForDisplay(member);
  const badgeLabel = getSystemRoleLabel(role);
  const normalizedBase = roleLabel.toLowerCase();
  const hasTierInTitle =
    normalizedBase.includes("senior") ||
    normalizedBase.includes("mid") ||
    normalizedBase.includes("junior");
  const rawTierLabel = TIER_LABELS[member.tier] ?? null;
  const hasServiceTierStaffType = staffType ? TIER_ELIGIBLE_STAFF_TYPES.has(staffType) : true;

  const shouldShowTier =
    !!rawTierLabel &&
    TIER_ELIGIBLE_SYSTEM_ROLES.has(role) &&
    hasServiceTierStaffType &&
    !NON_TIER_ROLES.has(role) &&
    !NON_TIER_STAFF_TYPES.has(staffType ?? "") &&
    !isNonTierJobTitle(jobTitle) &&
    !hasTierInTitle;
  const tierLabel = shouldShowTier ? rawTierLabel : null;
  const subtitleParts = [
    staffTypeLabel,
    member.is_head ? "Head / Supervisor" : null,
    tierLabel,
    member.phone && member.phone !== "0000000000" ? member.phone : null,
  ].filter((part): part is string => Boolean(part));

  return {
    roleLabel,
    staffTypeLabel,
    badgeLabel,
    badgeVariant: role,
    shouldShowTier,
    tierLabel,
    subtitleParts,
    subtitle: subtitleParts.join(" · "),
  };
}

export function getStaffDisplayRole(member: StaffMember): StaffDisplayRole {
  const { roleLabel, shouldShowTier, tierLabel } = getStaffDisplayMeta(member);
  return { roleLabel, shouldShowTier, tierLabel };
}

export function getStaffDisplayPosition(member: StaffMember): string {
  const { roleLabel, tierLabel } = getStaffDisplayMeta(member);
  return tierLabel ? `${roleLabel} · ${tierLabel}` : roleLabel;
}

export function getStaffDisplaySubtitle(member: StaffMember): string {
  return getStaffDisplayMeta(member).subtitle;
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
  const meta = getStaffDisplayMeta(member);
  const searchableText = [
    member.full_name,
    member.phone,
    member.email,
    readBranchName(member.branches),
    getBranchShortName(readBranchName(member.branches)),
    meta.roleLabel,
    meta.staffTypeLabel,
    meta.badgeLabel,
    meta.subtitle,
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
