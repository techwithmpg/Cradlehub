/**
 * Manager Route Layout
 *
 * Wraps all /manager/* routes with workspace route prefetching so navigation
 * between manager pages feels instant.
 *
 * This layout is nested inside (dashboard)/layout.tsx, which already renders
 * the sidebar, header, and main scroll container.
 */

import { WorkspaceRoutePrefetcher } from "@/components/features/workspace/workspace-route-prefetcher";
import { MANAGER_PREFETCH } from "@/components/features/workspace/workspace-prefetch-config";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <WorkspaceRoutePrefetcher config={MANAGER_PREFETCH} />
      {children}
    </>
  );
}
