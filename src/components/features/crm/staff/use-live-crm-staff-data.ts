"use client";

import { useCallback, useEffect, useRef } from "react";
import { refreshCrmStaffWorkspaceAction } from "@/lib/actions/crm-staff-data-actions";
import { useGenerationAwareWorkspaceSWR } from "@/components/features/dashboard/use-workspace-generation";
import { useWorkspaceModuleLifecycle } from "@/components/features/dashboard/use-workspace-visibility";
import type { CrmStaffWorkspaceData } from "./crm-staff-workspace-data";

const CRM_STAFF_REQUEST_KEY = "/crm/staff";

export function useLiveCrmStaffData(
  fallbackData: CrmStaffWorkspaceData
) {
  const lifecycle = useWorkspaceModuleLifecycle();
  const fetcher = useCallback(
    () => refreshCrmStaffWorkspaceAction(),
    []
  );

  const live = useGenerationAwareWorkspaceSWR<CrmStaffWorkspaceData>(
    "crm-staff",
    CRM_STAFF_REQUEST_KEY,
    fetcher,
    fallbackData
  );

  const {
    becameActiveAt,
    isActive,
    isRetained,
    isStale,
  } = lifecycle;
  const staleRefreshActivation = useRef<number | null>(null);
  const {
    isDirty,
    isRefreshing,
  } = live.generation;

  const { revalidate } = live;

  useEffect(() => {
    if (
      !isRetained ||
      !isActive ||
      !isStale ||
      isDirty ||
      isRefreshing ||
      becameActiveAt === null ||
      staleRefreshActivation.current === becameActiveAt
    ) {
      return;
    }

    staleRefreshActivation.current = becameActiveAt;
    void revalidate().catch(() => {
      // Preserve the last validated Staff payload; the workspace exposes retry UI.
    });
  }, [
    becameActiveAt,
    isActive,
    isDirty,
    isRefreshing,
    isRetained,
    isStale,
    revalidate,
  ]);

  return live;
}
