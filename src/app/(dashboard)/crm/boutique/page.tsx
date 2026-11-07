import { notFound } from "next/navigation";
import { BoutiqueAdminPreview } from "@/components/features/boutique/boutique-admin-preview";
import {
  canViewBoutiquePreviewWorkspace,
  isBoutiqueB1PreviewEnabled,
} from "@/lib/boutique/preview-access";
import { getFrontDeskContext } from "@/lib/queries/crm-context";

export default async function CrmBoutiquePreviewPage() {
  if (!isBoutiqueB1PreviewEnabled()) notFound();

  // This resolver authenticates staff and determines their real operational branch.
  // Never accept a branch ID or role from URL/search params or the browser.
  const context = await getFrontDeskContext();
  if (!canViewBoutiquePreviewWorkspace(context.role, "crm", context.branchId)) notFound();

  // The read-only component receives only display context; it cannot query another branch.
  return <BoutiqueAdminPreview workspace="crm" branchLabel={context.branchName} />;
}
