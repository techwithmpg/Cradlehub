"use client";

import {
  Activity,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSWRConfig } from "swr";
import { BOOKINGS_CHANGED_EVENT } from "@/lib/bookings/bookings-client-events";
import { isRetainedWorkspaceEnabled } from "@/lib/config/mvp-flags";
import {
  WorkspaceModuleLifecycleContext,
  type WorkspaceModuleLifecycleValue,
} from "./use-workspace-visibility";
import {
  createWorkspaceRegistryState,
  reduceWorkspaceRegistry,
  type RetainedWorkspaceEntry,
  type WorkspaceRegistryAction,
} from "./workspace-module-registry";
import {
  affectedModulesForBookingChange,
  resolveWorkspaceModule,
  retainedModuleKey,
  WORKSPACE_RETENTION_LIMITS,
  type RetainedWorkspace,
} from "./workspace-retention-policy";
import {
  WORKSPACE_NAVIGATION_EVENT,
  type WorkspaceNavigationDetail,
  WORKSPACE_RETENTION_STATE_EVENT,
  type WorkspaceRetentionStateDetail,
} from "./workspace-navigation-events";
import { WorkspaceSWRScopeContext } from "./workspace-swr-cache";

type RetainedWorkspaceProviderProps = {
  workspace: RetainedWorkspace;
  userId: string;
  role: string;
  branchId: string;
  enabled: boolean;
  children: ReactNode;
};

type PendingNavigation = {
  key: string;
  pathname: string;
  search: string;
};

type RetainedWorkspaceRegistration = {
  register: (moduleId: RetainedWorkspaceEntry["moduleId"], node: ReactNode) => void;
  isRegistered: (moduleId: RetainedWorkspaceEntry["moduleId"]) => boolean;
};

const RetainedWorkspaceRegistrationContext =
  createContext<RetainedWorkspaceRegistration | null>(null);

/**
 * Marks the serializable page subtree that belongs in the persistent host.
 * The App Router outlet itself is never cached; it can mutate as navigation
 * commits. Registering the page's concrete client subtree gives every retained
 * module an independent React element and Activity boundary.
 */
export function RetainedWorkspaceModule({
  moduleId,
  children,
}: {
  moduleId: RetainedWorkspaceEntry["moduleId"];
  children: ReactNode;
}) {
  const registration = useContext(RetainedWorkspaceRegistrationContext);
  const registerModule = registration?.register;
  const workspace = moduleId.startsWith("owner-") ? "owner" : "crm";
  const enabled = isRetainedWorkspaceEnabled(workspace, {
    NEXT_PUBLIC_RETAINED_WORKSPACES: process.env.NEXT_PUBLIC_RETAINED_WORKSPACES,
  });
  useLayoutEffect(() => {
    if (enabled) registerModule?.(moduleId, children);
  }, [children, enabled, moduleId, registerModule]);

  if (!enabled) return children;
  if (registration?.isRegistered(moduleId)) return null;
  return (
    <div
      data-retained-module-bootstrap={moduleId}
      aria-busy="true"
      aria-label="Loading workspace module"
      className="grid gap-3 px-3 py-3 md:px-0 md:py-0"
    >
      <div className="h-20 animate-pulse rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)]" />
      <div className="h-48 animate-pulse rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)]" />
    </div>
  );
}

function workspaceScrollTop(): number {
  if (typeof document === "undefined") return 0;
  const main = document.querySelector<HTMLElement>('[data-testid="workspace-main"]');
  return main?.scrollTop ?? 0;
}

function restoreWorkspaceScroll(scrollTop: number): void {
  const main = document.querySelector<HTMLElement>('[data-testid="workspace-main"]');
  if (!main) return;
  window.requestAnimationFrame(() => {
    main.scrollTop = scrollTop;
  });
}

function RetainedModuleFrame({
  entry,
  active,
  pendingRefresh,
  dispatch,
}: {
  entry: RetainedWorkspaceEntry;
  active: boolean;
  pendingRefresh: boolean;
  dispatch: (action: WorkspaceRegistryAction) => void;
}) {
  const markDirty = useCallback(() => {
    dispatch({ type: "mark-dirty", moduleIds: [entry.moduleId] });
  }, [dispatch, entry.moduleId]);
  const markClean = useCallback(() => {
    dispatch({ type: "mark-clean", key: entry.key, at: Date.now() });
  }, [dispatch, entry.key]);
  const setRefreshing = useCallback((refreshing: boolean) => {
    dispatch({ type: "set-refreshing", key: entry.key, refreshing });
  }, [dispatch, entry.key]);
  const setUnsavedChanges = useCallback((unsaved: boolean) => {
    dispatch({ type: "set-unsaved", key: entry.key, unsaved });
  }, [dispatch, entry.key]);
  const lifecycle = useMemo<WorkspaceModuleLifecycleValue>(() => ({
    isActive: active,
    isRetained: true,
    isDirty: entry.dirty,
    isStale: entry.lastActivatedAt - entry.lastRefreshedAt >= entry.staleTimeMs,
    isRefreshing: entry.isRefreshing,
    hasUnsavedChanges: entry.hasUnsavedChanges,
    becameActiveAt: entry.becameActiveAt,
    markDirty,
    markClean,
    setRefreshing,
    setUnsavedChanges,
  }), [
    active,
    entry.becameActiveAt,
    entry.dirty,
    entry.hasUnsavedChanges,
    entry.isRefreshing,
    entry.lastActivatedAt,
    entry.lastRefreshedAt,
    entry.staleTimeMs,
    markClean,
    markDirty,
    setRefreshing,
    setUnsavedChanges,
  ]);
  const showRefreshing = active && (entry.isRefreshing || pendingRefresh);

  return (
    <Activity mode={active ? "visible" : "hidden"} name={entry.moduleId}>
      <WorkspaceModuleLifecycleContext.Provider value={lifecycle}>
        <div
          data-retained-workspace-module={entry.moduleId}
          data-retention-cost={entry.cost}
          data-retained-scroll-top={entry.scrollTop}
          hidden={!active}
          aria-hidden={active ? undefined : true}
          inert={!active}
          style={{ position: "relative" }}
        >
          {showRefreshing ? (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none absolute right-3 top-2 z-20 rounded-full border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2.5 py-1 text-[11px] text-[var(--cs-text-muted)] shadow-sm"
            >
              Refreshing…
            </div>
          ) : null}
          {entry.node}
        </div>
      </WorkspaceModuleLifecycleContext.Provider>
    </Activity>
  );
}

function ScopedRetainedWorkspace({
  workspace,
  userId,
  role,
  branchId,
  children,
}: Omit<RetainedWorkspaceProviderProps, "enabled">) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const scopeKey = `${userId}:${role}:${branchId}`;
  const { cache: swrCache } = useSWRConfig();
  const descriptor = useMemo(
    () => resolveWorkspaceModule(workspace, pathname, search),
    [pathname, search, workspace]
  );
  const moduleKey = descriptor ? retainedModuleKey(scopeKey, descriptor) : null;
  const [registry, dispatch] = useReducer(
    reduceWorkspaceRegistry,
    WORKSPACE_RETENTION_LIMITS[workspace],
    createWorkspaceRegistryState
  );
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
  const registryRef = useRef(registry);
  useLayoutEffect(() => {
    registryRef.current = registry;
  }, [registry]);

  const register = useCallback<RetainedWorkspaceRegistration["register"]>((moduleId, node) => {
    if (!descriptor || !moduleKey || descriptor.moduleId !== moduleId) return;
    const activeEntry = registryRef.current.entries.find(
      (entry) => entry.key === registryRef.current.activeKey
    );
    dispatch({
      type: "activate-server",
      key: moduleKey,
      descriptor,
      role,
      branchId,
      node,
      at: Date.now(),
      previousScrollTop: activeEntry?.scrollTop ?? workspaceScrollTop(),
    });
  }, [branchId, descriptor, moduleKey, role]);
  const registration = useMemo<RetainedWorkspaceRegistration>(
    () => ({
      register,
      isRegistered: (moduleId) =>
        descriptor?.moduleId === moduleId &&
        Boolean(moduleKey && registry.entries.some((entry) => entry.key === moduleKey)),
    }),
    [descriptor?.moduleId, moduleKey, register, registry.entries]
  );

  useLayoutEffect(() => {
    const activeEntry = registryRef.current.entries.find(
      (entry) => entry.key === registryRef.current.activeKey
    );
    if (moduleKey) {
      if (registryRef.current.entries.some((entry) => entry.key === moduleKey)) {
        dispatch({
          type: "activate-retained",
          key: moduleKey,
          at: Date.now(),
          previousScrollTop: activeEntry?.scrollTop ?? workspaceScrollTop(),
          descriptor: descriptor ?? undefined,
        });
      }
    } else {
      dispatch({
        type: "deactivate",
        previousScrollTop: activeEntry?.scrollTop ?? workspaceScrollTop(),
      });
    }
  }, [descriptor, moduleKey]);

  const restoreRetainedSearch = useCallback((href: string): string => {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin || url.search) return href;
    const target = resolveWorkspaceModule(workspace, url.pathname, url.searchParams);
    if (!target) return href;
    const key = retainedModuleKey(scopeKey, target);
    const retained = registryRef.current.entries.find((entry) => entry.key === key)
      ?? registryRef.current.restoration[key];
    if (!retained?.stableSearchState) return href;
    url.search = retained.stableSearchState;
    return `${url.pathname}${url.search}${url.hash}`;
  }, [scopeKey, workspace]);

  const activateRetainedUrl = useCallback((href: string) => {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith(`/${workspace}`)) {
      return;
    }
    const currentKey = registryRef.current.activeKey;
    if (currentKey) {
      dispatch({
        type: "save-scroll",
        key: currentKey,
        scrollTop: workspaceScrollTop(),
      });
    }
    const target = resolveWorkspaceModule(workspace, url.pathname, url.searchParams);
    if (!target) return;
    const key = retainedModuleKey(scopeKey, target);
    if (registryRef.current.entries.some((entry) => entry.key === key)) {
      dispatch({
        type: "activate-retained",
        key,
        at: Date.now(),
        previousScrollTop: workspaceScrollTop(),
      });
    } else if (registryRef.current.restoration[key]) {
      dispatch({
        type: "restore-evicted",
        key,
        at: Date.now(),
        previousScrollTop: workspaceScrollTop(),
      });
    } else {
      return;
    }
    setPendingNavigation({ key, pathname: url.pathname, search: url.searchParams.toString() });
  }, [scopeKey, workspace]);

  useEffect(() => {
    const onNavigation = (event: Event) => {
      const detail = (event as CustomEvent<WorkspaceNavigationDetail>).detail;
      if (detail?.href) activateRetainedUrl(detail.href);
    };
    const onPopState = () => activateRetainedUrl(window.location.href);
    const onDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      const retainedHref = restoreRetainedSearch(anchor.href);
      if (retainedHref !== anchor.href) {
        event.preventDefault();
        activateRetainedUrl(retainedHref);
        router.push(retainedHref);
        return;
      }
      activateRetainedUrl(anchor.href);
    };
    window.addEventListener(WORKSPACE_NAVIGATION_EVENT, onNavigation);
    window.addEventListener("popstate", onPopState);
    document.addEventListener("click", onDocumentClick, true);
    return () => {
      window.removeEventListener(WORKSPACE_NAVIGATION_EVENT, onNavigation);
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("click", onDocumentClick, true);
    };
  }, [activateRetainedUrl, restoreRetainedSearch, router]);

  useEffect(() => {
    if (!pendingNavigation) return;
    if (pendingNavigation.pathname === pathname && pendingNavigation.search === search) {
      const settled = window.setTimeout(() => setPendingNavigation(null), 0);
      return () => window.clearTimeout(settled);
    }
    const timeout = window.setTimeout(() => setPendingNavigation(null), 10_000);
    return () => window.clearTimeout(timeout);
  }, [pathname, pendingNavigation, search]);

  useEffect(() => {
    const markBookingModulesDirty = () => {
      dispatch({
        type: "mark-dirty",
        moduleIds: affectedModulesForBookingChange(workspace),
      });
    };
    window.addEventListener(BOOKINGS_CHANGED_EVENT, markBookingModulesDirty);
    return () => window.removeEventListener(BOOKINGS_CHANGED_EVENT, markBookingModulesDirty);
  }, [workspace]);

  useEffect(() => {
    const warnForUnsavedWork = (event: BeforeUnloadEvent) => {
      if (!registryRef.current.entries.some((entry) => entry.hasUnsavedChanges)) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnForUnsavedWork);
    return () => window.removeEventListener("beforeunload", warnForUnsavedWork);
  }, []);

  const unsavedModuleIds = registry.entries
    .filter((entry) => entry.hasUnsavedChanges)
    .map((entry) => entry.moduleId)
    .sort()
    .join(",");
  useEffect(() => {
    const detail: WorkspaceRetentionStateDetail = {
      unsavedModuleIds: unsavedModuleIds ? unsavedModuleIds.split(",") : [],
    };
    window.dispatchEvent(
      new CustomEvent<WorkspaceRetentionStateDetail>(WORKSPACE_RETENTION_STATE_EVENT, {
        detail,
      })
    );
  }, [unsavedModuleIds]);

  useEffect(() => () => {
    window.dispatchEvent(
      new CustomEvent<WorkspaceRetentionStateDetail>(WORKSPACE_RETENTION_STATE_EVENT, {
        detail: { unsavedModuleIds: [] },
      })
    );
  }, []);

  useEffect(() => () => {
    // Leaving this authenticated workspace (logout, role/branch change, or
    // permission boundary) must not leave operational data in the shared SWR
    // cache for a subsequent identity in the same browser runtime.
    for (const key of swrCache.keys()) swrCache.delete(key);
  }, [swrCache]);

  const effectivePendingNavigation =
    pendingNavigation?.pathname === pathname && pendingNavigation.search === search
      ? null
      : pendingNavigation;
  const actualActiveKey =
    moduleKey && registry.entries.some((entry) => entry.key === moduleKey)
      ? moduleKey
      : null;
  const activeKey = effectivePendingNavigation?.key ?? actualActiveKey;
  const previousActiveKey = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!activeKey || previousActiveKey.current === activeKey) return;
    const entry = registry.entries.find((candidate) => candidate.key === activeKey);
    restoreWorkspaceScroll(entry?.scrollTop ?? 0);

    if (previousActiveKey.current) {
      window.requestAnimationFrame(() => {
        const frame = document.querySelector<HTMLElement>(
          `[data-retained-workspace-module="${entry?.moduleId ?? ""}"]`
        );
        const heading = frame?.querySelector<HTMLElement>("h1, [role=heading]");
        if (heading && !heading.hasAttribute("tabindex")) heading.tabIndex = -1;
        heading?.focus({ preventScroll: true });
      });
    }
    previousActiveKey.current = activeKey;
  }, [activeKey, registry.entries]);

  return (
    <WorkspaceSWRScopeContext.Provider value={scopeKey}>
      <RetainedWorkspaceRegistrationContext.Provider value={registration}>
        {registry.entries.map((entry) => {
          const active = entry.key === activeKey;
          const pendingRefresh = Boolean(
            active &&
            effectivePendingNavigation?.key === entry.key &&
            (entry.dirty || entry.lastActivatedAt - entry.lastRefreshedAt >= entry.staleTimeMs)
          );
          return (
            <RetainedModuleFrame
              key={entry.key}
              entry={entry}
              active={active}
              pendingRefresh={pendingRefresh}
              dispatch={dispatch}
            />
          );
        })}
        {children}
      </RetainedWorkspaceRegistrationContext.Provider>
    </WorkspaceSWRScopeContext.Provider>
  );
}

export function RetainedWorkspaceProvider(props: RetainedWorkspaceProviderProps) {
  if (!props.enabled) return props.children;
  const scopeKey = `${props.userId}:${props.role}:${props.branchId}`;
  return (
    <ScopedRetainedWorkspace
      key={scopeKey}
      workspace={props.workspace}
      userId={props.userId}
      role={props.role}
      branchId={props.branchId}
    >
      {props.children}
    </ScopedRetainedWorkspace>
  );
}
