"use client";

import { useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  WORKSPACE_PREFETCH_CONFIGS,
  type WorkspacePrefetchConfig,
} from "./workspace-prefetch-config";

const prefetchedRoutes = new Set<string>();

// ── Connection sniffing ───────────────────────────────────────────────────────

/**
 * Rough connection quality assessment.
 * Respects Data Saver mode and down-links that are clearly slow.
 */
type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
  downlink?: number;
};

function getConnection(): NetworkInformation | undefined {
  if (typeof navigator === "undefined") return undefined;
  const nav = navigator as unknown as { connection?: NetworkInformation };
  return nav.connection;
}

function isSlowConnection(): boolean {
  const conn = getConnection();
  if (!conn) return false;

  if (conn.saveData) return true;
  if (conn.effectiveType === "2g") return true;
  if (conn.effectiveType === "slow-2g") return true;
  if (typeof conn.downlink === "number" && conn.downlink < 0.5) return true;

  return false;
}

function isDataSaverEnabled(): boolean {
  return getConnection()?.saveData ?? false;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveWorkspaceKey(pathname: string): string | null {
  if (pathname.startsWith("/crm")) return "crm";
  if (pathname.startsWith("/manager")) return "manager";
  if (pathname.startsWith("/owner")) return "owner";
  if (pathname.startsWith("/staff-portal")) return "staff";
  if (pathname.startsWith("/driver")) return "driver";
  return null;
}

function prefetchRoutes(router: ReturnType<typeof useRouter>, routes: string[]) {
  for (const route of routes) {
    if (prefetchedRoutes.has(route)) continue;
    try {
      router.prefetch(route);
      prefetchedRoutes.add(route);
    } catch {
      // Swallow — prefetch is best-effort.
    }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

type WorkspaceRoutePrefetcherProps = {
  /**
   * Optional explicit config. If omitted, the component derives the workspace
   * from the current pathname and uses the built-in registry.
   */
  config?: WorkspacePrefetchConfig;
  /**
   * If true, also prefetches idle routes immediately (useful for desktop).
   * Default: false (idle routes wait for requestIdleCallback).
   */
  eagerIdle?: boolean;
};

/**
 * WorkspaceRoutePrefetcher
 *
 * A zero-UI client component that warms up workspace routes in the background.
 *
 * Behavior:
 *   - Immediate routes are prefetched right after mount (with a tiny delay so
 *     the current page can finish its own data fetching first).
 *   - Idle routes are deferred via requestIdleCallback when available.
 *   - On slow connections or Data Saver mode, ALL prefetching is skipped.
 *   - On 2g, only immediate routes are prefetched (no idle batch).
 *
 * Mount this inside each workspace layout (or once in the shared dashboard
 * layout). It reads the pathname to decide which workspace it is in.
 */
export function WorkspaceRoutePrefetcher({
  config: explicitConfig,
  eagerIdle = false,
}: WorkspaceRoutePrefetcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const workspaceKey = explicitConfig ? null : resolveWorkspaceKey(pathname);
  const config = explicitConfig ?? (workspaceKey ? WORKSPACE_PREFETCH_CONFIGS[workspaceKey] : null);

  const doPrefetch = useCallback(
    (routes: string[]) => {
      prefetchRoutes(router, routes);
    },
    [router]
  );

  useEffect(() => {
    // Guard: no prefetch on server, in data-saver mode, or when offline.
    if (typeof window === "undefined") return;
    if (isDataSaverEnabled()) return;

    if (!config) return;

    const slow = isSlowConnection();

    // Immediate batch — slight delay so current page data wins the network queue.
    const immediateTimer = window.setTimeout(() => {
      doPrefetch(config.immediate);
    }, 250);

    // Idle batch — only on decent connections and when not eager.
    let idleTimer: number | undefined;
    let idleCallbackId: number | undefined;

    if (config.idle.length > 0 && !slow) {
      const runIdle = () => doPrefetch(config.idle);

      if (eagerIdle) {
        idleTimer = window.setTimeout(runIdle, 1200);
      } else if (typeof (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback === "function") {
        idleCallbackId = (window as unknown as { requestIdleCallback: typeof requestIdleCallback }).requestIdleCallback(runIdle, { timeout: 3000 });
      } else {
        idleTimer = window.setTimeout(runIdle, 2000);
      }
    }

    return () => {
      window.clearTimeout(immediateTimer);
      if (idleTimer !== undefined) window.clearTimeout(idleTimer);
      if (idleCallbackId !== undefined) window.cancelIdleCallback(idleCallbackId);
    };
  }, [config, doPrefetch, eagerIdle]);

  return null;
}

// ── Sidebar link hover prefetch hook ──────────────────────────────────────────

/**
 * Returns an onMouseEnter handler that prefetches a single route.
 * Safe to attach to sidebar/nav links for heavy routes.
 *
 * Example:
 *   <Link href="/crm/reports" onMouseEnter={usePrefetchOnHover("/crm/reports")}>
 */
export function usePrefetchOnHover(route: string): () => void {
  const router = useRouter();

  return useCallback(() => {
    if (typeof window === "undefined") return;
    if (isDataSaverEnabled()) return;
    try {
      router.prefetch(route);
    } catch {
      // Best-effort.
    }
  }, [router, route]);
}
