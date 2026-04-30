import { PageHeader } from "@/components/features/dashboard/page-header";
import { getAllBranches } from "@/lib/queries/branches";
import { getAllServices } from "@/lib/queries/services";
import type { Database } from "@/types/supabase";
import { InviteStaffForm } from "./staff-invite-form";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"] & {
  service_categories: { id: string; name: string } | null;
};

export default async function InviteStaffPage() {
  const [branches, services] = await Promise.all([
    getAllBranches() as Promise<BranchRow[]>,
    getAllServices() as Promise<ServiceRow[]>,
  ]);

  return (
    <div style={{ maxWidth: 560 }}>
      <PageHeader
        title="Invite Staff"
        description="Staff will receive an email to set their password and access their workspace"
      />
      <InviteStaffForm branches={branches} services={services} />
    </div>
  );
}
