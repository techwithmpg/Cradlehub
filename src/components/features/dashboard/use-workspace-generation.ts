"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import useSWR from "swr";
import type { WorkspaceRuntimeModuleId } from "./workspace-domain-events";
import { INITIAL_GENERATION, reconcileWorkspaceGeneration, type WorkspaceGenerationStore } from "./workspace-generation";
import { useWorkspaceSWRKey, WorkspaceSWRScopeContext } from "./workspace-swr-cache";

export const WorkspaceGenerationContext = createContext<WorkspaceGenerationStore | null>(null);

export function useWorkspaceGeneration(moduleId: WorkspaceRuntimeModuleId) {
  const store = useContext(WorkspaceGenerationContext);
  const getSnapshot = useCallback(() => store?.getSnapshot(moduleId) ?? INITIAL_GENERATION, [store, moduleId]);
  const subscribe = useCallback((listener: () => void) => store?.subscribe(listener) ?? (() => undefined), [store]);
  const state = useSyncExternalStore(subscribe, getSnapshot, () => INITIAL_GENERATION);
  return { store, ...state };
}

/** Opt-in SWR adapter. No operational module is converted by PERF-1A.
 * SWR owns cache/subscriptions; this hook alone schedules authoritative reads.
 * Fetchers must return data without mutating another cache or component state.
 * Use one aggregate reconciliation per module, not independent slice fetchers.
 */
export function useGenerationAwareWorkspaceSWR<T>(
  moduleId: WorkspaceRuntimeModuleId,
  requestKey: string,
  fetcher: () => Promise<T>,
  fallbackData?: T,
) {
  const scope = useContext(WorkspaceSWRScopeContext);
  const generation = useWorkspaceGeneration(moduleId);
  const { store, isActive, isDirty, isRefreshing, invalidationGeneration } = generation;
  const key = useWorkspaceSWRKey([moduleId, requestKey] as const);
  // A null fetcher prevents SWR focus/reconnect/mount events from fetching hidden data.
  const swr = useSWR<T>(store && scope ? key : null, null, {
    fallbackData, revalidateOnFocus: false, revalidateOnReconnect: false,
    revalidateOnMount: false, revalidateIfStale: false, shouldRetryOnError: false,
  });
  const fetchRef = useRef(fetcher);
  useEffect(() => { fetchRef.current = fetcher; }, [fetcher]);
  const attempt = useRef<number | null>(null);
  const requestVersion = useRef(0);
  const lastKey = useRef(requestKey);
  const [failure, setFailure] = useState<{ key: string; error: unknown } | null>(null);
  useLayoutEffect(() => {
    if (lastKey.current !== requestKey) {
      lastKey.current = requestKey;
      store?.invalidate(moduleId);
    }
    attempt.current = null;
    return () => {
      attempt.current = null;
      requestVersion.current += 1;
      store?.cancelValidation(moduleId);
    };
  }, [store, moduleId, requestKey, isActive]);
  const { mutate } = swr;
  const revalidate = useCallback(async () => {
    if (!store || !scope) return "skipped" as const;
    const current = store.getSnapshot(moduleId);
    if (!current.isActive || current.isRefreshing) return "skipped" as const;
    const version = ++requestVersion.current;
    const result = reconcileWorkspaceGeneration(store, moduleId, () => fetchRef.current(), async (data, isCurrent) => {
      // Check inside SWR's cache updater, not just before its async boundary.
      await mutate((current) => isCurrent() ? data : current, { revalidate: false });
    });
    attempt.current = store.getSnapshot(moduleId).invalidationGeneration;
    try {
      const outcome = await result;
      if (outcome === "validated" && version === requestVersion.current) setFailure(null);
      return outcome;
    } catch (error) {
      if (version === requestVersion.current) setFailure({ key: requestKey, error });
      throw error;
    }
  }, [store, scope, moduleId, requestKey, mutate]);
  useEffect(() => {
    if (!isActive || isRefreshing || (!isDirty && swr.data !== undefined)) return;
    if (attempt.current === invalidationGeneration) return;
    void revalidate().catch(() => { /* Retain last successful data; explicit retry remains available. */ });
  }, [isActive, isDirty, isRefreshing, invalidationGeneration, revalidate, swr.data]);
  return { data: swr.data, error: failure?.key === requestKey ? failure.error : undefined, generation, revalidate };
}
