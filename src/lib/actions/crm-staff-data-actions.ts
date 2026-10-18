"use server";

import { loadCrmStaffWorkspaceData } from "@/lib/queries/crm-staff-workspace";
import type { CrmStaffWorkspaceData } from "@/components/features/crm/staff/crm-staff-workspace-data";

export async function refreshCrmStaffWorkspaceAction(): Promise<CrmStaffWorkspaceData> {
  const result = await loadCrmStaffWorkspaceData();

  if (result.status !== "ready") {
    throw new Error("CRM Staff workspace is unavailable for this session.");
  }

  return result.data;
}
