"use client";

import { useCallback } from "react";
import { refreshCrmStaffWorkspaceAction } from "@/lib/actions/crm-staff-data-actions";
import { useGenerationAwareWorkspaceSWR } from "@/components/features/dashboard/use-workspace-generation";
import type { CrmStaffWorkspaceData } from "./crm-staff-workspace-data";

const CRM_STAFF_REQUEST_KEY = "/crm/staff";

export function useLiveCrmStaffData(
  fallbackData: CrmStaffWorkspaceData
) {
  const fetcher = useCallback(
    () => refreshCrmStaffWorkspaceAction(),
    []
  );

  return useGenerationAwareWorkspaceSWR<CrmStaffWorkspaceData>(
    "crm-staff",
    CRM_STAFF_REQUEST_KEY,
    fetcher,
    fallbackData
  );
}
