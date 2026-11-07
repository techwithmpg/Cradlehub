import { notFound } from "next/navigation";
import { BoutiqueAdminPreview } from "@/components/features/boutique/boutique-admin-preview";
import { isBoutiqueB1PreviewEnabled } from "@/lib/boutique/preview-access";
import { getCurrentUserWorkspaceAccess } from "@/lib/auth/get-user-workspace-access";
import { hasWorkspaceAccess } from "@/lib/auth/workspace-access";

export default async function OwnerBoutiquePreviewPage() {
  if (!isBoutiqueB1PreviewEnabled()) notFound();

  // Authoritative server-side workspace resolution; not a client-supplied role.
  const access = await getCurrentUserWorkspaceAccess();
  if (!access || !hasWorkspaceAccess(access.workspaces, "owner")) notFound();

  // No branch, financial, customer or product data is read by this B1 preview.
  return <BoutiqueAdminPreview workspace="owner" branchLabel="Owner · All branches (preview only)" />;
}
