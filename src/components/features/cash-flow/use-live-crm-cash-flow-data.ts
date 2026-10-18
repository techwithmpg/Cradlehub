"use client";

import { useCallback, useEffect, useRef } from "react";
import { refreshCrmCashFlowWorkspaceAction } from "@/lib/actions/crm-cash-flow-data-actions";
import { useGenerationAwareWorkspaceSWR } from "@/components/features/dashboard/use-workspace-generation";
import { useWorkspaceModuleLifecycle } from "@/components/features/dashboard/use-workspace-visibility";
import {
  crmCashFlowRequestKey,
  type CrmCashFlowWorkspacePayload,
} from "./crm-cash-flow-workspace-data";

export function useLiveCrmCashFlowData(
  fallback: CrmCashFlowWorkspacePayload
) {
  const lifecycle = useWorkspaceModuleLifecycle();
  const request = fallback.request;
  const requestKey = crmCashFlowRequestKey(request);

  const fetcher = useCallback(
    () => refreshCrmCashFlowWorkspaceAction(request),
    [request]
  );

  const live =
    useGenerationAwareWorkspaceSWR<CrmCashFlowWorkspacePayload>(
      "crm-cash-flow",
      requestKey,
      fetcher,
      fallback
    );

  const {
    becameActiveAt,
    isActive,
    isRetained,
    isStale,
  } = lifecycle;
  const {
    isDirty,
    isRefreshing,
  } = live.generation;
  const { revalidate } = live;
  const staleRefreshActivation = useRef<number | null>(null);

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
      // Financial truth remains on the last validated payload.
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
