import { notFound } from "next/navigation";
import { getStaffByBranchWithBranches, getPendingStaffByBranch, getStaffServices } from "@/lib/queries/staff";
import { getManagerBranchId } from "@/lib/queries/manager-context";
import { getAllServices } from "@/lib/queries/services";
import { getBranchById } from "@/lib/queries/branches";
import { StaffApprovalWorkspace } from "@/components/features/staff/staff-approval-workspace";
import type { StaffMember } from "@/components/features/staff/staff-management-utils";
import type { Database } from "@/types/supabase";

type ServiceRow = Database["public"]["Tables"]["services"]["Row"] & {
  service_categories: { id: string; name: string } | null;
};

export default async function ManagerStaffDetailPage({
  params,
}: {
  params: Promise<{ staffId: string }>;
}) {
  const { staffId } = await params;
  const branchId = await getManagerBranchId();

  const [activeStaff, pendingStaff, services, branch] = await Promise.all([
    getStaffByBranchWithBranches(branchId),
    getPendingStaffByBranch(branchId),
    getAllServices(),
    getBranchById(branchId),
  ]);

  const allBranchStaff = [...activeStaff, ...pendingStaff] as StaffMember[];
  const staffMember = allBranchStaff.find((s) => s.id === staffId);

  if (!staffMember) {
    notFound();
  }

  const staffServiceIds = await getStaffServices(staffId);

  return (
    <div style={{ maxWidth: 1100 }}>
      <StaffApprovalWorkspace
        staffMember={staffMember}
        branch={branch ?? null}
        services={services as ServiceRow[]}
        staffServiceIds={staffServiceIds}
      />
    </div>
  );
}
