"use server";

import type { OwnerOverviewWorkspacePayload } from "@/components/features/owner/dashboard/owner-overview-workspace-data";
import { loadOwnerOverviewWorkspaceData } from "@/lib/queries/owner-overview-workspace";

export async function refreshOwnerOverviewWorkspaceAction(): Promise<OwnerOverviewWorkspacePayload> {
  return loadOwnerOverviewWorkspaceData();
}
