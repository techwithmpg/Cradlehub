/**
 * Owner Route Layout
 *
 * Wraps all /owner/* routes with workspace route prefetching so navigation
 * between owner pages feels instant.
 *
 * This layout is nested inside (dashboard)/layout.tsx, which already renders
 * the sidebar, header, and main scroll container.
 */

import { WorkspaceRoutePrefetcher } from "@/components/features/workspace/workspace-route-prefetcher";
import { OWNER_PREFETCH } from "@/components/features/workspace/workspace-prefetch-config";

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <WorkspaceRoutePrefetcher config={OWNER_PREFETCH} />
      {children}
    </>
  );
}
