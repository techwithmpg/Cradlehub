import { PageHeader } from "@/components/features/dashboard/page-header";
import { getAllBranches } from "@/lib/queries/branches";
import type { Database } from "@/types/supabase";
import { InviteStaffForm } from "./staff-invite-form";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

export default async function InviteStaffPage() {
  const branches = (await getAllBranches()) as BranchRow[];

  return (
    <div style={{ maxWidth: 560 }}>
      <PageHeader
        title="Invite Staff"
        description="Staff will receive an email to set their password and access their workspace"
      />
      <InviteStaffForm branches={branches} />
    </div>
  );
}
