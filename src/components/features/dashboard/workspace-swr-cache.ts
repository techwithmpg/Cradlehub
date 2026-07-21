"use client";

import { createContext, useContext } from "react";

const WORKSPACE_SWR_PREFIX = "cradlehub-workspace-scope";

export const WorkspaceSWRScopeContext = createContext<string | null>(null);

export type WorkspaceScopedSWRKey<T> =
  | T
  | readonly [typeof WORKSPACE_SWR_PREFIX, string, T];

/**
 * Prefixes SWR cache identities with the authenticated workspace scope while
 * leaving the request value available to existing fetchers.
 */
export function useWorkspaceSWRKey<T>(key: T): WorkspaceScopedSWRKey<T> {
  const scopeKey = useContext(WorkspaceSWRScopeContext);
  return scopeKey ? [WORKSPACE_SWR_PREFIX, scopeKey, key] : key;
}

export function unwrapWorkspaceSWRKey<T>(key: WorkspaceScopedSWRKey<T>): T {
  if (
    Array.isArray(key) &&
    key.length === 3 &&
    key[0] === WORKSPACE_SWR_PREFIX
  ) {
    return key[2] as T;
  }
  return key as T;
}
