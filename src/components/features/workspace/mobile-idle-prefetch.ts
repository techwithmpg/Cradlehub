import type { WorkspacePrefetchConfig } from "./workspace-prefetch-config";

/**
 * Select a bounded mobile idle-prefetch list without introducing new routes.
 *
 * This policy is opt-in. Desktop routes and all callers without a mobile
 * override (including the canonical Staff PWA) retain their current behavior.
 * An override can only remove an idle route, never prefetch an undeclared URL.
 */
export function resolveIdlePrefetchRoutes(
  config: Pick<WorkspacePrefetchConfig, "idle">,
  mobileIdleRoutes: readonly string[] | undefined,
  isMobileViewport: boolean
): string[] {
  if (!isMobileViewport || mobileIdleRoutes === undefined) {
    return config.idle;
  }

  const permitted = new Set(mobileIdleRoutes);
  return config.idle.filter((route) => permitted.has(route));
}
