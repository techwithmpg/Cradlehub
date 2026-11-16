export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CrmOperationalPageShell } from "@/components/features/crm/operational/crm-operational-page-shell";
import { CrmBoutiqueWorkspace } from "@/components/features/crm/boutique/crm-boutique-workspace";
import { RetainedWorkspaceModule } from "@/components/features/dashboard/retained-workspace-provider";
import {
  loadCrmBoutiqueWorkspaceData,
} from "@/lib/boutique/crm-boutique-data";
import { normalizeCrmBoutiqueTab } from "@/lib/boutique/crm-boutique-model";
import { getFrontDeskContext } from "@/lib/queries/crm-context";

export const metadata: Metadata = {
  title: "Boutique Management — CRM",
};

export default async function CrmBoutiquePage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const context = await getFrontDeskContext();
  if (!context.capabilities.canManageBoutique) {
    redirect("/crm");
  }

  const params = searchParams ? await searchParams : {};
  const initialTab = normalizeCrmBoutiqueTab(params.tab);
  const workspaceData = await loadCrmBoutiqueWorkspaceData(context);

  return (
    <RetainedWorkspaceModule moduleId="crm-boutique">
      <CrmOperationalPageShell
        title="Boutique Management"
        description="Inspect canonical Cradle Boutique products, categories, gift options, branch pickup readiness, and operational authorization boundaries."
        context={`${context.branchName} · ${context.role} view`}
      >
        <CrmBoutiqueWorkspace data={workspaceData} initialTab={initialTab} />
      </CrmOperationalPageShell>
    </RetainedWorkspaceModule>
  );
}
