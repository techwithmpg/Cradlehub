"use client";

import { createContext, useCallback, useContext, useEffect, useRef } from "react";

export type WorkspaceModuleLifecycleValue = {
  isActive: boolean;
  isRetained: boolean;
  isDirty: boolean;
  isStale: boolean;
  isRefreshing: boolean;
  hasUnsavedChanges: boolean;
  becameActiveAt: number | null;
  markDirty: () => void;
  markClean: () => void;
  setRefreshing: (refreshing: boolean) => void;
  setUnsavedChanges: (unsaved: boolean) => void;
};

const NOOP = () => undefined;

const UNRETAINED_LIFECYCLE: WorkspaceModuleLifecycleValue = {
  isActive: true,
  isRetained: false,
  isDirty: false,
  isStale: false,
  isRefreshing: false,
  hasUnsavedChanges: false,
  becameActiveAt: null,
  markDirty: NOOP,
  markClean: NOOP,
  setRefreshing: NOOP,
  setUnsavedChanges: NOOP,
};

export const WorkspaceModuleLifecycleContext =
  createContext<WorkspaceModuleLifecycleValue | null>(null);

export function useWorkspaceModuleLifecycle(): WorkspaceModuleLifecycleValue {
  return useContext(WorkspaceModuleLifecycleContext) ?? UNRETAINED_LIFECYCLE;
}

/**
 * Reconciles an SWR-backed module once when a stale or dirty retained instance
 * becomes visible. Current data stays rendered while the promise runs.
 */
export function useWorkspaceReactivationRefresh(
  refresh: () => Promise<unknown>
): () => Promise<void> {
  const lifecycle = useWorkspaceModuleLifecycle();
  const {
    becameActiveAt,
    isActive,
    isDirty,
    isStale,
    markClean,
    markDirty,
    setRefreshing,
  } = lifecycle;
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const refreshNow = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshRef.current();
      markClean();
    } catch (error) {
      markDirty();
      throw error;
    } finally {
      setRefreshing(false);
    }
  }, [markClean, markDirty, setRefreshing]);

  useEffect(() => {
    if (!isActive || (!isDirty && !isStale)) return;
    void refreshNow().catch(() => {
      // The module keeps its last successful data and owns its visible error UI.
    });
  }, [becameActiveAt, isActive, isDirty, isStale, refreshNow]);

  return refreshNow;
}
