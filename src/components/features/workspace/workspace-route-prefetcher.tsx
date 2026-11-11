"use client";

import { useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import {
  WORKSPACE_PREFETCH_CONFIGS,
  type WorkspacePrefetchConfig,
} from "./workspace-prefetch-config";
import { resolveIdlePrefetchRoutes } from "./mobile-idle-prefetch";

const prefetchedRoutes = new Set<string>();

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
  if (conn.effectiveType === "2g" || conn.effectiveType === "slow-2g") return true;
  if (typeof conn.downlink === "number" && conn.downlink < 0.5) return true;
  return false;
}

function isDataSaverEnabled(): boolean {
  return getConnection()?.saveData ?? false;
}

function resolveWorkspaceKey(pathname: string): string | null {
  if (pathname.startsWith("/crm")) return "crm";
  if (pathname.startsWith("/manager")) return "manager";
  if (pathname.startsWith("/owner")) return "owner";
  if (pathname.startsWith("/marketing")) return "marketing";
  if (pathname.startsWith("/staff-portal")) return "staff";
  if (pathname.startsWith("/driver")) return "driver";
  return null;
}

function prefetchRouteFull(router: ReturnType<typeof useRouter>, route: string) {
  if (prefetchedRoutes.has(route)) return;
  try {
    router.prefetch(route, { kind: PrefetchKind.FULL });
    prefetchedRoutes.add(route);
  } catch {
    // Best-effort prefetch
  }
}

type WorkspaceRoutePrefetcherProps = {
  config?: WorkspacePrefetchConfig;
  eagerIdle?: boolean;
  mobileIdleRoutes?: string[];
};

export function WorkspaceRoutePrefetcher({
  config: explicitConfig,
  eagerIdle = false,
  mobileIdleRoutes,
}: WorkspaceRoutePrefetcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const workspaceKey = explicitConfig ? null : resolveWorkspaceKey(pathname);
  const config = explicitConfig ?? (workspaceKey ? WORKSPACE_PREFETCH_CONFIGS[workspaceKey] : null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isDataSaverEnabled()) return;
    if (!config) return;

    const slow = isSlowConnection();
    const isMobileViewport =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 767px)").matches;
    const idleRoutes = resolveIdlePrefetchRoutes(config, mobileIdleRoutes, isMobileViewport);

    const timers: number[] = [];

    // Stagger immediate routes by 180ms each starting 300ms after mount so we don't block the active page
    config.immediate
      .filter((r) => r !== pathname)
      .forEach((route, idx) => {
        timers.push(
          window.setTimeout(() => {
            prefetchRouteFull(router, route);
          }, 300 + idx * 180)
        );
      });

    // Stagger idle routes by 250ms each starting at 1100ms
    if (idleRoutes.length > 0 && !slow) {
      const startDelay = eagerIdle ? 1000 : 1600;
      idleRoutes
        .filter((r) => r !== pathname)
        .forEach((route, idx) => {
          timers.push(
            window.setTimeout(() => {
              prefetchRouteFull(router, route);
            }, startDelay + idx * 250)
          );
        });
    }

    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [config, eagerIdle, mobileIdleRoutes, pathname, router]);

  return null;
}

export function usePrefetchOnHover(route: string): () => void {
  const router = useRouter();

  return useCallback(() => {
    if (typeof window === "undefined") return;
    if (isDataSaverEnabled()) return;
    try {
      router.prefetch(route, { kind: PrefetchKind.FULL });
    } catch {
      // Best-effort.
    }
  }, [router, route]);
}
