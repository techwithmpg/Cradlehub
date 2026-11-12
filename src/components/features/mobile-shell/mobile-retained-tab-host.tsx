"use client";

import {
  Activity,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMobileNavigationProgress } from "./mobile-navigation-progress-provider";
import { WorkspaceEntityDeltaBridge } from "@/components/features/dashboard/workspace-entity-delta-bridge";
import { AutoPushSubscriptionManager } from "@/components/features/notifications/auto-push-subscription-manager";
import { useWorkspaceEntityDelta } from "@/lib/workspace/entity-delta-bus";

export const MOBILE_INSTANT_NAV_EVENT = "cradlehub:mobile-instant-nav";

export function emitMobileInstantNav(href: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<{ href: string }>(MOBILE_INSTANT_NAV_EVENT, { detail: { href } })
  );
}

function MobileFirstLoadSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading mobile view"
      className="mx-auto w-full max-w-md space-y-4 px-4 pt-4 pb-24 animate-in fade-in duration-150"
    >
      {/* Greeting / Header Card Skeleton */}
      <div className="rounded-2xl border border-[#E8E1D7] bg-white p-4 shadow-xs space-y-2.5">
        <div className="h-5 w-40 animate-pulse rounded-lg bg-stone-200/80" />
        <div className="h-3.5 w-60 animate-pulse rounded-md bg-stone-200/60" />
      </div>

      {/* Quick Stats / Pill Strip */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="h-20 animate-pulse rounded-2xl bg-stone-200/75" />
        <div className="h-20 animate-pulse rounded-2xl bg-stone-200/65" />
        <div className="h-20 animate-pulse rounded-2xl bg-stone-200/55" />
      </div>

      {/* Primary Action / Next Appointment Card */}
      <div className="rounded-2xl border border-[#E8E1D7] bg-white p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-28 animate-pulse rounded-md bg-stone-200/80" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-stone-200/70" />
        </div>
        <div className="h-16 w-full animate-pulse rounded-xl bg-stone-200/60" />
        <div className="h-10 w-full animate-pulse rounded-xl bg-stone-200/75" />
      </div>

      {/* List Items */}
      <div className="space-y-2.5">
        <div className="h-20 w-full animate-pulse rounded-2xl bg-stone-200/70" />
        <div className="h-20 w-full animate-pulse rounded-2xl bg-stone-200/55" />
      </div>
    </div>
  );
}

type RetainedTabEntry = {
  key: string;
  pathname: string;
  node: ReactNode;
  scrollTop: number;
  updatedAt: number;
};

const MAX_RETAINED_MOBILE_TABS = 8;

export function MobileRetainedTabHost({
  children,
  branchId,
}: {
  children: ReactNode;
  branchId?: string | null;
}) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";
  const routeKey = search ? `${pathname}?${search}` : pathname;
  const router = useRouter();
  const { stopNavigation } = useMobileNavigationProgress();

  const [entries, setEntries] = useState<RetainedTabEntry[]>(() => [
    {
      key: routeKey,
      pathname,
      node: children,
      scrollTop: 0,
      updatedAt: Date.now(),
    },
  ]);
  const [pendingTargetKey, setPendingTargetKey] = useState<string | null>(null);
  const lastRefreshRef = useRef(0);

  // Synchronize incoming server children into the retained tab registry
  useLayoutEffect(() => {
    setPendingTargetKey(null);
    stopNavigation();
    setEntries((prev) => {
      const existingIdx = prev.findIndex((item) => item.key === routeKey);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx]!,
          node: children,
          updatedAt: Date.now(),
        };
        return next;
      }
      const appended = [
        ...prev,
        {
          key: routeKey,
          pathname,
          node: children,
          scrollTop: 0,
          updatedAt: Date.now(),
        },
      ];
      if (appended.length > MAX_RETAINED_MOBILE_TABS) {
        return appended.slice(appended.length - MAX_RETAINED_MOBILE_TABS);
      }
      return appended;
    });
  }, [children, pathname, routeKey, stopNavigation]);

  const handleInstantNav = useCallback((href: string) => {
    try {
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      const targetKey = url.search ? `${url.pathname}?${url.searchParams.toString()}` : url.pathname;
      setEntries((prev) =>
        prev.map((item) =>
          item.key === routeKey ? { ...item, scrollTop: window.scrollY } : item
        )
      );
      setPendingTargetKey(targetKey);
    } catch {
      // Ignore malformed URLs
    }
  }, [routeKey]);

  useEffect(() => {
    const onInstantNav = (event: Event) => {
      const detail = (event as CustomEvent<{ href: string }>).detail;
      if (detail?.href) handleInstantNav(detail.href);
    };
    window.addEventListener(MOBILE_INSTANT_NAV_EVENT, onInstantNav);
    return () => window.removeEventListener(MOBILE_INSTANT_NAV_EVENT, onInstantNav);
  }, [handleInstantNav]);

  // Listen for live branch entity deltas (new assignment, status change) and softly refresh active PWA data
  useWorkspaceEntityDelta(branchId, (delta) => {
    if (
      delta.kind === "booking.upserted" ||
      delta.kind === "booking.status_patched"
    ) {
      const now = Date.now();
      if (now - lastRefreshRef.current > 2500) {
        lastRefreshRef.current = now;
        router.refresh();
      }
    }
  });

  const effectiveTargetKey =
    pendingTargetKey && pendingTargetKey !== routeKey ? pendingTargetKey : routeKey;
  const isCachedTarget = entries.some((entry) => entry.key === effectiveTargetKey);
  const showFirstLoadSkeleton = Boolean(
    pendingTargetKey && pendingTargetKey !== routeKey && !isCachedTarget
  );

  // Restore scroll position when switching back to a cached tab
  useLayoutEffect(() => {
    if (!isCachedTarget) return;
    const match = entries.find((entry) => entry.key === effectiveTargetKey);
    if (match) {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: match.scrollTop, behavior: "instant" as ScrollBehavior });
      });
    }
  }, [effectiveTargetKey, entries, isCachedTarget]);

  return (
    <>
      <AutoPushSubscriptionManager />
      {branchId ? <WorkspaceEntityDeltaBridge branchId={branchId} /> : null}
      {showFirstLoadSkeleton ? <MobileFirstLoadSkeleton /> : null}
      {entries.map((entry) => {
        const isActive = !showFirstLoadSkeleton && entry.key === effectiveTargetKey;
        return (
          <Activity
            key={entry.key}
            mode={isActive ? "visible" : "hidden"}
            name={`pwa-tab:${entry.key}`}
          >
            <div
              hidden={!isActive}
              aria-hidden={isActive ? undefined : true}
              className={isActive ? "cs-module-reveal" : undefined}
            >
              {entry.node}
            </div>
          </Activity>
        );
      })}
    </>
  );
}

