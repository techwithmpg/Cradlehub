"use client";

import { useCallback, useEffect, useRef } from "react";
import { useGenerationAwareWorkspaceSWR } from "@/components/features/dashboard/use-workspace-generation";
import { useWorkspaceModuleLifecycle } from "@/components/features/dashboard/use-workspace-visibility";
import { refreshOwnerOverviewWorkspaceAction } from "@/lib/actions/owner-overview-data-actions";
import {
  OWNER_OVERVIEW_REQUEST_KEY,
  type OwnerOverviewWorkspacePayload,
} from "./owner-overview-workspace-data";

export function useLiveOwnerOverviewData(
  fallback: OwnerOverviewWorkspacePayload
) {
  const lifecycle = useWorkspaceModuleLifecycle();
  const fetcher = useCallback(
    () => refreshOwnerOverviewWorkspaceAction(),
    []
  );

  const live =
    useGenerationAwareWorkspaceSWR<OwnerOverviewWorkspacePayload>(
      "owner-overview",
      OWNER_OVERVIEW_REQUEST_KEY,
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
      // Keep the last validated Owner Overview payload visible.
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
