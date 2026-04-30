import { PageHeader } from "@/components/features/dashboard/page-header";
import { getAllBranches } from "@/lib/queries/branches";
import type { Database } from "@/types/supabase";
import { InviteForm } from "./invite-form";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

export default async function InvitePage() {
  const branches = (await getAllBranches()) as BranchRow[];

  return (
    <div style={{ maxWidth: 560 }}>
      <PageHeader
        title="Invite Staff"
        description="Generate a shareable invite link. Staff will self-onboard and appear in Pending Approvals."
      />
      <InviteForm branches={branches} />
    </div>
  );
}
