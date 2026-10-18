import { redirect } from "next/navigation";
import { RetainedWorkspaceModule } from "@/components/features/dashboard/retained-workspace-provider";
import { OwnerOverviewRetainedWorkspace } from "@/components/features/owner/dashboard/owner-overview-retained-workspace";
import { OwnerDashboardAccessError } from "@/lib/queries/owner-dashboard";
import { loadOwnerOverviewWorkspaceData } from "@/lib/queries/owner-overview-workspace";

export const dynamic = "force-dynamic";

export default async function OwnerOverviewPage() {
  let payload;

  try {
    payload = await loadOwnerOverviewWorkspaceData();
  } catch (error) {
    if (error instanceof OwnerDashboardAccessError) {
      redirect(error.destination);
    }
    throw error;
  }

  return (
    <RetainedWorkspaceModule moduleId="owner-overview">
      <OwnerOverviewRetainedWorkspace initialPayload={payload} />
    </RetainedWorkspaceModule>
  );
}
