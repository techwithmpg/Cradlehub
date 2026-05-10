import { StaffManagementWorkspace } from "@/components/features/staff/staff-management-workspace";
import type { StaffMember, StaffTab } from "@/components/features/staff/staff-management-utils";
import { getStaffByBranchWithBranches, getPendingStaffByBranch } from "@/lib/queries/staff";
import { getManagerBranchId } from "@/lib/queries/manager-context";

export default async function ManagerStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const branchId = await getManagerBranchId();
  const resolvedSearchParams = await searchParams;
  const initialTab: StaffTab = resolvedSearchParams.tab === "pending" ? "pending" : "active";

  const [allStaff, pendingStaff] = await Promise.all([
    getStaffByBranchWithBranches(branchId),
    getPendingStaffByBranch(branchId),
  ]);

  return (
    <StaffManagementWorkspace
      allStaff={allStaff as StaffMember[]}
      pendingStaff={pendingStaff as StaffMember[]}
      initialTab={initialTab}
      workspaceContext="manager"
    />
  );
}
