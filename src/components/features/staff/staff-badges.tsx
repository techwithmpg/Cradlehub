import { Badge } from "@/components/ui/badge";
import { canonicalizeSystemRole } from "@/constants/staff-roles";
import {
  getStaffDisplayMeta,
  getStaffStatusLabel,
  getSystemRoleLabel,
  type StaffMember,
  type StaffStatus,
} from "./staff-management-utils";

const statusClassNames: Record<StaffStatus, string> = {
  active: "border-[#CFE4D5] bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]",
  awaiting: "border-[#E7D9B8] bg-[var(--cs-warning-bg)] text-[var(--cs-warning-text)]",
  invited: "border-[#D7DDEE] bg-[var(--cs-info-bg)] text-[var(--cs-info-text)]",
  inactive: "border-[var(--cs-border)] bg-[var(--cs-neutral-bg)] text-[var(--cs-neutral-text)]",
};

function getRoleClassName(role: string): string {
  const canonicalRole = canonicalizeSystemRole(role);
  if (canonicalRole === "owner") return "border-[#DED0E7] bg-[var(--cs-owner-bg)] text-[var(--cs-owner-text)]";
  if (canonicalRole === "manager" || canonicalRole === "assistant_manager" || canonicalRole === "store_manager") {
    return "border-[#CFDAE2] bg-[var(--cs-manager-bg)] text-[var(--cs-manager-text)]";
  }
  if (canonicalRole === "crm") return "border-[#D0E6D7] bg-[var(--cs-crm-bg)] text-[var(--cs-crm-text)]";
  if (canonicalRole === "driver" || canonicalRole === "utility") {
    return "border-[var(--cs-border)] bg-[var(--cs-neutral-bg)] text-[var(--cs-neutral-text)]";
  }
  return "border-[#E1D2CA] bg-[var(--cs-staff-bg)] text-[var(--cs-staff-text)]";
}

export function StaffStatusBadge({ status }: { status: StaffStatus }) {
  return (
    <Badge variant="outline" className={statusClassNames[status]}>
      {getStaffStatusLabel(status)}
    </Badge>
  );
}

export function StaffRoleBadge({ role, staff }: { role?: string; staff?: StaffMember }) {
  const resolvedRole = staff?.system_role ?? role ?? "staff";
  const label = staff ? getStaffDisplayMeta(staff).badgeLabel : getSystemRoleLabel(resolvedRole);

  return (
    <Badge variant="outline" className={getRoleClassName(resolvedRole)}>
      {label}
    </Badge>
  );
}
