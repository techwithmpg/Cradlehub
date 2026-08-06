import { PageHeader } from "@/components/features/dashboard/page-header";
import { getAllBranches } from "@/lib/queries/branches";
import {
  branchServicesToServiceProfileRows,
  getBranchAssignableServices,
} from "@/lib/services/service-catalog";
import type { Database } from "@/types/supabase";
import { InviteStaffForm } from "./staff-invite-form";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"] & {
  service_categories: { id: string; name: string } | null;
};

export default async function InviteStaffPage() {
  const branches = (await getAllBranches()) as BranchRow[];
  const branchServiceEntries = await Promise.all(
    branches.map(async (branch) => {
      const branchServices = await getBranchAssignableServices(branch.id, {
        useAdminClient: true,
      });
      return [
        branch.id,
        branchServicesToServiceProfileRows(branchServices) as ServiceRow[],
      ] as const;
    })
  );
  const servicesByBranch = Object.fromEntries(branchServiceEntries);

  return (
    <div style={{ maxWidth: 560 }}>
      <PageHeader
        title="Invite Staff"
        description="Staff will receive an email to set their password and access their workspace"
      />
      <InviteStaffForm branches={branches} servicesByBranch={servicesByBranch} />
    </div>
  );
}
