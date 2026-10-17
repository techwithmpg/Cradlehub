"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { SWRConfig } from "swr";
import { ownerOperationalScopeKey, resolveOwnerOperationalScope, type OwnerScopeBranch } from "@/lib/owner/operational-scope";
import { RetainedWorkspaceProvider } from "./retained-workspace-provider";
import { WorkspaceSWRScopeContext } from "./workspace-swr-cache";

type Props = {
  userId: string;
  role: string;
  authorizedBranches: readonly OwnerScopeBranch[];
  dispatchBranchId: string | null;
  enabled: boolean;
  children: ReactNode;
};

/** Own a fresh cache even with retention OFF. A late write to the discarded cache
 * cannot populate the next branch's provider. Server data loading stays in Pages. */
function OwnerScopeCache({ scopeKey, children }: { scopeKey: string; children: ReactNode }) {
  const [cache] = useState(() => new Map());
  const config = useMemo(() => ({ provider: () => cache }), [cache]);
  useEffect(() => () => { cache.clear(); }, [cache]);
  return <SWRConfig value={config}><WorkspaceSWRScopeContext.Provider value={scopeKey}>{children}</WorkspaceSWRScopeContext.Provider></SWRConfig>;
}

export function OwnerRuntimeScope({ userId, role, authorizedBranches, dispatchBranchId, enabled, children }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const resolve = useCallback((path: string, search: URLSearchParams) => resolveOwnerOperationalScope({
    pathname: path, searchParams: search, authorizedBranches, dispatchBranchId,
  }), [authorizedBranches, dispatchBranchId]);
  const scope = useMemo(() => resolveOwnerOperationalScope({ pathname, searchParams, authorizedBranches, dispatchBranchId }),
    [pathname, searchParams, authorizedBranches, dispatchBranchId]);
  const identity = ownerOperationalScopeKey(scope);
  const scopeKey = `${userId}:${role}:${identity}`;
  const canRetainUrl = useCallback((path: string, search: URLSearchParams) =>
    ownerOperationalScopeKey(resolve(path, search)) === identity, [resolve, identity]);
  const ownerEventScope = useMemo(() => ({
    scope, authorizedBranchIds: authorizedBranches.filter((branch) => branch.is_active !== false).map((branch) => branch.id),
  }), [scope, authorizedBranches]);
  return <OwnerScopeCache key={scopeKey} scopeKey={scopeKey}>
    <RetainedWorkspaceProvider workspace="owner" userId={userId} role={role} branchId={identity}
      enabled={enabled} ownerEventScope={ownerEventScope} canRetainUrl={canRetainUrl}>
      {children}
    </RetainedWorkspaceProvider>
  </OwnerScopeCache>;
}
