"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import useSWR from "swr";
import type { WorkspaceRuntimeModuleId } from "./workspace-domain-events";
import {
  INITIAL_GENERATION,
  reconcileWorkspaceGeneration,
  type WorkspaceGenerationStore,
} from "./workspace-generation";
import { useWorkspaceSWRKey, WorkspaceSWRScopeContext } from "./workspace-swr-cache";

export const WorkspaceGenerationContext = createContext<WorkspaceGenerationStore | null>(null);

export function useWorkspaceGeneration(moduleId: WorkspaceRuntimeModuleId) {
  const store = useContext(WorkspaceGenerationContext);
  const getSnapshot = useCallback(
    () => store?.getSnapshot(moduleId) ?? INITIAL_GENERATION,
    [store, moduleId]
  );
  const subscribe = useCallback(
    (listener: () => void) => store?.subscribe(listener) ?? (() => undefined),
    [store]
  );
  const state = useSyncExternalStore(subscribe, getSnapshot, () => INITIAL_GENERATION);
  return { store, ...state };
}

export function useGenerationAwareWorkspaceSWR<T>(
  moduleId: WorkspaceRuntimeModuleId,
  requestKey: string,
  fetcher: () => Promise<T>,
  fallbackData?: T
) {
  const scope = useContext(WorkspaceSWRScopeContext);
  const generation = useWorkspaceGeneration(moduleId);
  const { store, isActive, isDirty, isRefreshing, invalidationGeneration } = generation;
  const key = useWorkspaceSWRKey([moduleId, requestKey] as const);

  const swr = useSWR<T>(store && scope ? key : null, null, {
    fallbackData,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateOnMount: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
  });

  const fetchRef = useRef(fetcher);
  useEffect(() => {
    fetchRef.current = fetcher;
  }, [fetcher]);

  const attempt = useRef<number | null>(null);
  const requestVersion = useRef(0);
  const lastKey = useRef(requestKey);
  const lastFallbackRef = useRef<T | undefined>(fallbackData);
  const mountedWithFallbackRef = useRef(false);
  const [failure, setFailure] = useState<{ key: string; error: unknown } | null>(null);

  useLayoutEffect(() => {
    if (
      fallbackData !== undefined &&
      (!mountedWithFallbackRef.current || lastFallbackRef.current !== fallbackData)
    ) {
      mountedWithFallbackRef.current = true;
      lastFallbackRef.current = fallbackData;
      store?.markClean?.(moduleId);
      attempt.current = store?.getSnapshot(moduleId).invalidationGeneration ?? 0;
    }
  }, [fallbackData, moduleId, store]);

  useLayoutEffect(() => {
    if (lastKey.current !== requestKey) {
      lastKey.current = requestKey;
      if (lastFallbackRef.current === fallbackData) {
        store?.invalidate(moduleId);
      }
    }
    attempt.current = null;
    return () => {
      attempt.current = null;
      requestVersion.current += 1;
      store?.cancelValidation(moduleId);
    };
  }, [store, moduleId, requestKey, isActive, fallbackData]);

  const { mutate } = swr;

  /**
   * Surgically patches the module's in-memory SWR cache in <1ms without a server round-trip
   * and marks the module generation clean so switching tabs does not trigger a full refetch.
   */
  const patchData = useCallback(
    (updater: (current: T) => T) => {
      void mutate(
        (currentData) => {
          const base = currentData ?? fallbackData;
          if (base === undefined) return currentData;
          return updater(base);
        },
        { revalidate: false }
      );
      store?.markClean?.(moduleId);
      attempt.current = store?.getSnapshot(moduleId).invalidationGeneration ?? 0;
    },
    [fallbackData, moduleId, mutate, store]
  );

  const revalidate = useCallback(async () => {
    if (!store || !scope) return "skipped" as const;
    const current = store.getSnapshot(moduleId);
    if (!current.isActive || current.isRefreshing) return "skipped" as const;
    const version = ++requestVersion.current;
    const result = reconcileWorkspaceGeneration(
      store,
      moduleId,
      () => fetchRef.current(),
      async (data, isCurrent) => {
        await mutate((currentData) => (isCurrent() ? data : currentData), { revalidate: false });
      }
    );
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
    if (!isActive || isRefreshing || !isDirty) return;
    if (attempt.current === invalidationGeneration) return;
    void revalidate().catch(() => {
      /* Retain last successful data; explicit retry remains available. */
    });
  }, [isActive, isDirty, isRefreshing, invalidationGeneration, revalidate]);

  return {
    data: swr.data ?? fallbackData,
    error: failure?.key === requestKey ? failure.error : undefined,
    generation,
    revalidate,
    patchData,
  };
}
