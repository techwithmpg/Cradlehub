import { Badge } from "@/components/ui/badge";
import { getStaffStatusLabel, getSystemRoleLabel, type StaffStatus } from "./staff-management-utils";

const statusClassNames: Record<StaffStatus, string> = {
  active: "border-[#CFE4D5] bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]",
  awaiting: "border-[#E7D9B8] bg-[var(--cs-warning-bg)] text-[var(--cs-warning-text)]",
  invited: "border-[#D7DDEE] bg-[var(--cs-info-bg)] text-[var(--cs-info-text)]",
  inactive: "border-[var(--cs-border)] bg-[var(--cs-neutral-bg)] text-[var(--cs-neutral-text)]",
};

function getRoleClassName(role: string): string {
  if (role === "owner") return "border-[#DED0E7] bg-[var(--cs-owner-bg)] text-[var(--cs-owner-text)]";
  if (role === "manager" || role === "assistant_manager" || role === "store_manager") {
    return "border-[#CFDAE2] bg-[var(--cs-manager-bg)] text-[var(--cs-manager-text)]";
  }
  if (role === "crm") return "border-[#D0E6D7] bg-[var(--cs-crm-bg)] text-[var(--cs-crm-text)]";
  if (role === "csr_head") return "border-[#E4D8B6] bg-[var(--cs-csr-head-bg)] text-[var(--cs-csr-head-text)]";
  if (role === "csr" || role === "csr_staff") {
    return "border-[#E7DDC8] bg-[var(--cs-csr-staff-bg)] text-[var(--cs-csr-staff-text)]";
  }
  if (role === "driver" || role === "utility") {
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

export function StaffRoleBadge({ role }: { role: string }) {
  return (
    <Badge variant="outline" className={getRoleClassName(role)}>
      {getSystemRoleLabel(role)}
    </Badge>
  );
}
